/**
 * What the generated tokens actually say, read by the app that would show the
 * damage.
 *
 * Two kinds of check used to live here and they catch different things:
 *
 *   drift        the committed files are what the generator produces right now.
 *                Catches an edited artefact and a forgotten `npm run tokens`;
 *                blind to a generator that is wrong, because then both sides are
 *                wrong together and agree.
 *   content      a specific line is in a specific artefact, and a specific colour
 *                behaves. Catches exactly the generator bug drift cannot see.
 *
 * Only the content half is still here. Drift moved to
 * `packages/design-tokens/test/drift.test.ts`, because it runs the real generator
 * and therefore rewrites the very files these assertions read — a side effect that
 * belongs in the package that owns them and in a process of its own, not in this
 * app's jest workers. The header there says the rest.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { filesUnder, numberInProse, withoutComments } from '@correctiv/prose-and-code';

import {
  colors,
  colorsDark,
  spacingPx,
  type ColorToken,
} from '@correctiv/design-tokens/tokens.generated';
import { typographySpecs } from '@correctiv/design-tokens/typography.generated';
import { fontSizePx, leading, letterSpacingPx } from '@correctiv/design-tokens/tokens.generated';
// Resolves the vendored tokens/ and nothing else — see scripts/tokens-source.mjs.
import { typographyCssPath } from '../../../scripts/tokens-source.mjs';

/** This app. */
const APP = resolve(__dirname, '..');
/** The package that owns the generator and every artefact it writes. */
const TOKENS_PKG = resolve(APP, '../../packages/design-tokens');

/** All five, so that reading "the artefacts" cannot quietly mean four of them. */
const ARTEFACTS = [
  // The Tailwind v4 theme this app imports…
  'theme.css',
  // …and the variant-carrying twin a consumer outside this repo imports, so drift
  // here is drift in what the CMS would get.
  'theme.standalone.css',
  'src/tokens.generated.ts',
  // The composite ty-* specs. Transcribed by hand until 2026-08-27, which is why
  // it is here: eleven variants with nothing checking them against the source.
  'src/typography.generated.ts',
  'src/reader.generated.ts',
] as const;

type Artefact = (typeof ARTEFACTS)[number];

/** The five artefacts as they are on disk at this moment. */
function readArtefacts(): Record<Artefact, string> {
  const out = {} as Record<Artefact, string>;
  for (const rel of ARTEFACTS) out[rel] = readFileSync(resolve(TOKENS_PKG, rel), 'utf8');
  return out;
}

/**
 * The committed artefacts, read ONCE while this module is evaluated. Every content
 * assertion below reads this snapshot rather than the disk.
 *
 * Kept that way now that the generator no longer runs in this process, because it
 * is what makes the assertions independent of declaration order — and because the
 * mask it was introduced against was expensive: while the drift check lived here
 * it rewrote all five files mid-run, so an assertion declared after it read a
 * freshly regenerated copy and could not be made to fail by hand-editing an
 * artefact. Two were written that way and were unfalsifiable from the day they
 * landed.
 */
const COMMITTED = readArtefacts();

describe('token bridge', () => {
  it("clears Tailwind's default radius, so a token cannot collide with a side utility", () => {
    /**
     * Without this line Tailwind v4 also emits a BARE form of each logical side
     * utility — `rounded-s` for the start side — and this scale has a token called
     * `s`. Both rules were emitted and both applied: every Badge, the search field
     * and the duration chip on a video thumbnail had 4px leading corners and 2px
     * trailing ones. Nothing errored, and no assertion about `--radius-s` can catch
     * it, because that token still holds the right value and still emits a correct
     * rule of its own. This is the line that resolves it; the collision comes back
     * silently if it goes.
     *
     * Drift cannot stand in for this: drop the line from the generator and the
     * committed file agrees with the generator again on the next `npm run tokens`.
     */
    expect(COMMITTED['theme.css']).toContain('--radius: initial;');
  });

  it('keeps the standalone theme importable by a plain Tailwind build', () => {
    // `@import` is only valid before other statements, so a conforming
    // preprocessor drops a late one — postcss-import does, and the consumer then
    // gets the variant definitions and none of the tokens, behind a warning.
    const firstRule = COMMITTED['theme.standalone.css'].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    expect(firstRule.startsWith("@import './theme.css';")).toBe(true);
  });

  it('maps the brand core colours correctly', () => {
    // Named in the semantic tier. The v1 aliases (`emphasis`, `alternative`,
    // `grey-700`) carry the same three values and are pinned to these by the
    // alias table below; AGENTS.md says nothing new should be written in them.
    expect(colors.accent).toBe('#ff5064'); // journalism red
    expect(colors['accent-alternative']).toBe('#fde162'); // club yellow
    expect(colors['on-canvas']).toBe('#333333'); // body text
  });

  it('resolves the spacing t-shirt scale to px', () => {
    expect(spacingPx.m).toBe(24); // 1.5rem
    expect(spacingPx.xs).toBe(8); // 0.5rem
  });
});

