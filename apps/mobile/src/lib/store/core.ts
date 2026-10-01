/**
 * React bindings for the core's Redux store.
 *
 * `@correctiv/app-core` owns the slices; the **host** constructs the store from
 * them and adds its own reactivity ([ADR 0023](../../../../../adr/0023-the-host-constructs-the-store.md)).
 * This is the React half — `react-redux`'s `useSelector` over the instance built
 * below, plus the pure selector functions the slices export, which are ordinary
 * functions of state and compose with it as-is.
 *
 * Always select the narrowest slice you need. `useSelector((s) => s.settings)`
 * re-renders on every change to any field in that slice.
 */
import { bindActionCreators, type StoreEnhancer } from '@reduxjs/toolkit';
import type { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useDispatch, useSelector, useStore, type TypedUseSelectorHook } from 'react-redux';

import {
  playEpisode,
  playRadio,
  seekTo,
  setSpeed,
  stop,
  togglePlay,
} from '@correctiv/app-core/stores/audio';
import {
  enrichImage,
  fetchFeedKey,
  fetchMany,
  type FeedStatus,
} from '@correctiv/app-core/stores/feeds';
import { searchWithFallback } from '@correctiv/app-core/stores/search';
import {
  boostedModules as selectBoostedModules,
  extraFeeds as selectExtraFeeds,
  interestsActions,
  selectedInterests as selectSelectedInterests,
} from '@correctiv/app-core/stores/interests';
import {
  fetchChannel,
  type VideoListState,
  type YoutubeKey,
} from '@correctiv/app-core/stores/media';
import {
  extraCount as selectExtraCount,
  hasSubmitted as selectHasSubmitted,
  participationActions,
} from '@correctiv/app-core/stores/participation';
import { fetchAll, findSeries, type PodcastsStatus } from '@correctiv/app-core/stores/podcasts';
import {
  fetchStatus as fetchRadioStatus,
  listenerCount as selectListenerCount,
  nowPlayingLine as selectNowPlayingLine,
  type RadioStatusState,
} from '@correctiv/app-core/stores/radio';
import {
  isSaved as selectIsSaved,
  savedArticlesActions,
} from '@correctiv/app-core/stores/savedArticles';
import {
  isAdmitted as selectIsAdmitted,
  refreshEntitlement,
  sessionActions,
  signIn,
} from '@correctiv/app-core/stores/session';
import {
  appTextScale,
  locale as selectLocale,
  settingsActions,
  textSizeFollowsSystem,
} from '@correctiv/app-core/stores/settings';
import { previewLocale, SHIPPED_LOCALE } from '@/lib/locale';
import {
  fetchIssues,
  recentIssues as selectRecentIssues,
  type SpotlightStatus,
} from '@correctiv/app-core/stores/spotlight';
import {
  createAppStore,
  resetStore,
  type AppDispatch,
  type AppThunk,
  type RootState,
} from '@correctiv/app-core/stores/store';
import { videoActions } from '@correctiv/app-core/stores/video';

/**
 * Redux DevTools, in development only.
 *
 * `@rozenite/redux-devtools-plugin` is a Rozenite plugin: the full DevTools from
 * the Chrome extension, a panel in React Native DevTools, with the action list,
 * the state diff and rewind — and, unlike the Expo dev plugin it replaced, the
 * same history readable by an agent over Rozenite's tool bridge (see
 * `lib/devtools/AgentTools.tsx`). On a state tree that takes an audio position
 * tick twice a second and runs four network cascades, a named action history is
 * the difference between reading logs and seeing what happened, and that argument
 * does not stop applying because the reader is an agent.
 *
 * **A swap, not an addition.** This seat held `redux-devtools-expo-dev-plugin`,
 * and two debuggers fight over one connection, so one of them had to go
 * ([ADR 0026](../../../../../adr/0026-react-native-review-and-hardening.md) §1).
 * RTK's own `devTools` integration is switched off in the same breath, for the
 * same reason. Only one debugger connection exists at a time on the platform at
 * all: React Native DevTools disconnects when an agent session begins, so plan
 * for alternating rather than for both at once.
 *
 * **Selected at MODULE scope, which is a change from how this used to be written.**
 * The predecessor's `require` sat inside the function below, on the belief that a
 * `__DEV__` branch around the call keeps the module out of a release bundle. It
 * does not: Metro collects a `require` from the syntax tree however unreachable
 * the call is, and only a module-scope guard folds one away, measured on
 * 2026-09-10 in
 * [ADR 0025](../../../../../adr/0025-the-published-app-is-a-production-bundle.md)
 * and again in ADR 0026 §1. Both packages guard themselves as well, so the
 * function-scope shape would still ship no debugger — but it ships the package's
 * NO-OP module, and a no-op still carries its export names. Measured here on
 * 2026-09-15: written that way, `rozeniteDevToolsEnhancer`,
 * `composeWithRozeniteDevTools` and `useReduxDevToolsAgentTools` all survived
 * minification into the web export, which is enough to trip any grep for
 * "rozenite" over the published bundle. The check `pages.yml` runs is only worth
 * having if a hit means something is wrong, so the require moved up here and the
 * bundle now carries no Rozenite at all.
 *
 * The enhancer still arrives through `devToolsEnhancers()`, which is the seam
 * [ADR 0023](../../../../../adr/0023-the-host-constructs-the-store.md) built and
 * where the store expects to find it. Only the `require` moved.
 */
