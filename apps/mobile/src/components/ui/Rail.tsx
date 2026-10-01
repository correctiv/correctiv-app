import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { useColumnGutter } from './ContentColumn';
import { useRailDrag } from '@/lib/rail/useRailDrag';
import { spacingPx } from '@/lib/theme';

export type RailProps = {
  children: ReactNode;
  /** Gap between items, as a spacing token. Cards use `s`, chips `xs`. */
  gap?: keyof typeof spacingPx;
};

/**
 * A horizontally scrolling row that runs to the window edge, with its first item on
 * the column's.
 *
 * The scroller is bled out of the text column and the gutter moved inside it
 * — the arrangement the draft uses (`overflow-x-auto` with `px-[16px]`). Kept
 * inside the column instead, the row clips its content 24px early: the next card
 * ends in mid-air short of the edge, which reads as a layout fault rather than as
 * "there is more this way".
 *
 * **`useRailDrag` is the whole of the web target's difference**, and on iOS and
 * Android it is a no-op that hands `ScrollView` no ref. A finger scrolls this
 * row; a mouse had nothing at all, and `lib/rail/useRailDrag.web.ts` has the
 * measurement and the argument.
 */
export function Rail({ children, gap = 's' }: RailProps) {
  const drag = useRailDrag();
  const gutter = useColumnGutter();
  return (
    <View style={{ marginHorizontal: -gutter }}>
      <ScrollView
        ref={drag}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: spacingPx[gap] }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
