// CORRECTIV Wireframes — an interpreter, not a builder.
//
// This file draws whatever `spec.json` describes and knows nothing about the app.
// That split is the point: the screens are DATA, served over 127.0.0.1 by
// `server.mjs`, so changing the board never means changing code and never means
// re-importing the plugin. Start the server, run this once, and every later edit to
// spec.json redraws the board within a second — unless the Bausteine page has been
// changed by hand, which it asks about first (ADR 0069).
//
// Nothing executable crosses the wire. The UI iframe fetches a JSON document and
// hands it here; this file is the only thing that ever touches the Plugin API.
//
// The vocabulary is deliberately small, and covers exactly what the local MCP
// server's write tools cannot: auto-layout with FILL children, ellipses, dash
// patterns, components and instances.
//
//   t: 'frame'    dir V|H, pad, gap, fill, stroke, radius, w, h, align, cross, clip,
//                 dash, children
//   t: 'text'     chars, size, font sans|serif, weight regular|semibold|bold, color,
//                 w, tracking, align
//   t: 'rect'     w, h, fill, stroke, radius
//   t: 'ellipse'  w, h, fill, stroke
//   t: 'space'    h, w         a fixed gap; `w: 'fill'` to span a plain parent
//   t: 'line'     colour, w    a 1px hairline; `w: 'fill'` to span the parent
//
// `w` and `h` take a number, 'fill' or 'hug'. Any node may carry x/y, which Figma
// honours when the parent is a plain frame and ignores inside auto-layout — the same
// rule the API itself has, so there is nothing to remember.

/**
 * The app's typefaces, per family and cut.
 *
 * There used to be a second rendering beside this one, a pencil wireframe in Kalam
 * with every colour flattened onto a grey ramp. It answered "how is the app built"
 * where this answers "what does it look like", and it went on 2026-09-10 because
 * the screens it was drawn for are settled and nobody was reading it. What it cost
 * while it existed was not the ramp: it was that every page, component and instance
 * carried a mode, and that a colour had to be asked twice — once for what it is and
 * once for what it becomes.
 */
const FONTS = {
  sans: {
    regular: { family: 'Source Sans 3', style: 'Regular' },
    semibold: { family: 'Source Sans 3', style: 'SemiBold' },
    bold: { family: 'Source Sans 3', style: 'Bold' },
  },
  serif: {
    regular: { family: 'Merriweather', style: 'Regular' },
    semibold: { family: 'Merriweather', style: 'Bold' },
    bold: { family: 'Merriweather', style: 'Bold' },
  },
};

/** '#rrggbb' to Figma's 0–1 triple. Everything in the spec is written as hex. */
function rgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: Number.parseInt(h.slice(0, 2), 16) / 255,
    g: Number.parseInt(h.slice(2, 4), 16) / 255,
    b: Number.parseInt(h.slice(4, 6), 16) / 255,
  };
}

// ---------------------------------------------------------------- tokens
//
// The app's design tokens, mirrored into Figma as variables with a Hell and a Dunkel
// mode. A colour in the spec written as "@color-accent" is BOUND to its variable
// rather than copied, so changing the value in Figma repaints every screen that uses
// it — which is the whole point of having tokens at all.
//
// The values come from packages/design-tokens/theme.css by way of the spec, so Figma
// never becomes a second source of truth for what the token IS. It is a place to try
// a different value out.

let TOKENS = {};
let VARS = {};

function isToken(value) {
  return typeof value === 'string' && value.charAt(0) === '@';
}

/**
 * `@color-always-dark/70` — a token at seventy per cent, the app's own spelling.
 *
 * Uniwind writes exactly this in the class it applies (`bg-always-dark/70`), and a
 * component that dims a fill this way had no way across before: flattening it to a
 * hex would have kept the colour and thrown away the token, which is the one thing a
 * board is for. The alpha rides on the PAINT, not on the node, so a translucent
 * surface does not fade the icon standing on it.
 */
function tokenName(value) {
  return isToken(value) ? value.slice(1).split('/')[0] : value;
}

function tokenAlpha(value) {
  if (!isToken(value)) return 1;
  const cut = value.indexOf('/');
  if (cut === -1) return 1;
  const percent = Number(value.slice(cut + 1));
  return Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) / 100 : 1;
}

/**
 * The scale's names, turned into the numbers they stand for, once for the whole
 * document.
 *
 * `measure.mjs` writes `@spacing-2xs` where it read six pixels, because a padding
 * bound to the scale is the point of having a scale. Everything below wants a
 * number, and the first run without this failed on the first `space` node —
 * "Property height failed validation: Expected number, received string", raised
 * inside Figma, with a half-drawn page left behind.
 *
 * Here rather than at each of the fourteen places that read one: a conversion that
 * has to be remembered at a call site is one that will be forgotten at the
 * fifteenth. `w` and `h` keep 'fill' and 'hug', which are not numbers and not
 * tokens either.
 */
const NUMERIC = [
  'w',
  'h',
  'x',
  'y',
  'gap',
  'crossGap',
  'radius',
  'size',
  'tracking',
  'leading',
  'strokeWeight',
];

