import { parseFeatureOverride, type FeatureOverride } from '@correctiv/app-core/features/features';

import { FEATURES_KEY } from '../home/names';
import { formatDraft, NO_DRAFT } from './document';

/**
 * The feature states being tried out, held outside the component and written into the
 * app's storage as they change: `preview/navigation/store.ts` is the same arrangement for
 * the tab bar. The app reads them once while its store is built, so whoever writes here
 * also reloads the frame, and the store drops them in a release channel (ADR 0072 §6).
 */
type Listener = () => void;

let draft: FeatureOverride | null = null;
const listeners = new Set<Listener>();

/** Put the draft where the framed app finds it, or take it away when it says nothing. */
export function publishFeatures(next: FeatureOverride): void {
  try {
    const text = formatDraft(next);
    if (text === null) window.localStorage.removeItem(FEATURES_KEY);
    else window.localStorage.setItem(FEATURES_KEY, text);
  } catch {
    // Site data switched off. Nothing can be previewed, and nothing may throw.
  }
}

/** What an earlier visit left, or nothing when that is gone or unreadable. */
export function restoreFeatures(): FeatureOverride {
  try {
    const raw = window.localStorage.getItem(FEATURES_KEY);
    return raw === null ? NO_DRAFT : (parseFeatureOverride(JSON.parse(raw)) ?? NO_DRAFT);
  } catch {
    return NO_DRAFT;
  }
}

export function getFeatures(): FeatureOverride {
  draft ??= restoreFeatures();
  return draft;
}

export function subscribeFeatures(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setFeatures(next: FeatureOverride): void {
  draft = next;
  publishFeatures(next);
  for (const listener of listeners) listener();
}
