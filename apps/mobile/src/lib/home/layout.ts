import Constants from 'expo-constants';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  parseHomeLayout,
  reportLayoutProblems,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';
import {
  CONFIGURABLE_SCREENS,
  SCREEN_DOCUMENTS,
  screenDocumentOf,
  type ConfigurableScreen,
} from '@correctiv/app-core/lib/screen-layout';
import { fetchedLayouts, refreshLayouts } from '@correctiv/app-core/stores/homeLayout';

import { coreStore } from '@/lib/store/core';

import { HOME_MODULES } from './modules';

/** The module names this host holds a renderer for — ADR 0036 §14, from the map itself. */
const RENDERABLE: ReadonlySet<string> = new Set(Object.keys(HOME_MODULES));

/**
 * Where a document somebody is looking at arrives, as opposed to one a phone draws.
 *
 * ADR 0036 §4 has the app fetching its layout and drawing from the copy it kept, and
 * that is `HOME_LAYOUT_URL` below. This key is the other way in, a preview seam: the
 * workbench's home-layout editor is its only writer, and it answers "what would this
 * document look like" where the fetch answers "what does a phone draw today". ADR 0057
 * §4 keeps both, and this one wins while it is set. Same origin on the web target means
 * the workbench's `localStorage` IS this app's, which is the seam every storage fixture
 * in `apps/workbench/src/preview/frame/seed.ts` already travels — and the only one that
 * works against the published export, where `expo export` has left no dev handle to
 * dispatch through.
 *
 * **Named for who writes it, not for what it holds.** `workbench:` is the prefix the
 * shell already uses for the two keys it owns (`workbench:seeded`,
 * `workbench:appearance`), and issue #112's rule applies here for the same reason it
 * applied to a seeded session: a home screen that quietly differs from the document in
 * the repository is worse than one that says who changed it. One greppable string in
 * two packages, held together by `apps/workbench/test/preview/home-document.test.ts`.
 *
 * It is deliberately outside the app's own MMKV prefixes. `persist()` writes back only
 * the keys a slice declares, so anything invented under `correctiv.state\store.` is
 * dropped on the app's first write; this is not the core's state and must not look like
 * it.
 */
export const HOME_LAYOUT_OVERRIDE_KEY = 'workbench:home-layout';

/**
 * The key a screen's override is read from: Home keeps the key it always had, every
 * other screen takes `workbench:layout:<screen>`. Frame only: the app reads these, and
 * which of them the workbench's editor writes is the workbench's business.
 */
export function layoutOverrideKey(screen: ConfigurableScreen): string {
  return screen === 'home' ? HOME_LAYOUT_OVERRIDE_KEY : `workbench:layout:${screen}`;
}

/**
 * A screen's override as it stands, or null.
 *
 * Text rather than a parsed value, because the text is what says whether anything
 * changed, and that is the question `screenLayout()` below asks on every render.
 *
 * Guarded rather than platform-split. `localStorage` is a web thing and this file is
 * shared by all three targets; a `.web.ts` sibling would be a second copy of the parse
 * and the cache for the sake of five lines. React Native has no `localStorage`, a
 * browser with site data switched off throws on the accessor, and both answer the same
 * way here: there is no override, so the bundled document stands.
 */
function overrideText(screen: ConfigurableScreen): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(layoutOverrideKey(screen));
  } catch {
    return null;
  }
}

/**
 * Where the app fetches its screen documents from (ADR 0057 §4).
 *
 * The files under the core's `data/layout/screens/`, joined into one document by
 * `.github/workflows/pages.yml` and published beside the site: the same files this build
 * bundles, as `main` has them now (ADR 0071 §1). `home.layout.json` stays published beside
 * it for the builds that fetch only Home's document.
 * A constant because ADR 0057 §4 says the app holds the address, and the core's thunk
 * takes it as a parameter so that no address is typed in the core.
 *
 * **Moving the site moves this.** An installed app keeps asking here for as long as it
 * is installed, so a custom domain for the Pages site, or a rename of the repository,
 * leaves every phone already out there on its last copy (and a new install on its
 * bundle) until it updates. Nothing breaks, which is ADR 0036 §10's floor, and
 * nothing says so either, which is why this sentence is here.
 *
 * GitHub Pages answers it with `access-control-allow-origin: *`, measured on
 * 2026-09-23, so the web target may fetch it from any origin, not only its own.
 */