function resolveScales(node) {
  if (Array.isArray(node)) {
    for (const child of node) resolveScales(child);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  for (const key of NUMERIC) {
    const value = node[key];
    if (!isToken(value)) continue;
    const t = TOKENS[tokenName(value)];
    if (typeof t === 'number') node[key] = t;
  }
  if (Array.isArray(node.pad)) {
    node.pad = node.pad.map((one) => {
      if (!isToken(one)) return one;
      const t = TOKENS[tokenName(one)];
      return typeof t === 'number' ? t : one;
    });
  }
  for (const key of Object.keys(node)) if (key !== 'tokens') resolveScales(node[key]);
}

function tokenValue(value) {
  if (!isToken(value)) return value;
  const t = TOKENS[tokenName(value)];
  if (t === undefined) return '#ff00ff'; // loud on purpose: a typo must be visible
  return typeof t === 'object' ? t.light : t;
}

async function syncVariables(tokens) {
  TOKENS = tokens || {};
  VARS = {};
  const names = Object.keys(TOKENS);
  if (names.length === 0) return 0;

  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  let collection = null;
  for (const c of collections) if (c.name === 'CORRECTIV') collection = c;
  if (collection === null) collection = figma.variables.createVariableCollection('CORRECTIV');

  // One mode per appearance — where the plan allows it. A second variable mode is a
  // paid Figma feature, and on Starter `addMode` throws. That must not cost the whole
  // token set: without it the board is light-only, which is what it was anyway.
  const light = collection.modes[0].modeId;
  let dark = null;
  for (const m of collection.modes) if (m.name === 'Dunkel') dark = m.modeId;
  if (dark === null) {
    try {
      dark = collection.addMode('Dunkel');
    } catch {
      dark = null;
    }
  }
  try {
    collection.renameMode(light, 'Hell');
  } catch {
    // A single unnamed mode is fine; the name is a convenience, not a requirement.
  }

  const existing = await figma.variables.getLocalVariablesAsync();
  const byName = {};
  for (const v of existing) if (v.variableCollectionId === collection.id) byName[v.name] = v;

  for (const name of names) {
    const token = TOKENS[name];
    const colour = typeof token === 'object';
    const type = colour ? 'COLOR' : 'FLOAT';
    let v = byName[name];
    if (v === undefined || v.resolvedType !== type) {
      v = figma.variables.createVariable(name, collection, type);
    }
    // Without explicit scopes a variable turns up in every property picker in Figma,
    // which makes the panel useless.
    v.scopes = colour
      ? ['FRAME_FILL', 'SHAPE_FILL', 'TEXT_FILL', 'STROKE_COLOR']
      : ['WIDTH_HEIGHT', 'GAP', 'CORNER_RADIUS', 'FONT_SIZE'];
    if (colour) {
      v.setValueForMode(light, rgb(token.light));
      if (dark !== null) v.setValueForMode(dark, rgb(token.dark));
    } else {
      v.setValueForMode(light, token);
      if (dark !== null) v.setValueForMode(dark, token);
    }
    VARS[name] = v;
    VARIABLE_NAMES[v.id] = name;
  }
  return names.length + (dark === null ? ' (light only, a second mode is a paid feature)' : '');
}

/** Binds rather than copies, when the spec names a token. */
function bind(hex, value) {
  const paintValue = { type: 'SOLID', color: rgb(hex) };
  if (!isToken(value)) return paintValue;
  const variable = VARS[tokenName(value)];
  // Unreachable for anything the description wrote: `checkTokens` has already refused
  // a name the token table does not have. What is left is a variable that failed to
  // be CREATED, which no description can prevent — and an unbound paint is then the
  // only thing that still draws.
  if (variable === undefined) return paintValue;
  // setBoundVariableForPaint returns a NEW paint; the original stays unbound.
  return figma.variables.setBoundVariableForPaint(paintValue, 'color', variable);
}

function paint(value) {
  const c = tokenValue(value);
  if (!c) return [];
  const p = bind(c, value);
  const alpha = tokenAlpha(value);
  return [alpha === 1 ? p : Object.assign({}, p, { opacity: alpha })];
}

function fontFor(node) {
  const family = FONTS[node.font || 'sans'] || FONTS.sans;
  return family[node.weight || 'regular'] || family.regular;
}

/** Every font the document mentions, so they can be loaded before any text exists. */
function collectFonts(node, out) {
  if (node === null || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const n of node) collectFonts(n, out);
    return out;
  }
  if (node.t === 'text') {
    const f = fontFor(node);
    out[f.family + '|' + f.style] = f;
  }
  for (const n of node.children || []) collectFonts(n, out);
  // A variant set carries its children one level deeper, and a font missing there
  // takes down the whole page just the same.
  for (const n of node.options || []) collectFonts(n, out);
  return out;
}

// ------------------------------------------------------------- the component kit
//
// A component drawn on one page and used on another is the whole point of the kit:
// edit `ui/Button` once and every screen follows. That only works if the screens
// hold INSTANCES rather than copies, so the interpreter keeps a registry.
//
// `COMPONENTS` maps a spec name to the node an instance is made from — the component
// itself, or a variant set's default variant. `PROP_IDS` maps the property names a
// spec writes ('Titel') to the keys `setProperties` wants ('Titel#12:3'), which
// Figma only hands out once the property exists.
//
// Both are keyed 'mode/name'. The kit is drawn once per rendering, so `ui/Button`
// exists twice — once in the app's own colours and once as a pencil drawing — and an
// instance resolves against the mode of the page it lands on. Without that the
// wireframe would fill with replica components and stop being a wireframe.
let COMPONENTS = {};
let PROP_IDS = {};
let TEXT_STYLES = {};

// Filled by `build()` wherever a node carries `bind`, drained by the component that
// encloses it. A binding is what turns a text node into a component property: the
// node keeps its own copy in the main component, and every instance may override it.
let bindings = [];

/** Which slot on a node a property of this type drives. */
const REFERENCE = { TEXT: 'characters', BOOLEAN: 'visible', INSTANCE_SWAP: 'mainComponent' };

/**
 * Turn the `bind` marks collected under a component into component properties.
 *
 * The default of a TEXT property is whatever the bound node already says, so a
 * component drawn with real copy keeps that copy as its default instead of needing
 * it written twice.
 */
