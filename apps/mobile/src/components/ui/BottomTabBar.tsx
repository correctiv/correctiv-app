import { Ionicons } from '@expo/vector-icons';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { useTabs } from '@/lib/navigation/tabWords';
import { spacingPx, useColors } from '@/lib/theme';

import { ScaledText } from './ScaledText';

/**
 * An explicit height, because the mini player has to sit exactly on top of the tab bar and
 * needs a value both sides agree on. Left unset the bar would be as tall as its tallest
 * label, which grows with the text size. The safe area under it is added by the caller.
 */
export const TAB_BAR_HEIGHT = 56;

/**
 * The system font scale up to which five labels still fit across the bar, and the one
 * number in this file that was measured rather than chosen.
 *
 * Photographed on `Medium_Phone_API_36`, 1080x2400 at 420dpi, one shot per step of Android's
 * own slider, **on the platform's bar that this one replaced**
 * ([ADR 0079](../../../../../adr/0079-the-app-draws-its-tabs-from-the-layout.md)), which
 * laid five items out at a fifth of the width each, as this does:
 *
 *  - **1.0, 1.15** — five labels, whole, with clear space between them.
 *  - **1.3** — five labels, whole, the gap down to about two pixels. The last step that is
 *    legible.
 *  - **1.5** — two labels touching and a third truncated into the fourth.
 *  - **2.0** — `Entde…Media…Mitm…`, the picture in
 *    [#158](https://github.com/correctiv/correctiv-app/issues/158).
 *
 * **Carried over and not re-measured on this bar**, which is the open question the ADR
 * names. `__tests__/tab-bar-labels.test.ts` pins the inputs (the five German words, this
 * number as written here, one shipped language), and when it goes red the answer is
 * `OUT=out/a11y bash screens/tools/tour-a11y.sh`, not an edit to the test. The web has no
 * system font scale (`fontScale` is 1 there), so on that target this never fires. The system's
 * bar on iOS and Android reads the same number (`app/(tabs)/_layout.tsx`).
 */
export const LABELS_FIT_UP_TO = 1.3;

export type BottomTabBarProps = {
  /** The active tab's id, or null when the address is on none. */
  active: string | null;
  /** Called with the tab's id when it is pressed. */
  onSelect: (tab: string) => void;
  /** The safe-area inset under the bar, which it pads. */
  bottomInset?: number;
};

/**
 * The tab bar on a phone: one control, drawn by the app on every platform.
 *
 * The same words as the rail's (`useTabs`), the same one-line label at size 11 in
 * `SourceSans3_600SemiBold`, the accent for the selected tab and a filled glyph. Page
 * surface and a hairline on top, no shadow, as the design draft has it. It is the app's own
 * because the tabs are screens now and a screen is an address
 * ([ADR 0079](../../../../../adr/0079-the-app-draws-its-tabs-from-the-layout.md)): the
 * platform's bar needs one route file per tab.
 */
export function BottomTabBar({ active, onSelect, bottomInset = 0 }: BottomTabBarProps) {
  const colors = useColors();
  const { bar, words } = useTabs();
  const { fontScale } = useWindowDimensions();
  // Above the measured scale only the selected tab keeps its label, which the platform's bar
  // did too: the others are a glyph, and TalkBack still announces them by name.
  const labelsFit = fontScale <= LABELS_FIT_UP_TO;
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row border-t border-stroke bg-canvas"
      style={{
        height: TAB_BAR_HEIGHT + bottomInset,
        paddingBottom: bottomInset,
      }}
    >
      {bar.tabs.map((tab) => {
        const word = words[tab]!;
        const selected = active === tab;
        const tint = selected ? colors.accent : colors['on-canvas-muted'];
        return (
          <Pressable
            key={tab}
            onPress={() => onSelect(tab)}
            className="flex-1 items-center justify-center"
            style={{ paddingHorizontal: spacingPx['3xs'] }}
            accessibilityRole="tab"
            accessibilityLabel={word.label}
            accessibilityState={{ selected }}
          >
            <Ionicons
              name={selected ? word.icon.ionicon.active : word.icon.ionicon.inactive}
              size={24}
              color={tint}
            />
            {labelsFit || selected ? (
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
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
