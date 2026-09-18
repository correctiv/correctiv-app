import { describe, expect, it } from 'vitest';

import { liftFor, scrollStep, shiftFor, slotFrom, type Drawn } from '../../src/preview/home/carry';

/**
 * The drop slot of a list that is already showing where the drop would go.
 *
 * ADR 0053 §2 makes the carried block reflow into the place it would land, so the thing
 * being measured is a consequence of the answer. The property that matters is therefore
 * not only "does it pick the right slot" but **does it pick the same slot twice** — a drag
 * whose preview moves the geometry that decides the preview is a block that flickers
 * between two neighbours and settles nowhere.
 *
 * So the cases below are written against a simulated list rather than against numbers
 * typed by hand: `drawn()` is the reflow, applied here the way the panel applies it, and
 * two of the cases feed the answer back in.
 */

/**
 * The list as the panel draws it: the blocks in resting order, minus the carried one, with
 * the carried one put back at `held`.
 *
 * This is the reflow ADR 0053 §2 decides, in six lines, so that a test can apply it.
 */
function drawn(heights: readonly number[], from: number, held: number): Drawn[] {
  const rest = [...heights];
  const [lifted] = rest.splice(from, 1);
  rest.splice(held, 0, lifted!);

  let top = 0;
  return rest.map((height) => {
    const box = { top, height };
    top += height;
    return box;
  });
}

/** Where the carried block's top edge is while it sits at `held` and nothing is dragging. */
function restingTop(heights: readonly number[], from: number, held: number): number {
  return drawn(heights, from, held)[held]!.top;
}

/**
 * Heights of the kind this list actually holds: a header, a hero, a strip, a long list.
 *
 * Wildly uneven on purpose. Equal heights hide the bug this module exists for, because the
 * carried block's height then equals the height of whatever it displaces and the cascade
 * cancels out.
 */
const HEIGHTS = [64, 420, 28, 180, 96, 300];
const TOTAL = HEIGHTS.reduce((sum, height) => sum + height, 0);

