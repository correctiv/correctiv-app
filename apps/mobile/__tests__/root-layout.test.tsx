import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Provider } from 'react-redux';

/**
 * The root layout's three decisions that nothing else can see.
 *
 *  1. **The Provider has to hold the app's store instance.** The core exports
 *     `createAppStore()` and no singleton; `lib/store/core.ts` builds the one
 *     there is (ADR 0023). Screens read through the
 *     Provider (`useAppSelector`), while `coreActions` and the two modules that run
 *     outside React dispatch straight into the imported store. Those are only the
 *     same store because this file hands the Provider that very instance — an
 *     invariant with no other enforcement, and one whose breach is silent: both
 *     halves keep working and the screens simply stop updating.
 *  2. **The jump into the onboarding fires once, and only from `/`.** Anywhere else
 *     it would overwrite every shared link on the web target, which is the whole
 *     reason the pathname is checked; and it is a `replace`, because the onboarding
 *     is not a place one returns to.
 *  3. **The door comes first.** Nothing behind it is decided, the onboarding jump
 *     included, until the session is admitted, and admitted means an entitlement
 *     with the app in it, never a contribution. The session hydrates before the
 *     first render like everything else, so a returning member is not shown the
 *     form for a frame.
 *
 * Neither was testable while the gate was a module-level `let`: the first mount in
 * a suite consumed it for every mount after it, so any second assertion passed
 * because nothing happened rather than because the right thing did.
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

// The fonts never resolve here, so the shell renders null — everything under test
// is decided above that early return.
jest.mock('expo-font', () => ({ useFonts: () => [false, null] }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(),
  hideAsync: jest.fn(),
}));
/**
 * `GestureHandlerRootView` reaches for a native module jest has not got and throws
 * `_RNGestureHandlerModule.default.install is not a function` on mount.
 *
 * This suite used to miss it: the gesture root sat inside the shell, below its
 * `if (!fontsLoaded || !storeReady) return null`, and the fonts never resolve here.
 * It is part of `lib/env/AppEnvironment` now, above that return, because it is part
 * of what the app wraps everything in rather than part of what it renders once it
 * is ready. `error-boundary.test.tsx` carries the same double and the story of how
 * it came to light.
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
  // The door imports the design system, whose SafeAreaView is wrapped at module
  // load; the wrapper is an identity here because nothing below the early return
  // is ever rendered.
  withUniwind: (component: unknown) => component,
}));

/**
 * The real adapter reaches for MMKV's native module. The core's in-memory
 * platform answers the same ports, so `persist()` and the hydration gate below run
 * for real against it — only the storage is different.
 */
jest.mock('@/lib/platform/expo', () => {
  const core = jest.requireActual<typeof import('@correctiv/app-core')>('@correctiv/app-core');
  return { expoPlatform: core.createMemoryPlatform() };
});

/**
 * The backend is only handed to `configurePlatform` here; nothing in this file
 * plays anything. It is spelled out in full and typed against the port anyway, so
 * that a rename on the other side fails this file's typecheck rather than leaving
 * a double that describes a shape the module no longer has. (`addStatusListener`
 * sat here for two migrations after `onStatus` replaced it.)
 *
 * The annotation cannot go inside the factory: Babel's out-of-scope check runs
 * before the types are stripped and rejects the name even in type position. A
 * `mock`-prefixed function declaration is the shape jest allows, and it hoists.
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
 * The build time `app.config.js` stamps into every build. Without one the app fetches
 * no home document at all, and the two tests about that fetch below would pass by
 * nothing happening.
 */
jest.mock('expo-constants', () => {
  const actual = jest.requireActual<{ default: { expoConfig?: Record<string, unknown> } }>(
    'expo-constants',
  );
  const expoConfig = {
    ...actual.default.expoConfig,
    extra: { builtAt: '2026-09-23T06:00:00.000Z' },
  };
  return { __esModule: true, default: { ...actual.default, expoConfig } };
});

import { router, usePathname } from 'expo-router';

import type { AudioBackend } from '@correctiv/app-core';
import { sessionActions } from '@correctiv/app-core/stores/session';
import { completeOnboarding } from '@correctiv/app-core/stores/settings';
import { resetStore } from '@correctiv/app-core/stores/store';
import type { Entitlement } from '@correctiv/app-core/types/models';

import RootLayout from '@/app/_layout';
import { HOME_LAYOUT_URL } from '@/lib/home/layout';
import { expoPlatform } from '@/lib/platform/expo';
import { coreActions, coreStore } from '@/lib/store/core';

const account = { email: 'alex@example.org', name: 'Alex' };
const PAID: Entitlement = {
  tier: 'paid',
  appAccess: true,
  source: 'paid',
  validUntil: null,
  localAreas: [],
  memberSince: '2026-03-04T09:12:00.000Z',
};

/** Through the door, the way a sign-in leaves the store. */
function admit(entitlement: Entitlement = PAID): void {
  act(() => {
    coreStore.dispatch(sessionActions.succeeded({ account, entitlement }));
  });
}

const replace = router.replace as jest.Mock;
const push = router.push as jest.Mock;
const pathname = jest.mocked(usePathname);

const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  pathname.mockReturnValue('/');
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

afterEach(() => {
  act(() => {
    for (const tree of mounted) tree.unmount();
  });
  mounted.length = 0;
});

/**
 * Mounts the layout and lets the hydration promise settle, which is what flips
 * `storeReady` and therefore what the redirect waits for.
 */
