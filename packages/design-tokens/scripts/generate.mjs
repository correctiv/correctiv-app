#!/usr/bin/env node
/**
 * The token bridge: reads the binding design tokens from tokens/theme.css (vendored
 * from wp-design-tokens) and generates the four artefacts this package publishes:
 *
 *   1. theme.css                 the Tailwind v4 theme — the file the app's
 *                                global.css imports, and the one a CMS on
 *                                Tailwind v4 can import unchanged
 *   2. theme.standalone.css      the same, with the `light` / `dark` variant
 *                                definitions spelled out, for a build that has no
 *                                Uniwind to supply them
 *   3. src/tokens.generated.ts   typed constants: both colour schemes, spacing,
 *                                the type scale, radii, durations
 *   4. src/reader.generated.ts   theme.css as a string, plus the dark override block
 *
 * Nothing is written into the app any more. That changed with the move to
 * Uniwind: the previous artefact was a Tailwind v3 theme map, which is what
 * NativeWind is — an engine the app happened to run on, not a property of the
 * tokens. Tailwind v4 takes its theme from CSS, and CSS is portable, so the app
 * and the CMS can read the same file.
 *
 * The typed constants resolve to px, because a React Native style takes numbers.
 * theme.css keeps rem — see the note on that artefact below for why the two units
 * now agree where they used to have to differ. The token repo stays the single
 * source of truth; this script must never produce output that is then hand-edited.
 *
 * ## The shape of this file
 *
 * Six phases, in order, each one a function, so that a change has one obvious place
 * to land. `main()` at the bottom is the whole flow on one screen.
 *
 *   1. parse      tokens/theme.css → a flat map of every --var-* value
 *   2. convert    the unit helpers the two consumers need (rem · px · s)
 *   3. group      that flat map → the token scales, by prefix
 *   4. palette    the second colour scheme, and the checks that must be LOUD
 *   5. render     one function per artefact, each returning a complete string
 *   6. write      the only side effects in the file
 *
 * Nothing here decides how the output LOOKS except the five render functions, and
 * every byte of what they produce is pinned by
 * `apps/mobile/__tests__/tokens.test.ts`, which regenerates all four artefacts
 * and byte-compares them against the committed copies. Restructuring this script is
 * safe exactly to the extent that check is.
 *
 * Run:  npm run tokens
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { themeCssPath, typographyCssPath } from '../../../scripts/tokens-source.mjs';
// The dark scheme, the primitives that deliberately have none, and the two fixed
// role colours — the one part of the colour system that is a decision rather than a
// design token. The reasoning is in palette.js.
import { dark, roles, schemeIndependent } from '../palette.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(__dirname, '..');

// The source is tokens/theme.css in this repo (see tokens/README.md). Why the
// resolution lives in scripts/tokens-source.mjs and not here is explained there.
const THEME_CSS_PATH = themeCssPath();

const REM_BASE = 16; // wp-design-tokens assumes a 16px base, and so does Uniwind

// ---------------------------------------------------------------------------
// 1. Parse — theme.css into a flat map of --var-* values
// ---------------------------------------------------------------------------

/**
 * The FIRST `:root` block, and deliberately only that one.
 *
 * Until wp-design-tokens 8ed7a28 there was a second, inside
 * `@media (prefers-color-scheme: dark)`, holding the LIGHT values under a
 * `@TODO Set this to the actual values`. Reading it would have produced a dark mode
 * that compiled, shipped and changed nothing on screen. Upstream has since deleted
 * that block down to a bare `@TODO`, so today there is only one `:root` and this
 * function would find it either way — but the restriction stays, because what comes
 * back when upstream fills the block in is a SECOND SCHEME, and phase 4 is where a
 * second scheme is assembled. Picking it up here would put dark values into the
 * light palette.
 */
function firstRootBlock(css) {
  const start = css.indexOf(':root');
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error('No :root block found in theme.css');
}

/** Follows `--var-font-serif: var(--var-font-merriweather)` to its endpoint. */
function resolveVar(rawVars, value, seen = new Set()) {
  const ref = value.match(/^var\((--var-[a-z0-9-]+)\)$/i);
  if (!ref) return value;
  const name = ref[1];
  if (seen.has(name)) return value; // a cycle: leave the value as written
  seen.add(name);
  if (rawVars[name] == null) return value;
  return resolveVar(rawVars, rawVars[name], seen);
}