export const LAYOUTS_URL = 'https://correctiv.github.io/correctiv-app/layout.json';

/**
 * When this bundle was built, in ms since the epoch, or NaN when nobody said.
 *
 * `app.config.js` stamps `extra.builtAt` at every build and `expo-constants` embeds it,
 * so every export and native build carries it. The core draws a fetched copy only when
 * it was published at or after this moment (`fetchedLayouts` argues why). NaN draws
 * none and fetches none: a build that cannot say when it was made cannot tell an older
 * published document from a newer one, and the bundle is the safe answer.
 *
 * Only a cold bundle carries this build's own moment: Metro's transform cache keeps the
 * first export's, which is why `build:web` exports with `--clear` (`app.config.js` has
 * the measurement).
 */
export const BUILT_AT = Date.parse(String(Constants.expoConfig?.extra?.builtAt ?? ''));

/** The fetched merged document the core holds that is not older than this build, or null. */
function fetchedText(): string | null {
  return fetchedLayouts(coreStore.getState().homeLayout, BUILT_AT);
}

/** Never throws: an unparsable text is a document that is not an object (§9). */
function parseText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const read = new Map<
  ConfigurableScreen,
  { override: string | null; fetched: string | null; layout: HomeLayout }
>();

function parseScreen(document: unknown, screen: ConfigurableScreen) {
  return parseHomeLayout(document, RENDERABLE, screen);
}

/** The screen's bundled document, which is always usable (ADR 0036 §10). */
function bundled(screen: ConfigurableScreen): HomeLayout {
  const { layout, problems } = parseScreen(SCREEN_DOCUMENTS[screen], screen);
  reportLayoutProblems(problems);
  return layout ?? { version: 0, words: null, sections: [], moments: [], editions: [] };
}

/**
 * The layout a screen draws: its override if there is one, else its part of the fetched
 * document, else the bundled document.
 *
 * **That order is the precedence, and each step down is a fallback, not a merge.** The
 * override is somebody in the workbench looking at a document on purpose, so it beats
 * what the phone fetched; the fetched copy is what the newsroom published, so it beats
 * what this build happened to compile in (ADR 0036 §4); and the bundle is §10's floor
 * under a first launch with no network. A copy published before this build was made is
 * not offered at all, which `fetchedLayouts` decides in the core.
 *
 * **The fallback is per screen** (ADR 0071 §6). A fetched document that lacks a screen,
 * or whose part for it does not parse or draws nothing, costs that screen its fetched
 * copy and no other screen anything. A screen in it that this app does not declare is
 * never read.
 *
 * **Once per document, not once per render**, which is what ADR 0036 §7's report is
 * worth. Strictly it is once per document per process: the cache below lives in memory,
 * so a relaunch reports the same document again, and so does a document that comes back
 * after another one was drawn in between (an override set and cleared). A report made
 * during render is made again on every feed that lands, every pull to refresh and every
 * theme change: a log nobody can read and, once there is a provider behind the port
 * (#95), a quota spent on one typo. The cache is keyed on the raw texts, so a render
 * re-parses only when a document actually changed, and the value it returns is
 * referentially stable in between, which is what `useSyncExternalStore` requires of a
 * snapshot.
 *
 * It is lazy rather than module scope for one reason: `configurePlatform()` runs in
 * `app/_layout.tsx`, and a report made while this module is being imported would go to
 * the core's default reporter, which reports nowhere. By the first render the host's is
 * registered.
 */
