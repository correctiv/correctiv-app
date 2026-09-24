/**
 * The German somebody has typed in the strings tool, where the framed app reads it.
 *
 * The other half is `apps/mobile/src/lib/strings.ts`, which says why the seam is
 * `localStorage` and where the limit on it is enforced: an id the shipped catalogue does
 * not carry, and anything that is not a string, is ignored there whatever this side
 * writes. `test/preview/strings.test.ts` holds the two spellings of the key together,
 * as `test/preview/locale.test.ts` does for the language.
 *
 * **Durable, the way the home document is and the clock is not.** `home/write.ts` keeps
 * the edited layout in its key and restores it on the next visit, because it is work
 * somebody would not want to lose to a reload, and a set of reworded strings is the same
 * kind of thing. So is the cost: while the key holds something, the app in this browser
 * says it, and the tool is what shows that and what takes it away.
 *
 * Keyed by locale, and this side writes only `de`: the German is what is edited
 * ([ADR 0056](../../../../../adr/0056-a-string-is-picked-where-it-renders.md) §6).
 */
import { EDITED_LOCALE, PREVIEW_STRINGS_KEY } from './names';
import { checkWording } from './validate';

/** Id to German, only for wordings that differ from the shipped catalogue. */
export type Draft = Readonly<Record<string, string>>;

/**
 * Fired in THIS document whenever `publishDraft` writes or clears the key.
 *
 * The browser's own `storage` event never reaches the document that made the write —
 * that is the asymmetry `apps/mobile/src/lib/strings.ts` relies on, and the frame is a
 * different document, so it gets one. The draft marker sits beside the tool that owns
 * this key, in the same document, and needs the other half: a write telling itself.
 * `preview/frame/seed.ts`'s `SESSION_EVENT` is the same pattern for the seeded session.
 */
export const DRAFT_CHANGED_EVENT = 'workbench:strings-draft-changed';

/**
 * Fired only by `discardDraft` below, and heard only by `StringsTool.tsx`.
 *
 * `publishDraft({})` alone clears the key the frame reads, but the tool's own editor
 * keeps whatever a person had typed in its React state, which would publish it right
 * back on the next keystroke. This is "Alle verwerfen", pressed from the draft marker
 * rather than from the panel that owns the button — the same discard, told to a second
 * listener rather than reimplemented for it.
 */
export const DRAFT_DISCARD_EVENT = 'workbench:strings-draft-discard';

function announce(event: string): void {
  try {
    window.dispatchEvent(new Event(event));
  } catch {
    // Not a browser (a test, the dev server's endpoint): there is nobody to tell.
  }
}

/** Put the draft where the frame will find it, or take the key away when it is empty. */
export function publishDraft(draft: Draft): void {
  try {
    if (Object.keys(draft).length === 0) window.localStorage.removeItem(PREVIEW_STRINGS_KEY);
    else
      window.localStorage.setItem(PREVIEW_STRINGS_KEY, JSON.stringify({ [EDITED_LOCALE]: draft }));
  } catch {
    // Site data switched off. Nothing can be previewed, and nothing may throw.
    return;
  }
  announce(DRAFT_CHANGED_EVENT);
}

/** Reactive read of the draft: this document's own writes, and another tab's. */
export function subscribeDraftChange(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  window.addEventListener(DRAFT_CHANGED_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(DRAFT_CHANGED_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

/** How many ids the draft currently reworks, read straight from storage. */
export function draftCount(shipped: Readonly<Record<string, string | null>>): number {
  return Object.keys(restoreDraft(shipped)).length;
}

/**
 * "Alle verwerfen", callable from outside the strings tool: clears the key the frame
 * reads and tells the tool's own editor state to let go of it too.
 */
export function discardDraft(): void {
  publishDraft({});
  announce(DRAFT_DISCARD_EVENT);
}

/**
 * The draft a previous visit left, read as the app would read it: only ids in
 * `shipped`, only strings, and only where they differ.
 */
export function restoreDraft(shipped: Readonly<Record<string, string | null>>): Draft {
  try {
    const raw = window.localStorage.getItem(PREVIEW_STRINGS_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    const asked =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)[EDITED_LOCALE]
        : undefined;
    if (typeof asked !== 'object' || asked === null || Array.isArray(asked)) return {};
    const draft: Record<string, string> = {};
    for (const [id, wording] of Object.entries(asked)) {
      if (typeof wording !== 'string') continue;
      if (!Object.prototype.hasOwnProperty.call(shipped, id)) continue;
      if (shipped[id] === wording) continue;
      draft[id] = wording;
    }
    return draft;
  } catch {
    return {};
  }
}

/**
 * The entries of a draft that may reach the frame: they pass the validator and differ
 * from the catalogue.
 *
 * What a person types goes into the draft whatever it is, so the field keeps it while
 * they are halfway through a placeholder; only this reaches `publishDraft`. `english`
 * answers an id's English, and `undefined` for an id the app has none of, which is
 * dropped here as well as in the app.
 */
export function publishable(
  draft: Draft,
  baseline: Readonly<Record<string, string>>,
  english: (id: string) => string | undefined,
): Draft {
  const out: Record<string, string> = {};
  for (const [id, wording] of Object.entries(draft)) {
    const source = english(id);
    if (source === undefined || wording === baseline[id]) continue;
    if (checkWording(source, wording).length === 0) out[id] = wording;
  }
  return out;
}
