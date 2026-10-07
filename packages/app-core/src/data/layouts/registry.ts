/**
 * Every layout under `data/layouts/`, in one list (ADR 0078 §1).
 *
 * A new layout is its folder, a `bundle.ts` beside it and one line here: the workbench's
 * picker, its order, its defaults and its submissions all read this list and nothing else
 * names a layout. `test/layouts.test.ts` fails when the list and the folders part.
 *
 * **Not for the app.** The bundles it joins include every layout, and the app bundles `ship`
 * and nothing else (ADR 0078 §3), so only the workbench and the tests import this file;
 * the same test fails when something under `src/` or in `apps/mobile` does.
 */
import { DEMO_NAVIGATION, DEMO_SCREENS } from './demo/bundle';
import { SHIP_NAVIGATION, SHIP_SCREENS } from './ship/bundle';

/** What a layout's folder holds, as the bundle reads it: the screen documents and the navigation. */
export interface LayoutBundle {
  /** Each screen document of the layout by id, as written. */
  readonly screens: Readonly<Record<string, unknown>>;
  readonly navigation: unknown;
}

export interface LayoutEntry {
  readonly id: string;
  readonly bundle: LayoutBundle;
}

/**
 * The layouts, in the order a picker lists them: what the app ships first, then the one
 * with something in it, then whatever follows. An id a folder carries and this list does not
 * is listed after all of these, by name (`orderLayouts`).
 */
export const LAYOUTS: readonly LayoutEntry[] = [
  { id: 'ship', bundle: { screens: SHIP_SCREENS, navigation: SHIP_NAVIGATION } },
  { id: 'demo', bundle: { screens: DEMO_SCREENS, navigation: DEMO_NAVIGATION } },
];

/**
 * The layout with something in it, and the one a document that names no layout meant: a link
 * or a draft written before layouts could be chosen was always about this one (ADR 0078 §2).
 * It is a fact about those old documents and does not move when another layout is added.
 */
export const EXAMPLE_LAYOUT = 'demo';

/** One layout's bundle, or undefined for an id the list does not hold. */
export function layoutBundle(id: string): LayoutBundle | undefined {
  return LAYOUTS.find((entry) => entry.id === id)?.bundle;
}

/**
 * Ids in the picker's order: the list's own order first, every other id after it by name.
 * Takes the ids as an argument because the workbench lists the folders it finds, which may
 * be more than this list holds while somebody is adding one.
 */
export function orderLayouts(ids: Iterable<string>): string[] {
  const rank = (id: string) => {
    const at = LAYOUTS.findIndex((entry) => entry.id === id);
    return at === -1 ? LAYOUTS.length : at;
  };
  return [...ids].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
