import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * How the two sides line up against each other, within a line.
 *
 * A record of literal class strings rather than a template, because Uniwind finds
 * the classes an app uses by scanning this source: `items-${align}` is a class
 * nothing generates and the row silently loses its alignment.
 */
const ALIGN = {
  center: 'items-center',
  start: 'items-start',
  end: 'items-end',
  baseline: 'items-baseline',
} as const;

export type SplitRowProps = {
  /** The two sides, in reading order. */
  children: ReactNode;
  /** Cross-axis alignment within a line. */
  align?: keyof typeof ALIGN;
  /** Layout and spacing for the row itself — not for either side. */
  className?: string;
};

/**
 * A row with something at each end: a wordmark and a date, a heading and its
 * link, a label and its value, a position and a duration.
 *
 * **This component exists because the app wrote that row eleven times as a class
 * string and forgot the same two things in each of them.** `flex-row
 * items-center justify-between` reads as finished and is not: `space-between`
 * distributes whatever room is left over, so the row is correct exactly while
 * there IS room left over. When the type grows there is none, and the two sides
 * do not stop at each other — they meet, and then they overlap, and then the
 * right-hand one leaves the screen. Four of those were photographed at 200 %
 * system font by `screens/tools/tour-a11y.sh`
 * ([#158](https://github.com/correctiv/correctiv-app/issues/158)): the door's
 * two footer links with no space between them and the second half off the right
 * edge, `SPOTLIGHTAlle Ausgaben →` as one word, Home's date leaving the screen.
 * None of them is visible at 100 %, and none of them is visible to `npm run
 * check`.
 *
 * So the two things are declared here once, in the one place a two-sided row is
 * built, rather than remembered at each call site:
 *
 *  - **A gap that cannot be collapsed.** `gap-s` is a MINIMUM, not a spacing:
 *    while the row has room, `justify-between` still pushes both sides to their
 *    edges and the gap is invisible. It only starts to matter at the width where
 *    the old row started to fail, which is why adding it changes nothing at
 *    100 % and everything at 200 %.
 *  - **Permission to wrap.** `flex-wrap` is what makes the gap keepable. Without
 *    it a row too narrow for its contents has no legal layout and Yoga produces
 *    an illegal one; with it the second side moves to a line of its own and both
 *    stay whole. Two stacked lines are what a heading and its link look like at
 *    200 %, and they are readable, which is the entire requirement.
 *
 * **Why not shrink, which is the other obvious answer.** Shrinking both sides
 * ends in two ellipses touching across a 12 px gap, which is the tab bar's
 * picture in that issue and is the thing being fixed rather than a fix for it.
 * Truncation is acceptable where a separation survives it; a side that can go to
 * its own line does not need to be truncated at all.
 *
 * **And `shrink` on a child is not a way out of the wrap.** This docblock said it
 * was, and it is worth writing down why that was wrong rather than quietly
 * deleting it: flexbox breaks lines BEFORE it flexes. An item whose hypothetical
 * size does not fit moves to the next line, and only then is what is left on a
 * line shrunk to fit. So under `flex-wrap` a `shrink`ing child wraps at exactly
 * the width it would have wrapped at without it. The door's and the profile's
 * label/value rows carry `shrink text-right` on the value and are the measurement:
 * at 200 % the value sits on its own line at the label's left edge, `text-right`
 * drawing nothing, in both appearance settings
 * (`screens/evidence/158-shortfall-rows-at-200-light.webp` and the three beside
 * it). What `shrink` is genuinely for there is the other case — React Native
 * defaults `flexShrink` to 0, so without it a value too wide for the whole row
 * draws outside the card instead of wrapping inside its own column.
 *
 * **What it does not do**: keep the two sides on one line. A caller that needs
 * that needs a different component, and probably needs to know why.
 *
 * **That is deliberately not a prop**, and it could not usefully be one on a
 * child: the wrap belongs to the row, so only the row could refuse it. A
 * `nowrap` prop would hand back the exact defect this component exists to stop,
 * under a name that reads like a layout choice — and no call site wants it, since
 * the rows that do wrap were photographed at 200 % and read whole. The question
 * to answer first is what the row should do when the two sides do not fit, and
 * "stay on one line" is not an answer to it.
 *
 * `__tests__/split-rows.test.ts` holds the app to this one, so a new
 * `justify-between` written by hand fails rather than reaching a device at 200 %
 * unnoticed.
 */
export function SplitRow({ children, align = 'center', className }: SplitRowProps) {
  return (
    <View
      className={['flex-row flex-wrap justify-between gap-s', ALIGN[align], className ?? ''].join(
        ' ',
      )}
    >
      {children}
    </View>
  );
}
