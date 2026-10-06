/**
 * The tab bar as a document, and what it takes to read one somebody else wrote.
 *
 * [ADR 0071](../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
 * §4 to §6: `data/layout/navigation.json` chooses which destinations the app declares are
 * tabs, and in what order. Home is always the first tab and is not in the document, so it
 * cannot be taken out. The app declares what a destination is (screen, icon, label,
 * feature); this file knows only their ids.
 *
 * ## The document
 *
 * `{ version: 1, tabs: [...ids], maxTabs?: 2..5 }`. `maxTabs` is the most tabs the bar
 * shows, "Mehr" included, and defaults to the platform ceiling of five. When Home plus the
 * reachable `tabs` are more than that, the first `maxTabs - 1` stay and the rest go behind
 * a tab called "Mehr", which is itself one of the tabs shown (§5). The default document
 * reproduces the bar the app had before it was a document.
 *
 * ## Why this parses by hand, and why a fault refuses the whole document
 *
 * Like `parseHomeLayout`: the fetched copy is somebody else's file, nothing here throws,
 * and the answer is a document plus a list of what was wrong. Unlike a screen, a tab bar
 * has no smaller part to lose: a bar missing one tab is a different bar, not a slightly
 * poorer one, and §6 names the fallback, which is the bundled navigation. So any problem
 * (an unknown key, a destination this app does not know, a duplicate) refuses the document.
 */

import navigationDocument from '../data/layout/navigation.json';
import { platform } from '../ports';

export const NAVIGATION_VERSION = 1;

/** The route of the first tab. Fixed, and never named in the document. */
export const HOME_TAB = 'index';
/** The route of the overflow tab. The app owns the screen; the document never names it. */
export const MORE_TAB = 'mehr';

/** Fewest tabs a bar shows. Home plus one. */
export const MIN_TABS = 2;
/**
 * Most tabs a bar shows, "Mehr" included. Android's Material tabs throw on a sixth and iOS
 * folds a sixth into its own "More", which cannot be switched off (measured 2026-10-01).
 */
export const MAX_TABS = 5;

export interface Navigation {
  readonly version: typeof NAVIGATION_VERSION;
  /** Destination ids after Home, in order. */
  readonly tabs: readonly string[];
  /** Most tabs shown, "Mehr" included: `MIN_TABS` to `MAX_TABS`. */
  readonly maxTabs: number;
}

export type NavigationProblemCode =
  | 'navigation-not-an-object'
  | 'navigation-version-invalid'
  | 'navigation-unknown-key'
  | 'navigation-tabs-invalid'
  | 'navigation-tab-reserved'
  | 'navigation-tab-duplicate'
  | 'navigation-tab-unknown'
  | 'navigation-max-tabs-invalid';

export interface NavigationProblem {
  readonly code: NavigationProblemCode;
  readonly context: Record<string, string | number | boolean | null>;
}

export interface NavigationParse {
  /** Null when anything was wrong: the caller falls back to the bundled navigation. */
  readonly navigation: Navigation | null;
  readonly problems: readonly NavigationProblem[];
}

const KEYS: ReadonlySet<string> = new Set(['version', 'tabs', 'maxTabs']);

/**
 * Read a navigation document.
 *
 * `known` is the set of destination ids the host declares; a tab outside it is a screen
 * this version of the app does not have (§6). Left out, the membership is not checked,
 * which is what the deploy's own check does: it has no app to ask.
 */
export function parseNavigation(document: unknown, known?: ReadonlySet<string>): NavigationParse {
  const problems: NavigationProblem[] = [];
  const fail = (code: NavigationProblemCode, context: NavigationProblem['context'] = {}) => {
    problems.push({ code, context });
  };

  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    fail('navigation-not-an-object');
    return { navigation: null, problems };
  }
  const record = document as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (!KEYS.has(key)) fail('navigation-unknown-key', { key });
  }
  if (record['version'] !== NAVIGATION_VERSION) {
    fail('navigation-version-invalid', {
      version: typeof record['version'] === 'number' ? record['version'] : null,
    });
  }

  let maxTabs = MAX_TABS;
  if (record['maxTabs'] !== undefined) {
    const value = record['maxTabs'];
    if (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= MIN_TABS &&
      value <= MAX_TABS
    ) {
      maxTabs = value;
    } else {
      fail('navigation-max-tabs-invalid', { maxTabs: typeof value === 'number' ? value : null });
    }
  }

  const tabs: string[] = [];
  const listed = record['tabs'];
  if (!Array.isArray(listed) || listed.some((tab) => typeof tab !== 'string')) {
    fail('navigation-tabs-invalid');
  } else {
    for (const tab of listed as string[]) {
      if (tab === HOME_TAB || tab === MORE_TAB) fail('navigation-tab-reserved', { tab });
      else if (tabs.includes(tab)) fail('navigation-tab-duplicate', { tab });
      else if (known !== undefined && !known.has(tab)) fail('navigation-tab-unknown', { tab });
      else tabs.push(tab);
    }
  }

  if (problems.length > 0) return { navigation: null, problems };
  return { navigation: { version: NAVIGATION_VERSION, tabs, maxTabs }, problems };
}