const rozeniteDevToolsEnhancer: (() => StoreEnhancer) | null =
  // `__DEV__` is true under jest too, and the plugin ships ESM the test transform
  // does not cover — so a bare `__DEV__` check fails every suite that imports this
  // file with "Unexpected token 'export'". Excluding the test runner is also just
  // true: there is no dev client for it to talk to, and a debugger has no business
  // being loaded 15 times per `npm run check`. Both operands fold to constants at
  // build time, so the require goes with them.
  // `__DEV__` is the operand that does the work. `NODE_ENV !== 'test'` is TRUE in a
  // release build, so it must never be left standing alone here — it excludes the
  // test runner and nothing else.
  __DEV__ && process.env.NODE_ENV !== 'test'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (
        require('@rozenite/redux-devtools-plugin') as typeof import('@rozenite/redux-devtools-plugin')
      ).rozeniteDevToolsEnhancer
    : null;

function devToolsEnhancers(): StoreEnhancer[] {
  return rozeniteDevToolsEnhancer ? [rozeniteDevToolsEnhancer()] : [];
}

/**
 * The store, and the only one there is.
 *
 * Built here rather than in the core, which used to export a ready-made instance:
 * nothing in the core needs it any more (every reference there is an `import
 * type`), and a store created during a module's evaluation can never be handed an
 * enhancer. See the note in `@correctiv/app-core/stores/store`.
 */
export const coreStore = createAppStore({
  enhancers: devToolsEnhancers(),
  devTools: false,
  /*
   * The language this host ships, named by this host (ADR 0049 §4). A phone set to
   * English must not get an app half in English, so the app that ships to phones
   * says which language that is, and the core stops carrying a constant about
   * somebody else's product.
   *
   * `lib/locale.ts` and not a literal, because the static export's `<html lang>`
   * needs the same answer and cannot reach a store to ask for it.
   *
   * Read here and only here, which is what makes a language a restart rather than
   * a setting: the slice has no `setLocale` and this line runs once, when the store
   * is built. On a phone `previewLocale()` is `null` before it touches anything —
   * there is no `localStorage` to hold a key — so the expression below is
   * `SHIPPED_LOCALE` everywhere the app actually ships.
   */
  locale: previewLocale() ?? SHIPPED_LOCALE,
});

/** Typed `useSelector`, so a selector's state argument is never `any`. */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppStore = () => useStore<RootState>();

// --- whole-slice hooks (use a narrower selector below where you can) ----------

export const useSettings = () => useAppSelector((s) => s.settings);
export const useSession = () => useAppSelector((s) => s.session);
export const useMedia = () => useAppSelector((s) => s.media);
export const useVideo = () => useAppSelector((s) => s.video);

// --- narrow selectors --------------------------------------------------------

/**
 * The door's one question, read per render. It reads the entitlement and never the
 * contribution: a trial pays 0 € and has the app. The clock is passed in so that a
 * trial's end closes the door on the next dispatch.
 */
export const useIsAdmitted = () => useAppSelector((s) => selectIsAdmitted(s.session, Date.now()));
export const useActiveTab = () => useAppSelector((s) => s.settings.activeTab);
/**
 * The factor every text in the app is drawn at, articles included (ADR 0033): the
 * system's font scale, or the step the reader chose in its place. The system's value
 * is measured here and handed to the core's selector, because it changes while the
 * app runs and only the host can read it.
 */
export const useAppTextScale = () => {
  const { fontScale } = useWindowDimensions();
  return useAppSelector((s) => appTextScale(s.settings, fontScale));
};
/** The stored text size, a primitive; `lib/theme/textScaling`'s provider is its one text-drawing reader. */
export const useTextSize = () => useAppSelector((s) => s.settings.textSize);
/** Whether the text follows the system, which is the default (ADR 0033). */
export const useTextSizeFollowsSystem = () =>
  useAppSelector((s) => textSizeFollowsSystem(s.settings));
