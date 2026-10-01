// Reads a component's geometry off the app's own rendering, as a spec subtree.
//
//   npm run web              # the app's dev server, port 8081
//   node tools/figma-plugin/measure.mjs ui/Badge ui/SectionCard
//
// The other direction from `kit.mjs`, which describes each component by hand. Here
// the gallery renders the real component with real props and this reads back what
// the browser computed: box, padding, gap, radius, fill, and the type. What comes
// out is the same vocabulary `spec.json` speaks, so the two can be compared line by
// line. It prints that by default and writes `measured.json` under `--emit`, which is
// what `kit.mjs` reads and checks its own thirteen against.
//
// **Not the board.** ADR 0021 and the plugin's README both warn against lifting a
// component out of the drawn screens: those are transcribed from screenshots, so
// what comes back is a usage wearing a component's name. This measures the app,
// which is the opposite direction and the only rendering that is not a transcription.
//
// Chrome has to be listening on 9222. `CHROME=...` overrides the endpoint.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROME ?? 'http://localhost:9222';
const APP = process.env.APP ?? 'http://localhost:8081';

/**
 * What the app finds in storage before it boots.
 *
 * The gallery is behind the app's door like every other route, and this origin is
 * the app's own rather than the workbench's, so the preview's fixtures are not
 * here. Only the entitlement, and only enough of it to open the door.
 */
const SESSION = {
  account: { email: 'alex.beispiel@example.org', name: 'Alex Beispiel' },
  entitlement: {
    tier: 'paid',
    appAccess: true,
    source: 'paid',
    validUntil: null,
    localAreas: [],
    memberSince: '2026-03-04T09:12:00.000Z',
  },
};

