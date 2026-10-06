/**
 * What the app draws from the layout's navigation (ADR 0078 §5, ADR 0079): the five cases the
 * table in `lib/navigation.ts` has, which screens leave no tab behind, and that the bar follows
 * a document that arrives while it is on screen.
 *
 * The bundle is `ship`, empty, so that every screen here is one a test published and the
 * count is the count: the setup file's `demo` would put five screens under every case.
 */
jest.unmock('@correctiv/app-core/data/layouts/ship/bundle');

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { builtAt: '2026-09-23T06:00:00.000Z' } } },
}));

import { Platform } from 'react-native';
import { act } from 'react-test-renderer';

import { isReachable, type Channel } from '@correctiv/app-core/features/features';
import { MAX_TABS, MORE_TAB, type TabBar } from '@correctiv/app-core/lib/navigation';
import { homeLayoutActions } from '@correctiv/app-core/stores/homeLayout';
import { resetStore } from '@correctiv/app-core/stores/store';

import { tabReachable } from '../src/lib/features';
import { BUILT_AT } from '@/lib/home/layout';
import { decideTabBar, useTabBarDecision, type TabBarDecision } from '@/lib/navigation/tabBar';
import { activeTabOf, tabHref } from '@/lib/navigation/tabRoutes';
import { coreStore } from '@/lib/store/core';

import { render } from './support/rendering';

// The drawn bar is the web's (ADR 0081): its addresses are `/s/<id>`.
beforeAll(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});
afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

const ids = (count: number) => Array.from({ length: count }, (_, i) => `s${i + 1}`);

/** A screen that is only a heading, which is a screen (ADR 0075 §7). */
const screen = (title: string) => ({ version: 4, title: { de: title }, sections: [] });

/**
 * Publish a joined document: `carried` screens, and a navigation listing `listed` of them or
 * of ids nothing carries.
 */
function publish(carried: string[], listed: string[], maxTabs?: number) {
  const body = {
    version: 1,
    screens: Object.fromEntries(carried.map((id) => [id, screen(id.toUpperCase())])),
    navigation: { version: 1, tabs: listed, ...(maxTabs === undefined ? {} : { maxTabs }) },
  };
  act(() => {
    coreStore.dispatch(
      homeLayoutActions.received({ text: JSON.stringify(body), publishedAt: BUILT_AT + 60_000 }),
    );
  });
}

const barOf = (): TabBar => decideTabBar().bar;

describe('the bar the app draws, by the number of screens the navigation lists', () => {
  it('is the empty state with no layout at all: the bundle is ship, which is empty', () => {
    expect(barOf()).toEqual({ kind: 'empty', start: null, entries: [], tabs: [], more: [] });
  });

  it('is the empty state for a navigation that lists none', () => {
    publish(ids(3), []);
    expect(barOf().kind).toBe('empty');
  });

  it('is the screen alone for one entry, and that screen is the start', () => {
    publish(['klima'], ['klima']);
    expect(barOf()).toEqual({
      kind: 'single',
      start: 'klima',
      entries: ['klima'],
      tabs: [],
      more: [],
    });
  });

  it('is every entry as a tab for two', () => {
    publish(ids(2), ids(2));
    expect(barOf()).toMatchObject({ kind: 'tabs', start: 's1', tabs: ids(2), more: [] });
  });

  it('is every entry as a tab for exactly maxTabs', () => {
    publish(ids(3), ids(3), 3);
    expect(barOf()).toMatchObject({ kind: 'tabs', start: 's1', tabs: ids(3), more: [] });
  });

  it('is maxTabs - 1 tabs and Mehr for one more, with the rest behind it', () => {
    publish(ids(4), ids(4), 3);
    expect(barOf()).toMatchObject({
      kind: 'tabs',
      start: 's1',
      tabs: ['s1', 's2', MORE_TAB],
      more: ['s3', 's4'],
    });
  });

  it('never shows more than five tabs, whatever the navigation lists', () => {
    publish(ids(9), ids(9));
    expect(barOf().tabs).toHaveLength(MAX_TABS);
    expect(barOf().more).toHaveLength(9 - (MAX_TABS - 1));
  });

  it('starts on the first entry, Home or not: nothing is implied', () => {
    publish(['home', 'klima'], ['klima', 'home']);
    expect(barOf().start).toBe('klima');
    expect(barOf().tabs).toEqual(['klima', 'home']);
  });
});

