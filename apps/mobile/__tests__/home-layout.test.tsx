import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Home is a document now, and this is the pair of facts that keeps the document and the
 * app from parting ([ADR 0036](../../../adr/0036-the-home-screen-becomes-data.md),
 * [ADR 0039](../../../adr/0039-the-home-screen-is-a-day-not-a-timetable.md)).
 *
 * **Both directions, and the second one is the one a type cannot see.** A module in the
 * document with no renderer is caught at runtime — the parser drops the section and
 * reports it — so the screen survives it and nobody finds out. A renderer no section
 * names fails in no way at all: it is a block somebody wrote, wired up, and never saw on
 * a screen. Neither is a compile error, because the map is keyed by string on purpose:
 * §7 wants a fetched document to be readable when it is ahead of the app, which a closed
 * union of module names would make impossible.
 *
 * The shipped document is read off DISK rather than imported, so that this file is
 * asserting about the JSON a reviewer sees in the diff and not about whatever the module
 * graph happened to hand it.
 */

/**
 * Feeds do not decide anything here, but a section with no data renders no marker.
 *
 * Complete items, image and reading time included, because `useArticleMeta` fetches the
 * article page for whichever of the two a card is missing — an update after the test body
 * has ended, and the console noise a real warning would hide in.
 */
const ITEMS = Array.from({ length: 8 }, (_, i) => ({
  id: `item-${i}`,
  feed: 'recherchen' as const,
  title: `Recherche ${i}`,
  url: `https://correctiv.org/${i}`,
  teaser: 'Teaser',
  publishedAt: '2026-09-01T08:00:00.000Z',
  categories: [],
  imageUrl: `https://correctiv.org/${i}.jpg`,
  readingMinutes: 4,
}));

let mockFeed = { data: ITEMS, loading: false, offline: false, reload: jest.fn() };

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/lib/feeds/useFeed', () => ({
  useFeed: () => mockFeed,
}));

/**
 * Stubbed for the reason `home-timed.test.tsx` stubs them: both lazy-load on first use,
 * and a thunk that lands after the test body is an update outside `act`.
 */
jest.mock('@/lib/store/core', () => ({
  ...jest.requireActual<typeof import('@/lib/store/core')>('@/lib/store/core'),
  useSpotlight: () => ({ issues: [], status: 'idle', recent: [] }),
  useVideoChannel: () => ({ videos: [], status: 'idle', error: null }),
}));

import { act } from 'react-test-renderer';

import {
  MINUTES_IN_DAY,
  parseHomeLayout,
  sectionsAt,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';
import { readerOf } from '@correctiv/app-core/lib/home-audience';
import { sessionActions } from '@correctiv/app-core/stores/session';
import type { Entitlement } from '@correctiv/app-core/types/models';
import { HOME_MODULE_AUDIENCES, MODULE_CONDITIONS } from '@/lib/home/conditions';
import { MODULE_SCREENS } from '@/lib/home/screens';
import { HOME_MODULE_SETTINGS } from '@/lib/home/settings';
import { berlinInstant } from '@correctiv/app-core/lib/berlin-time';
import { resetStore } from '@correctiv/app-core/stores/store';

import { render, walkHostNodes } from './support/rendering';

import HomeScreen from '@/app/(tabs)/index';
import { HOME_MODULES, LIFTED_CALLOUT, placeTestID } from '@/lib/home/modules';
import { coreStore } from '@/lib/store/core';

const DOCUMENT_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'app-core',
  'src',
  'data',
  'home.layout.json',
);

const shipped = JSON.parse(readFileSync(DOCUMENT_PATH, 'utf8')) as unknown;
const parsed = parseHomeLayout(shipped);
const layout = parsed.layout as HomeLayout;

