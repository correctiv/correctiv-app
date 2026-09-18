/**
 * Where a carried block would land, read off a list that is already showing the answer.
 *
 * [ADR 0053](../../../../../adr/0053-the-editor-is-the-screen-and-the-drag-is-the-answer.md)
 * §2 makes the drag its own preview: while a block is carried, every block is drawn where
 * a release would put it, and the carried one glides to the place it would take.
 *
 * ## Nothing moves in the DOM, and that is the whole design
 *
 * The list keeps the document's order for the length of a carry. What moves is a
 * `transform` per row, which costs no layout and can therefore be transitioned — ADR 0053
 * §2 says what it buys and what the first version cost.
 *
 * Two things follow, and both are worth more than the animation.
 *
 * **The geometry cannot feed itself.** A list that really reorders has to be measured
 * while it is moving, and the measurement is what decides the move: send the carried block
 * from slot 3 to slot 2 and the block that was at 2 shifts **down** by the carried block's
 * height, past the pointer, which answers slot 3 again. With a 420px block against a
 * pointer that moved four, one step cascades and settles nowhere. Here the resting layout
 * IS the layout, so there is no circle to break.
 *
 * **The drop is not a jump.** Because the preview snaps to whole slots rather than
 * following the pointer, each row's transform puts it exactly where the committed document
 * will lay it out. Clearing the transforms and writing the new order is, on screen, a
 * no-op.
 *
 * The rows are still measured on every move rather than snapshotted at the grab: a drawing
 * inside a row can finish measuring itself while a block is carried, and rows read once
 * would be stale by exactly the amount that makes a drop land one place out. What the
 * caller passes is each row's HEIGHT with its resting top summed from the heights above
 * it, which a `translateY` cannot disturb.
 *
 * ## The seam, not the centre
 *
 * What decides the slot is the carried block's **top edge** against the seams between the
 * resting blocks — the nearest one wins. The obvious alternative is to compare the pointer
 * against the blocks' centres, which is what a first version did, and with blocks this
 * uneven it is wrong before the pointer has moved at all. Measured, against a list of
 * `[64, 420, 28, 180, 96, 300]`: grabbing the 420px block in its middle answered slot 3
 * rather than slot 1, because a pointer halfway down a tall block is already past two
 * short ones. The block would have jumped two places on `pointerdown`.
 *
 * The top edge starts exactly on its own seam, so a grab moves nothing, and a block then
 * travels half of its neighbour before it passes that neighbour — the same threshold in
 * both directions, and the one a hand expects.
 */

/** One row of the list as it is drawn right now, in the list's own coordinates. */
export interface Drawn {
  /** The row's top edge, relative to the list, so a scroll during a carry costs nothing. */
  top: number;
  height: number;
}

/**
 * The seams of the list without the carried block: one above each remaining block, and
 * one below the last. There are as many of them as there are slots to land in.
 *
 * Taking the carried block out is what the subtraction does: everything below it rests one
 * carried-height higher once it is gone.
 */
function restingSeams(rows: readonly Drawn[], held: number): number[] {
  const lifted = rows[held]!;
  const seams: number[] = [];
  let last: Drawn | null = null;

  for (let i = 0; i < rows.length - 1; i += 1) {
    // The block at slot `i` of the resting list, found in the drawn one: the carried block
    // is at `held`, so from there on everything has been pushed one place along...
    const box = rows[i < held ? i : i + 1]!;
    // ...and pushed down by its height, which is the one correction this makes.
    const top = i >= held ? box.top - lifted.height : box.top;
    seams.push(top);
    last = { top, height: box.height };
  }

  if (last !== null) seams.push(last.top + last.height);
  return seams;
}

/**
 * Which slot the carried block would take, counted in the list **without** it.
 *
 * `rows` is every row, `held` is where the carried block sits among them, and `top` is
 * that block's own top edge — the pointer minus wherever inside the block it was grabbed —
 * in the same coordinates as `Drawn.top`.
 *
 * **This one does not care which order `rows` is in**, and `shiftFor` and `liftFor` beside
 * it do. `restingSeams` reduces the drawn tops to the resting tops by one subtraction, so
 * the answer is the same whether it is handed the document's order with `held = from`,
 * which is what the panel does, or a list with the block already moved, which is what the
 * test does when it feeds an answer back in. The other two are told a row's place in the
 * document and mean it.
 *
 * The answer is an index into the other blocks: 0 puts the carried block above all of
 * them, `rows.length - 1` below all of them. That is the same number `moved()` wants as a
 * destination, which is why nothing converts between a gap and a distance any more. The
 * conversion `deltaTo` used to do was the arithmetic that is wrong by exactly one place in
 * every first attempt at a drag, and this model gives it nowhere to be wrong.
 *
 * A tie goes to `held`. Two seams are equidistant only where a block measured no height at
 * all, which `HomeBlock` draws a strip for but which a row can still report, and the
 * honest answer there is that nothing has moved far enough to move anything.
 */
