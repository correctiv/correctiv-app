import { fontSizePx } from '@correctiv/design-tokens/tokens.generated';
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * This project's text sizes, as the suffix a class carries: `s` for `text-s`.
 *
 * `tailwind-merge` knows Tailwind's own sizes and none of these, and a `text-*` class it
 * does not know it takes for a COLOUR. So `text-s leading-relaxed text-on-canvas-muted`
 * was two colours to it, the later one won, and the size was dropped without a word:
 * issue #249, and the setting description in the block popover that rendered a size
 * larger than the rest of the panel.
 *
 * Derived rather than typed. `tokens/theme.css` declares `--text-X` for each
 * `--var-font-size-text-X`, and the generated `fontSizePx` is keyed by the same names, so
 * the sizes Tailwind makes utilities of are the `text-` keys of that table. The headline
 * sizes there are `--headline-*` in the theme, not `--text-*`, so Tailwind draws no
 * `text-headline-*` and they are left out. `test/cn.test.ts` holds this list to the CSS.
 */
export const TEXT_SIZES: readonly string[] = Object.keys(fontSizePx)
  .filter((key) => key.startsWith('text-'))
  .map((key) => key.slice('text-'.length));

/*
 * And a size does not take a leading out. `tailwind-merge` assumes it does, because
 * Tailwind's own `text-sm` sets a line height too, so `leading-relaxed text-s` would have
 * lost its leading. This theme declares no `--text-X--line-height`, so `text-s` compiles to
 * a font size and nothing else, and the workbench uses none of Tailwind's own sizes.
 */
const merge = extendTailwindMerge({
  extend: {
    theme: { text: [...TEXT_SIZES] },
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
