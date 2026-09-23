import Constants from 'expo-constants';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import {
  DEFAULT_HOME_LAYOUT,
  homeLayoutDocument,
  parseHomeLayout,
  reportLayoutProblems,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';
import { fetchedHomeLayout, refreshHomeLayout } from '@correctiv/app-core/stores/homeLayout';

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
 * The override as it stands, or null.
 *
 * Text rather than a parsed value, because the text is what says whether anything
 * changed, and that is the question `homeLayout()` below asks on every render.
 *
 * Guarded rather than platform-split. `localStorage` is a web thing and this file is
 * shared by all three targets; a `.web.ts` sibling would be a second copy of the parse
 * and the cache for the sake of five lines. React Native has no `localStorage`, a
 * browser with site data switched off throws on the accessor, and both answer the same
 * way here: there is no override, so the bundled document stands.
 */
function overrideText(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(HOME_LAYOUT_OVERRIDE_KEY);
  } catch {
    return null;
  }
}

/**
 * Where the app fetches its home document from (ADR 0057 §4).
 *
 * The core's own `data/home.layout.json`, which `.github/workflows/pages.yml` copies
 * beside the published site: the same file this build bundles, as `main` has it now.
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
export const HOME_LAYOUT_URL = 'https://correctiv.github.io/correctiv-app/home.layout.json';

/**
 * When this bundle was built, in ms since the epoch, or NaN when nobody said.
 *
 * `app.config.js` stamps `extra.builtAt` at every build and `expo-constants` embeds it,
 * so every export and native build carries it. The core draws a fetched copy only when
 * it was published at or after this moment (`fetchedHomeLayout` argues why). NaN draws
 * none and fetches none: a build that cannot say when it was made cannot tell an older
 * published document from a newer one, and the bundle is the safe answer.
 *
 * Only a cold bundle carries this build's own moment: Metro's transform cache keeps the
 * first export's, which is why `build:web` exports with `--clear` (`app.config.js` has
 * the measurement).
 */
export const BUILT_AT = Date.parse(String(Constants.expoConfig?.extra?.builtAt ?? ''));

/** The fetched copy the core holds that is not older than this build, or null. */
function fetchedText(): string | null {
  return fetchedHomeLayout(coreStore.getState().homeLayout, BUILT_AT);
}

/** Never throws: an unparsable override is a document that is not an object (§9). */
function documentFrom(text: string | null): unknown {
  if (text === null) return homeLayoutDocument;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

let read: { text: string | null; layout: HomeLayout } | null = null;

/**
 * The layout Home draws: the override if there is one, else the fetched copy, else the
 * bundled document.
 *
 * **That order is the precedence, and each step down is a fallback, not a merge.** The
 * override is somebody in the workbench looking at a document on purpose, so it beats
 * what the phone fetched; the fetched copy is what the newsroom published, so it beats
 * what this build happened to compile in (ADR 0036 §4); and the bundle is §10's floor
 * under a first launch with no network. A copy published before this build was made is
 * not offered at all, which `fetchedHomeLayout` decides in the core.
 *
 * **Once per document, not once per render**, which is what ADR 0036 §7's report is
 * worth. Strictly it is once per document per process: the cache below lives in memory,
 * so a relaunch reports the same document again, and so does a document that comes back
 * after another one was drawn in between (an override set and cleared). A report made during render is made again on every feed that lands, every pull
 * to refresh and every theme change — a log nobody can read and, once there is a
 * provider behind the port (#95), a quota spent on one typo. The cache is keyed on the
 * document's raw text, so a render re-parses only when the document actually changed,
 * and the value it returns is referentially stable in between, which is what
 * `useSyncExternalStore` requires of a snapshot.
 *
 * It is lazy rather than module scope for one reason: `configurePlatform()` runs in
 * `app/_layout.tsx`, and a report made while this module is being imported would go to
 * the core's default reporter, which reports nowhere. By the first render the host's is
 * registered.
 *
 * A document that does not parse at all costs the override and not the screen:
 * `DEFAULT_HOME_LAYOUT` is bundled and always usable, which is §10's promise and the
 * app's half of §9. A fetched copy cannot be that document, because the core refuses
 * one that does not parse before it keeps it.
 */
export function homeLayout(): HomeLayout {
  const text = overrideText() ?? fetchedText();
  if (read && read.text === text) return read.layout;
  const { layout, problems } = parseHomeLayout(documentFrom(text), RENDERABLE);
  reportLayoutProblems(problems);
  read = { text, layout: layout ?? DEFAULT_HOME_LAYOUT };
  return read.layout;
}

/**
 * When the document changes: the override, or the fetched copy.
 *
 * The override changes by a `storage` event on the web target. The browser fires that
 * event in every same-origin document **except** the one that made the change, so a
 * write from the workbench arrives here and a write from this app would not. That
 * asymmetry is exactly right: nothing in the app writes this key. Everywhere else there
 * is no such event and no override.
 *
 * The fetched copy changes in the core's store, on every target. The store notifies on
 * every action, twice a second while audio plays, so the listener is called only when
 * the copy itself is a different string; `homeLayout()` would answer the same object
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
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === HOME_LAYOUT_OVERRIDE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    unsubscribeStore();
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * The layout, re-read when somebody writes a new one.
 *
 * `useSyncExternalStore` rather than state and an effect, because the document is not
 * this component's to own: it is read at render time from storage and from the store,
 * and the subscription exists only so that a screen already on the phone redraws
 * instead of waiting for a reload. The same function serves as the snapshot and as
 * the server snapshot — the static export prerenders each route, and there the bundled
 * document is the only one there can be.
 */
export function useHomeLayout(): HomeLayout {
  return useSyncExternalStore(subscribeToLayout, homeLayout, homeLayout);
}

/**
 * Fetch the home document at launch and on every return to the foreground (§5).
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
        refreshHomeLayout(HOME_LAYOUT_URL, { builtAt: BUILT_AT, renderable: RENDERABLE }),
      );
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [ready]);
}