export const useTheme = () => useAppSelector((s) => s.settings.theme);
/** The language to render in, named by this host above; `i18n/Localisation` is its one reader. */
export const useLocale = () => useAppSelector((s) => selectLocale(s.settings));

export const useVideoIsActive = () => useAppSelector((s) => s.video.current !== null);

export const useSavedArticles = () => useAppSelector((s) => s.savedArticles.items);
export const useIsSaved = (url: string) =>
  useAppSelector((s) => selectIsSaved(s.savedArticles, url));

/**
 * These three selectors build a NEW array on every call (`filter`/`map`).
 * `useSelector` compares results by reference, so a selector with a fresh
 * identity per call re-renders the component on EVERY dispatch — including the
 * audio position tick, twice a second, for a component that shows interests.
 *
 * So subscribe to the raw `selected` array — a stable reference between changes,
 * because the slice updates immutably — and derive under `useMemo`.
 */
export const useSelectedInterests = () => {
  const selected = useAppSelector((s) => s.interests.selected);
  return useMemo(() => selectSelectedInterests({ selected }), [selected]);
};

export const useBoostedModules = () => {
  const selected = useAppSelector((s) => s.interests.selected);
  return useMemo(() => selectBoostedModules({ selected }), [selected]);
};

export const useExtraFeeds = () => {
  const selected = useAppSelector((s) => s.interests.selected);
  return useMemo(() => selectExtraFeeds({ selected }), [selected]);
};

// --- lazy loads --------------------------------------------------------------

/** What the lazily loaded slices' statuses have in common: all start at `'idle'`. */
type LazyStatus =
  | FeedStatus
  | PodcastsStatus
  | SpotlightStatus
  | RadioStatusState
  | VideoListState['status'];

/**
 * Fills a slice the first time something asks for it.
 *
 * `useVideoChannel`, `usePodcastLibrary` and `useFeed` were three copies of the
 * same four lines: watch a status, and while it is still `'idle'` dispatch the
 * thunk that fills the slice. The SUBSCRIPTION stays with the caller, because
 * only the caller knows how to select narrowly enough — see the note on the
 * interest hooks above, and the ones about `byKey` below.
 *
 * Two things here are load-bearing.
 *
 * **It dispatches through the Provider, not through the imported store.** Those
 * are the same object in the app, so nothing can diverge today — but
 * `createAppStore()` exists for tests, and against an isolated store a hook that
 * reads the Provider while loading into the singleton would sit on `'idle'`
 * forever: it never sees its own load land, so the effect never re-runs, never
 * retries and never errors.
 *
 * **The subject is a dependency too.** A status alone cannot decide when to load
 * again: two video channels can both be `'idle'`, so a rail switching from one to
 * the other would never load the second. Hence the subject is handed over
 * separately instead of being closed over — `() => fetchChannel(key)` would be a
 * fresh function on every render, and an effect can only depend on what it can
 * compare.
 */
export function useLazyLoad<S>(
  status: LazyStatus,
  load: (subject: S) => AppThunk<unknown>,
  subject: S,
): void {
  const dispatch = useAppDispatch();
  useEffect(() => {
    if (status === 'idle') void dispatch(load(subject));
  }, [dispatch, load, status, subject]);
}

/**
 * One media channel's videos, loaded on first use.
 *
 * The core slice owns what this app previously got wrong on its own: FunFacts
 * moved to CORRECTIV's PeerTube instance, and fetching it from the YouTube Atom
 * feed is the legacy path. `stores/media` routes per MEDIA_SOURCE and brings the
 * cache plus stale fallback with it, so this hook only subscribes and kicks off
 * the load.
 *
 * `byKey[key]` is a stable reference between updates (Immer patches the channel
 * in place and leaves its siblings alone), so it is safe to select directly —
 * see the note above about selectors that build fresh objects.
 */
export const useVideoChannel = (key: YoutubeKey) => {
  const slice = useAppSelector((s) => s.media.byKey[key]);
  useLazyLoad(slice.status, fetchChannel, key);
  return slice;
};

/**
 * What is on air on the Salon5 stream, read once when something first asks.
 *
 * Returns the line to print, not the raw status, because the decision "is there
 * anything worth saying" is the core's (`nowPlayingLine`) and the fallback copy is
 * the banner's. A `null` here means the banner keeps its own subtitle.
 */
