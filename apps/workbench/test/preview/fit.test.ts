import { describe, expect, it } from 'vitest';

import { fit } from '../../src/preview/home/fit';

/**
 * How big a drawn block is and where it stands, run rather than read.
 *
 * ADR 0045 §3 gives one rule — a block draws at the phone's own width and scales DOWN to
 * fit, never up — and the row it stands in gives the other, because ADR 0038 makes the
 * panel a share of the window and the two do not meet on a wide screen.
 *
 * Both used to be one-liners inside `HomeBlock.tsx`, where the only check possible was a
 * search for `Math.min` in a file. This repository has been bitten three times in one week
 * by exactly that shape of check, so the arithmetic moved to a leaf and this runs it.
 */

/** The phone this tool opens at. A number here because the case is the arithmetic. */
const PHONE = 393;

describe('a drawing in a row', () => {
  it('draws at the phone’s own width when the row is wide enough', () => {
    expect(fit(531, PHONE).scale).toBe(1);
    expect(fit(PHONE, PHONE).scale).toBe(1);
  });

  it('never scales up, however much room there is', () => {
    // §3's rule and the reason for it: a block wider than the phone is a lie about how
    // many pixels the app thinks it has.
    for (const room of [PHONE + 1, 600, 1000, 4000]) expect(fit(room, PHONE).scale).toBe(1);
  });

  it('scales down to fit a narrower row, exactly', () => {
    expect(fit(308, PHONE).scale).toBeCloseTo(308 / PHONE, 6);
    // Exactly: the DRAWING scaled is the room, with nothing over and nothing short. The
    // room scaled is a different number and was what this line said at first.
    expect(PHONE * fit(308, PHONE).scale).toBeCloseTo(308, 6);
  });

  it('centres what is left over, and leaves nothing over when it scaled', () => {
    // Measured at a 2000px window: a 531px row, a 393px drawing, 138px of nothing.
    expect(fit(531, PHONE).aside).toBe((531 - PHONE) / 2);
    // And below one there is nothing to centre, because the drawing fills the row.
    expect(fit(308, PHONE).aside).toBe(0);
    expect(fit(PHONE, PHONE).aside).toBe(0);
  });

  it('never pushes the drawing out of its own row', () => {
    // The property that matters: whatever the room, what is drawn plus what is beside it
    // fits in it. A margin computed from the unscaled width would fail this below one.
    for (const room of [100, 308, PHONE, 400, 531, 1200]) {
      const { scale, aside } = fit(room, PHONE);
      expect(aside * 2 + PHONE * scale).toBeLessThanOrEqual(room + 0.001);
      expect(aside).toBeGreaterThanOrEqual(0);
    }
  });

  it('answers for a row it has not measured yet', () => {
    // `null` is the first render, before the observer has said anything. Drawing at its
    // own size is the truth in whatever room there is; guessing at a smaller one would
    // correct itself a frame later, which is a flicker on every block of the document.
    expect(fit(null, PHONE)).toEqual({ scale: 1, aside: 0 });
    // And the degenerate boxes a detached or hidden element reports.
    expect(fit(0, PHONE)).toEqual({ scale: 1, aside: 0 });
    expect(fit(531, 0)).toEqual({ scale: 1, aside: 0 });
  });
});