/** What a bar draws. */
export interface TabBar {
  /** The tabs shown, in order. Ends in `MORE_TAB` when anything overflowed. */
  readonly tabs: readonly string[];
  /** The destinations behind "Mehr", in order. Empty when nothing overflowed. */
  readonly more: readonly string[];
}

/**
 * The bar a navigation makes once the unreachable destinations are removed (ADR 0072 §5),
 * or null when fewer than `MIN_TABS` remain, which §6 answers with the bundled navigation.
 *
 * `reachable` is asked about every destination after Home; Home is not asked about, as it
 * cannot be switched off.
 *
 * `withMore` keeps "Mehr" in the bar when nothing overflowed: a screen the newsroom made
 * is not a tab (ADR 0075 §7) and is reached from that list, so a document that carries one
 * needs the tab even when every destination fits. A bar that is already full gives up its
 * last tab for it, as an overflow does, and `more` then holds only what moved.
 */
export function arrangeTabBar(
  navigation: Navigation,
  reachable: (tab: string) => boolean,
  withMore = false,
): TabBar | null {
  const entries = [HOME_TAB, ...navigation.tabs.filter(reachable)];
  if (entries.length < MIN_TABS) return null;
  if (entries.length < navigation.maxTabs) {
    return { tabs: withMore ? [...entries, MORE_TAB] : entries, more: [] };
  }
  if (entries.length === navigation.maxTabs && !withMore) return { tabs: entries, more: [] };
  const kept = navigation.maxTabs - 1;
  return { tabs: [...entries.slice(0, kept), MORE_TAB], more: entries.slice(kept) };
}

/** The navigation this build bundles, as written. */
export const BUNDLED_NAVIGATION_DOCUMENT: unknown = navigationDocument;

export interface TabBarOptions {
  /** A navigation document from outside: the fetched copy, or an override. Undefined: none. */
  candidate?: unknown;
  known: ReadonlySet<string>;
  reachable: (tab: string) => boolean;
  /** Whether "Mehr" has a use beyond an overflow, which is a custom screen to list. */
  withMore?: boolean;
}

export interface TabBarChoice {
  readonly bar: TabBar;
  readonly source: 'candidate' | 'bundled';
  /** What was wrong with the candidate, for the host to report once. */
  readonly problems: readonly NavigationProblem[];
}

/**
 * The bar to draw: the candidate if it parses, names only destinations the app knows and
 * leaves at least two tabs once the unreachable ones are gone, else the bundled
 * navigation (ADR 0071 §6). Home alone is the last resort, for a bundle that is itself
 * wrong; a test holds that it never is.
 */
export function chooseTabBar({
  candidate,
  known,
  reachable,
  withMore,
}: TabBarOptions): TabBarChoice {
  const problems: NavigationProblem[] = [];
  if (candidate !== undefined) {
    const parsed = parseNavigation(candidate, known);
    problems.push(...parsed.problems);
    const bar = parsed.navigation ? arrangeTabBar(parsed.navigation, reachable, withMore) : null;
    if (bar) return { bar, source: 'candidate', problems };
  }
  const bundled = parseNavigation(BUNDLED_NAVIGATION_DOCUMENT, known);
  problems.push(...bundled.problems);
  const bar = (bundled.navigation && arrangeTabBar(bundled.navigation, reachable, withMore)) || {
    tabs: [HOME_TAB],
    more: [],
  };
  return { bar, source: 'bundled', problems };
}

/** Report what `chooseTabBar` found wrong, through the same port a layout fault uses. */
export function reportNavigationProblems(problems: readonly NavigationProblem[]): void {
  for (const problem of problems) {
    platform().errors.report({ domain: 'layout', code: problem.code, context: problem.context });
  }
}
