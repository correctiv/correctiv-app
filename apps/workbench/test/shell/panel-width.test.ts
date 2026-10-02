import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../../plugin/collect.ts';
import { panelWidthOf, VIEWS, type ViewDeclaration } from '../../src/shell/views.ts';
import { DEFAULT_DEVICE, preset } from '../../src/preview/devices.ts';
import { GUTTER, rowWidth } from '../../src/preview/home/fit.ts';

/**
 * How wide the right panel opens, and the two things that are not a matter of taste.
 *
 * **The layout editor asks for pixels and the number is made of three parts**, and
 * this is the check that holds them together. ADR 0045 §3 says a block in the list
 * draws at the phone's own width and scales DOWN to fit, never up — so the list's
 * width is a fact about the drawing, and a panel that is thirty-one per cent of
 * whatever window it is in gives it a row with a phone standing in the middle of it.
 * At the 2000×1228 window this was measured at, thirty-one per cent is 620px for a
 * 393px drawing, and 443 is the drawing plus the gutter beside it plus the panel's
 * own padding: the narrowest width at which the drawing fills its row exactly, which
 * is what leaves `fit()`'s centring nothing to do.
 *
 * **The bounds are the panel's, and a pixel default has to fit inside them.** A
 * `defaultSize` larger than `maxSize` is not an error; it is clamped, silently, and
 * the tool opens at a width its own declaration did not ask for. The narrowest window
 * the docked panel exists at is 64rem (`lib/useMedia.ts`'s `WIDE`), so that is where
 * the largest declared share is checked.
 *
 * `GUTTER` is imported rather than written here because this is the one place the
 * number in `shell/views.ts` is compared with what the drawing is made of; a second
 * copy of the gutter in this file would be a second thing to edit, which is the
 * whole thing the comparison exists to prevent.
 */
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

/** `--var-spacing-s` out of the vendored token file, in the rem the kit writes it in. */
function spacing(token: string): number {
  const at = new RegExp(`--var-${token}:\\s*([\\d.]+)rem`).exec(read('tokens/theme.css'));
  if (at === null) throw new Error(`tokens/theme.css has no --var-${token}`);
  return Number(at[1]) * 16;
}

const PHONE = preset(DEFAULT_DEVICE).w;
const PANEL_PADDING = 2 * spacing('spacing-s');
/** `shell/views.ts` writes `443`. */
const DECLARED = 443;

describe('the layout tool’s own panel width', () => {
  it('is the phone’s width plus the gutter beside the drawing and the panel’s padding', () => {
    expect(panelWidthOf(VIEWS.preview, 'home')).toBe(DECLARED);
    expect(DECLARED).toBe(rowWidth(PHONE) + PANEL_PADDING);
    // And each of those three is a number that belongs somewhere rather than a shape
    // somebody liked: the phone the tool opens at, the gutter the rows are drawn with,
    // and the padding `SlotTarget` puts on every tool.
    expect(PHONE).toBe(393);
    expect(GUTTER).toBe(26);
    expect(PANEL_PADDING).toBe(24);
  });

  it('leaves the other tools of the same view where ADR 0038 put them', () => {
    // A console of lines and a tokens table both want a share of the window; only
    // this one draws something with a size of its own.
    for (const tool of VIEWS.preview.sections.filter((id) => id !== 'home')) {
      expect(panelWidthOf(VIEWS.preview, tool)).toBe('31%');
    }
  });

  it('is a default and not a rule: a drag wins, and so does a shut panel’s own view', () => {
    // `App.tsx` asks for the dragged width first and this only when nothing has been
    // dragged, so the declaration is what an untouched panel opens at.
    expect(panelWidthOf(VIEWS.preview, null)).toBe(VIEWS.preview.panelWidth);
  });

  it('asks for a pixel width nowhere else, so no other tool is clamped by its own bounds', () => {
    // `WIDE` is `(min-width: 64rem)`, and the panel's own `maxSize` is 55% of the
    // group. A pixel default above that share is clamped without a word.
    const narrowestWide = 64 * 16;
    const clamped: string[] = [];
    for (const view of Object.values(VIEWS)) {
      for (const tool of [...view.sections, null]) {
        const width = panelWidthOf(view, tool);
        if (typeof width !== 'number') continue;
        if (width > narrowestWide * 0.55) clamped.push(`${view.kind}/${tool ?? '-'}: ${width}`);
        // And below the floor, which is the same clamp in the other direction.
        else if (width < narrowestWide * 0.14)
          clamped.push(`${view.kind}/${tool ?? '-'}: ${width}`);
      }
    }
    expect(clamped).toEqual([]);
  });
});

describe('every view’s declaration', () => {
  it('gives every tool a width it can open at', () => {
    const silent: string[] = [];
    for (const view of Object.values(VIEWS)) {
      if (view.sections.length === 0) continue;
      const asDeclaration: ViewDeclaration = view;
      for (const tool of view.sections) {
        const width = panelWidthOf(asDeclaration, tool);
        if (width === undefined || width === '') silent.push(`${view.kind}/${tool}`);
      }
    }
    expect(silent).toEqual([]);
  });
});
