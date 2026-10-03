import { View } from 'react-native';

import { berlinCalendarDate, type Instant } from '@correctiv/app-core/lib/berlin-time';
import { formatDateWeekday } from '@correctiv/app-core/lib/format';

import { Hairline, SplitRow, Typo } from '@/components/ui';
import { useLocale } from '@/lib/store/core';

/**
 * The mark a screen can be headed with instead of its name: wordmark left, the fold's
 * date right, hairline below.
 *
 * It was `HomeHeader`, the one screen's masthead, and it is the `mark` half of the
 * `screen-header` block since [ADR 0075](../../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §6 — the block prints a screen's title, and a screen whose document asks for the mark
 * gets this row in its place. Home is the screen that asks for it today, and the name no
 * longer says so, because the one thing the newsroom can now do is ask for it somewhere
 * else.
 *
 * The date is what makes the screen read as today's edition instead of a static
 * list. The design draft carries it, and the core has had `formatDateWeekday`
 * ("Freitag, 12. Juni 2026" in German) waiting for this one spot. It replaces the
 * fixed tagline, which said the same thing on every launch.
 *
 * **`instant` is the screen's, not this component's own read of the clock.**
 * Reading `new Date()` here answered a different question from the one the fold
 * below it answers: the workbench playhead moves the sections (`useHomeInstant`,
 * `lib/home/clock.ts`) but left the header on the machine's real date, so a
 * simulated evening in October showed a masthead still dated today (#254). The
 * instant is a parameter for the same reason it is one throughout the core
 * (ADR 0039 §8): the screen owns the one clock, and every place that draws a time
 * takes it rather than asking again.
 *
 * `berlinCalendarDate`, not `new Date(instant)`: the document is folded on Berlin's
 * calendar (ADR 0059 §6), and the header names the same day rather than whatever day
 * the device's own zone reads that instant as.
 *
 * **The rule under the row is this component's and not the document's** (ADR 0036 §1,
 * ADR 0075 §6), which is why `date` can be switched off and the hairline cannot.
 */
export function Masthead({
  instant,
  date = true,
}: {
  readonly instant: Instant;
  /** Whether the day is printed beside the mark. The `date` setting of `screen-header`. */
  readonly date?: boolean;
}) {
  const locale = useLocale();
  return (
    <View className="mb-m">
      {/* A `SplitRow`, not a row of its own: the date is the longest string on
          this screen that nobody chose the length of, and at a large system font
          it was the first thing to leave the right edge. Below it the wordmark
          keeps the line and the date takes the one under it. */}
      <SplitRow>
        <Typo variant="text-m" weight="bold" style={{ letterSpacing: 1.5 }}>
          CORRECTIV
        </Typo>
        {date && (
          <Typo variant="text-s" color="on-canvas-muted">
            {formatDateWeekday(berlinCalendarDate(instant), locale)}
          </Typo>
        )}
      </SplitRow>
      <Hairline className="mt-s" />
    </View>
  );
}