export const useRadioStation = () => {
  const status = useAppSelector((s) => s.radio.status);
  const station = useAppSelector((s) => s.radio.station);
  useLazyLoad(status, fetchRadioStatus, undefined);

  // No `useMemo` around the selector, unlike `useSpotlight` below: this one
  // answers a string, and a string is compared by value.
  return {
    nowPlaying: selectNowPlayingLine({ status, station }),
    listeners: selectListenerCount({ status, station }),
    status,
  };
};

/**
 * The Spotlight newsletter archive, loaded on first use.
 *
 * `issues` is a stable reference between updates and `status` is a string, so two
 * narrow subscriptions cost less than one whole-slice read — the same reasoning as
 * `usePodcastLibrary` below, and the same reason neither hook selects its slice.
 *
 * `recent` is the core's exported selector rather than a `slice(0, n)` in a
 * screen, and it is memoised because it builds a fresh array: handed straight to
 * `useSelector` it would compare unequal on every unrelated dispatch and
 * re-render Home for a podcast that finished loading. Same shape as
 * `usePodcastSeries` below.
 */
export const useSpotlight = (recent = 3) => {
  const issues = useAppSelector((s) => s.spotlight.issues);
  const status = useAppSelector((s) => s.spotlight.status);
  useLazyLoad(status, fetchIssues, undefined);

  return {
    issues,
    status,
    recent: useMemo(() => selectRecentIssues({ issues, status }, recent), [issues, status, recent]),
  };
};

/**
 * The whole podcast library, loaded on first use — same shape as
 * `useVideoChannel`. Two narrow subscriptions rather than one whole-slice read:
 * `series` is a stable reference between updates and `status` is a string, so
 * neither can cost a render it does not owe.
 *
 * There is one library and it arrives in one piece, so the load has no subject —
 * `fetchAll` takes only its options, and defaults them.
 */
export const usePodcastLibrary = () => {
  const series = useAppSelector((s) => s.podcasts.series);
  const status = useAppSelector((s) => s.podcasts.status);
  useLazyLoad(status, fetchAll, undefined);
  return { series, status };
};

/** One series by id, with the same lazy load. */
export const usePodcastSeries = (id: string) => {
  const { series, status } = usePodcastLibrary();
  return {
    series: useMemo(() => findSeries({ series, status }, id), [series, status, id]),
    status,
  };
};

export const useHasSubmitted = (slug: string) =>
  useAppSelector((s) => selectHasSubmitted(s.participation, slug));
export const useExtraCount = (slug: string) =>
  useAppSelector((s) => selectExtraCount(s.participation, slug));

// --- actions -----------------------------------------------------------------

/**
 * Every action this app dispatches, bound to one dispatch.
 *
 * The thunk groups are spelled out rather than run through `bindActionCreators`,
 * because that helper types a bound thunk as returning the thunk itself instead
 * of what dispatching it returns — which would make every `await` on one a lie.
 */
function bindCoreActions(dispatch: AppDispatch) {
  const bind =
    <A extends unknown[], R>(creator: (...args: A) => AppThunk<R>) =>
    (...args: A): R =>
      dispatch(creator(...args));

  return {
    settings: bindActionCreators(settingsActions, dispatch),
    session: {
      ...bindActionCreators(
        { signOut: sessionActions.signOut, upgradeStarted: sessionActions.upgradeStarted },
        dispatch,
      ),
      signIn: bind(signIn),
      refreshEntitlement: bind(refreshEntitlement),
    },
    savedArticles: bindActionCreators(savedArticlesActions, dispatch),
    interests: bindActionCreators(interestsActions, dispatch),
    participation: bindActionCreators(participationActions, dispatch),

    audio: {
      playRadio: bind(playRadio),
      playEpisode: bind(playEpisode),
      togglePlay: bind(togglePlay),
      seekTo: bind(seekTo),
      setSpeed: bind(setSpeed),
      stop: bind(stop),
    },
    feeds: {
      fetch: bind(fetchFeedKey),
      fetchMany: bind(fetchMany),
      enrichImage: bind(enrichImage),
    },
    // Returns its hits rather than writing them to a slice: the query is the search
    // screen's own state and nothing else in the app asks about it.
    search: { run: bind(searchWithFallback) },
    podcasts: { fetchAll: bind(fetchAll) },
    spotlight: { fetchIssues: bind(fetchIssues) },
    radio: { fetchStatus: bind(fetchRadioStatus) },
    media: { fetch: bind(fetchChannel) },
    video: {
      ...bindActionCreators(
        { expand: videoActions.expand, collapse: videoActions.collapse, close: videoActions.close },
        dispatch,
      ),
      play: bind(videoActions.play),
    },
  };
}

