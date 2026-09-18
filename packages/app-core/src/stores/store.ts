import {
  combineReducers,
  configureStore,
  createAction,
  type StoreEnhancer,
  type ThunkAction,
  type UnknownAction,
} from '@reduxjs/toolkit';

import { audioMiddleware, audioReducer } from './audio';
import { feedsReducer } from './feeds';
import { interestsReducer } from './interests';
import { mediaReducer } from './media';
import { participationReducer } from './participation';
import { podcastsReducer } from './podcasts';
import { radioReducer } from './radio';
import { savedArticlesReducer } from './savedArticles';
import { sessionReducer } from './session';
import { settingsInitialState, settingsReducer, type Locale } from './settings';
import { spotlightReducer } from './spotlight';
import { videoReducer } from './video';

/**
 * Puts every slice back to its initial value.
 *
 * The per-slice `resetForDemo` and `reset` actions stay: they are the product's
 * demo reset, and they are deliberate about what they do NOT touch. This one is
 * the blunt version, for a test that wants a clean tree without rebuilding the
 * store — and it works by handing `undefined` to the combined reducer, which is
 * how Redux asks every slice for its own initial state.
 */
export const resetStore = createAction('app/reset');

const combined = combineReducers({
  settings: settingsReducer,
  session: sessionReducer,
  savedArticles: savedArticlesReducer,
  interests: interestsReducer,
  participation: participationReducer,
  feeds: feedsReducer,
  media: mediaReducer,
  podcasts: podcastsReducer,
  spotlight: spotlightReducer,
  radio: radioReducer,
  audio: audioReducer,
  video: videoReducer,
});

/**
 * The reducer a store is built with, and the one thing a reset must not throw away.
 *
 * `combined(undefined, …)` asks every slice for its OWN initial state, which is the
 * whole point of a reset — and `preloadedState` is not consulted, so a host's locale
 * went back to the slice's default. Measured by a cold review on 2026-09-18:
 * `createAppStore({ locale: 'en' })` then one `resetStore()` gave `'de'`.
 *
 * That is not a test-only path. `resetStore` is on the preview frame's dev handle,
 * so it is a control somebody presses; reset the frame and the app would flip
 * language while the address still said the other one, with nothing reporting it.
 *
 * A locale is **construction** state and not user state, which is the whole of §4:
 * everything else in this tree is something a person did and a reset undoes, and the
 * language is something the host said and has not stopped saying. So the reset
 * restores every slice and then puts that one field back.
 */
function reducerFor(locale: Locale | undefined): typeof combined {
  return (state, action) => {
    const next = combined(resetStore.match(action) ? undefined : state, action);
    if (locale === undefined || !resetStore.match(action)) return next;
    return { ...next, settings: { ...next.settings, locale } };
  };
}

/**
 * One Redux store for the whole core.
 *
 * What used to be ten independent observable stores is twelve slices of one state
 * tree. The slice files kept their names and their public shape — the state
 * interfaces, the pure selectors and the German copy are unchanged — so the only
 * thing that moved is who owns the transition: a reducer now, not a closure over
 * `set`.
 *
 * ## The host constructs it, and there is no singleton here
 *
 * There used to be one, on the grounds that modules which are not components need
 * to reach the same instance the screens are subscribed to. That is no longer true
 * of anything: `media/exclusive-playback.ts` works through callbacks the host
 * registers, and the audio watchdog moved inside the listener middleware, which
 * gets its `dispatch` from the store it belongs to. Every remaining reference to
 * this file inside the core is an `import type`.
 *
 * So the host calls `createAppStore()` once and owns the result. That is what lets
 * it pass enhancers — Redux DevTools, in development — which a store built during
 * this module's evaluation could never have received: there is no moment between
 * "this file is imported" and "the store exists" for anyone to hand something in.
 * It also removes a seam rather than adding one. While the core exported an
 * instance, a test rendering screens against `createAppStore()` would have read
 * one store and written to another, silently.
 *
 * ## Why an audio middleware is installed here
 *
 * `configureStore` is the only place a middleware can go, so the audio store's
 * imperative half — the backend's status listener, the loading watchdog, and the
 * `pause()` that has to follow the error state — is registered from here. It is
 * the audio module's own listener middleware and this file needs nothing else
 * from audio to install it: no audio types, no ports, no knowledge of what it
 * listens for. `stores/audio.ts` explains what each of its entries is for.
 *
 * ## What the dev-mode checks are tuned for
 *
 * Both of RTK's development checks walk the whole state tree on every dispatch,
 * and the audio backend ticks twice a second — two dispatches each, the raw
 * status and the position it reduces to — against a tree holding six feeds,
 * seven podcast series and three video channels. Left at their defaults that is
 * several full traversals a second on the JS thread whenever anything is playing.
 *
 * `immutableCheck` is **off**, because Immer already covers what it would catch.
 * The worry was a reducer mutating one of the bundled offline snapshots that the
 * feed and podcast cascades hand straight into state — but RTK leaves Immer's
 * auto-freeze on, and that throws on exactly that mutation, at the mutation,
 * rather than reporting it one dispatch later.
 *
 * `serializableCheck` stays on, because nothing else catches a Date or a function
 * put into state, and this app deliberately stores timestamps as ISO strings. Its
 * cost is bounded by skipping the three slices that hold network payloads: those
 * are parsed JSON by construction, so they are the least likely to be
 * unserialisable and by far the most expensive to walk.
 *
 * Both are development-only and cost nothing in a release build.
 */
