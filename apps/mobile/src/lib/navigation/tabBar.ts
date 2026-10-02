import { isReachable } from '@correctiv/app-core/features/features';
import {
  chooseTabBar,
  reportNavigationProblems,
  type TabBarChoice,
} from '@correctiv/app-core/lib/navigation';
import { navigationDocumentOf } from '@correctiv/app-core/lib/screen-layout';
import { fetchedLayouts } from '@correctiv/app-core/stores/homeLayout';

import { BUILT_AT } from '@/lib/home/layout';
import { tabReachable } from '@/lib/features';
import { coreStore } from '@/lib/store/core';
import { KNOWN_DESTINATIONS, TAB_ROUTES } from '@/lib/tabTargets';

/**
 * Where a navigation somebody is looking at arrives, as opposed to one a phone draws:
 * the preview seam `workbench:home-layout` is for screens, for the tab bar. Frame only,
 * and read once, like the rest of this file (the frame reloads to apply it).
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

function fetchedDocument(): unknown {
  const text = fetchedLayouts(coreStore.getState().homeLayout, BUILT_AT);
  if (text === null) return undefined;
  try {
    return navigationDocumentOf(JSON.parse(text));
  } catch {
    return undefined;
  }
}

function compute(): TabBarChoice {
  const state = coreStore.getState();
  const reachable = (tab: string) => tabReachable(tab, (id) => isReachable(state, id));
  let choice: TabBarChoice | null = null;
  for (const candidate of [overrideDocument(), fetchedDocument()]) {
    if (candidate === undefined) continue;
    const tried = chooseTabBar({ candidate, known: KNOWN_DESTINATIONS, reachable });
    reportNavigationProblems(tried.problems);
    if (tried.source === 'candidate') {
      choice = tried;
      break;
    }
  }
  return choice ?? chooseTabBar({ known: KNOWN_DESTINATIONS, reachable });
}

let frozen: TabBarChoice | null = null;

/**
 * The tab bar this process draws, decided on the first call and never again.
 *
 * **Fixed at the first call because the navigator cannot change its triggers.** Native
 * tabs remount when the list changes and lose the state of every tab (measured
 * 2026-10-01), so a navigation fetched while the app runs is stored and applies on the
 * next start. The first call is the tab layout's first render, which is after the
 * store has hydrated (`app/_layout.tsx` returns nothing before), so "the next start"
 * is "the cached copy of the last fetch".
 *
 * Precedence: the workbench's override, the fetched copy, the bundled navigation
 * (ADR 0071 §6). A candidate that does not parse, names a destination this build does
 * not declare, or leaves fewer than two tabs after gating falls through to the next.
 */
export function tabBar(): TabBarChoice {
  frozen ??= compute();
  return frozen;
}

/** Test seam: forget the decision so the next call takes it again. */
export function resetTabBar(): void {
  frozen = null;
}

/** Every tab route with the bar's visible ones first, in bar order: the order triggers are declared. */
export function declaredTabRoutes(bar: TabBarChoice['bar']): string[] {
  return [...bar.tabs, ...TAB_ROUTES.filter((route) => !bar.tabs.includes(route))];
}
