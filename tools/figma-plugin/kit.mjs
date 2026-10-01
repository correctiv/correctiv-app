// Build the component kit from the APP, not from the board.
//
// An earlier version cut components out of the drawn screens by name. That is the
// wrong direction and it showed: the screens are transcribed from screenshots, so
// what came out was a *usage* wearing a component's name — `ui/Card` arrived
// carrying a heading, a paragraph and two buttons, none of which `ui/Card.tsx` has
// ever known about.
//
// So this file describes each component the way its source file does, and takes the
// numbers from the same tokens the app compiles. A component here has the props its
// React counterpart has, as Figma component properties, and the ones with a `variant`
// union become a Figma variant set. Editing the main component in Figma therefore
// changes every instance, exactly as editing the .tsx changes every call site.
//
//   node tools/figma-plugin/kit.mjs
//
// It only ever rewrites the `Bausteine` page. Screens are untouched.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const SPEC = join(HERE, 'spec.json');
const PAGE = 'Bausteine';

// ---------------------------------------------------------------- the scales
//
// Read, not retyped. A size that moves in the tokens moves the kit on the next run;
// a size typed in here would be a second opinion about a number that already has an
// owner.

const themeCss = await readFile(join(ROOT, 'packages/design-tokens/theme.css'), 'utf8');
const typographyTs = await readFile(
  join(ROOT, 'packages/design-tokens/src/typography.generated.ts'),
  'utf8',
);

/** Every `--name: value` in the file's first block, which is `@theme`. */
const scale = {};
for (const line of themeCss.split('\n')) {
  const m = line.match(/^\s*--([a-z0-9-]+):\s*([^;]+);/);
  if (m && scale[m[1]] === undefined) scale[m[1]] = m[2].trim();
}

/** rem at the 16px root the app assumes, px as written, bare numbers as numbers. */
function px(name) {
  const value = scale[name];
  if (value === undefined) throw new Error('no such token: --' + name);
  const rem = value.match(/^(-?[\d.]+)rem$/);
  if (rem) return Math.round(Number.parseFloat(rem[1]) * 16 * 1000) / 1000;
  const p = value.match(/^(-?[\d.]+)px$/);
  if (p) return Number.parseFloat(p[1]);
  return Number.parseFloat(value);
}

const S = {
  '4xs': px('spacing-4xs'),
  '3xs': px('spacing-3xs'),
  '2xs': px('spacing-2xs'),
  xs: px('spacing-xs'),
  s: px('spacing-s'),
  sm: px('spacing-sm'),
  m: px('spacing-m'),
};
const R = { xs: px('radius-xs'), s: px('radius-s'), md: px('radius-md') };

const specs = JSON.parse(
  typographyTs.slice(typographyTs.indexOf('{'), typographyTs.lastIndexOf('}') + 1),
);

/**
 * One `ty-*` variant as the interpreter's text properties.
 *
 * `leading` is a percentage here and a factor in the tokens; `tracking` is a
 * percentage here and px there, so it is divided by the size it applies to. Both
 * conversions belong to Figma, not to the token, which is why they live here.
 */
function ty(variant, extra) {
  const spec = specs[variant];
  if (spec === undefined) throw new Error('no such variant: ' + variant);
  const size = px('text-' + spec.size.replace(/^text-/, ''));
  const out = {
    t: 'text',
    // The variant's name, which is also the name of its Figma text style. The
    // numbers below stay as well: the replica binds the style, the wireframe draws
    // from the numbers, and neither needs the other.
    style: variant,
    font: spec.family,
    weight: spec.weight === 'normal' ? 'regular' : spec.weight,
    size: size,
    leading: Math.round(px('leading-' + spec.leading) * 100),
    tracking: Math.round((px('tracking-' + spec.tracking) / size) * 10000) / 100,
    color: '@color-on-canvas',
  };
  // `Object.keys` does not skip an explicit `undefined`, and the specimen sheet
  // passes `weight: undefined` for the eleven variants that take their own weight.
  // Copying that over made `out.weight` undefined, which then read as an override
  // and named a style — `headline-l/undefined` — that does not exist, so those rows
  // bound no style and drew in Regular under a label saying Bold.
  for (const key of Object.keys(extra || {})) {
    if (extra[key] !== undefined) out[key] = extra[key];
  }
  // `<Typo variant="text-m" weight="bold">` is a variant with its weight overridden,
  // and Figma has no such thing: a text style pins the whole font, cut included. So
  // the pair gets a style of its own, named the way the JSX reads.
  if (out.weight !== (spec.weight === 'normal' ? 'regular' : spec.weight)) {
    out.style = variant + '/' + out.weight;
  }
  // A hand-set size or leading is not this variant any more, and a style would
  // silently undo it.
  if ((extra || {}).size !== undefined || (extra || {}).leading !== undefined) {
    delete out.style;
  }
  return out;
}

const VARIANTS = Object.keys(specs);

/**
 * Every `ty-*` variant as a Figma text style.
 *
 * This, not a component, is what `<Typo variant="headline-l">` is: a style applied
 * to a text node. Change `headline-l` in Figma and every headline on every page
 * follows, including the ones inside components — which is the behaviour a variant
 * set could never give, because a component only reaches what it contains.
 */
function styleOf(name, variant, weight) {
  const one = ty(variant, weight === undefined ? undefined : { weight: weight });
  return {
    name: name,
    font: one.font,
    weight: one.weight,
    size: one.size,
    leading: one.leading,
    tracking: one.tracking,
  };
}

