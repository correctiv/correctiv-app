import { Pressable } from 'react-native';

import { sizes, typography, useColors } from '@/lib/theme';
import { ScaledText } from './ScaledText';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  className?: string;
};

/**
 * Selection chip (onboarding interests, discover topics). Active = red fill.
 *
 * **The label does not shrink**, which is React Native's own default written out
 * and therefore no change on the phone. It is load-bearing on the GTK4 host that
 * [ADR 0012](../../../../../adr/0012-a-list-virtualizer-for-the-unbounded-lists.md)
 * names as a reason: a `Gtk.Box` squeezes its children between their minimum and
 * their natural size, so in a narrow window the last chip of a rail was squeezed
 * far enough for its label to wrap onto three lines, which the rail then clipped.
 * Declared, the rail overflows and scrolls instead, which is what a chip rail does
 * on the phone. The widths are in that host's README on the `desktop` branch,
 * which is the only place they are written down.
 *
 * **No `numberOfLines`, and that is the decision rather than an omission.** It was
 * measured as the alternative and is worse: it takes a label's minimum width down
 * to a single character, so every chip in the rail truncates instead of one being
 * squeezed. `__tests__/one-line-labels.test.tsx` asserts the absence, so reaching
 * for it means reading this first.
 */
export function Chip({ label, selected = false, onPress, className }: ChipProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      // Explicit, like Button: the label is otherwise only read off the child Text,
      // and it gives a test a stable handle on one chip among many.
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      className={[
        'justify-center rounded-md px-s py-2xs active:opacity-80',
        selected ? 'bg-accent' : 'bg-surface border border-stroke',
        className ?? '',
      ].join(' ')}
      /*
       * A floor, not a height. `text-s` plus `py-2xs` either side is 33 dp, which
       * is what every chip on Entdecken and in the onboarding measured before #102;
       * the rail is dense but it is not so dense that nine more dp do not fit.
       *
       * `minHeight` rather than `height`, so the box still grows with the system
       * font — a chip's label is one of the strings that wraps first, and a fixed
       * height is what cut the search field's placeholder in #158.
       */
      style={{ minHeight: sizes.tapTarget }}
    >
      <ScaledText
        style={[
          typography['text-s'],
          {
            // Selected, the label sits on the brand surface; otherwise on the page.
            color: selected ? colors['always-light'] : colors['on-canvas'],
            fontFamily: 'SourceSans3_600SemiBold',
            flexShrink: 0,
          },
        ]}
      >
        {label}
      </ScaledText>
    </Pressable>
  );
}
