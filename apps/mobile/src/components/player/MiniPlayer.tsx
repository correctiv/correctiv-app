import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { defineMessages, useIntl } from 'react-intl';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Hairline, Typo } from '@/components/ui';
import { AUDIO_ERROR_LABELS } from '@correctiv/app-core/stores/audio';
import { formatTimeHm } from '@correctiv/app-core/lib/format';
import { stop, togglePlay } from '@/lib/audio/player';
import { useAudio } from '@/lib/audio/useAudio';
import { sizes, useColors } from '@/lib/theme';

/**
 * The bar's words, in ENGLISH; the German ships in
 * `src/i18n/catalogue/de/player.ts` (ADR 0026 §6).
 *
 * `pause` and `play` are the same two ids `app/player.tsx` declares, because the
 * mini bar and the full player are one player and the button is spoken with one
 * word. See that file for why the declaration is repeated rather than imported.
 *
 * What went wrong is NOT declared here: the audio store carries a code and the
 * core owns the sentence for each one (`AUDIO_ERROR_LABELS`). `error` below is the
 * fallback for the state that should not occur — `status: 'error'` with no code —
 * and is the reason that id survived the lift.
 */
const COPY = defineMessages({
  loading: {
    id: 'player.loading',
    defaultMessage: 'Loading …',
    description:
      "The mini player's state line while a track is loading. video.loading is the same word on the video screen.",
  },
  error: { id: 'player.error', defaultMessage: 'Error' },
  live: { id: 'player.live', defaultMessage: '● LIVE' },
  pause: { id: 'player.pause', defaultMessage: 'Pause' },
  play: { id: 'player.play', defaultMessage: 'Play' },
  open: { id: 'player.open', defaultMessage: 'Open the player' },
  stop: { id: 'player.stop', defaultMessage: 'Stop playback' },
});

/**
 * The bar above the tab bar, for as long as audio is playing. It lives inside the
 * tab layout (as part of the `tabBar` composition), exactly as in the design draft:
 * a row above the tabs, not an overlay over the content.
 *
 * Subscribes to the whole audio state because it shows the position — two renders a
 * second, but only for this one row.
 */
export function MiniPlayer() {
  const intl = useIntl();
  const colors = useColors();
  const { track, status, positionSec, durationSec, error } = useAudio();
  if (!track) return null;

  const live = track.kind === 'radio';
  const playing = status === 'playing';

  const subtitle = () => {
    if (status === 'loading') return intl.formatMessage(COPY.loading);
    if (status === 'error')
      return intl.formatMessage(error ? AUDIO_ERROR_LABELS[error] : COPY.error);
    if (live) return track.subtitle ?? intl.formatMessage(COPY.live);
    const total = durationSec > 0 ? ` / ${formatTimeHm(durationSec)}` : '';
    return `${formatTimeHm(positionSec)}${total}`;
  };

  return (
    <View className="bg-canvas">
      <Hairline />
      <View className="flex-row items-center px-s py-2xs">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={intl.formatMessage(playing ? COPY.pause : COPY.play)}
          onPress={togglePlay}
          className="items-center justify-center rounded-full bg-accent active:opacity-80"
          style={{ width: sizes.iconButton, height: sizes.iconButton }}
        >
          {/* On the button's brand surface, so fixed white rather than the page's. */}
          {status === 'loading' ? (
            <ActivityIndicator color={colors['always-light']} />
          ) : (
            <Ionicons name={playing ? 'pause' : 'play'} size={18} color={colors['always-light']} />
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={intl.formatMessage(COPY.open)}
          onPress={() => router.push('/player')}
          className="ml-s flex-1 active:opacity-70"
        >
          <Typo variant="text-m" weight="semibold" numberOfLines={1}>
            {track.title}
          </Typo>
          <Typo variant="text-s" color={status === 'error' || live ? 'accent' : 'grey-500'}>
            {subtitle()}
          </Typo>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={intl.formatMessage(COPY.stop)}
          onPress={stop}
          className="ml-2xs items-center justify-center active:opacity-70"
          style={{ width: sizes.iconButton, height: sizes.iconButton }}
        >
          <Ionicons name="close" size={20} color={colors['on-canvas-muted']} />
        </Pressable>
      </View>
    </View>
  );
}