function defineProperties(node, spec, bound) {
  const byName = {};
  for (const b of bound) {
    if (byName[b.name] === undefined) byName[b.name] = [];
    byName[b.name].push(b.node);
  }
  for (const name of Object.keys(spec.props || {})) {
    const definition = spec.props[name];
    const targets = byName[name] || [];
    let value = definition.default;
    if (value === undefined && definition.type === 'TEXT' && targets.length > 0) {
      value = targets[0].characters;
    }
    if (value === undefined) value = definition.type === 'BOOLEAN' ? true : '';
    const id = node.addComponentProperty(name, definition.type, value);
    for (const target of targets) {
      // A node may drive several properties, so the existing references are kept.
      const next = {};
      const refs = target.componentPropertyReferences || {};
      for (const k of Object.keys(refs)) next[k] = refs[k];
      next[REFERENCE[definition.type]] = id;
      target.componentPropertyReferences = next;
    }
  }
}

/**
 * Read a component's property keys back out.
 *
 * Not the ids `addComponentProperty` returned: on a variant set the set merges the
 * per-variant properties into one list with keys of its own, and those are the ones
 * `setProperties` accepts. Reading them back is the only way to be right in both
 * cases.
 */
function recordProperties(name, node) {
  const ids = {};
  const defs = node.componentPropertyDefinitions || {};
  for (const key of Object.keys(defs)) {
    const hash = key.indexOf('#');
    ids[hash === -1 ? key : key.slice(0, hash)] = key;
  }
  PROP_IDS[name] = ids;
}

/**
 * A set of variants, from one entry per value.
 *
 * Figma derives the variant property from the component NAMES, which have to read
 * `Property=Value`. So each option is built as an ordinary component under that
 * name, its own properties defined, and only then are they combined — properties
 * cannot be added to a component that is already a variant.
 */
function buildVariantSet(spec, parent, path) {
  const made = [];
  // `entries()`, because the index is half of the stamp: an option is keyed
  // `.options[i]` on both sides of the diff, and a key built from anything but the
  // position the spec put it in matches nothing.
  for (const [i, option] of spec.options.entries()) {
    const one = { t: 'component', name: spec.prop + '=' + option.value, props: spec.props };
    // `t` is not the option's to set: `combineAsVariants` refuses a set whose
    // children are anything but components, and a description that says `frame`
    // here — every measured one does — took the whole page down with
    // "A COMPONENT_SET node cannot have children of type other than COMPONENT".
    for (const key of Object.keys(option)) {
      if (key !== 'value' && key !== 't') one[key] = option[key];
    }
    made.push(build(one, parent, false, true, path + '.options[' + i + ']'));
  }
  const set = figma.combineAsVariants(made, parent);
  set.name = spec.name;
  set.layoutMode = 'VERTICAL';
  set.itemSpacing = 16;
  set.paddingLeft = 16;
  set.paddingRight = 16;
  set.paddingTop = 16;
  set.paddingBottom = 16;
  set.primaryAxisSizingMode = 'AUTO';
  set.counterAxisSizingMode = 'AUTO';
  COMPONENTS[spec.name] = set.defaultVariant;
  recordProperties(spec.name, set);
  return set;
}

function applySizing(node, spec, parentIsAutoLayout) {
  // resize() resets both axes to FIXED, so any fill/hug has to be re-asserted after.
  const w = spec.w;
  const h = spec.h;
  const numW = typeof w === 'number';
  const numH = typeof h === 'number';
  if (numW || numH) {
    node.resize(numW ? w : node.width, numH ? h : node.height);
  }
  if (!parentIsAutoLayout) return;
  if (w === 'fill') node.layoutSizingHorizontal = 'FILL';
  if (h === 'fill') node.layoutSizingVertical = 'FILL';
  if (w === 'hug') node.layoutSizingHorizontal = 'HUG';
  if (h === 'hug') node.layoutSizingVertical = 'HUG';
  if (numW) node.layoutSizingHorizontal = 'FIXED';
  if (numH) node.layoutSizingVertical = 'FIXED';
}