describe('the slot a carried block would take', () => {
  it('is the block’s own place at the moment it is picked up', () => {
    // The case that killed the centre-based model: a grab must move nothing at all, and a
    // pointer halfway down the 420px block is already past two shorter ones below it.
    for (let from = 0; from < HEIGHTS.length; from += 1) {
      const rows = drawn(HEIGHTS, from, from);
      expect(slotFrom(rows, from, rows[from]!.top)).toBe(from);
    }
  });

  it('is two places out if the pointer is compared with the blocks’ centres', () => {
    /*
     * The counterfactual ADR 0053 §2 rests on, pinned rather than asserted in prose. The
     * record says a centre-based model answers slot 3 for a grab that must answer slot 1;
     * that number is the whole argument for measuring a top edge, and until this case it
     * was typed in three places and checked in none.
     *
     * The model, in one line: where the pointer is, against the centres of the blocks the
     * carried one would be placed among.
     */
    const from = 1;
    const rows = drawn(HEIGHTS, from, from);
    const pointer = rows[from]!.top + rows[from]!.height / 2;

    const rest = rows.filter((_, i) => i !== from);
    const lifted = rows[from]!.height;
    const byCentre = rest.filter((box, i) => {
      const top = i >= from ? box.top - lifted : box.top;
      return pointer >= top + box.height / 2;
    }).length;

    expect(byCentre).toBe(3);
    // And the model this repository has, on the same input.
    expect(slotFrom(rows, from, rows[from]!.top)).toBe(1);
  });

  it('takes the ends when the block is carried past either end of the list', () => {
    const rows = drawn(HEIGHTS, 3, 3);
    expect(slotFrom(rows, 3, -400)).toBe(0);
    expect(slotFrom(rows, 3, 100_000)).toBe(HEIGHTS.length - 1);
  });

  it('passes a neighbour at half that neighbour’s height, in both directions', () => {
    // The threshold, stated as the rule rather than as a pixel: the block below the hero
    // is 28 tall, so the hero passes it after 14; the block above it is 64, so it passes
    // that one after 32. A model with one threshold for both directions cannot do this.
    const from = 1;
    const rows = drawn(HEIGHTS, from, from);
    const start = rows[from]!.top;

    expect(slotFrom(rows, from, start + 13)).toBe(1);
    expect(slotFrom(rows, from, start + 15)).toBe(2);
    expect(slotFrom(rows, from, start - 31)).toBe(1);
    expect(slotFrom(rows, from, start - 33)).toBe(0);
  });

  /**
   * The case the whole module is for. A block held still, a list that has reflowed under
   * it, and the same answer the second time.
   *
   * Without the correction in `restingSeams`, the rows the carried block displaces move by
   * its height and the second reading disagrees with the first.
   */
  it('answers the same slot once the list has reflowed to it', () => {
    for (let from = 0; from < HEIGHTS.length; from += 1) {
      for (let top = -40; top < TOTAL + 40; top += 7) {
        for (let held = 0; held < HEIGHTS.length; held += 1) {
          const first = slotFrom(drawn(HEIGHTS, from, held), held, top);
          const again = slotFrom(drawn(HEIGHTS, from, first), first, top);
          expect(again).toBe(first);
        }
      }
    }
  });

  it('reads the resting list, so where the block currently sits cannot change the answer', () => {
    // The same claim stated as the invariant rather than as a fixed point: for one position
    // every starting arrangement has to agree, because they are all drawings of one resting
    // list. A tie goes to `held`, and a tie needs a row of no height, so `HEIGHTS` has none.
    for (let from = 0; from < HEIGHTS.length; from += 1) {
      for (let top = -40; top < TOTAL + 40; top += 11) {
        const answers = new Set(
          HEIGHTS.map((_, held) => slotFrom(drawn(HEIGHTS, from, held), held, top)),
        );
        expect(answers.size).toBe(1);
      }
    }
  });

  it('moves one slot at a time, and every slot can be reached', () => {
    // Monotone, and nothing skipped. A model that jumped a slot would have a place the
    // pointer cannot land in, which a person reads as "it will not go there".
    const rows = drawn(HEIGHTS, 0, 0);

    let last = 0;
    const seen = new Set<number>([0]);
    for (let top = -40; top < TOTAL + 40; top += 1) {
      const slot = slotFrom(rows, 0, top);
      expect(slot - last).toBeGreaterThanOrEqual(0);
      expect(slot - last).toBeLessThanOrEqual(1);
      last = slot;
      seen.add(slot);
    }
    expect(seen.size).toBe(HEIGHTS.length);
  });

  it('holds still around a block that measured nothing', () => {
    // `HomeBlock` draws a strip where a module drew nought, but a row can still be short,
    // and two seams then sit on the same pixel. The tie goes to where the block already is,
    // which is the answer that does not move something nobody aimed at.
    const flat = [64, 0, 0, 180];
    for (let held = 0; held < flat.length; held += 1) {
      const rows = drawn(flat, 0, held);
      expect(slotFrom(rows, held, restingTop(flat, 0, held))).toBe(held);
    }
  });

  it('answers nought for a list too short to reorder, and for a block that is not in it', () => {
    expect(slotFrom([], 0, 10)).toBe(0);
    expect(slotFrom([{ top: 0, height: 50 }], 0, 10)).toBe(0);
    // A `held` outside the list is a render and a measurement that have parted. Nought is
    // an answer that moves the block somewhere legible rather than reading `undefined`.
    expect(slotFrom(drawn(HEIGHTS, 0, 0), 9, 100)).toBe(0);
    expect(slotFrom(drawn(HEIGHTS, 0, 0), -1, 100)).toBe(0);
  });
});

/** A panel of the height the home tool actually gets, and the margin the editor uses. */
const PANEL = { top: 200, bottom: 1000 };
const MARGIN = 64;

