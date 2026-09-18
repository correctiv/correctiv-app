import { router } from 'expo-router';
import { defineMessages, useIntl } from 'react-intl';
import { View } from 'react-native';

import { EpisodeRow } from '@/components/media/EpisodeRow';
import { LiveBanner } from '@/components/media/LiveBanner';
import { MediaCard } from '@/components/media/MediaCard';
import { SeriesTile } from '@/components/media/SeriesTile';
import { Rail, Screen, SectionHeader, Typo } from '@/components/ui';
import { bonusMedia, type BonusMedia } from '@correctiv/app-core/data/backstage';
import type { PodcastSeries } from '@correctiv/app-core/data/podcasts';
import type { YoutubeKey } from '@correctiv/app-core/stores/media';
import type { Video } from '@correctiv/app-core/types/models';
import { playEpisode, togglePlay } from '@/lib/audio/player';
import { useEpisodeStatus } from '@/lib/audio/useAudio';
import { useCoreActions, usePodcastLibrary, useVideoChannel } from '@/lib/store/core';

/**
 * Everything this screen says, in one place, in ENGLISH — the German that ships
 * is `packages/catalogue/src/de/mediathek.ts` (ADR 0026 §6).
 *
 * `offlineEpisodes` is declared here AND in `app/serie/[id].tsx`, under the same
 * id and with the same default: it is one sentence shown in two places, and the
 * series page's comment says so. Declaring it twice rather than importing keeps
 * each screen readable on its own, and it cannot drift — `npm run i18n:extract`
 * runs with `--throws`, which fails on one id carrying two different defaults.
 */
const COPY = defineMessages({
  liveSubtitle: {
    id: 'mediathek.liveSubtitle',
    defaultMessage: '24/7 from Bottrop, by young people for young people',
  },
  podcasts: { id: 'mediathek.podcasts', defaultMessage: 'Podcasts' },
  offlineEpisodes: {
    id: 'mediathek.offlineEpisodes',
    defaultMessage: 'No connection. You are seeing sample episodes.',
  },
  fromBackstage: { id: 'mediathek.fromBackstage', defaultMessage: 'From Backstage' },
  videosUnavailable: {
    id: 'mediathek.videosUnavailable',
    defaultMessage: 'Videos cannot be reached at the moment.',
  },
});

/**
 * The names that are marks rather than sentences, so they carry no id: the
 * screen's own product name, the two video channels, and the club shelf a bonus
 * track is filed under on the lock screen. A catalogue entry mapping FunFacts to
 * FunFacts is a line for a translator to wonder about (the same call
 * `components/gate/LoginGate.tsx` makes for the wordmark).
 *
 * **`CHANNEL_GESPRAECH` is why this file is still on the not-yet-migrated list in
 * `__tests__/localisation-seam.test.ts`, and it is the only reason.** It is a
 * name, so it gets no id; it carries an umlaut, so the check — which reads
 * characters and cannot tell a name from a sentence — sees German in a screen.
 * An id would not help either, because a mark's `defaultMessage` IS the German
 * spelling and would sit in this file all the same. The two real ways out are a
 * line-level exception in that check, or a display name for each channel in
 * `@correctiv/app-core/data/feeds.config`, where `FEEDS` already keeps a badge
 * per feed and where nothing under `apps/mobile/src` is being checked.
 */
const MEDIATHEK = 'Mediathek';
const CHANNEL_GESPRAECH = 'CORRECTIV im Gespräch';
const CHANNEL_FUNFACTS = 'FunFacts';
const BONUS_SHELF = 'Backstage · Club';

/**
 * Mediathek — everything audible and watchable: live radio, the Salon5 podcasts
 * (Castopod), two video channels and the club's Backstage bonus track.
 *
 * All four sources are live; only the Backstage bonus is sample data with bundled
 * audio, because it exists to show the club preview flow.
 */
export default function MediathekScreen() {
  const intl = useIntl();
  const podcasts = usePodcastLibrary();

  return (
    <Screen>
      <Typo variant="headline-xl" className="mb-s">
        {MEDIATHEK}
      </Typo>

      <LiveBanner subtitle={intl.formatMessage(COPY.liveSubtitle)} />

      <View className="mt-l">
        <SectionHeader title={intl.formatMessage(COPY.podcasts)} className="mb-s" />
        {podcasts.status === 'offline' && (
          <Typo variant="text-s" color="on-canvas-muted" className="mb-2xs">
            {intl.formatMessage(COPY.offlineEpisodes)}
          </Typo>
        )}
        <Rail>
          {podcasts.series.map((series) => (
            <SeriesTile key={series.id} series={series} onPress={openSeries} />
          ))}
        </Rail>
      </View>

      <VideoRail title={CHANNEL_GESPRAECH} channel="gespraech" />
      <VideoRail title={CHANNEL_FUNFACTS} channel="funfacts" />

      <View className="mt-l">
        <SectionHeader title={intl.formatMessage(COPY.fromBackstage)} />
        {/* No club label here: every row already carries the yellow Club badge, and a
            coral one above them said the same word twice in the wrong colour — coral
            is the journalism CTA, yellow is the club (see ui/Button.tsx). */}
        <View className="mt-2xs">
          {bonusMedia.map((bonus) => (
            <BonusRow key={bonus.id} bonus={bonus} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function VideoRail({ title, channel }: { title: string; channel: YoutubeKey }) {
  const intl = useIntl();
  const { videos, status } = useVideoChannel(channel);
  const actions = useCoreActions();

  const openVideo = (video: Video) => {
    // The core store owns the HLS resolution; the route reads it.
    void actions.video.play(video);
    router.push('/video');
  };

  return (
    <View className="mt-l">
      <SectionHeader title={title} className="mb-s" />
      {status === 'error' && videos.length === 0 ? (
        <Typo variant="text-s" color="on-canvas-muted">
          {intl.formatMessage(COPY.videosUnavailable)}
        </Typo>
      ) : (
        <Rail>
          {videos.slice(0, 6).map((video) => (
            <MediaCard key={video.id} video={video} onPress={openVideo} />
          ))}
        </Rail>
      )}
    </View>
  );
}

/**
 * The club's bonus audio, played in full. The 60-second preview this comment used to
 * describe was dropped on 2026-08-06 (ADR 0006), and the note that named the
 * distinction went with ADR 0018, since behind the door there is nobody on the other
 * side of it. The CLUB badge stays as a label.
 */
function BonusRow({ bonus }: { bonus: BonusMedia }) {
  const status = useEpisodeStatus(bonus.id);

  const track = {
    title: bonus.title,
    subtitle: BONUS_SHELF,
    url: bonus.source,
    episodeId: bonus.id,
  };

  return (
    <EpisodeRow
      episodeId={bonus.id}
      title={bonus.title}
      meta={bonus.durationLabel}
      club={bonus.club}
      onPress={() => {
        // If this episode is already loaded, the tap is play/pause, not a restart.
        if (status !== 'off') {
          togglePlay();
          return;
        }
        void playEpisode(track);
      }}
    />
  );
}

function openSeries(series: PodcastSeries) {
  router.push({ pathname: '/serie/[id]', params: { id: series.id } });
}