async function mount(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<RootLayout />);
  });
  mounted.push(tree);
  return tree;
}

/** The store the Provider actually hands to the tree below it. */
const providerStore = (tree: ReactTestRenderer) =>
  tree.root.findByType(Provider).props.store as typeof coreStore;

describe('the Provider', () => {
  it('is handed the core singleton', async () => {
    expect(providerStore(await mount())).toBe(coreStore);
  });

  it('lets a write through coreActions reach what the screens read', async () => {
    // The invariant stated in terms of what it protects: `coreActions` is bound to
    // the imported store, the screens select from the Provider's. Against two
    // stores this assertion fails and nothing else would.
    const store = providerStore(await mount());
    expect(store.getState().settings.onboardingDone).toBe(false);

    act(() => {
      coreActions.settings.completeOnboarding();
    });

    expect(store.getState().settings.onboardingDone).toBe(true);
  });
});

describe('the onboarding gate', () => {
  // Every case here is about what happens BEHIND the door.
  beforeEach(() => admit());

  it('jumps into the onboarding when the app starts on the home route', async () => {
    await mount();

    expect(replace).toHaveBeenCalledWith('/onboarding');
    // `replace`, not `push`: there is nothing to come back to.
    expect(push).not.toHaveBeenCalled();
  });

  it('jumps once, however often the effect re-runs', async () => {
    const tree = await mount();
    expect(replace).toHaveBeenCalledTimes(1);

    // The onboarding is now the route, so `pathname` changes and the effect's own
    // dependency list re-runs it. Without the gate this is a second jump — to the
    // screen the app is already on.
    pathname.mockReturnValue('/onboarding');
    await act(async () => {
      tree.update(<RootLayout />);
    });

    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('leaves a deep link alone', async () => {
    // The web target's shared addresses are real URLs: someone opening /backstage
    // has to land on Backstage. This is the case the pathname check exists for, and
    // it does not arise natively, where the app always starts at '/'.
    pathname.mockReturnValue('/backstage');

    await mount();

    expect(replace).not.toHaveBeenCalled();
  });

  it('does not ask again once the onboarding is done', async () => {
    act(() => {
      coreStore.dispatch(completeOnboarding());
    });

    await mount();

    expect(replace).not.toHaveBeenCalled();
  });

  it('decides per mount, not per module', async () => {
    // What the module-level flag broke. A remount is a fresh start of the app, so
    // it owes the same decision — and a gate that outlives the component would
    // make every assertion above depend on test order.
    await mount();
    expect(replace).toHaveBeenCalledTimes(1);

    act(() => {
      for (const tree of mounted) tree.unmount();
    });
    mounted.length = 0;

    await mount();
    expect(replace).toHaveBeenCalledTimes(2);
  });
});

describe('the door', () => {
  it('holds the onboarding jump until the session is admitted', async () => {
    // Signed out: the shell renders the gate in place of the navigator, so there
    // is nothing to jump to and nothing is decided.
    await mount();
    expect(replace).not.toHaveBeenCalled();

    // The sign-in lands, the navigator mounts, and the onboarding decision is
    // taken then, from the same mount.
    admit();
    expect(replace).toHaveBeenCalledWith('/onboarding');
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('does not admit a member whose membership has no app in it', async () => {
    admit({
      tier: 'free',
      appAccess: false,
      source: null,
      validUntil: null,
      localAreas: [],
      memberSince: '2026-03-04T09:12:00.000Z',
    });
    await mount();
    expect(replace).not.toHaveBeenCalled();
  });

  it('admits a trial by its entitlement, whatever it pays', async () => {
    admit({ ...PAID, source: 'trial', validUntil: '2999-01-01T00:00:00.000Z' });
    await mount();
    expect(replace).toHaveBeenCalledWith('/onboarding');
  });

  it('hydrates a persisted session before deciding anything', async () => {
    // What a returning member has on disk: the account and the entitlement, no
    // status. The status is what having an account means, derived on hydration.
    await expoPlatform.keyValue.setString(
      'store.session',
      JSON.stringify({ account, entitlement: PAID }),
    );

    await mount();

    expect(coreStore.getState().session.status).toBe('signed-in');
    // And the onboarding decision saw the hydrated session, not the empty default.
    expect(replace).toHaveBeenCalledWith('/onboarding');
    await expoPlatform.keyValue.remove('store.session');
  });
});

/**
 * The home document (ADR 0036 §4, §5): the root layout is where the fetched copy is
 * registered for persistence and where the fetch is started, and a line missing from
 * either leaves every other test in the app green. So both are asserted through the
 * layout itself.
 */
describe('the home document', () => {
  const dev = __DEV__;
  const originalFetch = global.fetch;

  afterEach(() => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = dev;
    global.fetch = originalFetch;
  });

  it('is kept across a restart, because the layout persists its slice', async () => {
    const text = JSON.stringify({ version: 2, sections: [], moments: [] });
    await expoPlatform.keyValue.setString(
      'store.homeLayout',
      JSON.stringify({ text, publishedAt: 1_790_000_000_000 }),
    );

    await mount();

    expect(coreStore.getState().homeLayout.text).toBe(text);
    await expoPlatform.keyValue.remove('store.homeLayout');
  });

  it('is fetched once the store is ready, outside development', async () => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
    const fetchSpy = jest.fn((_url: string) => Promise.reject(new Error('no network in a test')));
    global.fetch = fetchSpy as unknown as typeof fetch;

    await mount();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(HOME_LAYOUT_URL);
  });
});
