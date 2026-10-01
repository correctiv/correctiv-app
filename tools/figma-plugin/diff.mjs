// The difference between two descriptions of the same page.
//
//     diff(generated, reported) = what a person changed in Figma
//
// `code.js` draws `spec.json` onto the board and stamps every node it draws with its
// path in the spec. After a draw, and again before a redraw, it describes the
// `Bausteine` page in the same vocabulary the spec speaks and posts that description
// to the server, which holds both and calls this. A non-empty result means a redraw
// would destroy somebody's work, so the redraw waits (ADR 0069).
//
// It is a pure function: no Figma, no network, no clock. The Plugin API calls that
// PRODUCE a description cannot be tested outside Figma — `code.js` needs a running
// editor and a real file — so what is tested here is the half that decides. If this
// is right and the board is described honestly, the warning is right.
//
// Both sides are trees of nodes in one shared shape, so the same comparison runs on
// either. A node carries:
//
//     key      its path in the spec, e.g. `screens[0].children[1].options[0]`
//     t        'frame' | 'text' | 'rect' | 'ellipse' | 'instance' | 'variants' | …
//     name     the node's name
//     …        the fields the vocabulary speaks (see COMPARED)
//     children | options   the children, or a variant set's options
//
// The key is the identity. Figma ids do not survive a redraw; this does, because it
// is derived from the spec and re-stamped on every draw (ADR 0069 §2).

/**
 * The fields a difference in would be visible, and the ones a description can answer.
 *
 * Two rules decide membership, and both matter more than the list:
 *
 * **Only what the spec EXPRESSES is compared.** A field the generated side does not
 * mention is not part of the contract, and Figma's own defaults would otherwise
 * report a difference on every node — `opacity: 1`, `clip: false`, a wrap flag that
 * is false because nothing asked for wrapping. Comparing only what is asked for is
 * what keeps the warning worth reading (ADR 0069 §1).
 *
 * **What the API cannot read back is not in here.** `x`, `y` and `transform` are in
 * the spec and NOT in this list: a position is not an expression of intent, and the
 * kit's own layout produces positions as a consequence, so comparing them would fire
 * on a reflow. That is the vocabulary ceiling, drawn at the only place it can be
 * enforced — a field that is not compared cannot produce a difference.
 */
export const COMPARED = [
  'name',
  'dir',
  'pad',
  'gap',
  'wrap',
  'crossGap',
  'align',
  'cross',
  'fill',
  'stroke',
  'strokeWeight',
  'strokeSides',
  'radius',
  'w',
  'h',
  'clip',
  'dash',
  'opacity',
  'chars',
  'size',
  'font',
  'weight',
  'color',
  'tracking',
  'leading',
  'style',
  'of',
  'set',
];

/**
 * Flatten a spec tree into a map of key → node.
 *
 * The key is the node's path in the spec: a root screen is `screens[i]`, a child is
 * `parent.children[j]`, a variant option is `parent.options[j]`. That is exactly the
 * path `code.js` stamps with `setPluginData`, so the two sides meet on it.
 *
 * A variant set's options are keyed under `options`, not `children`, because the
 * interpreter builds them under `options` and a key that disagreed with the stamp
 * would match nothing — the whole subtree would read as added and removed at once.
 */
export function flattenSpec(node, path, out = new Map()) {
  out.set(path, node);
  const isSet = node.t === 'variants';
  const children = isSet ? node.options : node.children;
  if (!Array.isArray(children)) return out;
  children.forEach((child, i) => {
    flattenSpec(child, `${path}.${isSet ? 'options' : 'children'}[${i}]`, out);
  });
  return out;
}

/**
 * The key given to a node nobody stamped — one a person drew by hand.
 *
 * It has to be a key, or the node is invisible and a redraw deletes it in silence,
 * which is the very thing this exists to prevent. It has to be a key the SPEC CANNOT
 * produce, or a hand-drawn node could land on a spec path and read as an edit to
 * something it has nothing to do with. So it carries a `+` and the word `hand`, and
 * a spec path is `screens[0].children[1]` throughout: the two namespaces cannot meet.
 */
function handKey(parentKey, index) {
  return (parentKey === undefined ? '' : parentKey) + '+hand[' + index + ']';
}

/**
 * Flatten a board description into a map of key → node.
 *
 * The keys are the ones `code.js` stamped, so they are already spec paths. A node
 * nobody stamped is given a `handKey` instead: it has no spec entry, so it comes out
 * as `added`, and a redraw would delete it.
 */
export function flattenBoard(node, out = new Map(), parentKey = undefined, index = 0) {
  const key = node.key || handKey(parentKey, index);
  // A hand-drawn node may contain hand-drawn children; they hang off its hand key, so
  // the whole hand-drawn subtree is reported rather than only its root.
  if (node.key) out.set(node.key, node);
  else out.set(key, { ...node, key });

  const children = node.options ?? node.children;
  if (!Array.isArray(children)) return out;
  children.forEach((child, i) => flattenBoard(child, out, key, i));
  return out;
}