describe('a screen the navigation does not list', () => {
  it('is behind Mehr, which then appears below maxTabs', () => {
    publish(['a', 'b', 'c'], ['a', 'b']);
    const { bar, unlisted } = decideTabBar();
    expect(bar).toMatchObject({ kind: 'tabs', start: 'a', tabs: ['a', 'b', MORE_TAB], more: [] });
    expect(unlisted).toEqual(['c']);
  });

  it('turns a single entry into a bar of that entry and Mehr', () => {
    publish(['a', 'b'], ['a']);
    expect(barOf()).toMatchObject({ kind: 'tabs', start: 'a', tabs: ['a', MORE_TAB], more: [] });
  });

  it('shares Mehr with the entries that overflowed', () => {
    publish(ids(5), ['s1', 's2', 's3', 's4'], 4);
    const { bar, unlisted } = decideTabBar();
    expect(bar.tabs).toEqual(['s1', 's2', 's3', MORE_TAB]);
    expect(bar.more).toEqual(['s4']);
    expect(unlisted).toEqual(['s5']);
  });

  it('does not make a bar where there is nothing to start on', () => {
    publish(['a'], []);
    expect(barOf().kind).toBe('empty');
  });
});

describe('a screen that is gone leaves no tab', () => {
  it('is left out of the bar and the count, the navigation still listing it', () => {
    publish(['a', 'c'], ['a', 'b', 'c']);
    expect(barOf()).toMatchObject({ kind: 'tabs', start: 'a', tabs: ['a', 'c'], more: [] });
  });

  it('leaves the one screen alone when the other was deleted', () => {
    publish(['a'], ['a', 'b']);
    expect(barOf()).toMatchObject({ kind: 'single', start: 'a', entries: ['a'], tabs: [] });
  });

  it('starts on the first screen that is still there', () => {
    publish(['b'], ['a', 'b']);
    expect(barOf().start).toBe('b');
  });

  it('is the empty state when every listed screen is gone', () => {
    publish([], ['a', 'b']);
    expect(barOf().kind).toBe('empty');
  });
});

const reachableIn = (channel: Channel) => (tab: string) =>
  tabReachable(tab, (id) => isReachable({ features: { channel, override: null } }, id));

describe('a feature this build cannot reach', () => {
  it('takes the screen off the bar in the release channel, as the gated tab always went', () => {
    // callouts, faktenforum and abriss-atlas are all `vorschau`, so nothing in the screen is `an`.
    expect(reachableIn('preview')('mitmachen')).toBe(true);
    expect(reachableIn('release')('mitmachen')).toBe(false);
    expect(reachableIn('release')('home')).toBe(true);
  });
});

describe('the bar follows the documents', () => {
  let drawn: TabBarDecision | null = null;
  function Probe() {
    drawn = useTabBarDecision();
    return null;
  }

  it('redraws when a fetched navigation arrives, with no reload', () => {
    render(<Probe />);
    expect(drawn!.bar.kind).toBe('empty');

    publish(ids(3), ids(3));
    expect(drawn!.bar.tabs).toEqual(ids(3));

    publish(ids(3), ['s3', 's1']);
    expect(drawn!.bar.tabs).toEqual(['s3', 's1', MORE_TAB]);
    expect(drawn!.bar.start).toBe('s3');
  });

  it('redraws when a screen is taken out of the carried document', () => {
    publish(ids(3), ids(3));
    render(<Probe />);
    expect(drawn!.bar.tabs).toEqual(ids(3));

    publish(['s1', 's3'], ids(3));
    expect(drawn!.bar.tabs).toEqual(['s1', 's3']);
  });
});

describe('where a tab leads, and which one an address is on', () => {
  const bar: TabBar = {
    kind: 'tabs',
    start: 'a',
    entries: ['a', 'b', 'c'],
    tabs: ['a', 'b', MORE_TAB],
    more: ['c'],
  };

  it('is /s/<id>, and /mehr for Mehr', () => {
    expect(tabHref('klima')).toBe('/s/klima');
    expect(tabHref(MORE_TAB)).toBe('/mehr');
  });

  it('is the tab for an address on the bar, and Mehr for one behind it', () => {
    expect(activeTabOf('/s/b', bar)).toBe('b');
    expect(activeTabOf('/s/c', bar)).toBe(MORE_TAB);
    expect(activeTabOf('/mehr', bar)).toBe(MORE_TAB);
  });

  it('is no tab for an address that is not a screen, or when the bar has no Mehr', () => {
    expect(activeTabOf('/artikel', bar)).toBeNull();
    expect(activeTabOf('/s/c', { ...bar, tabs: ['a', 'b'], more: [] })).toBeNull();
    expect(activeTabOf('/mehr', { ...bar, tabs: ['a', 'b'], more: [] })).toBeNull();
  });
});