function build(spec, parent, parentIsAutoLayout, asVariant, path) {
  let node = null;
  let missingComponent = false;

  if (spec.t === 'text') {
    node = figma.createText();
    node.fontName = fontFor(spec);
    node.characters = spec.chars;
    node.fontSize = spec.size || 12;
    node.fills = paint(spec.color || '#212124');
    node.lineHeight = { unit: 'PERCENT', value: spec.leading || 140 };
    if (spec.tracking !== undefined) {
      node.letterSpacing = { unit: 'PERCENT', value: spec.tracking };
    }
    if (spec.align) node.textAlignHorizontal = spec.align.toUpperCase();
    // The style AFTER the literal values, so it wins where it applies and the raw
    // numbers stay as the wireframe's fallback. Colour is not part of it.
    const style = spec.style ? TEXT_STYLES[spec.style] : undefined;
    if (style !== undefined) node.textStyleId = style.id;
    if (typeof spec.w === 'number') {
      // A wrapping block needs HEIGHT auto-resize AND an explicit width; the default
      // mode ignores the width and collapses the node to a thread.
      node.textAutoResize = 'HEIGHT';
      node.resize(spec.w, node.height);
    } else if (spec.w === 'fill') {
      // Same reason, other direction: a text node left on WIDTH_AND_HEIGHT grows
      // sideways for ever and FILL cannot take hold, so a long label runs straight
      // through whatever sits beside it instead of wrapping above it.
      node.textAutoResize = 'HEIGHT';
    }
  } else if (spec.t === 'rect') {
    node = figma.createRectangle();
    node.fills = paint(spec.fill);
    if (spec.radius) node.cornerRadius = spec.radius;
  } else if (spec.t === 'ellipse') {
    node = figma.createEllipse();
    node.fills = paint(spec.fill);
  } else if (spec.t === 'instance') {
    const main = COMPONENTS[spec.of];
    if (main === undefined) {
      // Magenta, not nothing. An instance of a component that does not exist is a
      // typo in the spec, and a silently missing row is far harder to find than a
      // box shouting its own name.
      node = figma.createFrame();
      node.resize(typeof spec.w === 'number' ? spec.w : 160, spec.h || 24);
      node.fills = [{ type: 'SOLID', color: { r: 1, g: 0, b: 1 } }];
      missingComponent = true;
    } else {
      node = main.createInstance();
      const ids = PROP_IDS[spec.of] || {};
      const set = {};
      for (const key of Object.keys(spec.set || {})) {
        if (ids[key] !== undefined) set[ids[key]] = spec.set[key];
      }
      if (Object.keys(set).length > 0) node.setProperties(set);
    }
  } else if (spec.t === 'variants') {
    // Already parented and already registered; the tail below only names and places
    // it, and re-appending to the same parent is a move to the end, not a copy.
    node = buildVariantSet(spec, parent, path);
  } else if (spec.t === 'line' || spec.t === 'space') {
    node = figma.createFrame();
    node.name = spec.t === 'line' ? 'Hairline' : 'Abstand';
    node.resize(10, spec.t === 'line' ? 1 : spec.h || 8);
    node.fills = spec.t === 'line' ? paint(spec.color || '#e2e2e5') : [];
    // A frame is born 10px wide and `applySizing` only fixes that inside auto-layout.
    // In a plain frame FILL means nothing to Figma, so the width is taken from the
    // parent by hand — otherwise a hairline that says it spans the screen draws 10px
    // of it. No node does that today; `beitreten` was the one, and it went with the
    // contribution flow.
    if (spec.w === 'fill' && !parentIsAutoLayout && typeof parent.width === 'number') {
      node.resize(parent.width, node.height);
    }
  } else {
    // A component is a frame that other frames can point at. Everything below it —
    // auto-layout, sizing, fills — behaves identically, so the only difference is
    // which constructor runs.
    node = spec.t === 'component' ? figma.createComponent() : figma.createFrame();
    node.fills = paint(spec.fill);
    node.clipsContent = spec.clip === true;
    if (spec.dir) {
      node.layoutMode = spec.dir === 'H' ? 'HORIZONTAL' : 'VERTICAL';
      node.primaryAxisSizingMode = 'AUTO';
      node.counterAxisSizingMode = 'AUTO';
      node.itemSpacing = spec.gap || 0;
      const p = spec.pad || [0, 0, 0, 0];
      node.paddingLeft = p[0];
      node.paddingRight = p[1];
      node.paddingTop = p[2];
      node.paddingBottom = p[3];
      if (spec.align) node.primaryAxisAlignItems = spec.align;
      if (spec.cross) node.counterAxisAlignItems = spec.cross;
      if (spec.wrap) {
        node.layoutWrap = 'WRAP';
        node.counterAxisSpacing = spec.crossGap || spec.gap || 0;
      }
    }
    if (spec.radius) node.cornerRadius = spec.radius;
  }

  // The placeholder's name wins over the spec's. `use-kit.mjs` puts a `name` on every
  // instance, so the generic line below used to rename the magenta box back to
  // "Button, Anmelden" and the box stopped shouting anything.
  if (missingComponent) node.name = 'MISSING: ' + spec.of;
  else if (spec.name) node.name = spec.name;
  if (spec.stroke) {
    node.strokes = paint(spec.stroke);
    // `strokeWeight` is in the list `resolveScales` resolves and was read by nothing,
    // so a description that measured a two-pixel rule drew a one-pixel one. Before the
    // per-side weights below, because assigning it sets all four and would undo them.
    if (spec.strokeWeight) node.strokeWeight = spec.strokeWeight;
    if (spec.dash) node.dashPattern = spec.dash;
    if (spec.strokeSides === 'top' || spec.strokeSides === 'bottom') {
      const weight = spec.strokeWeight || 1;
      const only = spec.strokeSides === 'top';
      node.strokeTopWeight = only ? weight : 0;
      node.strokeBottomWeight = only ? 0 : weight;
      node.strokeLeftWeight = 0;
      node.strokeRightWeight = 0;
    }
  }
  if (spec.opacity !== undefined) node.opacity = spec.opacity;

  // Parent BEFORE sizing: FILL and HUG are rejected on a node with no auto-layout
  // parent, and appendChild resets fills to the parent default.
  parent.appendChild(node);
  applySizing(node, spec, parentIsAutoLayout);
  if (spec.fill && spec.t !== 'text') node.fills = paint(spec.fill);
  if (spec.x !== undefined) node.x = spec.x;
  if (spec.y !== undefined) node.y = spec.y;

  const isAuto = spec.dir !== undefined;
  // Everything bound below this node belongs to THIS component, so the mark is taken
  // before the children and the slice drained after: a component nested inside
  // another keeps its own properties instead of handing them upwards.
  const bindMark = bindings.length;
  for (const [i, child] of (spec.children || []).entries())
    build(child, node, isAuto, false, path + '.children[' + i + ']');
  if (spec.t === 'component') {
    defineProperties(node, spec, bindings.splice(bindMark));
    // A variant registers under its set's name, not its own `Variante=club`, and the
    // caller is the only honest witness to which this is. It used to be read off the
    // name — anything holding an '=' was taken for a variant — and the measured
    // components are named after their specimen labels, which the catalogue writes
    // "in the props' own words": nine of them, `discover/SampleHitRow, kind="podcast"`
    // among them, were drawn on the board and registered nowhere, so nothing could
    // ever instance them. They passed every check there was, because they ARE
    // components; the interpreter simply never wrote them down.
    if (spec.name && asVariant !== true) {
      COMPONENTS[spec.name] = node;
      recordProperties(spec.name, node);
    }
  }
  if (spec.bind) bindings.push({ node: node, name: spec.bind });

  // Re-assert after children, because a hugging parent resizes as they arrive.
  if (parentIsAutoLayout && spec.w === 'fill') node.layoutSizingHorizontal = 'FILL';

  // A childless auto-layout frame keeps the 100x100 a fresh frame is born at: with
  // nothing inside, AUTO on the counter axis has nothing to hug. The board uses such
  // frames as flexible spacers in a row — `Dehnung` — and every one of them was
  // pushing its row to 100px tall, which is why several cards had a hand's width of
  // air in them. Zero on the counter axis, unless a height was asked for.
  // The guard is on the axis being collapsed, which is the COUNTER axis: height for a
  // row, width for a column. Guarding both branches on `h` threw away the declared
  // width of every childless column that had one — `player/Inhalt` says `w: 360` and
  // was resized to a hundredth of a pixel, silently.
  const empty = spec.dir !== undefined && (spec.children || []).length === 0;
  if (empty) {
    if (spec.dir === 'H' && spec.h === undefined) {
      if (parentIsAutoLayout) node.layoutSizingVertical = 'FIXED';
      node.resize(Math.max(node.width, 0.01), 0.01);
      if (parentIsAutoLayout && spec.w === 'fill') node.layoutSizingHorizontal = 'FILL';
    } else if (spec.dir === 'V' && spec.w === undefined) {
      if (parentIsAutoLayout) node.layoutSizingHorizontal = 'FIXED';
      node.resize(0.01, Math.max(node.height, 0.01));
      if (parentIsAutoLayout && spec.h === 'fill') node.layoutSizingVertical = 'FILL';
    }
  }

  // Outlines are drawn in a second pass: a node's final size is only known once its
  // parents have finished laying out, and the pencil has to trace that size.

  // The node's identity in the spec, stamped so a later description can recognise
  // it. Figma ids do not survive a redraw — the owned frames are deleted and
  // rebuilt — but this does, because it is derived from the spec and re-stamped on
  // every draw. It survives a move and a rename, which is the whole reason to
  // prefer it over an id.
  if (path) node.setPluginData('spec', path);
  return node;
}

