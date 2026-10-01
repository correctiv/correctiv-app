import type { Ref } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { useScaledTextStyle } from '@/lib/theme/textScaling';

/**
 * `ScaledText`'s twin for a field, the typed text and its placeholder: the other of
 * the two places the system's font scale is switched off, for the same reason and
 * decided by the same hook
 * ([ADR 0033](../../../../../adr/0033-one-text-size-for-the-whole-app-the-systems-by-default.md)).
 *
 * Its own element because React Native has two primitives that draw text and both
 * take the prop; the app's four fields render this rather than `TextInput`.
 */
export function ScaledTextInput({ style, ...rest }: TextInputProps & { ref?: Ref<TextInput> }) {
  const scaled = useScaledTextStyle(style);
  return <TextInput allowFontScaling={scaled.followsSystem} style={scaled.style} {...rest} />;
}