/**
 * Which `variant` + `weight` pairs the app actually writes.
 *
 * Read off the JSX rather than listed here, because a list would be a second place
 * to remember. Four pairs today; a fifth appears in the kit the moment somebody
 * writes it in a screen.
 */
async function usedWeightOverrides() {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.tsx')) files.push(full);
    }
  }
  await walk(join(ROOT, 'apps/mobile/src'));

  const pairs = {};
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    // The whole opening tag, newlines included: four call sites break the attributes
    // across lines, three of them carrying both a variant and a weight, and a
    // single-line regex would miss them.
    for (const tag of source.match(/<Typo\b[^>]*>/g) || []) {
      const variant = tag.match(/variant="([a-z0-9-]+)"/);
      const weight = tag.match(/weight="([a-z]+)"/);
      if (variant === null || weight === null) continue;
      const spec = specs[variant[1]];
      if (spec === undefined) continue;
      const own = spec.weight === 'normal' ? 'regular' : spec.weight;
      if (weight[1] === own) continue;
      pairs[variant[1] + '/' + weight[1]] = [variant[1], weight[1]];
    }
  }
  return pairs;
}

const overrides = await usedWeightOverrides();
const TEXT_STYLES = VARIANTS.map((v) => styleOf(v, v)).concat(
  Object.keys(overrides)
    .sort()
    .map((name) => styleOf(name, overrides[name][0], overrides[name][1])),
);

// ---------------------------------------------------------------- the components
//
// Named after the file each one lives in, so that moving a `NavCard` in Figma and
// opening `profile/NavCard.tsx` are the same conversation. Order matters: a
// component may only instance one that is already registered, which is why the ui/
// primitives come first — the same order their imports run in.

/** `text-button` is the label of every button; only the two colours differ. */
const BUTTON_TONES = [
  ['primary', '@color-accent', '@color-always-light', null],
  ['secondary', '@color-surface', '@color-on-canvas', null],
  ['outline', '@color-canvas', '@color-on-canvas', '@color-stroke'],
  ['club', '@color-accent-alternative', '@color-always-dark', null],
  ['onEmphasis', '@color-always-light', '@color-always-dark', null],
];

const BADGE_TONES = [
  ['emphasis', '@color-accent', '@color-always-light'],
  ['club', '@color-accent-alternative', '@color-always-dark'],
  ['neutral', '@color-grey-250', '@color-on-canvas-muted'],
  ['live', null, '@color-accent'],
];

/**
 * The four claim surfaces. The words are not here and are not the core's either
 * any more: `apps/mobile/src/components/participate/ClaimStatusTag.tsx` formats
 * them out of its own `STATUS_LABELS` and the core's `RATING_LABELS`. The German
 * below is the SPEC's label, which is what a spec shows.
 */
const CLAIM_TONES = [
  ['richtig', '#2e7d4f', '@color-always-light', null, 'RICHTIG'],
  ['falsch', '@color-accent', '@color-always-light', null, 'FALSCH'],
  ['inArbeit', '@color-canvas', '@color-on-canvas', '@color-stroke', 'IN ARBEIT'],
  ['offen', '@color-grey-250', '@color-on-canvas-muted', null, 'OFFEN'],
];

/** A chevron, a switch, an icon: glyphs until the spec learns to carry vectors. */
const CHEVRON = '›';

/**
 * The label, at the size and tracking `Badge.tsx` overrides, and NOT in bold.
 *
 * It said bold until 2026-09-10, and the app never has: `Badge.tsx` applies
 * `typography['text-s']` and overrides only size, tracking and case, so the cut is
 * `text-s`'s own, which is regular. Measured off the app's rendering rather than
 * read off this file, and worth saying how: on web every cut computes as
 * `font-weight: 400` because `theme/fonts.ts` loads one file per weight and puts
 * the weight in the FAMILY name, so the family is the only honest reading. It is
 * `SourceSans3_400Regular`.
 */
function badgeLabel(color) {
  return ty('text-s', {
    chars: 'CLUB',
    size: 11,
    tracking: Math.round((0.4 / 11) * 10000) / 100,
    color: color,
    bind: 'Label',
  });
}

