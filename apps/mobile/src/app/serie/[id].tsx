import { useLocalSearchParams } from 'expo-router';
import { defineMessages, useIntl } from 'react-intl';
import { ActivityIndicator, FlatList, View, type ListRenderItemInfo } from 'react-native';

import { EpisodeRow } from '@/components/media/EpisodeRow';
import { ScreenHeader, Typo } from '@/components/ui';
import { PODCAST_CHANNELS } from '@correctiv/app-core/data/feeds.config';
import type { PodcastEpisode, PodcastSeries } from '@correctiv/app-core/data/podcasts';
import { formatDateShortDe } from '@correctiv/app-core/lib/format';
import { playEpisode, togglePlay } from '@/lib/audio/player';
import { useEpisodeStatus } from '@/lib/audio/useAudio';
import { usePodcastSeries } from '@/lib/store/core';
import { useColors } from '@/lib/theme';

/**
 * The seven curated shows are known, so the static web export can emit one file per
 * series. Without it /serie/pausenbrot answers 404 on a host without rewrites — the
 * same case as /projekt/<id>.
 */
export function generateStaticParams(): { id: string }[] {
  return PODCAST_CHANNELS.map((handle) => ({ id: handle }));
}

const keyExtractor = (episode: PodcastEpisode) => episode.id;

/**
 * Everything this screen says, in ENGLISH; the German ships in
 * `src/i18n/catalogue/de/series.ts` (ADR 0026 §6).
 *
 * `offlineEpisodes` is the Mediathek's id, not a second one, because it is
 * literally the same note (see where it is rendered below). It is declared there
 * too, with the same default; `npm run i18n:extract --throws` fails if the two
 * ever disagree.
 *
 * `unknownId` carries the quotation marks INSIDE the message rather than around
 * it in the markup. They are part of the sentence, and a language that quotes
 * differently should get its own pair rather than inherit another language's from
 * a template.
 */
const COPY = defineMessages({
  screenTitle: { id: 'series.screenTitle', defaultMessage: 'Podcast series' },
  notFound: { id: 'series.notFound', defaultMessage: 'This series does not exist' },
  unknownId: {
    id: 'series.unknownId',
    defaultMessage: 'Unknown identifier "{id}".',
    description:
      'Shown when the series screen is opened with an identifier no series has. {id} is that identifier, unchanged, in quotation marks. Three other screens say the same under `claim.unknownId`, `diary.unknownId` and `project.unknownId`.',
  },
  noId: {
    id: 'series.noId',
    defaultMessage: 'No identifier was passed.',
    description:
      'Shown when the series screen is opened with no identifier at all. Four other screens say the same thing under callout.detail.noSlug, claim.noId, diary.noId and project.noId.',
  },
  offlineEpisodes: {
    id: 'mediathek.offlineEpisodes',
    defaultMessage: 'No connection. You are seeing sample episodes.',
  },
});

/**
 * One podcast series with its episodes.
 *
 * A FlatList, because an RSS podcast feed has no ceiling — a long-running show
 * carries hundreds of episodes, and this is the heaviest row in the app: every
 * `EpisodeRow` opens its own `useEpisodeStatus` subscription so that a ticking
 * position does not re-render the whole list. Mapped into a ScrollView those
 * subscriptions were all live at once, including for the episodes nobody had
 * scrolled to. See ADR 0012.
 */
export default function SerieScreen() {
  const intl = useIntl();
  const colors = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { series, status } = usePodcastSeries(id ?? '');

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title={intl.formatMessage(COPY.screenTitle)} />

      {!series ? (
        <View className="flex-1 items-center justify-center px-m">
          {status === 'loading' || status === 'idle' ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <>
              <Typo variant="headline-s" className="text-center">
                {intl.formatMessage(COPY.notFound)}
              </Typo>
              <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs text-center">
                {id ? intl.formatMessage(COPY.unknownId, { id }) : intl.formatMessage(COPY.noId)}
              </Typo>
            </>
          )}
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={series.episodes}
          keyExtractor={keyExtractor}
          renderItem={({ item }: ListRenderItemInfo<PodcastEpisode>) => (
            <SeriesEpisodeRow series={series} episode={item} />
          )}
          contentContainerClassName="px-m pt-m pb-2xl"
          ListHeaderComponentClassName="mb-m"
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <Typo variant="headline-l">{series.title}</Typo>
              <Typo variant="text-s" color="accent" className="mt-4xs">
                {series.publisher}
              </Typo>
              <Typo variant="text-m" color="on-canvas-muted" className="mt-s">
                {series.description}
              </Typo>

              {/* The same note the Mediathek shows over its rail. Without it this page is
                  where the offline fallback stops being honest: two seeded episodes read
                  as the whole show. Castopod sends no CORS header (unlike correctiv.org's
                  REST API since ADR 0015), so on the web target
                  this is the normal case, not an edge one. */}
              {status === 'offline' && (
                <Typo variant="text-s" color="on-canvas-muted" className="mt-s">
                  {intl.formatMessage(COPY.offlineEpisodes)}
                </Typo>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

function SeriesEpisodeRow({ series, episode }: { series: PodcastSeries; episode: PodcastEpisode }) {
  const status = useEpisodeStatus(episode.id);

  return (
    <EpisodeRow
      episodeId={episode.id}
      title={episode.title}
      meta={`${formatDateShortDe(episode.date)} · ${episode.durationLabel}`}
      onPress={() => {
        if (status !== 'off') {
          togglePlay();
          return;
        }
        const track = {
          title: episode.title,
          subtitle: `${series.title} · ${series.publisher}`,
          url: episode.audio,
          episodeId: episode.id,
        };
        void playEpisode(track);
      }}
    />
  );
}
