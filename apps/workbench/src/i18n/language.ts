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
 * ([ADR 0050](../../../../adr/0050-the-workbench-gets-a-second-audience.md) §2).
 * Where that scope ENDS has moved:
 * [ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1
 * draws it between what this site wrote and what it prints from the repository,
 * so a page's own heading and lede follow the setting too, and what stays English
 * is the Markdown, the TypeDoc and the records themselves. An earlier version of
 * this paragraph said "the documents and the reference are not", which was §2's
 * line and is now wrong about the reference's own words.
 */
export type Language = 'en' | 'de';

export const LANGUAGES: readonly Language[] = ['en', 'de'];

/**
 * What a reader picks, which is one more thing than what renders.
 *
 * `'system'` is the same third state the appearance has, and it is here for the
 * same reason: "follow the machine" is a choice, and a two-state control cannot
 * express it. `Language` stays two-valued because a page has to be in one language
 * or the other; this type is the question, that one is the answer.
 */
export type LanguageChoice = Language | 'system';

/**
 * The language every `defaultMessage` on this site is written in, and therefore
 * react-intl's `defaultLocale`.
 *
 * **Not the language an untouched browser shows** — that is `preferredLanguage()`
 * below. The two were one constant until 2026-09-18, which read fine while the
 * answer was the same either way, and the rename is what stops the next reader
 * taking a fallback for a default.
 */
export const SOURCE_LANGUAGE: Language = 'en';

/**
 * What the setting is when nobody has touched it, expressed as the absence of the
 * key the way `'system'` is for the appearance.
 */
export const DEFAULT_CHOICE: LanguageChoice = 'system';

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

export function storedLanguage(store: Storage | null = ownStorage()): LanguageChoice {
  try {
    const stored = store?.getItem(LANGUAGE_KEY);
    if (stored === 'de' || stored === 'en') return stored;
  } catch {
    // Site data switched off. `ownStorage` catches the property access, which is
    // the sandboxed-iframe case; this catches the CALL, which is the one a reader
    // who has blocked storage hits. It is not hypothetical here: this is part of
    // the lazy initialiser of `useState` in `useLanguage`, called from `App.tsx`'s
    // first render, so an unguarded throw takes the whole site down rather than
    // the setting. `theme.ts` learned the same thing first and says so there too.
  }
  return DEFAULT_CHOICE;
}

/**
 * The language the browser asks for, out of the ones this site has.
 *
 * **Why the browser and not English.** English was the default until 2026-09-18,
 * on the argument that the source is English so an untouched browser should show
 * the source. That argument is about the code and this setting is about a reader:
 * the second audience ADR 0050 §1 names is a newsroom, its machines ask for
 * German, and it was being handed an English interface until it found a dialog it
 * could not read the name of.
 *
 * `navigator.languages` and not `navigator.language`, because the list is the
 * ranked answer and the singular is only its head: a reader whose first choice is
 * a language this site does not have still has a second and a third, and
 * `['fr-FR', 'de-DE', 'en']` wants German rather than the fallback.
 *
 * Matched on the primary subtag, so `de-CH`, `de-AT` and `de` are one answer.
 * There is nothing regional in this catalogue to tell them apart with, and a
 * reader asking for Swiss German is better served by German than by English.
 *
 * Takes the tags as an argument so that `test/i18n.test.ts` can ask it about a
 * browser it is not running in.
 */
export function preferredLanguage(tags: readonly string[] = navigatorLanguages()): Language {
  for (const tag of tags) {
    const primary = tag.toLowerCase().split('-')[0];
    const known = LANGUAGES.find((language) => language === primary);
    if (known) return known;
  }
  return SOURCE_LANGUAGE;
}

/**
 * What the browser says it wants, defensively.
 *
 * `navigator.languages` is empty in a few places it has no business being empty —
 * a headless run, an older WebView — and `navigator.language` is the one that is
 * always there. Falling through to an empty list rather than to a guess, because
 * `preferredLanguage` above already names the fallback and two places naming it
 * is one too many.
 *
 * Exported for `test/i18n.test.ts` alone. It is the production read path, and
 * "the ranked list and not its head" is a decision
 * ([ADR 0051](../../../../adr/0051-the-workbench-starts-in-the-browsers-language.md) §1)
 * that nothing held while this was private: a cold review reduced it to
 * `[navigator.language]` and the whole suite stayed green.
 */
export function navigatorLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages?.length) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

