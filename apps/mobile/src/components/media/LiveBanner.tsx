import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Badge, Typo } from '@/components/ui';
import { playRadio, stop } from '@/lib/audio/player';
import { salon5RadioCopy, SALON5_RADIO_COPY } from '@/lib/audio/tracks';
import { useRadioState } from '@/lib/audio/useAudio';
import { useCoreActions, useRadioStation } from '@/lib/store/core';
import { colors, sizes } from '@/lib/theme';

/**
 * The banner's own words, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/mediathek.ts` (ADR 0026 §6). The station's name and its
 * strapline are NOT here: they are `SALON5_RADIO_COPY` in `lib/audio/tracks.ts`,
 * because the lock screen prints the same words and the thunk that starts the
 * stream is handed them from there.
 *
 * `live` is the badge, declared here and in `components/home/MediathekReihe.tsx`
 * under one id; `npm run i18n:extract --throws` fails if one default is edited
 * without the other.
 *
 * `listeners` is an ICU plural and needs `Intl.PluralRules`, which Hermes does
 * not ship — see `src/i18n/polyfills.ts`, which installs it before anything
 * formats.
 */
const COPY = defineMessages({
  live: { id: 'mediathek.live', defaultMessage: 'Live' },
  listeners: {
    id: 'mediathek.listeners',
    defaultMessage: '{count, plural, one {# listener} other {# listeners}}',
    description:
      'Inside the live radio banner, in the row beside the Live badge. {count} is how many people are listening right now.',
  },
  streamUnavailable: {
    id: 'mediathek.streamUnavailable',
    defaultMessage: 'Stream cannot be reached',
  },
  pauseRadio: { id: 'mediathek.pauseRadio', defaultMessage: 'Pause the radio' },
  playRadio: { id: 'mediathek.playRadio', defaultMessage: 'Play the radio' },
});

/**
 * The Salon5 live banner: dark card, big coral play button on the left, as in the
 * draft. It is the one surface on the Mediathek screen that promises sound, so it
 * is the one that gets the dark treatment — the tiles on Home stay light.
 *
 * Dark in BOTH schemes, hence `always-dark` and `always-light` rather than the grey
 * scale: on a surface that does not follow the appearance setting, text that does
 * would turn near-white on near-black in light mode and vanish in dark. Secondary
 * text is the same fixed colour dimmed — the convention for every fixed surface
 * here, so a second grey scale for dark surfaces is not needed.
 *
 * Drives the audio singleton, not a player of its own: otherwise there would be
 * two instances on the same stream, which is exactly what the predecessor
 * (`useRadio`) did.
 *
 * Two statuses meet in the second line, and they are not the same thing.
 * `useRadioState` is our player, so it owns `streamUnavailable` — only a failed
 * attempt to play may say that. `useRadioStation` is the station's own
 * Icecast status, and it contributes the title on air, which is real information
 * the banner never had: the fixed "24/7 aus Bottrop" was true about the stream and
 * silent about what was running on it. When the status document cannot be reached
 * the line falls back to that fixed copy, because not knowing the title is not a
 * fault worth reporting.
 */
export function LiveBanner({ subtitle }: { subtitle?: string }) {
  const intl = useIntl();
  const state = useRadioState();
  const { nowPlaying, listeners } = useRadioStation();
  const actions = useCoreActions();
  const busy = state === 'loading';
  const playing = state === 'playing';

  // The default used to be the parameter's; a default cannot call a hook, so the
  // fixed copy is chosen here instead. Same fallback, same words.
  const fixed = subtitle ?? intl.formatMessage(SALON5_RADIO_COPY.subtitle);
  const line =
    state === 'error' ? intl.formatMessage(COPY.streamUnavailable) : (nowPlaying ?? fixed);

  /**
   * Pressing play also asks the station what it is doing.
   *
   * The status is read once, when something first needs it, and a failure lands
   * on `'unknown'` — which nothing retries, so a Mediathek opened before the
   * network was up would keep the fixed subtitle for the rest of the session.
   * This is the one moment where a second attempt is both wanted and safe: the
   * reader asked for the stream, so they are owed the title, and a press cannot
   * loop the way a status-driven effect could.
   */
  const onPlay = () => {
    if (playing || busy) {
      stop();
      return;
    }
    playRadio(salon5RadioCopy(intl));
    actions.radio.fetchStatus({ force: true });
  };

  return (
    <View className="flex-row items-center rounded-md bg-always-dark p-s">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={intl.formatMessage(playing ? COPY.pauseRadio : COPY.playRadio)}
        onPress={onPlay}
        className="mr-s items-center justify-center rounded-full bg-accent active:opacity-80"
        style={{ width: sizes.playButton, height: sizes.playButton }}
      >
        {busy ? (
          <ActivityIndicator color={colors['always-light']} />
        ) : (
          <Ionicons name={playing ? 'pause' : 'play'} size={24} color={colors['always-light']} />
        )}
      </Pressable>
      <View className="flex-1">
        <View className="mb-4xs flex-row items-center gap-2xs">
          <Badge label={intl.formatMessage(COPY.live)} tone="live" />
          {/* `listenerCount` in the core already answers null for "nobody" and
              for "not known", so there is one condition here rather than two. */}
          {listeners !== null && (
            <Typo variant="text-s" color="always-light" className="opacity-70">
              {intl.formatMessage(COPY.listeners, { count: listeners })}
            </Typo>
          )}
        </View>
        <Typo variant="headline-s" color="always-light">
          {intl.formatMessage(SALON5_RADIO_COPY.title)}
        </Typo>
        {/*
          ONE LINE, and the one change in this file a reader will see on the phone:
          a long now-playing title ellipsizes here instead of taking a second line.

          It is a stream announcing titles nobody chose, and that is what makes the
          second line expensive. A `Gtk.Label` breaks at word boundaries, so its
          minimum width is its longest WORD — and the station announced a track as
          "20260901_Gamescom_Laberpocast_Sophie_Amelie", one token with no break in
          it. At two lines that minimum became the card's, and the card's became
          the window's, so the window could not be made narrower than the filename;
          at one line ellipsizing is allowed to do the work instead. It is not the
          length, it is that the token has no space in it. Measured on the host
          [ADR 0012](../../../../../adr/0012-a-list-virtualizer-for-the-unbounded-lists.md)
          names as a reason, and the pixels are in that host's README on the
          `desktop` branch rather than repeated here.

          On the phone this brings the line into agreement with the other place
          the app shows what is playing rather than what is on offer:
          `MiniPlayer`'s title is one line. `EpisodeRow` keeps two, and that is
          the distinction — an episode title is a thing somebody chose from a
          list, a track announcement is whatever the stream said.

          In the browser it swaps `react-native-web`'s two-line rule for its
          one-line one, eighteen computed properties including `-webkit-line-clamp`
          and `display`. Read off the running target: at 393px only the specimen
          with the unbreakable title changes box, from two lines to one. At 320px
          the ordinary `Sondersendung aus Bottrop` ellipsizes as well, because 25
          characters no longer fit a line at that width. That is the trade, at the
          width where it bites.
        */}
        <Typo variant="text-s" color="always-light" numberOfLines={1} className="opacity-70">
          {line}
        </Typo>
      </View>
    </View>
  );
}