describe('typography specs', () => {
  it('carries every ty-* utility the source defines', () => {
    // Eleven, and the count is the point: these were transcribed by hand, so a
    // variant added upstream used to arrive only if somebody noticed it.
    const source = readFileSync(typographyCssPath(), 'utf8');
    const inSource = [...source.matchAll(/@utility\s+ty-([a-z0-9-]+)/g)].map((m) => m[1]).sort();
    expect(Object.keys(typographySpecs).sort()).toEqual(inSource);
  });

  it('keeps the tablet line height instead of dropping it', () => {
    // Three headlines override line-height at 48rem. The hand-written version took
    // the mobile value and lost the other one silently; the app still renders the
    // mobile value, but by choice now — this asserts the choice still has something
    // to choose between.
    expect(typographySpecs['headline-s']).toMatchObject({
      leading: 'loose',
      leadingTablet: 'normal',
    });
    expect(typographySpecs['headline-xl']).toMatchObject({
      leading: 'tight',
      leadingTablet: 'tighter',
    });
    // And a variant with no override must not invent one.
    expect(typographySpecs['text-m']).not.toHaveProperty('leadingTablet');
  });

  it('names only tokens the scales actually have', () => {
    // A spec carries token NAMES. One the scales do not know would render a NaN
    // font size on a device rather than fail anywhere a test could see.
    const unknown: string[] = [];
    for (const [variant, spec] of Object.entries(typographySpecs)) {
      if (!(spec.size in fontSizePx)) unknown.push(`${variant}.size = ${spec.size}`);
      if (!(spec.tracking in letterSpacingPx)) {
        unknown.push(`${variant}.tracking = ${spec.tracking}`);
      }
      if (!(spec.leading in leading)) unknown.push(`${variant}.leading = ${spec.leading}`);
    }
    expect(unknown).toEqual([]);
  });
});

/**
 * Dark mode rests on promises that are easy to break while editing
 * packages/design-tokens/palette.js — and every one of them breaks silently: the
 * app compiles, the build is green, and only on a device is there white text on a
 * white background.
 */
