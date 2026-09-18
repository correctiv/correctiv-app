import { View } from 'react-native';

import { Hairline, SplitRow, Typo } from '@/components/ui';
import { formatDateWeekday } from '@correctiv/app-core/lib/format';
import { useLocale } from '@/lib/store/core';

/**
 * Home's masthead: wordmark left, today's date right, hairline below.
 *
 * The date is what makes the screen read as today's edition instead of a static
 * list. The design draft carries it, and the core has had `formatDateWeekday`
 * ("Freitag, 12. Juni 2026" in German) waiting for this one spot. It replaces the
 * fixed tagline, which said the same thing on every launch.
 */
export function HomeHeader() {
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
          {formatDateWeekday(new Date(), locale)}
        </Typo>
      </SplitRow>
      <Hairline className="mt-s" />
    </View>
  );
}