const KIT = [
  {
    // A specimen sheet, deliberately not a component. The styles are the deliverable;
    // this frame only makes them visible, and puts each name next to what it does.
    t: 'frame',
    name: 'ui/Typo, Textstile',
    dir: 'V',
    w: 'hug',
    gap: S.m,
    pad: [S.m, S.m, S.m, S.m],
    fill: '@color-canvas',
    children: VARIANTS.map((v) => [v, v, undefined])
      .concat(
        Object.keys(overrides)
          .sort()
          .map((n) => [n, overrides[n][0], overrides[n][1]]),
      )
      .map(([name, variant, weight]) => ({
        t: 'frame',
        name: name,
        dir: 'V',
        w: 'hug',
        gap: S['4xs'],
        children: [
          ty('text-s', { chars: name, size: 11, color: '@color-grey-500' }),
          ty(variant, { chars: 'Recherchen, die etwas ändern', weight: weight }),
        ],
      })),
  },
  {
    t: 'variants',
    name: 'ui/Button',
    prop: 'Variante',
    props: { Titel: { type: 'TEXT', default: 'Beitrag festlegen' } },
    options: BUTTON_TONES.map(([value, surface, label, border]) => {
      const option = {
        value: value,
        dir: 'H',
        w: 'hug',
        align: 'CENTER',
        cross: 'CENTER',
        pad: [S.m, S.m, S.s, S.s],
        radius: R.md,
        fill: surface,
        children: [ty('button', { chars: 'Beitrag festlegen', color: label, bind: 'Titel' })],
      };
      if (border !== null) option.stroke = border;
      return option;
    }),
  },
  {
    t: 'variants',
    name: 'ui/Badge',
    prop: 'Ton',
    props: { Label: { type: 'TEXT', default: 'CLUB' } },
    options: BADGE_TONES.map(([value, surface, label]) => {
      const children = [];
      // The live tone is a red dot plus a label on no fill at all.
      if (value === 'live') children.push({ t: 'ellipse', w: 7, h: 7, fill: '@color-accent' });
      children.push(badgeLabel(label));
      const option = {
        value: value,
        dir: 'H',
        w: 'hug',
        cross: 'CENTER',
        gap: S['3xs'],
        pad: [S['2xs'], S['2xs'], S['4xs'], S['4xs']],
        radius: R.s,
        children: children,
      };
      if (surface !== null) option.fill = surface;
      return option;
    }),
  },
  {
    t: 'variants',
    name: 'ui/Chip',
    prop: 'Gewählt',
    props: { Label: { type: 'TEXT', default: 'Klima' } },
    options: [
      ['ja', '@color-accent', '@color-always-light', null],
      ['nein', '@color-surface', '@color-on-canvas', '@color-stroke'],
    ].map(([value, surface, label, border]) => {
      const option = {
        value: value,
        dir: 'H',
        w: 'hug',
        cross: 'CENTER',
        pad: [S.s, S.s, S['2xs'], S['2xs']],
        radius: R.md,
        fill: surface,
        children: [
          ty('text-s', { chars: 'Klima', weight: 'semibold', color: label, bind: 'Label' }),
        ],
      };
      if (border !== null) option.stroke = border;
      return option;
    }),
  },
  {
    // The container, and nothing else. What used to stand here was one filled-in
    // card off the profile screen; `Card.tsx` is twelve lines and holds no copy.
    // The dashed slot is what a Figma component cannot express: an instance may
    // override text and visibility, never add children. Cards that DO carry content
    // are their own components in the app: the group label over one card has been
    // `SectionCard` since 2026-09-10, and sixteen call sites use it. The kit still
    // cannot hold that component, for the reason above.
    t: 'variants',
    name: 'ui/Card',
    prop: 'Ton',
    props: {},
    options: [
      ['surface', '@color-surface', null],
      ['outline', '@color-canvas', '@color-stroke'],
    ].map(([value, surface, border]) => {
      const option = {
        value: value,
        dir: 'V',
        w: 280,
        // `spacing-m`, which is 24 and not the 16 this said until 2026-09-10.
        // `Card.tsx` has always written `p-m`; the drift check against the measured
        // rendering is what noticed, and nothing before it could have.
        pad: [S.m, S.m, S.m, S.m],
        radius: R.md,
        fill: surface,
        children: [
          {
            t: 'frame',
            name: 'Inhalt',
            dir: 'V',
            w: 'fill',
            h: 56,
            cross: 'CENTER',
            align: 'CENTER',
            stroke: '@color-stroke',
            dash: [4, 4],
            children: [ty('text-s', { chars: 'Inhalt', color: '@color-grey-500' })],
          },
        ],
      };
      if (border !== null) option.stroke = border;
      return option;
    }),
  },
  {
    t: 'component',
    name: 'ui/Overline',
    props: { Label: { type: 'TEXT', default: 'IHRE MITGLIEDSCHAFT' } },
    dir: 'V',
    w: 'hug',
    fill: '@color-canvas',
    children: [
      ty('text-s', {
        chars: 'IHRE MITGLIEDSCHAFT',
        weight: 'bold',
        size: 12,
        tracking: 10,
        color: '@color-on-canvas-muted',
        bind: 'Label',
      }),
    ],
  },
  {
    t: 'component',
    name: 'ui/Hairline',
    props: {},
    dir: 'V',
    w: 280,
    fill: '@color-canvas',
    // `w: 'fill'` for the same reason as in ui/ScreenHeader: a line is born 10px wide.
    children: [{ t: 'line', color: '@color-stroke', w: 'fill' }],
  },
  {
    t: 'component',
    name: 'ui/SectionHeader',
    props: {
      Titel: { type: 'TEXT', default: 'Aus dem Backstage' },
      Aktion: { type: 'TEXT', default: 'Alles ansehen' },
      'Aktion zeigen': { type: 'BOOLEAN', default: true },
    },
    dir: 'H',
    w: 320,
    cross: 'MAX',
    align: 'SPACE_BETWEEN',
    fill: '@color-canvas',
    children: [
      ty('headline-m', { chars: 'Aus dem Backstage', bind: 'Titel' }),
      {
        t: 'frame',
        name: 'Aktion',
        dir: 'H',
        w: 'hug',
        bind: 'Aktion zeigen',
        children: [
          ty('text-s', { chars: 'Alles ansehen', color: '@color-accent', bind: 'Aktion' }),
        ],
      },
    ],
  },
  {
    t: 'component',
    name: 'ui/ScreenHeader',
    props: { Zurück: { type: 'TEXT', default: 'Zurück' } },
    dir: 'V',
    w: 320,
    fill: '@color-canvas',
    children: [
      {
        t: 'frame',
        dir: 'H',
        w: 'fill',
        cross: 'CENTER',
        gap: S['3xs'],
        pad: [S.sm, S.sm, S.s, S.s],
        children: [
          ty('text-m', { chars: '‹', size: 20, color: '@color-on-canvas' }),
          ty('text-m', { chars: 'Zurück', color: '@color-on-canvas', bind: 'Zurück' }),
        ],
      },
      // Without `w: 'fill'` a line keeps the 10px width a fresh frame is born at.
      { t: 'line', color: '@color-stroke', w: 'fill' },
    ],
  },
  {
    t: 'component',
    name: 'profile/NavCard',
    props: {
      Titel: { type: 'TEXT', default: 'Backstage' },
      Untertitel: { type: 'TEXT', default: 'Was gerade in der Redaktion passiert' },
      Club: { type: 'BOOLEAN', default: true },
    },
    dir: 'H',
    w: 320,
    cross: 'CENTER',
    pad: [0, 0, S.s, S.s],
    stroke: '@color-stroke',
    strokeSides: 'bottom',
    fill: '@color-canvas',
    children: [
      ty('text-m', { chars: '◎', size: 20, color: '@color-on-canvas-muted' }),
      {
        t: 'frame',
        dir: 'V',
        w: 'fill',
        gap: S['4xs'],
        pad: [S.s, 0, 0, 0],
        children: [
          {
            t: 'frame',
            dir: 'H',
            w: 'hug',
            cross: 'CENTER',
            gap: S['2xs'],
            children: [
              ty('text-m', { chars: 'Backstage', weight: 'bold', bind: 'Titel' }),
              // A nested instance, because `NavCard.tsx` renders a `<Badge>`. Change
              // the badge once and it changes here too, in Figma as in the app.
              { t: 'instance', of: 'ui/Badge', set: { Ton: 'club', Label: 'CLUB' }, bind: 'Club' },
            ],
          },
          ty('text-s', {
            chars: 'Was gerade in der Redaktion passiert',
            color: '@color-on-canvas-muted',
            w: 'fill',
            bind: 'Untertitel',
          }),
        ],
      },
      ty('text-m', { chars: CHEVRON, size: 16, color: '@color-grey-500' }),
    ],
  },
  {
    // A variant set, not a BOOLEAN. Binding the switch's VISIBILITY to `An` made the
    // whole control vanish when it was off, which is not what off looks like. Figma
    // has no way to swap one node's fill from a property, so the two appearances have
    // to be two variants.
    t: 'variants',
    name: 'profile/SettingRow',
    prop: 'An',
    props: {
      Label: { type: 'TEXT', default: 'Push-Mitteilungen' },
      Beschreibung: { type: 'TEXT', default: 'Neue Recherchen und Mitmach-Aufrufe' },
      'Beschreibung zeigen': { type: 'BOOLEAN', default: true },
    },
    options: [
      ['ja', '@color-accent', 'MAX'],
      ['nein', '@color-grey-300', 'MIN'],
    ].map(([value, track, knob]) => ({
      value: value,
      dir: 'H',
      w: 320,
      cross: 'CENTER',
      gap: S.s,
      pad: [0, 0, S['2xs'], S['2xs']],
      fill: '@color-canvas',
      children: [
        {
          t: 'frame',
          dir: 'V',
          w: 'fill',
          gap: S['4xs'],
          children: [
            ty('text-m', { chars: 'Push-Mitteilungen', w: 'fill', bind: 'Label' }),
            {
              t: 'frame',
              dir: 'V',
              w: 'fill',
              bind: 'Beschreibung zeigen',
              children: [
                ty('text-s', {
                  chars: 'Neue Recherchen und Mitmach-Aufrufe',
                  color: '@color-on-canvas-muted',
                  w: 'fill',
                  bind: 'Beschreibung',
                }),
              ],
            },
          ],
        },
        {
          t: 'frame',
          name: 'Schalter',
          dir: 'H',
          w: 44,
          h: 26,
          cross: 'CENTER',
          align: knob,
          pad: [3, 3, 3, 3],
          radius: 13,
          fill: track,
          children: [{ t: 'ellipse', w: 20, h: 20, fill: '@color-always-light' }],
        },
      ],
    })),
  },
  {
    t: 'component',
    name: 'discover/ProjectRow',
    props: {
      Name: { type: 'TEXT', default: 'CrimeTech' },
      Teaser: {
        type: 'TEXT',
        default: 'Wie Polizeibehörden mit Technik gegen Kriminalität vorgehen',
      },
    },
    dir: 'H',
    w: 320,
    cross: 'CENTER',
    pad: [0, 0, S.s, S.s],
    stroke: '@color-stroke',
    strokeSides: 'bottom',
    fill: '@color-canvas',
    children: [
      {
        t: 'frame',
        dir: 'V',
        w: 'fill',
        gap: S['4xs'],
        pad: [0, S.s, 0, 0],
        children: [
          ty('text-m', { chars: 'CrimeTech', weight: 'bold', bind: 'Name' }),
          ty('text-s', {
            chars: 'Wie Polizeibehörden mit Technik gegen Kriminalität vorgehen',
            color: '@color-on-canvas-muted',
            w: 'fill',
            bind: 'Teaser',
          }),
        ],
      },
      ty('text-m', { chars: CHEVRON, size: 16, color: '@color-grey-500' }),
    ],
  },
  {
    t: 'variants',
    name: 'participate/ClaimStatusTag',
    prop: 'Status',
    props: { Label: { type: 'TEXT' } },
    options: CLAIM_TONES.map(([value, surface, label, border, text]) => {
      const option = {
        value: value,
        dir: 'H',
        w: 'hug',
        pad: [S['2xs'], S['2xs'], S['4xs'], S['4xs']],
        radius: R.xs,
        fill: surface,
        children: [
          ty('text-s', { chars: text, weight: 'bold', size: 11, color: label, bind: 'Label' }),
        ],
      };
      if (border !== null) option.stroke = border;
      return option;
    }),
  },
  {
    t: 'component',
    name: 'profile/ClubCard',
    props: {
      Name: { type: 'TEXT', default: 'Alex Beispiel' },
      Stufe: { type: 'TEXT', default: 'Mitgliedschaft mit Beitrag · seit 12.03.2024' },
    },
    dir: 'V',
    w: 320,
    pad: [S.m, S.m, S.m, S.m],
    radius: R.md,
    // Yellow in both schemes, so everything on it takes the fixed dark role colour
    // rather than the page's text colour, which turns near-white in dark mode and
    // would vanish on the yellow.
    fill: '@color-accent-alternative',
    children: [
      {
        t: 'frame',
        name: 'Kopf',
        dir: 'H',
        w: 'fill',
        cross: 'CENTER',
        align: 'SPACE_BETWEEN',
        children: [
          // Not a `ui/Overline` instance, though `ClubCard.tsx` does import Overline:
          // it passes `color="always-dark"`, and an instance may override text and
          // visibility but never a colour. A colour prop would have to become a
          // variant, and one variant per colour is the worse trade.
          ty('text-s', {
            chars: 'CORRECTIV CLUB',
            weight: 'bold',
            size: 12,
            tracking: 10,
            color: '@color-always-dark',
          }),
          // The OUTLINE heart, U+2661, though the app's Ionicon is filled. Kalam has
          // no heart at all, so the wireframe falls back to an emoji font; U+2665
          // comes back as a red picture, straight through the grey ramp and into the
          // one page that exists in order not to be about colour. The text-presentation
          // selector does not persuade Figma otherwise. U+2661 has no emoji form.
          ty('text-m', { chars: '♡', size: 20, color: '@color-always-dark' }),
        ],
      },
      { t: 'space', h: S.m },
      ty('headline-l', {
        chars: 'Alex Beispiel',
        color: '@color-always-dark',
        w: 'fill',
        bind: 'Name',
      }),
      ty('text-s', {
        chars: 'Mitgliedschaft mit Beitrag · seit 12.03.2024',
        color: '@color-always-dark',
        opacity: 0.7,
        w: 'fill',
        bind: 'Stufe',
      }),
    ],
  },
];

