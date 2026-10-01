import { act } from 'react-test-renderer';

/**
 * The seam that lets the workbench say what time Home thinks it is.
 *
 * [ADR 0039](../../../adr/0039-the-home-screen-is-a-day-not-a-timetable.md) §8: the
 * minute is a parameter of the core's selector, so the whole question lives in one file
 * in this host, and that file has one door — `workbench:home-time` in `localStorage`.
 * The editor cannot be built without it: the preview has to show the evening at eleven
 * in the morning, or an editor arranging a day is arranging it blind.
 *
 * **What is worth a test here is exactly what a reader of the code cannot check.** That
 * the key moves the screen is one half; the other, and the one that would be a defect
 * nobody notices, is that a value which is not a time of day leaves the clock alone.
 * A junk key that froze Home at some minute would look like a broken app and read like
 * a broken feed.
 *
 * It is a file of its own because it installs a `localStorage` on `window`, which the
 * React Native test environment has not got, and because `home-timed.test.tsx` next door
 * is about the real clock.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

/** No network on Home; the same stubs and the same reasons as `home-timed.test.tsx`. */
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
import { sessionActions } from '@correctiv/app-core/stores/session';
import { resetStore } from '@correctiv/app-core/stores/store';

import { findAllPressable, render, renderedText } from './support/rendering';

import HomeScreen from '@/app/(tabs)/index';
import { HOME_TIME_OVERRIDE_KEY } from '@/lib/home/clock';
import { coreStore } from '@/lib/store/core';

const OPEN = callouts.find((entry) => entry.status === 'open')!;

/**
 * The smallest `localStorage` the guard in `clock.ts` will accept, on `window`, which
 * the test environment leaves undefined.
 *
 * Defined rather than mocked: the file reads `window.localStorage.getItem` and listens
 * for `storage` events, and a double that answered differently from a browser would be
 * testing the double.
 */
const store = new Map<string, string>();

/**
 * And the two listener functions, because the React Native environment has a `window`
 * with neither a storage nor an event target on it.
 *
 * The subscription is what makes the frame follow a drag along the timeline, and it is
 * guarded — `clock.ts` answers with a no-op unsubscribe where `addEventListener` is
 * missing — so a test that left these out would silently be testing the no-op.
 */
const listeners = new Set<(event: { key: string | null }) => void>();

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  });
  Object.defineProperty(window, 'addEventListener', {
    configurable: true,
    value: (type: string, listener: (event: { key: string | null }) => void) => {
      if (type === 'storage') listeners.add(listener);
    },
  });
  Object.defineProperty(window, 'removeEventListener', {
    configurable: true,
    value: (type: string, listener: (event: { key: string | null }) => void) => {
      if (type === 'storage') listeners.delete(listener);
    },
  });
});