/**
 * The app's typography variants as Figma text styles.
 *
 * A variant set was the wrong shape for this. `<Typo variant="headline-l">` is not a
 * component the app instantiates, it is a style it applies — and Figma has exactly
 * that object. A text style changes every text node that carries it, across every
 * page, which is the behaviour the variant asks for and the one a component cannot
 * give a node it does not contain.
 *
 * Colour is deliberately NOT part of a style here: the app picks a variant and a
 * colour token separately, so the style carries the typography and a bound variable
 * carries the fill. Putting both in the style would make every coloured headline its
 * own style.
 *
 * File-global, like every style in Figma, and named by the app's own variant.
 */
async function syncTextStyles(list) {
  TEXT_STYLES = {};
  if (!list || list.length === 0) return 0;

  const fonts = FONTS;
  const wanted = {};
  for (const entry of list) {
    const f = fonts[entry.font || 'sans'][entry.weight || 'regular'];
    wanted[f.family + '|' + f.style] = f;
  }
  for (const key of Object.keys(wanted)) await figma.loadFontAsync(wanted[key]);

  const existing = {};
  for (const style of figma.getLocalTextStyles()) existing[style.name] = style;

  for (const entry of list) {
    // Reuse rather than recreate: a style that is deleted and remade loses every
    // node that pointed at it, and the board would silently fall back to defaults.
    let style = existing[entry.name];
    if (style === undefined) style = figma.createTextStyle();
    style.name = entry.name;
    style.fontName = fonts[entry.font || 'sans'][entry.weight || 'regular'];
    style.fontSize = entry.size;
    style.lineHeight = { unit: 'PERCENT', value: entry.leading };
    style.letterSpacing = { unit: 'PERCENT', value: entry.tracking };
    TEXT_STYLES[entry.name] = style;
    TEXT_STYLE_NAMES[style.id] = entry.name;
  }
  return list.length;
}

