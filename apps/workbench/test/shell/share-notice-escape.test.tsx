/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { inBar, mountBar, onPage, unmountBar } from './share-notice-harness.tsx';

/**
 * Escape takes the too-long notice down, and the warning is folded with it.
 *
 * **Its own file, and its own open, because that is all it needs.** Opening Radix's
 * `Popover` costs seconds in this jsdom and every open after the first in a file costs
 * more: measured on 2026-10-03, 2.8 s for the first open in a file and 10.7 s for the
 * second. `share-notice-anchor.test.tsx` keeps the one open that everything about the
 * panel's own shape wants; this and `share-notice-outside.test.tsx` take one each for the
 * two ways out that cannot share an open with it.
 *
 * What is and is not asserted, stated plainly because a browser would do better: that the
 * panel GOES AWAY, which the DOM can say, and that the warning is folded with it, so a
 * tool that hands over the same news on every render cannot put the panel back.
 */
afterEach(unmountBar);

describe('the too-long notice goes away', () => {
  it('on Escape, and the warning is folded with it', () => {
    mountBar({
      dirty: true,
      share: { run: () => {}, warning: { text: 'Too long for a link.' } },
    });
    act(() => inBar('action-share')!.click());
    expect(onPage('share-warning-close')).not.toBeNull();

    // On the document, where Radix listens: the panel's key handling is a document
    // listener in the capture phase, not an onKeyDown on the panel.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onPage('share-warning-close')).toBeNull();
    expect(inBar('share-anchor')?.getAttribute('aria-expanded')).toBe('false');

    // Folded: the same warning does not come back on the next press.
    act(() => inBar('action-share')!.click());
    expect(onPage('share-warning-close')).toBeNull();
  });
});