export interface AppStoreOptions {
  /**
   * Extra store enhancers, appended to RTK's defaults. The host's business: the
   * only one in use is the Expo Redux DevTools plugin, which is an Expo package
   * and has no place in a core that imports no platform SDK.
   */
  enhancers?: StoreEnhancer[];
  /**
   * RTK's built-in DevTools integration. Off when a host brings its own — the
   * Expo plugin requires it, because two of them fight over the same connection.
   */
  devTools?: boolean;
  /**
   * The language this host renders in
   * ([ADR 0049](../../../../adr/0049-the-catalogue-is-a-package.md) §4).
   *
   * **The first piece of state a host may hand in, and deliberately the only one.**
   * [ADR 0023](../../../../adr/0023-the-host-constructs-the-store.md) says the host
   * constructs the store and passes enhancers, and its argument is about
   * construction-time things that cannot be handed over afterwards. A locale is one:
   * dispatched after construction it is right one render late, and one render of the
   * wrong language is a screen somebody sees.
   *
   * Not a port. `CorePlatform` is what the core cannot do for itself — storage,
   * blobs, audio, reporting. A language is not a capability, it is state, and it has
   * a slice already.
   *
   * Omitted leaves the slice's own default, which is German. That is not a second
   * place the product decision is written: it is what a store built by a test or by
   * `createMemoryPlatform`'s neighbours gets, and every host that ships says so
   * itself.
   */
  locale?: Locale;
}

export function createAppStore({ enhancers = [], devTools, locale }: AppStoreOptions = {}) {
  return configureStore({
    reducer: reducerFor(locale),
    devTools,
    // Only when the host said so, so that a store built without options is byte for
    // byte the one every existing test already builds.
    ...(locale === undefined
      ? {}
      : { preloadedState: { settings: { ...settingsInitialState, locale } } }),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        immutableCheck: false,
        // Every slice that holds a parsed network payload, or the dev-only check
        // walks a megabyte of feed items on each dispatch.
        serializableCheck: { ignoredPaths: ['feeds', 'media', 'podcasts', 'spotlight'] },
      }).prepend(audioMiddleware),
    // AFTER `middleware`, and that is not cosmetic. With `enhancers` declared
    // first, TypeScript resolves this object's inference in an order that narrows
    // the middleware callback's expected return to RTK's default tuple, and the
    // prepended listener middleware above then fails to assign with "Two different
    // types with this name exist". Sorting these keys alphabetically breaks the
    // build; the error names neither this line nor the cause.
    enhancers: (getDefaultEnhancers) => getDefaultEnhancers().concat(...enhancers),
  });
}

export type AppStore = ReturnType<typeof createAppStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

/**
 * The return type of every async action in this core.
 *
 * These are plain thunks rather than `createAsyncThunk`, and that is deliberate.
 * `createAsyncThunk`'s value is the pending/fulfilled/rejected triple, and not one
 * of these cascades wants it: `feeds.fetch` shows stale items *while* loading,
 * `podcasts.fetchAll` decides between `ready`, `partial` and `offline` after the
 * fact, and `media.fetch` only enters `loading` when it has nothing to show. They
 * set their own status at their own moments, which is exactly what a plain thunk
 * is for. Multi-argument actions also stay multi-argument this way.
 */
export type AppThunk<R = void> = ThunkAction<R, RootState, undefined, UnknownAction>;