describe('two-scheme palette', () => {
  it('keeps the role colours identical in both schemes', () => {
    // Otherwise their name is a lie: they sit on surfaces that do not switch
    // themselves — the brand red, the club yellow, a photograph.
    for (const role of ['always-light', 'always-dark'] as const) {
      expect(colorsDark[role]).toBe(colors[role]);
    }
  });

  it('accounts for every colour in the palette, so a new one cannot arrive unnoticed', () => {
    /**
     * The lists above are hand-maintained, and without this they are decoration: a
     * colour upstream adds is simply absent from all four, and every other test here
     * iterates a list rather than the palette, so nothing fails. The generator makes
     * the same colour reach a human in palette.js; this makes it reach one here.
     *
     * Compared as sorted arrays rather than by count, so a name moved between two
     * tiers — the mistake that would otherwise keep the total right — still fails.
     *
     * When this fails on a colour upstream added, the question to answer is the same
     * one palette.js asks: does the name mean a VALUE or a ROLE? theme.css usually
     * answers it — a `var()` reference is a role, and the generator already refuses
     * to let one be called a primitive. A literal is usually a primitive, but not
     * always: `grey-250` is a literal and it is a surface with a dark value. So for a
     * literal, decide by what the name means rather than by how it is written.
     */
    expect([...PRIMITIVES, ...SEMANTIC, ...DEPRECATED_V1, ...APP_ROLES].sort()).toEqual(
      (Object.keys(colors) as ColorToken[]).sort(),
    );
  });

  it('keeps a stroke distinguishable from the surfaces it divides', () => {
    /**
     * `stroke` carries every border, divider, input outline, progress track and
     * `<Hairline>` in the app since ADR 0022. That sentence was written here as a
     * comment and was false from the day it was written: `participate/CalloutCard`
     * drew its progress track on `bg-grey-250`, because the migration edited the
     * fill on the line beneath it and left the track alone. A comment cannot notice
     * that, so the `describe` below is the half that can.
     *
     * Nothing else here constrains `stroke` itself: a
     * dark value equal to `canvas` passes the primitive check, the semantic check,
     * the alias table and the foreground check, and makes every line in dark mode
     * invisible behind a green run. That was verified, not imagined.
     *
     * The bound is 0.06 and that number was measured, not chosen. At the eighth of
     * the range this first used, `#e6e6e6` on `#ffffff` FAILED — which is the value
     * the app's hairlines carried until this ADR, and which `grey-300` still holds.
     * A test that goes red on a colour the app shipped last week is not asserting
     * "invisible", it is asserting "at least as strong as ADR 0022's repaint", and
     * it would fire as an invisibility failure if that repaint were ever argued
     * back. 0.06 keeps both the old hairline and the new one, and still catches the
     * collapse: `#1a1a1a` fails on `canvas` at 0.000, `#2e2e2e` on `surface` at
     * 0.039. All four pairs are required, so one is enough.
     *
     * Only the quiet direction is bounded. A stroke *brighter* than its foreground
     * passes here and always will — `stroke: '#f2f2f2'` in dark would be a glaring
     * white hairline and this says nothing about it. That is left to the eye,
     * because there is no value at which a strong line becomes wrong the way there
     * is one at which a line stops existing.
     */
    for (const scheme of [colors, colorsDark]) {
      for (const line of ['stroke', 'stroke-strong'] as const) {
        for (const ground of ['canvas', 'surface'] as const) {
          expect([
            line,
            ground,
            Math.abs(brightness(scheme[line]) - brightness(scheme[ground])) > 0.06,
          ]).toEqual([line, ground, true]);
        }
      }
    }
  });

  it('holds the primitives still, which is what makes them primitives', () => {
    // The tier contract, and the reason `schemeIndependent` is a list in palette.js
    // rather than something inferred. `white` names a VALUE: the white button on the
    // red onboarding screen is white on a dark phone too, because the red underneath
    // it did not change. A primitive that starts following the scheme takes every
    // such surface with it, and nothing else here would notice.
    for (const name of PRIMITIVES) {
      expect(colorsDark[name]).toBe(colors[name]);
    }
  });

  it('moves every semantic token, which is what makes them semantic', () => {
    // The inverse, and the one that catches an upstream addition slipping through as
    // a primitive. `canvas` names a ROLE; a role that holds still in dark mode is a
    // white page on a dark phone.
    //
    // `accent-alternative` is the exception and has to be named: club yellow reads on
    // both schemes and carries meaning, so it is deliberately the same colour twice.
    for (const name of SEMANTIC) {
      if (name === 'accent-alternative') continue;
      expect(colorsDark[name]).not.toBe(colors[name]);
    }
    expect(colorsDark['accent-alternative']).toBe(colors['accent-alternative']);
  });

  it('gives each semantic token the same value as the v1 alias it replaces', () => {
    /**
     * The claim ADR 0022 rests on: adopting the semantic tier did not restyle the
     * app. Every migration it licenses — `bg-grey-100` to `bg-canvas`,
     * `text-grey-600` to `text-on-canvas-muted` — is a rename and not a repaint,
     * and this is what says so, in BOTH schemes.
     *
     * Assert it here and the migration is checkable; leave it to review and the
     * only way to see a wrong pairing is to open the app and recognise the colour.
     *
     * `stroke ↔ grey-300` is deliberately absent, and it is the one mapping that is
     * NOT a rename: `stroke`'s light value is `neutral-300` #cecece, one step
     * stronger than the `grey-300` #e6e6e6 the app used for hairlines. That change
     * was taken on purpose, so it does not belong in a table of things that did not
     * change. `on-background` is absent for the opposite reason: `neutral-600`
     * arrived with the semantic tier and no v1 grey ever pointed at it.
     */
    // Typed both sides, so a token name that stops existing fails here as a type
    // error rather than as an undefined compared against an undefined — which is
    // what a Record<string, string> would have given, and it would have passed.
    const REPLACES: [ColorToken, ColorToken][] = [
      ['canvas', 'grey-100'],
      ['background', 'grey-200'],
      ['surface', 'grey-200'],
      ['on-canvas', 'grey-700'],
      ['on-surface', 'grey-700'],
      ['on-canvas-muted', 'grey-600'],
      // `stroke` has TWO v1 aliases and only one of them is a rename. Against
      // `grey-400` it is value-identical in both schemes and belongs here; against
      // `grey-300`, the alias the app's borders actually used, it is the one
      // deliberate repaint in ADR 0022 and is excluded below.
      ['stroke', 'grey-400'],
      ['stroke-strong', 'grey-500'],
      ['accent', 'emphasis'],
      ['on-canvas-accent', 'emphasis'],
      ['accent-alternative', 'alternative'],
    ];
    for (const [semantic, v1] of REPLACES) {
      expect([semantic, colors[semantic]]).toEqual([semantic, colors[v1]]);
      expect([semantic, colorsDark[semantic]]).toEqual([semantic, colorsDark[v1]]);
    }
  });

  it('keeps each foreground clear of the background it is named for', () => {
    // What the `-on-` prefix promises, checked rather than trusted. The pairing is
    // in the name, so a foreground assigned the brightness of its own background —
    // the mistake a flat scale invites and this tier exists to prevent — is caught
    // in both schemes at once.
    for (const [fg, bg] of [
      ['on-canvas', 'canvas'],
      ['on-surface', 'surface'],
      ['on-background', 'background'],
      ['on-canvas-muted', 'canvas'],
    ] as const) {
      for (const scheme of [colors, colorsDark]) {
        expect([fg, Math.abs(brightness(scheme[fg]) - brightness(scheme[bg])) > 0.4]).toEqual([
          fg,
          true,
        ]);
      }
    }
  });
});

