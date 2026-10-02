import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../plugin/collect.ts';

import { cn, CONTAINER_WIDTHS, LEADINGS, RADII, SPACING_SCALE, TEXT_SIZES } from '../src/lib/cn';

/**
 * The theme is the source of truth and the block at the foot of this file is the
 * ratchet: a scale key the theme gains fails there, rather than landing as a class the
 * merge cannot reason about and a layout nobody was looking at.
 *
 * Read off the GENERATED Tailwind theme, `packages/design-tokens/theme.css`, because that
 * is the file `styles/app.css` imports and the one Tailwind turns into utilities — the
 * root `tokens/theme.css` speaks the design system's own names (`--var-spacing-xs`,
 * `--headline-m`) and mapping them here would be a second copy of what
 * `packages/design-tokens/scripts/generate.mjs` already does. That the generated file is
 * itself current is `packages/design-tokens/test/drift.test.ts`'s job.
 */
const THEME_CSS = readFileSync(join(ROOT, 'packages/design-tokens/theme.css'), 'utf8');

/** Every `--<namespace>-<key>:` the theme declares, as the key alone. */
function declared(namespace: string): string[] {
  return [...THEME_CSS.matchAll(new RegExp(`^\\s*--${namespace}-([a-z0-9-]+):`, 'gm'))].map(
    (match) => match[1],
  );
}

/**
 * Issue #249: `tailwind-merge` read this project's `text-s` as a colour and dropped it
 * whenever a colour class followed, so a note meant to be small rendered at the size of
 * the text around it. Nothing failed, because the class was written correctly in the
 * source; the merge is what took it out.
 */
describe('cn', () => {
  it('keeps a project text size beside a colour', () => {
    expect(cn('text-s leading-relaxed text-on-canvas')).toBe(
      'text-s leading-relaxed text-on-canvas',
    );
  });

  it('still lets a later colour win over an earlier one', () => {
    expect(cn('text-s text-on-canvas-muted', 'text-on-canvas')).toBe('text-s text-on-canvas');
  });

  it('lets a later project size win over an earlier one', () => {
    expect(cn('text-m text-on-canvas', 'text-s')).toBe('text-on-canvas text-s');
  });

  it('keeps a leading written before a size', () => {
    expect(cn('leading-relaxed text-s')).toBe('leading-relaxed text-s');
  });

  /*
   * The same hazard in its second shape, measured: `padding-left` on an icon segment was
   * 10px and its glyph sat 4px right of the middle of its own box, because `px-xs` was a
   * class the merge had no opinion about and `p-0` had nothing to displace. Fixed at the
   * root in `lib/cn.ts`, so both shapes are named once and the component that carried
   * the second (`ui/kit/segmented.tsx`) overrides its base padding like any other.
   */
  it('lets a padding of none displace the theme scale it follows', () => {
    expect(cn('px-xs py-3xs', 'p-0')).toBe('p-0');
  });

  it('lets the theme scale displace a Tailwind default it follows', () => {
    expect(cn('p-4', 'p-xs')).toBe('p-xs');
  });

  it('keeps a padding on the other axis beside one on this one', () => {
    expect(cn('p-0', 'py-3xs')).toBe('p-0 py-3xs');
  });

  it('lets the narrower padding displace the wider one before it', () => {
    expect(cn('px-s', 'pl-xs')).toBe('px-s pl-xs');
    expect(cn('pl-xs', 'px-s')).toBe('px-s');
  });

  /*
   * A colour and a size share the `text-` prefix, so the pair is the one that cannot be
   * written blind — and it is why `text-headline-*` is in the size scale at all. The
   * headline sizes reach a class as `text-headline-m` beside a `text-on-canvas`, exactly
   * as `text-s` does, and six of them are in use across the site.
   */
  it('reads a headline size as a size, not as a colour', () => {
    expect(cn('text-headline-m text-on-canvas', 'font-semibold')).toBe(
      'text-headline-m text-on-canvas font-semibold',
    );
  });

  /*
   * The reading measures, which are `--container-*` in the theme and `max-w-*` in a class.
   * They are the one scale `lib/cn.ts` types rather than derives, so this is the case that
   * would go stale first if the theme grew a third one.
   */
  it('lets a later reading measure win over an earlier one', () => {
    expect(cn('max-w-content', 'max-w-wide')).toBe('max-w-wide');
  });
});

