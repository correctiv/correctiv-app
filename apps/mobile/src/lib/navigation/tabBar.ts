import { isReachable } from '@correctiv/app-core/features/features';
import {
  chooseTabBar,
  reportNavigationProblems,
  type TabBarChoice,
} from '@correctiv/app-core/lib/navigation';
import {
  navigationDocumentOf,
  parseScreenDocument,
  screenDocumentOf,
  SCREEN_DOCUMENTS,
  type ConfigurableScreen,
  type ScreenWords,
} from '@correctiv/app-core/lib/screen-layout';
import { fetchedLayouts } from '@correctiv/app-core/stores/homeLayout';

import { BUILT_AT, customScreenIds } from '@/lib/home/layout';
import { tabReachable } from '@/lib/features';
import { coreStore } from '@/lib/store/core';
import { KNOWN_DESTINATIONS, TAB_ROUTES, TAB_TARGETS } from '@/lib/tabTargets';

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

/**
 * The fetched document this process reads, parsed once, or `undefined` when there is
 * none this build may draw.
 *
 * **One copy, because the entries and the words come out of it together**
 * ([ADR 0075](../../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §5). The navigation below is read out of this body and so is every screen's name, so
 * there is no moment at which the bar shows a tab the last fetch added under the name
 * the one before it had. It is not a second fetch either: `fetchedLayouts` answers out
 * of the copy the core already holds.
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

function chooseBar(body: unknown): TabBarChoice {
  const state = coreStore.getState();
  // "Mehr" is where a custom screen is listed (ADR 0075 §7), so one in the document earns
  // the tab even when nothing overflowed. Read here and so frozen with the bar, which is
  // the same limit the entries have: a screen published while the app runs gets its row
  // in "Mehr" at once, and the tab itself on the next start (see `tabBar`).
  const withMore = customScreenIds().length > 0;
  const reachable = (tab: string) => tabReachable(tab, (id) => isReachable(state, id));
  const fetched = body === undefined ? undefined : navigationDocumentOf(body);
  let choice: TabBarChoice | null = null;
  for (const candidate of [overrideDocument(), fetched]) {
    if (candidate === undefined) continue;
    const tried = chooseTabBar({ candidate, known: KNOWN_DESTINATIONS, reachable, withMore });
    reportNavigationProblems(tried.problems);
    if (tried.source === 'candidate') {
      choice = tried;
      break;
    }
  }
  return choice ?? chooseTabBar({ known: KNOWN_DESTINATIONS, reachable, withMore });
}

/**
 * What one screen is called, out of the fetched copy if it carries that screen and out
 * of the bundled document otherwise.
 *
 * **The fallback is per screen**, which is the rule ADR 0071 §6 already has for a
 * screen's sections: a fetched document that lacks a screen, or whose words for it are
 * refused, costs that screen its fetched name and no other screen anything. A title is
 * the one word a document may not leave out (ADR 0075 §2), so a refused one falls all
 * the way back to the bundled document rather than leaving the bar with a blank tab.
 *
 * **Nothing is reported here.** The same documents are read again, problems and all, by
 * `screenLayout()` when the screen itself is drawn; reporting them a second time from
 * the bar would be the same typo twice in a log and, once there is a provider behind
 * the port, twice in a quota.
 */
function wordsOf(body: unknown, screen: ConfigurableScreen): ScreenWords | null {
  const fetched = body === undefined ? undefined : screenDocumentOf(body, screen);
  if (fetched !== undefined) {
    const { words } = parseScreenDocument(fetched);
    if (words !== null) return words;
  }
  return parseScreenDocument(SCREEN_DOCUMENTS[screen]).words;
}

/** The bar and the words of every route on it, taken together out of one document. */
interface TabBarDecision {
  readonly choice: TabBarChoice;
  readonly words: Readonly<Record<string, ScreenWords | null>>;
}

function decide(): TabBarDecision {
  const body = fetchedBody();
  const words: Record<string, ScreenWords | null> = {};
  for (const route of TAB_ROUTES) {
    const screen = TAB_TARGETS[route]?.screen;
    if (screen !== undefined) words[route] = wordsOf(body, screen);
  }
  return { choice: chooseBar(body), words };
}

let frozen: TabBarDecision | null = null;

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
 * **That includes whether "Mehr" is there for a custom screen.** A document that gains its
 * first custom screen while the app runs does not add the tab until the next start, and
 * one that loses its last does not remove it (the list is then empty, which is the floor).
 * The bar is the one thing a screen cannot change after launch.
 *
 * Precedence: the workbench's override, the fetched copy, the bundled navigation
 * (ADR 0071 §6). A candidate that does not parse, names a destination this build does
 * not declare, or leaves fewer than two tabs after gating falls through to the next.
 */
export function tabBar(): TabBarChoice {
  frozen ??= decide();
  return frozen.choice;
}

/**
 * What each route's screen calls itself, frozen with the bar.
 *
 * Raw words rather than drawn ones: a language is chosen when something is rendered,
 * and `lib/navigation/tabWords.ts` is where that happens for all three bars. Frozen
 * with the entries for the reason above — the triggers are fixed before the navigator
 * mounts, so a word that arrived later would belong to a bar that cannot change.
 *
 * A route with no screen of its own ("Mehr") is absent rather than null: the app names
 * it, and a `null` here would read as a screen whose document was refused.
 */
export function tabScreenWords(): Readonly<Record<string, ScreenWords | null>> {
  frozen ??= decide();
  return frozen.words;
}

/** Test seam: forget the decision so the next call takes it again. */
export function resetTabBar(): void {
  frozen = null;
}

/** Every tab route with the bar's visible ones first, in bar order: the order triggers are declared. */
export function declaredTabRoutes(bar: TabBarChoice['bar']): string[] {
  return [...bar.tabs, ...TAB_ROUTES.filter((route) => !bar.tabs.includes(route))];
}
