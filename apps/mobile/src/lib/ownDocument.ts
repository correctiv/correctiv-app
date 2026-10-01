/**
 * The mark the app leaves on a document it wrote, and the question it answers.
 *
 * **The app must not stamp a document it did not write.** This file answers that
 * for `lang` and for nothing else. The appearance still reaches a borrowed root —
 * `lib/theme/appearance.ts` calls `Uniwind.setTheme`, which stamps a class — and
 * the host that borrows the tree copes with it by watching for the change. That is
 * a second case with a second answer and not this one. Its web target is a
 * whole document — `app/+html.tsx` is the shell and everything inside it is the
 * app — but the app's React tree is mountable on its own, provider and all, and a
 * page that mounts it that way keeps its own `<html>`: its language, its title,
 * its scheme. An effect reaching for `document.documentElement` cannot tell those
 * two apart by looking, because both times it is looking at a real document.
 *
 * So the shell says which document is the app's, and the shell is the only thing
 * that can: it is the one file here that renders an `<html>` element at all.
 * `i18n/Localisation.tsx` asks before it writes.
 *
 * **Measured on 2026-09-18.** A page served in English, with the app's provider
 * mounted inside it, read `lang="de"` one render later — a screen reader
 * announcing English prose in a German voice and a browser hyphenating by German
 * rules, which is the defect the shell exists to prevent, pointed the other way.
 *
 * **The mark is in development too, and that had to be checked**, because a guard
 * that answers no while somebody is working would switch the correction off
 * exactly where a language change is tried. `app.json` sets
 * `web.output: "static"`, so `expo start --web` renders this same shell rather
 * than one of its own: measured against the running dev server on 2026-09-18,
 * whose served `<html>` is this file's and not Expo's default.
 */

/**
 * The attribute, named once.
 *
 * `data-` because it is addressed to this app and to nothing else: no browser, no
 * crawler and no framework reads it, and it is inert in every document that does
 * not carry it.
 */
const MARK = 'data-correctiv-app';

/**
 * Spread onto the shell's root element: `<html {...OWN_DOCUMENT_MARK}>`.
 *
 * An object rather than an attribute written out, because the name would
 * otherwise be typed where it is written and again where it is read, and the day
 * those two spellings part is the day the guard below answers no for every
 * document, silently and everywhere. JSX has no other way to spell an attribute
 * name that comes from a constant.
 */
export const OWN_DOCUMENT_MARK = { [MARK]: '' } as const;

/**
 * Whether there is a document here and it is this app's own.
 *
 * False off the web, where there is no `document` at all — which is why the
 * caller needs no platform check of its own, and why there is no `.web.ts`
 * sibling for three lines.
 */
export function isOwnDocument(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.hasAttribute(MARK);
}
