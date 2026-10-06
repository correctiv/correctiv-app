import { type Navigation } from '@correctiv/app-core/lib/navigation';

import { activeLayout } from '../home/active';
import { navigationDraftKey } from '../home/names';
import { shippedNavigationOf } from '../home/screens';
import { ensureMigrated } from '../home/write';
import { formatNavigationDocument, navigationDiffers, restorableNavigation } from './document';

/**
 * The edited navigation of the open layout, held outside the component that renders it and
 * kept in storage as it changes: `preview/home/store.ts` is the same arrangement for a
 * screen, and is what tells the frame (it listens here and republishes the whole layout,
 * ADR 0080 §2).
 */
type Listener = () => void;

let navigation: Navigation | null = null;
/** Whether the navigation held is one a link brought in and nothing has been written to since. */
let incoming = false;
const listeners = new Set<Listener>();

/**
 * Keep the navigation as the open layout's draft, or drop the draft when it is the layout's
 * own file: a key that is written once and then matches for ever is a state nobody can see.
 */
export function publishNavigation(next: Navigation): void {
  const key = navigationDraftKey(activeLayout());
  try {
    if (!navigationDiffers(next, shippedNavigationOf())) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, formatNavigationDocument(next));
  } catch {
    // Site data switched off. Nothing can be previewed, and nothing may throw.
  }
}

/** What an earlier visit left for the open layout, or its file when that is gone or refused. */
export function restoreNavigation(): Navigation {
  ensureMigrated();
  try {
    const raw = window.localStorage.getItem(navigationDraftKey(activeLayout()));
    if (raw === null) return shippedNavigationOf();
    return restorableNavigation(JSON.parse(raw)) ?? shippedNavigationOf();
  } catch {
    return shippedNavigationOf();
  }
}

/** The open layout has changed: read the navigation of the new one on the next ask. */
export function resetNavigation(): void {
  navigation = null;
  incoming = false;
  for (const listener of listeners) listener();
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
