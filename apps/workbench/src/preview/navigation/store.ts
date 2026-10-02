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
  publishNavigation(next);
  for (const listener of listeners) listener();
}
