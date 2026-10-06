import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Slot } from 'expo-router';
import { Platform, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabSlots } from '@correctiv/app-core/lib/navigation';

import { MiniPlayer } from '@/components/player/MiniPlayer';
import { LABELS_FIT_UP_TO } from '@/components/ui/BottomTabBar';
import { useStartTabs } from '@/lib/navigation/tabWords';
import { useColors } from '@/lib/theme';

/**
 * The tab bar on iOS and Android is the system's, and it is decided once per start
 * ([ADR 0081](../../../../../adr/0081-the-system-tab-bar-returns-and-is-decided-at-start.md)).
 *
 * It is the one control in the app a user has already learned somewhere else, so it
 * should behave the way every other app on their phone behaves: the press feedback, the
 * scroll-to-top on a second tap, the iOS 26 minimise-on-scroll, the way it grows with the
 * system font size, and a screen that keeps its scroll position. The web has no system bar
 * to borrow and draws its own (`_layout.web.tsx`), live, which is also what the workbench's
 * frame is.
 *
 * **A trigger takes a route name, so a tab is a slot and not a screen.** `index`, `slot-2`
 * to `slot-5` each draw the screen of the n-th entry of the navigation this process started
 * with, and `mehr` is "Mehr". Only the occupied slots are declared. A navigation fetched
 * after the start waits for the next one, because native tabs remount and lose every tab's
 * state when their triggers change.
 *
 * Icons are each platform's own vocabulary, SF Symbols on iOS and Material Symbols on
 * Android, filled for the selected state; the colours come from the token palette, so the
 * bar follows the appearance setting and only its SHAPE is the platform's.
 *
 * A layout with no screen or one has no bar: the first route is the empty state or the
 * screen alone. A wide window has no rail here, which the drawn shell has.
 */

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
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { bar, words } = useStartTabs();
  const slots = tabSlots(bar);
  const IS_IOS = Platform.OS === 'ios';

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

  const tabs =
    bar.kind === 'tabs' ? (
      <NativeTabs
        tintColor={colors.accent}
        backgroundColor={colors['canvas']}
        iconColor={{ default: colors['on-canvas-muted'], selected: colors.accent }}
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
        {slots.map((slot) => {
          const word = words[slot.screen ?? 'mehr']!;
          return (
            <NativeTabs.Trigger key={slot.route} name={slot.route}>
              <NativeTabs.Trigger.Label>{word.label}</NativeTabs.Trigger.Label>
              <NativeTabs.Trigger.Icon sf={word.icon.sf} md={word.icon.md} />
            </NativeTabs.Trigger>
          );
        })}

        {/*
          iOS has a slot for exactly this: the bar above the tab bar that Apple Music and
          Podcasts put the current track in. It is the system's own, so it handles the tab
          bar's height and translucency itself, and on iOS 26 it knows `regular` and
          `inline` placement without being told.

          Android has no counterpart: NativeTabsView.android.js reads no accessory. So the
          two platforms genuinely differ here, and the overlay below is the Android answer
          rather than a fallback.
        */}
        {IS_IOS ? (
          <NativeTabs.BottomAccessory>
            <MiniPlayer />
          </NativeTabs.BottomAccessory>
        ) : null}
      </NativeTabs>
    ) : (
      <Slot />
    );

  if (IS_IOS && bar.kind === 'tabs') return tabs;

  return (
    <View className="flex-1">
      {tabs}
      {/*
        `box-none` lets taps through while nothing is playing, when MiniPlayer renders null
        and this is an empty, invisible row. Without a bar it sits on the inset alone.
      */}
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0"
        style={{
          bottom: (bar.kind === 'tabs' ? ANDROID_TAB_BAR_HEIGHT : 0) + insets.bottom,
        }}
      >
        <MiniPlayer />
      </View>
    </View>
  );
}
