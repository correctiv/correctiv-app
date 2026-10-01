// The now-playing strip above the tabs — as Adwaita widgets, not as a redrawn phone.
//
// ## Why this is not `components/player/MiniPlayer`
//
// The phone's strip is a `View` with a `Pressable`, a round accent circle and two
// `Typo`s, and every one of those would come through the shims as a `Gtk.Box` with a
// minted CSS class. That works, and it produces a GNOME window with a React Native
// bar in it. GTK already HAS this widget vocabulary: `.toolbar` is Adwaita's own style
// class for exactly this strip, `.circular` and `.suggested-action` are what a play
// button wears, `.heading` and `.caption dim-label` are the title/subtitle pair. So
// this is built from those instead, and it inherits the platform's padding, focus
// rings, hover states and dark-mode colours rather than restating them.
//
// The STATE is shared: the core's audio slice, the same selectors the phone's strip
// uses, and the same actions. Only the drawing is native.
//
// ## Where it renders
//
// `<Tabs bottomBar={…}>`, which is a seam that did not exist until gjsify#1617: the
// switcher is created with `slot: 'title'` and resolves against the PARENT, so a box
// placed between the tab layout and the header bar takes the switcher's slot away.
// With the prop, `Adw.ToolbarView` carries this bar and the view switcher bar
// together, and the router renders this one FIRST — measured on libadwaita 1.9.3, the
// first-added bottom bar sits closer to the content, so this lands above the tabs
// exactly as it does on the phone.
//
// ## Nothing playing costs nothing
//
// This returns `null` when there is no track, and the router's wrapper box is then an
// empty bottom bar. MEASURED: an empty `Gtk.Box` as a bottom bar takes no height and
// the view stack above it is allocated identically — so the strip is absent rather
// than a collapsed remnant, with no `reveal` animation to arrange.
//
// ## What the phone has here and this does not
//
// NO ARTWORK. The phone's strip has none either, so this is parity rather than a gap —
// noted only because MPRIS does publish `mpris:artUrl`, and the shell's own media
// widget therefore shows a cover this bar does not.

import { router } from 'expo-router';

import { formatTimeHm } from '@correctiv/app-core/lib/format';
import type { AudioError } from '@correctiv/app-core/stores/audio';
import { stop, togglePlay } from '@/lib/audio/player';
import { useAudio } from '@/lib/audio/useAudio';

/**
 * Adwaita's icon names, not the app's Ionicons vocabulary.
 *
 * A symbolic icon from the theme follows the accent colour and the scheme on its own,
 * which is the whole point of drawing this bar natively.
 */
const PLAY_ICON = 'media-playback-start-symbolic';
const PAUSE_ICON = 'media-playback-pause-symbolic';

/**
 * The core's three audio codes, in German, because this bar is drawn here.
 *
 * The core stopped carrying a formatted `errorMessage` and now carries the CODE plus
 * `AUDIO_ERROR_LABELS`, which are react-intl descriptors the phone renders through its
 * `IntlProvider`. Those descriptors are the place the sentences live, and their
 * `defaultMessage` is English — so reading one here would put an English sentence in
 * front of a German-speaking listener, which is the one thing `AGENTS.md` is explicit
 * about. This host has no provider, so it keeps the three sentences itself.
 *
 * `Record<AudioError, string>` and not a lookup with a fallback: a fourth code added
 * to the core fails to compile here until somebody writes what it says, which is the
 * property the core's own comment claims for `AUDIO_ERROR_LABELS` and the reason not
 * to replace this with `?? 'Fehler'`.
 */
const AUDIO_ERRORS: Record<AudioError, string> = {
  'unsupported-platform': 'Wiedergabe ist auf dieser Plattform nicht verfügbar.',
  'start-failed': 'Wiedergabe konnte nicht gestartet werden. Bitte prüfen Sie Ihre Verbindung.',
  interrupted: 'Wiedergabe wurde unterbrochen. Bitte prüfen Sie Ihre Verbindung.',
};

export function MiniPlayer() {
  const { track, status, positionSec, durationSec, error } = useAudio();
  if (track === null) return null;

  const live = track.kind === 'radio';
  const playing = status === 'playing';
  const loading = status === 'loading';

  /** The second line: the state while it is not yet playing, the clock once it is. */
  const subtitle = (): string => {
    if (loading) return 'Lädt …';
    if (status === 'error') return error === null ? 'Fehler' : AUDIO_ERRORS[error];
    if (live) return track.subtitle ?? '● LIVE';
    const total = durationSec > 0 ? ` / ${formatTimeHm(durationSec)}` : '';
    return `${formatTimeHm(positionSec)}${total}`;
  };

  return (
    <gtk-box cssClasses={['toolbar']} spacing={6} hexpand>
      {/* `suggested-action` paints it in the SYSTEM accent, and on this machine that is
          blue — measured, `Adw.StyleManager.accentColor` is 0 (BLUE) with
          `systemSupportsAccentColors` true on libadwaita 1.9.3. So the button does NOT
          match the brand red the banner above it uses, and it is left that way on
          purpose: a GNOME application follows the accent its user chose.

          ~~The brand red is not available anyway, because `Adw.AccentColor` is an
          enum.~~ IT IS AVAILABLE — that enum is for READING the system's choice, and
          the accent reaches widgets as CSS. MEASURED with `debug/accent-probe.ts`: a
          provider setting `:root { --accent-color: #ff5c5c }` moves a resolved accent
          reading from the system blue to exactly `1.000 0.361 0.361`, the requested
          colour. So this is a real choice between following the user and branding the
          window, not a limitation. README.md carries it. */}
      <gtk-button
        cssClasses={['circular', 'suggested-action']}
        iconName={playing ? PAUSE_ICON : PLAY_ICON}
        tooltipText={playing ? 'Pausieren' : 'Abspielen'}
        sensitive={!loading}
        onClicked={togglePlay}
      />

      {/* A FLAT BUTTON rather than a box with a gesture: it is the whole title area
          and it navigates, so it should take focus, answer the keyboard and show a
          hover state — all of which `Gtk.Button` brings and a box does not. */}
      <gtk-button
        cssClasses={['flat']}
        hexpand
        tooltipText="Player öffnen"
        onClicked={() => router.push('/player')}
      >
        <gtk-box orientation={'vertical' as never} halign={'fill' as never}>
          {/* `ellipsize` and not `numberOfLines={1}`: this is Pango's own one-line
              answer, and it keeps a long episode title from setting the window's
              minimum width — which is what a wrapping label in a fixed strip does. */}
          <gtk-label
            cssClasses={['heading']}
            label={track.title}
            ellipsize={'end' as never}
            xalign={0}
            hexpand
          />
          <gtk-label
            cssClasses={status === 'error' || live ? ['caption'] : ['caption', 'dim-label']}
            label={subtitle()}
            ellipsize={'end' as never}
            xalign={0}
            hexpand
          />
        </gtk-box>
      </gtk-button>

      <gtk-button
        cssClasses={['flat', 'circular']}
        iconName="window-close-symbolic"
        tooltipText="Wiedergabe beenden"
        onClicked={stop}
      />
    </gtk-box>
  );
}