async function drawPage(entry, screens) {
  //
  // A family the environment lacks stops the whole run, deliberately. Carrying on
  // would only move the failure: `createText` throws the moment it is handed a font
  // that was never loaded, and it would throw somewhere in the middle of a page with
  // nothing naming the family. Collecting the misses first buys one clear message
  // instead of an obscure one, not a partial board.
  const wanted = collectFonts(screens, {});
  const missing = [];
  for (const key of Object.keys(wanted)) {
    try {
      await figma.loadFontAsync(wanted[key]);
    } catch {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error('missing font: ' + missing.join(', '));
  }

  let page = null;
  for (const p of figma.root.children) if (p.name === entry.name) page = p;
  if (page === null) {
    page = figma.createPage();
    page.name = entry.name;
  }
  figma.currentPage = page;

  // Converge instead of stacking: drop what this document owns, then rebuild it.
  // Anything else on the page is left alone.
  //
  // `owned: "*"` claims the WHOLE page. A generated page needs that: a name list only
  // removes what the document still mentions, so a component that has been renamed
  // or dropped stays behind forever, and the board slowly fills with things no
  // description explains. Pages that share space with hand-drawn work keep the list.
  if (entry.owned === '*') {
    for (const n of page.children.slice()) n.remove();
  } else {
    const owned = {};
    for (const n of entry.owned || []) owned[n] = true;
    for (const n of page.children.slice()) if (owned[n.name]) n.remove();
  }

  for (const [i, screen] of screens.entries())
    build(screen, page, false, false, 'screens[' + i + ']');

  return { name: entry.name, screens: screens.length };
}

/** How many components the kit has. */
function distinctComponents() {
  return Object.keys(COMPONENTS).length;
}

// ------------------------------------------------------------- describing the board
//
// The other half of the diff. After a draw, and again before a redraw, the
// plugin walks the `Bausteine` page and describes what is on it in the same
// vocabulary `spec.json` speaks. The description is a JSON document — ADR 0021's
// rule — and it crosses to the server, which diffs it against the spec.
//
// Only the generated page is described. The screens are hand-transcribed from
// screenshots (ADR 0021), so a difference there reports drift caused by the app
// moving, not by a designer; including them would devalue the warning.

/** The app's two typefaces, as the spec spells them. */
const FONT_FAMILY = { 'Source Sans 3': 'sans', Merriweather: 'serif' };

/** One channel of a Figma colour (0–1 floats) as the two hex digits the spec writes. */
function hexChannel(v) {
  return Math.round(v * 255)
    .toString(16)
    .padStart(2, '0');
}

/** A Figma colour (0–1 floats) as the hex the spec writes. */
function toHex(color) {
  return '#' + hexChannel(color.r) + hexChannel(color.g) + hexChannel(color.b);
}

/**
 * A paint as the spec spells it: `@color-accent` when it is bound to a variable,
 * `#2e7d4f` when it is a literal, `@color-accent/70` when it carries an alpha.
 *
 * The variable's NAME is the token — `syncVariables` names each variable after
 * the token it holds — so reading the name back is what keeps the comparison
 * about words rather than hexes. Resolving to a value would make `accent` and
 * `red-500` compare equal, and that difference is the thing a design system is.
 */
function describePaint(one, bound) {
  if (!one || one.visible === false) return undefined;
  const alias = bound?.type === 'VARIABLE_ALIAS' ? bound : undefined;
  if (alias) {
    const name = VARIABLE_NAMES[alias.id];
    if (name === undefined) return undefined;
    const alpha =
      paint.opacity !== undefined && paint.opacity !== 1 ? Math.round(paint.opacity * 100) : null;
    return '@' + name + (alpha === null ? '' : '/' + alpha);
  }
  if (one.type !== 'SOLID') return undefined;
  const alpha =
    one.opacity !== undefined && one.opacity !== 1 ? Math.round(one.opacity * 100) : null;
  return toHex(one.color) + (alpha === null ? '' : '/' + alpha);
}

/** The fills or strokes of a node, as the spec spells them. */
function describePaints(node, key) {
  const paints = node[key];
  if (!Array.isArray(paints)) return [];
  const bound = node.boundVariables?.[key] || [];
  return paints.map((one, i) => describePaint(one, bound[i])).filter((v) => v !== undefined);
}

/**
 * A node's size as the spec spells it: `'fill'`, `'hug'`, or the number.
 *
 * The spec writes `w: 'fill'` for a node that fills its parent, and Figma
 * records that as `layoutSizingHorizontal = 'FILL'`. Reading the sizing mode
 * rather than the pixel width is what keeps the comparison about intent: a
 * fill node's width depends on its parent's layout, and a pixel number there
 * would report a difference on every reflow.
 */
function describeSize(node, horizontal) {
  // `layoutSizing*` is documented as applicable "only on auto-layout frames, their
  // children, and text nodes", and SETTING it anywhere else throws. A frame that is
  // not inside an auto layout is not one of those, so the mode is only asked for where
  // it can mean something; everywhere else the measured size is the honest answer.
  // This is the vocabulary ceiling (ADR 0069 §2): outside auto layout the API will not
  // say what the size MEANS, only how many pixels it is.
  const inAutoLayout = node.parent?.layoutMode !== undefined && node.parent.layoutMode !== 'NONE';
  if (inAutoLayout || node.type === 'TEXT') {
    const mode = horizontal ? node.layoutSizingHorizontal : node.layoutSizingVertical;
    if (mode === 'FILL') return 'fill';
    if (mode === 'HUG') return 'hug';
  }
  return round(horizontal ? node.width : node.height);
}

/** The padding of an auto-layout node, as the spec spells it. */
function describePad(node) {
  return [node.paddingLeft, node.paddingRight, node.paddingTop, node.paddingBottom].map(
    (v) => Math.round(v * 100) / 100,
  );
}

/**
 * One node on the board, as the spec would describe it.
 *
 * The key is read back from the plugin data `build` stamped. A node the person added
 * by hand has no key; it is still described, and `diff.mjs` gives it one of its own so
 * a redraw cannot delete it in silence.
 *
 * Every read here can return `figma.mixed` — a symbol, not a value — for a node whose
 * parts disagree: a text node with two sizes, a frame with four different corner
 * radii. `mixed` is passed through as the string `'mixed'`, which is a difference the
 * spec can express and a person can see. Reading it as a number would put a symbol in
 * the JSON, and `JSON.stringify` drops symbols without a word.
 */
function describeNode(node) {
  const key = node.getPluginData('spec') || undefined;
  const out = { key };
  const type = node.type;
  if (type === 'TEXT') {
    out.t = 'text';
    out.chars = node.characters;
    out.size = plain(node.fontSize);
    out.font = mixed(node.fontName)?.family
      ? FONT_FAMILY[mixed(node.fontName).family] || 'mixed'
      : 'mixed';
    out.weight = weightOf(node.fontName);
    out.color = describePaints(node, 'fills')[0];
    out.tracking = percentOf(node.letterSpacing);
    out.leading = percentOf(node.lineHeight);
    out.align = mixed(node.textAlignHorizontal)?.toLowerCase();
    const style = plain(node.textStyleId) ? TEXT_STYLE_NAMES[plain(node.textStyleId)] : undefined;
    out.style = style;
  } else if (type === 'RECTANGLE') {
    out.t = 'rect';
    out.w = round(node.width);
    out.h = round(node.height);
    out.fill = describePaints(node, 'fills')[0];
    out.stroke = describePaints(node, 'strokes')[0];
    out.radius = plain(node.cornerRadius);
  } else if (type === 'ELLIPSE') {
    out.t = 'ellipse';
    out.w = round(node.width);
    out.h = round(node.height);
    out.fill = describePaints(node, 'fills')[0];
    out.stroke = describePaints(node, 'strokes')[0];
  } else if (type === 'INSTANCE') {
    // A Figma instance takes no children (ADR 0021), so `of` and `set` are all there
    // is to say about one. `componentProperties`, not `componentPropertyValues`: the
    // latter does not exist in the typings, so reading it threw on the kit's one
    // instance and took the whole description with it.
    //
    // The names come back suffixed — `Titel#12:3` — while the spec writes `Titel`, so
    // they are cut at the `#` the same way `recordProperties` cuts them when setting.
    out.t = 'instance';
    out.of = MAIN_COMPONENTS[node.id];
    const set = {};
    for (const [prop, val] of Object.entries(node.componentProperties || {})) {
      if (typeof val !== 'string') continue;
      const hash = prop.indexOf('#');
      set[hash === -1 ? prop : prop.slice(0, hash)] = val;
    }
    out.set = set;
  } else {
    out.t = 'frame';
    out.name = node.name;
    out.dir =
      node.layoutMode === 'HORIZONTAL' ? 'H' : node.layoutMode === 'VERTICAL' ? 'V' : undefined;
    out.pad = describePad(node);
    out.gap = node.itemSpacing;
    out.wrap = node.layoutWrap === 'WRAP';
    out.crossGap = node.counterAxisSpacing;
    out.align = node.primaryAxisAlignItems;
    out.cross = node.counterAxisAlignItems;
    out.fill = describePaints(node, 'fills')[0];
    out.stroke = describePaints(node, 'strokes')[0];
    out.strokeWeight = plain(node.strokeWeight);
    out.strokeSides = strokeSides(node);
    out.radius = plain(node.cornerRadius);
    out.w = describeSize(node, true);
    out.h = describeSize(node, false);
    out.clip = node.clipsContent;
    out.dash =
      Array.isArray(node.dashPattern) && node.dashPattern.length > 0 ? node.dashPattern : undefined;
    out.opacity = node.opacity !== 1 ? node.opacity : undefined;
  }
  return out;
}

/** A value, or the string `'mixed'` when the node's parts disagree. */
function plain(value) {
  return value === figma.mixed ? 'mixed' : value;
}

/** The value when it is not `figma.mixed`, so an optional chain cannot call into it. */
function mixed(value) {
  return value === figma.mixed ? undefined : value;
}

/** To two decimals: Figma's floats come back with more precision than the spec has. */
function round(value) {
  return typeof value === 'number' ? Math.round(value * 100) / 100 : value;
}

/** A `{unit, value}` pair as the spec spells it, which is a percentage or nothing. */
function percentOf(space) {
  const s = mixed(space);
  return s?.unit === 'PERCENT' ? s.value : undefined;
}

/** `'bold'` / `'semibold'` / `'regular'`, or `'mixed'` for a node with two styles. */
function weightOf(fontName) {
  const style = mixed(fontName)?.style;
  if (style === undefined) return 'mixed';
  if (style === 'Bold') return 'bold';
  if (style === 'SemiBold') return 'semibold';
  return 'regular';
}

/**
 * Which sides carry a stroke, as the spec spells it.
 *
 * Figma records four weights and the spec records one word or nothing, so a stroke on
 * all four sides is the absence of a word: there is nothing to say about it.
 */
function strokeSides(node) {
  const top = plain(node.strokeTopWeight);
  const bottom = plain(node.strokeBottomWeight);
  if (top === 0 && bottom === 0) return undefined;
  if (top === bottom) return undefined;
  if (top === 0) return 'bottom';
  if (bottom === 0) return 'top';
  return 'mixed';
}

/**
 * The `Bausteine` page as a spec-shaped description.
 *
 * A variant set's children are its options, keyed `.options[i]` the way the spec
 * writes them. An instance's children are NOT described: they belong to the
 * component it points at, not to the instance, and the spec has no way to reach
 * them. That is the vocabulary ceiling, written down rather than papered over.
 */
async function describeBoard() {
  const page = figma.root.children.find((p) => p.name === 'Bausteine');
  if (!page) return null;
  const describe = async (node) => {
    // `mainComponent` is write-only under `documentAccess: "dynamic-page"` and is
    // deprecated outright; `getMainComponentAsync` is the read that works either way.
    // Instances are rare on the kit page — there is one — and a name is all an instance
    // is compared on besides its overrides.
    if (node.type === 'INSTANCE') {
      const main = await node.getMainComponentAsync();
      MAIN_COMPONENTS[node.id] = main ? main.name : undefined;
    }
    const out = describeNode(node);
    const children = node.children || [];
    if (node.type === 'COMPONENT_SET') {
      // A variant set's children are its options, and the spec writes them under
      // `options`, which is the half of the key they were stamped with.
      out.options = await Promise.all(children.map(describe));
    } else if (node.type !== 'INSTANCE') {
      out.children = await Promise.all(children.map(describe));
    }
    return out;
  };
  return Promise.all(page.children.map(describe));
}

/**
 * An instance's main component name, by node id.
 *
 * A map rather than a read on the node, because the one read that answers this
 * (`mainComponent`) is deprecated and write-only under dynamic-page access, and because
 * `describeNode` is otherwise synchronous and is called per node — an await inside it
 * would make describing a 500-node page 500 round trips through the microtask queue
 * for no gain.
 */
let MAIN_COMPONENTS = {};

/** Variable ids to names, filled by `syncVariables` so paints can be read back. */
let VARIABLE_NAMES = {};
let TEXT_STYLE_NAMES = {};

/**
 * Read the ids of the document's own variables and text styles into names.
 *
 * `syncVariables` and `syncTextStyles` already record both while drawing, but they run
 * in a draw and the description runs BEFORE one. They are read rather than rebuilt on
 * purpose: this must not create, rename or delete anything, because it runs on a path
 * whose whole job is to look.
 */
async function readNames() {
  VARIABLE_NAMES = {};
  TEXT_STYLE_NAMES = {};
  for (const v of await figma.variables.getLocalVariablesAsync()) {
    VARIABLE_NAMES[v.id] = v.name;
  }
  for (const style of figma.getLocalTextStyles()) TEXT_STYLE_NAMES[style.id] = style.name;
}

function definesComponents(node) {
  if (node === null || typeof node !== 'object') return false;
  if (Array.isArray(node)) {
    for (const n of node) if (definesComponents(n)) return true;
    return false;
  }
  if (node.t === 'component' || node.t === 'variants') return true;
  for (const n of node.children || []) if (definesComponents(n)) return true;
  return false;
}

/**
 * Every `@token` the description names has to exist in its token table.
 *
 * `bind()` cannot enforce this. It is called per paint, deep in the draw, and its only
 * option on a name it cannot resolve is to return an unbound colour — so the board
 * kept drawing with the last-synced hex baked in and quietly stopped following the
 * tokens. Nothing errored. That is the failure this repo keeps relearning: a drawing
 * that looks finished and is wrong.
 *
 * Checked here, before a single frame exists, for two reasons. It reports EVERY bad
 * name rather than the first, the way the font check does; and nothing half-drawn
 * survives a failure, the way `kit.mjs` refuses before it writes.
 */
function checkTokens(spec) {
  const known = spec.tokens || {};
  const missing = {};
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (node === null || typeof node !== 'object') return;
    for (const key of ['fill', 'stroke', 'color']) {
      const value = node[key];
      if (isToken(value) && known[tokenName(value)] === undefined) missing[value] = true;
    }
    for (const value of Object.keys(node)) walk(node[value]);
  };
  walk(spec.pages);
  walk(spec.screens);
  const names = Object.keys(missing).sort();
  if (names.length > 0) {
    throw new Error('no such token: ' + names.join(', '));
  }
}

