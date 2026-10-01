import { Tabs, type BottomTabBarProps, type BottomTabNavigationOptions } from 'expo-router/js-tabs';

import { NavRail } from '@/components/ui/NavRail';

/**
 * The tab bar of a navigator whose bar is the left rail.
 *
 * A press does what react-navigation's own bar does — emit `tabPress` so a listener
 * can veto it, then navigate unless the tab is already focused — so history, the
 * back button and the URL come from the navigator and not from here.
 */
export function renderRailTabBar({ state, navigation, insets }: BottomTabBarProps) {
  const active = state.routes[state.index]?.name ?? 'index';
  return (
    <NavRail
      active={active}
      insets={insets}
      onSelect={(name) => {
        const route = state.routes.find((r) => r.name === name);
        if (!route) return;
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (name !== active && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      }}
    />
  );
}

/** `screenOptions` that put the bar left of the screens; `tabBar` is a navigator prop. */
export const railScreenOptions: BottomTabNavigationOptions = {
  tabBarPosition: 'left',
  animation: 'none',
};

/** The native tablet navigator; the routes are the files beside `_layout.tsx`. */
export function RailTabs() {
  return (
    <Tabs screenOptions={{ headerShown: false, ...railScreenOptions }} tabBar={renderRailTabBar} />
  );
}
