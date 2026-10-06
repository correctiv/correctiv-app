/**
 * Which home document Home draws, and when the app goes to fetch one.
 *
 * Three can be drawn: the workbench's override (a preview seam), the copy the app
 * fetched (ADR 0036 §4, ADR 0057 §4) and the document this build bundles (ADR 0036
 * §10). The order is the claim, and it is argued on `screenLayout()` in
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
  LAYOUT_SET_KEY,
  LAYOUTS_URL,
  layoutOverrideKey,
  screenIds,
  screenLayout,
  useScreenLayout,
  useHomeLayoutRefresh,
} from '@/lib/home/layout';
import { decideTabBar } from '@/lib/navigation/tabBar';
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
      get length() {
        return storage.size;
      },
      key: (at: number) => [...storage.keys()][at] ?? null,
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

/** The merged document the deploy publishes, holding the given screens (ADR 0071 §1). */
function merged(screens: Record<string, string>): string {
  const parsed = Object.fromEntries(Object.entries(screens).map(([k, v]) => [k, JSON.parse(v)]));
  return JSON.stringify({ version: 1, screens: parsed });
}

const FETCHED = merged({ home: documentWith('fetched', 'screen-header') });
const OVERRIDE = documentWith('override', 'impact-footer');

function ids(layout: HomeLayout | null): string[] {
  return layout!.sections.map((section) => section.id);
}

function holdFetched(text: string, publishedAt = BUILT_AT + 60_000) {
  act(() => {
    coreStore.dispatch(homeLayoutActions.received({ text, publishedAt }));
  });
}

describe('the document another screen draws', () => {
  it('is the fetched copy of that screen, and the bundle for a screen the copy lacks', () => {
    holdFetched(merged({ mitmachen: documentWith('fetched-mitmachen', 'screen-header') }));
    expect(ids(screenLayout('mitmachen'))).toEqual(['fetched-mitmachen']);
    expect(ids(screenLayout('home'))).toEqual(ids(DEFAULT_HOME_LAYOUT));
    expect(screenLayout('entdecken')!.sections.length).toBeGreaterThan(0);
  });

  it('is the bundle when the fetched part of that screen does not parse', () => {
    const bundled = ids(screenLayout('mitmachen'));
    holdFetched(
      merged({
        home: documentWith('fetched', 'screen-header'),
        mitmachen: JSON.stringify({ version: 'two', sections: 'none' }),
      }),
    );
    expect(ids(screenLayout('mitmachen'))).toEqual(bundled);
    expect(ids(screenLayout('home'))).toEqual(['fetched']);
  });

  it('is the fetched part even when that draws nothing: a screen of a heading is a screen', () => {
    holdFetched(
      merged({
        mitmachen: JSON.stringify({ version: 2, sections: [], moments: [] }),
      }),
    );
    expect(ids(screenLayout('mitmachen'))).toEqual([]);
  });

  it('is its own override over its fetched copy, under its own key', () => {
    holdFetched(merged({ mitmachen: documentWith('fetched-mitmachen', 'screen-header') }));
    storage.set(
      layoutOverrideKey('mitmachen'),
      documentWith('override-mitmachen', 'screen-header'),
    );
    expect(layoutOverrideKey('mitmachen')).toBe('workbench:layout:mitmachen');
    expect(ids(screenLayout('mitmachen'))).toEqual(['override-mitmachen']);
    expect(ids(screenLayout('home'))).toEqual(ids(DEFAULT_HOME_LAYOUT));
  });

  it('draws a screen the bundle never had, like any other', () => {
    holdFetched(
      merged({
        game: documentWith('game', 'screen-header'),
        home: documentWith('h', 'screen-header'),
      }),
    );
    expect(ids(screenLayout('home'))).toEqual(['h']);
    expect(ids(screenLayout('game'))).toEqual(['game']);
  });
});

describe('the document a screen the bundle lacks draws (ADR 0075 §7)', () => {
  const KLIMA = JSON.stringify({
    version: 4,
    title: { de: 'Klima' },
    sections: [{ id: 'k', module: 'screen-header' }],
  });

  it('is the fetched copy of that screen, and nothing when the copy lacks it', () => {
    expect(screenLayout('klima')).toBeNull();
    holdFetched(merged({ klima: KLIMA }));
    expect(ids(screenLayout('klima')!)).toEqual(['k']);
    expect(screenLayout('wahl')).toBeNull();
  });

  it('is its own override over its fetched copy, under its own key', () => {
    holdFetched(merged({ klima: KLIMA }));
    storage.set(layoutOverrideKey('klima'), documentWith('override', 'screen-header'));
    expect(layoutOverrideKey('klima')).toBe('workbench:layout:klima');
    expect(ids(screenLayout('klima')!)).toEqual(['override']);
  });

  it('keeps a document that is only a heading', () => {
    holdFetched(
      merged({ klima: JSON.stringify({ version: 4, title: { de: 'Klima' }, sections: [] }) }),
    );
    expect(screenLayout('klima')!.sections).toEqual([]);
  });

  it('is nothing for an id that cannot name one', () => {
    holdFetched(merged({ 'Bad Id': KLIMA }));
    expect(screenLayout('constructor')).toBeNull();
    expect(screenLayout('Bad Id')).toBeNull();
    expect(screenLayout('navigation')).toBeNull();
  });

  it('lists the ids that resolve: the override, the fetched copy and the bundle, each once', () => {
    holdFetched(merged({ klima: KLIMA, 'Bad Id': KLIMA, home: KLIMA }));
    storage.set(layoutOverrideKey('wahl'), documentWith('w', 'screen-header'));
    storage.set(HOME_LAYOUT_OVERRIDE_KEY, OVERRIDE);
    expect(screenIds().sort()).toEqual(
      ['entdecken', 'home', 'klima', 'mediathek', 'mitmachen', 'profil', 'wahl'].sort(),
    );
  });
});

