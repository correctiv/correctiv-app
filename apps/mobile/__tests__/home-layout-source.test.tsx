/**
 * Which home document Home draws, when there is more than one to hand.
 *
 * Three can be: the workbench's override (a preview seam), the copy the app fetched
 * (ADR 0036 §4, ADR 0057 §4) and the document this build bundles (ADR 0036 §10). The
 * order is the claim, and it is argued on `homeLayout()` in `lib/home/layout.ts`: the
 * override, then the fetched copy, then the bundle — and a fetched copy stored beside a
 * different bundle does not count, because an app update must not lose to what the
 * build before it fetched.
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

import { act } from 'react-test-renderer';

import { DEFAULT_HOME_LAYOUT, type HomeLayout } from '@correctiv/app-core/lib/home-layout';
import { BUNDLED_FINGERPRINT, homeLayoutActions } from '@correctiv/app-core/stores/homeLayout';
import { resetStore } from '@correctiv/app-core/stores/store';

import {
  HOME_LAYOUT_OVERRIDE_KEY,
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

function holdFetched(text: string, bundled = BUNDLED_FINGERPRINT) {
  act(() => {
    coreStore.dispatch(homeLayoutActions.received({ text, bundled }));
  });
}

describe('the document Home draws', () => {
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

  it('is the bundled one again when the copy was fetched beside a different bundle', () => {
    holdFetched(FETCHED, 'an-older-build');
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

describe('the fetch in development', () => {
  /*
   * Locally the bundled file is what a developer is editing, and the published copy
   * must not beat it on the screen that is supposed to show the edit. jest runs with
   * `__DEV__` true, which is the case this asserts.
   */
  it('does not happen, so the bundled file is what a developer sees', () => {
    const fetchSpy = jest.fn(() => Promise.reject(new Error('no network in a test')));
    const original = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    try {
      function Refresher() {
        useHomeLayoutRefresh(true);
        return null;
      }
      render(<Refresher />);
      expect(__DEV__).toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(coreStore.getState().homeLayout.triedAt).toBeNull();
    } finally {
      global.fetch = original;
    }
  });
});