beforeEach(() => {
  mockFeed = { data: ITEMS, loading: false, offline: false, reload: jest.fn() };
  jest.clearAllMocks();
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the shipped home document', () => {
  it('reads cleanly, and says something', () => {
    expect(parsed.problems).toEqual([]);
    expect(layout.sections.length).toBeGreaterThan(5);
  });

  it('names a renderer this app holds for every section', () => {
    const missing = layout.sections.filter((section) => !(section.module in HOME_MODULES));
    expect(missing.map((section) => `${section.id} → ${section.module}`)).toEqual([]);
  });

  /*
   * There was a check here asserting the other direction: that the shipped document names
   * every renderer this app holds, so none is written and never drawn. It is retired by
   * ADR 0046 §1 and nothing is written to replace it, which is worth saying out loud,
   * because "we removed a test" is the shape of a mistake.
   *
   * It goes because **the condition it flagged stops being a fault.** Before the editor
   * could add a block, a module the document did not place was unreachable by anybody;
   * with a palette, it is a module waiting to be used, which is a state a newsroom will
   * create on purpose the first time it takes a block off the screen for a week.
   *
   * What the check was really about — a module nobody can reach — is covered by a
   * mechanism rather than by an assertion. The palette in
   * `apps/workbench/src/preview/home/Palette.tsx` is built from the modules themselves,
   * so a module added here appears in the editor without being listed a second time by
   * hand; ADR 0046 §1 is where that trade is argued in full.
   *
   * **It now reads `lib/home/screens.ts` to do it, so there IS a second list and the
   * sentence above used to say there was not.** ADR 0054 §2 made that trade on purpose: a
   * block says which screens it belongs on rather than having it read off the name of the
   * registry that holds it. What takes the place of absence is the pair of assertions
   * below, which fail in both directions, and that is one of ADR 0031's four rungs rather
   * than the thing all four are for. And
   * `apps/workbench/test/preview/home-document.test.ts` already fails on a module with no
   * entry in `MODULE_LABELS`, which is what stops one reaching a newsroom spelled
   * `faktencheck-rail`.
   */

  /** The spacing of the lifted callout hangs off this id; `modules.tsx` says why. */
  it('still carries the lifted callout under the id the renderer keys on', () => {
    expect(layout.sections.map((section) => section.id)).toContain(LIFTED_CALLOUT);
  });

  /**
   * The property the two callout sections exist to hold, and the one a document cannot
   * express: at no minute of the day are both of them shown, and at none are neither.
   * Two moments switching the same card between two places is exactly the shape that
   * produces a duplicate when one of them is later moved, and a duplicated teaser on
   * Home is not something a type checks.
   */
  it('shows the callout exactly once at every minute of the day', () => {
    for (let minute = 0; minute < MINUTES_IN_DAY; minute += 7) {
      const shown = sectionsAt(layout, minute, readerOf(null)).filter(
        (section) => section.module === 'callout-teaser',
      );
      expect({ minute, count: shown.length }).toEqual({ minute, count: 1 });
    }
  });

  /**
   * The declarations are keyed by a string, because typing them against `HOME_MODULES`
   * would mean importing the React Native tree into a file Node has to be able to read
   * (ADR 0045 §9). So nothing but this holds the two together: a module with a setting
   * declared and no renderer here is a configuration surface for a block that does not
   * exist.
   */
  it('can draw every module a setting is declared for', () => {
    const undrawable = Object.keys(HOME_MODULE_SETTINGS).filter(
      (module) => !(module in HOME_MODULES),
    );
    expect(undrawable).toEqual([]);
  });

  /**
   * The two halves of ADR 0054 §2, and they are why that record could give the palette a
   * second list to read without giving it a list that can fall behind.
   *
   * The first half is the one a type cannot see. Every module has to say where it
   * belongs, so a block written and never declared is a block the editor offers on no
   * screen at all — which would look exactly like the module having been forgotten, and
   * is the failure the declaration exists to make loud.
   */
  it('has every module declare at least one screen', () => {
    const undeclared = Object.keys(HOME_MODULES).filter(
      (module) => (MODULE_SCREENS[module]?.length ?? 0) === 0,
    );
    expect(undeclared).toEqual([]);
  });

  /** And the other direction: a declaration for a block this app cannot draw. */
  it('declares screens only for modules it can draw', () => {
    const undrawable = Object.keys(MODULE_SCREENS).filter((module) => !(module in HOME_MODULES));
    expect(undrawable).toEqual([]);
  });

  /**
   * ADR 0060 §1, held the way ADR 0054 §2 holds the screens. Every block says when it
   * appears, and `null` is an answer rather than an absence: a block nobody asked would
   * otherwise read the same as one that always draws, and the configurator would say
   * nothing about why it is empty.
   *
   * What this cannot hold is that the name is TRUE. It is a name for a rule written in the
   * module's code, and nothing reads the one against the other; see `conditions.ts`.
   */
  it('has every module declare its own condition, or say it has none', () => {
    const undeclared = Object.keys(HOME_MODULES).filter(
      (module) => !Object.hasOwn(MODULE_CONDITIONS, module),
    );
    expect(undeclared).toEqual([]);
  });

  it('declares conditions and default audiences only for modules it can draw', () => {
    const conditioned = Object.keys(MODULE_CONDITIONS).filter(
      (module) => !(module in HOME_MODULES),
    );
    const audienced = Object.keys(HOME_MODULE_AUDIENCES).filter(
      (module) => !(module in HOME_MODULES),
    );
    expect([...conditioned, ...audienced]).toEqual([]);
  });
});

