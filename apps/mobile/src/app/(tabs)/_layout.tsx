import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { defineMessages, useIntl } from 'react-intl';
import { Platform, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/components/player/MiniPlayer';
import { useColors } from '@/lib/theme';

/**
 * The tab bar on iOS and Android is the system's, not ours.
 *
 * It is the one control in the app a user has already learned somewhere else, so it
 * should behave the way every other app on their phone behaves — the press feedback,
 * the scroll-to-top on a second tap, the iOS 26 minimise-on-scroll, the way it grows
 * with the system font size. All of that is free here and was absent from a drawn
 * bar, which only ever imitated it. The web has no system bar to borrow and keeps
 * the drawn one; see `_layout.web.tsx` for why that is a decision and not a
 * shortfall.
 *
 * Icons are each platform's own vocabulary rather than one set stretched across
 * both: SF Symbols on iOS, Material Symbols on Android, with a filled variant for
 * the selected state on each. Ionicons is still what the rest of the app draws with
 * — it is only the tab bar that defers, because the tab bar is the part users read
 * as belonging to the phone rather than to us.
 *
 * The colours still come from the token palette (`useColors`), so the bar follows
 * the appearance setting like everything else. Only its SHAPE is the platform's.
 *
 * See ADR 0013 for what this costs, which is not nothing: the API is alpha, all five
 * tabs now mount eagerly, and the bar's height can no longer be measured.
 */

/**
 * The five tab labels, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/ui.ts` (ADR 0026 §6).
 *
 * **The same five ids are declared in `_layout.web.tsx`, with the same defaults.** The two
 * files draw the bar differently and share nothing they could import a constant
 * through, so the agreement is enforced instead of arranged: `npm run
 * i18n:extract` runs with `--throws`, which fails on one id carrying two
 * different English defaults, and `__tests__/localisation-seam.test.ts` fails if
 * an id loses its German. One set of ids, one German word per tab, on both
 * targets.
 */
const COPY = defineMessages({
  home: { id: 'ui.tabHome', defaultMessage: 'Home' },
  discover: {
    id: 'ui.tabDiscover',
    defaultMessage: 'Discover',
    description:
      'A tab on the tab bar, where there is room for one short word. discover.title is the same word as the heading of the screen it opens.',
  },
  mediathek: { id: 'ui.tabMediathek', defaultMessage: 'Mediathek' },
  participate: {
    id: 'ui.tabParticipate',
    defaultMessage: 'Take part',
    description:
      'A tab on the tab bar, where there is room for one short word. participate.title is the same word as the heading of the screen it opens.',
  },
  profile: {
    id: 'ui.tabProfile',
    defaultMessage: 'Profile',
    description:
      'A tab on the tab bar, where there is room for one short word. profile.title is the same word as the heading of the screen it opens.',
  },
});

const IS_IOS = Platform.OS === 'ios';

/**
 * The system font scale up to which five labels still fit across the bar, and the
 * one number in this file that was measured rather than chosen.
 *
 * Material lays the five items out at a fifth of the width each and lets a label
 * overflow its item, so past a certain size the labels do not ellipsize into their
 * own cells — they run into their neighbours. Photographed on
 * `Medium_Phone_API_36`, 1080x2400 at 420dpi, one shot per step of Android's own
 * slider:
 *
 *  - **1.0, 1.15** — five labels, whole, with clear space between them.
 *  - **1.3** — five labels, whole, the gap down to about two pixels. Still legible,
 *    and this is the last step that is.
 *  - **1.5** — `EntdeckenMediathekMitmach…`. Two labels touching and a third
 *    truncated into the fourth. Nothing says where one ends.
 *  - **2.0** — `Entde…Media…Mitm…`, which is the picture in
 *    [#158](https://github.com/correctiv/correctiv-app/issues/158).
 *
 * Re-measure it rather than trust it: it is a property of these five German words
 * at this screen width, and renaming a tab or shipping a second language moves it.
 *
 * **`__tests__/tab-bar-labels.test.ts` is what makes that sentence able to fail.**
 * It cannot re-measure — no test can put five words on a 1080 px bar and look at
 * them — so it pins the inputs instead: the five German strings in the catalogue,
 * the five ids declared below, this number as written here, and that one language
 * ships. When it goes red the number is not wrong, it is no longer known to be
 * right, and the answer is `OUT=out/a11y bash screens/tools/tour-a11y.sh` rather
 * than an edit to the test. The one input it cannot see is the screen width.
 */
const LABELS_FIT_UP_TO = 1.3;

/**
 * Where the mini player sits on Android. Measured, not guessed — and it was guessed
 * once, which is the reason for the length of this comment.
 *
 * It used to be a value we SET: the drawn bar took `height: 56 + insets.bottom` from
 * this constant, so the bar and the mini player could not disagree. A native bar
 * sizes itself and expo-router's native tabs expose no height (`useBottomTabBarHeight`
 * belongs to the JS tabs; the documentation says layout information is unavailable),
 * so the number had to come from somewhere else. Carrying the 56 over looked free and
 * was not: Material 3's navigation bar is **80dp**, 56 was the Material 2 figure, and
 * the mini player sat 11px INSIDE the tab bar, clipping the selected item's pill.
 *
 * Measured on `Medium_Phone_API_36`, 1080x2400 at 420dpi: the bar occupies
 * y=2126..2337, which is 211px, which is 80.4dp — Material 3's documented height, and
 * it agrees with the spec rather than merely with one device. The 24dp of gesture
 * inset below it is what `insets.bottom` adds at the call site.
 *
 * Two things still move it, and neither is measurable from here: a large system font
 * scale, and `labelVisibilityMode` — under Material's `auto` the same bar measured
 * 60dp, because dropping the labels makes it shorter. Change either and re-measure.
 * **A screenshot of a playing track is the only check that sees this.**
 *
 * **Re-measured on 2026-09-16, because `labelVisibilityMode` below became conditional.**
 * At 100 % the bar is still y=2126..2337, 80.4dp, unchanged. At 200 % it is
 * y=2086..2337, which is 95.6dp — so the mini player sits about 16dp inside it there.
 * Dropping the four unselected labels does **not** shorten the bar the way `auto`
 * does, because the selected item keeps its own label and the bar is as tall as its
 * tallest item. That is the font-scale half of the warning above with a number on it:
 * it was true before this constant met a large font and is not made worse by the
 * change, and it is [#158](https://github.com/correctiv/correctiv-app/issues/158)'s
 * nearest neighbour rather than part of it.
 */
const ANDROID_TAB_BAR_HEIGHT = 80;

export default function TabsLayout() {
  const intl = useIntl();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();

  /**
   * **The tab bar's own answer to #158, because it is the platform's bar.**
   *
   * The rest of that issue is one component, `ui/SplitRow`: a two-sided row that
   * keeps a minimum gap and wraps when it cannot. Nothing of the sort is available
   * here. Material owns this bar's layout, `react-native-screens` exposes its
   * colours, its label visibility and its font, and no padding, no minimum gap and
   * no second line — so the only two levers are the font size and whether there are
   * labels at all.
   *
   * The font size is not a lever. ADR 0033 puts one text size on the whole app with
   * the system's as its default, and names this defect as what has to land before
   * that row can be offered; shrinking the labels to fit would defeat the setting it
   * is being fixed for. So this drops the labels of the four unselected tabs at the
   * scale where they stop being labels, and keeps the selected one, which Material
   * then gives the room it needs.
   *
   * It is a real loss and worth naming: `Entdecken` (a compass) and `Mitmachen`
   * (three figures) are the two nobody can name from the glyph, which is why this
   * bar asks for `labeled` in the first place. What it buys is that at 150 % and
   * above the four glyphs are separated and the fifth says where you are, instead of
   * five labels with no space between them saying nothing. TalkBack is unaffected
   * either way: Material takes each item's `contentDescription` from its title and
   * not from the visible label, so a hidden label is still announced.
   */
  const labelVisibilityMode = fontScale > LABELS_FIT_UP_TO ? 'selected' : 'labeled';

  /*
   * Five triggers, written out rather than mapped. Android's Material tabs cap at
   * five, so this list is at its limit — a sixth is a redesign, not an edit, and
   * spelling them out is what makes that visible at the point where someone would
   * add one.
   */
  const tabs = (
    <NativeTabs
      tintColor={colors.accent}
      backgroundColor={colors['canvas']}
      iconColor={{ default: colors['grey-500'], selected: colors.accent }}
      labelStyle={{ fontFamily: 'SourceSans3_600SemiBold', fontSize: 11 }}
      /*
       * Every destination keeps its label. Material's `auto` — the default — drops
       * the labels of the unselected items once there are four or more, which on
       * this app meant four of five destinations were an icon and nothing else.
       * `Entdecken` (a compass) and `Mitmachen` (three figures) do not survive that:
       * they are the two nobody can name from the glyph.
       *
       * This is still the platform's bar, not ours. `labeled` is one of Material's
       * own four modes, and it is what Material 3's own navigation-bar guidance
       * asks for; `auto`'s drop-the-labels behaviour is the Material 2 rule it
       * inherited. It also keeps this bar and the web one legible in the same way,
       * which is worth something when they are meant to be the same product.
       *
       * Above `LABELS_FIT_UP_TO` it is `selected` instead, for the reason written
       * where that constant is measured: five labels stop fitting long before the
       * system font stops growing, and `auto` is still not the answer — it drops
       * them by tab COUNT, at every size, which is the behaviour this comment was
       * written to refuse.
       */
      labelVisibilityMode={labelVisibilityMode}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{intl.formatMessage(COPY.home)}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md={{ default: 'home', selected: 'home' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="entdecken">
        <NativeTabs.Trigger.Label>{intl.formatMessage(COPY.discover)}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'safari', selected: 'safari.fill' }}
          md={{ default: 'explore', selected: 'explore' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="mediathek">
        <NativeTabs.Trigger.Label>{intl.formatMessage(COPY.mediathek)}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'play.circle', selected: 'play.circle.fill' }}
          md={{ default: 'play_circle', selected: 'play_circle' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="mitmachen">
        <NativeTabs.Trigger.Label>{intl.formatMessage(COPY.participate)}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.2', selected: 'person.2.fill' }}
          md={{ default: 'groups', selected: 'groups' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profil">
        <NativeTabs.Trigger.Label>{intl.formatMessage(COPY.profile)}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md={{ default: 'account_circle', selected: 'account_circle' }}
        />
      </NativeTabs.Trigger>

      {/*
        iOS has a slot for exactly this: the bar above the tab bar that Apple Music
        and Podcasts put the current track in. It is the system's own, so it handles
        the tab bar's height and translucency itself — which is the answer to the
        problem ANDROID_TAB_BAR_HEIGHT above has to guess its way around — and on
        iOS 26 it knows `regular` and `inline` placement without being told.

        Android has no counterpart: NativeTabsView.android.js reads no accessory. So
        the two platforms genuinely differ here, and the overlay below is the Android
        answer rather than a fallback — drawing your own bar above the navigation bar
        is what Android media apps do.
      */}
      {IS_IOS ? (
        <NativeTabs.BottomAccessory>
          <MiniPlayer />
        </NativeTabs.BottomAccessory>
      ) : null}
    </NativeTabs>
  );

  if (IS_IOS) return tabs;

  return (
    <View className="flex-1">
      {tabs}
      {/*
        `box-none` lets taps through while nothing is playing, when MiniPlayer
        renders null and this is an empty, invisible row.
      */}
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0"
        style={{ bottom: ANDROID_TAB_BAR_HEIGHT + insets.bottom }}
      >
        <MiniPlayer />
      </View>
    </View>
  );
}