describe('the panel scrolling under a block held at its edge', () => {
  it('does nothing while the block is anywhere in the middle', () => {
    for (let y = PANEL.top + MARGIN; y <= PANEL.bottom - MARGIN; y += 13) {
      expect(scrollStep(y, PANEL, MARGIN)).toBe(0);
    }
  });

  it('scrolls up near the top and down near the bottom, and never the other way', () => {
    expect(scrollStep(PANEL.top + 10, PANEL, MARGIN)).toBeLessThan(0);
    expect(scrollStep(PANEL.bottom - 10, PANEL, MARGIN)).toBeGreaterThan(0);
    // The sign is the half of this that a reader of the call site cannot check by looking,
    // because `scrollTop += step` reads the same either way.
    expect(scrollStep(PANEL.top - 500, PANEL, MARGIN)).toBeLessThan(0);
    expect(scrollStep(PANEL.bottom + 500, PANEL, MARGIN)).toBeGreaterThan(0);
  });

  it('goes faster the closer to the edge it is held', () => {
    const near = Math.abs(scrollStep(PANEL.top + 4, PANEL, MARGIN));
    const far = Math.abs(scrollStep(PANEL.top + 56, PANEL, MARGIN));
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
    // And it is continuous at the margin rather than snapping on: a speed that appears
    // fully formed is a list that lurches the moment a pointer crosses an invisible line.
    expect(Math.abs(scrollStep(PANEL.top + MARGIN - 1, PANEL, MARGIN))).toBeLessThan(1);
  });

  it('stops getting faster once the pointer has left the panel', () => {
    // The clamp, and what it is for: a release out over the phone frame is how a carry is
    // abandoned (`overList`), and the journey there must not take the day with it.
    const fastest = 18;
    for (const y of [PANEL.top - MARGIN, PANEL.top - 900, PANEL.top - 100_000]) {
      expect(scrollStep(y, PANEL, MARGIN, fastest)).toBe(-fastest);
    }
    for (const y of [PANEL.bottom + MARGIN, PANEL.bottom + 900, PANEL.bottom + 100_000]) {
      expect(scrollStep(y, PANEL, MARGIN, fastest)).toBe(fastest);
    }
  });

  it('has the editor’s own margin and speed as its defaults', () => {
    /*
     * The app calls `scrollStep(held.y, { top, bottom })` and passes neither. Every case
     * above passes `margin` explicitly, so until this line a mutation of the default — 64
     * to 400, or to 4 — survived the whole suite. `MARGIN` above claims these are the
     * editor's numbers; this is what makes the claim true of the call the editor makes.
     */
    for (const y of [PANEL.top + 10, PANEL.top + 100, PANEL.bottom - 10, PANEL.bottom + 40]) {
      expect(scrollStep(y, PANEL)).toBe(scrollStep(y, PANEL, MARGIN, 18));
    }
  });

  it('answers nought for a panel too short to have a middle', () => {
    // Both margins would otherwise overlap and every position would be inside both edges,
    // where the answer would be whichever of the two is tested first.
    const squashed = { top: 200, bottom: 200 + MARGIN * 2 };
    for (let y = squashed.top - 20; y <= squashed.bottom + 20; y += 7) {
      expect(scrollStep(y, squashed, MARGIN)).toBe(0);
    }
  });
});

describe('where each row is put while a block is carried', () => {
  /**
   * The property the whole preview rests on, and the one ADR 0053 §2 turns a claim into:
   * a row's resting top plus its shift IS where the committed document would lay it out.
   *
   * If that holds, then clearing the transforms and writing the new order is a no-op on
   * screen, and the drop cannot jump. It is checked over every block and every slot rather
   * than at a few points, because an off-by-one here is a lurch nobody could name.
   */
  it('puts every row exactly where the committed document would', () => {
    const rows: Drawn[] = [];
    let top = 0;
    for (const height of HEIGHTS) {
      rows.push({ top, height });
      top += height;
    }

    for (let from = 0; from < HEIGHTS.length; from += 1) {
      for (let slot = 0; slot < HEIGHTS.length; slot += 1) {
        // Where the document would put everything once the move is written.
        const after = [...HEIGHTS];
        const [lifted] = after.splice(from, 1);
        after.splice(slot, 0, lifted!);
        const settled: number[] = [];
        let next = 0;
        for (const height of after) {
          settled.push(next);
          next += height;
        }

        for (let index = 0; index < HEIGHTS.length; index += 1) {
          const shift =
            index === from
              ? liftFor(rows, from, slot)
              : shiftFor(index, from, slot, HEIGHTS[from]!);
          // Which place this row ends up in, once the move is written.
          const landed =
            index === from
              ? slot
              : index < from
                ? index < slot || slot > from
                  ? index
                  : index + 1
                : index > slot || slot < from
                  ? index
                  : index - 1;
          expect(rows[index]!.top + shift).toBe(settled[landed]!);
        }
      }
    }
  });

  it('moves nothing at all while the block is in its own place', () => {
    const rows: Drawn[] = HEIGHTS.map((height, i) => ({
      top: HEIGHTS.slice(0, i).reduce((sum, h) => sum + h, 0),
      height,
    }));
    for (let from = 0; from < HEIGHTS.length; from += 1) {
      expect(liftFor(rows, from, from)).toBe(0);
      for (let index = 0; index < HEIGHTS.length; index += 1) {
        expect(shiftFor(index, from, from, HEIGHTS[from]!)).toBe(0);
      }
    }
  });

  it('moves a passed block by exactly one carried height, and the others not at all', () => {
    // The mirror pair, stated on its own: going down lifts what it passes, going up drops
    // it, and nothing outside the span between the two places is touched.
    expect(shiftFor(1, 0, 2, 64)).toBe(-64);
    expect(shiftFor(2, 0, 2, 64)).toBe(-64);
    expect(shiftFor(3, 0, 2, 64)).toBe(0);
    expect(shiftFor(2, 4, 2, 96)).toBe(96);
    expect(shiftFor(3, 4, 2, 96)).toBe(96);
    expect(shiftFor(1, 4, 2, 96)).toBe(0);
  });
});
