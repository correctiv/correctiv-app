/**
 * The tab bar as a document, and what it takes to read one somebody else wrote.
 *
 * [ADR 0071](../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
 * §4 to §6 and [ADR 0078](../../../../adr/0078-layouts-ship-and-demo.md) §5:
 * `data/layouts/<layout>/navigation.json` lists the screens the app opens with, in order.
 * Nothing is implied: Home is a screen like the others, it is first only where the
 * document writes it first, and **the first entry is the screen the app starts on**.
 *
 * ## The document
 *
 * `{ version: 1, tabs: [...screen ids], maxTabs?: 2..5 }`. `maxTabs` is the most tabs shown
 * at once, "Mehr" included, and defaults to the platform ceiling of five. What a reader
 * sees follows from the number of entries `n` that can be opened:
 *
 * | entries | the app draws |
 * |---|---|
 * | 0 | an empty state, and no bar |
 * | 1 | the screen, with no bar |
 * | 2 to `maxTabs` | every entry as a tab |
 * | more | the first `maxTabs - 1` as tabs and "Mehr", which lists the rest |
 *
 * A screen the layout carries and the document does not list is behind "Mehr" as well, and
 * that tab is then drawn below `maxTabs` too, as one of the tabs shown.
 *
 * ## Why this parses by hand, and why a fault refuses the whole document
 *
 * Like `parseHomeLayout`: the fetched copy is somebody else's file, nothing here throws,
 * and the answer is a document plus a list of what was wrong. Unlike a screen, a tab bar
 * has no smaller part to lose: a bar missing one tab is a different bar, not a slightly
 * poorer one, and §6 names the fallback, which is the bundled navigation. So any problem
 * (an unknown key, a malformed id, a duplicate) refuses the document. An id that names no
 * screen is **not** a problem here: a screen can be deleted while the navigation still
 * lists it, and that leaves no tab behind (the caller's `reachable`). The deploy's check is
 * the one that refuses it, before it is published.
 */

import { SHIP_NAVIGATION } from '../data/layouts/ship/bundle';
import { platform } from '../ports';
import { screenIdFault } from './screen-id';

export const NAVIGATION_VERSION = 1;

/** The route of the overflow tab. The app owns the screen; the document never names it. */
export const MORE_TAB = 'mehr';

/** Fewest tabs `maxTabs` may allow: one screen and "Mehr", which is what two can show. */
export const MIN_MAX_TABS = 2;
/**
 * Most tabs a bar shows, "Mehr" included. Android's Material tabs throw on a sixth and iOS
 * folds a sixth into its own "More", which cannot be switched off (measured 2026-10-01).
 * The app draws its own bar now ([ADR 0079](../../../../adr/0079-the-app-draws-its-tabs-from-the-layout.md)),
 * and the ceiling stays because a sixth label no longer fits a phone either.
 */
export const MAX_TABS = 5;

export interface Navigation {
  readonly version: typeof NAVIGATION_VERSION;
  /** Screen ids in order. The first is the start. */
  readonly tabs: readonly string[];
  /** Most tabs shown, "Mehr" included: `MIN_MAX_TABS` to `MAX_TABS`. */
  readonly maxTabs: number;
}

export type NavigationProblemCode =
  | 'navigation-not-an-object'
  | 'navigation-version-invalid'
  | 'navigation-unknown-key'
  | 'navigation-tabs-invalid'
  | 'navigation-tab-reserved'
  | 'navigation-tab-malformed'
  | 'navigation-tab-duplicate'
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

/** Read a navigation document. */
export function parseNavigation(document: unknown): NavigationParse {
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
      value >= MIN_MAX_TABS &&
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
      const fault = screenIdFault(tab);
      if (tab === MORE_TAB || fault === 'reserved') fail('navigation-tab-reserved', { tab });
      else if (fault !== null) fail('navigation-tab-malformed', { tab });
      else if (tabs.includes(tab)) fail('navigation-tab-duplicate', { tab });
      else tabs.push(tab);
    }
  }

  if (problems.length > 0) return { navigation: null, problems };
  return { navigation: { version: NAVIGATION_VERSION, tabs, maxTabs }, problems };
}