async function connect(url) {
  const target = await (
    await fetch(`${CHROME}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
  ).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) pending.get(message.id)(message);
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async (expression) => {
    const out = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (out.result?.exceptionDetails) {
      throw new Error(out.result.exceptionDetails.exception?.description ?? 'evaluate failed');
    }
    return out.result?.result?.value;
  };
  return {
    send,
    evaluate,
    close: async () => {
      await fetch(`${CHROME}/json/close/${target.id}`);
      ws.close();
    },
  };
}

/**
 * The reader that runs inside the page.
 *
 * A string rather than a function passed over, because it is evaluated in the
 * frame's own realm. It walks one specimen and reports what the browser computed,
 * with no interpretation: resolving a number to a token happens out here, where the
 * token table is, and where a mismatch can be printed instead of rounded away.
 */
const READER = `(() => {
  // The gallery draws each specimen inside a bordered box labelled canvas/surface.
  // The specimen itself is that box's last element, after the label.
  const boxes = [...document.querySelectorAll('div')].filter((el) => {
    const first = el.firstElementChild;
    return first && ['canvas', 'surface'].includes((first.textContent || '').trim())
      && first.childElementCount === 0;
  });

  const px = (v) => Math.round(parseFloat(v) || 0);
  const gapOn = (v) => (v === 'normal' ? 0 : px(v));

  function rgb(value) {
    const m = /rgba?\\(([^)]+)\\)/.exec(value || '');
    if (!m) return null;
    const [r, g, b, a] = m[1].split(',').map((n) => parseFloat(n));
    if (a === 0) return 'none';
    return '#' + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('');
  }

  // Left, right, top, bottom — the order the spec writes padding in, so a border and
  // a padding read the same way round.
  const SIDES = [['Left', 'left'], ['Right', 'right'], ['Top', 'top'], ['Bottom', 'bottom']];

  function walk(el, depth) {
    const s = getComputedStyle(el);
    const text = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    const kids = [...el.children].filter((c) => c.offsetParent !== null || c.getClientRects().length);
    const isText = text !== '' || [...el.classList].some((c) => c.startsWith('css-text-'));
    // Fill or hug, which is what auto-layout takes, rather than the pixel width a
    // filling row happens to have in this window.
    const box = el.getBoundingClientRect();
    const parent = el.parentElement;
    let width = Math.round(box.width);
    const bordered = SIDES.filter((side) => px(s['border' + side[0] + 'Width']) > 0);
    // HUG is a size taken from what is inside, so a box with nothing inside cannot
    // have one: Figma leaves a childless auto-layout frame at the hundred pixels a
    // fresh frame is born at. react-native-web's own switch thumb says
    // \`align-self: flex-start\` and holds nothing, and arrived on the board a hundred
    // pixels of white wide inside a forty-pixel switch.
    if (s.alignSelf === 'flex-start' && (isText || kids.length)) width = 'hug';
    else if (parent) {
      const ps = getComputedStyle(parent);
      const inner =
        parent.getBoundingClientRect().width - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight);
      if (Math.abs(inner - box.width) < 1) width = 'fill';
    }

    const node = {
      tag: el.tagName.toLowerCase(),
      // The app's own classes, which survive into the DOM. They say which token was
      // ASKED FOR; the computed values below say what came out. Both are needed:
      // several tokens share one value, so a colour alone cannot say whether the
      // component reached for \`accent\` or for \`red-500\`, and that difference is
      // most of what a design system is.
      classes: [...el.classList].filter((c) => !c.startsWith('css-')),
      w: width,
      // The number as well as the word. Inside a plain frame there is no such thing
      // as FILL — it is an auto-layout property — so a stacked child has to be given
      // a width, and this is the only place that still knows it.
      wpx: Math.round(box.width),
      h: Math.round(box.height),
      display: s.display,
      dir: s.flexDirection === 'row' ? 'H' : 'V',
      // Auto-layout has one gap ALONG its axis and one ACROSS it; CSS has one per
      // physical axis. Reading whichever was set and calling it the gap put six
      // pixels between the two halves of \`ArticleRow\`'s byline, where the app writes
      // \`gap-y-2xs\` and means the space between two wrapped LINES.
      gap: gapOn(s.flexDirection === 'row' ? s.columnGap : s.rowGap),
      crossGap: gapOn(s.flexDirection === 'row' ? s.rowGap : s.columnGap),
      // A row that wraps. Figma has the word, and without it a byline that runs past
      // its own width overflows instead of breaking.
      wrap: s.flexWrap === 'wrap' ? true : undefined,
      pad: [px(s.paddingLeft), px(s.paddingRight), px(s.paddingTop), px(s.paddingBottom)],
      radius: px(s.borderTopLeftRadius),
      fill: rgb(s.backgroundColor),
      // WHICH sides, not just the top one. \`border-b\` is a rule under a row, and a
      // box traced on all four sides is a different component: seven of the measured
      // components wore one, because the only side ever read was the top and that is
      // the side \`border-b\` leaves at zero.
      sides: bordered.map((side) => side[1]),
      stroke: bordered.length ? rgb(s['border' + bordered[0][0] + 'Color']) : null,
      strokeWeight: bordered.length ? px(s['border' + bordered[0][0] + 'Width']) : 0,
      align: s.justifyContent,
      cross: s.alignItems,
      self: s.alignSelf,
      opacity: s.opacity === '1' ? undefined : Number(s.opacity),
      // Auto-layout has no word for either of these, so the caller has to translate.
      position: s.position === 'absolute' ? 'absolute' : undefined,
      // A rail is wider than the screen and the app clips it. Figma does not unless
      // it is told to, so a bleeding image or a horizontal rail hung 48px out of its
      // own component and over whatever stood beside it.
      clip: s.overflowX !== 'visible' || s.overflowY !== 'visible' ? true : undefined,
      margin: [px(s.marginLeft), px(s.marginRight), px(s.marginTop), px(s.marginBottom)],
    };
    // Where it sits, for EVERY child and not only the absolute ones. A stack becomes
    // a plain frame, and a plain frame lays nothing out — so a child that the app
    // centred by \`items-center justify-center\` and that carries no coordinates of its
    // own lands at the corner. \`MediaCard\`'s play button did: 52 pixels at 0,0 in a
    // 176-pixel thumbnail it should have been in the middle of. Ignored by Figma
    // inside auto-layout, so the caller passes them on only where they mean something.
    if (parent) {
      const p = parent.getBoundingClientRect();
      node.x = Math.round(box.left - p.left);
      node.y = Math.round(box.top - p.top);
    }
    // A text node, which React Native Web marks with a class of its own. Without
    // that marker every empty box read as empty text, and the badge's seven-pixel
    // live dot arrived as a string.
    if (isText) {
      node.chars = text;
      node.font = s.fontFamily.split(',')[0].replace(/["']/g, '');
      node.size = px(s.fontSize);
      node.weight = s.fontWeight;
      node.lineHeight = px(s.lineHeight);
      node.tracking = s.letterSpacing === 'normal' ? 0 : parseFloat(s.letterSpacing);
      node.color = rgb(s.color);
      node.transform = s.textTransform === 'none' ? undefined : s.textTransform;
      // Which edge the line is set against. \`ImpactFooter\` sets both of its lines
      // centred and had them drawn hard left.
      node.textAlign = s.textAlign;
    }
    if (kids.length && depth < 12) node.children = kids.map((k) => walk(k, depth + 1));
    return node;
  }

  return boxes.map((box) => ({
    surface: (box.firstElementChild.textContent || '').trim(),
    // A specimen that renders nothing leaves the box holding only its own label,
    // and reading \`lastElementChild\` then measures the word "canvas". Two
    // components did exactly that — an empty rail and a player with no track — and
    // arrived on the board as a component whose entire content was that word.
    empty: box.childElementCount < 2,
    // The label of the specimen pair, which the gallery puts above the two boxes.
    label: (box.parentElement?.firstElementChild?.textContent || '').trim(),
    root: walk(box.lastElementChild, 0),
  }));
})()`;

/** `#ff5064` back to `@color-accent`, in the scheme it was measured in. */
/**
 * The order to prefer when several tokens share one value.
 *
 * `always-light` and `white` are the same hex, and so are `accent` and `red-500`.
 * Which name to write is not a detail: AGENTS.md keeps `always-light` as the app's
 * spelling and reserves the primitives for the places a colour must NOT follow the
 * scheme. A class says which was meant and is preferred over any of this; these are
 * the colours set in TypeScript, where there is no class to read.
 */
const PREFERRED = {
  text: ['on-', 'accent', 'always-', 'canvas', 'surface', 'stroke'],
  fill: ['accent', 'canvas', 'surface', 'always-', 'stroke', 'on-'],
  stroke: ['stroke', 'accent', 'on-', 'always-', 'canvas', 'surface'],
};

function rank(name, role) {
  const order = PREFERRED[role] ?? PREFERRED.fill;
  const i = order.findIndex((p) => name.startsWith(`color-${p}`));
  return i === -1 ? order.length : i;
}

function tokeniser(tokens, unnamed) {
  /**
   * Both schemes, which is what tells a role from a colour.
   *
   * `always-dark` and `on-canvas` are the same hex in light and different in dark:
   * one is a colour that must not follow the scheme, the other is the role of text
   * on the page. A light-only reading cannot tell them apart and named every title
   * `always-dark`, which would have made a dark board unreadable — the very fault
   * the gallery draws two surfaces to catch. So the measurement runs twice and a
   * token has to match on both.
   */
  const pairs = { text: {}, fill: {}, stroke: {} };
  for (const [name, value] of Object.entries(tokens)) {
    if (!name.startsWith('color-') || typeof value !== 'object') continue;
    const { light, dark } = value;
    if (!light) continue;
    const both = `${light}|${dark ?? light}`;
    // Per role, because what a colour should be CALLED depends on what it paints.
    // The same hex is `stroke-strong` under a rule and `on-canvas-muted` under a
    // date, and only one of those reads as a mistake in the other place.
    for (const role of Object.keys(pairs)) {
      if (
        pairs[role][both] === undefined ||
        rank(name, role) < rank(pairs[role][both].slice(1), role)
      ) {
        pairs[role][both] = `@${name}`;
      }
    }
  }
  /**
   * Exact on both schemes, or nothing.
   *
   * The light value alone was enough to guess with, and guessing is what this must
   * not do: a name that is confidently wrong reads as a decision somebody made. A
   * pair that matches no token comes through as the two hexes, and the run says
   * which node it was — a question for a person rather than a silent answer.
   */
  const named = (hex, dark, role) => pairs[role][`${hex}|${dark}`];
  const numbers = (prefix) =>
    Object.entries(tokens)
      .filter(([name, value]) => name.startsWith(prefix) && typeof value === 'number')
      .reduce((map, [name, value]) => ({ ...map, [value]: `@${name}` }), {});
  const spacing = numbers('spacing-');
  const radius = numbers('radius-');
  return {
    colour: (hex, dark, role = 'fill') => {
      if (!hex || hex === 'none') return null;
      // Both readings, or no name. `dark ?? hex` stood here and defeated the whole
      // argument above: a node with no dark reading was looked up as if its colour
      // were the same in both schemes, and the only tokens that match such a pair
      // are the `always-*` ones — so a missing twin named every title
      // `always-dark` and every card `always-light`, which is exactly the light-only
      // reading this was built to refuse, arrived at by a different route.
      if (!dark) {
        unnamed.add(`${hex} as a ${role}, with no dark reading of that node`);
        return hex;
      }
      const name = named(hex, dark, role);
      if (name) return name;
      unnamed.add(`${hex}${dark !== hex ? ` / ${dark}` : ''} as a ${role}`);
      return hex;
    },
    spacing: (n) => (n === 0 ? 0 : (spacing[n] ?? n)),
    radius: (n) => (n === 0 ? 0 : (radius[n] ?? n)),
    /** Whether the token table has a name, so a class can be believed or ignored. */
    knows: (name) => tokens[name] !== undefined,
  };
}

/**
 * What the classes asked for, in the spec's vocabulary.
 *
 * Uniwind writes the app's classes into the DOM unchanged, so this is the
 * component's own words rather than an inference from pixels. Only the handful of
 * shapes the kit needs are read; anything else stays in `classes` for a person to
 * look at.
 */
function fromClasses(classes, t) {
  const asked = {};
  /**
   * A token name, or nothing at all.
   *
   * The tail of a class is not always a token: `border-b` names a SIDE, and it read
   * as `@color-b` — a name the interpreter refuses, so one reordered class list
   * (`border-stroke border-b` rather than `border-b border-stroke`) would have taken
   * the whole board down with "no such token". Anything the table does not have is
   * left alone here and the measured value answers instead, which is the same
   * fallback an unclassed colour already gets.
   */
  const token = (prefix, tail) => {
    const known = t.knows(`${prefix}-${tail.split('/')[0]}`);
    return known ? `@${prefix}-${tail}` : undefined;
  };
  for (const name of classes) {
    let m;
    if ((m = /^bg-(.+)$/.exec(name)))
      asked.fill = m[1] === 'transparent' ? null : token('color', m[1]);
    else if ((m = /^border-([a-z].*)$/.exec(name))) asked.stroke = token('color', m[1]);
    else if ((m = /^rounded-(.+)$/.exec(name)))
      asked.radius = m[1] === 'full' ? 'full' : token('radius', m[1]);
    // Both axes or neither: `gap-y-2xs` names one, and which of the two words that
    // is depends on the direction the parent lays out in. The measured number carries
    // the same name anyway — `t.spacing(6)` is `@spacing-2xs` — so the axis case is
    // left to it rather than guessed at here.
    else if ((m = /^gap-(.+)$/.exec(name))) asked.gap = token('spacing', m[1]);
    else if (name === 'flex-row') asked.dir = 'H';
  }
  // A class the table does not know leaves the key present and empty, which reads as
  // "the app asked for nothing" rather than "the app asked for something unknown".
  for (const key of Object.keys(asked)) if (asked[key] === undefined) delete asked[key];
  return asked;
}

/**
 * The app's font files back to the two things the spec says about type.
 *
 * `theme/fonts.ts` loads one file per cut, because Android ignores `fontWeight` on a
 * custom font, so the family name is where the weight is. Reading `font-weight`
 * instead calls every cut regular, and did: the badge's label was bold on the board
 * for that reason and had never been bold in the app.
 */
function typeOf(font) {
  const family = /merriweather/i.test(font ?? '') ? 'serif' : 'sans';
  const weight = /bold/i.test(font ?? '')
    ? /semibold/i.test(font)
      ? 'semibold'
      : 'bold'
    : 'regular';
  return { family, weight, icon: /ionicons/i.test(font ?? '') };
}

/**
 * Which of the fifteen text styles this is, if it is one of them.
 *
 * A style rather than three numbers, because a style reaches every text node
 * carrying it across every page, including nodes inside other components, which a
 * component can never reach. `kit.mjs` makes the same argument at greater length.
 */
function styleNamer(tokens, specs) {
  const byShape = {};
  for (const [name, spec] of Object.entries(specs)) {
    const size = tokens[`text-${String(spec.size).replace(/^text-/, '')}`];
    const weight = spec.weight === 'normal' ? 'regular' : spec.weight;
    byShape[`${spec.family}|${weight}|${size}`] ??= name;
  }
  return (font, size) => {
    const { family, weight } = typeOf(font);
    return byShape[`${family}|${weight}|${size}`];
  };
}

/**
 * Where a box puts what is inside it, which auto-layout DOES have a word for.
 *
 * Read all along and dropped on the floor until 2026-09-10, so every one of the
 * thirty-four `items-center` rows in the app drew against its top edge: an episode
 * row's thumbnail, title and duration each sat at a different height than in the app.
 * `space-around` and `space-evenly` have no Figma equivalent and are printed instead
 * of being rounded down to the one that does.
 */
const ALIGN = { 'flex-end': 'MAX', end: 'MAX', center: 'CENTER', 'space-between': 'SPACE_BETWEEN' };
const CROSS = { 'flex-end': 'MAX', end: 'MAX', center: 'CENTER', baseline: 'BASELINE' };
const AT_START = ['flex-start', 'start', 'normal', 'stretch', 'left', 'auto'];

/** A line's own edge, which the spec spells in lower case and Figma in upper. */
const ALIGN_TEXT = { center: 'center', right: 'right', end: 'right', justify: 'justified' };

/**
 * Which sides carry the border, in the two spellings the spec has for it.
 *
 * `strokeSides` takes `top` or `bottom`, which is what the app writes: `border-b`
 * under a row. All four sides is a frame's own default and needs no word. Anything
 * else — one vertical edge, or two — has no spelling, so it is printed rather than
 * drawn as the nearest thing.
 */
function sidesOf(sides, gaps, name) {
  if (sides.length === 0 || sides.length === 4) return undefined;
  if (sides.length === 1 && (sides[0] === 'top' || sides[0] === 'bottom')) return sides[0];
  gaps.add(`${name}: a border on ${sides.join(' and ')} only, which the spec cannot say`);
  return undefined;
}

function alignment(node, table, value, gaps, name) {
  if (value === undefined || AT_START.includes(value)) return undefined;
  const mapped = table[value];
  if (mapped === undefined) {
    gaps.add(`${name}: "${value}" is an alignment auto-layout has no word for`);
    return undefined;
  }
  // BASELINE is a row's answer only, and Figma throws on it in a column.
  if (mapped === 'BASELINE' && node.dir !== 'H') return 'CENTER';
  return mapped;
}

/**
 * The measured tree, in the spec's vocabulary, with the five things auto-layout has
 * no word for translated on the way.
 *
 * Each rule is here rather than left for the reader of the output, because each one
 * is a decision and a decision that is not written down gets made again differently.
 * The gaps it cannot close are collected in `gaps` and printed, the way `kit.mjs`
 * prints its own.
 */
function tokenise(node, t, style, gaps, name, twin, inPlainFrame) {
  const out = { t: node.chars !== undefined ? 'text' : 'frame' };
  // FILL and HUG mean nothing in a plain frame — they are auto-layout's words — and
  // Figma leaves such a child at whatever size it was born with: two children of a
  // stack came out 24 and 40 pixels wide inside a 319-pixel component, which is how
  // this was found, and a childless frame that said HUG arrived a hundred wide.
  // Coordinates are the other half of the same trade: a plain frame lays nothing out,
  // so every child needs them, and auto-layout ignores them, so no child there should
  // carry one.
  const width = inPlainFrame ? node.wpx : node.w;
  const x = inPlainFrame ? node.x : undefined;
  const y = inPlainFrame ? node.y : undefined;

  if (node.chars !== undefined) {
    const { family, weight, icon } = typeOf(node.font);
    if (icon) {
      // RULE 1, an icon. A glyph from an icon font reads back as the empty string,
      // its codepoint being in a private-use area. `NavCard.icon` is already a
      // declared gap in `kit.mjs`; this is the same gap seen from the other side.
      gaps.add(`${name}: an icon font glyph, drawn as a placeholder until the spec learns vectors`);
      return {
        t: 'text',
        // U+25C9, and the codepoint is not a free choice: the placeholder is set in
        // the board's own sans, so the FAMILY has to have the glyph or Figma
        // substitutes a font nobody chose and a machine without one draws a box. The
        // obvious `◎` U+25CE is in no cut of either family, which is the same trap as
        // the emoji twins one section up and has no check either — the font check
        // catches a missing family, never a missing glyph.
        chars: '◉',
        font: 'sans',
        size: node.size,
        x: x,
        y: y,
        color: t.colour(node.color, twin?.color, 'text'),
      };
    }
    Object.assign(out, {
      style: style(node.font, node.size),
      chars: node.chars,
      // The width, which decides where it wraps. A Figma text node hugs by default,
      // so without this every title became one long line and ran across whatever
      // stood beside it on the board — measured, and the first thing anyone noticed.
      // The app wraps at the phone width, and that width is exactly what the box
      // reports, so carrying it over reproduces the same break.
      w: width,
      x: x,
      y: y,
      font: family === 'sans' ? undefined : family,
      weight: weight === 'regular' ? undefined : weight,
      size: node.size,
      color: t.colour(node.color, twin?.color, 'text'),
      // The spec takes tracking as a percentage of the size, which is what Figma
      // takes; the browser reports pixels.
      tracking: node.tracking ? Math.round((node.tracking / node.size) * 10000) / 100 : undefined,
      align: ALIGN_TEXT[node.textAlign],
      transform: node.transform,
    });
  } else {
    const asked = fromClasses(node.classes ?? [], t);
    const stacked = (node.children ?? []).some((c) => c.position === 'absolute');

    // RULE 5, a circle. `rounded-full` is a radius the spec cannot take, because
    // its `radius` is a number; a box that is round and has nothing in it is an
    // ellipse, which the vocabulary does have. One with children keeps its corners
    // as half its height, which is the same drawing by another route.
    if (asked.radius === 'full' && !node.children?.length) {
      return {
        t: 'ellipse',
        w: width,
        h: node.h,
        x: x,
        y: y,
        fill: asked.fill !== undefined ? asked.fill : t.colour(node.fill, twin?.fill),
        // A ring around an avatar is a stroke on an ellipse, and the interpreter
        // paints one; leaving it out here lost it without a word.
        stroke: node.sides.length
          ? (asked.stroke ?? t.colour(node.stroke, twin?.stroke, 'stroke'))
          : undefined,
      };
    }
    if (asked.radius === 'full') asked.radius = Math.round(node.h / 2);
    Object.assign(out, {
      // RULE 2, a stack. Figma honours x/y only when the parent is a plain frame and
      // ignores them inside auto-layout, so a parent holding an absolute child has to
      // give up its layout. That is the same rule the Plugin API has, so there is
      // nothing extra to remember — but it has to be decided here, because nothing
      // about the measurement says which of the two a stack should become.
      dir: stacked ? undefined : node.dir,
      // Alignment belongs to a box that lays out; a stack has given that up, and
      // Figma throws on `primaryAxisAlignItems` where there is no layout mode.
      align: stacked ? undefined : alignment(node, ALIGN, node.align, gaps, name),
      cross: stacked ? undefined : alignment(node, CROSS, node.cross, gaps, name),
      w: width,
      h: node.h,
      x: x,
      y: y,
      gap: node.gap ? (asked.gap ?? t.spacing(node.gap)) : undefined,
      // WRAP is a row's word in Figma, and a column that wraps has no equivalent.
      wrap: !stacked && node.dir === 'H' ? node.wrap : undefined,
      crossGap:
        !stacked && node.dir === 'H' && node.wrap && node.crossGap
          ? t.spacing(node.crossGap)
          : undefined,
      pad: node.pad.some(Boolean) ? node.pad.map((n) => t.spacing(n)) : undefined,
      radius: node.radius ? (asked.radius ?? t.radius(node.radius)) : undefined,
      clip: node.clip,
      // RULE 3, a fill at part opacity. `bg-always-dark/70` survives as the class
      // says it, because the interpreter now reads `@color-x/NN` and puts the alpha
      // on the paint rather than on the node — so a translucent surface does not
      // fade the icon standing on it.
      fill: asked.fill !== undefined ? asked.fill : t.colour(node.fill, twin?.fill),
      // No side drawn, no stroke. The class says the colour and the class also says
      // the side: `border-b border-stroke` asked for `@color-stroke` and got a box
      // traced on all four sides, because a stroke with no side was read as a stroke.
      stroke: node.sides.length
        ? (asked.stroke ?? t.colour(node.stroke, twin?.stroke, 'stroke'))
        : undefined,
      strokeWeight: node.sides.length ? node.strokeWeight || undefined : undefined,
      strokeSides: sidesOf(node.sides, gaps, name),
      opacity: node.opacity,
    });
  }

  for (const key of Object.keys(out)) {
    if (out[key] === undefined || out[key] === null) delete out[key];
  }

  if (node.children) {
    const children = [];
    const row = node.dir === 'H';
    const last = node.children.length - 1;
    for (const [i, child] of node.children.entries()) {
      // RULE 4, a margin. The spec has no margins, only gaps and `space` nodes, and
      // a gap belongs to the parent while a margin belongs to one child. A `space`
      // is the honest translation: it says exactly what the margin said, between the
      // two children it stood between. Along the axis the parent lays out on, since
      // a row's spacing is written `mr-3xs` and a column's `mt-2xs`.
      const [left, right, top, bottom] = child.margin ?? [0, 0, 0, 0];
      const [before, after] = row ? [left, right] : [top, bottom];
      const space = (n) =>
        row ? { t: 'space', w: t.spacing(n) } : { t: 'space', h: t.spacing(n) };
      if (before && !stackedIn(node)) children.push(space(before));
      children.push(tokenise(child, t, style, gaps, name, twin?.children?.[i], stackedIn(node)));
      if (after && i !== last && !stackedIn(node)) children.push(space(after));
    }
    out.children = children;
  }
  return out;
}

function stackedIn(node) {
  return (node.children ?? []).some((c) => c.position === 'absolute');
}

/**
 * `tone="club"` — the specimen's own label, which is already the variant.
 *
 * The catalogue writes each label "in the props' own words", so the gallery has
 * been carrying the variant axis all along. `default` and anything that does not
 * parse are not variants: one specimen is a component, several unnamed ones are a
 * component per specimen, and neither is a set.
 */
function variantOf(label) {
  const pair = /^([A-Za-z][\w]*)="([^"]*)"$/.exec(label ?? '');
  if (pair) return { prop: pair[1], value: pair[2] };
  const bare = /^([A-Za-z][\w]*)$/.exec(label ?? '');
  if (bare && bare[1] !== 'default') return { prop: bare[1], value: 'true' };
  return null;
}

/** One component, from its specimens: a variant set, or a single component. */
function assemble(id, boxes, dark, t, style, gaps) {
  const name = id;
  const drawable = boxes.filter((box) => !box.empty);
  if (drawable.length < boxes.length) {
    gaps.add(
      `${name}: ${boxes.length - drawable.length} specimen(s) render nothing, so there is nothing to draw`,
    );
  }
  boxes = drawable;
  if (boxes.length === 0) return [];
  /**
   * The dark reading of the SAME specimen, found by its label rather than its place.
   *
   * Two lists lined up by index part company as soon as one of them is filtered, and
   * the line above filters one of them: a component with an empty specimen paired
   * every later light specimen with the wrong dark one, and a colour compared against
   * a foreign node's colour is a wrong name or a hex, silently either way.
   */
  const twins = new Map();
  for (const box of dark) {
    if (box.empty) continue;
    twins.set(box.label, [...(twins.get(box.label) ?? []), box]);
  }
  const drawn = boxes.map((box) => {
    const twin = (twins.get(box.label) ?? []).shift();
    if (twin === undefined) {
      gaps.add(
        `${name}: no dark reading of the specimen "${box.label}", so its colours are unnamed`,
      );
    }
    return {
      variant: variantOf(box.label),
      node: tokenise(box.root, t, style, gaps, name, twin?.root),
    };
  });

  const props = new Set(drawn.map((d) => d.variant?.prop).filter(Boolean));
  // Two or more, because a variant set with one variant is a set nobody can switch.
  if (props.size === 1 && drawn.length > 1 && drawn.every((d) => d.variant)) {
    const prop = [...props][0];
    return {
      t: 'variants',
      name: name,
      prop: prop,
      // Without the `t`: an option is always a component, whatever its measured
      // root was, and a description that says `frame` here takes the page down with
      // "A COMPONENT_SET node cannot have children of type other than COMPONENT".
      options: drawn.map((d) => {
        const { t: _shape, ...body } = d.node;
        return { value: d.variant.value, ...body };
      }),
    };
  }

  if (drawn.length > 1) {
    gaps.add(
      `${name}: ${drawn.length} specimens on ${props.size} axes, so they are ${drawn.length} components rather than one set`,
    );
  }
  // The measured node first and `t` after it, not the other way round: a spread that
  // let the node's own `t` through made every one of these a plain frame, which
  // draws the same and is not a component, so nothing on the board could instance
  // it. A component also has to be a container, so a root that measured as a text
  // node or an ellipse is wrapped in one.
  return drawn.map((d, i) => {
    const body =
      d.node.t === 'frame' ? d.node : { t: 'frame', dir: 'V', w: 'hug', children: [d.node] };
    return {
      ...body,
      t: 'component',
      name: drawn.length === 1 ? name : `${name}, ${boxes[i].label}`,
    };
  });
}

const args = process.argv.slice(2);
const emit = args.includes('--emit');
const ids = args.filter((a) => !a.startsWith('--'));
if (ids.length === 0) throw new Error('name at least one component, for example ui/Badge');

const spec = JSON.parse(await readFile(join(HERE, 'spec.json'), 'utf8'));
const unnamed = new Set();
const t = tokeniser(spec.tokens, unnamed);

/**
 * The typography specs, read out of the generated TypeScript rather than imported.
 *
 * This script runs in plain node and that file is a module of the app's toolchain;
 * what is needed from it is one literal, and a regex reaches it without dragging in
 * a compiler. It fails loudly if the shape ever changes, which is the point.
 */
const TYPOGRAPHY = await (async () => {
  const source = await readFile(
    join(HERE, '../../packages/design-tokens/src/typography.generated.ts'),
    'utf8',
  );
  const body = /=\s*(\{[\s\S]*?\n\})/.exec(source);
  if (!body) throw new Error('typography.generated.ts no longer holds one object literal');
  return JSON.parse(body[1]);
})();
const style = styleNamer(spec.tokens, TYPOGRAPHY);

const gaps = new Set();
const measured = {};

/** One pass over one component, in one scheme. */
async function read(id, scheme) {
  const page = await connect(`${APP}/`);
  await page.send('Page.enable');
  await page.send('Runtime.enable');
  // A phone, because a component that fills its parent is only itself at the width
  // it ships at: measured in a 1280px window, every filling row came out 691 wide
  // and the number said nothing.
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 393,
    height: 852,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: scheme }],
  });
  // The tab answers before it has left about:blank, and `localStorage` on that
  // document is not this origin's — reading it throws SecurityError rather than
  // returning empty, which is the one helpful thing about it.
  for (let tries = 0; tries < 40; tries++) {
    const here = await page.evaluate('document.URL');
    if (typeof here === 'string' && here.startsWith(APP)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await page.evaluate(
    `localStorage.setItem('kv:store.session', ${JSON.stringify(JSON.stringify(SESSION))})`,
  );
  await page.send('Page.navigate', { url: `${APP}/gallery?c=${id}&bare=1` });

  let boxes = [];
  for (let tries = 0; tries < 40 && boxes.length === 0; tries++) {
    await new Promise((r) => setTimeout(r, 500));
    boxes = (await page.evaluate(READER)) ?? [];
  }
  await page.close();
  return boxes.filter((b) => b.surface === 'canvas');
}

for (const id of ids) {
  // Twice, because one scheme cannot tell a role from a colour: see the tokeniser.
  const light = await read(id, 'light');
  if (light.length === 0) {
    console.error(`${id}: nothing drawn — is the app's dev server up, and does that name exist?`);
    continue;
  }
  const dark = await read(id, 'dark');
  // Nothing at all from the dark pass is not a component with no colours, it is a
  // pass that did not happen — a slow first paint, a name that stopped resolving. A
  // token has to match on both values, so every colour would come through unnamed
  // and the entry would be written as a page of hex. Refuse it and keep whatever
  // `measured.json` already says about this component.
  if (dark.length === 0) {
    console.error(`${id}: the dark reading came back empty, so nothing was written for it`);
    continue;
  }

  measured[id] = assemble(id, light, dark, t, style, gaps);
  if (!emit) {
    console.log(`\n### ${id} — ${light.length} specimens\n`);
    console.log(JSON.stringify(measured[id], null, 1));
  }
}

for (const gap of [...gaps].sort()) console.log(`  gap: ${gap}`);
for (const colour of [...unnamed].sort()) {
  console.log(`  unnamed: ${colour} — no token has that pair of values`);
}

/**
 * `JSON.stringify` with short arrays kept on one line, which is what oxfmt wants.
 *
 * A generated file that fails the repository's own format check is a generated file
 * somebody has to remember to format, and `npm run check` would go red on every run
 * of this script. Four numbers of padding read better on one line anyway.
 */
function formatted(value) {
  const wide = JSON.stringify(value, null, 2);
  return wide.replace(
    /\[\n\s+((?:"[^"\n]*"|-?[\d.]+)(?:,\n\s+(?:"[^"\n]*"|-?[\d.]+))*)\n\s+\]/g,
    (all, body) => {
      const line = `[${body.split(/,\n\s+/).join(', ')}]`;
      return line.length <= 90 ? line : all;
    },
  );
}

if (emit) {
  const out = join(HERE, 'measured.json');
  // Merged, not replaced. This is a per-component tool: re-reading one after a fix
  // must not drop the other thirty-six, and losing them is the kind of thing only
  // the next full run would notice.
  //
  // MERGED INTO THE FILE'S OWN ORDER, and that is the part worth stating. Writing
  // `measured` instead would put whatever was just re-read at the top, so a run
  // that changed nothing still produced a diff the size of the file — measured
  // once at 420 lines moved for two entries whose content was identical, which is
  // a review cost with no information in it. The file decides the order; a
  // component this run measured for the first time is appended.
  const merged = await readFile(out, 'utf8')
    .then((text) => JSON.parse(text))
    .catch(() => ({}));
  Object.assign(merged, measured);
  await writeFile(out, `${formatted(merged)}\n`);
  const count = Object.keys(merged).length;
  console.log(`${count} component${count === 1 ? '' : 's'} written to ${out}`);
}