/**
 * Every `--var-*` declaration in the base `:root`, with `var()` references
 * followed. Insertion order is the order theme.css declares them in, and it
 * survives into every artefact — the generated files list their tokens in source
 * order, which is why a reordering upstream is a real diff here.
 */
function parseVars(css) {
  const rootBody = firstRootBlock(css);

  // Collect every --var-* declaration (comments ignored)
  const rawVars = {};
  const declRe = /(--var-[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = declRe.exec(rootBody)) !== null) {
    rawVars[m[1]] = m[2].trim();
  }

  const vars = {};
  for (const [k, v] of Object.entries(rawVars)) vars[k] = resolveVar(rawVars, v);

  /**
   * Which colours were written as a LITERAL, before resolution flattened that away.
   *
   * This is the tier, as theme.css states it. Upstream's primitives are the hexes
   * (`--var-color-white: #ffffff`); every semantic role and every deprecated alias is
   * a reference (`--var-color-canvas: var(--var-color-white)`). Phase 4 needs it and
   * cannot recover it, because `vars` above has already followed every reference to
   * its endpoint — which is why the first version of assertPaletteAgrees could not
   * tell a role from a value, and would pass a semantic token pinned to its light
   * value in dark mode.
   */
  const colorIsLiteral = {};
  for (const [k, v] of Object.entries(rawVars)) {
    if (k.startsWith('--var-color-')) {
      colorIsLiteral[k.slice('--var-color-'.length)] = !/^var\(/i.test(v);
    }
  }

  return { vars, colorIsLiteral };
}

// ---------------------------------------------------------------------------
// 2. Convert — the units the two consumers need
// ---------------------------------------------------------------------------
function toPx(value) {
  const v = value.trim();
  const rem = v.match(/^(-?[\d.]+)rem$/);
  if (rem) return `${round(parseFloat(rem[1]) * REM_BASE)}px`;
  const px = v.match(/^(-?[\d.]+)px$/);
  if (px) return `${round(parseFloat(px[1]))}px`;
  if (v === '0') return '0px';
  return v;
}
function toNumberPx(value) {
  const px = toPx(value);
  const n = parseFloat(px);
  return Number.isNaN(n) ? value : n;
}
function toMs(value) {
  const s = value.match(/^([\d.]+)s$/);
  if (s) return Math.round(parseFloat(s[1]) * 1000);
  return parseFloat(value);
}
function round(n) {
  return Math.round(n * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// 3. Group — the flat map into the token scales
// ---------------------------------------------------------------------------

/**
 * The scales every artefact is built from. Each is a slice of the flat map, keyed
 * by whatever follows the prefix.
 */
function groupScales(vars) {
  /** Everything under one `--var-` prefix, with the prefix stripped off the keys. */
  function byPrefix(prefix, transform = (x) => x) {
    const out = {};
    for (const [k, v] of Object.entries(vars)) {
      if (k.startsWith(prefix)) out[k.slice(prefix.length)] = transform(v);
    }
    return out;
  }

  // Spacing (t-shirt scale). Matched rather than taken byPrefix, because
  // `--var-spacing` itself is the numeric step and must not become a token of the
  // scale — see the `--spacing:` entry in renderThemeCss.
  const spacingTokens = {};
  for (const [k, v] of Object.entries(vars)) {
    const mm = k.match(/^--var-spacing-([a-z0-9]+)$/);
    if (mm) spacingTokens[mm[1]] = toPx(v);
  }

  // Font sizes: text-* and headline-*, flattened into one scale.
  const fontSizePx = {};
  for (const [k, v] of Object.entries(vars)) {
    const t = k.match(/^--var-font-size-(text|headline)-([a-z]+)$/);
    if (t) fontSizePx[`${t[1]}-${t[2]}`] = toNumberPx(v);
  }

  return {
    // Three tiers, flat here because a Tailwind colour name has no tiers: the
    // primitives (white, neutral-100..700, red-500, yellow-400), the semantic roles
    // (canvas, on-canvas, stroke, accent, …) and the deprecated v1 aliases
    // (emphasis, alternative, grey-100..700). `var()` references are already
    // resolved by parseVars, so every value here is a hex.
    tokenColors: byPrefix('--var-color-'),
    radius: byPrefix('--var-radius-', toPx), // xs, s, md
    durationsMs: byPrefix('--var-duration-', toMs), // fast, slow
    leading: byPrefix('--var-leading-', (v) => parseFloat(v)), // unitless
    letterSpacingPx: byPrefix('--var-letter-spacing-', toNumberPx),
    fontWeights: byPrefix('--var-font-weight-'), // normal, semibold, bold
    spacingTokens,
    fontSizePx,
  };
}

// ---------------------------------------------------------------------------
// 4. Palette — the second colour scheme, and the checks that must be loud
// ---------------------------------------------------------------------------
// `dark`, `schemeIndependent` and `roles` come from palette.js (imported at the
// top). theme.css has no dark values to read: upstream's dark block is a bare
// `@TODO`, and before that it was a placeholder holding the light values.

/**
 * Both directions of one promise: every token colour is accounted for in exactly
 * one of the two lists palette.js exports, and neither list names a colour that is
 * not there.
 *
 * The middle case is the one worth the code. A colour with no dark value has NO
 * symptom of its own: it stays on its light value in dark mode, in a build that is
 * otherwise green, and is noticed when someone opens the app on a dark phone and
 * finds one card the wrong colour. So a colour in neither list THROWS rather than
 * defaulting either way, and the message says what the choice is — because that
 * choice, "is this a value or a role", is the only thing the generator cannot make
 * for itself.
 *
 * `schemeIndependent` is what makes throwing affordable. Without it the check could
 * only demand a dark value for every colour, and eleven primitives that genuinely
 * must not move would each need a redundant entry restating its light value — at
 * which point the entries stop being decisions and the check stops being read.
 *
 * Uniwind needs the same guarantee from the other end: it refuses a pair of
 * `@variant` blocks that do not declare the same set of variables. Since both blocks
 * are built from these lists, satisfying this satisfies that.
 */
function assertPaletteAgrees(tokenColors, colorIsLiteral) {
  const independent = new Set(schemeIndependent);

  // `roles` is the app's own pair, not upstream's, and it is spread over both schemes
  // in buildPalettes — so a token of the same name arriving in theme.css would be
  // silently overridden in light AND dark, and the palette would stop matching the
  // source with nothing said. The two lists below account for every colour theme.css
  // has; this accounts for the two it does not.
  for (const name of Object.keys(roles)) {
    if (tokenColors[name] != null) {
      throw new Error(
        `theme.css now defines "${name}", which palette.js also supplies as a role ` +
          'colour. The role would silently win in both schemes.\n\n' +
          'Upstream owning this name is the good outcome: delete it from `roles` and ' +
          'classify it like any other colour.',
      );
    }
  }

  // A name in both lists is a contradiction, not a duplicate: one says the colour
  // moves and the other says it does not. Caught first, because the two loops below
  // would each be satisfied and the `dark` value would silently win.
  for (const name of schemeIndependent) {
    if (dark[name] != null) {
      throw new Error(
        `palette.js lists "${name}" as scheme-independent AND gives it a dark value. ` +
          'Pick one: a primitive names a value and does not move, a semantic token ' +
          'names a role and does.',
      );
    }
  }

  // Either list may name a colour that has gone from theme.css. Both are invisible:
  // an unused dark value changes nothing, and a stale primitive protects nothing.
  for (const [name, claim] of [
    ...Object.keys(dark).map((n) => [n, 'has a dark value in palette.js']),
    ...schemeIndependent.map((n) => [n, 'is listed as scheme-independent in palette.js']),
  ]) {
    if (tokenColors[name] == null) {
      throw new Error(`"${name}" ${claim}, but theme.css has no such colour.`);
    }
  }

  // Classified, but classified WRONG. Being in one of the two lists is not enough:
  // `schemeIndependent` is a claim that the colour names a value, and theme.css
  // already says which colours do — the primitives are literals there, every semantic
  // role and every deprecated alias is a `var()` reference.
  //
  // Without this, adding `--var-color-on-accent: var(--var-color-white)` upstream and
  // dropping it into `schemeIndependent` produced a semantic role stuck on its light
  // value in dark mode, past a green generator and a green test run. Which is the
  // exact failure the message below describes, so the check that describes it had
  // better catch it.
  //
  // Only this direction is checkable. The reverse — "a literal must be a primitive" —
  // is false: `grey-250` is a literal upstream dropped from the ramp, and it is a
  // surface with a dark value.
  for (const name of schemeIndependent) {
    if (colorIsLiteral[name] === false) {
      throw new Error(
        `palette.js lists "${name}" as scheme-independent, but theme.css defines it as ` +
          'a reference to another colour, which is how it spells a ROLE. Roles follow ' +
          'the scheme.\n\n' +
          `Give it a dark value in dark['${name}'] instead. If upstream really has ` +
          'made a primitive out of a reference, this check is the thing to change, ' +
          'deliberately.',
      );
    }
  }

  // The one that catches an upstream addition. Every colour must be classified.
  for (const name of Object.keys(tokenColors)) {
    if (dark[name] == null && !independent.has(name)) {
      throw new Error(
        `theme.css has the colour "${name}", and palette.js says nothing about it.\n\n` +
          'Add it to one of the two exports there:\n' +
          `  dark['${name}']         if it names a ROLE and needs a dark value\n` +
          `  schemeIndependent       if it names a VALUE and must not move\n\n` +
          'There is no default, because a colour left out stays on its light value ' +
          'in dark mode and nothing goes red.',
      );
    }
  }
}

/**
 * The complete palette per scheme: tokens, plus the two role colours.
 *
 * `colorsDark` starts from the light values so that the scheme-independent
 * primitives carry over untouched, and `dark` overwrites the rest.
 */
function buildPalettes(tokenColors, colorIsLiteral) {
  assertPaletteAgrees(tokenColors, colorIsLiteral);
  return {
    colors: { ...tokenColors, ...roles },
    colorsDark: { ...tokenColors, ...dark, ...roles },
  };
}

// ---------------------------------------------------------------------------
// 4b. Parse typography.css — the composite `ty-*` utilities
// ---------------------------------------------------------------------------
/**
 * Which CSS property maps to which field of a spec, and which `--var-` prefix its
 * value is expected to carry. `font-family` is the odd one out: its value is
 * `--var-font-serif` or `--var-font-sans`, so the token name IS the family.
 */
const TYPO_PROPERTIES = {
  'font-family': { field: 'family', prefix: '--var-font-' },
  'font-weight': { field: 'weight', prefix: '--var-font-weight-' },
  'font-size': { field: 'size', prefix: '--var-font-size-' },
  'letter-spacing': { field: 'tracking', prefix: '--var-letter-spacing-' },
  'line-height': { field: 'leading', prefix: '--var-leading-' },
};

/**
 * Properties this bridge sees and deliberately drops. React Native has no
 * `word-spacing`, so carrying it would be a field nothing could ever apply.
 *
 * Anything NOT in this list and not in TYPO_PROPERTIES throws, on purpose: an
 * upstream that starts setting `text-transform` should surface as a failed
 * generation rather than as a difference nobody notices between the CSS and the
 * app.
 */
const TYPO_IGNORED = new Set(['word-spacing']);

/** The body of `{ … }` starting at `open`, brace-matched so nested rules survive. */
function balancedBody(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error('Unbalanced braces in typography.css');
}

function readDeclarations(body, variant, where) {
  const spec = {};
  for (const [, property, value] of body.matchAll(/^\s*([a-z-]+)\s*:\s*([^;]+);/gm)) {
    if (TYPO_IGNORED.has(property)) continue;
    const mapping = TYPO_PROPERTIES[property];
    if (!mapping) {
      throw new Error(
        `typography.css: ty-${variant} sets "${property}"${where}, which this bridge ` +
          'neither maps to a React Native style nor lists as deliberately dropped. ' +
          'Add it to TYPO_PROPERTIES or TYPO_IGNORED in scripts/generate.mjs.',
      );
    }
    const token = /^var\((--var-[a-z0-9-]+)\)$/i.exec(value.trim())?.[1];
    if (!token || !token.startsWith(mapping.prefix)) {
      throw new Error(
        `typography.css: ty-${variant}'s ${property} is "${value.trim()}", not a ` +
          `var(${mapping.prefix}…) reference. The bridge reads token names, not values.`,
      );
    }
    spec[mapping.field] = token.slice(mapping.prefix.length);
  }
  return spec;
}

/**
 * Every `ty-*` utility as a spec of TOKEN NAMES, not resolved values — the host
 * turns them into a style, because how a family name reaches a text run is a
 * platform question (see the note on font families in src/index.ts).
 *
 * The three headlines that carry a `@media (min-width: 48rem)` line-height get a
 * second field rather than losing it. The app renders the mobile value; that was a
 * decision, and it stays one, but it is no longer made by omission.
 */
function parseTypography(css) {
  const specs = {};
  for (const match of css.matchAll(/@utility\s+ty-([a-z0-9-]+)\s*\{/g)) {
    const variant = match[1];
    const body = balancedBody(css, match.index + match[0].length - 1);
    const mobile = readDeclarations(body.replace(/@media[^{]*\{[\s\S]*?\n\s*\}/g, ''), variant, '');
    const media = /@media\s*\(min-width:\s*48rem\)\s*\{([\s\S]*?)\n\s*\}/.exec(body);
    const tablet = media ? readDeclarations(media[1], variant, ' inside its @media block') : {};
    specs[variant] = tablet.leading ? { ...mobile, leadingTablet: tablet.leading } : mobile;
  }
  if (Object.keys(specs).length === 0) throw new Error('typography.css: no ty-* utilities found');
  return specs;
}

// ---------------------------------------------------------------------------
// 5. Render — one function per artefact, each returning a complete string
// ---------------------------------------------------------------------------

/** The header both generated TypeScript files carry. */
const HEADER =
  '// AUTO-GENERATED by packages/design-tokens/scripts/generate.mjs — do not edit by hand.\n' +
  '// Source: tokens/theme.css · Regenerate: npm run tokens\n';

/** The same, as a CSS comment. */
const CSS_HEADER =
  '/* AUTO-GENERATED by packages/design-tokens/scripts/generate.mjs — do not edit by hand.\n' +
  '   Source: tokens/theme.css · Regenerate: npm run tokens */\n';

const paletteLines = (palette) => Object.entries(palette).map(([k, v]) => `  --color-${k}: ${v};`);

/**
 * One theme's palette, nested so that BOTH consumers can read it.
 *
 * The nesting is the whole of it, and it is not cosmetic. Written at the top
 * level — `@variant dark { ... }` with nothing around it — Tailwind 4.3.3 has no
 * element to anchor the variant to and compiles it against `:scope`, outside
 * `@layer theme`. A browser reads `:scope` in a stylesheet as `:root` and gets
 * the right answer, which is why the web export has always been correct. Uniwind's
 * native CSS processor does not: it treats a `:scope` component as an unobservable
 * selector and discards the rule whole, so no dark variable table is ever built
 * and `UniwindStore.vars.dark` ends up a copy of the light palette. Every
 * `bg-*`/`text-*` class then renders its light value on a dark phone, while
 * `useColors()` — which reads the TypeScript palette below and never touches this
 * file — switches correctly. That split is issue #138: the same token answering
 * two ways in the same second, depending on whether a class or TypeScript asked.
 *
 * `:root` inside `@layer theme` is what the native processor accepts, and it checks
 * BOTH halves: `css-visitor/rule-visitor.js:14` gates on `currentLayerName ===
 * "theme"` and on the first selector's `kind === "root"`. `@layer base { :root { … } }`
 * compiles identically under Tailwind and is discarded just the same, so neither
 * half of this shape is decoration.
 *
 * The browser output is NOT unchanged in meaning, and an earlier version of this
 * comment said it was. The dark block used to be emitted outside any layer and now
 * sits in `theme`, the lowest one this package declares; unlayered CSS beats every
 * layer whatever its specificity. For this repo's own consumers nothing moves,
 * because their competing `--color-*` live in the same layer later in source order.
 * For the CMS consumer it does: a plain `:root` override of one of our variables
 * now wins in both schemes where it used to lose in the dark one. That is written
 * down in the package README, which is where that consumer reads.
 */
const variantBlock = (name, palette) =>
  [
    '@layer theme {',
    '  :root {',
    `    @variant ${name} {`,
    ...paletteLines(palette).map((line) => `    ${line}`),
    '    }',
    '  }',
    '}',
  ].join('\n');

/**
 * theme.css — the Tailwind v4 theme, and the artefact the other three are
 * variations on.
 *
 * Two CSS files, because two consumers need different amounts of scaffolding.
 *
 *   theme.css             the tokens. What the app imports; Uniwind supplies the
 *                         `light` / `dark` variant definitions it needs.
 *   theme.standalone.css  the same, with those definitions included. What a
 *                         consumer outside this repo imports — a WordPress theme
 *                         on Tailwind v4, which has no Uniwind to supply them.
 *
 * The split exists so the app does not shadow Uniwind's own definitions with a
 * second copy of them. Without the standalone file, `theme.css` alone fails on a
 * plain Tailwind v4 build with `Cannot use @variant with unknown variant: light`.
 *
 * Values stay in `rem` here, unlike the px in the typed constants below. Uniwind
 * resolves rem against 16 (`--uniwind-em`), which is both the CSS convention and
 * the base wp-design-tokens assumes, so the app lands on exactly the same pixels
 * — while a browser keeps the user's font scaling, which a px value would throw
 * away. This is why one set of values can serve both consumers; under NativeWind
 * it could not, because that inlined rem against a root size of 14.
 *
 * They sit at the package ROOT because that is where a CSS entry conventionally
 * lives; `src/` is for what TypeScript imports. Both are named explicitly in the
 * `exports` map, and a bare subpath resolves for Uniwind and for the plain
 * Tailwind CLI alike — an earlier note here claimed the CLI ignores exports maps,
 * which is simply not true and was a bad test on my part.
 *
 * ## Why the palette appears three times
 *
 * `@theme` registers the colour names — that is what makes `bg-grey-100` exist as
 * a utility at all — and gives them their light values, so a consumer that never
 * switches themes is already correct. The two `@variant` blocks then carry the
 * per-theme values: Uniwind scans for exactly these to learn which variables are
 * theme-dependent, and both blocks must declare the SAME set or it refuses. The
 * two checks in phase 4 already guarantee that.
 *
 * Where those two blocks SIT is load-bearing, and `variantBlock` above carries the
 * argument: at the top level Uniwind's native processor throws them away without
 * a word.
 *
 * The upshot is that dark mode needs no `dark:` variant on any surface:
 * `bg-grey-100` resolves a variable, redefined under both the `.dark` class and
 * `prefers-color-scheme: dark`.
 */
function renderThemeCss(vars, scales, colors, colorsDark) {
  const { radius, leading, letterSpacingPx, fontWeights, spacingTokens, fontSizePx } = scales;

  /** The raw token value, in the unit theme.css wrote it in. */
  const raw = (name) => vars[name];

  // One array per group; the groups are separated by a blank line in the output.
  const themeEntries = [
    // Tailwind's DEFAULT radius, cleared. Without this line v4 also emits a BARE
    // form of each logical side utility — `rounded-s` for the start side, `-e`,
    // `-t`, `-b`, `-l`, `-r`, `-ss`, `-se`, `-es`, `-ee` — and this scale has a
    // token called `s`. Both rules were emitted and both applied: every Badge, the
    // search field and the duration chip on a video thumbnail had 4px leading
    // corners and 2px trailing ones, past a green build, because `--radius-s` still
    // held the right value and still emitted a correct rule of its own.
    //
    // Clearing the DEFAULT removes the bare form for ALL ten names, so no radius
    // token can collide this way — including ones the design system has not added
    // yet. `apps/mobile/__tests__/tokens.test.ts` fails if this line goes, and it
    // asserts the LINE rather than relying on its drift check: once this generator
    // stops emitting the line, the committed file agrees with it again and drift
    // sees nothing.
    ['  --radius: initial;'],
    // The numeric step. The design system counts in 2px, so `p-4` is 8px and not
    // Tailwind's 16 — which is why numeric utilities are banned outright; see
    // apps/mobile/__tests__/no-numeric-utilities.test.ts.
    [`  --spacing: ${raw('--var-spacing')};`],
    Object.keys(spacingTokens).map((k) => `  --spacing-${k}: ${raw(`--var-spacing-${k}`)};`),
    Object.keys(radius).map((k) => `  --radius-${k}: ${raw(`--var-radius-${k}`)};`),
    // `text-m`, not `text-text-m`: the token names carry their own `text-` prefix
    // and Tailwind's font-size namespace supplies one too.
    Object.keys(fontSizePx).map(
      (k) => `  --text-${k.replace(/^text-/, '')}: ${raw(`--var-font-size-${k}`)};`,
    ),
    Object.keys(leading).map((k) => `  --leading-${k}: ${raw(`--var-leading-${k}`)};`),
    Object.keys(letterSpacingPx).map(
      (k) => `  --tracking-${k}: ${raw(`--var-letter-spacing-${k}`)};`,
    ),
    Object.keys(fontWeights).map((k) => `  --font-weight-${k}: ${raw(`--var-font-weight-${k}`)};`),
    [
      `  --container-content: ${raw('--var-container-content')};`,
      `  --container-wide: ${raw('--var-container')};`,
    ],
  ];

  return [
    CSS_HEADER,
    '@theme {',
    themeEntries.map((lines) => lines.join('\n')).join('\n\n'),
    '',
    '  /* Light values, so a consumer that never switches themes is already right. */',
    ...paletteLines(colors),
    '}',
    '',
    variantBlock('light', colors),
    '',
    variantBlock('dark', colorsDark),
    '',
  ].join('\n');
}

/**
 * The `light` and `dark` variants, spelled out for a build that has no Uniwind.
 * Both halves matter: the class lets an app override the device, the media query
 * is what applies when it does not.
 */
const VARIANT_DEFINITIONS = ['light', 'dark']
  .map((theme) =>
    [
      `@custom-variant ${theme} {`,
      `  &:where(.${theme}, .${theme} *) { @slot; }`,
      '',
      `  @media (prefers-color-scheme: ${theme}) {`,
      '    &:not(:where(.light, .light *, .dark, .dark *)) { @slot; }',
      '  }',
      '}',
    ].join('\n'),
  )
  .join('\n\n');

/**
 * theme.standalone.css — theme.css plus those definitions.
 *
 * The import comes FIRST, and that is not cosmetic: CSS allows `@import` only
 * before other statements, so a conforming preprocessor must drop a late one. The
 * Tailwind CLI is lenient and accepted it either way; `postcss-import` — routine in
 * a WordPress chain — warns and drops it, and the consumer then gets the two variant
 * definitions and NOTHING else: no colours, no spacing, no radii, every utility
 * silently absent behind a build warning. Which is precisely the failure this file
 * exists to prevent, aimed at its one named consumer.
 *
 * `@variant light` resolving before the `@custom-variant` that defines it is fine —
 * Tailwind collects definitions before applying them, and the compiled output is
 * byte-identical either way.
 */
function renderStandaloneCss() {
  return [CSS_HEADER, "@import './theme.css';", '', VARIANT_DEFINITIONS, ''].join('\n');
}

/** src/tokens.generated.ts — the typed constants, in px, because an RN style takes numbers. */
function renderTokensTs(scales, colors, colorsDark) {
  const { radius, durationsMs, leading, letterSpacingPx, fontWeights, spacingTokens, fontSizePx } =
    scales;

  const spacingPx = Object.fromEntries(
    Object.entries(spacingTokens).map(([k, v]) => [k, parseFloat(v)]),
  );
  const radiusPx = Object.fromEntries(Object.entries(radius).map(([k, v]) => [k, parseFloat(v)]));

  return `${HEADER}
/* eslint-disable */
// Two complete palettes. Classes (bg-, border-) switch by themselves through the
// CSS variables; these constants do NOT — read them directly and the colour stays
// on its light value in dark mode. In the app, use useColors() from @/lib/theme.
export const colors = ${JSON.stringify(colors, null, 2)} as const;
export const colorsDark: Record<ColorToken, string> = ${JSON.stringify(colorsDark, null, 2)};
export const spacingPx = ${JSON.stringify(spacingPx, null, 2)} as const;
export const radiusPx = ${JSON.stringify(radiusPx, null, 2)} as const;
export const fontSizePx = ${JSON.stringify(fontSizePx, null, 2)} as const;
export const leading = ${JSON.stringify(leading, null, 2)} as const;
export const letterSpacingPx = ${JSON.stringify(letterSpacingPx, null, 2)} as const;
export const fontWeights = ${JSON.stringify(fontWeights, null, 2)} as const;
export const durationsMs = ${JSON.stringify(durationsMs, null, 2)} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacingPx;
`;
}

/**
 * src/reader.generated.ts — theme.css as a string for the article WebView, which is
 * a browser context of its own and shares nothing with the app's styles.
 *
 * The base `:root` plus the media queries, but not `@theme inline`: that is
 * Tailwind's, and the WebView would ignore it.
 */
function renderTypographyTs(specs) {
  const header = HEADER.replace('tokens/theme.css', 'tokens/typography.css');
  return `${header}
/* eslint-disable */
// The composite \`ty-*\` utilities, as TOKEN NAMES.
// Resolve them against the scales in ./tokens.generated. A host turns a spec into
// whatever its platform calls a text style; this file takes no view on that.
//
// \`leadingTablet\` is present where typography.css overrides the line height at
// 48rem. Read it or do not — but it is here, rather than dropped in transcription.
export const typographySpecs = ${JSON.stringify(specs, null, 2)} as const;

export type TypoVariant = keyof typeof typographySpecs;
`;
}

function renderReaderTs(themeCss, colorsDark) {
  const themeCssForReader = themeCss.split('@theme inline')[0].trim();

  // Dark mode for the article WebView. READER_LAYOUT_CSS in the core takes every
  // colour from `--var-color-*`, so redefining the same variables after THEME_CSS is
  // enough — the same palette as the app, maintained in one place.
  const darkVarBlock = Object.entries(colorsDark)
    .map(([k, v]) => `--var-color-${k}:${v}`)
    .join(';');
  // Nothing but the variables, and that is new — and it removed a rule that had never
  // worked. This used to append `.rating--qualified{color:#333333}` so the "partly
  // false" plaque, which sits on club yellow and therefore stays yellow in the dark,
  // would keep a dark label. But the host joins these into ONE stylesheet as
  // [FONTS, THEME_CSS, DARK, LAYOUT], and READER_LAYOUT_CSS carries its own
  // `.rating--qualified` rule — same selector, same specificity, later. It won. The
  // plaque had been near-white on yellow in dark mode, at 1.16:1, for as long as the
  // override existed.
  //
  // READER_LAYOUT_CSS gives that label `--var-color-neutral-700` now: a primitive, and
  // primitives do not follow the scheme. Which is the point. An override that restates
  // a value can be out-ranked silently; a token that MEANS the value cannot, because
  // there is no second rule left to disagree with it. See ADR 0022.
  const readerDarkCss = `:root{${darkVarBlock}}`;

  return `${HEADER}
/* eslint-disable */
// theme.css verbatim (CSS custom properties) — the WebView uses the --var-* directly.
export const THEME_CSS = ${JSON.stringify(themeCssForReader)};

// Appended AFTER THEME_CSS when the app is running dark. See the host's reader
// wiring — apps/mobile/src/lib/articles/reader.ts.
export const READER_DARK_CSS = ${JSON.stringify(readerDarkCss)};
`;
}

// ---------------------------------------------------------------------------
// 6. Write — the only side effects in this file
// ---------------------------------------------------------------------------
function main() {
  const themeCss = readFileSync(THEME_CSS_PATH, 'utf8');
  const typographySpecs = parseTypography(readFileSync(typographyCssPath(), 'utf8'));
  const { vars, colorIsLiteral } = parseVars(themeCss);
  const scales = groupScales(vars);
  const { colors, colorsDark } = buildPalettes(scales.tokenColors, colorIsLiteral);

  writeFileSync(resolve(PKG, 'theme.css'), renderThemeCss(vars, scales, colors, colorsDark));
  writeFileSync(resolve(PKG, 'theme.standalone.css'), renderStandaloneCss());

  const SRC_DIR = resolve(PKG, 'src');
  mkdirSync(SRC_DIR, { recursive: true });
  writeFileSync(
    resolve(SRC_DIR, 'tokens.generated.ts'),
    renderTokensTs(scales, colors, colorsDark),
  );
  writeFileSync(resolve(SRC_DIR, 'typography.generated.ts'), renderTypographyTs(typographySpecs));
  writeFileSync(resolve(SRC_DIR, 'reader.generated.ts'), renderReaderTs(themeCss, colorsDark));

  console.log('Token bridge generated:');
  console.log('  • packages/design-tokens/theme.css');
  console.log('  • packages/design-tokens/theme.standalone.css');
  console.log('  • packages/design-tokens/src/tokens.generated.ts');
  console.log('  • packages/design-tokens/src/typography.generated.ts');
  console.log('  • packages/design-tokens/src/reader.generated.ts');
  console.log(
    `  (${Object.keys(colors).length} colours, ${Object.keys(scales.spacingTokens).length} spacing tokens, ${Object.keys(scales.fontSizePx).length} font sizes)`,
  );
}

main();
