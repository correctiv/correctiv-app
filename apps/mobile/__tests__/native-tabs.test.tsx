/**
 * The system's tab bar is decided once per start (ADR 0081): which triggers it declares for
 * each number of screens, that a navigation fetched afterwards changes nothing until the next
 * start, and what each slot draws. The native runtime is replaced by markers, so this holds
 * the decision and the wiring, not how iOS or Android draw the bar.
 */
jest.unmock('@correctiv/app-core/data/layouts/ship/bundle');

const mockRedirect = jest.fn();
jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    router: { push: jest.fn(), replace: jest.fn(), navigate: jest.fn() },
    usePathname: () => '/',
    useLocalSearchParams: jest.fn(() => ({})),
    Stack: { Screen: () => null },
    Slot: () => react.createElement(View, { testID: 'slot' }),
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href);
      return null;
    },
  };
});

jest.mock('expo-router/unstable-native-tabs', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const marker = (testID: string) => (props: { children?: React.ReactNode }) =>
    react.createElement(View, { testID }, props.children);
  const NativeTabs = Object.assign(marker('native-tabs'), {
    Trigger: Object.assign(
      (props: { name: string; children?: React.ReactNode }) =>
        react.createElement(View, { testID: `trigger:${props.name}` }, props.children),
      { Label: marker('label'), Icon: () => null },
    ),
    BottomAccessory: marker('accessory'),
  });
  return { NativeTabs };
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

import { act } from 'react-test-renderer';

import { homeLayoutActions } from '@correctiv/app-core/stores/homeLayout';
import { resetStore } from '@correctiv/app-core/stores/store';

import Layout from '@/app/(tabs)/_layout';
import Start from '@/app/(tabs)/index';
import SecondSlot from '@/app/(tabs)/slot-2';
import ScreenRoute from '@/app/screen/[id]';
import { BUILT_AT } from '@/lib/home/layout';
import { resetStartDecision } from '@/lib/navigation/tabBar';
import { coreStore } from '@/lib/store/core';

import { render, renderedText } from './support/rendering';

const { useLocalSearchParams } = jest.requireMock('expo-router') as {
  useLocalSearchParams: jest.Mock;
};

beforeEach(() => {
  resetStartDecision();
  mockRedirect.mockClear();
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

function publish(carried: string[], listed: string[], maxTabs?: number) {
  const body = {
    version: 1,
    screens: Object.fromEntries(
      carried.map((id) => [
        id,
        {
          version: 4,
          title: { de: id.toUpperCase() },
          sections: [{ id: 'head', module: 'screen-header' }],
        },
      ]),
    ),
    navigation: { version: 1, tabs: listed, ...(maxTabs === undefined ? {} : { maxTabs }) },
  };
  act(() => {
    coreStore.dispatch(
      homeLayoutActions.received({ text: JSON.stringify(body), publishedAt: BUILT_AT + 60_000 }),
    );
  });
}

const ids = (count: number) => Array.from({ length: count }, (_, i) => `s${i + 1}`);

const triggersOf = (tree: ReturnType<typeof render>) =>
  tree.root
    .findAll(
      (node) => typeof node.props?.testID === 'string' && node.props.testID.startsWith('trigger:'),
    )
    .map((node) => (node.props.testID as string).slice('trigger:'.length))
    .filter((name, index, all) => all.indexOf(name) === index);

describe('the triggers the system bar declares', () => {
  it.each([
    [0, []],
    [1, []],
    [2, ['index', 'slot-2']],
    [5, ['index', 'slot-2', 'slot-3', 'slot-4', 'slot-5']],
    [6, ['index', 'slot-2', 'slot-3', 'slot-4', 'mehr']],
  ])('for %i screens', (count, expected) => {
    publish(ids(count), ids(count));
    const tree = render(<Layout />);
    expect(triggersOf(tree)).toEqual(expected);
    expect(tree.root.findAllByProps({ testID: 'native-tabs' }).length > 0).toBe(count >= 2);
  });

  it('puts a screen the navigation does not list behind "Mehr"', () => {
    publish(ids(3), ['s1', 's3']);
    expect(triggersOf(render(<Layout />))).toEqual(['index', 'slot-2', 'mehr']);
  });

  it('keeps the bar it started with when a navigation arrives later', () => {
    publish(ids(2), ids(2));
    const tree = render(<Layout />);
    publish(ids(4), ids(4));
    act(() => {});
    expect(triggersOf(tree)).toEqual(['index', 'slot-2']);
  });

  it('applies that navigation at the next start', () => {
    publish(ids(2), ids(2));
    render(<Layout />);
    publish(ids(4), ids(4));
    resetStartDecision();
    expect(triggersOf(render(<Layout />))).toEqual(['index', 'slot-2', 'slot-3', 'slot-4']);
  });
});

describe('what a slot draws', () => {
  it('draws the screen of the n-th entry', () => {
    publish(['a', 'b'], ['b', 'a']);
    expect(renderedText(render(<Start />))).toContain('B');
    expect(renderedText(render(<SecondSlot />))).toContain('A');
  });

  it('draws the empty state in the first slot when the layout holds no screen', () => {
    expect(renderedText(render(<Start />))).toContain('Bald verfügbar');
  });
});

describe('/screen/<id> on a phone', () => {
  it('sends a screen on the bar to its slot', () => {
    publish(ids(3), ids(3));
    useLocalSearchParams.mockReturnValue({ id: 's2' });
    render(<ScreenRoute />);
    expect(mockRedirect).toHaveBeenLastCalledWith('/slot-2');
    useLocalSearchParams.mockReturnValue({ id: 's1' });
    render(<ScreenRoute />);
    expect(mockRedirect).toHaveBeenLastCalledWith('/');
  });

  it('pushes a screen behind "Mehr" over the tabs', () => {
    publish(ids(6), ids(6));
    useLocalSearchParams.mockReturnValue({ id: 's6' });
    const text = renderedText(render(<ScreenRoute />));
    expect(text).not.toContain('Diese Seite gibt es nicht');
  });

  it('is not-found for a screen nothing carries', () => {
    publish(ids(2), ids(2));
    useLocalSearchParams.mockReturnValue({ id: 'gibt-es-nicht' });
    expect(renderedText(render(<ScreenRoute />))).toContain('Diese Seite gibt es nicht');
  });
});