describe('the scales cn knows', () => {
  /*
   * The three whose merge is observable: a Tailwind default from the same group goes and
   * the theme's key stays. This also proves each list is WIRED into the merge rather than
   * merely exported from `lib/cn.ts` — a scale listed there and left out of
   * `extendTailwindMerge` would pass the comparison further down and fail these.
   */
  const displacable: {
    namespace: string;
    keys: readonly string[];
    sameGroup: string;
    prefix: string;
  }[] = [
    { namespace: 'spacing', keys: SPACING_SCALE, sameGroup: 'p-4', prefix: 'p-' },
    { namespace: 'leading', keys: LEADINGS, sameGroup: 'leading-normal', prefix: 'leading-' },
    {
      namespace: 'container',
      keys: CONTAINER_WIDTHS,
      sameGroup: 'max-w-2xl',
      prefix: 'max-w-',
    },
  ];

  it.each(displacable)(
    'lets every $namespace key displace a Tailwind default from the same group',
    ({ keys, sameGroup, prefix }) => {
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(cn(sameGroup, prefix + key)).toBe(prefix + key);
      }
    },
  );

  /*
   * The font sizes have no such pair, and the reason is the override in `lib/cn.ts`: no
   * size conflicts with anything, so two sizes beside each other both stay whatever the
   * config says. What IS observable is the shape above them, and a key the merge does not
   * know is a COLOUR to it — which is issue #249 for each of the eleven rather than for
   * one of them.
   */
  it('reads every size as a size and none of them as a colour', () => {
    expect(TEXT_SIZES.length).toBeGreaterThan(0);
    for (const key of TEXT_SIZES) {
      expect(cn(`text-${key}`, 'text-on-canvas')).toBe(`text-${key} text-on-canvas`);
    }
  });

  it.each([...displacable, { namespace: 'text', keys: TEXT_SIZES }])(
    'knows exactly the $namespace keys the theme declares',
    ({ namespace, keys }) => {
      const themeKeys = declared(namespace);
      expect(themeKeys.length).toBeGreaterThan(0);
      expect([...keys].sort()).toEqual(themeKeys.sort());
    },
  );

  /*
   * The three namespaces left out of the config on purpose, and this is what says so.
   * Tracking and font weight are the plain case: Tailwind knows every key this theme
   * declares for them, so a merge configured with them would add nothing, and the lists
   * above are only worth reading if the omission is the measured one rather than the
   * remembered one.
   */
  it('needs no configuration for the scales Tailwind already knows whole', () => {
    expect(declared('tracking')).toEqual(['tighter', 'tight', 'normal', 'wide', 'wider']);
    expect(declared('font-weight')).toEqual(['normal', 'semibold', 'bold']);
    expect(cn('tracking-wider tracking-tight')).toBe('tracking-tight');
    expect(cn('font-semibold font-bold')).toBe('font-bold');
  });

  /*
   * The radius scale is the third, and all three of its names are Tailwind's own: `xs`,
   * `sm` and `md`. The middle one was `s` until ADR 0077, which renamed it because in
   * Tailwind v4 `rounded-s` is the START SIDE — a class of another kind, with a group of
   * its own in the merge, so it could never be taught here. The theme emitted that same
   * class name for the token beside it, and two rules for one class is a collision in the
   * theme; this is what says the scale is spelt the way Tailwind spells it now.
   */
  it('needs no configuration for a radius scale Tailwind spells the same way', () => {
    expect([...RADII].sort()).toEqual([...declared('radius')].sort());
    expect(cn('rounded-full', 'rounded-xs')).toBe('rounded-xs');
    expect(cn('rounded', 'rounded-sm')).toBe('rounded-sm');
    expect(cn('rounded', 'rounded-md')).toBe('rounded-md');
  });

  /*
   * The premise of the `font-size` override: a size takes no leading with it, so no size
   * may displace one. A `--text-X--line-height` would break that, and it would break it in
   * the merge rather than in the layout, so the check sits with the derivation that would
   * produce it.
   */
  it('declares no size that carries a line height of its own', () => {
    expect(declared('text').filter((key) => key.includes('--line-height'))).toEqual([]);
  });
});
