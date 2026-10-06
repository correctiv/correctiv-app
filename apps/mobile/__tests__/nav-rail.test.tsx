import { Dimensions } from 'react-native';
import { act } from 'react-test-renderer';

import { sizes, spacingPx } from '../src/lib/theme';
import { columnGutter } from '../src/components/ui/ContentColumn';
import { MiniPlayer } from '../src/components/player/MiniPlayer';
import { NavRail } from '../src/components/ui/NavRail';
import { render } from './support/rendering';

/**
 * `Slot` stands for the screen the router has put in the shell, and `usePathname` for the
 * address it is on, which decides which tab is selected. A press is a router call, which
 * is what the layout does where the navigator used to be asked.
 */
const mockNavigate = jest.fn();
let mockPathname = '/s/entdecken';
jest.mock('expo-router', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    router: { push: jest.fn(), navigate: (href: string) => mockNavigate(href) },
    usePathname: () => mockPathname,
    Slot: () => react.createElement(View, { testID: 'screen' }),
  };
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
 * The shell, rendered at a phone width and a tablet width.
 *
 * At tablet width the tabs are the rail and a press reaches the router; at phone width they
 * are the drawn bottom bar, the same words and the same press. With no bar to draw (one
 * screen, or none) there is neither.
 */
function at(width: number) {
  Dimensions.set({
    window: { width, height: 1024, scale: 2, fontScale: 1 },
    screen: { width, height: 1024, scale: 2, fontScale: 1 },
  });
  const Layout = require('../src/app/(tabs)/_layout').default as React.ComponentType;
  return render(<Layout />);
}

describe('the tab layout', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPathname = '/s/entdecken';
  });

  it('draws the bottom bar below the breakpoint, and no rail', () => {
    const tree = at(sizes.railBreakpoint - 1);
    expect(tree.root.findAllByProps({ accessibilityRole: 'tablist' }).length).toBeGreaterThan(0);
    expect(findTabs(tree)).toHaveLength(5);
    expect(tree.root.findAllByType(NavRail)).toHaveLength(0);
  });

  it('draws the rail from the breakpoint up, and no bottom bar', () => {
    const tree = at(sizes.railBreakpoint);
    expect(findTabs(tree)).toHaveLength(5);
    expect(tree.root.findAllByType(NavRail)).toHaveLength(1);
    expect(tree.root.findAllByProps({ accessibilityRole: 'tablist' })).toHaveLength(0);
  });

  it.each([sizes.railBreakpoint - 1, sizes.railBreakpoint])(
    'marks the screen the address is on and sends a press to its address, at %i',
    (width) => {
      const tree = at(width);
      const tabs = findTabs(tree);
      const selected = tabs.filter((t) => t.props.accessibilityState?.selected === true);
      expect(selected).toHaveLength(1);
      expect(selected[0]!.props.accessibilityLabel).toBe('Entdecken');

      act(() => tabs[2]!.props.onPress());
      expect(mockNavigate).toHaveBeenCalledWith('/s/mediathek');

      mockNavigate.mockClear();
      act(() => tabs[1]!.props.onPress());
      expect(mockNavigate).not.toHaveBeenCalled();
    },
  );
});

/** Find all Tab-listeners in a rendered tree. */
const findTabs = (tree: ReturnType<typeof render>) =>
  tree.root.findAll(
    (node) => node.props?.accessibilityRole === 'tab' && typeof node.props?.onPress === 'function',
  );

describe('NavRail', () => {
  it('renders five tab triggers', () => {
    const tree = render(<NavRail active="home" onSelect={() => {}} insets={NO_INSETS} />);
    expect(findTabs(tree)).toHaveLength(5);
  });

  it('marks only the active tab as selected', () => {
    const tree = render(<NavRail active="entdecken" onSelect={() => {}} insets={NO_INSETS} />);
    const tabs = findTabs(tree);
    const selected = tabs.filter((t) => t.props.accessibilityState?.selected === true);
    expect(selected).toHaveLength(1);
  });

  it("draws each tab's label under its icon, and announces it once", () => {
    const tree = render(<NavRail active="home" onSelect={() => {}} insets={NO_INSETS} />);
    const labels = ['Home', 'Entdecken', 'Mediathek', 'Mitmachen', 'Profil'];
    const tabs = findTabs(tree);
    expect(tabs.map((t) => t.props.accessibilityLabel)).toEqual(labels);
    for (const [i, label] of labels.entries()) {
      const text = tabs[i]!.findAll(
        (n) => (n.type as unknown) === 'Text' && n.props.children === label,
      );
      expect(text).toHaveLength(1);
      expect(text[0]!.props.importantForAccessibility).toBe('no');
      expect(text[0]!.props.accessibilityElementsHidden).toBe(true);
      expect(text[0]!.props.numberOfLines).toBe(1);
    }
  });

  it('starts the first tab below the status bar, by the inset plus a spacing token', () => {
    const tree = render(
      <NavRail active="home" onSelect={() => {}} insets={{ ...NO_INSETS, top: 32, bottom: 20 }} />,
    );
    const rail = tree.root.findAll(
      (n) => n.props?.style?.width === sizes.railWidth && n.props.style.paddingTop !== undefined,
    )[0]!;
    expect(rail.props.style.paddingTop).toBe(32 + spacingPx.s);
    expect(rail.props.style.paddingBottom).toBe(20);
  });

  it('includes the mini player at its bottom', () => {
    const tree = render(<NavRail active="home" onSelect={() => {}} insets={NO_INSETS} />);
    expect(tree.root.findAllByType(MiniPlayer)).toHaveLength(1);
  });
});