describe('the document Home draws', () => {
  it('reads the build time the config stamps', () => {
    expect(BUILT_AT).toBe(Date.parse('2026-09-23T06:00:00.000Z'));
  });

  it('is the bundled one when nothing else is held', () => {
    expect(ids(screenLayout('home'))).toEqual(ids(DEFAULT_HOME_LAYOUT));
  });

  it('is the fetched copy over the bundled one', () => {
    holdFetched(FETCHED);
    expect(ids(screenLayout('home'))).toEqual(['fetched']);
  });

  it('is the override over the fetched copy, because somebody is looking at it on purpose', () => {
    holdFetched(FETCHED);
    storage.set(HOME_LAYOUT_OVERRIDE_KEY, OVERRIDE);
    expect(ids(screenLayout('home'))).toEqual(['override']);
  });

  it('is the bundled one again when the fetched copy was published before this build', () => {
    holdFetched(FETCHED, BUILT_AT - 1);
    expect(ids(screenLayout('home'))).toEqual(ids(DEFAULT_HOME_LAYOUT));
  });
});

describe('a whole layout as the override', () => {
  /** A layout holding the given screens and a navigation listing the given tabs. */
  function holdSet(screens: Record<string, string>, tabs: string[], layout = 'ship') {
    storage.set(
      LAYOUT_SET_KEY,
      JSON.stringify({
        layout,
        navigation: { version: 1, maxTabs: 5, tabs },
        screens: Object.fromEntries(Object.entries(screens).map(([k, v]) => [k, JSON.parse(v)])),
      }),
    );
  }

  it('holds the layout whole: a screen it lacks is not found, whatever the bundle carries', () => {
    holdSet({ klima: documentWith('k', 'screen-header') }, ['klima']);
    expect(ids(screenLayout('klima'))).toEqual(['k']);
    expect(screenLayout('home')).toBeNull();
    expect(screenIds()).toEqual(['klima']);
  });

  it('beats the per-screen override and the fetched copy', () => {
    holdFetched(FETCHED);
    storage.set(HOME_LAYOUT_OVERRIDE_KEY, OVERRIDE);
    holdSet({}, []);
    expect(screenLayout('home')).toBeNull();
    storage.delete(LAYOUT_SET_KEY);
    expect(ids(screenLayout('home'))).toEqual(['override']);
  });

  it('draws the empty state for a layout with no screen, and its own bar otherwise', () => {
    holdSet({}, []);
    expect(decideTabBar().bar.kind).toBe('empty');
    holdSet({ a: documentWith('a', 'screen-header'), b: documentWith('b', 'screen-header') }, [
      'a',
      'b',
    ]);
    expect(decideTabBar().bar).toMatchObject({ kind: 'tabs', start: 'a', tabs: ['a', 'b'] });
  });

  it('leaves a deleted screen off the bar even when the navigation still names it', () => {
    holdSet({ a: documentWith('a', 'screen-header') }, ['a', 'gone']);
    expect(decideTabBar().bar).toMatchObject({ kind: 'single', start: 'a' });
  });

  it('is the empty bar, and not the bundle’s, when its navigation is refused', () => {
    storage.set(
      LAYOUT_SET_KEY,
      JSON.stringify({ layout: 'x', navigation: 'nonsense', screens: {} }),
    );
    expect(decideTabBar().bar.kind).toBe('empty');
  });

  it('is ignored when it is not an object of the right shape', () => {
    storage.set(LAYOUT_SET_KEY, '[1]');
    expect(ids(screenLayout('home'))).toEqual(ids(DEFAULT_HOME_LAYOUT));
  });
});

/** The ids `useScreenLayout` handed a screen on its latest render. */
let drawn = '';

function Probe() {
  drawn = ids(useScreenLayout('home')).join(',');
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
    expect(fetchSpy.mock.calls[0][0]).toBe(LAYOUTS_URL);
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
