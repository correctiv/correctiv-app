// The desktop root layout.
//
// A variant of `apps/mobile/src/app/_layout.tsx`, and the diff against it is the
// honest measure of what a third host costs: this file hands the core a different
// platform object and drops one CSS import. Everything else — the extractor choice,
// the exclusive-playback wiring, the persistence descriptors, the door, the onboarding
// gate, the modal presentations — is the phone's, unchanged, because none of it is
// platform-specific. That is ADR 0006's split paying out for the third time.
//
// THE DIFFERENCES, all of them here rather than spread out:
//
//   1. `gtkPlatform` + `gstAudio` instead of `expoPlatform` + `expoAudio`.
//   2. No `<AgentTools />`, which is the phone's web-only debug handle. This host's
//      equivalents are `debug/route.ts` and `debug/gallery-action.ts`, wired below.
//   3. Nothing else. Kept in the same order as the phone's file on purpose, so a
//      `diff` between the two is short enough to read.
//
// The global stylesheet used to be difference 1, and it is not a difference any more:
// the phone moved `import '@/global.css'` into `lib/env/AppEnvironment.tsx` — "the first
// thing a second host needs and the easiest to forget" — and this host now mounts that
// same component, so the import arrives with it. There is still no Metro here to read
// the file; `gjsify.config.mjs` resolves it to an empty module and the class vocabulary
// reaches GTK through `configureStyle` in `../entry.tsx` (ADR 0032 section 3).
//
// MOUNTING `AppEnvironment` IS WHY THE LIST SHRANK RATHER THAN GREW. This file used to
// write out its own `Provider`, appearance hook and `GestureHandlerRootView`, which was
// one provider list per host — and the phone learned the cost of that on its second
// host: the workbench's copy drifted, no check saw it, and 45 components drew in the
// browser's default serif (ADR 0028). Since then the list is one component, and the
// third host is the first one that got to simply use it. The parts that are routing or
// this app's own lifecycle stay here, which is the boundary that component's own
// docblock draws: the splash screen, the hydration, the onboarding redirect, the error
// boundary, the status bar, the door and the `Stack`.
//
// It also brings the react-intl provider, and that is the part this host could not do
// without. Every screen it re-exports formats its German through `useIntl` since
// ADR 0026 §6, so without a provider above them each one throws on its first string.
//
// The door used to be a third difference, and it was the one that was NOT
// platform-specific: this host mounted the navigator unconditionally and so showed
// the app to a session the phone stops. It is gone as of the render branch below.
// `test/root-layout.test.ts` is what keeps it from coming back, because a missing
// branch here looks exactly like a working app on the machine of whoever is already
// admitted.

