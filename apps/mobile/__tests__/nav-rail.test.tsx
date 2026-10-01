import { Dimensions } from 'react-native';
import { act } from 'react-test-renderer';

import { sizes, spacingPx } from '../src/lib/theme';
import { columnGutter } from '../src/components/ui/ContentColumn';
import { MiniPlayer } from '../src/components/player/MiniPlayer';
import { NavRail } from '../src/components/ui/NavRail';
import { render } from './support/rendering';

/**
 * Mocks expo-router so MiniPlayer (imported by NavRail) doesn't pull in
 * `standard-navigation`, an ESM package jest does not transform.
 * MiniPlayer calls `router.push`, silently absorbed by the mock.
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
}));

const mockNavigate = jest.fn();
const mockEmit = jest.fn(() => ({ defaultPrevented: false }));
const mockRoutes = ['index', 'entdecken', 'mediathek', 'mitmachen', 'profil'].map((name) => ({
  key: `${name}-key`,
  name,
}));

/**
 * A navigator double that does what the real one does for this test's purposes:
 * hand its `tabBar` prop the state and navigation object, or draw a bottom bar
 * marker when it has none. The rail code under test is the real one.
 */
jest.mock('expo-router/js-tabs', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Tabs = ({ tabBar }: { tabBar?: (p: unknown) => React.ReactNode }) =>
    tabBar
      ? react.createElement(
          View,
          { testID: 'js-tabs-rail' },
          tabBar({
            state: { index: 1, routes: mockRoutes },
            navigation: { emit: mockEmit, navigate: mockNavigate },
            descriptors: {},
            insets: { top: 0, bottom: 0, left: 0, right: 0 },
          }),
        )
      : react.createElement(View, { testID: 'js-tabs-bottom-bar' });
  Tabs.Screen = () => null;
  return { Tabs };
});

jest.mock('expo-router/unstable-native-tabs', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Part = () => null;
  const NativeTabs = () => react.createElement(View, { testID: 'native-tabs' });
  NativeTabs.Trigger = Object.assign(Part, { Label: Part, Icon: Part });
  NativeTabs.BottomAccessory = Part;
  return { NativeTabs };
});
/**
 * `useColors()` calls `useUniwind()` from uniwind; without a provider it throws
 * in the test tree. This mock mirrors `appearance.test.tsx`.
 */
jest.mock('uniwind', () => ({
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'light', hasAdaptiveThemes: true }),
  withUniwind: (C: any) => C,
}));

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

describe('the space beside the rail', () => {
  it('keeps the reading column inside what the rail leaves, from the breakpoint up', () => {
    for (let width = sizes.railBreakpoint; width <= 1194; width++) {
      const beside = width - sizes.railWidth;
      expect(columnGutter(beside)).toBeGreaterThanOrEqual(spacingPx.m);
      expect(
        2 * columnGutter(beside) + Math.min(sizes.contentColumn, beside - 2 * spacingPx.m),
      ).toBe(beside);
    }
  });
});

/**
 * Both layouts, rendered at a phone width and a tablet width.
 *
 * At tablet width the navigator's `tabBar` is the rail, and a press on a rail item
 * reaches the navigator's `navigate` — not a router call from the layout. At phone
 * width there is no rail: native shows the system tabs, web its drawn bar.
 */
const LAYOUTS = [
  ['native', () => require('../src/app/(tabs)/_layout').default],
  ['web', () => require('../src/app/(tabs)/_layout.web').default],
] as const;

function at(width: number, Layout: React.ComponentType) {
  Dimensions.set({
    window: { width, height: 1024, scale: 2, fontScale: 1 },
    screen: { width, height: 1024, scale: 2, fontScale: 1 },
  });
  return render(<Layout />);
}

describe.each(LAYOUTS)('the %s tab layout', (kind, load) => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockEmit.mockClear();
  });

  it('draws no rail below the breakpoint', () => {
    const tree = at(sizes.railBreakpoint - 1, load());
    expect(findTabs(tree)).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'js-tabs-rail' })).toHaveLength(0);
  });

  it('draws the rail from the breakpoint up', () => {
    const tree = at(sizes.railBreakpoint, load());
    expect(findTabs(tree)).toHaveLength(5);
    expect(tree.root.findAllByProps({ testID: 'native-tabs' })).toHaveLength(0);
  });

  it('marks the focused route and routes a press through the navigator', () => {
    const tree = at(834, load());
    const tabs = findTabs(tree);
    const selected = tabs.filter((t) => t.props.accessibilityState?.selected === true);
    expect(selected).toHaveLength(1);
    expect(selected[0]!.props.accessibilityLabel).toBe('Entdecken');

    act(() => tabs[2]!.props.onPress());
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'tabPress', target: 'mediathek-key' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('mediathek', undefined);

    mockNavigate.mockClear();
    act(() => tabs[1]!.props.onPress());
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

/** Find all Tab-listeners in a rendered tree. */
const findTabs = (tree: ReturnType<typeof render>) =>
  tree.root.findAll(
    (node) => node.props?.accessibilityRole === 'tab' && typeof node.props?.onPress === 'function',
  );

describe('NavRail', () => {
  it('renders five tab triggers', () => {
    const tree = render(<NavRail active="index" onSelect={() => {}} insets={NO_INSETS} />);
    expect(findTabs(tree)).toHaveLength(5);
  });

  it('marks only the active tab as selected', () => {
    const tree = render(<NavRail active="entdecken" onSelect={() => {}} insets={NO_INSETS} />);
    const tabs = findTabs(tree);
    const selected = tabs.filter((t) => t.props.accessibilityState?.selected === true);
    expect(selected).toHaveLength(1);
  });

  it('includes the mini player at its bottom', () => {
    const tree = render(<NavRail active="index" onSelect={() => {}} insets={NO_INSETS} />);
    expect(tree.root.findAllByType(MiniPlayer)).toHaveLength(1);
  });
});
