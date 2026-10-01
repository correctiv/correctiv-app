import { Ionicons } from '@expo/vector-icons';
import { defineMessages, useIntl } from 'react-intl';
import { Pressable, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/components/player/MiniPlayer';
import { sizes, useColors } from '@/lib/theme';

/**
 * The five tab labels, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/ui.ts` (ADR 0026 §6).
 *
 * The same five ids are declared in `_layout.tsx` and `_layout.web.tsx`.
 * `i18n:extract --throws` fails if one id carries two different English defaults.
 */
/**
 * The same five ids are declared in `_layout.tsx` and `_layout.web.tsx`.
 * `i18n:extract --throws` fails on one id carrying two different
 * descriptions or defaults, so these are copied verbatim.
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
 * The five tab triggers for the rail, in tab order.
 *
 * Icons are Ionicons — the app's own vocabulary — not SF Symbols or Material
 * Symbols. On a tablet the rail is a layout element, not a phone tab bar,
 * and the app's icons are the consistent choice. See ADR 0070 §3.
 */
const TABS = [
  { name: 'index', icon: 'home', message: COPY.home },
  { name: 'entdecken', icon: 'compass', message: COPY.discover },
  { name: 'mediathek', icon: 'play-circle', message: COPY.mediathek },
  { name: 'mitmachen', icon: 'people', message: COPY.participate },
  { name: 'profil', icon: 'person', message: COPY.profile },
] as const;

export type NavRailProps = {
  /** The active tab's route name. */
  active: string;
  /** Called with the route name when a tab is pressed. */
  onSelect: (name: string) => void;
  /** Safe-area insets to pad the rail's top and bottom. */
  insets?: EdgeInsets;
};

/**
 * The tablet navigation rail: five tab triggers plus the mini player.
 *
 * Width is `sizes.railWidth` (88 px) — justified in that token's doc: at 834 px
 * the centred column's gutter is 107 px, and 88 fits with 19 px to spare.
 */
export function NavRail({ active, onSelect, insets }: NavRailProps) {
  const intl = useIntl();
  const colors = useColors();
  const top = insets?.top ?? 0;
  const bottom = insets?.bottom ?? 0;
  return (
    <View
      className="border-r border-stroke bg-canvas"
      style={{ width: sizes.railWidth, paddingTop: top, paddingBottom: bottom }}
    >
      <View className="flex-1 justify-between">
        <View>
          {TABS.map((tab) => (
            <Pressable
              key={tab.name}
              onPress={() => onSelect(tab.name)}
              className="items-center"
              style={{ minHeight: sizes.tapTarget }}
              accessibilityRole="tab"
              accessibilityLabel={intl.formatMessage(tab.message)}
              accessibilityState={{ selected: active === tab.name }}
            >
              <Ionicons
                name={tab.icon}
                size={24}
                color={active === tab.name ? colors.accent : colors['on-canvas-muted']}
              />
            </Pressable>
          ))}
        </View>
        <MiniPlayer />
      </View>
    </View>
  );
}
