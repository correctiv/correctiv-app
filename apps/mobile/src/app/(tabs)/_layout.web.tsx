import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { defineMessages, useIntl } from 'react-intl';
import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/components/player/MiniPlayer';
import { spacingPx, useColors } from '@/lib/theme';

/**
 * The web tab bar, and the reason there are two of these files.
 *
 * `_layout.tsx` is native tabs, which is the whole point: on a phone the tab bar is
 * the one control a user already knows, and it should be the system's rather than a
 * drawing of one. The web has no system tab bar to borrow — expo-router's web
 * implementation of native tabs is 74 lines that render labels and NO icons — so
 * borrowing nothing is the wrong trade here. The web keeps the drawn tab bar, which
 * is the design draft's, and which is the better answer for this platform rather
 * than a consolation prize for it.
 *
 * That makes web a target with its own layout rather than a phone build that fell
 * short, which is what it has to be: it is published on every push to `main` and is
 * how most people will ever see this app.
 *
 * These two files share the routes and the MiniPlayer, and nothing else. Keep the
 * tab ORDER identical — it is the same information architecture, only drawn twice.
 */

type IoniconName = keyof typeof Ionicons.glyphMap;

/**
 * The five tab labels, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/ui.ts` (ADR 0026 §6).
 *
 * **The same five ids are declared in `_layout.tsx`, with the same defaults.** The two
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

/**
 * An explicit height, because the mini player has to sit exactly on top of the tab
 * bar and needs a value both sides agree on. Left unset, react-navigation adds the
 * safe area itself — here both are done by hand.
 *
 * This is still true on web, where we draw the bar ourselves and therefore know its
 * height. On native it is not, which `_layout.tsx` has to deal with.
 */
const TAB_BAR_HEIGHT = 56;

function tabIcon(active: IoniconName, inactive: IoniconName) {
  const TabIcon = ({
    focused,
    color,
    size,
  }: {
    focused: boolean;
    color: ColorValue;
    size: number;
  }) => <Ionicons name={focused ? active : inactive} size={size} color={color} />;
  TabIcon.displayName = `TabIcon(${active})`;
  return TabIcon;
}

export default function TabsLayout() {
  const intl = useIntl();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const barHeight = TAB_BAR_HEIGHT + insets.bottom;

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{
          headerShown: false,
          /**
           * Bottom tabs default to `animation: 'none'` — the screen is simply
           * replaced, which on five sibling tabs reads as a redraw rather than a
           * move. 'shift' slides the outgoing and incoming screen against each
           * other in the direction of the tab order, so a switch looks like one.
           */
          animation: 'shift',
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors['grey-500'],
          // Page surface, hairline on top, no shadow — as the design draft has it.
          tabBarStyle: {
            backgroundColor: colors['canvas'],
            borderTopColor: colors['stroke'],
            borderTopWidth: 1,
            elevation: 0,
            height: barHeight,
            paddingBottom: insets.bottom,
          },
          tabBarLabelStyle: { fontFamily: 'SourceSans3_600SemiBold', fontSize: 11 },
          /**
           * A minimum gap between two tabs, which is the same thing `ui/SplitRow`
           * gives every two-sided row this app draws
           * ([#158](https://github.com/correctiv/correctiv-app/issues/158)). On
           * the native bar five German labels run into each other above 130 %
           * system font; here they cannot, because **the web has no system font
           * scale**. React Native Web draws in px and a browser's zoom scales the
           * whole page, text and layout together, so the ratio that breaks the
           * Material bar never changes. This is therefore a guard rather than a
           * fix for something photographed, and it is cheap: the labels have room
           * to spare at every size the demo is looked at.
           *
           * **Not the native file's font-scale rule.** React Native Web's
           * `Dimensions` hard-codes `fontScale: 1`, so the condition that hides
           * the labels over there could never fire here — it would be a branch
           * that reads as a decision and is dead.
           */
          tabBarItemStyle: { paddingHorizontal: spacingPx['3xs'] },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: intl.formatMessage(COPY.home),
            tabBarIcon: tabIcon('home', 'home-outline'),
          }}
        />
        <Tabs.Screen
          name="entdecken"
          options={{
            title: intl.formatMessage(COPY.discover),
            tabBarIcon: tabIcon('compass', 'compass-outline'),
          }}
        />
        <Tabs.Screen
          name="mediathek"
          options={{
            title: intl.formatMessage(COPY.mediathek),
            tabBarIcon: tabIcon('play-circle', 'play-circle-outline'),
          }}
        />
        <Tabs.Screen
          name="mitmachen"
          options={{
            title: intl.formatMessage(COPY.participate),
            tabBarIcon: tabIcon('people', 'people-outline'),
          }}
        />
        <Tabs.Screen
          name="profil"
          options={{
            title: intl.formatMessage(COPY.profile),
            tabBarIcon: tabIcon('person', 'person-outline'),
          }}
        />
      </Tabs>

      {/*
        The mini player sits ON TOP of the tab bar, the arrangement the design
        draft uses.

        As an overlay, and NOT through the `tabBar` prop with `BottomTabBar`.
        That import from `expo-router/tabs` pulls a second React instance into the
        bundle, and the whole app dies on startup with React error #321, "invalid
        hook call", past a green build, a green typecheck and green tests. Found in
        the browser, see ADR 0004.

        `box-none` lets taps through while nothing is playing, when MiniPlayer
        renders null and this is an empty, invisible row.
      */}
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0"
        style={{ bottom: barHeight }}
      >
        <MiniPlayer />
      </View>
    </View>
  );
}
