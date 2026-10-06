/**
 * What the shell and the start draw for each number of screens the layout lists
 * (ADR 0078 §5, ADR 0079), against the empty `ship` bundle so that the count is the count.
 */
jest.unmock('@correctiv/app-core/data/layouts/ship/bundle');

const mockNavigate = jest.fn();
const mockRedirect = jest.fn();
jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      navigate: (href: string) => mockNavigate(href),
    },
    usePathname: () => '/s/a',
    useLocalSearchParams: jest.fn(() => ({})),
    Slot: () => react.createElement(View, { testID: 'screen' }),
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href);
      return null;
    },
  };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { builtAt: '2026-09-23T06:00:00.000Z' } } },
}));

jest.mock('uniwind', () => ({
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'light', hasAdaptiveThemes: true }),
  withUniwind: (C: any) => C,
}));

import { Dimensions, Platform } from 'react-native';
import { act } from 'react-test-renderer';

import { homeLayoutActions } from '@correctiv/app-core/stores/homeLayout';
import { resetStore } from '@correctiv/app-core/stores/store';

import Layout from '@/app/(tabs)/_layout.web';
import Start from '@/app/(tabs)/index.web';
import { BUILT_AT } from '@/lib/home/layout';
import { coreStore } from '@/lib/store/core';

import { render, renderedText } from './support/rendering';

const PHONE = { width: 390, height: 844, scale: 2, fontScale: 1 };

// The drawn bar is the web's (ADR 0081): its addresses are `/s/<id>`.
beforeAll(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});
afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  mockNavigate.mockClear();
  mockRedirect.mockClear();
  Dimensions.set({ window: PHONE, screen: PHONE });
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

function publish(carried: string[], listed: string[], maxTabs?: number) {
  const body = {
    version: 1,
    screens: Object.fromEntries(
      carried.map((id) => [id, { version: 4, title: { de: id.toUpperCase() }, sections: [] }]),
    ),
    navigation: {
      version: 1,
      tabs: listed,
      ...(maxTabs === undefined ? {} : { maxTabs }),
    },
  };
  act(() => {
    coreStore.dispatch(
      homeLayoutActions.received({
        text: JSON.stringify(body),
        publishedAt: BUILT_AT + 60_000,
      }),
    );
  });
}

const tabsOf = (tree: ReturnType<typeof render>) =>
  tree.root
    .findAll(
      (node) =>
        node.props?.accessibilityRole === 'tab' && typeof node.props?.onPress === 'function',
    )
    .map((tab) => tab.props.accessibilityLabel as string);

describe('the shell', () => {
  it('draws the screen and no bar for a layout with no screen', () => {
    const tree = render(<Layout />);
    expect(tabsOf(tree)).toEqual([]);
    expect(tree.root.findAllByProps({ testID: 'screen' }).length).toBeGreaterThan(0);
  });

  it('draws the screen and no bar for one screen', () => {
    publish(['a'], ['a']);
    expect(tabsOf(render(<Layout />))).toEqual([]);
  });

  it('draws a bar of every entry for two, and for as many as maxTabs', () => {
    publish(['a', 'b'], ['a', 'b']);
    expect(tabsOf(render(<Layout />))).toEqual(['A', 'B']);
    publish(['a', 'b', 'c'], ['a', 'b', 'c'], 3);
    expect(tabsOf(render(<Layout />))).toEqual(['A', 'B', 'C']);
  });

  it('draws maxTabs - 1 and Mehr for one more', () => {
    publish(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd'], 3);
    expect(tabsOf(render(<Layout />))).toEqual(['A', 'B', 'Mehr']);
  });

  it('draws Mehr below maxTabs for a screen the navigation does not list', () => {
    publish(['a', 'b', 'c'], ['a', 'b']);
    expect(tabsOf(render(<Layout />))).toEqual(['A', 'B', 'Mehr']);
  });

  it('follows a layout that changes while it is drawn', () => {
    const tree = render(<Layout />);
    expect(tabsOf(tree)).toEqual([]);
    publish(['a', 'b'], ['a', 'b']);
    expect(tabsOf(tree)).toEqual(['A', 'B']);
    publish(['b'], ['a', 'b']);
    expect(tabsOf(tree)).toEqual([]);
  });
});

describe('the start', () => {
  it('says "Bald verfügbar" when the layout holds no screen', () => {
    expect(renderedText(render(<Start />))).toContain('Bald verfügbar');
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('goes to the first entry, whatever it is called', () => {
    publish(['home', 'klima'], ['klima', 'home']);
    render(<Start />);
    expect(mockRedirect).toHaveBeenCalledWith('/s/klima');
  });

  it('goes to the first entry that still has a screen', () => {
    publish(['b'], ['a', 'b']);
    render(<Start />);
    expect(mockRedirect).toHaveBeenCalledWith('/s/b');
  });

  it('leaves the empty state for the first screen when one arrives', () => {
    const tree = render(<Start />);
    expect(renderedText(tree)).toContain('Bald verfügbar');
    publish(['a'], ['a']);
    expect(mockRedirect).toHaveBeenCalledWith('/s/a');
  });
});
