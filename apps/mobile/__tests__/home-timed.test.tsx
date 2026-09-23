import { act } from 'react-test-renderer';

/**
 * The one block on Home that moves with the clock, seen from the screen.
 *
 * The requirements ask for modules "pushed to the top of the home screen between
 * certain hours, after they drop into the chronological feed". The times are the
 * document's moments and are covered in `packages/app-core/test/home-layout.test.ts`,
 * the document's two callout sections in `home-layout.test.tsx`; what is worth pinning
 * HERE is the one thing neither of those can see, and it is the last test in this file:
 * that the screen moves the card when the clock reaches a moment and nothing else
 * happens.
 *
 * The rest reads the rendered card rather than a section id, so it is also the check
 * that the document's two positions are two positions on a screen and not two entries in
 * a list.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

/**
 * No network on Home: the feeds are not what this file is about. The Spotlight and
 * video hooks are stubbed for the same reason, and for one more: both lazy-load on
 * first use, and a thunk that lands after the test body is an update outside `act`,
 * fifty of them per run. That much console noise is where a real warning goes to hide.
 */
jest.mock('@/lib/feeds/useFeed', () => ({
  useFeed: () => ({ data: undefined, loading: false, offline: false, reload: jest.fn() }),
}));
jest.mock('@/lib/store/core', () => ({
  ...jest.requireActual<typeof import('@/lib/store/core')>('@/lib/store/core'),
  useSpotlight: () => ({ issues: [], status: 'idle', recent: [] }),
  useVideoChannel: () => ({ videos: [], status: 'idle', error: null }),
}));

import { callouts } from '@correctiv/app-core/data/callouts';
import { berlinInstant } from '@correctiv/app-core/lib/berlin-time';
import { resetStore } from '@correctiv/app-core/stores/store';

import { findAllPressable, render } from './support/rendering';

import HomeScreen from '@/app/(tabs)/index';
import { coreStore } from '@/lib/store/core';

const OPEN = callouts.find((entry) => entry.status === 'open')!;

/**
 * Berlin wall clock, which is the only clock the home document reads since ADR 0059 §6.
 * Built from the core's own conversion so the test means the same hour on a laptop in
 * Berlin and on a CI runner in UTC, which the device-local `new Date(y, m, d, h)` it
 * replaces did not.
 */
const at = (hour: number, minute = 0) => new Date(berlinInstant('2026-09-03', hour * 60 + minute)!);

beforeEach(() => {
  jest.clearAllMocks();
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

afterEach(() => {
  jest.useRealTimers();
});

function renderAt(hour: number) {
  jest.useFakeTimers().setSystemTime(at(hour));
  return render(<HomeScreen />);
}

/** The teaser's own pressable carries the callout's title, so it can be counted. */
const teasers = (tree: ReturnType<typeof render>) => findAllPressable(tree, OPEN.title);

describe('the callout on Home', () => {
  it('is rendered exactly once at lunchtime', () => {
    expect(teasers(renderAt(12))).toHaveLength(1);
  });

  it('is rendered exactly once outside the lunchtime window', () => {
    expect(teasers(renderAt(20))).toHaveLength(1);
  });

  /**
   * And it is in a different place. Anchored on the early-access card, which renders
   * unconditionally and sits between the two positions, rather than on a feed section
   * that is absent when the feeds are: an anchor that never renders makes both indexOf
   * calls agree on -1 and the test pass for the wrong reason. It did, before this
   * comment. Both indexes are asserted found for the same reason.
   */
  const position = (tree: ReturnType<typeof render>) => {
    const text = JSON.stringify(tree.toJSON());
    const anchor = text.indexOf('exklusiv vorab');
    const teaser = text.indexOf(OPEN.title);
    expect(anchor).toBeGreaterThan(-1);
    expect(teaser).toBeGreaterThan(-1);
    return teaser < anchor ? 'top' : 'in-place';
  };

  it('sits above the rest of the page at lunchtime and below it otherwise', () => {
    expect(position(renderAt(12))).toBe('top');
    expect(position(renderAt(20))).toBe('in-place');
  });

  /**
   * Nothing else re-renders Home on the hour: a tab screen stays mounted, and a feed
   * landing or a pull to refresh is not a clock. So the screen owns one timer to the
   * document's next change (`useHomeInstant`), and this is the test that it fires.
   * Rendered a minute before the 11:00 moment, then the clock moves and nothing else
   * does.
   */
  it('moves when the clock reaches a moment, with nothing else happening', () => {
    jest.useFakeTimers().setSystemTime(at(10, 59));
    const tree = render(<HomeScreen />);
    expect(position(tree)).toBe('in-place');

    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    expect(position(tree)).toBe('top');
    expect(teasers(tree)).toHaveLength(1);
  });
});
