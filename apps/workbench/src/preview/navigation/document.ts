import {
  arrangeTabBar,
  MAX_TABS,
  MIN_TABS,
  NAVIGATION_VERSION,
  parseNavigation,
  type Navigation,
  type NavigationProblem,
  type TabBar,
} from '@correctiv/app-core/lib/navigation';
import { DEMO_NAVIGATION } from '@correctiv/app-core/data/layouts/demo/bundle';

/**
 * The navigation editor's model: pure functions over the core's `Navigation`, with no
 * React and no `window`, because the dev server's save (`plugin/home-layout.ts`) and the
 * submission workflow (`scripts/submission-layout.ts`) load this file in Node.
 *
 * **The grammar is the core's.** Which documents are valid is `parseNavigation`; this
 * file adds the operations an editor needs, each of which
 * returns a document the parser accepts. Home is not in the document: it is the fixed
 * first entry (§4), so no operation here can move it or take it out.
 */

/**
 * What the app lets a navigation name after Home, in the screens' own names.
 *
 * Not messages, for the reason `preview/routes.ts` gives of the same names: the app ships
 * in German, and `Entdecken` is what the tab says. A second copy of the app's
 * `DESTINATIONS` keys, held to it in both directions by `test/preview/screen-editor.test.ts`
 * (the workbench may read the app, but this file is loaded by Node, which cannot resolve
 * the app's `@/` imports).
 */
export const DESTINATION_NAMES: Readonly<Record<string, string>> = {
  entdecken: 'Entdecken',
  mediathek: 'Mediathek',
  mitmachen: 'Mitmachen',
  profil: 'Profil',
};

/** The overflow tab's name, which the app draws and the document never names. */
export const MORE_NAME = 'Mehr';

/** The destinations a navigation may name: the parser's `known` set. */
export const KNOWN_DESTINATIONS: ReadonlySet<string> = new Set(Object.keys(DESTINATION_NAMES));

/**
 * The navigation the editor starts from, which is also what Discard returns to: the demo
 * layout's, because the one the app bundles has no entry (ADR 0078 §7).
 */
export const SHIPPED_NAVIGATION: Navigation = (() => {
  const { navigation } = parseNavigation(DEMO_NAVIGATION, KNOWN_DESTINATIONS);
  if (!navigation) throw new Error('the demo navigation does not parse');
  return navigation;
})();

export type EditorProblemCode = NavigationProblem['code'];

export interface EditorProblem {
  readonly code: EditorProblemCode;
  readonly context: NavigationProblem['context'];
}

export interface Checked {
  /** Null when anything was wrong. */
  readonly navigation: Navigation | null;
  readonly problems: readonly EditorProblem[];
}

/**
 * Whether a document is one the editor may write: the parser's reading, against the
 * destinations the app declares. No minimum of entries (ADR 0078 §4): a layout with none is
 * valid, and what a bar of fewer than `MIN_TABS` draws is the app's question.
 */
export function checkNavigation(document: unknown): Checked {
  const { navigation, problems } = parseNavigation(document, KNOWN_DESTINATIONS);
  return navigation ? { navigation, problems: [] } : { navigation: null, problems };
}

/** Problems of a navigation held in the editor, for the message under the list. */
export function problemsOf(navigation: Navigation): readonly EditorProblem[] {
  return checkNavigation(navigation).problems;
}

/** The ids a navigation could still add, in the app's own order. */
export function unused(navigation: Navigation): readonly string[] {
  return Object.keys(DESTINATION_NAMES).filter((id) => !navigation.tabs.includes(id));
}

/** A destination put on the bar at the end, or taken off it. Home cannot be taken off. */
export function withTab(navigation: Navigation, id: string, on: boolean): Navigation {
  if (!KNOWN_DESTINATIONS.has(id)) return navigation;
  const listed = navigation.tabs.includes(id);
  if (on === listed) return navigation;
  return {
    ...navigation,
    tabs: on ? [...navigation.tabs, id] : navigation.tabs.filter((t) => t !== id),
  };
}

/** A destination moved by `delta` places among the entries after Home; clamped at the ends. */
export function movedTab(navigation: Navigation, id: string, delta: number): Navigation {
  const from = navigation.tabs.indexOf(id);
  if (from === -1) return navigation;
  const to = Math.min(Math.max(from + delta, 0), navigation.tabs.length - 1);
  if (to === from) return navigation;
  const tabs = [...navigation.tabs];
  tabs.splice(to, 0, ...tabs.splice(from, 1));
  return { ...navigation, tabs };
}

/** The "Mehr" threshold, kept between `MIN_TABS` and `MAX_TABS`. */
export function withMaxTabs(navigation: Navigation, maxTabs: number): Navigation {
  const clamped = Math.min(Math.max(Math.round(maxTabs), MIN_TABS), MAX_TABS);
  return clamped === navigation.maxTabs ? navigation : { ...navigation, maxTabs: clamped };
}

/**
 * The bar this navigation draws when every destination is reachable, or null when fewer
 * than `MIN_TABS` entries remain. Which of them a release can actually open is the
 * feature gate's question (ADR 0072), and the editor cannot ask it.
 */
export function barOf(navigation: Navigation): TabBar | null {
  return arrangeTabBar(navigation, () => true);
}

/**
 * The file as the repository's formatter prints it: three keys in the order the shipped
 * file has them, the list of tabs on one line while it fits. `test/preview/screen-editor.test.ts`
 * measures it against oxfmt, as `formatLayoutDocument` is.
 */
export function formatNavigationDocument(navigation: Navigation): string {
  const tabs = navigation.tabs.map((tab) => JSON.stringify(tab)).join(', ');
  return [
    '{',
    `  "version": ${NAVIGATION_VERSION},`,
    `  "maxTabs": ${navigation.maxTabs},`,
    `  "tabs": [${tabs}]`,
    '}',
    '',
  ].join('\n');
}

/** Whether the navigation differs from the file, compared as the printed file. */
export function navigationDiffers(navigation: Navigation): boolean {
  return formatNavigationDocument(navigation) !== formatNavigationDocument(SHIPPED_NAVIGATION);
}

/** A stored navigation the editor can open, or null. Anything the parser refuses is not opened. */
export function restorableNavigation(document: unknown): Navigation | null {
  return checkNavigation(document).navigation;
}

export { HOME_TAB, MAX_TABS, MIN_TABS } from '@correctiv/app-core/lib/navigation';
