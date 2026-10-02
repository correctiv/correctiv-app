import {
  fontSizePx,
  leading,
  radiusPx,
  spacingPx,
} from '@correctiv/design-tokens/tokens.generated';
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The scale keys this theme adds to Tailwind's, as the suffix a class carries:
 * `xs` for `p-xs`, `article` for `text-article`.
 *
 * `tailwind-merge` merges against Tailwind's OWN scale and against nothing else,
 * and a class whose key it does not know lands in no conflict group at all. So it
 * cannot displace anything and nothing can displace it, and the winner of a pair
 * like `px-xs` and `p-0` is whatever order Tailwind emitted the two CSS rules in.
 * Issue #249 is one shape of this and `ui/kit/segmented.tsx` carried the second:
 * a `text-*` class it does not know it takes for a COLOUR, so `text-s` vanished
 * before `text-on-canvas-muted` without a word, and an icon segment's `p-0` lost
 * to the `px-xs py-3xs` beside it. Both were written correctly in the source; the
 * merge is what took them out.
 *
 * So the scales are named here, and the merge is configured with them. Derived
 * rather than typed, out of the same generated tables the tokens themselves come
 * from: `packages/design-tokens/scripts/generate.mjs` writes `--spacing-X`,
 * `--text-X`, `--leading-X` and `--container-X` into the Tailwind theme it emits, and it
 * writes the tables this reads the first three from out of the same tokens in the
 * same pass, so the two cannot drift without `packages/design-tokens/test/drift.test.ts`
 * noticing first. `test/cn.test.ts` holds every list to the generated theme CSS, so a key
 * the theme gains fails there rather than in a layout nobody was looking at.
 *
 * Only the scales where a key of this theme's is missing from Tailwind's, and only
 * where that costs something. Three namespaces are deliberately absent, and
 * `test/cn.test.ts` says so against the merge rather than in a comment alone:
 * `--tracking-*` and `--font-weight-*`, whose keys Tailwind knows in full, and
 * `--radius-*`, where two of the three names (`xs`, `md`) are Tailwind's own and the
 * third — `rounded-s` — is the START SIDE in Tailwind v4, not a radius, so it is a class
 * the merge already has a group for. See the note on `RADII` below.
 */
export const TEXT_SIZES: readonly string[] = Object.keys(fontSizePx).map((key) =>
  /*
   * The token carries its own prefix for the five body sizes (`text-s` in the
   * theme, so `text-text-s` never happens) and not for the six headline ones,
   * which the generator flattens into the same `--text-*` namespace. `text-`
   * therefore goes wherever it is there, and `text-headline-m` is a size the
   * merge knows, not a colour it lost.
   */
  key.replace(/^text-/, ''),
);

/** `--spacing-4xs … --spacing-4xl`, the thirteen steps. */
export const SPACING_SCALE: readonly string[] = Object.keys(spacingPx);

/**
 * `--radius-xs … --radius-md`, read out so `test/cn.test.ts` can hold the theme, and
 * deliberately NOT given to the merge.
 *
 * `xs` and `md` are Tailwind v4 radius values already, so `cn('rounded-full',
 * 'rounded-xs')` displaces without being told. `s` cannot be registered at all: in
 * Tailwind v4 `rounded-s` is the start side, a class of its own with a group in the
 * merge, and the theme's `--radius-s` emits the same class name beside it — two rules,
 * `border-radius: var(--radius-s)` and `border-start-*-radius: var(--radius)`, which
 * `--radius: initial` leaves at zero. That is a collision in the theme and not in the
 * merge, and it is worth a record of its own; what matters here is that adding `s` to
 * the radius scale changes nothing measurable, so it is left out rather than pretended
 * at.
 */
export const RADII: readonly string[] = Object.keys(radiusPx);

/** `--leading-tighter … --leading-looser`, which is `leading-*` in a class. */
export const LEADINGS: readonly string[] = Object.keys(leading);

/**
 * `--container-content` and `--container-wide`, the two reading measures, which
 * reach a class as `max-w-content`.
 *
 * The one scale here that is typed, because it is the one the generator writes
 * into the theme and nowhere else: there is no `containerPx` table beside
 * `spacingPx` to derive it from. Two names, held to the theme by `test/cn.test.ts`
 * like the derived ones.
 */
export const CONTAINER_WIDTHS: readonly string[] = ['content', 'wide'];

/*
 * And a size does not take a leading out. `tailwind-merge` assumes it does, because
 * Tailwind's own `text-sm` sets a line height too, so `leading-relaxed text-s` would have
 * lost its leading. This theme declares no `--text-X--line-height`, so `text-s` compiles to
 * a font size and nothing else, and the workbench uses none of Tailwind's own sizes.
 */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      text: TEXT_SIZES,
      spacing: SPACING_SCALE,
      leading: LEADINGS,
      container: CONTAINER_WIDTHS,
    },
  },
  override: {
    conflictingClassGroups: { 'font-size': [] },
  },
});

/**
 * Joins class names and lets a later one win over an earlier one.
 *
 * The second half is the point. Every component here takes a `className` so a
 * caller can adjust it, and without `twMerge` a caller passing `p-0` next to a
 * component's own `p-4` gets both, with the winner decided by the order Tailwind
 * happened to emit them in. This is the function shadcn's components expect to
 * find, which is why it has that name.
 */
export function cn(...inputs: ClassValue[]): string {
  return merge(clsx(inputs));
}
