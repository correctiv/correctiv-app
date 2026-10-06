import { useMemo, useSyncExternalStore } from 'react';

import { isReachable } from '@correctiv/app-core/features/features';
import {
  chooseTabBar,
  MORE_TAB,
  NAVIGATION_VERSION,
  MAX_TABS,
  reportNavigationProblems,
  type TabBar,
  type TabBarChoice,
} from '@correctiv/app-core/lib/navigation';
import {
  navigationDocumentOf,
  SCREEN_DOCUMENTS,
  parseScreenDocument,
  type ScreenWords,
} from '@correctiv/app-core/lib/screen-layout';
import { fetchedLayouts } from '@correctiv/app-core/stores/homeLayout';

import { BUILT_AT, layoutSet, screenIds, screenLayout, subscribeToLayout } from '@/lib/home/layout';
import { tabReachable } from '@/lib/features';
import { coreStore } from '@/lib/store/core';

/**
 * Where a navigation somebody is looking at arrives, as opposed to one a phone draws:
 * the preview seam `workbench:home-layout` is for screens, for the tab bar. Frame only.
 */
export const NAVIGATION_OVERRIDE_KEY = 'workbench:navigation';

function overrideDocument(): unknown {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    const text = window.localStorage.getItem(NAVIGATION_OVERRIDE_KEY);
    return text === null ? undefined : (JSON.parse(text) as unknown);
  } catch {
    return undefined;
  }
}

/**
 * The fetched document this process reads, parsed, or `undefined` when there is none this
 * build may draw. One copy per decision, because the entries and the words come out of
 * documents the same fetch brought ([ADR 0075](../../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §5): there is no moment at which the bar shows a tab the last fetch added under the name
 * the one before it had.
 */
function fetchedBody(): unknown {
  const text = fetchedLayouts(coreStore.getState().homeLayout, BUILT_AT);
  if (text === null) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * What one screen is called: the words of the document that is drawn for it, and the
 * bundled document's where that one's words were refused. A title is the one word a
 * document may not leave out (ADR 0075 §2), so a refused one falls back rather than leaving
 * the bar with a blank tab. Nothing is reported: `screenLayout` reports the same documents
 * once, when the screen itself is read.
 */
function wordsOf(screen: string): ScreenWords | null {
  const drawn = screenLayout(screen)?.words;
  if (drawn !== undefined && drawn !== null) return drawn;
  // A whole layout is all there is: its screen has no bundled words to fall back to.
  if (layoutSet() !== null) return null;
  const document = SCREEN_DOCUMENTS[screen];
  return document === undefined ? null : parseScreenDocument(document).words;
}

/** A navigation with no entry, which a whole layout falls back to when its own is refused. */
const EMPTY_NAVIGATION = { version: NAVIGATION_VERSION, maxTabs: MAX_TABS, tabs: [] };

/** The bar and the words of every screen on it or behind it, taken together. */
export interface TabBarDecision {
  readonly bar: TabBar;
  /** Screens the layout carries and the navigation does not list: they are behind "Mehr" too. */
  readonly unlisted: readonly string[];
  readonly words: Readonly<Record<string, ScreenWords | null>>;
  readonly source: TabBarChoice['source'];
}

/** What was last reported, so that a decision made on every render says a fault once. */
let reported = '';

function reportOnce(problems: TabBarChoice['problems']): void {
  const key = JSON.stringify(problems);
  if (key === reported) return;
  reported = key;
  reportNavigationProblems(problems);
}

function choose(body: unknown, unlisted: boolean): TabBarChoice {
  const state = coreStore.getState();
  // A screen is reachable when it exists and its feature is on: one that was deleted leaves
  // no tab, which is the point of every screen being one route (ADR 0079).
  const reachable = (screen: string) =>
    screenLayout(screen) !== null && tabReachable(screen, (id) => isReachable(state, id));
  const fetched = body === undefined ? undefined : navigationDocumentOf(body);
  const problems: TabBarChoice['problems'][number][] = [];
  const set = layoutSet();
  if (set !== null) {
    // The navigation of a whole layout is that layout's, and a refused one is the empty bar,
    // not the bundled one: the bundle belongs to another layout.
    return chooseTabBar({
      candidate: set.navigation,
      reachable,
      unlisted,
      bundled: EMPTY_NAVIGATION,
    });
  }
  for (const candidate of [overrideDocument(), fetched]) {
    if (candidate === undefined) continue;
    const tried = chooseTabBar({ candidate, reachable, unlisted });
    problems.push(...tried.problems);
    if (tried.source === 'candidate') return { ...tried, problems };
  }
  const bundled = chooseTabBar({ reachable, unlisted });
  return { ...bundled, problems: [...problems, ...bundled.problems] };
}

/**
 * The bar this app draws right now: the workbench's override, the fetched copy, the bundled
 * navigation (ADR 0071 §6), arranged by the core's table (ADR 0078 §5).
 *
 * Two passes, because "Mehr" earns its place below `maxTabs` only when a screen the
 * navigation does not list can be opened, and which screens the navigation lists is what the
 * first pass says.
 */
export function decideTabBar(): TabBarDecision {
  const body = fetchedBody();
  let choice = choose(body, false);
  reportOnce(choice.problems);
  const listed = new Set(choice.bar.entries);
  const state = coreStore.getState();
  const unlisted =
    choice.bar.kind === 'empty'
      ? []
      : screenIds().filter(
          (id) => !listed.has(id) && tabReachable(id, (feature) => isReachable(state, feature)),
        );
  if (unlisted.length > 0) choice = choose(body, true);
  const words: Record<string, ScreenWords | null> = {};
  for (const id of [...choice.bar.tabs, ...choice.bar.more, ...unlisted]) {
    if (id !== MORE_TAB) words[id] = wordsOf(id);
  }
  return { bar: choice.bar, unlisted, words, source: choice.source };
}

/**
 * The decision as the tab bar's hosts read it, **re-read when anything it is made of
 * changes**: the workbench's navigation or a screen's override, a fetch landing, or the
 * features the app can reach. The bar used to be decided once per process because the system's
 * own tab bar cannot change its triggers without losing every tab's state (measured
 * 2026-10-01); this one is ours and has no such state to lose
 * ([ADR 0079](../../../../../adr/0079-the-app-draws-its-tabs-from-the-layout.md)).
 *
 * A string snapshot, which is what `useSyncExternalStore` can compare: the store notifies
 * on every action, twice a second while audio plays, and the decision is a fresh object
 * each time it is made.
 */
export function useTabBarDecision(): TabBarDecision {
  const snapshot = () => JSON.stringify(decideTabBar());
  const subscribe = (listener: () => void) => {
    let held = snapshot();
    const notify = () => {
      const next = snapshot();
      if (next === held) return;
      held = next;
      listener();
    };
    const unsubscribeStore = coreStore.subscribe(notify);
    const unsubscribeDocuments = subscribeToLayout(notify, NAVIGATION_OVERRIDE_KEY);
    return () => {
      unsubscribeStore();
      unsubscribeDocuments();
    };
  };
  const joined = useSyncExternalStore(subscribe, snapshot, snapshot);
  return useMemo(() => JSON.parse(joined) as TabBarDecision, [joined]);
}
