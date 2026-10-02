import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { MiniPlayer } from '@/components/player/MiniPlayer';
import { tabBar } from '@/lib/navigation/tabBar';
import { useTabWords } from '@/lib/navigation/tabWords';
import { sizes, spacingPx, useColors } from '@/lib/theme';

import { ScaledText } from './ScaledText';

export type NavRailProps = {
  /** The active tab's route name. */
  active: string;
  /** Called with the route name when a tab is pressed. */
  onSelect: (name: string) => void;
  /** Safe-area insets to pad the rail's top and bottom. */
  insets?: EdgeInsets;
};

/**
 * The tablet navigation rail: five tab triggers, each an icon over its label as in
 * the phone bar, plus the mini player.
 *
 * The label is the phone bar's: the same `useTabWords()`, `SourceSans3_600SemiBold` at 11,
 * the accent colour and a filled glyph when active. It stays on one line and is not
 * shortened: "Mitmachen", the widest, measures about 44 px at 1 and 51 px at the
 * largest in-app step (1.15) of the 80 px a tab has. Only a system font scale near 1.8
 * clips it, and then the icon and
 * the `accessibilityLabel` still name the tab. The label text is hidden from
 * accessibility because the pressable already carries it.
 *
 * The first tab starts `spacingPx.s` below the top inset, so it clears the status bar.
 *
 * Width is `sizes.railWidth` (88 px). `lib/navigation/railTabs` renders it as the tab bar of a
 * navigator, left of the screens.
 */
export function NavRail({ active, onSelect, insets }: NavRailProps) {
  const colors = useColors();
  const { bar } = tabBar();
  const words = useTabWords();
  const top = insets?.top ?? 0;
  const bottom = insets?.bottom ?? 0;
  return (
    <View
      className="border-r border-stroke bg-canvas"
      style={{
        width: sizes.railWidth,
        paddingTop: top + spacingPx.s,
        paddingBottom: bottom,
      }}
    >
      <View className="flex-1 justify-between">
        <View style={{ gap: spacingPx['2xs'] }}>
          {bar.tabs.map((name) => {
            const word = words[name]!;
            const selected = active === name;
            const tint = selected ? colors.accent : colors['on-canvas-muted'];
            return (
              <Pressable
                key={name}
                onPress={() => onSelect(name)}
                className="items-center justify-center"
                style={{
                  minHeight: sizes.tapTarget,
                  paddingVertical: spacingPx['3xs'],
                  paddingHorizontal: spacingPx['3xs'],
                }}
                accessibilityRole="tab"
                accessibilityLabel={word.label}
                accessibilityState={{ selected }}
              >
                <Ionicons
                  name={selected ? word.icon.ionicon.active : word.icon.ionicon.inactive}
                  size={24}
                  color={tint}
                />
                <ScaledText
                  numberOfLines={1}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                  style={{
                    color: tint,
                    fontFamily: 'SourceSans3_600SemiBold',
                    fontSize: 11,
                    marginTop: spacingPx['4xs'],
                    textAlign: 'center',
                  }}
                >
                  {word.label}
                </ScaledText>
              </Pressable>
            );
          })}
        </View>
        <MiniPlayer />
      </View>
    </View>
  );
}