async function draw(spec) {
  // One description, rendered once per page. `screens` may live on the page entry or,
  // when both pages show the same thing, once at the top for all of them.
  const pages = spec.pages || [{ name: spec.page, owned: spec.owned }];

  // Before anything is drawn: a name the token table does not have would otherwise
  // slip through as a plain colour and the board would look right while being stale.
  checkTokens(spec);

  // Variables first: a fill can only bind to a variable that already exists.
  const tokenCount = await syncVariables(spec.tokens);

  // After `syncVariables`, which is what fills `TOKENS`, and before anything is
  // built, which is what needs numbers.
  resolveScales(spec.pages);
  resolveScales(spec.screens);
  // The styles too. A text style's `size`, `leading` and `tracking` are numeric
  // positions like any other, and this block was the one place the resolver did not
  // reach: `size: "@text-m"` would have reached `createTextStyle` as a string, from
  // outside any page, where nothing else in the document could explain it.
  resolveScales(spec.textStyles);
  const styleCount = await syncTextStyles(spec.textStyles);

  // The kit before its users, for the same reason: an instance can only point at a
  // component that has already been drawn. A page is a kit page if anything on it
  // defines a component, so the order follows from the document rather than from a
  // flag somebody has to remember to set.
  COMPONENTS = {};
  PROP_IDS = {};
  bindings = [];
  VARIABLE_NAMES = {};
  TEXT_STYLE_NAMES = {};
  MAIN_COMPONENTS = {};
  const ordered = [];
  for (const entry of pages)
    if (definesComponents(entry.screens || spec.screens || [])) ordered.push(entry);
  for (const entry of pages) if (ordered.indexOf(entry) === -1) ordered.push(entry);

  const done = [];
  for (const entry of ordered) {
    const screens = entry.screens || spec.screens || [];
    done.push(await drawPage(entry, screens));
  }

  // Which page the file opens on. Without this it is whichever was drawn last, and
  // the kit has to be drawn first — so the landing page would be decided by a
  // dependency order that has nothing to do with what anyone wants to look at.
  if (spec.focus) {
    for (const p of figma.root.children) if (p.name === spec.focus) figma.currentPage = p;
  }

  return (
    done.map((d) => d.name + ': ' + d.screens + ' screens').join(' · ') +
    ' · ' +
    tokenCount +
    ' tokens · ' +
    styleCount +
    ' text styles · ' +
    distinctComponents() +
    ' components'
  );
}

