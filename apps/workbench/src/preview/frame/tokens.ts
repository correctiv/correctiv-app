import { colors, colorsDark } from '@correctiv/design-tokens/tokens.generated';
import type { ColorToken } from '@correctiv/design-tokens/tokens.generated';

/**
 * Recolouring the running app without a rebuild.
 *
 * The colour utilities in the built stylesheet all read a custom property
 * (`.bg-grey-100{background-color:var(--color-grey-100)}`), so redefining the
 * property recolours every surface and border in the app at once, in place.
 *
 * **It does not recolour text, and that is not a bug here.** This app splits
 * colour deliberately: backgrounds and borders come from classes, while text and
 * icons go through `useColors()`, which hands React Native a resolved hex that
 * lands in an inline style (`apps/mobile/src/lib/theme/useColors.ts`). A CSS
 * variable cannot reach a value that was resolved in JavaScript before the
 * element was created. The `text` pass below chases those inline values by their
 * serialised form, which works and is still a best effort: it can only recolour a
 * value it can recognise, and a re-render writes the inline style again.
 *
 * Nothing here is written back anywhere. `tokens/theme.css` is vendored from
 * `wp-design-tokens` and stays the source of truth; what this produces is a
 * proposal, which `asCss()` formats for a human to carry upstream.
 */
export type Scheme = 'light' | 'dark';

export type Overrides = Partial<Record<ColorToken, Partial<Record<Scheme, string>>>>;

const STYLE_ID = 'preview-token-override';

export const PALETTE: Record<Scheme, Record<ColorToken, string>> = {
  light: colors,
  dark: colorsDark,
};

export const TOKENS = Object.keys(colors) as ColorToken[];

/** `#ff5064` as `rgb(255, 80, 100)`, the form a computed style comes back in. */
export function toRgb(hex: string): string | null {
  const m = /^#([\da-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * The rules, as one stylesheet.
 *
 * `html.light` / `html.dark` rather than `:root`: Uniwind's own definitions are
 * unlayered and specificity (0,1,0) (`:scope:where(.dark, .dark *)`), so a
 * class-qualified selector on the same element beats them at (0,1,1) without
 * needing `!important`. On web the app always carries exactly one of those two
 * classes on `<html>`, so the `prefers-color-scheme` half of the token CSS never
 * runs and does not have to be matched here.
 */
function css(overrides: Overrides, includeText: boolean): string {
  const blocks: string[] = [];

  for (const scheme of ['light', 'dark'] as Scheme[]) {
    const declarations = TOKENS.filter((token) => overrides[token]?.[scheme])
      .map((token) => `--color-${token}:${overrides[token]![scheme]!}`)
      .join(';');
    if (declarations) blocks.push(`html.${scheme}{${declarations}}`);
  }

  if (includeText) {
    for (const scheme of ['light', 'dark'] as Scheme[]) {
      for (const token of TOKENS) {
        const next = overrides[token]?.[scheme];
        const before = toRgb(PALETTE[scheme][token]);
        if (!next || !before) continue;
        // The inline style React wrote, matched by its serialised text. Anything
        // this misses simply keeps its old colour, which is visible and honest.
        blocks.push(`html.${scheme} [style*="color: ${before}"]{color:${next} !important}`);
      }
    }
  }

  return blocks.join('\n');
}

export function apply(win: Window | null, overrides: Overrides, includeText: boolean): void {
  const doc = win?.document;
  if (!doc) return;
  const style = doc.getElementById(STYLE_ID) ?? doc.createElement('style');
  style.id = STYLE_ID;
  // Appended, and on every later pass re-appended, so it stays last: unlayered
  // rules of equal specificity are settled by document order.
  doc.head.append(style);
  style.textContent = css(overrides, includeText);
}

/** What a person carries upstream to `wp-design-tokens`, not what we write. */
export function asCss(overrides: Overrides): string {
  const lines: string[] = [];
  for (const scheme of ['light', 'dark'] as Scheme[]) {
    const changed = TOKENS.filter((t) => overrides[t]?.[scheme]);
    if (!changed.length) continue;
    lines.push(`/* ${scheme} */`);
    for (const token of changed) {
      lines.push(
        `  --color-${token}: ${overrides[token]![scheme]!}; /* was ${PALETTE[scheme][token]} */`,
      );
    }
  }
  return lines.join('\n');
}