/**
 * The deprecated tier, in the app rather than in the palette.
 *
 * Every check above reads a generated artefact. This one reads `src/`, because the
 * failure it is for leaves the artefacts perfectly correct: an alias that survived
 * ADR 0022's migration pass still resolves, still follows the scheme, and still
 * draws — one step off whatever its neighbours draw, on a screen nobody diffed.
 * That is how `CalloutCard`'s progress track kept `bg-grey-250` while every other
 * track moved to `stroke`, and why the claim above it had to become this.
 *
 * Only fills and lines written as a CLASS are scanned. The two remaining uses that
 * reach the token through TypeScript — `ClaimStatusTag`'s `colors['grey-250']` and
 * `SettingRow`'s `palette['grey-300']` — are in ADR 0022's table for the same
 * reason as the two below and are not the shape this catches. Foreground uses of
 * `grey-500` are deliberately out of scope: the ADR's table says the semantic tier
 * has no foreground that faint, so there are dozens of them and they are correct.
 */
/**
 * `@correctiv/prose-and-code` is where the walk and the comment stripper live now.
 * Prose about a token is not a use of one; the two files kept below explain
 * themselves at length, and `Typo` and `LiveBanner` name the tiers in theirs.
 */
const SOURCE = /\.tsx?$/;

describe('the deprecated aliases', () => {
  /**
   * Where ADR 0022 says nothing in the semantic tier replaces the alias yet. Each
   * entry is a claim upstream still owes an answer to, so the list shrinking is the
   * signal, and a name arriving in it needs a row in that ADR's table first.
   */
  const KEPT: Record<string, string> = {
    'components/ui/Badge.tsx': 'bg-grey-250',
    'components/ui/Thumbnail.tsx': 'bg-grey-300',
  };

  const SRC = join(APP, 'src');

  it('draws no fill or line on one, outside the uses ADR 0022 names', () => {
    // Built here rather than beside `KEPT`: the tier lists are declared below this
    // block, and a `describe` body runs while the module is still evaluating.
    const FILL = new RegExp(
      String.raw`\b(?:bg|border|divide|fill|ring|outline)-(?:${DEPRECATED_V1.join('|')})\b`,
      'g',
    );

    const offenders: string[] = [];
    for (const file of filesUnder(SRC, SOURCE)) {
      const relative = file.slice(SRC.length + 1);
      const lines = withoutComments(readFileSync(file, 'utf8')).split('\n');
      for (const [index, line] of lines.entries()) {
        for (const hit of line.match(FILL) ?? []) {
          if (KEPT[relative] === hit) continue;
          offenders.push(`${relative}:${index + 1} → ${hit}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('still has every use it keeps, so the list cannot outlive them', () => {
    // The other direction. An entry above whose file has migrated is a row in ADR
    // 0022's table that upstream no longer owes anything for, and leaving it here
    // would let the next real one in unnoticed.
    const stale = Object.entries(KEPT).filter(
      ([relative, hit]) => !readFileSync(join(SRC, relative), 'utf8').includes(hit),
    );
    expect(stale.map(([relative]) => relative)).toEqual([]);
  });
});

/**
 * The count AGENTS.md quotes, taken rather than remembered.
 *
 * `always-light` / `always-dark` are this app's own names for `white` and
 * `neutral-700`, and ADR 0022 retires them. Both that record and AGENTS.md size the
 * rename by a number of call sites, and a number typed into prose about code is the
 * thing this repository calls a fact that expires: it was 45, nobody touched it, and
 * four more arrived with the gallery. Nothing about the sentence looked wrong.
 *
 * So the number lives in one living document and is checked here. ADR 0022 keeps its
 * own, struck and corrected in place, because a record says what was true when it was
 * written and is not rewritten to agree with today.
 */
describe("the app's two role colours", () => {
  it('is written in as many places as AGENTS.md says', () => {
    // A call site is a line of `src/` outside a comment that writes one of the two
    // names. Prose about them is not one — three comments mention them and they
    // would survive the rename as history. The gallery's `label:` caption IS one: it
    // prints `color="always-light"` beside the specimen using it, so a rename has to
    // edit it like any other. Every such line writes exactly one name, which is why
    // lines and occurrences agree and the count needs no tie-break.
    const sites = filesUnder(join(APP, 'src'), SOURCE).flatMap((file) =>
      withoutComments(readFileSync(file, 'utf8'))
        .split('\n')
        .flatMap((line) => line.match(/always-light|always-dark/g) ?? []),
    );

    // The sentence is quoted rather than derived, and it stays here rather than in
    // the helper: the phrasing is what makes it findable, and a pattern loose
    // enough to fit whatever AGENTS.md says next would match something that is not
    // this claim. What the helper adds is the other failure — a rewritten sentence
    // that this stops matching, which used to compare `undefined` and said so in a
    // way nobody could read.
    const agents = resolve(APP, '../../AGENTS.md');
    expect(
      numberInProse({
        documents: [{ name: 'AGENTS.md', text: readFileSync(agents, 'utf8') }],
        pattern: /all (\d+) existing call sites/,
        value: sites.length,
        what: 'apps/mobile/src writes the two names on',
      }),
    ).toEqual([]);
  });
});

/**
 * The tiers, spelled out here rather than imported from palette.js.
 *
 * palette.js is the thing under test: reading its own `schemeIndependent` back would
 * make the primitive check agree with whatever that file currently says, including
 * after someone moves `canvas` into it. A second copy is the point — when upstream
 * adds a colour, the generator throws until palette.js classifies it, and the
 * partition test below fails until a human classifies it here too.
 */
const PRIMITIVES: ColorToken[] = [
  'black',
  'white',
  'neutral-100',
  'neutral-200',
  'neutral-300',
  'neutral-400',
  'neutral-500',
  'neutral-600',
  'neutral-700',
  'red-500',
  'yellow-400',
];

const DEPRECATED_V1: ColorToken[] = [
  'emphasis',
  'alternative',
  'grey-100',
  'grey-200',
  'grey-250',
  'grey-300',
  'grey-400',
  'grey-500',
  'grey-600',
  'grey-700',
];

/** App-invented, scheme-independent, and retired by ADR 0022 once #72's pass lands. */
const APP_ROLES: ColorToken[] = ['always-light', 'always-dark'];

const SEMANTIC: ColorToken[] = [
  'accent',
  'accent-alternative',
  'background',
  'canvas',
  'surface',
  'on-background',
  'on-canvas',
  'on-surface',
  'on-canvas-muted',
  'on-canvas-accent',
  'stroke',
  'stroke-strong',
];

/** Perceived brightness, 0…1, roughly per ITU-R BT.601. */
function brightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