// ---------------------------------------------------------------- the audit
//
// A component that quietly lacks a prop its source has is the same failure as a
// comment that says serif over sans: the drawing looks finished and is wrong, and
// nothing says so. So every prop in the source has to be accounted for here, in one
// of three ways, and an unaccounted one fails this script rather than shipping.
//
//   maps    the prop IS a Figma property (one prop may feed several)
//   ignore  the prop has no visual effect, or belongs to the call site
//   gaps    the prop is visual and Figma cannot express it — printed, every run
//
// The third is the point. A gap that is written down is a decision; a gap that is
// merely absent is a bug waiting to be found by eye.

/** Never visual in this sense, whatever component they appear on. */
const NEVER_VISUAL = ['className', 'style', 'children'];

const AUDIT = {
  'ui/Button': {
    maps: { title: 'Titel', variant: 'Variante' },
    // Whether the button stretches is a fact about the column it sits in, and the
    // spec carries that as `w` on the instance.
    ignore: ['fullWidth'],
    gaps: {
      disabled:
        'four tenths opacity, not a variant — one per variant would double the set,' +
        ' so `use-kit.mjs` puts the opacity on the instance instead',
    },
  },
  'ui/Badge': { maps: { label: 'Label', tone: 'Ton' } },
  'ui/Chip': { maps: { label: 'Label', selected: 'Gewählt' } },
  'ui/Card': { maps: { tone: 'Ton' } },
  'ui/Overline': {
    maps: { label: 'Label' },
    gaps: { color: 'an instance cannot override a colour; it would need a variant per colour' },
  },
  'ui/Hairline': { maps: {} },
  'ui/SectionHeader': { maps: { title: 'Titel', actionLabel: ['Aktion', 'Aktion zeigen'] } },
  'ui/ScreenHeader': {
    maps: { backLabel: 'Zurück' },
    gaps: { children: 'a slot — the search field on /suche — and an instance takes no children' },
  },
  'profile/NavCard': {
    maps: { title: 'Titel', subtitle: 'Untertitel', club: 'Club' },
    gaps: { icon: 'an Ionicon; the spec has no vectors, so the kit draws a glyph' },
  },
  'profile/SettingRow': {
    maps: {
      label: 'Label',
      description: ['Beschreibung', 'Beschreibung zeigen'],
      value: 'An',
    },
  },
  'profile/ClubCard': { maps: { name: 'Name', tierLabel: 'Stufe', memberSince: 'Stufe' } },
  'discover/ProjectRow': { maps: { project: ['Name', 'Teaser'] } },
  'participate/ClaimStatusTag': { maps: { claim: ['Status', 'Label'] } },
};

