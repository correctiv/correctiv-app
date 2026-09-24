import { Text, type TextProps } from 'react-native';

import { useScaledTextStyle } from '@/lib/theme/textScaling';

/**
 * The `Text` every line the app draws goes through, and one of the two places the
 * system's font scale is switched off
 * ([ADR 0033](../../../../../adr/0033-one-text-size-for-the-whole-app-the-systems-by-default.md)).
 *
 * Following the system, which is the default, this is a plain `Text`: the platform
 * scales every size by the device's font setting, as it always has. With a size
 * chosen in the settings, that choice REPLACES the system's rather than multiplying
 * it, and a platform that keeps scaling cannot be told to stop halfway. So here
 * `allowFontScaling` goes off and the font size and line height are multiplied by
 * the chosen step instead; `lib/theme/textScaling` decides both.
 *
 * That is exactly what `__tests__/accessibility.test.ts` forbids, and it names this
 * element and `ScaledTextInput`, the only other one, rather than being loosened: the
 * opt-out it exists to catch takes the choice away from a reader, and this one hands
 * the same reader a different dial with the system's value as the default.
 *
 * `Typo`, `Button`, `Badge` and `Chip` render this rather than `Text`. What does not
 * come through here is the platform's own chrome: the native tab bar's labels and
 * iOS's back label are drawn by the system, which sizes them by its own setting
 * whatever the app says.
 */
export function ScaledText({ style, ...rest }: TextProps) {
  const scaled = useScaledTextStyle(style);
  return <Text allowFontScaling={scaled.followsSystem} style={scaled.style} {...rest} />;
}
