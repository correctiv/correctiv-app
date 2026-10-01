import { GRIP, heldAt, isDrag, reach } from '@/lib/rail/drag';

/**
 * The arithmetic under the web target's drag-to-scroll, which is the only way a
 * mouse can move a `Rail` at all.
 *
 * It is here rather than in the hook because a hook needs a browser and this
 * needs nothing, and because two of the three rules below are invisible in a
 * browser until somebody does the one thing that shows them up. Measured on
 * 2026-09-18 on the assembled site: a mouse drag over a rail selected the
 * headline, moved nothing, and opened the card on release.
 */

/** The Mediathek's podcast rail, as the browser measured it at a 1000px window. */
const PODCASTS = { scrollWidth: 1164, clientWidth: 1000 };

describe('reach', () => {
  it('is what the rail has left to give', () => {
    expect(reach(PODCASTS)).toBe(164);
  });

  it('is nought for a rail whose content fits', () => {
    expect(reach({ scrollWidth: 800, clientWidth: 1000 })).toBe(0);
  });

  it('is never negative', () => {
    /*
     * Not a hypothetical: a rail measured before its content has laid out reports
     * a scrollWidth a pixel or two under its clientWidth, from rounding. A
     * negative reach would be a rail that answers "I can move" and cannot, which
     * is what `useRailDrag.web.ts` tests before it takes a press at all.
     */
    expect(reach({ scrollWidth: 999, clientWidth: 1000 })).toBe(0);
  });
});

describe('heldAt', () => {
  const grab = { x: 500, left: 0 };

  it('moves the content with the hand', () => {
    // Dragging left by 80 brings the content 80 further along.
    expect(heldAt(grab, PODCASTS, 420)).toBe(80);
  });

  /**
   * The rail starts from where it already stood, and every other case in this
   * file hides that.
   *
   * Drop `grab.left` from the sum — `-(x - grab.x)`, a drag that always begins
   * from nought — and the ten other assertions here stay green. The ones sharing
   * the `grab` above have `left: 0`, where the term adds nothing; the ones that
   * set it drag far enough to land on a clamp, and a clamp gives the same answer
   * whatever it was handed. So this case is deliberately away from both ends:
   * 100 is neither 0 nor `reach`, and it is the only number on this page that
   * the term itself decides.
   */
  it('carries on from where the grab found the rail', () => {
    // Grabbed 80 along, hand back 20 to the left, so the rail is 20 further on.
    expect(heldAt({ x: 500, left: 80 }, PODCASTS, 480)).toBe(100);
  });

  it('stops at the end rather than running past it', () => {
    expect(heldAt(grab, PODCASTS, 0)).toBe(164);
  });

  it('stops at the start, dragging the other way', () => {
    expect(heldAt({ x: 500, left: 100 }, PODCASTS, 900)).toBe(0);
  });

  /**
   * The rule the incremental implementation cannot have, and the reason this
   * module exists in this shape.
   *
   * Anchored on the grab, over-travel past the end is HELD: the pointer has to
   * come back inside the range before the rail moves again, so the content
   * returns to the hand it left rather than somewhere ahead of it. Summing
   * per-move deltas loses that, because the clamp eats each delta instead of
   * remembering it.
   */
  it('gives back exactly what it held at the end', () => {
    // 400 past the end, and the rail sits at its limit throughout.
    expect(heldAt(grab, PODCASTS, -64)).toBe(164);
    expect(heldAt(grab, PODCASTS, 200)).toBe(164);
    // Back inside, and the answer is the pointer's, not the end's.
    expect(heldAt(grab, PODCASTS, 400)).toBe(100);
  });

  it('does not move a rail that fits', () => {
    const fits = { scrollWidth: 800, clientWidth: 1000 };
    expect(heldAt(grab, fits, 100)).toBe(0);
  });
});

describe('isDrag', () => {
  it('lets a click through', () => {
    expect(isDrag(0)).toBe(false);
    expect(isDrag(GRIP - 1)).toBe(false);
  });

  it('takes the press at the threshold', () => {
    expect(isDrag(GRIP)).toBe(true);
    expect(isDrag(300)).toBe(true);
  });

  /*
   * It reads the pointer's furthest travel, which is not the same number as how
   * far the rail moved: a drag into the end of a rail travels a long way and
   * scrolls nothing. Handing it the scroll distance instead would let a plainly
   * deliberate drag end in an article.
   */
  it('is the pointer travel and not the rail movement', () => {
    const grab = { x: 500, left: 164 };
    expect(heldAt(grab, PODCASTS, 200)).toBe(reach(PODCASTS));
    expect(isDrag(Math.abs(200 - grab.x))).toBe(true);
  });
});
