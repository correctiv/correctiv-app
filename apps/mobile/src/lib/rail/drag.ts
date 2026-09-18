/**
 * Where a rail stands while a mouse is dragging it, and when that press stops
 * being a click.
 *
 * Arithmetic only: no DOM, no React, no platform. It sits in its own module so a
 * test can run it, which is the same split
 * `apps/workbench/src/preview/home/fit.ts` makes and for the same reason — the
 * alternative is a check that greps a component for a `Math.min`.
 *
 * ## The anchor is the grab, not the last move
 *
 * The obvious implementation adds up per-move deltas: `scrollLeft -= x - lastX`,
 * with `lastX` rewritten on every move. The `dragscroll` this borrows from does
 * exactly that, in one expression (`-last + (last = e.clientX)`), and it is
 * wrong at the ends of the rail. Once `scrollLeft` has clamped, each further
 * delta is absorbed by the clamp rather than stored, so the moment the pointer
 * turns round the content moves again immediately — and it is now offset from
 * the hand by however far the pointer over-travelled. Drag a rail hard into its
 * end, come back an inch, and the content is an inch ahead of the cursor for the
 * rest of the gesture.
 *
 * Anchoring on the grab has no such state to lose: the answer is a pure function
 * of where the press started and where the pointer is now, so over-travel is
 * held by the clamp and given back on the way out. That is what a finger on a
 * phone does, and it is what makes this module testable at all — an incremental
 * version's answer depends on the path, and a path is not something a unit test
 * can state in one line.
 */

/**
 * How far a pointer has to travel before the press is a drag and not a click, in
 * CSS pixels.
 *
 * It is a judgement rather than a measurement, and the judgement is asymmetric:
 * every card in a rail is a link, so swallowing a click somebody meant is worse
 * than ignoring a five-pixel scroll they did not. Small enough that a deliberate
 * nudge still scrolls, large enough that a hand that shakes on the way down
 * still opens the article.
 */
export const GRIP = 6;

/** A press in progress, as it was at `pointerdown`. */
export interface Grab {
  /** The pointer's x in client coordinates. */
  readonly x: number;
  /** The rail's `scrollLeft` at that moment. */
  readonly left: number;
}

/** What a rail measures, which is all this needs to know about the element. */
export interface Extent {
  readonly scrollWidth: number;
  readonly clientWidth: number;
}

/**
 * The furthest `scrollLeft` a rail of this extent can take, and therefore also
 * whether it can be dragged at all: nought means the content fits and there is
 * nothing to offer a hand.
 *
 * Never negative. A rail measured before its content has laid out reports a
 * `scrollWidth` under its `clientWidth` — by a pixel, from rounding, rather than
 * by anything meaningful — and a negative reach would put the cursor on a rail
 * that cannot move.
 */
export function reach(extent: Extent): number {
  return Math.max(0, extent.scrollWidth - extent.clientWidth);
}

/**
 * Where the rail stands with the pointer at `x`, clamped to what it has.
 *
 * The browser clamps an out-of-range `scrollLeft` assignment itself, so this
 * could hand it anything and the screen would look the same. It clamps anyway,
 * so that the rule above — over-travel is held and given back — is a thing a
 * test can state rather than a thing the DOM happens to do.
 */
export function heldAt(grab: Grab, extent: Extent, x: number): number {
  return Math.min(reach(extent), Math.max(0, grab.left - (x - grab.x)));
}

/**
 * Whether a press that has travelled this far is a drag.
 *
 * `travelled` is the pointer's furthest HORIZONTAL distance from the grab during
 * the press, not its distance at the release and not how far the rail moved.
 * Both of the others are wrong in a case that happens: a drag into the end of a
 * rail moves the pointer three hundred pixels and the rail none, and a drag out
 * and back ends where it started. Either would let go of a press that was
 * plainly a drag and open whatever card was under the cursor.
 *
 * Horizontal and not the diagonal, which is a decision rather than a shortcut: a
 * rail only moves sideways, so a press that slides forty pixels straight down
 * has asked for nothing this can give and still opens the card under it. The
 * caller is what measures that distance; this only says where the line is.
 */
export function isDrag(travelled: number): boolean {
  return travelled >= GRIP;
}
