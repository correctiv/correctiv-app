import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { useTextSize } from '@/lib/store/core';
import { scaleTextMetrics, type TextSize } from '@correctiv/app-core/stores/settings';

/**
 * The app's text size, handed to every line of text through one context
 * ([ADR 0033](../../../../../adr/0033-one-text-size-for-the-whole-app-the-systems-by-default.md)).
 *
 * **One subscription, not one per text.** `TextSizeProvider` is the only component
 * that asks the store, and it asks for the primitive `textSize`, so it re-renders
 * when that value changes and on nothing else in the settings. Every `ScaledText`
 * reads the context, which is free. The first version subscribed each text node to
 * the store on its own, with the whole settings object as its snapshot, so every
 * line on a screen re-rendered when the push switch moved;
 * `__tests__/scaled-text.test.tsx` holds that it no longer does.
 *
 * **The default is `'system'`, and that is load-bearing.** `Typo` and `Button` draw
 * the recovery screen, which the root error boundary renders after the app's
 * Provider has been unmounted, where a store read would throw inside the boundary.
 * With no provider above it, text follows the system, which is the default anyway
 * and the right answer for a screen whose job is to be readable.
 *
 * The system's own scale is not in here: following the system, the platform
 * applies it, and with a step chosen the step is the whole answer whatever the
 * system says, because it replaces the system's scale rather than multiplying it.
 */
const TextSizeContext = createContext<TextSize>('system');

/** Mounted once, inside the Redux Provider, by `lib/env/AppEnvironment`. */
export function TextSizeProvider({ children }: { children: ReactNode }) {
  const textSize = useTextSize();
  return <TextSizeContext.Provider value={textSize}>{children}</TextSizeContext.Provider>;
}

/**
 * What `ui/ScaledText` and `ui/ScaledTextInput` hand the platform: whether it may
 * scale by the system's font setting, and the style to draw at.
 *
 * Following the system, the platform scales and the style is left alone. With a
 * size chosen in the settings, the platform's scaling goes off and the style's font
 * size and line height are multiplied by that size instead.
 */
export function useScaledTextStyle(style: StyleProp<TextStyle>): {
  followsSystem: boolean;
  style: StyleProp<TextStyle>;
} {
  const textSize = useContext(TextSizeContext);
  if (textSize === 'system') return { followsSystem: true, style };
  // Flattened, because the metrics can come from any entry of a style array — the
  // variant's, an override's or the caller's — and only the last one counts.
  const flat = StyleSheet.flatten(style) ?? {};
  return { followsSystem: false, style: scaleTextMetrics(flat, textSize) };
}
