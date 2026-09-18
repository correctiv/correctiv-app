import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';

import { Badge, Thumbnail, Typo } from '@/components/ui';
import { useVideoChannel } from '@/lib/store/core';
import { sizes, useColors } from '@/lib/theme';

/**
 * The row's words, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/mediathek.ts` (ADR 0026 §6).
 *
 * `live` is the badge, and it is declared here AND in
 * `components/media/LiveBanner.tsx` under the same id: two tiles for the same
 * stream carry the same word, and `npm run i18n:extract --throws` fails if one
 * default is ever edited without the other.
 */
const COPY = defineMessages({
  videoOfTheDay: { id: 'mediathek.videoOfTheDay', defaultMessage: 'Video of the day' },
  live: { id: 'mediathek.live', defaultMessage: 'Live' },
  radioPlaying: { id: 'mediathek.radioPlaying', defaultMessage: 'Salon5 Radio is on air' },
  radioTapToListen: {
    id: 'mediathek.radioTapToListen',
    defaultMessage: '24/7 from Bottrop · tap to listen',
  },
});

/** A mark, not a sentence: the channel keeps its name in every language. */
const CHANNEL_FUNFACTS = 'FunFacts';

/**
 * Home media row: video of the day (FunFacts) next to the live radio tile, half
 * and half as in the draft.
 *
 * Both tiles are light here — the dark treatment belongs to the radio banner on
 * the Mediathek screen, which is the place that promises sound. This row had the
 * two inverted, so Home shouted and Mediathek whispered.
 *
 * Via the core's media store, which routes FunFacts to CORRECTIV's PeerTube
 * instance. This app used to pull it from the YouTube Atom feed — the legacy
 * path the core's MEDIA_SOURCE map exists to correct.
 */
export function MediathekReihe({ onOpenMediathek }: { onOpenMediathek: () => void }) {
  const intl = useIntl();
  const colors = useColors();
  const { videos } = useVideoChannel('funfacts');
  const video = videos[0];
  const videoLabel = video?.title ?? intl.formatMessage(COPY.videoOfTheDay);

  return (
    <View className="flex-row gap-s">
      <Pressable
        onPress={onOpenMediathek}
        accessibilityRole="link"
        accessibilityLabel={videoLabel}
        className="flex-1 overflow-hidden rounded-md bg-surface active:opacity-80"
      >
        <Thumbnail
          uri={video?.thumbnailUrl}
          aspectRatio={16 / 9}
          overlay={
            <View
              // On the preview image — hence fixed, not a page surface.
              className="items-center justify-center rounded-full bg-always-dark/70"
              style={{ width: sizes.playOverlay, height: sizes.playOverlay }}
            >
              <Ionicons name="play" size={22} color={colors['always-light']} />
            </View>
          }
        />
        <View className="p-s">
          <Badge label={CHANNEL_FUNFACTS} tone="emphasis" className="mb-2xs" />
          <Typo variant="text-s" weight="semibold" numberOfLines={2}>
            {videoLabel}
          </Typo>
        </View>
      </Pressable>

      <Pressable
        onPress={onOpenMediathek}
        accessibilityRole="link"
        accessibilityLabel={intl.formatMessage(COPY.radioPlaying)}
        className="flex-1 justify-between rounded-md bg-surface p-s active:opacity-80"
      >
        {/* The badge draws the dot itself — a literal ● in the label doubles it. */}
        <Badge label={intl.formatMessage(COPY.live)} tone="live" />
        <View>
          <Ionicons name="radio-outline" size={24} color={colors['on-canvas-muted']} />
          <Typo variant="text-s" weight="semibold" className="mt-2xs">
            {intl.formatMessage(COPY.radioPlaying)}
          </Typo>
          <Typo variant="text-s" color="on-canvas-muted">
            {intl.formatMessage(COPY.radioTapToListen)}
          </Typo>
        </View>
      </Pressable>
    </View>
  );
}
