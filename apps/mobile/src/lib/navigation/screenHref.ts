import { Platform } from 'react-native';

/**
 * Where a screen is opened by its id. `/s/<id>` is an address on the web, inside the drawn
 * shell. On iOS and Android the system's tab bar owns everything under `(tabs)` and a hidden
 * trigger "cannot be navigated to in any way", so a screen opened by id is `/screen/<id>`, a
 * route of the root stack: it redirects to its slot when it is on the bar and is pushed over
 * the tabs when it is not ([ADR 0081](../../../../../adr/0081-the-system-tab-bar-returns-and-is-decided-at-start.md)).
 * An address from outside, `/s/<id>`, is rewritten to it by `app/+native-intent.tsx`.
 */
export function screenHref(id: string): string {
  return Platform.OS === 'web' ? `/s/${id}` : `/screen/${id}`;
}
