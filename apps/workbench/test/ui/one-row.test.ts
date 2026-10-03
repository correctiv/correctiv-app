import { describe, expect, it } from 'vitest';

import { oneRow, WIDTHS } from '../../scripts/one-row.mjs';

/**
 * The verdict `measure-header.mjs` prints, asked here over the numbers the test owns.
 *
 * **What the script measures and what it concludes are two things, and only the second
 * is here.** The measurement is this machine's fonts at this machine's widths, which is
 * why it is a script (`apps/workbench/scripts/measure-header.mjs`); the verdict is four
 * comparisons over a handful of numbers, and a wrong turn in it is a script that goes
 * quietly green on a header in three rows. So the predicate lives in
 * `scripts/one-row.mjs` where a check can reach it without a browser.
 *
 * **The fault this holds, which is #338's.** The script's own comment says the context
 * bar takes the shortfall on purpose and that the route field inside it is the control
 * whose width is a choice rather than a meaning — and then it asked every leaf in both
 * bars whether it was clipped, the route field among them, and called the header broken
 * when it answered yes. Measured in a browser: a 59-character route in that field
 * reads 189 pixels wide against a 578-pixel scroll width at 1280, 1600 and 2000 alike,
 * and the header is one row in all three.
 *
 * The excuse is for the leaf that GROWS and for nothing else, so a clipped label beside
 * the field is still a failure. Every other control in both bars is `shrink-0`, which is
 * what makes `flex-grow` the test and not a name: the bar has no test id for the one
 * box it gives up, and the style is the reason.
 */
interface Measured {
  rows: number;
  contextRows: number | null;
  header: { client: number; scroll: number };
  leaves: { label: string; clipped: boolean; grows?: boolean }[];
}

/** One row in every respect, and the leaves are what a healthy header has. */
const ONE_ROW: Measured = {
  rows: 1,
  contextRows: 1,
  header: { client: 1280, scroll: 1280 },
  leaves: [
    { label: 'SPAN', clipped: false },
    { label: 'Route', clipped: false, grows: true },
  ],
};

describe('the header is one row', () => {
  it('says so for the default state at the three widths it is measured at', () => {
    expect([...WIDTHS]).toEqual([1280, 1600, 2000]);
    for (const width of WIDTHS) {
      expect(oneRow({ ...ONE_ROW, header: { client: width, scroll: width } })).toBe(true);
    }
  });

  it('says no for a header that broke into rows, which is the defect itself', () => {
    expect(oneRow({ ...ONE_ROW, rows: 3 })).toBe(false);
    expect(oneRow({ ...ONE_ROW, contextRows: 2 })).toBe(false);
  });

  it('says no for a control pushed off the end of the header', () => {
    // Every one of the header's own children is `shrink-0`, so a header wider than
    // its box is a control off the end of it.
    expect(oneRow({ ...ONE_ROW, header: { client: 1280, scroll: 1340 } })).toBe(false);
    // A single pixel of rounding is not an overflow, which is why the comparison has
    // the +1 in it at all.
    expect(oneRow({ ...ONE_ROW, header: { client: 1280, scroll: 1281 } })).toBe(true);
  });

  it('says no for a label losing its tail', () => {
    expect(
      oneRow({ ...ONE_ROW, leaves: [...ONE_ROW.leaves, { label: 'SPAN', clipped: true }] }),
    ).toBe(false);
  });

  it('excuses the field that gives up its width, and only that one', () => {
    // The route field narrower than the route it holds: the arrangement working.
    expect(
      oneRow({
        ...ONE_ROW,
        leaves: [{ label: 'Route', clipped: true, grows: true }],
      }),
    ).toBe(true);
    // A leaf beside it that is clipped is a label that lost its tail, and it fails
    // whatever the field is doing.
    expect(
      oneRow({
        ...ONE_ROW,
        leaves: [
          { label: 'Route', clipped: true, grows: true },
          { label: 'SPAN', clipped: true },
        ],
      }),
    ).toBe(false);
    // A clipped field that does NOT grow is a different box and a real failure: the
    // excuse is the style and not the name.
    expect(oneRow({ ...ONE_ROW, leaves: [{ label: 'Route', clipped: true }] })).toBe(false);
  });

  it('says no for a page it never measured', () => {
    // `READ` returns null when there is no header, and a check that passed over that
    // would be a check that passed over nothing.
    expect(oneRow(null as unknown as Measured)).toBe(false);
    expect(oneRow(undefined as unknown as Measured)).toBe(false);
  });
});