/**
 * Resolve a scale token to its number, and leave every other value alone.
 *
 * `@spacing-2xs` and `6` are the same padding, so the scales are resolved before the
 * comparison — the scale's names are its point, and a description that says six pixels
 * has to compare equal to one that says `@spacing-2xs`.
 *
 * A COLOUR stays a name, and that is deliberate rather than an omission: resolving it
 * would make `@color-accent` and `@color-red-500` compare equal whenever their light
 * values agree, and the difference between two names is the thing a design system is
 * for (ADR 0069 §3). A token the table does not have is left as it is, so it reads as
 * a difference rather than quietly becoming something else.
 */
export function normalize(value, tokens) {
  if (Array.isArray(value)) return value.map((v) => normalize(v, tokens));
  if (typeof value !== 'string') return value;
  if (value.charAt(0) !== '@') return value;
  const cut = value.indexOf('/');
  const name = value.slice(1, cut === -1 ? undefined : cut);
  const t = tokens?.[name];
  return typeof t === 'number' ? t : value;
}

/**
 * Deep equality for the values this compares: a string, a number, an array of numbers
 * (a padding), or a plain object (an instance's `set`).
 *
 * Written out rather than reached for, because `JSON.stringify` cannot tell an absent
 * key from an `undefined` one and the difference between "the board does not say" and
 * "the board says nothing" is the difference between a removed value and a defaulted
 * one.
 */
function equal(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]));
  }
  return false;
}

/**
 * Classify a difference: could the board's value be adopted into the spec?
 *
 * `expressible` — the board's value is a known token, so it could be written into the
 * spec as one. `off-scale` — a literal, a hex, or a number the token table does not
 * have; adopting it would put the board in charge of a number `kit.mjs`'s `px()`
 * already refuses to invent (ADR 0069 §3).
 *
 * The class is information, not permission: `diff` blocks on both.
 */
export function classify(value, tokens) {
  if (typeof value === 'string' && value.charAt(0) === '@') {
    const name = value.slice(1).split('/')[0];
    if (tokens?.[name] !== undefined) return 'expressible';
  }
  return 'off-scale';
}

/**
 * Compare the fields two nodes agree to speak about.
 *
 * A field is compared when the GENERATED side expresses it — see COMPARED. When the
 * board says nothing about a field the spec does express, that is a difference and not
 * a skip: the spec asked for a radius and the board has none, which is exactly what a
 * person removing a corner's rounding looks like.
 */
function compareNode(genNode, repNode, key, tokens, out) {
  for (const field of COMPARED) {
    const expected = genNode[field];
    if (expected === undefined) continue;
    const expectedValue = normalize(expected, tokens);
    const actualValue = normalize(repNode[field], tokens);
    if (equal(expectedValue, actualValue)) continue;
    out.push({
      key,
      kind: 'changed',
      property: field,
      expected: expectedValue,
      actual: actualValue,
      class: classify(actualValue, tokens),
    });
  }
}

/**
 * The difference between a generated description and a reported one.
 *
 * `generated` is what the code produced: a spec tree, or — with `generatedIsBoard` — a
 * board description from an earlier draw, which is what the server diffs when it asks
 * "what has a person changed since the last draw". `reported` is what the board says
 * now. Both are arrays of root nodes.
 *
 * An empty result means a redraw destroys nothing. A non-empty one means it does, so
 * the redraw waits until somebody has looked. A difference the spec cannot express
 * still counts: the vocabulary is the ceiling and "changed, cannot say how" is enough
 * to stop an overwrite (ADR 0069 §2).
 *
 * @returns {Array<{key: string, kind: 'removed'|'added'|'changed', property?: string,
 *   expected?: unknown, actual?: unknown, name?: string,
 *   class: 'expressible'|'off-scale'|'structural'}>}
 */
export function diff(generated, reported, tokens = {}, opts = {}) {
  const genMap = new Map();
  if (opts.generatedIsBoard) {
    for (const node of generated) flattenBoard(node, genMap);
  } else {
    generated.forEach((node, i) => flattenSpec(node, `screens[${i}]`, genMap));
  }
  const repMap = new Map();
  for (const node of reported) flattenBoard(node, repMap);

  const out = [];
  for (const [key, genNode] of genMap) {
    const repNode = repMap.get(key);
    // Drawn once and gone: the spec has it and the board does not.
    if (repNode === undefined) {
      out.push({ key, kind: 'removed', name: genNode.name, class: 'structural' });
      continue;
    }
    compareNode(genNode, repNode, key, tokens, out);
  }
  // Drawn by hand: the board has it and the spec does not, so a redraw would delete
  // it. Reported with whatever name it carries, because an unnamed node is the hardest
  // one to find on a 500-node page.
  for (const [key, repNode] of repMap) {
    if (!genMap.has(key)) {
      out.push({ key, kind: 'added', name: repNode.name, class: 'structural' });
    }
  }
  return out;
}
