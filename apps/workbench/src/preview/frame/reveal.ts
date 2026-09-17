/**
 * Bringing a marked element into view, inside the frame and nowhere else.
 *
 * `highlight.ts` puts an outline on the section a row in the home editor names, and an
 * outline on something below the fold is an outline nobody can see. Measured on the dev
 * server with the shipped document at an iPhone 15 Pro: the app's scroller is 796px tall
 * and the last section's top sits at 2856px, so more than half the day's blocks are
 * marked where nobody is looking.
 *
 * ## Why not `scrollIntoView`
 *
 * It scrolls every scrollable ancestor, and the frame's ancestors do not stop at the
 * frame: the stage box around the iframe is `overflow-auto`, and so is the page. Asking
 * the app to show its footer would move the workbench under it. Two files over,
 * `ui/Panels.tsx` uses `scrollIntoView({ block: 'nearest' })` and is right to — that is
 * one document scrolling itself.
 *
 * So the scroller is found inside the frame's own document and scrolled by a delta. The
 * delta is `scrollDelta` below, which is arithmetic and has a test; the rest is the walk
 * that finds the box, which is four lines and a `getComputedStyle`.
 */

/** Breathing room, so a revealed block is not flush against the edge it came in at. */
const MARGIN = 12;

/**
 * How far to scroll so that `box` is inside `room`, and zero when it already is.
 *
 * `block: 'nearest'` by hand, because that is the behaviour a hover wants: moving down a
 * list should move the frame only when the next block is not already on screen, or every
 * row would recentre a screen that was fine. Positive scrolls down.
 *
 * A block taller than the room cannot be inside it, and the answer there is its top:
 * scrolling to its bottom would take its beginning off the screen, which is the worse
 * half to lose. That is the `Math.min` below and it is the only part of this that is not
 * obvious.
 */
export function scrollDelta(
  box: { top: number; bottom: number },
  room: { top: number; bottom: number },
  margin = MARGIN,
): number {
  if (box.top < room.top + margin) return box.top - room.top - margin;
  if (box.bottom > room.bottom - margin) {
    return Math.min(box.bottom - room.bottom + margin, box.top - room.top - margin);
  }
  return 0;
}

/**
 * The nearest ancestor that actually scrolls, or the document if it is the one that does.
 *
 * "Actually" is the `scrollHeight > clientHeight` test: the app's tree is full of boxes
 * with `overflow: auto` that have nothing to scroll, and the first one of those would
 * swallow the scroll and move nothing.
 */
function scroller(node: Element): Element | null {
  const view = node.ownerDocument.defaultView;
  if (view === null) return null;

  for (let held = node.parentElement; held !== null; held = held.parentElement) {
    const overflow = view.getComputedStyle(held).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && held.scrollHeight > held.clientHeight) {
      return held;
    }
  }

  const root = node.ownerDocument.scrollingElement;
  return root !== null && root.scrollHeight > root.clientHeight ? root : null;
}

/**
 * What the scroller shows, in the same coordinates `getBoundingClientRect` answers in.
 *
 * The document's scrolling element is the exception and has to be: its rect is the whole
 * page rather than the part of it on screen, so a block near the bottom would measure as
 * already visible and nothing would move.
 */
function roomOf(holder: Element): { top: number; bottom: number } {
  const view = holder.ownerDocument.defaultView;
  if (holder === holder.ownerDocument.scrollingElement && view !== null) {
    return { top: 0, bottom: view.innerHeight };
  }
  const box = holder.getBoundingClientRect();
  return { top: box.top, bottom: box.bottom };
}

/**
 * Scroll the frame so that `node` is on screen, or do nothing because it already is.
 *
 * Smooth, so that a person watching the frame sees WHERE the block was rather than being
 * teleported to it, which is most of what makes the list and the frame read as two views
 * of one thing. Not smooth when the operating system has been told not to animate: a
 * hover that fires this repeatedly is exactly the kind of motion that setting exists for.
 */
export function reveal(node: Element): void {
  const view = node.ownerDocument.defaultView;
  const holder = scroller(node);
  if (view === null || holder === null) return;

  const delta = scrollDelta(node.getBoundingClientRect(), roomOf(holder));
  if (delta === 0) return;

  const still = view.matchMedia('(prefers-reduced-motion: reduce)').matches;
  holder.scrollBy({ top: delta, behavior: still ? 'auto' : 'smooth' });
}
