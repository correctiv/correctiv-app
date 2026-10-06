import { router, Slot, usePathname } from 'expo-router';
import { useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabBar, TAB_BAR_HEIGHT } from '@/components/ui/BottomTabBar';
import { NavRail } from '@/components/ui/NavRail';
import { MiniPlayer } from '@/components/player/MiniPlayer';
import { useTabBarDecision } from '@/lib/navigation/tabBar';
import { activeTabOf, tabHref } from '@/lib/navigation/tabRoutes';
import { sizes } from '@/lib/theme';

/**
 * The shell around every screen: the bar, the rail on a tablet, and the mini player.
 *
 * **One file for every platform, and a bar the app draws.** The system's tab bar needs a
 * route file per tab, and a tab is a screen now, an address `/s/<id>` that a document
 * brings and a document takes away
 * ([ADR 0079](../../../../../adr/0079-the-app-draws-its-tabs-from-the-layout.md)). What the
 * platform's bar gave, and this one does not, is listed there. The design draft's own bar is
 * what the web always had, so the three targets are one product now.
 *
 * What it draws follows `kind`: no screen is the empty state with no bar, one screen is that
 * screen with no bar, and two or more is the bar, or the rail from `sizes.railBreakpoint` up.
 * A screen the layout carries is a tab, a row behind "Mehr", or an address that leads
 * nowhere, and nothing here knows which; the core's arrangement does.
 *
 * `Slot` and no navigator, so a tab press is a navigation to an address and the history,
 * the back button and the URL are the router's. A tab does not keep its scroll position,
 * which the navigator did and this does not: the screens are documents and re-draw cheaply.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { bar } = useTabBarDecision();
  const drawn = bar.kind === 'tabs';
  const rail = drawn && width >= sizes.railBreakpoint;
  const active = activeTabOf(pathname, bar);
  const select = (tab: string) => {
    if (tab !== active) router.navigate(tabHref(tab) as never);
  };
  const barHeight = drawn && !rail ? TAB_BAR_HEIGHT + insets.bottom : 0;

  return (
    <View className="flex-1 flex-row">
      {rail ? <NavRail active={active} onSelect={select} insets={insets} /> : null}
      <View className="flex-1">
        <View className="flex-1">
          <Slot />
        </View>
        {drawn && !rail ? (
          <BottomTabBar active={active} onSelect={select} bottomInset={insets.bottom} />
        ) : null}
        {/*
          The mini player sits ON TOP of the tab bar, the arrangement the design draft uses,
          as an overlay and NOT through a navigator's `tabBar` prop: importing
          `BottomTabBar` from `expo-router/tabs` pulled a second React instance into the bundle
          and the app died on startup with React error #321 (ADR 0004). On the rail it lives in
          the rail. `box-none` lets taps through while nothing is playing, when MiniPlayer
          renders null and this is an empty, invisible row.
        */}
        {rail ? null : (
          <View
            pointerEvents="box-none"
            className="absolute left-0 right-0"
            style={{ bottom: barHeight }}
          >
            <MiniPlayer />
          </View>
        )}
      </View>
    </View>
  );
}