/** What a bar draws. */
export interface TabBar {
  /** `empty`: nothing to open. `single`: the screen alone. `tabs`: a bar of `tabs`. */
  readonly kind: 'empty' | 'single' | 'tabs';
  /** The screen the app opens on, which is the first entry; null when there is none. */
  readonly start: string | null;
  /** Every entry that can be opened, in order: the tabs, the ones behind "Mehr", or the one screen. */
  readonly entries: readonly string[];
  /** The tabs shown, in order. Ends in `MORE_TAB` when anything is behind it. */
  readonly tabs: readonly string[];
  /** The screens behind "Mehr" that the navigation lists, in order. */
  readonly more: readonly string[];
}

/**
 * The bar a navigation makes, by the table at the top of this file. An entry that cannot
 * be opened is removed before anything is counted, so a deleted screen and a gated one
 * leave no tab and no gap.
 */
export function arrangeTabBar(
  navigation: Navigation,
  reachable: (screen: string) => boolean,
  unlisted = false,
): TabBar {
  const entries = navigation.tabs.filter(reachable);
  const start = entries[0] ?? null;
  if (start === null) return { kind: 'empty', start, entries, tabs: [], more: [] };
  if (entries.length === 1 && !unlisted)
    return { kind: 'single', start, entries, tabs: [], more: [] };
  const shown = entries.length + (unlisted ? 1 : 0);
  if (shown <= navigation.maxTabs) {
    return {
      kind: 'tabs',
      start,
      entries,
      tabs: unlisted ? [...entries, MORE_TAB] : entries,
      more: [],
    };
  }
  const kept = navigation.maxTabs - 1;
  return {
    kind: 'tabs',
    start,
    entries,
    tabs: [...entries.slice(0, kept), MORE_TAB],
    more: entries.slice(kept),
  };
}

/** The navigation this build bundles, as written. */
export const BUNDLED_NAVIGATION_DOCUMENT: unknown = SHIP_NAVIGATION;

export interface TabBarOptions {
  /** A navigation document from outside: the fetched copy, or an override. Undefined: none. */
  candidate?: unknown;
  reachable: (screen: string) => boolean;
  /** Whether a screen the navigation does not list can be opened. */
  unlisted?: boolean;
  /** The navigation to fall back to. The bundled one, unless a test holds another layout's. */
  bundled?: unknown;
}

export interface TabBarChoice {
  readonly bar: TabBar;
  readonly source: 'candidate' | 'bundled';
  /** What was wrong with the candidate, for the host to report once. */
  readonly problems: readonly NavigationProblem[];
}

/**
 * The bar to draw: the candidate if it parses, else the bundled navigation (ADR 0071 §6).
 *
 * A candidate that parses is the layout, **even when nothing in it can be opened**: that
 * is an empty state and not a reason to draw some other layout's tabs. The bundle is the
 * answer to a document that is wrong, which is the one thing a fetch can bring that a
 * publisher did not mean. A bundle that is itself wrong draws the empty state; a test
 * holds that it never is.
 */
export function chooseTabBar({
  candidate,
  reachable,
  unlisted,
  bundled: bundledDocument = BUNDLED_NAVIGATION_DOCUMENT,
}: TabBarOptions): TabBarChoice {
  const problems: NavigationProblem[] = [];
  if (candidate !== undefined) {
    const parsed = parseNavigation(candidate);
    problems.push(...parsed.problems);
    if (parsed.navigation) {
      return {
        bar: arrangeTabBar(parsed.navigation, reachable, unlisted),
        source: 'candidate',
        problems,
      };
    }
  }
  const bundled = parseNavigation(bundledDocument);
  problems.push(...bundled.problems);
  const bar = bundled.navigation
    ? arrangeTabBar(bundled.navigation, reachable, unlisted)
    : { kind: 'empty' as const, start: null, entries: [], tabs: [], more: [] };
  return { bar, source: 'bundled', problems };
}

/** Report what `chooseTabBar` found wrong, through the same port a layout fault uses. */
export function reportNavigationProblems(problems: readonly NavigationProblem[]): void {
  for (const problem of problems) {
    platform().errors.report({ domain: 'layout', code: problem.code, context: problem.context });
  }
}