import { router, Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

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

import { LoginGate } from '@/components/gate/LoginGate';
import { RecoveryScreen } from '@/components/recovery/RecoveryScreen';
import { AppEnvironment, useAppFonts } from '@/lib/env/AppEnvironment';
import { stop as stopAudio } from '@/lib/audio/player';
import { coreStore, useAppStore, useIsAdmitted } from '@/lib/store/core';
import { useIsDark } from '@/lib/theme';

import { installGalleryAction } from '../debug/gallery-action.js';
import { applyDebugRoute, debugRouteRequested, noteCurrentPath } from '../debug/route.js';
import { gstAudio } from '../audio/backend.js';
import { gtkPlatform } from '../platform/index.js';

// Hand the core its platform capabilities before anything reads a store. Storage and
// bundled content come from the adapter; the audio backend is composed in here, so
// this one line is the whole answer to "what does this host give the core".
configurePlatform({ ...gtkPlatform, audio: gstAudio });

/**
 * This host carries an HTML parser, so it uses the core's DOM extraction backend
 * rather than the string one that is the default — the same choice the phone makes,
 * and for the same reason: a tag allowlist instead of a denylist, which is measurably
 * cleaner markup in the reader.
 */
configureArticleExtractor(extractArticleFromDom);

/** Starting audio stops video and vice versa. Registered here so neither store imports the other. */
registerExclusiveMedium('audio', stopAudio);
registerExclusiveMedium('video', () => coreStore.dispatch(closeVideo()));

// A no-op on this host, kept because the app's own readiness gate is written around
// it. `src/shims/expo-splash-screen.ts` says what the desktop equivalent is and why
// it needs no call: the window is presented only after React has rendered into it.
SplashScreen.preventAutoHideAsync();

/** Hydrates the persisted slices, then keeps them written. The phone's list, verbatim. */
function registerPersistence(): Promise<void> {
  return persist(coreStore, [
    persisted<SettingsState>('settings', PERSISTED_KEYS, settingsActions.hydrate),
    // What the door reads. Hydrated before the first render like everything else, and
    // for the reason the phone's copy of this line gives: late, a returning member is
    // shown the sign-in form for a frame.
    persisted<SessionState>('session', SESSION_KEYS, sessionActions.hydrate),
    persisted<SavedArticlesState>('savedArticles', ['items'], savedArticlesActions.hydrate),
    persisted<InterestsState>('interests', ['selected'], interestsActions.hydrate),
    persisted<ParticipationState>('participation', ['submissions'], participationActions.hydrate),
  ]);
}

/** A pushed route keeps the tabs underneath it, even when it is the entry point. */
export const unstable_settings = { anchor: '(tabs)' };

/**
 * This host's error boundary, because its router has none to offer.
 *
 * THE DIFFERENCE FROM THE PHONE, and it is the reason this class exists rather
 * than a re-export. On the phone the catching is expo-router's: a route that also
 * exports `ErrorBoundary` gets wrapped in `Try`
 * (`expo-router/build/useScreens.js`, `fromImport`), and `apps/mobile/src/app/_layout.tsx`
 * is that route. `src/shims/expo-router.ts` answers five names over
 * `@gjsify/react-native/router` and `Try` is not one of them —
 * `@gjsify/react-native`'s support table lists expo-router's `ErrorBoundary` as
 * planned, tier P3. So the phone's export is INERT here: present, correct, and
 * reached by nothing.
 *
 * That is the failure mode this host keeps producing. Nothing would have said the
 * recovery screen was gone; the app would simply have died at the first refusal,
 * the way it did when three `<Typo onPress>` rows in `(tabs)/profil.tsx` ended the
 * whole tree and took `CORRECTIV_DESKTOP_ROUTE` with them — Home captured at
 * 12 848 bytes where it had captured 92 125.
 *
 * A PLAIN REACT BOUNDARY IS ENOUGH, and that was measured rather than assumed. The
 * support table's P3 entry is about expo-router's per-route screen and says a
 * boundary "has to be reconciled" with the host rethrowing an uncaught error from
 * `render()`. It does not need reconciling: React 19 only reaches that handler for
 * an error NO boundary caught. With this class in the tree, `@gjsify/gtk-host/react`
 * logs `an error boundary caught an error` through `onCaughtError` instead, the
 * process survives, and `--screenshot` still writes a file. Verified on GTK 4.22.4
 * against the `<Typo onPress>` refusal above.
 *
 * The screen is the phone's, from `@/components/recovery/RecoveryScreen`, which is
 * where it lives precisely so a second host can draw it. What this class adds is
 * what the phone's `ErrorBoundary` adds on that side: the report. The splash
 * release is not repeated, because `src/shims/expo-splash-screen.ts` is a no-op
 * here and says why.
 *
 * The screen's own docblock lists what it may depend on after the tree below has
 * been unmounted, and both of its conditions are met on this host WITHOUT the
 * mechanisms it names for the phone. `useColors()` reads `useUniwind()`, which
 * `src/shims/uniwind.ts` answers from `Adw.StyleManager:dark` — a live read, no
 * provider and no store. And `Screen`'s `SafeAreaView` needs no
 * `SafeAreaProvider`, because `src/shims/react-native-safe-area-context.tsx`
 * answers zero insets outright: a GTK window is a rectangle the compositor hands
 * over whole.
 *
 * WHAT WRAPPING THE `Provider` DOES AND DOES NOT BUY. It was claimed here that this
 * catches a fault in the store's own construction. It does not: `coreStore` is a
 * module-scope `export const` in `lib/store/core.ts`, so a construction fault throws
 * during module EVALUATION, before any component renders, and no boundary in any tree
 * can catch it. What the position actually buys is a throw from `Provider`'s own
 * render and from everything in `AppShell` — the hydration effect, `useAppearance`,
 * the door. That is worth having, and it is less than the sentence it replaces.
 *
 * WHAT SITS ABOVE IT IS NOT COVERED EITHER, and the list is short enough to write
 * down: `entry.tsx`'s `registerFontsOnce`, `configureStyleOnce`,
 * `installMediaControlsOnce` and `armScreenshot`; `RouterRoot` itself; and this file's
 * own module scope, where `configurePlatform` and the extractor choice run. A fault in
 * any of those is the host's `render()` rethrow, which is a different failure path.
 */
class RecoveryBoundaryClass extends Component<
  { children: ReactNode },
  { caught: boolean; error: unknown }
> {
  // A FLAG BESIDE THE VALUE, rather than `error: null` as the sentinel. React hands
  // over whatever was thrown, and `throw null` is legal JavaScript — with the value
  // alone as the test, that one case would render the children again, throw again,
  // and loop. The flag costs a boolean and the sentinel costs a hang.
  state: { caught: boolean; error: unknown } = { caught: false, error: null };

  static getDerivedStateFromError(error: unknown): { caught: boolean; error: unknown } {
    return { caught: true, error };
  }

  componentDidCatch(error: unknown): void {
    // THE PLACE AN ERROR REPORT LEAVES THIS HOST, and the phone's own comment about
    // issue #95 applies: no crash reporter is chosen, so for now it goes to the log.
    // `route-sweep` and `component-sweep` read that log, so a caught refusal is still
    // a FAILING sweep rather than a screen that quietly says "stehen geblieben".
    console.error('[desktop] render failed, showing the recovery screen:', error);
  }

  /** Clears the error so the tree below is built again, which is `retry`. */
  private readonly retry = (): void => {
    this.setState({ caught: false, error: null });
  };

  render(): ReactNode {
    const { caught, error } = this.state;
    if (!caught) return this.props.children;
    // `error` is whatever was thrown, and a thrown string must not take the
    // recovery screen down with it — the same normalisation the phone does.
    const detail = error instanceof Error ? error.message : String(error);
    /*
      WRAPPED IN A BARE `<View>`, and this is load-bearing rather than tidy.

      `RecoveryScreen` renders `Screen`, whose outermost element is a
      `SafeAreaView` carrying `flex-1`. On this host `flex-1` becomes
      `intent.expand`, which `@gjsify/react-native` can only resolve against a
      PARENT context — and a fallback rendered after a boundary caught sits at the
      root of a freshly rendered subtree with no such context. So the recovery
      screen itself threw, uncaught this time, and the tree died anyway.

      Worse than dying: the second refusal REPLACED the first in the log. Every
      real fault read as `<View> expand — carries layout that cannot be resolved at
      this position`, whatever it actually was. Both of this host's known component
      faults were hidden behind it, and both are named in README once this wrapper
      let them through.

      The `<View>` carries no utility of its own, which is the whole point: it is a
      parent for the screen below it to resolve against. Measured on GTK 4.22.4 —
      with it, the recovery screen renders and the original message survives.
    */
    return (
      <View>
        <RecoveryScreen detail={detail} onRetry={this.retry} />
      </View>
    );
  }
}

/**
 * The same class, retyped so it may stand in a JSX tag position on this host.
 *
 * NOT A COSMETIC CAST, and worth the paragraph. `tsconfig.json` sets
 * `jsxImportSource` to `@gjsify/gtk-host/react` so that an accidental `<div>` is a
 * type error rather than a blank window — its own comment says why. That namespace
 * declares `ElementType` as `keyof GtkReactIntrinsicElements | ((props: never) =>
 * ReactNode)`: a GTK tag, or a FUNCTION component. A class component is neither, so
 * `<RecoveryBoundaryClass>` is `TS2786: cannot be used as a JSX component`.
 *
 * That excludes every error boundary, because React has no functional one:
 * `getDerivedStateFromError` and `componentDidCatch` are class-only, by design and
 * still in React 19. So the types forbid what the RUNTIME supports — measured on
 * this host, a plain boundary catches the layer's `PrimitiveError` and
 * `@gjsify/gtk-host/react` reports it through `onCaughtError`, which is an option
 * that only exists because boundaries are expected to work.
 *
 * The fix belongs upstream, in one line: `GtkElementType` should admit a component
 * class the way React's own `ElementType` does. Until then this is the narrowest
 * possible workaround — one cast, at one site, on a class this file owns — rather
 * than giving up the boundary or giving up `jsxImportSource`.
 */
const RecoveryBoundary = RecoveryBoundaryClass as unknown as (props: {
  children: ReactNode;
}) => ReactNode;

export default function RootLayout() {
  return (
    <RecoveryBoundary>
      <AppEnvironment>
        <AppShell />
      </AppEnvironment>
    </RecoveryBoundary>
  );
}

/**
 * Everything that reads state lives below the Provider, which `AppEnvironment`
 * renders — `useAppearance()` selects the appearance setting, so it cannot run in
 * the component that renders the Provider.
 */
function AppShell() {
  const [fontsLoaded] = useAppFonts();
  const [storeReady, setStoreReady] = useState(false);
  const isDark = useIsDark();

  useEffect(() => {
    let active = true;
    const start = async () => {
      await registerPersistence();
      if (!active) return;
      setStoreReady(true);
    };
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

  /**
   * The door, and the phone's own words for it: the whole route tree hangs on this
   * one value, so while the session is not admitted there is no route to reach by
   * deep link or by back. A redirect could not do that, and on this host it could do
   * even less — `CORRECTIV_DESKTOP_ROUTE` below replaces the initial route, so a
   * redirect-shaped door would be one the development aid walks straight through.
   *
   * A selector rather than `getState()`, because unlike the onboarding decision this
   * one is a value the shell renders: signing in has to open the app in the same
   * tick. It reads the entitlement and never the contribution (ADR 0016).
   */
  const admitted = useIsAdmitted();

  const pathname = usePathname();
  const store = useAppStore();
  // So the capture can name the screen it photographed. Without it a screenshot is a
  // picture with no claim attached, and a picture of the WRONG screen is
  // indistinguishable from a picture of the right one.
  useEffect(() => noteCurrentPath(pathname), [pathname]);
  // A way into the component gallery without a restart. Installed once the door is
  // open, for the same reason the debug route waits: there is no navigator to push
  // into until then. See `debug/gallery-action.ts`.
  useEffect(() => {
    if (!admitted) return;
    installGalleryAction((href) => router.push(href));
  }, [admitted]);

  const gated = useRef(false);
  useEffect(() => {
    if (!storeReady || !admitted || gated.current) return;
    gated.current = true;
    // BOTH DECISIONS WAIT FOR ADMISSION, and the debug aid for the same reason as the
    // onboarding jump: each of them replaces a route, and there is no navigator to
    // replace one in until the door opens. On a profile that is not admitted the aid
    // therefore never fires, `onDebugRouteApplied` reaches its deadline, and the log
    // says `was never applied within` — which `route-sweep` reads as a failure. That
    // is the intended answer: a sweep run behind the door has nothing to say about
    // the route it was asked for. README, "How to run it", says how to get past it.
    //
    // See src/debug/route.ts; a no-op unless CORRECTIV_DESKTOP_ROUTE is set.
    applyDebugRoute((href) => router.replace(href));
    // The aid has chosen a screen, so the gate below must not overrule it. Ordering
    // alone did NOT achieve that, which is what the comment here used to claim:
    // `pathname` is the render-time value and is still '/' at this point, so the
    // guard never returned and the gate replaced the requested route two lines later.
    // Every capture on a profile that has not finished onboarding was therefore the
    // onboarding screen, whatever route was asked for — measured across four
    // different routes, including one that does not exist, all byte-identical.
    if (debugRouteRequested()) return;
    if (pathname !== '/') return;
    if (!store.getState().settings.onboardingDone) router.replace('/onboarding');
  }, [admitted, pathname, store, storeReady]);

  if (!fontsLoaded || !storeReady) return null;

  // A fragment, where this file used to open a `GestureHandlerRootView`: that wrapper
  // is `AppEnvironment`'s now, on both hosts, and two of them nested would be one
  // `Gtk.Box` with nothing in it.
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {admitted ? (
        /*
          `screenOptions` is deliberately absent, where the phone passes
          `headerShown: false` and a `contentStyle` background.

          Both are answers to problems this host does not have. There is no header to
          hide: `Stack` renders an `Adw.NavigationView`, whose chrome is the
          application window's own header bar, and the brief for this port is to leave
          Adwaita's chrome alone. And `contentStyle` existed to stop a white flash
          during a push animation — an `Adw.NavigationView` transition paints the
          pages themselves, so there is no stack surface behind them to see.
        */
        <Stack>
          <Stack.Screen name="(tabs)" />
          {/*
            `presentation: 'modal'` is dropped on all three, and this is the one
            route-level divergence worth knowing about.

            On the phone these are flows over the app rather than places in it. GTK's
            counterpart is `Adw.Dialog`, which is PRESENTED against a parent and never
            parented by it — `box.append(dialog)` calls `g_error()`, which is SIGABRT
            and a core dump rather than a catchable exception (measured on libadwaita
            1.9.3, and the reason `Modal` is still a refusing export in
            @gjsify/react-native). Presenting one needs a portal seam in the host that
            does not exist yet.

            So player and onboarding are ordinary pushed pages here. They work — the
            player is reachable, the onboarding runs — and they arrive as a page rather
            than as a sheet. Named, not silent.

            `beitreten` was the third of these until ADR 0020 took the contribution out
            of the app entirely; the route is gone from the phone and therefore from
            here, which is what re-exporting the screens is for.
          */}
          <Stack.Screen name="player" />
          <Stack.Screen name="onboarding" />
        </Stack>
      ) : (
        /*
          The phone's own gate component, imported rather than varied. It reaches
          this host through the `@/*` alias, the same way every other re-exported
          screen does, and it needs nothing this host does not already answer:
          `ActivityIndicator`, `Pressable`, `ScrollView`, `TextInput` and `View` are
          all importable per @gjsify/react-native's support table, which
          `test/support-gate.test.ts` checks against the phone's whole source tree.
        */
        <LoginGate />
      )}
    </>
  );
}
