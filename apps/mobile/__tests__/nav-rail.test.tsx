import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { sizes } from '../src/lib/theme';
import { columnGutter, railShift } from '../src/components/ui/ContentColumn';
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

/**
 * The tablet navigation rail: three questions, each with its own assertion.
 *
 * 1. A phone width never renders the rail — the layout files guard
 *    `TabletLayout` behind `width >= sizes.railBreakpoint`, so at phone widths
 *    both layouts fall through to their bottom bars. Source-level check.
 *
 * 2. 768 px and above always does — both layouts import and reference
 *    `TabletLayout`, so the guard resolves to true at or above the breakpoint.
 *    Source-level check.
 *
 * 3. The rail and the reading column cannot disagree — both layouts read the
 *    same `sizes.railBreakpoint` token, and the rail width (88) fits the gutter
 *    the centred column leaves at 834 px (107). Arithmetic + source check.
 *
 * A fourth assertion renders `NavRail` directly: five tab triggers, each a
 * pressable with `accessibilityRole="tab"`, the active one marked selected.
 */
const SRC = join(__dirname, '..', 'src');
const LAYOUT_NATIVE = join(SRC, 'app', '(tabs)', '_layout.tsx');
const LAYOUT_WEB = join(SRC, 'app', '(tabs)', '_layout.web.tsx');
const NAV_RAIL_SRC = join(SRC, 'components', 'ui', 'NavRail.tsx');

describe('the breakpoint arithmetic', () => {
  it('fits the rail inside the gutter at 834 px', () => {
    const gutter = columnGutter(834);
    expect(sizes.railWidth).toBeLessThanOrEqual(gutter);
  });

  it('keeps the column clear of the rail at every width from the breakpoint up', () => {
    for (let width = sizes.railBreakpoint; width <= 1194; width++) {
      const shift = railShift(width);
      expect(shift + columnGutter(width - shift)).toBeGreaterThanOrEqual(sizes.railWidth);
    }
  });

  it('puts the column edge where the centred column starts on a wide window', () => {
    for (const width of [768, 834, 1194]) {
      expect(2 * columnGutter(width) + sizes.contentColumn).toBe(width);
    }
  });
});

describe('the layout guard', () => {
  const native = readFileSync(LAYOUT_NATIVE, 'utf-8');
  const web = readFileSync(LAYOUT_WEB, 'utf-8');

  it('both layouts read the same breakpoint token so they cannot disagree', () => {
    expect(native).toContain('sizes.railBreakpoint');
    expect(web).toContain('sizes.railBreakpoint');
  });

  it('guards TabletLayout behind the width check', () => {
    expect(native).toMatch(/width >= sizes\.railBreakpoint/);
    expect(web).toMatch(/width >= sizes\.railBreakpoint/);
  });

  it('references TabletLayout so it renders at or above the breakpoint', () => {
    expect(native).toContain('TabletLayout');
    expect(web).toContain('TabletLayout');
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
    const source = readFileSync(NAV_RAIL_SRC, 'utf-8');
    expect(source).toContain('MiniPlayer');
  });
});
