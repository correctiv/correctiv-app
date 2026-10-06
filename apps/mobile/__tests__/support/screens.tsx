import { useLocalSearchParams } from 'expo-router';
import type { ComponentType } from 'react';

import ScreenRoute from '@/app/(tabs)/s/[id]';

/**
 * What a suite renders to see one screen: every screen is the one route `/s/<id>` (ADR 0079),
 * so a screen is that route with the id its address would carry. The suite's own
 * `expo-router` mock has to supply `useLocalSearchParams`, which this sets.
 */
export function screenOf(id: string): ComponentType {
  const Screen = () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ id });
    return <ScreenRoute />;
  };
  Screen.displayName = `Screen(${id})`;
  return Screen;
}
