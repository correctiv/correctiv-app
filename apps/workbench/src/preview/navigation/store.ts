import { type Navigation } from '@correctiv/app-core/lib/navigation';

import { NAVIGATION_KEY } from '../home/names';
import {
  formatNavigationDocument,
  navigationDiffers,
  restorableNavigation,
  SHIPPED_NAVIGATION,
} from './document';

/**
 * The edited navigation, held outside the component that renders it and written into the
 * app's storage as it changes: `preview/home/store.ts` is the same arrangement for a
 * screen. Unlike a screen, the app reads the navigation once at its first render, so
 * whoever writes here also has to reload the frame (`NavigationEditor` does).
 */
type Listener = () => void;

let navigation: Navigation | null = null;
/** Whether the navigation held is one a link brought in and nothing has been written to since. */
let incoming = false;
const listeners = new Set<Listener>();

/** Put the navigation where the framed app finds it, or take it away when it is the shipped one. */
export function publishNavigation(next: Navigation): void {
  try {
    if (!navigationDiffers(next)) window.localStorage.removeItem(NAVIGATION_KEY);
    else window.localStorage.setItem(NAVIGATION_KEY, formatNavigationDocument(next));
  } catch {
    // Site data switched off. Nothing can be previewed, and nothing may throw.
  }
}

/** What an earlier visit left, or the shipped navigation when that is gone or refused. */
export function restoreNavigation(): Navigation {
  try {
    const raw = window.localStorage.getItem(NAVIGATION_KEY);
    if (raw === null) return SHIPPED_NAVIGATION;
    return restorableNavigation(JSON.parse(raw)) ?? SHIPPED_NAVIGATION;
  } catch {
    return SHIPPED_NAVIGATION;
  }
}

export function getNavigation(): Navigation {
  navigation ??= restoreNavigation();
  return navigation;
}

export function subscribeNavigation(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setNavigation(next: Navigation): void {
  navigation = next;
  incoming = false;
  publishNavigation(next);
  for (const listener of listeners) listener();
}

/**
 * A navigation that arrived in a shared link, held rather than published (ADR 0076 §3).
 *
 * The same argument as `holdIncoming` in `../home/store.ts`: the framed app reads the key,
 * so a draft written there would replace whatever the machine held before anybody edited a
 * character of it. The editor shows the draft and nothing else; the first edit publishes it.
 * Returns whether it took it, and a document the editor will not open is a link that cannot
 * be opened.
 */
export function holdIncomingNavigation(document: string): boolean {
  let parsed: Navigation | null;
  try {
    parsed = restorableNavigation(JSON.parse(document));
  } catch {
    parsed = null;
  }
  if (parsed === null) return false;
  navigation = parsed;
  incoming = true;
  for (const listener of listeners) listener();
  return true;
}

/** Whether the navigation is one a link brought in and nothing has been written to since. */
export function navigationIncoming(): boolean {
  return incoming;
}
