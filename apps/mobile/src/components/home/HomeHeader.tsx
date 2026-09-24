import { View } from 'react-native';

import { berlinCalendarDate, type Instant } from '@correctiv/app-core/lib/berlin-time';
import { formatDateWeekday } from '@correctiv/app-core/lib/format';

import { Hairline, SplitRow, Typo } from '@/components/ui';
import { useLocale } from '@/lib/store/core';

/**
 * Home's masthead: wordmark left, the fold's date right, hairline below.
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
 */
export function HomeHeader({ instant }: { readonly instant: Instant }) {
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
        <Typo variant="text-s" color="on-canvas-muted">
          {formatDateWeekday(berlinCalendarDate(instant), locale)}
        </Typo>
      </SplitRow>
      <Hairline className="mt-s" />
    </View>
  );
}