export function screenLayout(screen: ConfigurableScreen): HomeLayout {
  const override = overrideText(screen);
  const fetched = fetchedText();
  const held = read.get(screen);
  if (held && held.override === override && held.fetched === fetched) return held.layout;

  let layout: HomeLayout | null = null;
  if (override !== null) {
    // A document that does not parse costs the override and not the screen.
    const parsed = parseScreen(parseText(override), screen);
    reportLayoutProblems(parsed.problems);
    layout = parsed.layout;
  } else if (fetched !== null) {
    const document = screenDocumentOf(parseText(fetched), screen);
    if (document !== undefined) {
      const parsed = parseScreen(document, screen);
      reportLayoutProblems(parsed.problems);
      if (parsed.layout && parsed.layout.sections.length > 0) layout = parsed.layout;
    }
  }
  const result = layout ?? bundled(screen);
  read.set(screen, { override, fetched, layout: result });
  return result;
}

/** Home's layout: `screenLayout('home')`, kept under the name Home and its tests use. */
export function homeLayout(): HomeLayout {
  return screenLayout('home');
}

/**
 * When a document changes: any override, or the fetched copy.
 *
 * The override changes by a `storage` event on the web target. The browser fires that
 * event in every same-origin document **except** the one that made the change, so a
 * write from the workbench arrives here and a write from this app would not. That
 * asymmetry is exactly right: nothing in the app writes these keys. Everywhere else there
 * is no such event and no override.
 *
 * The fetched copy changes in the core's store, on every target. The store notifies on
 * every action, twice a second while audio plays, so the listener is called only when
 * the copy itself is a different string; `screenLayout()` would answer the same object
 * anyway, but not asking is cheaper than asking.
 */
function subscribeToLayout(listener: () => void): () => void {
  let fetched = fetchedText();
  const unsubscribeStore = coreStore.subscribe(() => {
    const next = fetchedText();
    if (next === fetched) return;
    fetched = next;
    listener();
  });

  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return unsubscribeStore;
  }
  const keys = new Set(CONFIGURABLE_SCREENS.map(layoutOverrideKey));
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || keys.has(event.key)) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    unsubscribeStore();
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * A screen's layout, re-read when somebody writes a new one or a fetch lands.
 *
 * `useSyncExternalStore` rather than state and an effect, because the document is not
 * this component's to own: it is read at render time from storage and from the store,
 * and the subscription exists only so that a screen already on the phone redraws
 * instead of waiting for a reload. The same function serves as the snapshot and as
 * the server snapshot: the static export prerenders each route, and there the bundled
 * document is the only one there can be.
 */
export function useScreenLayout(screen: ConfigurableScreen): HomeLayout {
  const snapshot = () => screenLayout(screen);
  return useSyncExternalStore(subscribeToLayout, snapshot, snapshot);
}

/** Home's layout, re-read as `useScreenLayout` does. */
export function useHomeLayout(): HomeLayout {
  return useScreenLayout('home');
}

/**
 * Fetch the screen documents at launch and on every return to the foreground (§5).
 *
 * Called once, from the root layout, after persistence has hydrated: before that the
 * store does not yet hold the copy the last session kept, and a fetch that landed first
 * would be overwritten by it. The floor between tries is the core's, so this may ask as
 * often as it likes. No background task and no permission, which is §5 in full.
 *
 * **Not in development**, and that is deliberate rather than a convenience. Locally the
 * bundled file is the document a developer is editing, and the published copy is
 * whatever `main` had at the last deploy: fetched here, it would quietly beat the edit on
 * the screen that is supposed to show it. `__DEV__` is false in every export, the Pages
 * build included, and that is where the fetch runs. The jest runner has `__DEV__` true
 * as well, so no suite reaches the network through this.
 */
export function useHomeLayoutRefresh(ready: boolean): void {
  useEffect(() => {
    if (__DEV__ || !ready || !Number.isFinite(BUILT_AT)) return;
    const refresh = () => {
      void coreStore.dispatch(
        refreshLayouts(LAYOUTS_URL, { builtAt: BUILT_AT, renderable: RENDERABLE }),
      );
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [ready]);
}