export type CoreActions = ReturnType<typeof bindCoreActions>;

/**
 * The actions, bound to the core's singleton store at module load.
 *
 * **Inside React use `useCoreActions()`; outside, use this and know that you
 * are.** Reads go through the Provider, so a component that writes here reads
 * one store and writes to another the moment the two are not the same object.
 * They are the same object in the app — `app/_layout.tsx` hands the Provider this
 * very singleton, and `__tests__/root-layout.test.tsx` pins that — but
 * `createAppStore()` exists for tests, and against an isolated store the divergence
 * is silent: both calls succeed and the screen simply never updates.
 *
 * The callers that genuinely run outside React are real and few:
 * `lib/audio/player.ts` (whose actions the exclusive-playback callback invokes as
 * well as screens do) and the `registerExclusiveMedium` wiring in
 * `app/_layout.tsx`. There was a third, `lib/feeds/corpus.ts`, which reached the
 * singleton from a module-level promise; the search cascade it held now lives in
 * `@correctiv/app-core/stores/search` as a thunk and a selector, so it takes the
 * dispatch it is given.
 */
export const coreActions = bindCoreActions(coreStore.dispatch);

/**
 * The same actions, bound to the store the Provider actually holds.
 *
 * Memoised on the dispatch, which react-redux keeps stable for the life of the
 * store — so these keep one identity across renders and can be handed straight
 * to an `onPress` without defeating memoisation downstream.
 */
export const useCoreActions = (): CoreActions => {
  const dispatch = useAppDispatch();
  return useMemo(() => bindCoreActions(dispatch), [dispatch]);
};

// --- the dev shell's handle --------------------------------------------------

/** What `preview.html` finds on the frame's `globalThis` in a dev build. */
export interface DevHandle {
  store: typeof coreStore;
  actions: CoreActions;
  /** Every slice back to its initial value, without rebuilding the store. */
  resetStore: typeof resetStore;
  /**
   * The imperative router, so the shell can send the frame to a route without
   * going through the address.
   *
   * It has to, in development. `expo-router`'s `stripBaseUrl` removes the base
   * path only when `NODE_ENV !== 'development'`
   * (`expo-router/build/fork/getStateFromPath-forks.js`), so a dev bundle framed
   * at `/app/` matches `/app/gespeichert` against its own routes, finds nothing,
   * and renders `+not-found`. Measured 2026-09-10: every framed route did, `/app/`
   * included. The published export has no such trouble and no handle either, so
   * the shell falls back to the address there — see `driveRoute` in the
   * workbench's `preview/frame/handle.ts` for the pair.
   *
   * Navigating this way leaves the address behind: the router writes `/gespeichert`,
   * which is a path on the WORKBENCH's origin, and a reload of the frame would then
   * land on the workbench's own 404. The shell puts the address back from its poll,
   * because it is the one that knows what the frame's address is supposed to be.
   */
  router: typeof router;
}

/**
 * Hands the running app to the device preview.
 *
 * `apps/mobile/public/preview.html` frames the web build **same-origin**, so a
 * page outside the app can reach into it — but only if the app leaves something
 * to reach for. This is that something: the store the Provider actually holds
 * (the singleton above, which `app/_layout.tsx` passes on), plus the bound
 * actions.
 *
 * Why a handle and not storage. The shell could write `kv:store.settings`
 * itself, and for the onboarding gate it still has to, because that has to be
 * true before the first render. For everything after it, a dispatch is strictly
 * better: it speaks the core's vocabulary instead of duplicating the key format
 * `stores/persist.ts` owns, it is typed, and it lands now rather than at the
 * next reload.
 *
 * Guarded exactly like `devToolsEnhancers()` above, and for the same two
 * reasons: a release build has no business carrying a remote control, and jest
 * has no shell to talk to. Note that `expo export` also sets `__DEV__` false, so
 * the published web demo has no handle — deliberate, and the shell says so in
 * the toolbar instead of appearing to work.
 */
function exposeDevHandle(): void {
  if (!__DEV__ || process.env.NODE_ENV === 'test') return;
  (globalThis as typeof globalThis & { __correctiv?: DevHandle }).__correctiv = {
    store: coreStore,
    actions: coreActions,
    resetStore,
    // Required here rather than imported at the top, for the reason the enhancer
    // above is: `expo-router` ships ESM the test transform does not cover, and a
    // module-scope import took three suites down with "Cannot use import
    // statement outside a module" — from files that had not changed. This branch
    // never runs under jest, so the require never happens there.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    router: (require('expo-router') as typeof import('expo-router')).router,
  };
}

exposeDevHandle();
