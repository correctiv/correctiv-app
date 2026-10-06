/**
 * Which screens exist by id, and what an id may be.
 *
 * Split out of `screen-layout.ts` so that `home-settings.ts` can hold a setting whose value
 * is a screen's id without importing the file that imports it (`screen-layout.ts` reads
 * `faultOf` from there). Everything here is a name and a rule about names; the documents
 * stay in `screen-layout.ts`, which re-exports all of it.
 */

/** A screen whose arrangement is a document. A union, so a second one is a type error where unthought of. */
export type ConfigurableScreen = 'home' | 'entdecken' | 'mediathek' | 'mitmachen' | 'profil';

/**
 * Any screen the editor and the submission can hold a document for: a declared one, or an id
 * the newsroom made (ADR 0075 §7).
 *
 * `ConfigurableScreen` stays closed, so every table keyed by it (`SCREEN_DOCUMENTS`, the
 * tab targets, the workbench's names and icons) still fails to compile when a declared
 * screen is added and forgotten. Only code that takes an id off the wire or out of a
 * file name widens to this, and it narrows with `isDeclaredScreen` before it reaches one
 * of those tables. The intersection keeps the declared names offered by the editor's
 * completion, which a bare `string` would swallow.
 */
export type ScreenId = ConfigurableScreen | (string & Record<never, never>);

export const CONFIGURABLE_SCREENS: readonly ConfigurableScreen[] = [
  'home',
  'entdecken',
  'mediathek',
  'mitmachen',
  'profil',
];

/** Whether `id` is a screen the app declares, which has a bundled document. */
export function isDeclaredScreen(id: string): id is ConfigurableScreen {
  return (CONFIGURABLE_SCREENS as readonly string[]).includes(id);
}

// --- screens the newsroom makes -----------------------------------------------------

/**
 * The longest id a custom screen may have.
 *
 * ADR 0075 §7 asks for a bound and names none. 40 is a route segment a person can read in
 * a deep link and a file name under `screens/`, with room for a campaign's two or three
 * words; the figure that actually fails is the joined document's (ADR 0061 §2), so this
 * one only keeps an id from being a paragraph.
 */
export const CUSTOM_SCREEN_ID_MAX_LENGTH = 40;

/** Lower-case ASCII letters and digits, with single hyphens between them. */
const CUSTOM_SCREEN_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Why an id cannot name a custom screen. */
export type CustomScreenIdFault = 'not-a-string' | 'empty' | 'too-long' | 'malformed' | 'declared';

/**
 * Whether `id` may name a screen the newsroom makes, and the first reason it may not.
 *
 * ADR 0075 §7: the id becomes a route segment (`/s/<id>`), a file name under `screens/`,
 * a key in the joined document and the suffix of `workbench:layout:<screen>`, so it is
 * held to more than the core's `id-unsafe` asks of any other id. `declared` is every id
 * the app declares, `CONFIGURABLE_SCREENS` by default: a custom screen that took one would
 * shadow a document the app draws itself.
 */
export function customScreenIdFault(
  id: unknown,
  declared: readonly string[] = CONFIGURABLE_SCREENS,
): CustomScreenIdFault | null {
  if (typeof id !== 'string') return 'not-a-string';
  if (id.length === 0) return 'empty';
  if (id.length > CUSTOM_SCREEN_ID_MAX_LENGTH) return 'too-long';
  if (!CUSTOM_SCREEN_ID.test(id)) return 'malformed';
  if (declared.includes(id)) return 'declared';
  return null;
}

/** `customScreenIdFault` as a type guard, for the route and the lists that read an id. */
export function isCustomScreenId(id: unknown): id is string {
  return customScreenIdFault(id) === null;
}
