import { Pressable, View } from 'react-native';

import { Typo } from '@/components/ui';
import { formatDate } from '@correctiv/app-core/lib/format';
import type { FeedItem } from '@correctiv/app-core/types/models';
import { useLocale } from '@/lib/store/core';

/** Compact list row for "Neueste Recherchen": title plus meta, no image. */
export function ArticleRow({
  item,
  onPress,
}: {
  item: FeedItem;
  onPress: (item: FeedItem) => void;
}) {
  const locale = useLocale();
  return (
    <Pressable
      onPress={() => onPress(item)}
      /*
       * A LINK, and named by its headline. Without the role TalkBack reads the
       * three lines of this row as text and offers no "double tap to activate",
       * and the rotor does not list it at all — a whole section of Home that a
       * screen reader passes over on its way down (#102).
       *
       * The name is the headline alone: the author and the date below it are
       * spoken after it as the row's own content, and folding them into the name
       * would say them twice.
       */
      accessibilityRole="link"
      accessibilityLabel={item.title}
      className="py-s active:opacity-70"
    >
      <Typo variant="headline-s" numberOfLines={3}>
        {item.title}
      </Typo>
      {/* Two colours, so this cannot be one string like the other meta lines
          (`[a, b].join(' · ')`). The separator therefore has to carry its own
          spacing: a flex `gap` sits only BEFORE it, which left 6px on one side of the
          middot and the 4px of a space character on the other — visibly off-centre.
          Row gap only, and a space either side inside the text. */}
      <View className="mt-3xs flex-row flex-wrap items-center gap-y-2xs">
        {item.author ? (
          <Typo variant="text-s" color="on-canvas-muted">
            {item.author}
          </Typo>
        ) : null}
        {item.publishedAt ? (
          <Typo variant="text-s" color="grey-500">
            {item.author ? ' · ' : ''}
            {formatDate(item.publishedAt, locale)}
          </Typo>
        ) : null}
      </View>
    </Pressable>
  );
}