export function slotFrom(rows: readonly Drawn[], held: number, top: number): number {
  if (rows.length < 2) return 0;
  if (held < 0 || held >= rows.length) return 0;

  const seams = restingSeams(rows, held);
  let best = held;
  let closest = Math.abs(seams[held]! - top);

  for (let slot = 0; slot < seams.length; slot += 1) {
    const distance = Math.abs(seams[slot]! - top);
    if (distance < closest) {
      closest = distance;
      best = slot;
    }
  }

  return best;
}

/**
 * How far a row is moved from where the document lays it out, while a block is carried.
 *
 * ADR 0053 §2. The list keeps the document's order for the length of a carry and every row
 * is put where a release would put it with a `transform`, so this is the whole of the
 * preview: a number of pixels per row, which the browser can transition because it costs
 * no layout.
 *
 * `index` is the row's place in the document, `from` the carried block's, `slot` where it
 * would land counted among the others (`slotFrom` above), and `height` the carried block's
 * own height.
 *
 * Three cases, and the two that move are mirror images:
 *
 * - The **carried** block goes to the seam it would land on, which is `slot`'s resting top
 *   minus its own. That is a signed sum of the heights it passes, so the caller hands the
 *   distance in rather than the arithmetic being repeated here.
 * - A block the carried one has moved **past on its way down** comes up by one carried
 *   height.
 * - A block it has moved past **on its way up** goes down by one.
 *
 * Nought for everything else, which is most of the list on most moves.
 */
export function shiftFor(index: number, from: number, slot: number, height: number): number {
  if (index === from) return 0;
  if (slot > from && index > from && index <= slot) return -height;
  if (slot < from && index >= slot && index < from) return height;
  return 0;
}

/**
 * Where the carried block's own seam is, against where the document lays it out.
 *
 * Kept apart from `shiftFor` because it is the one row whose distance is not a single
 * height: it is the sum of everything between where it rests and where it would land, and
 * the sign of that sum is the direction it travels.
 *
 * `rows` is the list as `slotFrom` takes it, in document order, and `from` and `slot` mean
 * what they mean there.
 */
export function liftFor(rows: readonly Drawn[], from: number, slot: number): number {
  if (slot === from) return 0;

  // The heights it travels over, and nothing of its own: the carried block's height is what
  // the blocks it passes move BY, which is `shiftFor`'s answer for each of them.
  let distance = 0;
  if (slot > from) for (let i = from + 1; i <= slot; i += 1) distance += rows[i]?.height ?? 0;
  else for (let i = slot; i < from; i += 1) distance -= rows[i]?.height ?? 0;

  return distance;
}

/**
 * How far to scroll the panel this frame, while a block is carried against one of its edges.
 *
 * ADR 0053 §2. A carry holds the pointer, so without this the only way to reach the far
 * end of the day was a wheel, and on a touch screen there was no way at all. `HomeBlock`
 * draws at the phone's own width, so the day is several times the height of the panel it
 * is arranged in; §2 carries the measurement, on the day it was measured, and this does
 * not keep a second copy of it.
 *
 * Positive scrolls DOWN, and nought is the ordinary answer: the block is nowhere near an
 * edge and nothing should move.
 *
 * ## Why it is proportional, and why it is clamped
 *
 * A fixed speed is either too slow to cross the day or too fast to stop on a block.
 * Proportional to how far into the margin the pointer is, a person chooses the speed by
 * how close they hold it to the edge, which is the control every list with this behaviour
 * has and the one a hand already knows.
 *
 * The clamp is what makes it stop being a speed control once the pointer leaves the panel
 * entirely. Without it, dragging out over the phone frame — nine hundred pixels away, and
 * the gesture `overList` treats as abandoning — would accelerate the list to the end of
 * the day on the way.
 */
export function scrollStep(
  y: number,
  room: { top: number; bottom: number },
  margin = 64,
  fastest = 18,
): number {
  /*
   * A panel shorter than two margins has no middle, and every position would then be
   * inside both edges at once. Answering nought is what keeps the arithmetic honest there
   * rather than picking whichever edge is tested first.
   */
  if (room.bottom - room.top <= margin * 2) return 0;

  const above = room.top + margin - y;
  if (above > 0) return -fastest * Math.min(1, above / margin);

  const below = y - (room.bottom - margin);
  if (below > 0) return fastest * Math.min(1, below / margin);

  return 0;
}
