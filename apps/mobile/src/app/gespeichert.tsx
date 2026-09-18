import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { FlatList, Pressable, View, type ListRenderItemInfo } from 'react-native';

import { Overline, ScreenHeader, Typo } from '@/components/ui';
import { formatDateShortDe } from '@correctiv/app-core/lib/format';
import type { SavedArticle } from '@correctiv/app-core/stores/savedArticles';
import { openArticle } from '@/lib/openArticle';
import { useCoreActions, useSavedArticles } from '@/lib/store/core';
import { sizes, useColors } from '@/lib/theme';

/**
 * Everything this screen says, in one place.
 *
 * The two rows below carry a placeholder each rather than a join: an article's
 * title and the day it was saved are data, and where they sit in the sentence is
 * the language's business. The day itself is still `formatDateShortDe`, which pins
 * the German pattern on purpose.
 */
const COPY = defineMessages({
  screenTitle: {
    id: 'profile.saved.title',
    defaultMessage: 'Saved articles',
    description:
      'The heading of the saved articles screen. profile.nav.saved is the same words on the row in the profile that opens it.',
  },
  empty: {
    id: 'profile.saved.empty',
    defaultMessage: 'Nothing saved yet. Tap the bookmark in an article to keep it here.',
  },
  savedOn: {
    id: 'profile.saved.savedOn',
    defaultMessage: 'saved {date}',
    description:
      'Under a saved article. {date} is the day it was saved, already formatted, and the line reads as a fragment rather than a sentence.',
  },
  remove: {
    id: 'profile.saved.remove',
    defaultMessage: 'Remove {title}',
    description:
      "The accessible name of the remove button on a saved article, read aloud and never seen. {title} is the article's headline.",
  },
});

const keyExtractor = (article: SavedArticle) => article.url;

const renderSavedRow = ({ item }: ListRenderItemInfo<SavedArticle>) => <SavedRow article={item} />;

/**
 * The empty notice — a component now, where it used to be an element held in a
 * constant. Its sentence is a message, formatting one needs a hook, and only a
 * component may hold one. Still at module scope, so `FlatList` sees the same type
 * on every render just as it saw the same element before.
 */
function Empty() {
  const intl = useIntl();
  return (
    <Typo variant="text-m" color="on-canvas-muted" className="mt-m">
      {intl.formatMessage(COPY.empty)}
    </Typo>
  );
}

/**
 * Saved articles — the same list the bookmark in the reader fills. `savedArticles`
 * in the core, persisted, so it survives a restart.
 *
 * A FlatList rather than a mapped ScrollView, because this is one of the two lists
 * in the app whose length nobody here decides: it is however many articles the
 * reader's bookmark has been tapped on, and it only ever grows. A ScrollView mounts
 * every row up front, and each row costs two hook subscriptions (`useCoreActions`,
 * `useColors`) whether or not it is on screen. See ADR 0012 for why the other lists
 * were left alone.
 */
export default function GespeichertScreen() {
  const items = useSavedArticles();
  const intl = useIntl();

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title={intl.formatMessage(COPY.screenTitle)} />
      <FlatList
        className="flex-1"
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderSavedRow}
        // The heading belongs to the list, not above it: as a sibling it would sit
        // outside the scroller and stay put while the rows moved under it. The gap
        // below it used to belong to the row container and to the empty notice
        // respectively, which is why it is still two different sizes.
        ListHeaderComponent={
          <Typo variant="headline-l" className={items.length > 0 ? 'mb-s' : ''}>
            {intl.formatMessage(COPY.screenTitle)}
          </Typo>
        }
        ListEmptyComponent={Empty}
        contentContainerClassName="px-m pt-m pb-2xl"
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function SavedRow({ article }: { article: SavedArticle }) {
  const actions = useCoreActions();
  const colors = useColors();
  const intl = useIntl();
  return (
    <View className="flex-row items-start border-b border-stroke py-s">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={article.title}
        onPress={() => openArticle(article)}
        className="flex-1 pr-s active:opacity-70"
      >
        {article.kicker ? <Overline label={article.kicker} color="accent" /> : null}
        <Typo variant="text-m" weight="bold" numberOfLines={2} className="mt-4xs">
          {article.title}
        </Typo>
        <Typo variant="text-s" color="grey-500" className="mt-2xs">
          {intl.formatMessage(COPY.savedOn, { date: formatDateShortDe(article.savedAt) })}
        </Typo>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={intl.formatMessage(COPY.remove, { title: article.title })}
        onPress={() => actions.savedArticles.remove(article.url)}
        className="items-center justify-center active:opacity-70"
        /*
         * The box rather than `hitSlop={8}` around a 36 dp one (#102). The slop
         * read as 52 on the phone, as 36 in the browser — and this control sits at
         * the right edge of a row whose left three quarters is a second control
         * that opens the article, so an invisible rectangle around it is exactly
         * the overlap the issue warns about. 44 is drawn, so it cannot overlap.
         */
        style={{ width: sizes.tapTarget, height: sizes.tapTarget }}
      >
        <Ionicons name="close" size={18} color={colors['grey-500']} />
      </Pressable>
    </View>
  );
}
