/**
 * How big a drawn block is, and where in its row it stands.
 *
 * Two rules that belong together because they are two halves of one answer, and because
 * inline in the component neither could be run by a test: a check that read them as source
 * would be looking for `Math.min` in a file, which is the shape of check this repository
 * has been bitten by three times in one week.
 */

/**
 * The strip down the left of every block, which is the one thing the list keeps that the
 * app has not got.
 *
 * ADR 0053 §1 makes the list the screen, and the hazard that comes with it is a list that
 * is mistaken for the app — the frame is a foot to the right and it is the one that
 * answers a tap. So the column is not flush with the panel: it stands beside a gutter
 * carrying the handle and the two marks a person may not have to hover to see, and that
 * gutter is what says, without a word, that this is an editor rather than a screen.
 *
 * **It is here, and exported, because the panel's width is made of it.** The row is the
 * phone plus this, and the editor asks the panel to open at exactly that
 * (`shell/views.ts`'s `toolWidth`, checked against this number and the padding in
 * `test/shell/panel-width.test.ts`) — the module that draws the list cannot import the
 * module that sizes the panel, and a check reading a second copy of the gutter out of
 * either would be the thing this number is here to prevent.
 */
export const GUTTER = 26;

/** The width of the row a block is drawn in: its own width and the gutter beside it. */
export const rowWidth = (deviceWidth: number): number => deviceWidth + GUTTER;

/**
 * The scale and the room beside it, for a drawing of `deviceWidth` in a row of `room`.
 *
 * **Never above one**, which is
 * [ADR 0045](../../../../../adr/0045-the-home-editor-arranges-the-blocks-it-draws.md) §3:
 * a block scaled up would be a lie about how many pixels the app thinks it has. Below one
 * it fills the row exactly, by construction, and `aside` is then nought.
 *
 * **Centred where there is room left**, which there is when somebody has dragged the
 * panel wider and was not the case at its default: the drawing is the phone's own
 * width and the editor asks the panel for exactly that row (`GUTTER` above and
 * `shell/views.ts`), so at 443 the two meet and `aside` is nought. Measured at a
 * 2000px window before that width existed, a 531px row held a 393px drawing and 138
 * pixels of nothing, all of it on the right, and it read as a drawing that had run out
 * rather than one that is the size it is.
 *
 * Centred and not stretched, because stretching is what §3 refuses. `Stage.tsx` makes the
 * same choice with `m-auto` for the device frame, and a phone standing in a box it does
 * not fill is the shape this site already uses for exactly this.
 *
 * `room` of `null` is "not measured yet". The answer is then a scale of one and no margin,
 * which draws the block at its own size in whatever room there is rather than guessing at
 * a smaller one and correcting itself a frame later.
 */
export function fit(room: number | null, deviceWidth: number): { scale: number; aside: number } {
  if (room === null || room <= 0 || deviceWidth <= 0) return { scale: 1, aside: 0 };
  const scale = Math.min(1, room / deviceWidth);
  /*
   * `deviceWidth * scale` and not `deviceWidth`, although the clamp makes the two equal
   * for every input: below one the scaled width IS the room, so the first is nought and
   * the second is negative and clamped to nought. Measured as an equivalent mutation, and
   * kept in the form that says what it means — the room left after the drawing — because
   * the other form only works by accident of the clamp.
   */
  return { scale, aside: Math.max(0, (room - deviceWidth * scale) / 2) };
}
