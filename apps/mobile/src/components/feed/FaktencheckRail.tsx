import { defineMessages, useIntl } from 'react-intl';
import { Pressable } from 'react-native';

import { Badge, Rail, Typo } from '@/components/ui';
import type { FeedItem } from '@correctiv/app-core/types/models';
import { sizes } from '@/lib/theme';

/**
 * The badge every card carries, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/home.ts` (ADR 0026 §6). The headlines are the articles'.
 */
const COPY = defineMessages({
  badge: {
    id: 'home.factCheckBadge',
    defaultMessage: 'Fact check',
    description:
      "The badge on a card in the home screen's fact-check rail. core.reader.factcheckBadge is the same word inside the article document, where it is uppercased.",
  },
});

/** The horizontally scrolling fact-check cards on Home. */
export function FaktencheckRail({
  items,
  onPress,
}: {
  items: FeedItem[];
  onPress: (item: FeedItem) => void;
}) {
  const intl = useIntl();
  if (items.length === 0) return null;
  return (
    <Rail>
      {items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => onPress(item)}
          accessibilityRole="link"
          accessibilityLabel={item.title}
          className="rounded-md border border-stroke bg-canvas p-s active:opacity-80"
          style={{ width: sizes.railCard }}
        >
          <Badge label={intl.formatMessage(COPY.badge)} tone="emphasis" className="mb-2xs" />
          <Typo variant="headline-xs" numberOfLines={4}>
            {item.title}
          </Typo>
        </Pressable>
      ))}
    </Rail>
  );
}
