import { useCallback, useEffect, useState } from 'react';

export type Appearance = 'light' | 'dark' | 'system';

/**
 * Exported so `test/theme.test.ts` spells it once rather than twice. It is the
 * only key this site owns outside the app's own two stores, and `preview/frame/
 * seed.ts` names it in its own comment as the reason a fixture may not clear by
 * the `workbench:` prefix.
 */
export const APPEARANCE_KEY = 'workbench:appearance';

/** This origin's storage, or nothing. Touching the property is what throws. */
function ownStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    // A private window, or site data switched off. The setting simply does not
    // survive the tab, which is better than the page failing to render.
    return null;
  }
}

/**
 * Three states, not two, and "system" is the default.
 *
 * `TROUBLESHOOTING.md` numbers four appearance combinations and says the fourth,
 * the system setting against a dark device, is the app's default and the one that
 * has already shipped broken. A two-state toggle cannot express it, so this site
 * offers the same three the app does and puts no class on the root for "system",
 * which is what lets `prefers-color-scheme` decide.
 *
 * **Opening a page writes nothing, and that is the whole of issue #131.** The
 * effect below used to carry the storage write as well, so every document of this
 * site stamped its own reading of the setting back over the shared key on mount —
 * and because "system" is expressed by the key being ABSENT, a document that had
 * read "system" stamped it by DELETING the reader's choice. One document is
 * harmless; this site runs more than one on the origin. `preview/AppFrame.tsx`
 * frames `<base>/app<route>`, and on a static host every path the app's export
 * does not contain is answered with the site's own `404.html`, which is a copy of
 * this application — measured on 2026-09-15 against a workbench-only `dist`, where
 * the framed document at `/app/` called both `setItem` and `removeItem` on this
 * key. A reading is therefore not a fact about what the reader wants, only about
 * what the store said when that document happened to start, and writing one back
 * is how a choice gets thrown away by a page that was only being looked at.
 *
 * So the store is written in one place, `rememberAppearance`, reached only from
 * the setter this returns — that is, only when somebody chooses. The effect stamps
 * the class and nothing else, and `test/theme.test.ts` fails if a write finds its
 * way back into it.
 */
export function useAppearance(): [Appearance, (next: Appearance) => void] {
  const [appearance, setAppearance] = useState<Appearance>(storedAppearance);

  useEffect(() => {
    // A class, not an attribute, because that is what the token package's `light`
    // and `dark` variants key off, and the app sets the same one. Two mechanisms
    // for one setting is how the site and the app it frames end up disagreeing
    // about which scheme is on screen.
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (appearance !== 'system') root.classList.add(appearance);
  }, [appearance]);

  return [
    appearance,
    useCallback((next: Appearance) => {
      // The store first, then the state. `DirectPreview.tsx` watches the class on
      // `<html>` for the signal and reads the stored value for the answer, so the
      // value has to be in place before the class moves; the class moves in the
      // effect above, which is a commit later than this line.
      rememberAppearance(next);
      setAppearance(next);
    }, []),
  ];
}

/**
 * The setting as the reader last left it, which is the only reading of it that
 * cannot have been written by something else.
 *
 * Exported because `components/DirectPreview.tsx` needs the same answer and must
 * not get it from the class on `<html>`: Uniwind writes that class itself, and a
 * reader of it would mistake Uniwind's output for the reader's choice. The class
 * says which scheme is on screen; this says which of the three the reader asked
 * for, and only for "system" are those two different questions.
 */
export function storedAppearance(store: Storage | null = ownStorage()): Appearance {
  try {
    const stored = store?.getItem(APPEARANCE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // See `ownStorage`. Falling through to the default is the correct answer here.
  }
  return 'system';
}

/**
 * What somebody just chose, and the only line in this site that writes the key.
 *
 * "System" is the absence of the key rather than a third stored value, which is
 * what lets a reader who has never chosen and a reader who chose to follow the
 * device get the same answer out of `storedAppearance`. That is also why this may
 * only ever run from a choice: reached from a mount, the same `removeItem` deletes
 * a choice somebody else made (see `useAppearance`).
 */
export function rememberAppearance(next: Appearance, store: Storage | null = ownStorage()): void {
  try {
    if (next === 'system') store?.removeItem(APPEARANCE_KEY);
    else store?.setItem(APPEARANCE_KEY, next);
  } catch {
    // Site data switched off, or the quota is full. The setting does not survive
    // the tab, and the click must still change the scheme on screen.
  }
}
