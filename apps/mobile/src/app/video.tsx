import { useVideoPlayer, VideoView } from 'expo-video';
import { defineMessages, useIntl } from 'react-intl';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { VideoFrame } from '@/components/media/VideoFrame';
import { Button, Overline, ScreenHeader, Typo } from '@/components/ui';
import { formatDateDe, formatMinutesDe } from '@correctiv/app-core/lib/format';
import type { Video } from '@correctiv/app-core/types/models';
import { useVideo } from '@/lib/store/core';
import { openExternal } from '@/lib/openExternal';
import { colors } from '@/lib/theme';

/**
 * Everything this screen says, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/video.ts` (ADR 0026 §6).
 *
 * `views` is an ICU plural. It replaces a `formatNumberDe` call: `#` inside a
 * plural is formatted by the provider's locale, so the thousands separator is
 * still the German one and the count now picks its own noun.
 */
const COPY = defineMessages({
  screenTitle: {
    id: 'video.screenTitle',
    defaultMessage: 'Video',
    description:
      "The video route's name. On the web target it is the browser tab's title; on iOS and Android the header does not draw it, so nobody sees it there. `video.kicker` is the word above the video's own title and `video.frameTitle` names the embed.",
  },
  none: { id: 'video.none', defaultMessage: 'No video selected.' },
  unavailable: { id: 'video.unavailable', defaultMessage: 'Video unavailable' },
  loading: {
    id: 'video.loading',
    defaultMessage: 'Loading …',
    description:
      'On the video screen, in place of the native player while there is no stream address yet. Not the loading state itself, which is a spinner. `player.loading` is the same word in the mini player.',
  },
  today: { id: 'video.today', defaultMessage: 'Today' },
  yesterday: { id: 'video.yesterday', defaultMessage: 'Yesterday' },
  views: {
    id: 'video.views',
    defaultMessage: '{count, plural, one {# view} other {# views}}',
    description: "Under a video's title. {count} is how often it has been watched.",
  },
  newEpisode: { id: 'video.newEpisode', defaultMessage: 'New episode' },
  kicker: {
    id: 'video.kicker',
    defaultMessage: 'Video',
    description:
      "The kicker above a video's title, and only on a video older than seven days: anything newer gets `video.newEpisode` instead. `video.screenTitle` is the same word as the route's name, which on the web target is the browser tab.",
  },
  watchOn: {
    id: 'video.watchOn',
    defaultMessage: 'Watch on {host}',
    description:
      "The button that leaves the app for the platform the video is hosted on. {host} is that platform's host name, such as youtube.com.",
  },
  watchOriginal: { id: 'video.watchOriginal', defaultMessage: 'Watch the original' },
});

/**
 * One screen for both video sources.
 *
 * PeerTube plays natively through expo-video (HLS, adaptive — the renditions are
 * split into video-only and audio-only, and only the master playlist mixes the
 * two). YouTube stays on the nocookie embed, because there is no direct stream
 * there. The core already mirrors that split in `MEDIA_SOURCE`.
 *
 * No path parameter, but the core's `videoStore`: the metadata (title, description,
 * views, HLS url) is too much for a URL, and the store is where the HLS resolution
 * lives anyway. Without a parameter the route also exports as a single file — a
 * `video/[id]` would need `generateStaticParams`, and nobody knows a PeerTube UUID
 * in advance.
 *
 * A deliberate divergence from the earlier design, where the video surface sat
 * ABOVE the tab frames and shrank into a bar when you navigated away. React Native
 * cannot re-parent a video surface without recreating it, which would stop
 * playback. The native answer is picture-in-picture, which expo-video brings
 * along.
 */
export default function VideoScreen() {
  const intl = useIntl();
  const { current, hlsUrl, status } = useVideo();

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title={intl.formatMessage(COPY.screenTitle)} />
      {!current ? (
        <View className="flex-1 items-center justify-center px-m">
          <Typo variant="text-m" color="on-canvas-muted">
            {intl.formatMessage(COPY.none)}
          </Typo>
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* The stage stays dark in both schemes. A video does not sit on a light
              surface, not even in a light app. */}
          <View className="bg-always-dark" style={{ aspectRatio: 16 / 9 }}>
            {current.source === 'peertube' ? (
              <PeertubeStage
                video={current}
                hlsUrl={hlsUrl}
                loading={status === 'loading'}
                failed={status === 'error'}
              />
            ) : (
              <VideoFrame
                uri={`https://www.youtube-nocookie.com/embed/${current.id}?playsinline=1&rel=0`}
              />
            )}
          </View>
          <VideoMeta video={current} />
        </ScrollView>
      )}
    </View>
  );
}

