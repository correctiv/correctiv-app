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
export type CustomScreenIdFault =
  | 'not-a-string'
  | 'empty'
  | 'too-long'
  | 'malformed'
  | 'declared'
  | 'reserved';

/**
 * Ids that are well-formed and still not a screen's. `navigation` is the name a layout
 * submission gives the tab bar's document (ADR 0071 §4), so a screen of that name could
 * not be told apart from it on the wire.
 */
const RESERVED_IDS: readonly string[] = ['navigation'];

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
  if (RESERVED_IDS.includes(id)) return 'reserved';
  return null;
}

/** `customScreenIdFault` as a type guard, for the route and the lists that read an id. */
export function isCustomScreenId(id: unknown): id is string {
  return customScreenIdFault(id) === null;
}

// --- every id is a screen's, and a layout has one of its own -------------------------

/** Why an id cannot name a screen at all. The grammar of `CustomScreenIdFault`, minus who owns the name. */
export type ScreenIdFault = Exclude<CustomScreenIdFault, 'declared'>;

/**
 * Whether `id` may name a screen in a layout, and the first reason it may not.
 *
 * [ADR 0078](../../../../adr/0078-layouts-ship-and-demo.md) §4: a built-in screen is no
 * special case, so the grammar is the same for every id and the only ids refused beyond it
 * are the reserved ones. `customScreenIdFault` keeps refusing the declared names for as
 * long as the app draws those five from code, which is the app's side of the same change.
 */
export function screenIdFault(id: unknown): ScreenIdFault | null {
  // With nothing declared the one fault `customScreenIdFault` cannot return is `declared`.
  return customScreenIdFault(id, []) as ScreenIdFault | null;
}

/** `screenIdFault` as a type guard. */
export function isScreenId(id: unknown): id is string {
  return screenIdFault(id) === null;
}

/** Why an id cannot name a layout. */
export type LayoutIdFault = 'not-a-string' | 'empty' | 'too-long' | 'malformed';

/**
 * Whether `id` may name a layout, a folder under `data/layouts/`, and the first reason it
 * may not (ADR 0078 §1, §6). The grammar of a screen id and nothing beyond it: no slash, no
 * dot and no capital, so the set of paths a submission can name is closed by the id and not
 * by a list, and `..` is not a layout.
 */
export function layoutIdFault(id: unknown): LayoutIdFault | null {
  if (typeof id !== 'string') return 'not-a-string';
  if (id.length === 0) return 'empty';
  if (id.length > CUSTOM_SCREEN_ID_MAX_LENGTH) return 'too-long';
  return CUSTOM_SCREEN_ID.test(id) ? null : 'malformed';
}

/** `layoutIdFault` as a type guard. */
export function isLayoutId(id: unknown): id is string {
  return layoutIdFault(id) === null;
}

/** The one layout the app bundles. Every other is the workbench's alone (ADR 0078 §3). */
export const SHIPPED_LAYOUT = 'ship';
