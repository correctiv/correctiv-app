import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * The root error boundary, and the hang it replaces.
 *
 * Until it existed, a throw before `fontsLoaded && storeReady` left the app on the
 * splash screen for ever: `preventAutoHideAsync()` runs at module scope and
 * `hideAsync()` only behind both flags, so a fault in between meant no crash, no
 * message, and a restart doing the same thing again.
 *
 * Two properties are worth more than the copy assertions here.
 *
 *  1. **The splash screen comes down.** Asserted on the app's own
 *     `expo-splash-screen` double, and asserted in the case where the shell CANNOT
 *     have hidden it: the fonts are unloaded, so the shell's own effect is behind a
 *     false condition and the only caller left is the boundary.
 *  2. **A font failure reaches the boundary at all.** `useFonts` does not throw. It
 *     returns the error and leaves `fontsLoaded` false for ever, which is a silent
 *     hang rather than a caught error, so the layout has to rethrow it. Separated
 *     below from "the fonts are merely still loading", which must keep rendering
 *     null behind the splash.
 *
 * The tree is mounted through the real `Try` — the component expo-router itself
 * wraps a route's default export in when the file also exports `ErrorBoundary` — so
 * `retry()` here means what it means in the app. And it is mounted WITHOUT a Redux
 * Provider around it, deliberately: `Try` catches by unmounting `RootLayout`, which
 * is where the app's Provider lives, so a boundary that read the store would throw
 * inside the boundary. Mounting it the way the router does is what would catch that.
 */

/**
 * The CSS entry exists for Uniwind's Metro transform. Jest has no transform for
 * `.css`, so without this it parses the stylesheet as JavaScript.
 */
jest.mock('@/global.css', () => ({}));

jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Stack = ({ children }: { children?: React.ReactNode }) =>
    react.createElement(View, null, children);
  Stack.Screen = () => null;
  return {
    router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
    usePathname: jest.fn(() => '/'),
    Stack,
  };
});

/**
 * The fonts, per test. `[true, null]` is the normal start; `[false, error]` is the
 * failure `useFonts` reports instead of throwing; `[false, null]` is still loading.
 *
 * `mock`-prefixed because jest forbids a mock factory from closing over anything
 * else, and read only at render time, so the temporal dead zone never applies.
 */
let mockFontState: [boolean, Error | null] = [true, null];
jest.mock('expo-font', () => ({ useFonts: () => mockFontState }));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));

/**
 * `GestureHandlerRootView` reaches for a native module jest has not got, and throws
 * `_RNGestureHandlerModule.default.install is not a function` on mount. Worth
 * recording rather than just silencing, because writing this suite is how it came to
 * light: the boundary caught THAT error rather than the one the test threw, which is
 * the boundary working and the test measuring the wrong thing. Suites that never get
 * past the shell's early return used to miss it; `root-layout.test.tsx` no longer
 * does, because the gesture root moved up into `lib/env/AppEnvironment`.
 */
jest.mock('react-native-gesture-handler', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const GestureHandlerRootView = ({ children }: { children?: React.ReactNode }) =>
    react.createElement(View, null, children);
  return { GestureHandlerRootView };
});

jest.mock('uniwind', () => ({
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'light', hasAdaptiveThemes: true }),
  // The design system's SafeAreaView is wrapped at module load; the wrapper is an
  // identity here, so what renders is the upstream component and the metrics below
  // are what it reads.
  withUniwind: (component: unknown) => component,
}));

/**
 * The real adapter reaches for MMKV's native module. The core's in-memory
 * platform answers the same ports, so hydration runs for real against it.
 *
 * Its `ErrorReporter` is replaced, because that port is what the boundary below
 * reports through and the memory platform's default is deliberately a no-op.
 * Collected rather than spied on: what is asserted is the report itself, which is
 * the part a provider will receive, and not the shape of a log line that only the
 * host's current implementation happens to write.
 */
const mockReports: ErrorReport[] = [];

/**
 * Outside the factory and `mock`-prefixed, for the reason `mockAudioBackend` gives
 * below: an annotation inside a factory trips Babel's out-of-scope check, and a
 * function declaration hoists so the factory can still call it. Typed against the
 * port, so a rename on the other side fails this file's typecheck.
 */
function mockErrorReporter(): ErrorReporter {
  return {
    report: (report) => {
      mockReports.push(report);
    },
  };
}

jest.mock('@/lib/platform/expo', () => {
  const core = jest.requireActual<typeof import('@correctiv/app-core')>('@correctiv/app-core');
  return {
    expoPlatform: { ...core.createMemoryPlatform(), errors: mockErrorReporter() },
  };
});

/**
 * Typed against the port so a rename on the other side fails this file's typecheck.
 * The annotation cannot go inside the factory: Babel's out-of-scope check runs
 * before the types are stripped. A `mock`-prefixed function declaration hoists.
 */
function mockAudioBackend(): AudioBackend {
  return {
    load: jest.fn(() => Promise.resolve()),
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(() => Promise.resolve()),
    setRate: jest.fn(),
    release: jest.fn(),
    onStatus: jest.fn(),
  };
}

jest.mock('@/lib/audio/backend', () => ({ expoAudio: mockAudioBackend() }));

/**
 * The fault, put where a real one would be: the door renders before the navigator
 * and contains no `try`, so it is the app's own example of a render that can throw
 * with nothing underneath it to catch it. The flag is what lets a retry succeed.
 */