/**
 * Which channel a video came from, as a person would name it.
 *
 * One place for it, because two now need it: the meta block under the stage, and the
 * metadata the system's own media controls display.
 *
 * Both are marks rather than sentences, so neither carries a message id.
 */
const channelOf = (video: Video): string =>
  video.source === 'peertube' ? 'FunFacts' : 'CORRECTIV';

/** The native HLS player. Its own component, because `useVideoPlayer` is a hook. */
function PeertubeStage({
  video,
  hlsUrl,
  loading,
  failed,
}: {
  video: Video;
  hlsUrl: string;
  loading: boolean;
  failed: boolean;
}) {
  const intl = useIntl();
  /**
   * THE SOURCE CARRIES THE METADATA, and that is the only way the system's media
   * controls learn anything about a video.
   *
   * `metadata` is documented as "information which will be displayed in the now playing
   * notification. When undefined the player will display information contained in the
   * video metadata" — and a PeerTube HLS playlist carries nothing worth showing. So the
   * lock screen and Control Center said nothing for a video while saying the right thing
   * for a podcast, which `lib/audio/backend.ts` has done all along through
   * `setActiveForLockScreen`.
   *
   * An object literal here is NOT a new player per render: `useVideoPlayer` keys its
   * shared object on `JSON.stringify` of the parsed source, so it is the CONTENT that
   * has to change, not the identity.
   */
  const source = hlsUrl
    ? {
        uri: hlsUrl,
        metadata: {
          title: video.title,
          artist: channelOf(video),
          artwork: video.thumbnailUrl,
        },
      }
    : null;

  const player = useVideoPlayer(source, (instance) => {
    // OFF BY DEFAULT, which is why the controls never appeared. On Android this also
    // needs `supportsBackgroundPlayback` in the config plugin — see app.json, where the
    // reason is written down beside it.
    instance.showNowPlayingNotification = true;
    instance.play();
  });

  if (!hlsUrl) {
    return (
      <View className="flex-1 items-center justify-center">
        {loading ? (
          <ActivityIndicator color={colors['always-light']} />
        ) : (
          <Typo variant="text-s" color="always-light">
            {intl.formatMessage(failed ? COPY.unavailable : COPY.loading)}
          </Typo>
        )}
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={{ flex: 1 }}
      contentFit="contain"
      nativeControls
      // ACCEPTED, AND PICTURE-IN-PICTURE IS NOT ENABLED YET. These two ask for it; the
      // `expo-video` config plugin has to grant it (`supportsPictureInPicture`), and it
      // does not, so `android:supportsPictureInPicture` is absent from the manifest.
      // Left in place as the declared intent rather than removed, because the decision
      // is open — and worth knowing when it is taken: PiP is about LEAVING THE APP. It
      // does nothing for navigating away from this screen, where `useVideoPlayer`
      // releases the player and playback ends.
      allowsPictureInPicture
      startsPictureInPictureAutomatically
    />
  );
}

/** Kicker, title, source, description, link — the same for both sources. */
function VideoMeta({ video }: { video: Video }) {
  const intl = useIntl();
  const days = daysSince(video.publishedAt);
  const when =
    days <= 0
      ? intl.formatMessage(COPY.today)
      : days === 1
        ? intl.formatMessage(COPY.yesterday)
        : formatDateDe(video.publishedAt);
  const duration = video.durationSec ? formatMinutesDe(video.durationSec) : '';
  const views = video.views != null ? intl.formatMessage(COPY.views, { count: video.views }) : '';
  const channel = channelOf(video);
  const host = (video.url || '').replace(/^https?:\/\//, '').split('/')[0];

  return (
    <View className="px-m pb-2xl pt-m">
      <View className="flex-row items-center">
        <Overline
          label={intl.formatMessage(days <= 7 ? COPY.newEpisode : COPY.kicker)}
          color="accent"
        />
        <Typo variant="text-s" color="grey-500" className="ml-s">
          {[when, duration].filter(Boolean).join(' · ')}
        </Typo>
      </View>

      <Typo variant="headline-l" className="mt-2xs">
        {video.title}
      </Typo>
      <Typo variant="text-s" color="on-canvas-muted" className="mt-2xs">
        {[channel, views].filter(Boolean).join(' · ')}
      </Typo>

      {video.description ? (
        <Typo variant="text-m" color="on-canvas-muted" className="mt-s">
          {video.description}
        </Typo>
      ) : null}

      {video.url ? (
        <Button
          title={
            host
              ? intl.formatMessage(COPY.watchOn, { host })
              : intl.formatMessage(COPY.watchOriginal)
          }
          variant="outline"
          className="mt-m"
          onPress={() => openExternal(video.url)}
        />
      ) : null}
    </View>
  );
}

/** Whole days since publication — drives the kicker and the relative date. */
function daysSince(iso?: string): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - then) / 86400000);
}