beforeEach(() => {
  store.clear();
  listeners.clear();
  jest.clearAllMocks();
  act(() => {
    coreStore.dispatch(resetStore());
    // A paying member, because the early-access card these tests anchor on is for paying
    // members by its module's default (ADR 0060 §2) and nobody is signed in after a reset.
    coreStore.dispatch(
      sessionActions.succeeded({
        account: { email: 'a@example.org', name: 'A' },
        entitlement: {
          tier: 'paid',
          appAccess: true,
          source: 'paid',
          validUntil: null,
          localAreas: [],
          memberSince: null,
        },
      }),
    );
  });
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * Nine in the morning in Berlin, which is before the shipped document's first moment.
 * Berlin rather than the device's zone, because that is the document's clock (ADR 0059 §6).
 */
const NINE = new Date(berlinInstant('2026-09-03', 9 * 60)!);

/**
 * Where the callout sits, anchored on the early-access card between the two positions.
 *
 * The same reading `home-timed.test.tsx` uses and for the reason it gives there: an
 * anchor that never renders makes both `indexOf` calls agree on −1 and the test pass for
 * the wrong reason.
 */
function position(tree: ReturnType<typeof render>): 'top' | 'in-place' {
  const text = JSON.stringify(tree.toJSON());
  const anchor = text.indexOf('exklusiv vorab');
  const teaser = text.indexOf(OPEN.title);
  expect(anchor).toBeGreaterThan(-1);
  expect(teaser).toBeGreaterThan(-1);
  return teaser < anchor ? 'top' : 'in-place';
}

function renderAtNine() {
  jest.useFakeTimers().setSystemTime(NINE);
  return render(<HomeScreen />);
}

describe('a simulated time in storage', () => {
  it('is absent by default, and the screen is on the machine’s clock', () => {
    expect(position(renderAtNine())).toBe('in-place');
  });

  it('moves the screen to another hour of the same document', () => {
    store.set(HOME_TIME_OVERRIDE_KEY, '12:00');
    expect(position(renderAtNine())).toBe('top');
  });

  /**
   * ADR 0059 §8: the key takes a Berlin date and time as well, which is how the editor shows
   * a Saturday on a Wednesday. The same document's midday on another day is the same
   * midday, which is what this can see without a document of its own; an edition on that
   * day is the core's fold and `packages/app-core/test/home-layout.test.ts` asserts it.
   */
  it('takes a date and a time as well as a bare time', () => {
    store.set(HOME_TIME_OVERRIDE_KEY, '2026-09-27T12:00');
    expect(position(renderAtNine())).toBe('top');
    store.set(HOME_TIME_OVERRIDE_KEY, '2026-09-27T09:00');
    expect(position(renderAtNine())).toBe('in-place');
  });

  it('draws the callout exactly once at the simulated hour, as at any other', () => {
    store.set(HOME_TIME_OVERRIDE_KEY, '12:00');
    expect(findAllPressable(renderAtNine(), OPEN.title)).toHaveLength(1);
  });

  /**
   * The half that would otherwise be a defect nobody notices. Every one of these is a
   * value somebody could leave in the key by hand or by a half-written tool, and the
   * answer to all of them is the same: nobody has said what time it is, so the clock
   * stands.
   */
  it.each([
    ['midday'],
    ['9:00'],
    ['24:00'],
    ['12:60'],
    [''],
    ['1200'],
    ['2026-02-30T12:00'],
    ['2026-09-03 12:00'],
    ['2026-09-03T12:00Z'],
  ])('ignores %p and leaves the clock alone', (junk) => {
    store.set(HOME_TIME_OVERRIDE_KEY, junk);
    expect(position(renderAtNine())).toBe('in-place');
  });

  /**
   * A screen already on the phone redraws rather than waiting for a reload.
   *
   * The browser fires `storage` in every same-origin document except the one that wrote,
   * so this is the event the app actually receives from the workbench, and dragging
   * along the timeline is exactly this event arriving repeatedly.
   */
  it('redraws a mounted screen when the key changes under it', () => {
    const tree = renderAtNine();
    expect(position(tree)).toBe('in-place');

    expect(listeners.size).toBeGreaterThan(0);
    act(() => {
      store.set(HOME_TIME_OVERRIDE_KEY, '12:00');
      for (const listener of listeners) listener({ key: HOME_TIME_OVERRIDE_KEY });
    });

    expect(position(tree)).toBe('top');
  });

  /**
   * The header used to read `new Date()` on its own, so the simulated instant moved the
   * sections but left the masthead on the machine's real date — one screen, two days
   * (#254). `HomeHeader` now takes the same instant `useHomeInstant` hands the fold.
   */
  it('moves the header’s date along with the rest of the screen', () => {
    store.set(HOME_TIME_OVERRIDE_KEY, '2026-12-25T10:00');
    const text = renderedText(renderAtNine());
    expect(text).toContain('Freitag, 25. Dezember 2026');
    expect(text).not.toContain('Donnerstag, 3. September 2026');
  });
});