const mockGateError = new Error('the door blew up');
let mockGateThrows = true;
jest.mock('@/components/gate/LoginGate', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    LoginGate: () => {
      if (mockGateThrows) throw mockGateError;
      return react.createElement(Text, null, 'the door');
    },
  };
});

import * as SplashScreen from 'expo-splash-screen';
import { Try } from 'expo-router/build/views/Try';

import type { AudioBackend, ErrorReport, ErrorReporter } from '@correctiv/app-core';
import { resetStore } from '@correctiv/app-core/stores/store';

import RootLayout, { ErrorBoundary } from '@/app/_layout';
import { coreStore } from '@/lib/store/core';

import { findPressable, METRICS, renderedText } from './support/rendering';

const hideAsync = jest.mocked(SplashScreen.hideAsync);

const HEADLINE = 'Die App ist stehen geblieben';
const FONT_ERROR = new Error('the fonts did not load');

const mounted: ReactTestRenderer[] = [];
let logged: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockFontState = [true, null];
  mockGateThrows = true;
  act(() => {
    coreStore.dispatch(resetStore());
  });
  mockReports.length = 0;
  // React logs every error it hands to a boundary. Silenced so the suite's output
  // is readable. The report the boundary makes is NOT in here any more: it goes
  // through the port, and `mockReports` is what holds it.
  logged = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    for (const tree of mounted) tree.unmount();
  });
  mounted.length = 0;
  logged.mockRestore();
});

/**
 * Mounted the way expo-router mounts it: the boundary wrapping the root route, and
 * nothing of the app's own above it. The SafeAreaProvider stands in for the one
 * `ExpoRoot` renders above every route, which is why the boundary may use
 * `SafeAreaView` even though the tree below it has been unmounted.
 */
async function mount(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={METRICS}>
        <Try catch={ErrorBoundary}>
          <RootLayout />
        </Try>
      </SafeAreaProvider>,
    );
  });
  mounted.push(tree);
  return tree;
}

describe('a screen that throws', () => {
  it('gets the recovery screen instead of a splash screen that never lifts', async () => {
    const text = renderedText(await mount());

    expect(text).toContain('FEHLER');
    expect(text).toContain(HEADLINE);
    expect(text).toContain('Bitte versuchen Sie es noch einmal.');
    // The message is English and technical, so it sits under a German label rather
    // than in place of one — and it is what a person can quote back to us until the
    // report has somewhere to go.
    expect(text).toContain('TECHNISCHE MELDUNG');
    expect(text).toContain('the door blew up');
  });

  it('offers a retry control that a screen reader can name', async () => {
    // Found by its accessibility label, which is the handle a screen reader uses:
    // an error screen whose only way out is unlabelled is a dead end.
    expect(findPressable(await mount(), 'Erneut versuchen')).toBeDefined();
  });

  it('renders the tree again when the retry control is pressed', async () => {
    const tree = await mount();
    mockGateThrows = false;

    await act(async () => {
      findPressable(tree, 'Erneut versuchen').props.onPress();
    });

    const text = renderedText(tree);
    expect(text).toContain('the door');
    expect(text).not.toContain(HEADLINE);
  });

  it('reports the error once, through the port issue #95 has to reimplement', async () => {
    await mount();

    // A code and the thrown thing, and no context: the boundary knows that a
    // render failed and nothing else, and the port's contract is that it may not
    // invent the rest. The message a person reads is on the screen above, not in
    // here (ADR 0032).
    expect(mockReports).toEqual([
      { domain: 'render', code: 'render-failed', cause: mockGateError },
    ]);
  });

  it('writes its German with German typography, so no em dash reaches the screen', async () => {
    // The rule that nothing else in the toolchain can fail on: AGENTS.md bans the
    // em dash outright in user-facing text, and a comma or a full stop replaces it.
    expect(renderedText(await mount())).not.toContain('—');
  });
});

describe('a font failure', () => {
  // The door is innocent in all three: the only fault here is the fonts.
  beforeEach(() => {
    mockGateThrows = false;
  });

  it('reaches the boundary and gets a screen, although useFonts never throws', async () => {
    // Without the layout rethrowing there is nothing for any boundary to catch, and
    // the app sits on the splash screen with no crash and no message. The screen
    // then has to survive the very thing it reports: nothing on it waits for
    // `fontsLoaded`, and each platform substitutes a face it cannot find.
    mockFontState = [false, FONT_ERROR];

    const text = renderedText(await mount());
    expect(text).toContain(HEADLINE);
    expect(text).toContain('Erneut versuchen');
    expect(text).toContain(FONT_ERROR.message);
  });

  it('takes the splash screen down, which the shell here cannot have done', async () => {
    // The shell's own `hideAsync()` is behind `fontsLoaded`, so the boundary is the
    // only caller left. This is the hang the issue was filed for, at its narrowest.
    mockFontState = [false, FONT_ERROR];

    expect(renderedText(await mount())).toContain(HEADLINE);
    expect(hideAsync).toHaveBeenCalled();
  });

  it('is not the same as fonts that are merely still loading', async () => {
    // The difference the rethrow has to preserve: unloaded is not failed. The shell
    // renders null, the splash stays, and no error screen flashes at startup.
    mockFontState = [false, null];

    expect(renderedText(await mount())).not.toContain(HEADLINE);
    expect(hideAsync).not.toHaveBeenCalled();
  });
});