// Tall enough for the refusal: the status line plus three keys. A panel that clipped
// its own warning would report that it is holding a redraw and not say what for.
figma.showUI(__html__, { width: 320, height: 230, title: 'CORRECTIV Wireframes' });

figma.ui.onmessage = async (msg) => {
  if (msg === null || msg === undefined) return;

  // A request to describe the board, not to draw it. The UI asks before a
  // redraw so the server can diff the current board against the last draw and
  // refuse to overwrite a person's work.
  if (msg.type === 'describe') {
    try {
      // The maps that let a paint be read back as a token NAME rather than a hex are
      // filled by a draw — and this is a request that deliberately happens before any
      // draw. Without them every variable-bound fill on the page reads as an unnamed
      // paint and the diff reports all 558 nodes as changed, which is a warning that
      // fires on everything and so says nothing. Read from the document instead: the
      // variables and text styles are already there, and their names are the tokens.
      await readNames();
      const board = await describeBoard();
      figma.ui.postMessage({ type: 'board', board: board, error: null });
    } catch (err) {
      figma.ui.postMessage({
        type: 'board',
        board: null,
        error: String((err && err.message) || err),
      });
    }
    return;
  }

  if (msg.type !== 'spec') return;
  try {
    const summary = await draw(msg.spec);
    // Describe the board as the draw left it, so the server has a baseline to
    // diff the next board against. Without this the first redraw after a draw
    // would have nothing to compare.
    const board = await describeBoard();
    figma.ui.postMessage({ type: 'done', summary: summary, board: board, error: null });
  } catch (err) {
    // The stack, not just the message: "not a function" on its own says nothing
    // about WHICH node of several thousand was being drawn.
    figma.ui.postMessage({
      type: 'done',
      summary: null,
      board: null,
      error: String((err && err.message) || err) + ' | ' + String((err && err.stack) || ''),
    });
  }
};
