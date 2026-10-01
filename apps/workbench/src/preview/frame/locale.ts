import type { Locale } from '@correctiv/app-core/stores/settings';

/**
 * What language the framed app is built in, and the one place this tool says so.
 *
 * The other half is `apps/mobile/src/lib/locale.ts`, which is where the argument for
 * the seam lives in full: the shell and the app are one origin, so `window.localStorage`
 * here **is** the app's; it is the only door that works against the published export,
 * where `expo export` has left no dev handle to dispatch through; and the key is spelled
 * `workbench:` because a screen that quietly differs from the repository is worse than
 * one that says who changed it. The same string is written on both sides and nothing but
 * `test/preview/locale.test.ts` holds them together, which is the failure the two home
 * keys already have: the select would move, the frame would go on rendering German, and
 * nothing anywhere would say why.
 *
 * ## Why this one costs a reload and the clock next door does not
 *
 * The app subscribes to `workbench:home-time` and redraws on a `storage` event. It
 * cannot do that here. `packages/app-core/src/stores/settings.ts` argues that the locale
 * is supplied by the host **at construction** — there is no `setLocale` action to
 * dispatch and `PERSISTED_KEYS` leaves the field out — so the app reads this key once,
 * while its store is being built. Changing the language is therefore a restart, and
 * `usePreview` folds it into the effect that already knows how to boot the frame, beside
 * the storage fixture, which has to be in place before the app mounts for the same
 * reason. One place decides when the frame loads.
 *
 * It is also why this control needs no dev handle, unlike the appearance: the theme
 * travels as a dispatch and the published export has nothing to dispatch to, whereas a
 * key in storage is read by any build that boots after it is written.
 *
 * ## Why the language lives in the address
 *
 * [ADR 0050](../../../../../adr/0050-the-workbench-gets-a-second-audience.md) §4 splits
 * the two languages this site deals in: the reader's own is a fact about the reader and
 * lives in `localStorage` under `workbench:language`; the framed app's is a fact about
 * what is on screen and belongs in the address beside `t=`. `preview/state.ts` carries
 * it as `lg`.
 *
 * The second reason is the one `home/clock.ts` gives at length and it is sharper here. A
 * language held only in storage is durable state nobody can see: `frame/handle.ts` makes
 * `BASE` the site's own `/app`, so `usePreview`'s `onRaw` opens the published app in a
 * tab of its own on this origin. Choose English, open raw, shut the workbench, and
 * `<site>/app/` is in English for that browser for ever — which reads as the app having
 * shipped the wrong language rather than as a tool having left something switched on.
 * Held in the address, an address that names no language **clears** the key, and the two
 * exits are the two `home/clock.ts` names: the view going away, which `usePreview`
 * handles on unmount, and the page going away, which is `pagehide` with `pageshow`
 * putting it back for a document restored from the back/forward cache.
 */
export const PREVIEW_LOCALE_KEY = 'workbench:locale';

/**
 * Every language the app can be built in, as a table keyed by the union so that a
 * third one added to the core is a type error here rather than an option this site
 * quietly stops offering. `apps/mobile/src/lib/locale.ts` keeps the same table on
 * the reading side, for the same reason.
 */
const KNOWN: Record<Locale, true> = { de: true, en: true };

/** The codes the control offers, in the order it offers them. */
export const LOCALES = Object.keys(KNOWN) as Locale[];

/** Whether a string off the address is a language the app has a catalogue for. */
export function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as string[]).includes(value);
}

/**
 * Put the language where the framed app will find it, or take it away.
 *
 * `null` is the app in the language it ships, and it removes the key rather than
 * writing `de` — a key written once and then agreeing for a while is a state nobody
 * can see and nobody clears, and it would also pin the app to German on the day
 * `SHIPPED_LOCALE` changes.
 */
export function apply(lang: Locale | null): void {
  try {
    if (lang === null) window.localStorage.removeItem(PREVIEW_LOCALE_KEY);
    else window.localStorage.setItem(PREVIEW_LOCALE_KEY, lang);
  } catch {
    // Site data switched off. Nothing can be previewed, and nothing may throw.
  }
}
