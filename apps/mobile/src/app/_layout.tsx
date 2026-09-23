import { router, Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';

import { configurePlatform } from '@correctiv/app-core';
import { extractArticleFromDom } from '@correctiv/app-core/articles/extract/dom';
import { configureArticleExtractor } from '@correctiv/app-core/articles/load';
import { registerExclusiveMedium } from '@correctiv/app-core/media/exclusive-playback';
import { persist, persisted } from '@correctiv/app-core/stores/persist';
import {
  PERSISTED_KEYS,
  settingsActions,
  type SettingsState,
} from '@correctiv/app-core/stores/settings';
import {
  savedArticlesActions,
  type SavedArticlesState,
} from '@correctiv/app-core/stores/savedArticles';
import {
  PERSISTED_KEYS as SESSION_KEYS,
  sessionActions,
  type SessionState,
} from '@correctiv/app-core/stores/session';
import { interestsActions, type InterestsState } from '@correctiv/app-core/stores/interests';
import {
  participationActions,
  type ParticipationState,
} from '@correctiv/app-core/stores/participation';
import { close as closeVideo } from '@correctiv/app-core/stores/video';
import {
  PERSISTED_KEYS as HOME_LAYOUT_KEYS,
  homeLayoutActions,
  type HomeLayoutState,
} from '@correctiv/app-core/stores/homeLayout';

import { LoginGate } from '@/components/gate/LoginGate';
import { RecoveryScreen } from '@/components/recovery/RecoveryScreen';
import { expoAudio } from '@/lib/audio/backend';
import { useHomeLayoutRefresh } from '@/lib/home/layout';
import { stop as stopAudio } from '@/lib/audio/player';
// Everything a component of this app needs around it before it draws: the
// stylesheet, the fonts, the store, the safe area, the gesture root and the
// appearance handed to Uniwind. The workbench wraps each specimen it draws in the
// same component, which is the whole reason it is one (ADR 0028).
import { AppEnvironment, useAppFonts } from '@/lib/env/AppEnvironment';
import { expoPlatform } from '@/lib/platform/expo';
import { coreStore, useAppStore, useIsAdmitted } from '@/lib/store/core';
import { useColors, useIsDark } from '@/lib/theme';

// Hand the core its platform capabilities before anything reads a store. Storage,
// bundled content and the error reporter come from the adapter; the audio backend
// is composed in here, so this one line is the whole answer to "what does this
// host give the core".
configurePlatform({ ...expoPlatform, audio: expoAudio });

/**
 * This app carries an HTML parser, so it uses the core's DOM extraction backend
 * rather than the string one that is the default. The difference is a tag
 * allowlist instead of a denylist — measurably cleaner markup in the reader. See
 * @correctiv/app-core/articles/types.ts for the trade-off and the test that keeps
 * the two backends in agreement.
 */
configureArticleExtractor(extractArticleFromDom);

/**
 * Exclusive playback: starting audio stops video and vice versa. Registered here
 * rather than inside either store, so neither has to import the other (the core's
 * media/exclusive-playback.ts explains why that import cycle had to go).
 */
registerExclusiveMedium('audio', stopAudio);
registerExclusiveMedium('video', () => coreStore.dispatch(closeVideo()));

// The splash screen stays up until Merriweather and Source Sans 3 are loaded, so
// the first render does not flash an unstyled font.
SplashScreen.preventAutoHideAsync();

/**
 * Hydrates the persisted slices, then keeps them written.
 *
 * Awaited before the first render, and that ordering is the whole of the
 * correctness argument: a screen that reads `onboardingDone` before hydration
 * gets `false` and sends a returning user through the onboarding again. The
 * `storeReady` gate below is what enforces it — there used to be a second
 * mechanism, an in-memory mirror in the platform adapter with its own hydration
 * step, and having two made it possible to satisfy one and not the other.
 */
function registerPersistence(): Promise<void> {
  return persist(coreStore, [
    persisted<SettingsState>('settings', PERSISTED_KEYS, settingsActions.hydrate),
    // The door reads this before anything else renders, for the same reason as
    // `onboardingDone`: hydrated late, a returning member would see the form.
    persisted<SessionState>('session', SESSION_KEYS, sessionActions.hydrate),
    persisted<SavedArticlesState>('savedArticles', ['items'], savedArticlesActions.hydrate),
    persisted<InterestsState>('interests', ['selected'], interestsActions.hydrate),
    persisted<ParticipationState>('participation', ['submissions'], participationActions.hydrate),
    // The home document the app last fetched (ADR 0036 §4), here rather than in the blob
    // cache because that one evicts, and an evicted copy would put a phone back on the
    // bundled layout for a reason nobody could see.
    persisted<HomeLayoutState>('homeLayout', HOME_LAYOUT_KEYS, homeLayoutActions.hydrate),
  ]);
}

/**
 * Anchor: a pushed route keeps the tabs underneath it, even when it is the entry
 * point. Without this, `correctiv://backstage` — or the shared address
 * `/backstage`, its own page in the static export — builds a stack of exactly one
 * screen, and back has nowhere to go. `lib/navigation/goBack.ts` is the floor
 * under this, for the cases where even an anchor cannot help.
 */
export const unstable_settings = { anchor: '(tabs)' };

/**
 * Rozenite's hook-shaped domains — Redux for an agent, MMKV, React Navigation —
 * or nothing at all.
 *
 * **Selected at MODULE scope, and that is the whole point of the line.** The
 * tempting shape — `__DEV__` around a `require` inside a function — does NOT keep
 * a module out of a release bundle: Metro collects a `require` from the syntax
 * tree however unreachable the call is, and only a module-scope guard folds one
 * away. A package written that way survives it, because each of these three
 * guards ITSELF at module scope and ships a no-op branch for production;
 * `lib/devtools/AgentTools` is ours and guards nothing, so written that way it
 * would ship, with three debugger packages behind it.
 * [ADR 0026](../../../adr/0026-react-native-review-and-hardening.md) §1 carries
 * the experiment, five variants built into a production export on 2026-09-10, of
 * which only the two at module scope dropped their module. `lib/store/core.ts`
 * selects its enhancer the same way, and says why a self-guarding package was not
 * enough there either.
 *
 * The test runner is excluded for the two reasons `devToolsEnhancers()` gives:
 * `__DEV__` is true under jest, there is no dev client for any of this to talk to,
 * and the suites mock `expo-router` without the container ref this reaches for.
 */
const AgentTools: () => null =
  // `__DEV__` is the operand that does the work. `NODE_ENV !== 'test'` is TRUE in a
  // release build, so it must never be left standing alone here — it excludes the
  // test runner and nothing else.
  __DEV__ && process.env.NODE_ENV !== 'test'
    ? // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('@/lib/devtools/AgentTools') as typeof import('@/lib/devtools/AgentTools')).default
    : () => null;

export default function RootLayout() {
  return (
    <AppEnvironment>
      <AgentTools />
      <AppShell />
    </AppEnvironment>
  );
}

/**
 * The app's only error boundary.
 *
 * expo-router wraps a route's default export in its `Try` whenever the file also
 * exports `ErrorBoundary` (see expo-router/build/useScreens.js, `fromImport`), and
 * this file is the root route, so this one boundary covers every render and every
 * effect in the app: the Provider, the shell, the door and all of the screens under
 * the Stack. There is no second one; `app/artikel.tsx` says why it does not have
 * its own.
 *
 * The screen it shows is `recovery/RecoveryScreen.tsx`, and what this function adds
 * to it is the two things only the catching side can do: releasing the splash
 * screen, and reporting. That file carries the German and the argument about what a
 * screen rendered after an unmount is allowed to depend on, because those hold
 * wherever it is rendered from, and it is rendered from a second host as well.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    // The splash screen is held from module scope above and released only once the
    // fonts and the store are ready, which is precisely what a fault before then
    // prevents. expo-router's `Try` hides it too, in `getDerivedStateFromError`,
    // but that is its internal behaviour and not this app's to lean on: without
    // this line the recovery screen can end up rendering underneath a splash
    // screen nobody can dismiss, which is the failure this boundary exists for.
    SplashScreen.hideAsync();

    /**
     * THE PLACE AN ERROR REPORT LEAVES THE APP, and it now leaves through the
     * port. `ErrorReporter` is the host's, implemented in `lib/platform/expo.ts`,
     * and today that implementation is the log line this call replaces — so the
     * log is the provider rather than a stand-in for one. Issue #95 chooses a real
     * sink, and it changes that file and not this one
     * ([ADR 0032](../../../adr/0032-a-port-for-the-error-report-before-a-provider-for-it.md)).
     *
     * Reached on `expoPlatform` directly rather than through the core's
     * `platform()`, because the boundary is the host's half of the arrangement and
     * has no business reading the registration the core holds for its own callers.
     *
     * `cause` is the thrown thing, unchanged. The rendered message goes to the
     * recovery screen below, where a person can quote it back to us; this half is
     * for a machine and gets the error itself. No `context`, because the boundary
     * genuinely has none — what it knows is that a render failed, and inventing
     * more is the thing the port's contract forbids.
     */
    expoPlatform.errors.report({ domain: 'render', code: 'render-failed', cause: error });
  }, [error]);

  // `error` is typed `Error`, but React hands over whatever was thrown, and a
  // thrown string must not take the recovery screen down with it.
  return <RecoveryScreen detail={error?.message ?? String(error)} onRetry={retry} />;
}

