import { useMemo, useSyncExternalStore } from 'react';

import type { Locale } from '@correctiv/app-core/stores/settings';

/**
 * Where the workbench rewords a string on screen, and the one place anything may.
 *
 * **The seam is `lib/home/clock.ts`'s and the argument for it is there in full**: the
 * shell and the app are one origin, so the workbench's `localStorage` IS this app's; it
 * is the only door that works against the published export; React Native has no
 * `localStorage`, so there is no key on a phone and the guarded read below answers
 * `null` before it touches anything; and it is spelled `workbench:` because a screen
 * that quietly differs from the repository is worse than one that says who changed it.
 * Like the clock, and unlike `./locale.ts`, it is subscribed to: a `storage` event
 * redraws the strings where they stand, so a person typing German in the workbench
 * sees the frame follow without a reload.
 *
 * **This is the largest power the workbench has asked the app for**
 * ([ADR 0056](../../../../adr/0056-a-string-is-picked-where-it-renders.md) §7), so the
 * limit is written here rather than trusted to the writer. `./locale.ts` selects
 * between catalogues the app already ships and cannot change a string; this key can
 * change one, which is its whole point. What it cannot do is extend the vocabulary:
 * **an entry whose id the shipped catalogue does not carry is ignored, and anything
 * that is not a string is ignored.** So a screen can be reworded and can never say
 * something the repository has no id for.
 *
 * The value is an object keyed by locale, then by id: `{"de": {"home.viewAll": "…"}}`.
 * Keyed by locale because the German is what is edited (§6), and a German wording
 * merged over the English catalogue would put German on a frame the workbench has
 * switched to English with `lg=`. `apps/workbench/src/preview/strings/draft.ts` is the
 * writer, and `apps/workbench/test/preview/strings.test.ts` holds the spelling.
 */
export const PREVIEW_STRINGS_KEY = 'workbench:strings';

type Catalogue = Readonly<Record<string, string>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The shipped catalogue with the workbench's wordings over it, or the shipped one
 * itself where the key says nothing that counts.
 *
 * Handed back as the same object when nothing applies, so an `IntlProvider` given it
 * sees no new `messages` and re-renders nothing. Junk in the key, a locale the key does
 * not mention, an id the catalogue lacks and a value that is not a string are all the
 * same answer, which is nobody asking — the way `previewLocale()` reads its own key.
 */
export function withPreviewStrings(
  text: string | null,
  locale: Locale,
  shipped: Catalogue,
): Catalogue {
  if (text === null) return shipped;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return shipped;
  }
  const asked = isRecord(parsed) ? parsed[locale] : undefined;
  if (!isRecord(asked)) return shipped;

  let merged: Record<string, string> | null = null;
  for (const [id, wording] of Object.entries(asked)) {
    if (typeof wording !== 'string') continue;
    if (!Object.prototype.hasOwnProperty.call(shipped, id)) continue;
    if (wording === shipped[id]) continue;
    merged ??= { ...shipped };
    merged[id] = wording;
  }
  return merged ?? shipped;
}

/** The key's text, or null. Text because it is what `useSyncExternalStore` compares. */
function previewStringsText(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(PREVIEW_STRINGS_KEY);
  } catch {
    return null;
  }
}

/** A `storage` event for this key, which only another same-origin document can fire. */
function subscribeToStrings(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === PREVIEW_STRINGS_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

/** The catalogue `i18n/Localisation.tsx` hands its provider. */
export function usePreviewStrings(locale: Locale, shipped: Catalogue): Catalogue {
  const text = useSyncExternalStore(subscribeToStrings, previewStringsText, () => null);
  return useMemo(() => withPreviewStrings(text, locale, shipped), [text, locale, shipped]);
}