/**
 * Berlin wall clock, which is the only clock the home document reads since ADR 0059 §6.
 * Built from the core's own conversion so the test means the same hour on a laptop in
 * Berlin and on a CI runner in UTC, which the device-local `new Date(y, m, d, h)` it
 * replaces did not.
 */
const at = (hour: number) => new Date(berlinInstant('2026-09-03', hour * 60)!);

/**
 * The hours worth drawing at, and why each one.
 *
 * Not "every daypart" any more, because there are no dayparts: what the document has is
 * two moments, so the interesting hours are one before the first, one between them and
 * one after the last. The fourth is the small hours, which used to be a named daypart
 * and is now simply the same state as the evening — asserted rather than assumed.
 */
const HOURS = [3, 7, 12, 19];

/** Taken from the renderer's own helper, so a change to the addressing is one edit. */
const PLACE_PREFIX = placeTestID('');

/** The section ids the tree actually carries, top to bottom. */
function renderedPlaces(tree: ReturnType<typeof render>): string[] {
  const ids: string[] = [];
  walkHostNodes(tree, {
    onEnter: (node) => {
      const testID = node.props.testID;
      if (typeof testID === 'string' && testID.startsWith(PLACE_PREFIX)) {
        ids.push(testID.slice(PLACE_PREFIX.length));
      }
    },
  });
  return ids;
}

function renderAt(hour: number) {
  jest.useFakeTimers().setSystemTime(at(hour));
  return render(<HomeScreen />);
}

describe('what Home draws', () => {
  /**
   * The order is the document's and the screen adds none of its own, so this walks the
   * tree and compares. A section that has nothing to show renders nothing at all — the
   * feed status with a feed that is neither loading nor offline is the one here — so the
   * assertion is "a subsequence, in order" rather than "equal", and the count below is
   * what stops that weaker claim passing on an empty screen.
   */
  it.each(HOURS.map((hour) => [hour]))(
    'draws the sections of %i:00 in the document order',
    (hour) => {
      // Nobody is signed in after `resetStore`, so this is the day for a reader in no
      // audience but everyone's, and the early-access card is not in it (ADR 0060 §2).
      const wanted = sectionsAt(layout, hour * 60, readerOf(null)).map((section) => section.id);
      const drawn = renderedPlaces(renderAt(hour));

      expect(drawn).toEqual(wanted.filter((id) => drawn.includes(id)));
      // Everything but the feed status, which has nothing to say about a loaded feed.
      expect(drawn).toEqual(wanted.filter((id) => id !== 'feed-status'));
    },
  );

  it('draws the feed status when the articles came out of the bundle', () => {
    mockFeed = { ...mockFeed, offline: true };
    expect(renderedPlaces(renderAt(12))).toContain('feed-status');
  });

  it('puts the callout above the hero at lunchtime and below the rest otherwise', () => {
    const midday = renderedPlaces(renderAt(12));
    expect(midday.indexOf(LIFTED_CALLOUT)).toBeLessThan(midday.indexOf('hero'));

    const evening = renderedPlaces(renderAt(19));
    expect(evening).not.toContain(LIFTED_CALLOUT);
    expect(evening.indexOf('callout')).toBeGreaterThan(evening.indexOf('hero'));
  });

  /**
   * The reader is the session's, and the same document draws two screens (ADR 0060 §4).
   * The early-access card is for paying members by its module's default; a reader in by a
   * local newsletter at the 0 € tier does not get it, and nothing else on Home moves.
   */
  it('draws the early-access card for a paying member and not for a free one', () => {
    const signIn = (entitlement: Entitlement) =>
      act(() => {
        coreStore.dispatch(
          sessionActions.succeeded({
            account: { email: 'a@example.org', name: 'A' },
            entitlement,
          }),
        );
      });
    const base: Entitlement = {
      tier: 'paid',
      appAccess: true,
      source: 'paid',
      validUntil: null,
      localAreas: [],
      memberSince: null,
    };

    signIn(base);
    const paying = renderedPlaces(renderAt(9));
    signIn({ ...base, tier: 'free', source: 'local-bundle' });
    const free = renderedPlaces(renderAt(9));

    expect(paying).toContain('early-access');
    expect(free).not.toContain('early-access');
    expect(paying.filter((id) => id !== 'early-access')).toEqual(free);
  });

  it('draws every place exactly once', () => {
    const drawn = renderedPlaces(renderAt(12));
    expect([...new Set(drawn)]).toEqual(drawn);
  });
});
