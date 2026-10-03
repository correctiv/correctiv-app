/**
 * What `measure-header.mjs` calls a header in one row, as a function a check can ask.
 *
 *     node scripts/measure-header.mjs        # measures a browser and prints its verdict
 *
 * **A leaf of its own, for the reason `reload-notice.mjs` is one.** The measurement is
 * a browser and a machine's fonts, which a check cannot have; the VERDICT is four
 * comparisons and is what a wrong turn in the script would be caught by. Importing
 * `measure-header.mjs` to reach it would start a Vite server and a headless Chrome,
 * which is why the predicate sits here and the script imports it.
 *
 * **The one box this excuses, and why the field is the one.** The context bar is
 * `min-w-0` and takes the shortfall on purpose: the route field inside it is `flex-1`
 * with a `min-w-0`, so the bar is wider than its content whenever the field has been
 * squeezed, and a field narrower than the text it would hold is that arrangement
 * working, not a lost tail. Measured: at 1280, 1600 and 2000 CSS pixels with a route
 * of 59 characters in it, the field reads 189 pixels wide and reports a scroll width
 * of 578 — and the header is one row in all three, which is the whole claim.
 *
 * A LABEL losing its tail is a different thing and is still a failure, so the excuse
 * is for the box that grows and not for the context bar or for the leaves in general:
 * `grows` is read off the computed style of the leaf, and everything else still has
 * to fit. Nothing else in the bar grows — every other control is `shrink-0`, so its
 * width is a meaning rather than a choice.
 *
 * **The header's own overflow IS required to be zero**, and that is the claim the
 * script exists for: every one of its children is `shrink-0`, so a header wider than
 * its own box means a control pushed off the end of it.
 *
 * @param {{
 *   rows: number,
 *   contextRows: number | null,
 *   header: { client: number, scroll: number },
 *   leaves: readonly { label: string, clipped: boolean, grows?: boolean }[],
 * }} measured What `READ` in `measure-header.mjs` returned.
 * @returns {boolean} Whether the header is one row with nothing clipped in it.
 */

/**
 * The widths the script measures when it is asked for none, and why these three.
 *
 * 1280 is the narrowest laptop this site is looked at on and the width the header
 * broke at first; 1600 is a common desktop; 2000 is the width where the header has
 * so much room that the ladder should have been at tier 0, and finding it folded
 * there is the finding. All three are where it broke into three rows.
 *
 * `WIDTHS` overrides it, which is how the narrow band below 1280 is looked at — that
 * is where the bar's own fold starts working.
 */
export const WIDTHS = [1280, 1600, 2000];
export function oneRow(measured) {
  if (measured === null || measured === undefined) return false;
  if (measured.rows !== 1) return false;
  if (measured.contextRows !== 1) return false;
  if (measured.header.scroll > measured.header.client + 1) return false;
  // The box that gives up its width is the one the arrangement excuses; a clipped
  // label beside it is not.
  return !measured.leaves.some((leaf) => leaf.clipped && !leaf.grows);
}
