import {
  arrangeTabBar,
  MAX_TABS,
  MIN_MAX_TABS,
  NAVIGATION_VERSION,
  parseNavigation,
  type Navigation,
  type NavigationProblem,
  type TabBar,
} from '@correctiv/app-core/lib/navigation';

/**
 * The navigation editor's model: pure functions over the core's `Navigation`, with no
 * React and no `window`, because the dev server's save (`plugin/home-layout.ts`) and the
 * submission workflow (`scripts/submission-layout.ts`) load this file in Node.
 *
 * **The grammar is the core's.** Which documents are valid is `parseNavigation`; this
 * file adds the operations an editor needs, each of which
 * returns a document the parser accepts. Home is an entry like the others (ADR 0078 §5): it
 * is first only where it is written first, and the first entry is the screen the app starts on.
 */

/** The overflow tab's name, which the app draws and the document never names. */
export const MORE_NAME = 'Mehr';

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
 * Whether a document is one the editor may write: the parser's reading. No minimum of
 * entries (ADR 0078 §4): a layout with none is valid, and what a bar of fewer than two draws
 * (the screen alone, or the empty state) is the app's question.
 */
export function checkNavigation(document: unknown): Checked {
  const { navigation, problems } = parseNavigation(document);
  return navigation ? { navigation, problems: [] } : { navigation: null, problems };
}

/** Problems of a navigation held in the editor, for the message under the list. */
export function problemsOf(navigation: Navigation): readonly EditorProblem[] {
  return checkNavigation(navigation).problems;
}

/**
 * The screens of the layout a navigation could still add, in the order given: every screen
 * the layout carries, not a fixed five (ADR 0080 §4).
 */
export function unused(navigation: Navigation, screens: readonly string[]): readonly string[] {
  return screens.filter((id) => !navigation.tabs.includes(id));
}

/**
 * A screen put on the bar at the end, or taken off it. Only a screen of the layout goes on;
 * taking one off needs no such test, so a stale entry can always be removed.
 */
export function withTab(
  navigation: Navigation,
  id: string,
  on: boolean,
  screens: readonly string[],
): Navigation {
  if (on && !screens.includes(id)) return navigation;
  const listed = navigation.tabs.includes(id);
  if (on === listed) return navigation;
  return {
    ...navigation,
    tabs: on ? [...navigation.tabs, id] : navigation.tabs.filter((t) => t !== id),
  };
}

/** A destination moved by `delta` places among the entries; clamped at the ends. */
export function movedTab(navigation: Navigation, id: string, delta: number): Navigation {
  const from = navigation.tabs.indexOf(id);
  if (from === -1) return navigation;
  const to = Math.min(Math.max(from + delta, 0), navigation.tabs.length - 1);
  if (to === from) return navigation;
  const tabs = [...navigation.tabs];
  tabs.splice(to, 0, ...tabs.splice(from, 1));
  return { ...navigation, tabs };
}

/** The "Mehr" threshold, kept between `MIN_MAX_TABS` and `MAX_TABS`. */
export function withMaxTabs(navigation: Navigation, maxTabs: number): Navigation {
  const clamped = Math.min(Math.max(Math.round(maxTabs), MIN_MAX_TABS), MAX_TABS);
  return clamped === navigation.maxTabs ? navigation : { ...navigation, maxTabs: clamped };
}

/**
 * The bar this navigation draws when every screen the layout carries can be opened, and none
 * it does not carry can: a screen that was deleted leaves no tab, as in the app (ADR 0079 §1).
 * Which of them a release can actually open is the feature gate's question (ADR 0072), and
 * the editor cannot ask it.
 */
export function barOf(navigation: Navigation, screens: readonly string[]): TabBar {
  return arrangeTabBar(navigation, (id) => screens.includes(id));
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

/** Whether the navigation differs from the layout's file, compared as the printed file. */
export function navigationDiffers(navigation: Navigation, shipped: Navigation): boolean {
  return formatNavigationDocument(navigation) !== formatNavigationDocument(shipped);
}

/** A stored navigation the editor can open, or null. Anything the parser refuses is not opened. */
export function restorableNavigation(document: unknown): Navigation | null {
  return checkNavigation(document).navigation;
}

export { MAX_TABS, MIN_MAX_TABS } from '@correctiv/app-core/lib/navigation';
