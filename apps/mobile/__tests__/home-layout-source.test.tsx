/**
 * Which home document Home draws, and when the app goes to fetch one.
 *
 * Three can be drawn: the workbench's override (a preview seam), the copy the app
 * fetched (ADR 0036 §4, ADR 0057 §4) and the document this build bundles (ADR 0036
 * §10). The order is the claim, and it is argued on `homeLayout()` in
 * `lib/home/layout.ts`: the override, then the fetched copy, then the bundle — and a
 * fetched copy published before this build was made does not count, because an app
 * update must not lose to an older document.
 *
 * The fetch itself is §5: at launch and on every return to the foreground, never in
 * development. Those are asserted here with `__DEV__` switched off and `AppState`
 * driven by hand, because under jest `__DEV__` is true and nothing would fetch at all.
 *
 * A file of its own because it installs a `localStorage` on `window`, as
 * `home-simulated-clock.test.tsx` does and for its reason: the React Native test
 * environment has none, and the override is read from one.
 */

/** The module map behind `layout.ts` imports the router; nothing here navigates. */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

/** The build time `app.config.js` stamps, as `expo-constants` would hand it over. */
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { builtAt: '2026-09-23T06:00:00.000Z' } } },
}));

import { act } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';

import { DEFAULT_HOME_LAYOUT, type HomeLayout } from '@correctiv/app-core/lib/home-layout';
import { HOME_LAYOUT_FLOOR_MS, homeLayoutActions } from '@correctiv/app-core/stores/homeLayout';
import { resetStore } from '@correctiv/app-core/stores/store';

import {
  BUILT_AT,
  HOME_LAYOUT_OVERRIDE_KEY,
  HOME_LAYOUT_URL,
  homeLayout,
  useHomeLayout,
  useHomeLayoutRefresh,
} from '@/lib/home/layout';
import { coreStore } from '@/lib/store/core';

import { render } from './support/rendering';

const storage = new Map<string, string>();

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
    },
  });
});

beforeEach(() => {
  storage.clear();
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

/** A document naming one place, so a test can say which document was drawn. */
function documentWith(id: string, module: string): string {
  return JSON.stringify({ version: 2, sections: [{ id, module }], moments: [] });
}

const FETCHED = documentWith('fetched', 'home-header');
const OVERRIDE = documentWith('override', 'impact-footer');

function ids(layout: HomeLayout): string[] {
  return layout.sections.map((section) => section.id);
}

function holdFetched(text: string, publishedAt = BUILT_AT + 60_000) {
  act(() => {
    coreStore.dispatch(homeLayoutActions.received({ text, publishedAt }));
  });
}

describe('the document Home draws', () => {
  it('reads the build time the config stamps', () => {
    expect(BUILT_AT).toBe(Date.parse('2026-09-23T06:00:00.000Z'));
  });

  it('is the bundled one when nothing else is held', () => {
    expect(ids(homeLayout())).toEqual(ids(DEFAULT_HOME_LAYOUT));
  });

  it('is the fetched copy over the bundled one', () => {
    holdFetched(FETCHED);
    expect(ids(homeLayout())).toEqual(['fetched']);
  });

  it('is the override over the fetched copy, because somebody is looking at it on purpose', () => {
    holdFetched(FETCHED);
    storage.set(HOME_LAYOUT_OVERRIDE_KEY, OVERRIDE);
    expect(ids(homeLayout())).toEqual(['override']);
  });

  it('is the bundled one again when the fetched copy was published before this build', () => {
    holdFetched(FETCHED, BUILT_AT - 1);
    expect(ids(homeLayout())).toEqual(ids(DEFAULT_HOME_LAYOUT));
  });
});

/** The ids `useHomeLayout` handed a screen on its latest render. */
let drawn = '';

function Probe() {
  drawn = ids(useHomeLayout()).join(',');
  return null;
}

describe('a screen already drawn', () => {
  /*
   * The fetch lands after the first render, at launch and on every return to the
   * foreground, so a screen that did not redraw would show the new copy only on the
   * next cold start.
   */
  it('redraws when the fetched copy arrives', () => {
    render(<Probe />);
    expect(drawn).toBe(ids(DEFAULT_HOME_LAYOUT).join(','));

    holdFetched(FETCHED);
    expect(drawn).toBe('fetched');
  });
});

function Refresher({ ready }: { ready: boolean }) {
  useHomeLayoutRefresh(ready);
  return null;
}

describe('when the app fetches', () => {
  const dev = __DEV__;
  const originalFetch = global.fetch;
  let fetchSpy: jest.Mock;
  let onChange: ((state: AppStateStatus) => void) | null;
  let removed: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(Date.parse('2026-09-23T08:00:00.000Z'));
    fetchSpy = jest.fn(() => Promise.reject(new Error('no network in a test')));
    global.fetch = fetchSpy as unknown as typeof fetch;
    onChange = null;
    removed = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'change') onChange = listener as (state: AppStateStatus) => void;
      return { remove: removed } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
  });

  afterEach(() => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = dev;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const production = () => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
  };

  it('fetches once when the store is ready, from the address the app holds', () => {
    production();
    const tree = render(<Refresher ready={false} />);
    expect(fetchSpy).not.toHaveBeenCalled();

    act(() => tree.update(<Refresher ready />));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe(HOME_LAYOUT_URL);
  });

  it('fetches again on a return to the foreground, and not on going to the background', () => {
    production();
    render(<Refresher ready />);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + HOME_LAYOUT_FLOOR_MS);

    act(() => onChange?.('background'));
    act(() => onChange?.('inactive'));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    act(() => onChange?.('active'));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('stops listening when the host unmounts', () => {
    production();
    const tree = render(<Refresher ready />);
    act(() => tree.unmount());
    expect(removed).toHaveBeenCalledTimes(1);
  });

  /*
   * Locally the bundled file is what a developer is editing, and the published copy
   * must not beat it on the screen that is supposed to show the edit.
   */
  it('does not happen in development, so the bundled file is what a developer sees', () => {
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;
    render(<Refresher ready />);
    act(() => onChange?.('active'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(coreStore.getState().homeLayout.triedAt).toBeNull();
  });
});
