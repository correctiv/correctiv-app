// `react-native-safe-area-context`, on a window that has no unsafe area.
//
// The INSET has no desktop meaning and the LAYOUT does, which is the split
// `@gjsify/react-native` already makes for React Native's own `SafeAreaView`. A GTK
// window is not behind a notch, a home indicator or a rounded corner; it is a
// rectangle the compositor gives the application whole.
//
// So the insets are zero — a real answer, not a placeholder — and `SafeAreaView` is
// a `View` in every other respect, which is what its call sites need it to be.
// `components/ui/Screen.tsx` wraps every screen in one with `edges={['top']}` and a
// `className`, so it has to lay out and paint like the `View` it wraps.

import { View, type ViewProps } from 'react-native';

export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Zero on every edge.
 *
 * The two call sites (`app/(tabs)/_layout.tsx` and its web twin) add
 * `insets.bottom` to a tab-bar height. Adding zero is the correct arithmetic here:
 * the desktop tab switcher lives in the header bar, and nothing is being kept clear
 * of a system gesture area that does not exist.
 */
export function useSafeAreaInsets(): EdgeInsets {
  return NO_INSETS;
}

export function useSafeAreaFrame(): { x: number; y: number; width: number; height: number } {
  return { x: 0, y: 0, width: 0, height: 0 };
}

export type Edge = 'top' | 'right' | 'bottom' | 'left';

export interface SafeAreaViewProps extends ViewProps {
  edges?: readonly Edge[];
  className?: string;
}

/** A `View`. `edges` is accepted and has nothing to do, per the header. */
export function SafeAreaView({ edges: _edges, ...rest }: SafeAreaViewProps) {
  return <View {...rest} />;
}

/** The provider is a passthrough: there is no inset to provide. */
/**
 * What a host states when it has no router to measure the insets for it.
 *
 * `lib/env/AppEnvironment.tsx` declares an optional `insets?: Metrics` so the workbench
 * can hand a page zero, and the app leaves it out. Typed here because the type is part
 * of that component's signature and this host compiles it; nothing on this host passes
 * one, so `SafeAreaProvider` below is as inert as it ever was.
 */
export interface Metrics {
  insets: EdgeInsets;
  frame: { x: number; y: number; width: number; height: number };
}

export function SafeAreaProvider({
  children,
}: {
  children?: unknown;
  initialMetrics?: Metrics | null;
}) {
  return <View className="flex-1">{children as never}</View>;
}

export const initialWindowMetrics = null;