/** The choice resolved to the language a page is actually rendered in. */
export function resolveLanguage(choice: LanguageChoice, tags?: readonly string[]): Language {
  return choice === 'system' ? preferredLanguage(tags ?? navigatorLanguages()) : choice;
}

/**
 * The BCP-47 tag a row of the language picker states about itself, or none.
 *
 * "System" has no language of its own — it is written in whichever language the
 * site is in, which is the document's — so it states nothing and inherits.
 * `lang="system"` would be a tag no parser knows, and a screen reader would take
 * its voice from it.
 *
 * A named function rather than a ternary in the markup, because a cold review
 * restored `lang={tongue.value}` and the whole suite stayed green: nothing in this
 * package renders that dialog, so the only way to hold this is to make it a thing
 * a test can call.
 */
export function tagOf(choice: LanguageChoice): Language | undefined {
  return choice === 'system' ? undefined : choice;
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
export function rememberLanguage(next: LanguageChoice, store: Storage | null = ownStorage()): void {
  try {
    if (next === DEFAULT_CHOICE) store?.removeItem(LANGUAGE_KEY);
    else store?.setItem(LANGUAGE_KEY, next);
  } catch {
    // Site data switched off, or the quota is full. The choice does not survive the
    // tab, and the click must still change the language on screen.
  }
}

/**
 * The language this reader has chosen, what that resolves to, and a setter.
 *
 * **In storage rather than in the address**, and that is the same split the
 * appearance already makes. `theme.ts`'s `Appearance` is the *workbench's* own and
 * lives in storage, because it is a fact about the reader; `PreviewState.theme` is
 * the *app's* and lives in the address, because it is a fact about what is being
 * looked at. The language of this interface is the first kind. The language of the
 * app inside the frame is the second, and is in the address beside `t=` —
 * `PreviewState.lang`, spelled `lg`, written to storage by
 * `preview/frame/locale.ts`. Two settings, two homes, and neither reads the other.
 *
 * **Three values out and one in**, because the control and the provider are asking
 * different questions. The radio group has to know that "system" is what is
 * selected, or choosing it would light up whichever language it happens to resolve
 * to; the provider only ever wants the answer.
 */
export function useLanguage(): [LanguageChoice, Language, (next: LanguageChoice) => void] {
  const [choice, setChoice] = useState<LanguageChoice>(storedLanguage);
  const [language, setLanguage] = useState<Language>(() => resolveLanguage(storedLanguage()));

  useEffect(() => {
    // The one thing a language has to put on the document, so that a screen reader
    // announces the right one and the browser hyphenates by the right rules.
    // `index.html` ships `lang="en"`, which is a first guess for the same reason
    // the app's `+html.tsx` is one: that file is written before any browser has a
    // setting to read.
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    /*
     * "System" means the machine's answer, not the machine's answer at the moment
     * the tab opened. The appearance gets this for free — `prefers-color-scheme` is
     * a media query and CSS re-evaluates it — and a language has no such mechanism,
     * so the event is what makes the two settings mean the same thing by the same
     * word.
     *
     * Only while the choice IS "system": a reader who picked English does not want
     * a new keyboard layout changing the site under them.
     */
    if (choice !== 'system') return;
    const follow = () => setLanguage(preferredLanguage());
    // Once before subscribing, because an effect runs after the commit: a change
    // between the first render and this line would otherwise be lost until the
    // next one. Idempotent — the setter has already resolved the same answer.
    follow();
    window.addEventListener('languagechange', follow);
    return () => window.removeEventListener('languagechange', follow);
  }, [choice]);

  return [
    choice,
    language,
    useCallback((next: LanguageChoice) => {
      rememberLanguage(next);
      setChoice(next);
      setLanguage(resolveLanguage(next));
    }, []),
  ];
}
