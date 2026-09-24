import { useContext, useSyncExternalStore } from 'react';
import { StyleSheet, useWindowDimensions, type StyleProp, type TextStyle } from 'react-native';
import { ReactReduxContext } from 'react-redux';

import {
  appTextScale,
  scaleTextMetrics,
  textSizeFollowsSystem,
  type SettingsState,
} from '@correctiv/app-core/stores/settings';
import type { AppStore } from '@correctiv/app-core/stores/store';

/**
 * What `ui/ScaledText` and `ui/ScaledTextInput` hand the platform: whether it may
 * scale by the system's font setting, and the style to draw at
 * ([ADR 0033](../../../../../adr/0033-one-text-size-for-the-whole-app-the-systems-by-default.md)).
 *
 * Following the system, which is the default, the platform scales and the style is
 * left alone. With a size chosen in the settings, the platform's scaling goes off
 * and the style's font size and line height are multiplied by that size instead,
 * so the choice replaces the system's rather than stacking on it.
 *
 * **It reads the store without requiring one.** `Typo` and `Button` draw the
 * recovery screen, which the root error boundary renders after the app's Provider
 * has been unmounted, and `useSelector` throws there — inside the boundary, which is
 * the one place a throw cannot be caught. So the store comes from the context when
 * there is one, and without one the text follows the system, which is the default
 * anyway and the right answer for a screen whose job is to be readable.
 */
export function useScaledTextStyle(style: StyleProp<TextStyle>): {
  followsSystem: boolean;
  style: StyleProp<TextStyle>;
} {
  const store = useContext(ReactReduxContext)?.store as AppStore | undefined;
  const settings = useSyncExternalStore<SettingsState | undefined>(
    store?.subscribe ?? NO_SUBSCRIPTION,
    () => store?.getState().settings,
    // The static web export renders on the server as well, where the answer is the same.
    () => store?.getState().settings,
  );
  const { fontScale } = useWindowDimensions();

  if (!settings || textSizeFollowsSystem(settings)) return { followsSystem: true, style };
  // Flattened, because the metrics can come from any entry of a style array — the
  // variant's, an override's or the caller's — and only the last one counts.
  const flat = StyleSheet.flatten(style) ?? {};
  return { followsSystem: false, style: scaleTextMetrics(flat, appTextScale(settings, fontScale)) };
}

const NO_SUBSCRIPTION = () => () => {};
