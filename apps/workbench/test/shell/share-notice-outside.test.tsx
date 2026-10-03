/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { inBar, mountBar, onPage, unmountBar } from './share-notice-harness.tsx';

/**
 * A press outside takes the too-long notice down.
 *
 * **Its own file, and its own open, because that is all it needs.** Opening Radix's
 * `Popover` costs seconds in this jsdom and every open after the first in a file costs
 * more: measured on 2026-10-03, 2.8 s for the first open in a file and 10.7 s for the
 * second. `share-notice-anchor.test.tsx` keeps the one open that everything about the
 * panel's own shape wants, and `share-notice-escape.test.tsx` takes one for the key;
 * this is the third.
 *
 * What is and is not asserted, stated plainly because a browser would do better: that the
 * panel GOES AWAY, which the DOM can say. Where the press landed, and whether the panel
 * covers the thing it was clicked on, is floating-ui's arithmetic — a browser's business,
 * and what `measure-header.mjs` and a pair of eyes are for.
 */
afterEach(unmountBar);

describe('the too-long notice goes away', () => {
  /**
   * A press outside takes it down.
   *
   * **A `pointerdown`, the `click` behind it, and fake timers from before the mount.**
   * Radix attaches its outside-press listener in a `setTimeout(0)`, so the test has to
   * let one go by, and a real one costs 31 s on this machine for the panel alone —
   * measured with a CPU profile that found the process idle for the whole of it, so
   * nothing is being computed and nothing can be waited out. Faked, the same tick costs
   * 0 ms and runs the same two events through the same handlers; the fakes go on before
   * the mount, because a timer Radix scheduled while they were off is one no
   * `advanceTimersByTime` can reach. `toFake` names `setTimeout` alone, so
   * `requestAnimationFrame` and React's own scheduler keep the real ones.
   */
  it('on a press outside it, which is what a click on the page is', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      mountBar({
        dirty: true,
        share: { run: () => {}, warning: { text: 'Too long for a link.' } },
      });
      act(() => inBar('action-share')!.click());
      expect(onPage('share-warning-close')).not.toBeNull();

      // The tick Radix's listener goes on in, and then the press outside the panel.
      act(() => vi.advanceTimersByTime(1));
      act(() => {
        document.body.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0, isPrimary: true }),
        );
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
      });
    } finally {
      vi.useRealTimers();
    }
    expect(onPage('share-warning-close')).toBeNull();
    expect(inBar('share-anchor')?.getAttribute('aria-expanded')).toBe('false');
  });
});
