import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { sizes, spacingPx } from '@/lib/theme';

/**
 * Caps a screen's content at the reading width and centres it; a phone is narrower.
 *
 * A screen whose scroller IS the content — a `FlatList`, whose height belongs to the
 * list — states the same cap on the scroller's own `contentContainerStyle` instead of
 * wearing one of these, because a `View` around the list would take the height away
 * from it. `content-column.test.ts` holds both spellings to every screen.
 */
export function ContentColumn({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={['w-full self-center', className ?? ''].join(' ')}
      style={{ maxWidth: sizes.contentColumn }}
    >
      {children}
    </View>
  );
}

/**
 * How far the column's edge sits from the window's, for a padded `Screen`: its
 * `px-m`, plus half of whatever the window has beyond the column.
 */
export function columnGutter(windowWidth: number): number {
  const spare = windowWidth - 2 * spacingPx.m - sizes.contentColumn;
  return spacingPx.m + Math.max(0, spare / 2);
}

/**
 * The gutter of the space the screens are given: from `sizes.railBreakpoint` up the
 * left rail takes `sizes.railWidth` of the window beside them.
 */
export function useColumnGutter(): number {
  const { width } = useWindowDimensions();
  return columnGutter(width >= sizes.railBreakpoint ? width - sizes.railWidth : width);
}
