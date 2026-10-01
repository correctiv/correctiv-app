/**
 * Everything a component of this app needs around it before it draws correctly.
 *
 * **One definition, two hosts**, which is what [ADR 0006](../../../../../adr/0006-one-core-two-hosts.md)
 * asks for everywhere else. `app/_layout.tsx` wraps the router in this; the
 * workbench wraps every specimen it draws in the same component
 * (`apps/workbench/src/components/DirectPreview.tsx`). Neither keeps a list of
 * providers of its own, and `apps/workbench/test/environment.test.ts` fails if the
 * second one starts one.
 *
 * It exists because the workbench's copy of that list drifted, and the drift was
 * invisible on every check. Measured on 2026-09-11 against the assembled site,
 * with the workbench holding a `Provider` and a `SafeAreaProvider` and nothing
 * else: no font file was loaded at all, so all 45 components drew in the
 * browser's default serif rather than Source Sans, and every bold and semibold
 * string drew at regular weight — this app names one loaded family per cut, so a
 * missing family takes the weight with it. ADR 0028 carries the table.
 *
 * **The language is here**, since ADR 0026 §6: `i18n/Localisation` is the
 * `react-intl` provider, and a specimen the workbench draws formats its messages
 * against the same catalogue the app does.
 *
 * **What is deliberately NOT here**, because it is routing or the app's own
 * lifecycle and a drawn card has neither: the splash screen, the persistence
 * hydration, the onboarding redirect, the error boundary, the status bar, the
 * door (`LoginGate`) and the `Stack`. Those stay in `app/_layout.tsx`.
 *
 * **The ports are not here either.** `configurePlatform()` is what this host
 * gives the core — storage, the bundle, audio — and it is a statement about the
 * running app, not about how a component looks. The workbench leaves the core on
 * its default `createMemoryPlatform()` and a thunk that reaches for storage gets
 * an empty answer instead of throwing, which is what a drawn specimen wants.
 */
import type { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';

// The app's stylesheet, and the reason this import is here rather than in
// `app/_layout.tsx` where it used to be: it is the first thing a second host
// needs and the easiest to forget. `global.css` names the tree its own class
// names are written in, so whoever compiles it gets the whole app's utilities
// and not only the ones the host happens to write itself.
import '@/global.css';
import { Localisation } from '@/i18n/Localisation';
import { coreStore } from '@/lib/store/core';
import { useAppearance, useGivenAppearance, type ThemeSetting } from '@/lib/theme';
import { TextSizeProvider } from '@/lib/theme/textScaling';

import { useAppFonts } from './fonts';

export { useAppFonts } from './fonts';

export interface AppEnvironmentProps {
  children: ReactNode;
  /**
   * The appearance to paint in. Left out, the app's own stored setting decides,
   * which is what the app wants; a host with a control of its own passes that
   * control's value, which is what the workbench wants.
   */
  appearance?: ThemeSetting;
  /**
   * Safe-area insets, stated, for a host that has no router to measure them.
   *
   * Five components reach `useSafeAreaInsets` — `LoginGate`, `RecoveryScreen`,
   * `Screen`, `ScreenHeader` and `SafeAreaView` — and it refuses rather than
   * defaulting, so something has to answer. In the app expo-router already does:
   * `ExpoRoot` mounts a `SafeAreaProvider` above the root route, which is why
   * `RecoveryScreen` can still draw after the boundary has unmounted everything
   * below it. On a page there is no router and no notch, so the workbench states
   * zero — and states it rather than letting a provider measure, because a
   * provider with nothing measured yet renders `null`, which inside a card is a
   * component that never appears.
   *
   * Left out, no provider is added. A second one nested inside expo-router's
   * would measure the same full-screen box and answer the same insets, so it
   * would be a wrapper that buys nothing and changes the app's tree.
   */
  insets?: Metrics;
}

export function AppEnvironment({ children, appearance, insets }: AppEnvironmentProps) {
  // Above the Provider on purpose: this reaches Expo's font loader, not Redux.
  useAppFonts();

  return (
    <Provider store={coreStore}>
      {/* A component, not a hook call here: reading the store's setting needs a
          `useSelector` and that cannot run in the component that renders the
          Provider — the same split `app/_layout.tsx` makes for `AppShell`. */}
      <Appearance setting={appearance} />
      {/* Inside the Provider, because the locale is a selector on the store, and
          above everything drawn, because a component that formats a message finds
          no provider otherwise — in the app OR in the workbench. */}
      <Localisation>
        {/* The app's one subscription to the text size (ADR 0033); every line of
            text reads it from here. */}
        <TextSizeProvider>
          <SafeArea insets={insets}>
            {/* `flex: 1` fills a device window and is inert in a page's block box,
                where the specimen's own height decides. */}
            <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>
          </SafeArea>
        </TextSizeProvider>
      </Localisation>
    </Provider>
  );
}

function SafeArea({ insets, children }: { insets: Metrics | undefined; children: ReactNode }) {
  if (insets === undefined) return children;
  return <SafeAreaProvider initialMetrics={insets}>{children}</SafeAreaProvider>;
}

/** Whichever of the two appearances applies, handed to Uniwind by `lib/theme`. */
function Appearance({ setting }: { setting: ThemeSetting | undefined }) {
  return setting === undefined ? <FromTheStore /> : <FromTheHost setting={setting} />;
}

function FromTheStore() {
  useAppearance();
  return null;
}

function FromTheHost({ setting }: { setting: ThemeSetting }) {
  useGivenAppearance(setting);
  return null;
}
