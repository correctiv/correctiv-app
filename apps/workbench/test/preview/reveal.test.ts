import { describe, expect, it } from 'vitest';

import { scrollDelta } from '../../src/preview/frame/reveal';

/**
 * How far the frame moves to show a block, and when it does not move at all.
 *
 * `reveal.ts` is two parts: this arithmetic, and a walk up the frame's document to find
 * the box that scrolls. The walk is four lines and a `getComputedStyle`; the arithmetic
 * is where a wrong answer is plausible, and where it shows as a frame that jumps, or one
 * that recentres on every row of a list somebody is running a pointer down.
 *
 * Numbers rather than a described shape, because what is being asked is the arithmetic.
 * The margin is passed explicitly for the same reason: a test that took the module's
 * default would be checking two things and naming one.
 */

/** A room 100 tall, with the frame's own coordinates starting at 0. */
const ROOM = { top: 0, bottom: 100 };
const M = 10;

describe('how far the frame has to move', () => {
  it('does not move for a block that is already inside, margins included', () => {
    expect(scrollDelta({ top: 20, bottom: 60 }, ROOM, M)).toBe(0);
    // Exactly on the margins is inside. A block flush with the boundary would otherwise
    // provoke a scroll of nought pixels, reported as a scroll.
    expect(scrollDelta({ top: 10, bottom: 90 }, ROOM, M)).toBe(0);
  });

  it('scrolls up by just enough for a block above', () => {
    // Negative is up. The block's top lands on the margin and not on the edge.
    expect(scrollDelta({ top: -30, bottom: 10 }, ROOM, M)).toBe(-40);
    expect(scrollDelta({ top: 5, bottom: 40 }, ROOM, M)).toBe(-5);
  });

  it('scrolls down by just enough for a block below', () => {
    expect(scrollDelta({ top: 120, bottom: 160 }, ROOM, M)).toBe(70);
    expect(scrollDelta({ top: 60, bottom: 95 }, ROOM, M)).toBe(5);
  });

  it('puts a block taller than the room at its top rather than its bottom', () => {
    // The `Math.min` in the module, and the only part of this that is not obvious. A
    // block 200 tall cannot be inside a room of 100: bringing its bottom in would push
    // its beginning off the top, and the beginning is the half worth keeping.
    expect(scrollDelta({ top: 50, bottom: 250 }, ROOM, M)).toBe(40);
    // Already at the top with the margin: nothing to do, even though it overflows.
    expect(scrollDelta({ top: 10, bottom: 210 }, ROOM, M)).toBe(0);
  });

  it('answers in the room’s own coordinates, wherever the room is', () => {
    // The scroller is rarely at the top of the frame: the app's is below a header, so its
    // rect starts partway down. Reading the room rather than assuming zero is what makes
    // that work, and this is the case that catches an assumed zero.
    const lower = { top: 56, bottom: 156 };
    expect(scrollDelta({ top: 76, bottom: 116 }, lower, M)).toBe(0);
    expect(scrollDelta({ top: 20, bottom: 50 }, lower, M)).toBe(-46);
    expect(scrollDelta({ top: 160, bottom: 200 }, lower, M)).toBe(54);
  });

  it('is never a move that undoes itself', () => {
    // A delta that overshoots would put the block out the other side, and the next hover
    // would bring it back: a frame oscillating under a pointer. Applying the answer has
    // to leave the block inside, whichever side it came from.
    const inside = (box: { top: number; bottom: number }) => {
      const delta = scrollDelta(box, ROOM, M);
      const moved = { top: box.top - delta, bottom: box.bottom - delta };
      return scrollDelta(moved, ROOM, M);
    };
    for (const box of [
      { top: -30, bottom: 10 },
      { top: 120, bottom: 160 },
      { top: 60, bottom: 95 },
      { top: 5, bottom: 40 },
      { top: 50, bottom: 250 },
    ]) {
      expect(inside(box)).toBe(0);
    }
  });
});
