import { Platform } from 'react-native';

import { slotScreen } from '@correctiv/app-core/lib/navigation';

import { EmptyStart } from '@/lib/navigation/EmptyStart';
import NotFoundScreen from '@/app/+not-found';
import { ScreenView } from '@/lib/home/ScreenView';

import { startDecision } from './tabBar';

/**
 * What a slot of the system's tab bar draws: the screen of the n-th entry of the navigation
 * this process started with ([ADR 0081](../../../../../adr/0081-the-system-tab-bar-returns-and-is-decided-at-start.md)).
 * The assignment is the start's and the document is live, so a fetched copy of a screen
 * shows at once and a fetched copy of the navigation waits for the next start.
 *
 * The first slot is the empty state when the layout holds no screen. Any other slot that the
 * bar does not occupy is not declared, so this draws nothing a person can reach.
 */
export function SlotScreen({ route }: { route: string }) {
  // The slot files carry no `.web` sibling, so on the web they are addresses with nothing behind them.
  if (Platform.OS === 'web') return <NotFoundScreen />;
  const { bar } = startDecision();
  if (bar.kind === 'empty') return route === 'index' ? <EmptyStart /> : null;
  return <ScreenView id={slotScreen(bar, route) ?? undefined} />;
}
