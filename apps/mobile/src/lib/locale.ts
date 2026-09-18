import type { Locale } from '@correctiv/app-core/stores/settings';

/**
 * The language this app ships in, said once.
 *
 * **One place, because three things need the same answer and none of them can ask
 * the others.** `lib/store/core.ts` hands it to `createAppStore()`
 * ([ADR 0049](../../../../adr/0049-the-catalogue-is-a-package.md) §4);
 * `app/+html.tsx` writes it into the static export's `<html lang>`, and it renders
 * at export time with no store anywhere to ask; and
 * `__tests__/tab-bar-labels.test.ts` reads it, because the tab bar's measured
 * width threshold was taken against five German words and stops meaning anything
 * the day the app ships another language.
 *
 * It was two places for an afternoon — the store's option and the settings slice's
 * own default — and a cold review pointed out what that produced: the export said
 * `lang="de"` while the app rendered English, because the shell had read the core's
 * constant rather than this host's answer.
 *
 * **Not in the core.** Which language CORRECTIV ships to phones is this product's
 * decision, and `packages/app-core` is shared with hosts that will answer it
 * differently. The core keeps a default so a store built by a test has one; this is
 * what the app says.
 *
 * There is no user-facing switch and this is not one: a developer's switch belongs
 * in the workbench (ADR 0026 §6), and changing this line changes what ships. The
 * key below is that switch's end of the wire, and it overrides this rather than
 * replacing it.
 */
export const SHIPPED_LOCALE: Locale = 'de';

/**
 * Where the workbench says which language to build the app in, and the one place
 * anything may say it.
 *
 * **The seam is `lib/home/clock.ts`'s and the argument for it is there in full**:
 * the shell and the app are one origin, so the workbench's `localStorage` IS this
 * app's; it is the only door that works against the published export, where
 * `expo export` has left no dev handle to dispatch through; React Native has no
 * `localStorage`, so there is no key on a phone and the guarded read below answers
 * `null` before it touches anything; `window` is not what makes that true, because
 * React Native defines one; and it is spelled `workbench:` because a screen that
 * quietly differs from the repository is worse than one that says who changed it.
 *
 * **What is different here is that nothing subscribes.** The home-time key is read
 * through `useSyncExternalStore`, so dragging along the timeline redraws the frame
 * where it stands. A language cannot arrive that way:
 * `packages/app-core/src/stores/settings.ts` says in as many words that the locale
 * is supplied by the host **at construction**, the slice deliberately has no
 * `setLocale` to dispatch, and `PERSISTED_KEYS` leaves `locale` out so that a device
 * cannot remember an answer the host has stopped giving. So this key is read once,
 * by `lib/store/core.ts`, while the store is being built, and changing the language
 * is a restart — the workbench writes the key and reloads the frame.
 * `apps/workbench/src/preview/frame/locale.ts` is the other end and says which event
 * does what.
 *
 * **A smaller power than either key beside it**, which is the question issue #112
 * asks of anything this tool writes. `workbench:home-layout` can replace the home
 * document outright; `workbench:home-time` selects between hours the document
 * already describes. This one selects between the catalogues the app already ships
 * ([ADR 0049](../../../../adr/0049-the-catalogue-is-a-package.md) §3): it cannot add
 * a string or change one, only choose which of two compiled answers renders, and
 * anything else in the key leaves `SHIPPED_LOCALE` standing.
 *
 * One thing it does not reach, and somebody will otherwise go looking for the bug:
 * `app/+html.tsx` writes `<html lang>` at EXPORT time, with no store anywhere to
 * ask, so the served document says `de` whatever this key holds.
 * `i18n/Localisation.tsx`'s `useDocumentLanguage` sets the attribute again on the
 * first render, out of the store, which is where the override lands — so the
 * attribute is right in the browser and stale in the file, and that is the split
 * rather than a fault.
 */
export const PREVIEW_LOCALE_KEY = 'workbench:locale';

/**
 * Every member of `Locale`, as a table keyed by the union rather than as a list, so
 * that a third language added to the core is a type error here instead of a code
 * this file quietly refuses.
 */
const KNOWN: Record<Locale, true> = { de: true, en: true };
const CODES = Object.keys(KNOWN);

function isLocale(value: string | null): value is Locale {
  return value !== null && CODES.includes(value);
}

/**
 * The language the workbench is asking for, or null when nobody is asking.
 *
 * Guarded rather than platform-split, like the two overrides in `lib/home/`: a phone
 * has no `localStorage`, a browser with site data switched off throws on the
 * accessor, and both answer the same way here — nobody has named a language, so the
 * one this app ships stands.
 *
 * **Validated against the union rather than trusted**, which neither override beside
 * it has to be in the same way. `createAppStore()` takes the value it is given and
 * `Localisation.tsx` looks the catalogue up by it, so `fr` in this key is not a
 * setting that fails but an `IntlProvider` handed `undefined`: every string falling
 * through to its English `defaultMessage` under a `lang` attribute claiming French,
 * which is a screen that works and reads wrong. Junk is nobody asking, which is how
 * the address this key is written from already reads `tm=`.
 */
export function previewLocale(): Locale | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const asked = window.localStorage.getItem(PREVIEW_LOCALE_KEY);
    return isLocale(asked) ? asked : null;
  } catch {
    return null;
  }
}