/** The innermost `{ … }` starting at `from`, by brace matching. */
function literal(source, from) {
  const open = source.indexOf('{', from);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

/** The text between a bracket at `from` and its match, exclusive. */
function between(source, from, opener, closer) {
  if (from === -1 || source[from] !== opener) return null;
  let depth = 0;
  for (let i = from; i < source.length; i++) {
    if (source[i] === opener) depth++;
    if (source[i] === closer) {
      depth--;
      if (depth === 0) return source.slice(from + 1, i);
    }
  }
  return null;
}

/** Split on commas that are not inside a bracket of any kind. */
function topLevel(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ('({['.indexOf(ch) !== -1) depth++;
    else if (')}]'.indexOf(ch) !== -1) depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.filter((p) => p.trim() !== '');
}

/**
 * The props a component file declares, from `export type XProps` or from the inline
 * type on the function's own parameter.
 *
 * The inline search is anchored at `export function`, because a file may well hold a
 * helper whose RETURN type is an object literal — `toneFor` in ClaimStatusTag does —
 * and the first `}: {` in the file would otherwise be that one.
 */
function sourceProps(source, component) {
  // Strings first, then comments. A `'https://…'` default makes the comment stripper
  // eat the rest of the line, and a `'}'` or `')'` default makes the bracket matchers
  // close early — `{ a = '}', b }` silently lost `b`, which is the one failure the
  // audit exists to catch. Blanking the contents keeps every offset intact.
  const clean = source
    .replace(
      /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g,
      (m) => m[0] + ' '.repeat(m.length - 2) + m[m.length - 1],
    )
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

  // Anchored on the component's OWN function, by name. Anchoring on the first
  // `export function` was not enough: a file may declare a private subcomponent
  // BELOW the exported one — `LoginGate.tsx` has `NoAccess({ shortfall })` — and the
  // audit would then check the helper's props and pass, having verified nothing.
  // The name is escaped and a generic is allowed, so `Foo<T>({ … })` reports the
  // real problem rather than "no such function".
  const escaped = component.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fn = clean.search(new RegExp('export function ' + escaped + '\\s*[<(]'));
  if (fn === -1) throw new Error('no `export function ' + component + '` to read props from');

  // The parameter list, bounded by its own parentheses. Reaching for the first `{`
  // after `(` walked into the function BODY whenever the component destructures
  // nothing — `LoginGate()` came back with `const`, `Date` and a word out of a German
  // string — so the brace has to be found inside the parens or not at all.
  const open = clean.indexOf('(', fn);
  const params = between(clean, open, '(', ')');
  const brace = params === null ? -1 : params.indexOf('{');
  const used = [];
  if (brace !== -1) {
    // Split at depth zero. `{ a = pick(1, 2), b }` and `{ item: { id } }` both broke a
    // plain `split(',')`, one inventing a prop called "2" and the other losing `id`.
    for (const part of topLevel(literal(params, brace) || '')) {
      if (part.indexOf('...') !== -1) continue;
      const m = part.match(/^\s*(\w+)\s*:\s*\{/);
      if (m) {
        // A nested destructure names no prop of its own beyond the outer key.
        used.push(m[1]);
        continue;
      }
      const plain = part.match(/^\s*(\w+)/);
      if (plain) used.push(plain[1]);
    }
  }

  // And the declared type, which carries props the destructuring passes through.
  // Bounded the same way: the inline form has to sit inside this function's parens,
  // or a private subcomponent further down the file supplies it instead. The named
  // form has to be THIS component's — `\w*Props` took the first such type anywhere in
  // the file, so a helper's `FooProps` above the export would have been read instead.
  const named = clean.match(new RegExp('export type ' + escaped + 'Props\\s*='));
  const inline = params === null ? -1 : params.search(/\}\s*:\s*\{/);
  const body = named
    ? literal(clean, named.index)
    : inline === -1
      ? null
      : literal(params, inline + 1);
  if (body === null) return [...new Set(used)];

  const out = used.slice();
  let depth = 0;
  let atTop = true;
  let word = '';
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (depth === 0) {
      if (/[A-Za-z0-9_]/.test(ch)) {
        word += ch;
        continue;
      }
      if ((ch === ':' || (ch === '?' && body[i + 1] === ':')) && atTop && word) out.push(word);
      if (ch === ';' || ch === ',' || ch === '\n') {
        atTop = true;
        word = '';
        continue;
      }
      if (ch !== ' ' && ch !== '?') atTop = false;
      word = '';
      continue;
    }
    word = '';
  }
  return [...new Set(out)];
}

/**
 * Everything `measure.mjs` read off the app, which is the rest of the kit.
 *
 * Thirteen components are described by hand above and stay that way, for one
 * reason that is not sentiment: they carry Figma component properties, and the
 * sixty-three instances `use-kit.mjs` put in the screens override text through
 * them. A measured description has no properties — nothing in a rendering says
 * which text a designer should be able to change — so swapping them out would
 * leave every "Button, Anmelden" on the board without its label.
 *
 * What the measurement does for those thirteen instead is check them. The badge's
 * label was bold here and regular in the app for as long as this file has existed,
 * and nothing could have noticed.
 */
const measured = JSON.parse(await readFile(join(HERE, 'measured.json'), 'utf8'));

const byHand = {};
for (const entry of KIT) byHand[entry.name] = entry;

/**
 * The fields a difference in would be visible, and the ones a rendering can answer.
 *
 * `gap` is not among them: the app writes the space between two children as a margin
 * on one of them, which the measurement turns into a `space` node, so the two
 * descriptions say the same thing in different words and comparing them reports a
 * difference on every row.
 */
const COMPARED = ['dir', 'pad', 'radius', 'fill', 'stroke', 'strokeSides'];

/**
 * What a node SAYS, in one shape, so two descriptions of it can be held side by side.
 *
 * A `line` spells its colour `color` where a frame spells it `fill`, and a box with
 * nothing in it lays nothing out, so its `dir` says nothing about the drawing either.
 * Normalising both sides once is what keeps this about values rather than spellings.
 */
function fields(node) {
  const leaf = (node.children ?? []).length === 0;
  return {
    dir: leaf ? undefined : node.dir,
    pad: node.pad,
    radius: node.radius,
    fill: node.fill ?? node.color,
    stroke: node.stroke,
    strokeSides: node.strokeSides,
  };
}

/** A text node and a box have no field in common worth comparing. */
function kind(node) {
  return (node.t ?? 'frame') === 'text' ? 'text' : 'box';
}

/**
 * `@spacing-2xs` and `6` are the same padding, so compare values and not spellings.
 *
 * Only the scales: a colour is a token name on both sides already, and resolving one
 * to a hex would make `accent` and `red-500` compare equal, which is the difference
 * the measurement went to some trouble to keep.
 */
function resolved(value) {
  if (Array.isArray(value)) return value.map(resolved);
  if (typeof value !== 'string' || value.charAt(0) !== '@') return value;
  const name = value.slice(1);
  return /^(spacing|radius)-/.test(name) ? px(name) : value;
}

function differences(hand, seen, where, out) {
  // Step through a ground the app does not paint. `ui/Hairline` is described here as
  // a `line` inside a 280px frame the colour of the page, because a component that
  // IS one pixel of `stroke` cannot be picked up on the board; the app's Hairline is
  // that line and nothing else, so the measurement's root is the line. Comparing the
  // two roots reported the ground's colour as drift in the component, which is worse
  // than reporting nothing: a line that is wrong teaches the reader to skip the ones
  // that are not.
  if ((seen.children ?? []).length === 0 && (hand.children ?? []).length === 1) {
    hand = hand.children[0];
  }
  if (kind(hand) !== kind(seen)) return;
  const ours = fields(hand);
  const theirs = fields(seen);
  for (const key of COMPARED) {
    if (key === 'fill' && ours[key] !== undefined && theirs[key] === undefined) continue;
    const a = JSON.stringify(resolved(ours[key]));
    const b = JSON.stringify(resolved(theirs[key]));
    if (a !== b) out.push(`${where}.${key}: drawn ${a ?? 'nothing'}, measured ${b ?? 'nothing'}`);
  }
  const handText = (hand.children || []).filter((c) => c.t === 'text');
  const seenText = (seen.children || []).filter((c) => c.t === 'text');
  for (const [i, one] of handText.entries()) {
    const other = seenText[i];
    if (other === undefined) continue;
    for (const key of ['size', 'weight']) {
      const a = one[key] ?? (key === 'weight' ? 'regular' : undefined);
      const b = other[key] ?? (key === 'weight' ? 'regular' : undefined);
      if (a !== b) out.push(`${where} text ${i}.${key}: drawn ${a}, measured ${b}`);
    }
  }
}

const drift = [];
for (const [name, entry] of Object.entries(measured)) {
  const hand = byHand[name];
  if (hand === undefined) continue;
  const ours = hand.options ?? [hand];
  const theirs = entry.options ?? (Array.isArray(entry) ? entry : [entry]);
  // By variant value where there is one, because the hand-written order is this
  // file's and the measured order is the catalogue's, and lining them up by index
  // would report a difference for every option whenever the two disagree.
  const seen = {};
  for (const [i, one] of theirs.entries()) seen[one.value ?? i] = one;
  for (const [i, one] of ours.entries()) {
    const other = seen[one.value ?? i];
    if (other !== undefined) differences(one, other, `${name}[${one.value ?? i}]`, drift);
  }
}

// Everything the hand-written list does not already carry, drawn from what the app
// actually renders.
const fromMeasurement = [];
for (const [name, entry] of Object.entries(measured)) {
  if (byHand[name] !== undefined) continue;
  for (const one of Array.isArray(entry) ? entry : [entry]) {
    KIT.push(one);
    fromMeasurement.push(one.name);
  }
}

const problems = [];
const gaps = [];

/**
 * A scale name in a numeric position has to name a number.
 *
 * The interpreter resolves `@spacing-2xs` to six before it draws, and a name the
 * table does not have resolves to nothing — which reaches Figma as a string where
 * it wants a number and stops the draw dead, halfway down a page, with the console
 * inside Figma as the only witness. `gap-y-2xs` produced exactly that: the class
 * names an axis, the token does not, and `@spacing-y-2xs` is nobody.
 *
 * Cheap to check here and expensive to find there, which is the whole argument.
 */
// The same positions `resolveScales` resolves in `code.js`, and the two lists have to
// stay the same list: a position the interpreter resolves and this does not check is
// a position where a bad name reaches Figma, which is the failure this exists to stop.
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

function checkScales(node, where) {
  if (Array.isArray(node)) {
    for (const [i, child] of node.entries()) checkScales(child, `${where}[${i}]`);
    return;
  }
  if (node === null || typeof node !== 'object') return;
  const named = (value) => typeof value === 'string' && value.charAt(0) === '@';
  const number = (value) => {
    // `px` throws on a name the stylesheet has not got, which is the answer here.
    try {
      return Number.isFinite(px(value.slice(1)));
    } catch {
      return false;
    }
  };
  for (const key of NUMERIC) {
    if (named(node[key]) && !number(node[key])) {
      problems.push(`${node.name ?? where}.${key} is "${node[key]}", which names no number`);
    }
  }
  for (const [i, one] of (Array.isArray(node.pad) ? node.pad : []).entries()) {
    if (named(one) && !number(one)) {
      problems.push(`${node.name ?? where}.pad[${i}] is "${one}", which names no number`);
    }
  }
  for (const key of Object.keys(node)) checkScales(node[key], `${where}.${key}`);
}

for (const entry of KIT) {
  const plan = AUDIT[entry.name];
  if (plan === undefined) continue;
  const source = await readFile(
    join(ROOT, 'apps/mobile/src/components', entry.name + '.tsx'),
    'utf8',
  );

  // Which Figma properties this entry actually has, variant property included.
  const has = {};
  for (const name of Object.keys(entry.props || {})) has[name] = true;
  if (entry.prop) has[entry.prop] = true;

  const found = sourceProps(source, entry.name.slice(entry.name.indexOf('/') + 1));
  // An empty list is indistinguishable from "no props", so the loop below would pass
  // having checked nothing. A component the audit claims to map must have props.
  if (found.length === 0 && Object.keys(plan.maps).length > 0) {
    problems.push(`${entry.name}: read no props at all, but the audit maps some`);
  }
  for (const prop of found) {
    if (NEVER_VISUAL.indexOf(prop) !== -1 && plan.gaps?.[prop] === undefined) continue;
    // A handler is behaviour; the board draws no behaviour.
    if (/^on[A-Z]/.test(prop)) continue;
    if ((plan.ignore || []).indexOf(prop) !== -1) continue;
    if (plan.gaps?.[prop] !== undefined) {
      gaps.push(`${entry.name}.${prop}: ${plan.gaps[prop]}`);
      continue;
    }
    const to = plan.maps[prop];
    if (to === undefined) {
      problems.push(`${entry.name}.${prop} is neither a Figma property nor a declared gap`);
      continue;
    }
    for (const one of Array.isArray(to) ? to : [to]) {
      if (has[one] !== true)
        problems.push(`${entry.name}.${prop} points at "${one}", which does not exist`);
    }
  }
}

// ---------------------------------------------------------------- the page
//
// Laid out by hand rather than by a grid: a variant set grows downwards with its
// options, so a column that fits `ui/Typo` (eleven of them) wastes a screen on
// `ui/Hairline`. Three columns, each with its own running y.

/**
 * One wrapping row, and Figma does the packing.
 *
 * Three hand-set columns fitted thirteen entries. Then a run of guessed heights
 * (`120 + options * 90`) tried to pack fifty-two and produced a page of components
 * lying on top of one another, because the guess is nowhere near a real size: an
 * `ArticleRow` is four hundred wide and the type sheet is a screen tall, and neither
 * number exists before Figma has drawn them.
 *
 * So nothing here says where anything goes. The kit is one auto-layout frame with
 * `WRAP`, a fixed width and generous gaps; every entry hugs its own content and
 * Figma flows them. `owned: '*'` still sweeps the page, and now there is one child
 * to sweep.
 */
const board = {
  t: 'frame',
  name: 'Kit',
  dir: 'H',
  wrap: true,
  w: 4400,
  gap: 72,
  crossGap: 96,
  cross: 'MIN',
  pad: [64, 64, 64, 64],
  children: KIT,
};

// The board and not only its children, so the frame that packs them is checked too,
// and the text styles, whose `size` is a numeric position outside any page.
checkScales(board, 'kit');
checkScales(TEXT_STYLES, 'textStyles');

/**
 * A kit entry has to BE a component, or nothing on the board can point at it.
 *
 * `t` decides which constructor runs, and a frame draws exactly like a component
 * until somebody tries to instance it. The measured entries said `frame` for a
 * while and looked perfectly right on the page: fifty-two things that no screen
 * could ever use. The variant sets said it too, and that one at least announced
 * itself, with `combineAsVariants` refusing a set whose children are not
 * components — halfway down the page, from inside Figma.
 */
for (const entry of KIT) {
  if (entry.t === 'component' || entry.t === 'variants') continue;
  // The one deliberate exception, and it says so in its own name.
  if (entry.name === 'ui/Typo, Textstile') continue;
  problems.push(`${entry.name} is a "${entry.t}", so nothing can instance it`);
}

// Refuse BEFORE writing, for the same reason `use-kit.mjs` does: throwing after the
// file is on disk stops the script and not the damage, and ADR 0021 claims this fails
// rather than emitting a kit that is quietly incomplete.
for (const gap of gaps) console.log(`  gap: ${gap}`);
for (const line of drift) console.log(`  drift: ${line}`);
if (fromMeasurement.length > 0) {
  console.log(
    `  ${fromMeasurement.length} components drawn from the measurement, with no prop` +
      ` accounting yet: ${fromMeasurement.join(', ')}`,
  );
}
if (problems.length > 0) {
  for (const problem of problems) console.error(`  MISSING: ${problem}`);
  throw new Error(`${problems.length} prop(s) the kit does not account for`);
}

const spec = JSON.parse(await readFile(SPEC, 'utf8'));
spec.textStyles = TEXT_STYLES;

// The wireframe rendering went on 2026-09-10, and its two pages with it: this file
// used to write the kit twice, once per mode, and `Wireframes` held the screens as a
// pencil sketch. `code.js` no longer knows what a mode is.
spec.pages = (spec.pages || []).filter((p) => p.name !== PAGE && p.mode !== 'wireframe');
for (const page of spec.pages) delete page.mode;

spec.pages.push({
  name: PAGE,
  // The kit is the only thing on this page, so it sweeps itself rather than naming
  // what it made: a component that loses its name would otherwise stay.
  owned: '*',
  screens: [board],
});
await writeFile(SPEC, `${JSON.stringify(spec, null, 2)}\n`);

const sets = board.children.filter((s) => s.t === 'variants');
console.log(
  `${board.children.length} components on "${PAGE}" (${sets.length} variant sets, ` +
    `${sets.reduce((n, s) => n + s.options.length, 0)} variants), ` +
    `${TEXT_STYLES.length} text styles`,
);
