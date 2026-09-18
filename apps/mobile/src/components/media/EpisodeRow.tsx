import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Badge, Typo } from '@/components/ui';
import { useEpisodeStatus } from '@/lib/audio/useAudio';
import { sizes, useColors } from '@/lib/theme';

/**
 * The row's spoken names, in ENGLISH; the German ships in
 * `src/i18n/catalogue/de/mediathek.ts` (ADR 0026 §6). The row shows no words of
 * its own — these two are what a screen reader says instead of "button".
 */
const COPY = defineMessages({
  pause: {
    id: 'mediathek.pauseEpisode',
    defaultMessage: 'Pause {title}',
    description:
      "The accessible name of a whole episode row, which is itself the pause control; the row shows no words of its own. Read aloud and never seen. {title} is the episode's title.",
  },
  play: {
    id: 'mediathek.playEpisode',
    defaultMessage: 'Play {title}',
    description:
      "The accessible name of a whole episode row, which is itself the play control; the row shows no words of its own. Read aloud and never seen. {title} is the episode's title.",
  },
});

/** A mark, not a sentence: the club keeps its name in every language. */
const CLUB = 'Club';

/**
 * One episode in a list: play/pause on the left, title and meta, club mark on the
 * right.
 *
 * The state arrives through `useEpisodeStatus(id)` — a primitive value, so that a
 * ticking position does not re-render every row in the list twice a second.
 */
export function EpisodeRow({
  episodeId,
  title,
  meta,
  club = false,
  onPress,
}: {
  episodeId: string;
  title: string;
  meta: string;
  club?: boolean;
  onPress: () => void;
}) {
  const intl = useIntl();
  const colors = useColors();
  const status = useEpisodeStatus(episodeId);
  const playing = status === 'playing';
  const loading = status === 'loading';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={intl.formatMessage(playing ? COPY.pause : COPY.play, { title })}
      className="flex-row items-center border-b border-stroke py-s active:opacity-70"
    >
      <View
        className="mr-s items-center justify-center rounded-full bg-surface"
        style={{ width: sizes.iconButtonSmall, height: sizes.iconButtonSmall }}
      >
        {loading ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={16}
            color={status === 'off' ? colors['on-canvas'] : colors.accent}
          />
        )}
      </View>
      <View className="flex-1 pr-s">
        <Typo variant="text-m" weight="semibold" numberOfLines={2}>
          {title}
        </Typo>
        <Typo variant="text-s" color="grey-500" className="mt-4xs">
          {meta}
        </Typo>
      </View>
      {club && <Badge label={CLUB} tone="club" />}
    </Pressable>
  );
}
