import { useCallback, useEffect, useState } from 'react';

/**
 * The languages this site can be in, and which one a reader gets.
 *
 * **Why this site has a second language at all**, when everything a developer
 * reads here is English by [AGENTS.md](../../../../AGENTS.md#language): the home
 * configurator has an audience outside the development team.
 * [ADR 0036](../../../../adr/0036-the-home-screen-becomes-data.md) §1 says the
 * document is designed as though the newsroom owned it, §15 says the pull-request
 * route is the answer "while the configurator is ours", and §1 promises that
 * handing it over is "a step and not a rebuild". A German interface is one of
 * those steps, and it is the one that can be taken before the questions about
 * sign-in and hosting are answered.
 *
 * So the scope is decided by audience and not by completeness
 * ([ADR 0050](../../../../adr/0050-the-workbench-gets-a-second-audience.md) §2):
 * what somebody outside development uses is translated, the documents and the
 * reference are not.
 */
export type Language = 'en' | 'de';

export const LANGUAGES: readonly Language[] = ['en', 'de'];

/**
 * English is the default and the absence of the key, the way `'system'` is for the
 * appearance. The source of every string here is English
 * ([AGENTS.md](../../../../AGENTS.md#language)), so a reader who has chosen nothing
 * gets the language the code is written in.
 */
export const DEFAULT_LANGUAGE: Language = 'en';

/**
 * Exported so `test/i18n.test.ts` spells it once rather than twice, and named with
 * the `workbench:` prefix every key this site owns carries.
 */
export const LANGUAGE_KEY = 'workbench:language';

/** This origin's storage, or nothing. Touching the property is what throws. */
function ownStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function storedLanguage(store: Storage | null = ownStorage()): Language {
  try {
    if (store?.getItem(LANGUAGE_KEY) === 'de') return 'de';
  } catch {
    // Site data switched off. `ownStorage` catches the property access, which is
    // the sandboxed-iframe case; this catches the CALL, which is the one a reader
    // who has blocked storage hits. It is not hypothetical here: this is the lazy
    // initialiser of `useState` in `useLanguage`, called from `App.tsx`'s first
    // render, so an unguarded throw takes the whole site down rather than the
    // setting. `theme.ts` learned the same thing first and says so there too.
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Written from here and nowhere else, which is issue #131's rule kept rather than
 * rediscovered.
 *
 * `theme.ts` carries the long version: this site runs more than one document on the
 * origin, a reading is not a fact about what the reader wants, and a document that
 * stamps its reading back deletes a choice it never saw. Default is the absence of
 * the key here too, so the same trap is open, and the same discipline closes it —
 * the store is touched only when somebody chooses.
 */
export function rememberLanguage(next: Language, store: Storage | null = ownStorage()): void {
  try {
    if (next === DEFAULT_LANGUAGE) store?.removeItem(LANGUAGE_KEY);
    else store?.setItem(LANGUAGE_KEY, next);
  } catch {
    // Site data switched off, or the quota is full. The choice does not survive the
    // tab, and the click must still change the language on screen.
  }
}

/**
 * The language this reader has chosen, and a setter.
 *
 * **In storage rather than in the address**, and that is the same split the
 * appearance already makes. `theme.ts`'s `Appearance` is the *workbench's* own and
 * lives in storage, because it is a fact about the reader; `PreviewState.theme` is
 * the *app's* and lives in the address, because it is a fact about what is being
 * looked at. The language of this interface is the first kind. The language of the
 * app inside the frame will be the second, and belongs in the address beside `t=`.
 */
export function useLanguage(): [Language, (next: Language) => void] {
  const [language, setLanguage] = useState<Language>(storedLanguage);

  useEffect(() => {
    // The one thing a language has to put on the document, so that a screen reader
    // announces the right one and the browser hyphenates by the right rules.
    document.documentElement.lang = language;
  }, [language]);

  return [
    language,
    useCallback((next: Language) => {
      rememberLanguage(next);
      setLanguage(next);
    }, []),
  ];
}