/**
 * Everything that reads state lives below the Provider, which `AppEnvironment`
 * renders — a `useSelector` above its own store finds no context and throws at
 * startup, so the shell has to be a child rather than the thing holding it.
 *
 * `useAppFonts()` here as well as inside the environment, and that is one load:
 * `expo-font` caches by family name, so the second call subscribes to the first
 * one's promise. What this call is for is the two things only the app does with
 * the answer — holding the splash screen up until the type is ready, and handing
 * a failed load to the boundary below.
 */
function AppShell() {
  const [fontsLoaded, fontError] = useAppFonts();
  const [storeReady, setStoreReady] = useState(false);
  const palette = useColors();
  const isDark = useIsDark();

  useEffect(() => {
    let active = true;
    const start = async () => {
      await registerPersistence();
      if (!active) return;
      setStoreReady(true);
    };
    // persist() swallows a failed read per slice; this only stops an unexpected
    // throw from leaving the app stuck on a blank splash screen for ever.
    start().catch((err: unknown) => {
      console.warn('[app] store hydration failed, starting anyway:', err);
      if (active) setStoreReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded && storeReady) SplashScreen.hideAsync();
  }, [fontsLoaded, storeReady]);

  // At launch once the kept copy is back in the store, and on every return to the
  // foreground; `lib/home/layout.ts` says why not in development.
  useHomeLayoutRefresh(storeReady);

  /**
   * The door. The whole route tree hangs on this one value: while the session is
   * not admitted the shell renders the gate INSTEAD of the navigator, so there is
   * no route to reach by deep link, by shared web address or by back. A redirect
   * could not do that. The onboarding jump below is a redirect, and it is latched,
   * fires only from `/` and blocks nothing, all of which is right for an
   * onboarding and wrong for a door.
   *
   * A selector, not `getState()`, because unlike the onboarding decision this one
   * is a value the shell renders: signing in has to open the app in the same tick,
   * and signing out has to close it. It reads the entitlement, never the
   * contribution, see `stores/session`.
   */
  const admitted = useIsAdmitted();

  /**
   * First start: into the onboarding once per session, as soon as the state is
   * hydrated — before that `onboardingDone` would always be false, which is the
   * very fault registerPersistence above avoids. And only once admitted: the
   * onboarding is the first thing behind the door, not something in front of it,
   * and a navigator that is not mounted has nowhere to jump to.
   *
   * ONLY when the app starts on the home route. Otherwise the jump overwrites every
   * shared link on the web target: someone opening `/backstage` should see
   * Backstage, not the onboarding first. Natively the case does not arise, because
   * the app always starts at `/`.
   *
   * `replace`, not `push`: the onboarding is not a place one returns to. The ref
   * keeps a later render from repeating the same jump — a ref rather than the
   * module flag this used to be, because module state survives Fast Refresh
   * unpredictably and made the redirect impossible to test: the first mount in a
   * suite consumed the flag for every mount after it, so a green test proved only
   * that it had run second.
   *
   * The state is read through the Provider's store rather than the imported
   * singleton — the same seam `useCoreActions` closes — and with `getState()`
   * rather than a selector, because this must not subscribe: it is a decision taken
   * once, not a value the shell renders.
   */
  const pathname = usePathname();
  const store = useAppStore();
  const gated = useRef(false);
  useEffect(() => {
    if (!storeReady || !admitted || gated.current) return;
    gated.current = true;
    if (pathname !== '/') return;
    if (!store.getState().settings.onboardingDone) router.replace('/onboarding');
  }, [admitted, pathname, store, storeReady]);

  /**
   * The font failure, handed to the boundary above.
   *
   * `useFonts` never throws. It catches the load and returns the error, leaving
   * `fontsLoaded` false for ever, so the early return below renders null and the
   * splash screen this module put up is never taken down: no crash, no message, and
   * a restart does the same thing again. That is the hang, and it is also why the
   * recovery screen has to survive without the fonts it is reporting.
   *
   * Deliberately not "carry on with the system font". The app's typography is the
   * brand, and `retry()` remounts this component, which loads the fonts again for
   * real: expo-font drops a failed load from `loadPromises` in a `finally`, so
   * nothing caches the failure and a fetch that failed once on the web target gets
   * a second chance.
   *
   * After every hook, so the render that throws has the same hook order as the ones
   * before it.
   */
  if (fontError) throw fontError;

  if (!fontsLoaded || !storeReady) return null;

  return (
    <>
      {/* Explicit rather than "auto": auto follows the device, and the app's
          appearance setting may deliberately disagree with it. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {admitted ? (
        <Stack
          screenOptions={{
            headerShown: false,
            // The stack's own surface, visible for the length of a push animation.
            // Left at its default white it flashed on every navigation in dark mode.
            contentStyle: { backgroundColor: palette['canvas'] },
          }}
        >
          <Stack.Screen name="(tabs)" />
          {/* The full player is a view onto the running singleton, not state of its
              own — a modal, because it replaces nothing. */}
          <Stack.Screen name="player" options={{ presentation: 'modal' }} />
          {/* Both are flows over the app, not places in it. */}
          <Stack.Screen name="onboarding" options={{ presentation: 'modal' }} />
        </Stack>
      ) : (
        <LoginGate />
      )}
    </>
  );
}
