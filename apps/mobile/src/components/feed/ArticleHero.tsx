import { defineMessages, useIntl } from 'react-intl';
import { Pressable } from 'react-native';

import { Bleed, Overline, Thumbnail, Typo } from '@/components/ui';
import { FEEDS } from '@correctiv/app-core/data/feeds.config';
import { formatDateShortDe } from '@correctiv/app-core/lib/format';
import type { FeedItem } from '@correctiv/app-core/types/models';

import { useArticleMeta } from '@/lib/articles/useArticleMeta';

/**
 * The two words the hero adds to a feed item, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/article.ts` (ADR 0026 §6). Everything else on this card
 * is the article's own.
 *
 * `readingTime` is an ICU plural whose two German forms happen to be identical,
 * and it is written out anyway: the unit is invariant in German and is not in
 * English, and a plural spelled as one string is the kind of thing that only
 * looks fine until the second language.
 */
const COPY = defineMessages({
  kickerFallback: { id: 'article.kickerFallback', defaultMessage: 'Investigation' },
  readingTime: {
    id: 'article.readingTime',
    defaultMessage: '{count, plural, one {# min read} other {# min read}}',
    description:
      'Under a headline in the feed. {count} is a number of minutes, and both branches read the same in English because English has no separate singular here; a language that does needs both.',
  },
});

/**
 * The lead research item on Home: edge-to-edge image, kicker, headline, teaser,
 * byline.
 *
 * Three details come from the design draft, which reads as an article opening
 * where this one read as a card. The image runs to the screen edge, the kicker is
 * set type rather than a filled badge (the coral surface competed with the
 * headline), and the byline says who did the work.
 *
 * The draft gives the hero a kicker unconditionally, so a feed without a badge of
 * its own falls back to "Recherche". The main feed deliberately has none, which is
 * the common case and left the hero bare. The byline carries CORRECTIV's own
 * reading time rather than a computed one, and it now comes with the feed item
 * instead of costing a page fetch — see `useArticleMeta` for what that cost on the
 * web target.
 */
export function ArticleHero({
  item,
  onPress,
}: {
  item: FeedItem;
  onPress: (item: FeedItem) => void;
}) {
  const intl = useIntl();
  const { heroImageUrl: imageUrl, readingMinutes } = useArticleMeta(
    item.url,
    item.imageUrl ?? undefined,
    item.readingMinutes,
  );
  const kicker = FEEDS[item.feed]?.badge ?? intl.formatMessage(COPY.kickerFallback);
  const byline = [
    item.author,
    formatDateShortDe(item.publishedAt),
    readingMinutes ? intl.formatMessage(COPY.readingTime, { count: readingMinutes }) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="link"
      accessibilityLabel={item.title}
      className="active:opacity-90"
    >
      <Bleed>
        <Thumbnail uri={imageUrl} aspectRatio={16 / 9} icon="image-outline" />
      </Bleed>
      <Overline label={kicker} color="accent" className="mt-s" />
      <Typo variant="headline-l" className="mt-2xs">
        {item.title}
      </Typo>
      {item.teaser.length > 0 && (
        <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs" numberOfLines={3}>
          {item.teaser}
        </Typo>
      )}
      {byline ? (
        <Typo variant="text-s" color="grey-500" className="mt-2xs">
          {byline}
        </Typo>
      ) : null}
    </Pressable>
  );
}
