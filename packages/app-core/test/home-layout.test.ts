import { afterEach, describe, expect, it } from 'vitest';

import { berlinInstant } from '../src/lib/berlin-time';
import {
  changesAt,
  DEFAULT_HOME_LAYOUT,
  editionPointAt,
  editionsAt,
  formatTimeOfDay,
  HOME_LAYOUT_VERSION,
  homeLayoutDocument,
  minuteOfDay,
  nextChangeAfter,
  parseHomeLayout,
  parseTimeOfDay,
  reportLayoutProblems,
  sectionsAt,
  sectionsAtInstant,
  stateAt,
  stateAtInstant,
  type HomeLayout,
  type LayoutProblemCode,
} from '../src/lib/home-layout';
import * as v2 from './__fixtures__/home-layout-v2';
import { readerOf } from '../src/lib/home-audience';
import type { ErrorReport } from '../src/ports';
import { configurePlatform, createMemoryPlatform, resetPlatform } from '../src/ports';

/**
 * A reader in no audience but everyone's, which is every document written before ADR 0060
 * read by anybody: a change naming no audience is for this reader and every other.
 */
const ANYONE = readerOf(null);

/** A member with a contribution, which is who the door lets in on an ordinary sign-in. */
const MEMBER = readerOf({
  tier: 'paid',
  appAccess: true,
  source: 'paid',
  validUntil: null,
  localAreas: [],
  memberSince: null,
});

/**
 * The home screen's document, and what happens to one the app cannot fully read.
 *
 * Two halves. One is the MODEL — that rendering at a time is the fold of the moments up
 * to it, that a moment carrying no change is indistinguishable from its absence, that a
 * change inherits what it does not mention. Those are the properties ADR 0039 is an
 * argument for, and a change that broke one of them would still parse, still typecheck
 * and still draw a plausible home screen.
 *
 * The other is every assertion about a BAD document. A good one is checked by the app's
 * own suite as well, where it has to agree with a map of renderers; here the question is
 * only whether a fault costs one part of the document or the whole of it.
 *
 * The codes are typed on the way out (`LayoutProblemCode`), so a renamed code fails to
 * compile here rather than turning an assertion vacuous.
 */

/** Only the codes, in order — the context is asserted where it carries something. */
const codes = (parse: { problems: readonly { code: LayoutProblemCode }[] }): string[] =>
  parse.problems.map((problem) => problem.code);

const section = (over: Record<string, unknown> = {}) => ({ id: 'hero', module: 'a', ...over });
const document = (sections: unknown[], over: Record<string, unknown> = {}) => ({
  version: HOME_LAYOUT_VERSION,
  sections,
  ...over,
});

/** A parse that is expected to be clean, as a layout, so a test can fold it. */
function read(input: unknown): HomeLayout {
  const parse = parseHomeLayout(input);
  expect(parse.problems).toEqual([]);
  expect(parse.layout).not.toBeNull();
  return parse.layout!;
}

const AT = (hours: number, minutes = 0) => hours * 60 + minutes;

describe('the bundled document', () => {
  it('parses with nothing left over', () => {
    const parse = parseHomeLayout(homeLayoutDocument);
    expect(parse.problems).toEqual([]);
    expect(parse.layout).not.toBeNull();
  });

  /**
   * `DEFAULT_HOME_LAYOUT` is the fallback every caller writes `?? DEFAULT_HOME_LAYOUT`
   * against, and a fallback that is an empty screen is worse than the fault it catches.
   * The module cannot throw when its own document is broken — nothing here throws — so
   * this is what says it is not.
   */
  it('is what DEFAULT_HOME_LAYOUT holds, and it is not empty', () => {
    expect(DEFAULT_HOME_LAYOUT.version).toBe(HOME_LAYOUT_VERSION);
    expect(DEFAULT_HOME_LAYOUT.sections.length).toBeGreaterThan(0);
  });

  it('gives every section an id of its own', () => {
    const ids = DEFAULT_HOME_LAYOUT.sections.map((s) => s.id);
    expect([...new Set(ids)]).toEqual(ids);
  });

  /**
   * The behaviour the dayparts used to produce, kept across the change that removed
   * them.
   *
   * ADR 0039 §5 claims the four named hours expressed exactly two changes in this
   * document: the callout is lifted over the lead at midday and drops back afterwards.
   * That claim is the whole argument for deleting a concept, so it is asserted against
   * the shipped file rather than left in prose — and it is what would notice somebody
   * moving a moment while believing they were tidying.
   */
  it('lifts the callout over the lead between 11:00 and 14:00, and nowhere else', () => {
    const lifted = (minute: number) =>
      sectionsAt(DEFAULT_HOME_LAYOUT, minute, ANYONE)
        .map((s) => s.id)
        .includes('callout-lifted');

    expect([AT(0), AT(9), AT(10, 59), AT(14), AT(18), AT(23, 59)].map(lifted)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect([AT(11), AT(12, 30), AT(13, 59)].map(lifted)).toEqual([true, true, true]);
  });

  it('shows the callout exactly once at every minute of the day', () => {
    for (let minute = 0; minute < 24 * 60; minute += 7) {
      const callouts = sectionsAt(DEFAULT_HOME_LAYOUT, minute, ANYONE).filter(
        (s) => s.module === 'callout-teaser',
      );
      expect({ minute, count: callouts.length }).toEqual({ minute, count: 1 });
    }
  });
});

describe('a time of day, as the document writes it', () => {
  it.each([
    ['00:00', 0],
    ['05:30', 330],
    ['11:00', 660],
    ['23:59', 1439],
  ])('reads %s', (text, minute) => {
    expect(parseTimeOfDay(text)).toBe(minute);
    expect(formatTimeOfDay(minute)).toBe(text);
  });

  it.each([
    ['a single-digit hour', '9:30'],
    ['a single-digit minute', '09:5'],
    ['no separator', '0930'],
    ['an hour that is not one', '24:00'],
    ['a minute that is not one', '09:60'],
    ['a number', 930],
    ['nothing', null],
  ])('refuses %s', (_name, value) => {
    expect(parseTimeOfDay(value)).toBeNull();
  });

  /**
   * Berlin's, since ADR 0059 §6, and asserted from UTC so that the answer cannot depend on
   * the zone of the machine running the test: 16:42 UTC in September is 18:42 in Berlin,
   * and in January 17:42.
   */
  it('reads the clock as a minute of the BERLIN day, wherever the clock is', () => {
    expect(minuteOfDay(Date.UTC(2026, 8, 3, 16, 42))).toBe(AT(18, 42));
    expect(minuteOfDay(new Date(Date.UTC(2026, 0, 3, 16, 42)))).toBe(AT(17, 42));
  });
});

describe('the fold, which is the whole model', () => {
  const day = {
    version: HOME_LAYOUT_VERSION,
    sections: [
      { id: 'header', module: 'home-header' },
      { id: 'hero', module: 'article-hero', settings: { pin: 'https://example.org/a' } },
      { id: 'lifted', module: 'callout-teaser', hidden: true },
      { id: 'rail', module: 'faktencheck-rail', settings: { count: 4 } },
    ],
    moments: [
      {
        at: '11:00',
        changes: [
          { id: 'lifted', hidden: false },
          { id: 'rail', settings: { count: 8 } },
        ],
      },
      { at: '14:00', changes: [{ id: 'lifted', hidden: true }] },
      { at: '18:00', changes: [{ id: 'hero', settings: { pin: null } }] },
    ],
  };

  const layout = () => read(day);

  it('is the sections as written before the first moment', () => {
    expect(stateAt(layout(), AT(9), ANYONE)).toEqual(layout().sections);
  });

  /** The property the editor's whole per-moment view rests on. */
  it('applies every moment at or before the minute, and no later one', () => {
    const at = (minute: number) =>
      Object.fromEntries(
        stateAt(layout(), minute, ANYONE).map((s) => [
          s.id,
          { hidden: Boolean(s.hidden), ...s.settings },
        ]),
      );

    expect(at(AT(10, 59)).lifted).toEqual({ hidden: true });
    expect(at(AT(11)).lifted).toEqual({ hidden: false });
    expect(at(AT(13, 59)).lifted).toEqual({ hidden: false });
    expect(at(AT(14)).lifted).toEqual({ hidden: true });
  });

  /**
   * A change says only what differs, so everything it does not mention is carried.
   *
   * The 11:00 moment sets the rail's count and says nothing about the hero's pin; the
   * hero still has it. That is inheritance, and it is not implemented anywhere — it is
   * what folding a list of partial changes does.
   */
  it('carries what a change does not mention', () => {
    const noon = stateAt(layout(), AT(12), ANYONE);
    expect(noon.find((s) => s.id === 'hero')?.settings).toEqual({ pin: 'https://example.org/a' });
    expect(noon.find((s) => s.id === 'rail')?.settings).toEqual({ count: 8 });
  });

  it('merges settings key by key rather than replacing the object', () => {
    const merged = read({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'rail', module: 'faktencheck-rail', settings: { count: 4 } }],
      moments: [{ at: '09:00', changes: [{ id: 'rail', settings: { count: 9 } }] }],
    });
    expect(stateAt(merged, AT(9), ANYONE)[0]?.settings).toEqual({ count: 9 });
  });

  /**
   * `null` is a value and not an absence, which is what lets a later moment take a pin
   * off again — ADR 0036 §3's "no override, so the rule runs", said at six in the
   * evening rather than for the whole day.
   */
  it('lets a later moment put a setting back to the rule', () => {
    expect(stateAt(layout(), AT(18), ANYONE).find((s) => s.id === 'hero')?.settings).toEqual({
      pin: null,
    });
  });

  /**
   * The property that makes a moment worth being a thing at all: it is defined by what
   * it carries, so one carrying nothing is not a state of the screen.
   */
  it('renders a moment with no changes exactly as its absence', () => {
    const without = read({ version: HOME_LAYOUT_VERSION, sections: day.sections, moments: [] });
    const withEmpty = read({
      version: HOME_LAYOUT_VERSION,
      sections: day.sections,
      moments: [{ at: '07:00', changes: [] }, { at: '19:00' }],
    });

    for (const minute of [AT(0), AT(6, 59), AT(7), AT(12), AT(19), AT(23, 59)]) {
      expect(stateAt(withEmpty, minute, ANYONE)).toEqual(stateAt(without, minute, ANYONE));
    }
  });

  it('keeps the document order, whatever the moments did', () => {
    expect(sectionsAt(layout(), AT(12), ANYONE).map((s) => s.id)).toEqual([
      'header',
      'hero',
      'lifted',
      'rail',
    ]);
  });

  it('drops what is hidden at that minute and nothing else', () => {
    expect(sectionsAt(layout(), AT(9), ANYONE).map((s) => s.id)).toEqual([
      'header',
      'hero',
      'rail',
    ]);
  });

  /**
   * The order moments are WRITTEN in carries no meaning, so a document that lists them
   * backwards is the same document. That is why the parser sorts rather than complains.
   */
  it('reads moments written out of order as the same day', () => {
    const backwards = read({
      version: HOME_LAYOUT_VERSION,
      sections: day.sections,
      moments: [...day.moments].reverse(),
    });
    for (const minute of [AT(9), AT(11), AT(14), AT(18), AT(23)]) {
      expect(stateAt(backwards, minute, ANYONE)).toEqual(stateAt(layout(), minute, ANYONE));
    }
  });

  /**
   * `HomeLayout['moments']` says "in time order" in a comment, and nothing but the
   * parser and the editor keep that true — the type does not, so a value built by hand,
   * past both of them, is not sorted just because every other caller's is. `stateAt` used
   * to trust it anyway: `if (moment.minute > minute) break;` stops at the first moment
   * later than the instant, which is only the LAST qualifying one when the array happens
   * to be sorted. Out of order, it stops before the array's first entry and everything
   * after it — including a moment that has already happened — is silently never applied.
   * `continue` costs a full scan instead of an early exit, which is nothing over a day's
   * dozen or so moments.
   */
  it('does not assume the moments are in time order', () => {
    const unsorted: HomeLayout = {
      version: HOME_LAYOUT_VERSION,
      sections: [
        { id: 'a', module: 'x' },
        { id: 'b', module: 'x' },
      ],
      // Written 14:00 before 11:00: a moment already past (11:00) sits AFTER one still to
      // come (14:00) in the array.
      moments: [
        { at: '14:00', minute: AT(14), changes: [{ id: 'a', hidden: true }] },
        { at: '11:00', minute: AT(11), changes: [{ id: 'b', hidden: true }] },
      ],
      editions: [],
    };

    // Noon: 11:00 has happened, 14:00 has not. 'b' is hidden, 'a' is not.
    const noon = stateAt(unsorted, AT(12), ANYONE);
    expect(noon.find((s) => s.id === 'b')?.hidden).toBe(true);
    expect(noon.find((s) => s.id === 'a')?.hidden).toBeFalsy();
  });

  /** `changesAt`, which `sectionsAtInstant` folds through, has the identical `break`. */
  it('does not assume the moments are in time order, folding by instant either', () => {
    const unsorted: HomeLayout = {
      version: HOME_LAYOUT_VERSION,
      sections: [
        { id: 'a', module: 'x' },
        { id: 'b', module: 'x' },
      ],
      moments: [
        { at: '14:00', minute: AT(14), changes: [{ id: 'a', hidden: true }] },
        { at: '11:00', minute: AT(11), changes: [{ id: 'b', hidden: true }] },
      ],
      editions: [],
    };

    const noon = berlinInstant('2026-09-27', AT(12))!;
    expect(sectionsAtInstant(unsorted, noon, ANYONE).map((s) => s.id)).toEqual(['a']);
  });

  /**
   * `continue` fixed the FILTER — a moment past the minute no longer stops the scan — but
   * it applies whatever qualifies in ARRAY order, and two moments on the SAME section is
   * where that shows. "Later wins" (`applyChange`'s own comment, and `stateAt`'s above) is
   * a claim about MINUTE order, and an unsorted array applied in its own order gets it
   * backwards: the moment that is earlier in the array, not the one later in the day,
   * would be what stands.
   */
  it('applies two moments on the same section by minute, not by array position', () => {
    const unsorted: HomeLayout = {
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'rail', module: 'faktencheck-rail', settings: { count: 4 } }],
      // 15:00 written before 11:00, and both touch `rail`.
      moments: [
        { at: '15:00', minute: AT(15), changes: [{ id: 'rail', settings: { count: 2 } }] },
        { at: '11:00', minute: AT(11), changes: [{ id: 'rail', settings: { count: 9 } }] },
      ],
      editions: [],
    };

    // 15:00 is chronologically later, so its value stands at 20:00 — whichever order the
    // array holds the two moments in.
    expect(stateAt(unsorted, AT(20), ANYONE).find((s) => s.id === 'rail')?.settings).toEqual({
      count: 2,
    });
  });

  /** The same conflict, folding by instant through `changesAt` and `stateAtInstant`. */
  it('applies two moments on the same section by minute, folding by instant too', () => {
    const unsorted: HomeLayout = {
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'rail', module: 'faktencheck-rail', settings: { count: 4 } }],
      moments: [
        { at: '15:00', minute: AT(15), changes: [{ id: 'rail', settings: { count: 2 } }] },
        { at: '11:00', minute: AT(11), changes: [{ id: 'rail', settings: { count: 9 } }] },
      ],
      editions: [],
    };

    const evening = berlinInstant('2026-09-27', AT(20))!;
    expect(
      stateAtInstant(unsorted, evening, ANYONE).find((s) => s.id === 'rail')?.settings,
    ).toEqual({ count: 2 });
  });
});

/** A Berlin wall-clock instant, which is how every test below names a time. */
const BERLIN = (date: string, hours: number, minutes = 0) =>
  berlinInstant(date, hours * 60 + minutes)!;

describe('nextChangeAfter, which is what a host sets a timer to', () => {
  const layout = () =>
    read({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'a', module: 'x' }],
      moments: [
        { at: '11:00', changes: [] },
        { at: '14:00', changes: [] },
      ],
    });

  it('answers with the next moment today', () => {
    expect(nextChangeAfter(layout(), BERLIN('2026-09-03', 9))).toBe(BERLIN('2026-09-03', 11));
    expect(nextChangeAfter(layout(), BERLIN('2026-09-03', 11))).toBe(BERLIN('2026-09-03', 14));
  });

  /**
   * Past the last moment, the next thing that happens is midnight, where the day starts
   * again from its sections. `nextMomentAfter` skipped it and woke at the first moment
   * tomorrow, which was right only for a day whose last moment puts back what its first
   * one changed.
   */
  it('wakes at Berlin midnight once the day’s moments are past', () => {
    expect(nextChangeAfter(layout(), BERLIN('2026-09-03', 23, 30))).toBe(BERLIN('2026-09-04', 0));
  });

  /** No moments and no editions is no wake-up: a screen that never changes needs no timer. */
  it('answers with nothing when the document never changes', () => {
    const flat = read({ version: HOME_LAYOUT_VERSION, sections: [{ id: 'a', module: 'x' }] });
    expect(nextChangeAfter(flat, BERLIN('2026-09-03', 9))).toBeNull();
  });

  it('counts an edition’s start, its moments and its end', () => {
    const planned = read({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'a', module: 'x' }],
      editions: [
        {
          id: 'wahlabend',
          from: '2026-09-27T18:00',
          until: '2026-09-28T02:00',
          moments: [{ at: '23:00', changes: [] }],
        },
      ],
    });
    const after = (instant: number) => nextChangeAfter(planned, instant);
    // A week out, the next wake-up is tonight's midnight, and the start is reached by
    // waking once a day; see the test below for why.
    expect(after(BERLIN('2026-09-20', 9))).toBe(BERLIN('2026-09-21', 0));
    expect(after(BERLIN('2026-09-27', 9))).toBe(BERLIN('2026-09-27', 18));
    expect(after(BERLIN('2026-09-27', 18))).toBe(BERLIN('2026-09-27', 23));
    expect(after(BERLIN('2026-09-27', 23))).toBe(BERLIN('2026-09-28', 0));
    expect(after(BERLIN('2026-09-28', 0))).toBe(BERLIN('2026-09-28', 2));
    expect(after(BERLIN('2026-09-28', 2))).toBe(BERLIN('2026-09-29', 0));
  });

  /**
   * Found by a cold review of #247 and measured: a document with no day moments and an
   * edition on Christmas Eve, asked on 2026-09-23, answered with the edition's start, which
   * is 7,974,000,000 ms away. `setTimeout` holds at most 2^31 − 1 ms and fires at once past
   * that, so the web export re-rendered in a loop. Berlin midnight is always a candidate now,
   * which keeps every answer within a day and a bit of the question.
   */
  it('never answers further out than the next Berlin midnight', () => {
    const planned = read({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'a', module: 'x' }],
      editions: [{ id: 'weihnachten', from: '2026-12-24T00:00', until: '2026-12-27T00:00' }],
    });
    const asked = BERLIN('2026-09-23', 12);
    const next = nextChangeAfter(planned, asked)!;
    expect(next).toBe(BERLIN('2026-09-24', 0));
    expect(next - asked).toBeLessThan(2 ** 31 - 1);
  });

  /**
   * The autumn's repeated hour, also from that review: a day moment at 02:30 on 2026-10-25
   * happens at the first 02:30, and the second 02:00 to 02:59 must neither undo it nor wait
   * for it again (ADR 0059 §6, "applies an idempotent change twice").
   */
  it('does not wait again for a day moment the repeated autumn hour has already passed', () => {
    const night = read({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'a', module: 'x' }],
      moments: [{ at: '02:30', changes: [{ id: 'a', hidden: true }] }],
    });
    expect(nextChangeAfter(night, Date.UTC(2026, 9, 25, 0, 20))).toBe(Date.UTC(2026, 9, 25, 0, 30));
    // 01:10Z is the second 02:10: the moment is behind, so the next change is midnight.
    expect(nextChangeAfter(night, Date.UTC(2026, 9, 25, 1, 10))).toBe(BERLIN('2026-10-26', 0));
  });

  /** A moment of an edition that would next happen after the edition ends is no wake-up. */
  it('does not wake for an edition’s moment after the edition is over', () => {
    const planned = read({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'a', module: 'x' }],
      editions: [
        {
          id: 'kurz',
          from: '2026-09-27T18:00',
          until: '2026-09-27T20:00',
          moments: [{ at: '09:00', changes: [] }],
        },
      ],
    });
    expect(nextChangeAfter(planned, BERLIN('2026-09-27', 19))).toBe(BERLIN('2026-09-27', 20));
  });
});

describe('parseHomeLayout, on a document it cannot use at all', () => {
  it.each([
    ['null', null],
    ['a string', '{"version":1}'],
    ['an array', []],
    ['a number', 7],
  ])('refuses %s and says what it got', (_name, input) => {
    const parse = parseHomeLayout(input);
    expect(parse.layout).toBeNull();
    expect(codes(parse)).toEqual(['document-not-an-object']);
  });

  it('refuses a document with no usable version', () => {
    const parse = parseHomeLayout({ sections: [] });
    expect(parse.layout).toBeNull();
    expect(parse.problems).toEqual([{ code: 'version-invalid', context: { type: 'undefined' } }]);
  });

  it('refuses a document whose sections are not a list', () => {
    const parse = parseHomeLayout({ version: 2, sections: { hero: {} } });
    expect(parse.layout).toBeNull();
    expect(codes(parse)).toEqual(['sections-not-an-array']);
  });

  /**
   * ADR 0036 §7: the configuration moves faster than the app, so a document numbered for
   * a later one is read rather than refused. Reported, because a report is how anybody
   * finds out that this phone is behind.
   */
  it('reads a document numbered for a later app, and says so', () => {
    const later = HOME_LAYOUT_VERSION + 1;
    const parse = parseHomeLayout(document([section()], { version: later }));
    expect(parse.layout?.sections).toHaveLength(1);
    expect(parse.problems).toEqual([
      { code: 'version-unknown', context: { version: later, expected: HOME_LAYOUT_VERSION } },
    ]);
  });

  /**
   * A version 2 document is a version 3 document with no editions. It is reported for its
   * number, as every other number is, and read exactly as it was.
   */
  it('reads a version 2 document as the day it always was', () => {
    const parse = parseHomeLayout({ ...homeLayoutDocument, version: 2 });
    expect(codes(parse)).toEqual(['version-unknown']);
    expect(parse.layout?.editions).toEqual([]);
    expect(parse.layout?.sections).toEqual(DEFAULT_HOME_LAYOUT.sections);
    expect(parse.layout?.moments).toEqual(DEFAULT_HOME_LAYOUT.moments);
  });

  /**
   * A version 1 document, which is the shape this app shipped with until ADR 0039.
   *
   * It is read and not refused, and what it loses is every section that carried
   * `dayparts` — a key nobody here can apply. There is deliberately no migration: the
   * document is compiled in, nothing has ever fetched one, and a migration written
   * against a document that was never served is a guess with upkeep. This is here so
   * that the behaviour is a decision somebody can read rather than a surprise.
   */
  it('reads a version 1 document and drops the sections that named dayparts', () => {
    const parse = parseHomeLayout({
      version: 1,
      sections: [
        { id: 'header', module: 'home-header' },
        { id: 'callout', module: 'callout-teaser', dayparts: ['midday'] },
      ],
    });
    expect(parse.layout?.sections.map((s) => s.id)).toEqual(['header']);
    expect(codes(parse)).toEqual(['version-unknown', 'section-unknown-key']);
  });
});

describe('parseHomeLayout, on a section it cannot use', () => {
  /** The case the whole shape exists for: one bad section, the rest of the screen intact. */
  it('drops the bad one and keeps the good ones, in order', () => {
    const parse = parseHomeLayout(
      document([
        section({ id: 'header', module: 'home-header' }),
        { id: 'broken' },
        section({ id: 'hero', module: 'article-hero' }),
      ]),
    );
    expect(parse.layout?.sections.map((s) => s.id)).toEqual(['header', 'hero']);
    expect(parse.problems).toEqual([
      { code: 'section-module-invalid', context: { id: 'broken', type: 'undefined' } },
    ]);
  });

  it.each([
    [
      'not an object',
      'hero',
      { code: 'section-not-an-object', context: { index: 0, type: 'string' } },
    ],
    [
      'an id that is not a string',
      section({ id: 7 }),
      { code: 'section-id-invalid', context: { index: 0, type: 'number' } },
    ],
    [
      'an empty id',
      section({ id: '' }),
      { code: 'section-id-invalid', context: { index: 0, type: 'string' } },
    ],
    [
      'a module that is missing',
      { id: 'hero' },
      { code: 'section-module-invalid', context: { id: 'hero', type: 'undefined' } },
    ],
    [
      'a hidden flag that is not a boolean',
      section({ hidden: 'yes' }),
      { code: 'section-hidden-invalid', context: { id: 'hero', type: 'string' } },
    ],
    [
      'a key nobody here knows',
      section({ pinned: 'article-1' }),
      { code: 'section-unknown-key', context: { id: 'hero', key: 'pinned' } },
    ],
    [
      'settings that are not an object',
      section({ module: 'article-hero', settings: 'pin' }),
      { code: 'section-settings-invalid', context: { id: 'hero', type: 'string' } },
    ],
  ])('drops a section with %s', (_name, bad, problem) => {
    const parse = parseHomeLayout(document([bad]));
    expect(parse.layout?.sections).toEqual([]);
    expect(parse.problems).toEqual([problem]);
  });

  /**
   * An unknown key drops its section rather than being drawn past, and that is the one
   * place this parser is stricter than §7. A key nobody here knows is a rule nobody here
   * can apply, and a section drawn with its rule ignored is a section the newsroom
   * believes it configured.
   */
  it('names every unknown key on a section, not only the first', () => {
    const parse = parseHomeLayout(document([section({ pinned: 'a', rule: 'newest' })]));
    expect(parse.problems.map((p) => p.context.key)).toEqual(['pinned', 'rule']);
  });

  it('keeps the first of two sections sharing an id', () => {
    const parse = parseHomeLayout(
      document([
        section({ id: 'hero', module: 'first' }),
        section({ id: 'hero', module: 'second' }),
      ]),
    );
    expect(parse.layout?.sections).toEqual([{ id: 'hero', module: 'first' }]);
    expect(parse.problems).toEqual([
      { code: 'section-id-duplicate', context: { id: 'hero', index: 1 } },
    ]);
  });

  it('lets two sections share a module', () => {
    const parse = parseHomeLayout(
      document([
        section({ id: 'callout-lifted', module: 'callout-teaser', hidden: true }),
        section({ id: 'callout', module: 'callout-teaser' }),
      ]),
    );
    expect(parse.problems).toEqual([]);
    expect(parse.layout?.sections).toHaveLength(2);
  });

  /** The host's half of §14: a module it holds no renderer for is skipped and reported. */
  it('drops a module the host cannot draw, when it is told what the host can draw', () => {
    const parse = parseHomeLayout(
      document([
        section({ id: 'hero', module: 'article-hero' }),
        section({ id: 'x', module: 'quiz' }),
      ]),
      new Set(['article-hero']),
    );
    expect(parse.layout?.sections.map((s) => s.id)).toEqual(['hero']);
    expect(parse.problems).toEqual([
      { code: 'module-unrecognised', context: { id: 'x', module: 'quiz' } },
    ]);
  });

  it('takes every module name as written when it is told nothing', () => {
    const parse = parseHomeLayout(document([section({ module: 'quiz' })]));
    expect(parse.problems).toEqual([]);
  });

  it('keeps the optional fields out of a section that did not carry them', () => {
    const parse = parseHomeLayout(document([section({ id: 'hero', module: 'article-hero' })]));
    expect(Object.keys(parse.layout!.sections[0]!)).toEqual(['id', 'module']);
  });
});

describe('parseHomeLayout, on the settings a module understands', () => {
  const hero = (settings: unknown) => section({ id: 'hero', module: 'article-hero', settings });

  it('takes a pin, and takes null for the rule running', () => {
    expect(read(document([hero({ pin: 'https://example.org/a' })])).sections[0]?.settings).toEqual({
      pin: 'https://example.org/a',
    });
    expect(read(document([hero({ pin: null })])).sections[0]?.settings).toEqual({ pin: null });
  });

  it('takes a count inside the module’s bounds and refuses one outside them', () => {
    const rail = (count: unknown) =>
      section({ id: 'rail', module: 'faktencheck-rail', settings: { count } });
    expect(read(document([rail(3)])).sections[0]?.settings).toEqual({ count: 3 });
    expect(codes(parseHomeLayout(document([rail(0)])))).toEqual(['section-setting-invalid']);
    expect(codes(parseHomeLayout(document([rail(99)])))).toEqual(['section-setting-invalid']);
    expect(codes(parseHomeLayout(document([rail(2.5)])))).toEqual(['section-setting-invalid']);
  });

  /**
   * The rule the brief asked for: a setting a module does not understand is REPORTED,
   * and the rest of the screen survives.
   *
   * Its own section goes, for the reason an unrecognised key goes: a place configured by
   * a rule this app cannot apply is a place showing something nobody chose, and a
   * setting changes what a place SHOWS rather than how it looks. Two rules for "a word
   * this app does not know" would have been the second mechanism ADR 0036 §6 warns
   * about.
   */
  it('drops the section carrying an unknown setting, reports it, and keeps the rest', () => {
    const parse = parseHomeLayout(
      document([
        section({ id: 'header', module: 'home-header' }),
        hero({ pin: 'https://example.org/a', tone: 'loud' }),
        section({ id: 'impact', module: 'impact-footer' }),
      ]),
    );
    expect(parse.layout?.sections.map((s) => s.id)).toEqual(['header', 'impact']);
    expect(parse.problems).toEqual([
      {
        code: 'section-setting-unknown',
        context: { id: 'hero', module: 'article-hero', key: 'tone' },
      },
    ]);
  });

  it('reports a setting on a module that understands none', () => {
    const parse = parseHomeLayout(
      document([section({ id: 'x', module: 'impact-footer', settings: { count: 2 } })]),
    );
    expect(codes(parse)).toEqual(['section-setting-unknown']);
  });

  it('leaves an empty settings object out of the parse', () => {
    const parse = parseHomeLayout(document([hero({})]));
    expect(parse.problems).toEqual([]);
    expect(Object.keys(parse.layout!.sections[0]!)).toEqual(['id', 'module']);
  });
});

describe('parseHomeLayout, on the moments', () => {
  const withMoments = (moments: unknown) =>
    parseHomeLayout({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'hero', module: 'article-hero' }],
      moments,
    });

  it('reads no moments at all as a screen that does not change', () => {
    const parse = withMoments(undefined);
    expect(parse.problems).toEqual([]);
    expect(parse.layout?.moments).toEqual([]);
  });

  it('refuses a moments field that is not a list, and keeps the sections', () => {
    const parse = withMoments({ '11:00': [] });
    expect(codes(parse)).toEqual(['moments-not-an-array']);
    expect(parse.layout?.sections).toHaveLength(1);
  });

  it.each([
    ['not an object', 'x', 'moment-not-an-object'],
    ['a time that is not one', { at: 'lunchtime', changes: [] }, 'moment-time-invalid'],
    ['no time at all', { changes: [] }, 'moment-time-invalid'],
    ['a key nobody here knows', { at: '11:00', repeat: 'daily' }, 'moment-unknown-key'],
    ['changes that are not a list', { at: '11:00', changes: {} }, 'moment-changes-invalid'],
  ])('drops a moment that is %s', (_name, bad, code) => {
    const parse = withMoments([bad]);
    expect(codes(parse)).toEqual([code]);
    expect(parse.layout?.moments).toEqual([]);
  });

  /**
   * Two moments at one time is the one case where the order they were written in would
   * decide something, so it is the one case that is refused rather than sorted.
   */
  it('keeps the first of two moments at the same time', () => {
    const parse = withMoments([
      { at: '11:00', changes: [{ id: 'hero', hidden: true }] },
      { at: '11:00', changes: [{ id: 'hero', hidden: false }] },
    ]);
    expect(parse.layout?.moments).toHaveLength(1);
    expect(parse.layout?.moments[0]?.changes).toEqual([{ id: 'hero', hidden: true }]);
    expect(parse.problems).toEqual([
      { code: 'moment-time-duplicate', context: { index: 1, at: '11:00' } },
    ]);
  });

  it('costs one change and never the moment', () => {
    const parse = withMoments([
      {
        at: '11:00',
        changes: [
          { id: 'hero', hidden: true },
          { id: 'hero', rule: 'newest' },
        ],
      },
    ]);
    expect(parse.layout?.moments[0]?.changes).toEqual([{ id: 'hero', hidden: true }]);
    expect(parse.problems).toEqual([
      { code: 'change-unknown-key', context: { at: '11:00', id: 'hero', key: 'rule' } },
    ]);
  });

  /**
   * A change about a place the document does not have does nothing, and doing nothing
   * silently is how a newsroom loses an edit without being told.
   */
  it('reports a change naming a section the document does not declare', () => {
    const parse = withMoments([{ at: '11:00', changes: [{ id: 'quiz', hidden: false }] }]);
    expect(parse.layout?.moments[0]?.changes).toEqual([]);
    expect(parse.problems).toEqual([
      { code: 'change-id-unknown', context: { at: '11:00', id: 'quiz' } },
    ]);
  });

  it.each([
    ['not an object', 'hero', 'change-not-an-object'],
    ['an id that is not one', { id: 7 }, 'change-id-invalid'],
    ['a hidden flag that is not a boolean', { id: 'hero', hidden: 'yes' }, 'change-hidden-invalid'],
    ['settings that are not an object', { id: 'hero', settings: 4 }, 'change-settings-invalid'],
    [
      'a setting the module has not got',
      { id: 'hero', settings: { tone: 'loud' } },
      'change-setting-unknown',
    ],
    [
      'a setting outside its bounds',
      { id: 'hero', settings: { pin: '' } },
      'change-setting-invalid',
    ],
  ])('drops a change that is %s', (_name, bad, code) => {
    const parse = withMoments([{ at: '11:00', changes: [bad] }]);
    expect(codes(parse)).toEqual([code]);
    expect(parse.layout?.moments[0]?.changes).toEqual([]);
  });

  /**
   * What dropping a change costs, which is the half of ADR 0039 §6 a problem code cannot
   * show: the place is still there, still drawn, and holding what the point before it
   * left. That is the decision rather than an accident of the code, and the record was
   * struck on 2026-09-17 where it said otherwise, so it is asserted here.
   */
  it('leaves a place holding what it inherited when its change is refused', () => {
    const parse = parseHomeLayout({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'hero', module: 'article-hero', settings: { pin: 'https://morning/' } }],
      moments: [
        {
          at: '18:00',
          changes: [{ id: 'hero', settings: { pin: 'https://evening/', tone: 'x' } }],
        },
      ],
    });

    expect(codes(parse)).toEqual(['change-setting-unknown']);
    expect(parse.layout?.moments[0]?.changes).toEqual([]);
    // Not the evening's pin, and not no pin either: the morning's, all evening.
    expect(stateAt(parse.layout!, AT(18), ANYONE)[0]?.settings).toEqual({
      pin: 'https://morning/',
    });
    // And the place is still drawn, which is what makes dropping the change the smaller
    // cost than dropping the section would be.
    expect(sectionsAt(parse.layout!, AT(18), ANYONE).map((s) => s.id)).toEqual(['hero']);
  });

  it('carries the time in both spellings, and only the parsed one is derived', () => {
    const parse = withMoments([{ at: '09:30', changes: [] }]);
    expect(parse.layout?.moments[0]).toEqual({ at: '09:30', minute: 570, changes: [] });
  });
});

describe('reportLayoutProblems', () => {
  afterEach(() => {
    resetPlatform();
  });

  it('sends one report per problem, through the port, in the layout domain', () => {
    const reports: ErrorReport[] = [];
    configurePlatform({
      ...createMemoryPlatform(),
      errors: { report: (report) => reports.push(report) },
    });

    const parse = parseHomeLayout(document([section({ id: 'x', module: 'quiz' })]), new Set());
    reportLayoutProblems(parse.problems);

    expect(reports).toEqual([
      { domain: 'layout', code: 'module-unrecognised', context: { id: 'x', module: 'quiz' } },
    ]);
  });

  it('reports nothing for a document with nothing wrong with it', () => {
    const reports: ErrorReport[] = [];
    configurePlatform({
      ...createMemoryPlatform(),
      errors: { report: (report) => reports.push(report) },
    });

    reportLayoutProblems(parseHomeLayout(homeLayoutDocument).problems);
    expect(reports).toEqual([]);
  });
});

/**
 * Editions, ADR 0059 §3 and §4: a named layer over the day, active from a Berlin date and
 * time until another, in the grammar the day already has.
 */
describe('an edition, as the fold reads it', () => {
  const day = {
    version: HOME_LAYOUT_VERSION,
    sections: [
      { id: 'header', module: 'home-header' },
      { id: 'hero', module: 'article-hero', settings: { pin: 'https://example.org/day' } },
      { id: 'lifted', module: 'callout-teaser', hidden: true },
      { id: 'briefing', module: 'spotlight-briefing' },
      { id: 'rail', module: 'faktencheck-rail', settings: { count: 4 } },
    ],
    moments: [
      { at: '11:00', changes: [{ id: 'lifted', hidden: false }] },
      { at: '14:00', changes: [{ id: 'lifted', hidden: true }] },
    ],
  };

  const WAHLABEND = {
    id: 'wahlabend',
    title: 'Wahlabend',
    from: '2026-09-27T18:00',
    until: '2026-09-28T02:00',
    changes: [
      { id: 'hero', settings: { pin: 'https://example.org/wahl' } },
      { id: 'briefing', hidden: true },
    ],
    moments: [
      { at: '23:00', changes: [{ id: 'hero', settings: { pin: 'https://example.org/nacht' } }] },
    ],
  };

  const planned = (...editions: unknown[]) => read({ ...day, editions });
  const shown = (layout: HomeLayout, instant: number) =>
    sectionsAtInstant(layout, instant, ANYONE).map((s) => s.id);
  const pin = (layout: HomeLayout, instant: number) =>
    stateAtInstant(layout, instant, ANYONE).find((s) => s.id === 'hero')?.settings?.pin;

  it('is the day, before it starts and from the minute it ends', () => {
    const layout = planned(WAHLABEND);
    for (const instant of [BERLIN('2026-09-27', 17, 59), BERLIN('2026-09-28', 2)]) {
      expect(stateAtInstant(layout, instant, ANYONE)).toEqual(
        stateAt(layout, minuteOfDay(instant), ANYONE),
      );
    }
  });

  it('applies its starting state from the minute it opens, over the day', () => {
    const layout = planned(WAHLABEND);
    expect(pin(layout, BERLIN('2026-09-27', 18))).toBe('https://example.org/wahl');
    expect(shown(layout, BERLIN('2026-09-27', 18))).toEqual(['header', 'hero', 'rail']);
  });

  /** Where the edition says nothing, the day shows through, the day's own moments included. */
  it('lets the day show through where it says nothing', () => {
    const layout = read({
      ...day,
      editions: [{ ...WAHLABEND, from: '2026-09-27T09:00', until: '2026-09-27T20:00' }],
    });
    expect(shown(layout, BERLIN('2026-09-27', 12))).toEqual(['header', 'hero', 'lifted', 'rail']);
    expect(
      stateAtInstant(layout, BERLIN('2026-09-27', 12), ANYONE).find((s) => s.id === 'rail'),
    ).toEqual({
      id: 'rail',
      module: 'faktencheck-rail',
      settings: { count: 4 },
    });
  });

  /**
   * An edition is one span, not a day that repeats, so its moments carry over midnight: the
   * pin changed at 23:00 is still changed at half past midnight, and the day's own reset at
   * midnight does not reach into it.
   */
  it('applies its moments inside its span, and carries them over midnight', () => {
    const layout = planned(WAHLABEND);
    expect(pin(layout, BERLIN('2026-09-27', 22, 59))).toBe('https://example.org/wahl');
    expect(pin(layout, BERLIN('2026-09-27', 23))).toBe('https://example.org/nacht');
    expect(pin(layout, BERLIN('2026-09-28', 0, 30))).toBe('https://example.org/nacht');
    expect(pin(layout, BERLIN('2026-09-28', 2))).toBe('https://example.org/day');
  });

  /** And a moment before the edition opened on its first day has not happened in it. */
  it('does not apply a moment whose time fell before the edition opened', () => {
    const layout = planned({
      ...WAHLABEND,
      moments: [{ at: '09:00', changes: [{ id: 'briefing', hidden: false }] }],
    });
    expect(shown(layout, BERLIN('2026-09-27', 19))).not.toContain('briefing');
  });

  /**
   * Several days with a lift at 11:00 and a drop at 14:00: every time is read as the last
   * time each moment happened, so the second morning starts where the first afternoon left
   * it, and the second lunchtime lifts again.
   */
  it('orders a campaign’s moments by when they last happened, day after day', () => {
    const layout = planned({
      id: 'spenden',
      from: '2026-10-01T00:00',
      until: '2026-10-15T00:00',
      changes: [{ id: 'rail', settings: { count: 8 } }],
      moments: [
        { at: '11:00', changes: [{ id: 'rail', settings: { count: 12 } }] },
        { at: '14:00', changes: [{ id: 'rail', settings: { count: 2 } }] },
      ],
    });
    const count = (instant: number) =>
      stateAtInstant(layout, instant, ANYONE).find((s) => s.id === 'rail')?.settings?.count;
    expect(count(BERLIN('2026-10-01', 9))).toBe(8);
    expect(count(BERLIN('2026-10-01', 12))).toBe(12);
    expect(count(BERLIN('2026-10-02', 9))).toBe(2);
    expect(count(BERLIN('2026-10-02', 12))).toBe(12);
    expect(count(BERLIN('2026-10-15', 0))).toBe(4);
  });

  /**
   * §4: the narrower window wins, and an overlap is resolved rather than refused. A one-off
   * inside a fortnight's campaign beats the campaign, in either order in the document.
   */
  it('lets the narrower of two overlapping editions win, whichever is written first', () => {
    const campaign = {
      id: 'spenden',
      from: '2026-09-20T00:00',
      until: '2026-10-04T00:00',
      changes: [{ id: 'hero', settings: { pin: 'https://example.org/spenden' } }],
    };
    for (const layout of [planned(campaign, WAHLABEND), planned(WAHLABEND, campaign)]) {
      expect(editionsAt(layout, BERLIN('2026-09-27', 19)).map((e) => e.id)).toEqual([
        'spenden',
        'wahlabend',
      ]);
      expect(pin(layout, BERLIN('2026-09-27', 19))).toBe('https://example.org/wahl');
      expect(pin(layout, BERLIN('2026-09-27', 12))).toBe('https://example.org/spenden');
    }
  });

  it('breaks a tie of length by the later start, and then by the id', () => {
    const early = { id: 'b', from: '2026-09-27T10:00', until: '2026-09-27T20:00' };
    const late = { id: 'a', from: '2026-09-27T12:00', until: '2026-09-27T22:00' };
    expect(editionsAt(planned(late, early), BERLIN('2026-09-27', 15)).map((e) => e.id)).toEqual([
      'b',
      'a',
    ]);
    const twin = { id: 'c', from: '2026-09-27T10:00', until: '2026-09-27T20:00' };
    expect(editionsAt(planned(twin, early), BERLIN('2026-09-27', 15)).map((e) => e.id)).toEqual([
      'b',
      'c',
    ]);
  });

  it('names the moment of an edition in effect, which is where an editor writes', () => {
    const [edition] = planned(WAHLABEND).editions;
    expect(editionPointAt(edition!, BERLIN('2026-09-27', 19))).toBeNull();
    expect(editionPointAt(edition!, BERLIN('2026-09-27', 23, 5))).toBe(AT(23));
    expect(editionPointAt(edition!, BERLIN('2026-09-28', 1))).toBe(AT(23));
  });

  it('says which edition every change it applies came from', () => {
    const layout = planned(WAHLABEND);
    expect(changesAt(layout, BERLIN('2026-09-27', 23, 30), ANYONE)).toEqual([
      { edition: null, point: AT(11), change: { id: 'lifted', hidden: false } },
      { edition: null, point: AT(14), change: { id: 'lifted', hidden: true } },
      { edition: 'wahlabend', point: null, change: WAHLABEND.changes[0] },
      { edition: 'wahlabend', point: null, change: WAHLABEND.changes[1] },
      { edition: 'wahlabend', point: AT(23), change: WAHLABEND.moments[0]!.changes[0] },
    ]);
  });

  /**
   * §6: "at or before" makes the change of clocks harmless. On the spring day a moment at
   * 02:30 names a minute that does not exist and happens at the next one there is; on the
   * autumn day the edition is on the instant axis, so the repeated hour does not undo it.
   */
  /**
   * The day's own fold in the repeated hour, from the cold review of #247: it used to show a
   * 02:30 moment at the first 02:40, take it back at the second 02:10 and show it again at
   * the second 02:30.
   */
  it('keeps a day moment applied through the repeated autumn hour', () => {
    const night = read({
      ...day,
      moments: [{ at: '02:30', changes: [{ id: 'briefing', hidden: true }] }],
    });
    expect(shown(night, Date.UTC(2026, 9, 25, 0, 20))).toContain('briefing');
    for (const instant of [
      Date.UTC(2026, 9, 25, 0, 40),
      Date.UTC(2026, 9, 25, 1, 10),
      Date.UTC(2026, 9, 25, 1, 30),
      Date.UTC(2026, 9, 25, 2, 10),
    ]) {
      expect({ instant, shown: shown(night, instant).includes('briefing') }).toEqual({
        instant,
        shown: false,
      });
    }
  });

  it('passes the spring gap and applies what fell in it at the next minute there is', () => {
    const layout = planned({
      id: 'nacht',
      from: '2026-03-29T00:00',
      until: '2026-03-29T06:00',
      moments: [{ at: '02:30', changes: [{ id: 'briefing', hidden: true }] }],
    });
    const jump = Date.UTC(2026, 2, 29, 1);
    expect(shown(layout, jump - 60_000)).toContain('briefing');
    expect(shown(layout, jump)).not.toContain('briefing');
  });

  it('applies an edition’s moment in the doubled autumn hour once, and keeps it', () => {
    const layout = planned({
      id: 'nacht',
      from: '2026-10-25T00:00',
      until: '2026-10-25T06:00',
      moments: [{ at: '02:30', changes: [{ id: 'briefing', hidden: true }] }],
    });
    const back = Date.UTC(2026, 9, 25, 1);
    expect(shown(layout, back - 31 * 60_000)).toContain('briefing');
    // 02:30 the first time, 02:00 the second, and 02:15 the second: all after the moment.
    for (const instant of [back - 30 * 60_000, back, back + 15 * 60_000]) {
      expect(shown(layout, instant)).not.toContain('briefing');
    }
  });
});

describe('parseHomeLayout, on the editions', () => {
  const withEditions = (editions: unknown) =>
    parseHomeLayout({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'hero', module: 'article-hero' }],
      editions,
    });
  const span = { from: '2026-09-27T18:00', until: '2026-09-28T02:00' };

  it('reads no editions at all as a document that is only a day', () => {
    const parse = withEditions(undefined);
    expect(parse.problems).toEqual([]);
    expect(parse.layout?.editions).toEqual([]);
  });

  it('keeps the derived instants beside what the document wrote', () => {
    const parse = withEditions([{ id: 'w', title: 'Wahlabend', ...span }]);
    expect(parse.problems).toEqual([]);
    expect(parse.layout?.editions).toEqual([
      {
        id: 'w',
        title: 'Wahlabend',
        ...span,
        start: Date.UTC(2026, 8, 27, 16),
        end: Date.UTC(2026, 8, 28, 0),
        changes: [],
        moments: [],
      },
    ]);
  });

  it('refuses an editions field that is not a list, and keeps the day', () => {
    const parse = withEditions({ w: span });
    expect(codes(parse)).toEqual(['editions-not-an-array']);
    expect(parse.layout?.sections).toHaveLength(1);
  });

  it.each([
    [
      'not an object',
      'w',
      { code: 'edition-not-an-object', context: { index: 0, type: 'string' } },
    ],
    [
      'no id',
      { ...span },
      { code: 'edition-id-invalid', context: { index: 0, type: 'undefined' } },
    ],
    [
      'neither half of a condition, which is the day',
      { id: 'w' },
      { code: 'edition-condition-missing', context: { id: 'w' } },
    ],
    [
      'a start and no end, which is an exception that never ends',
      { id: 'w', from: span.from },
      { code: 'edition-until-missing', context: { id: 'w' } },
    ],
    [
      'an end and no start',
      { id: 'w', until: span.until },
      { code: 'edition-from-missing', context: { id: 'w' } },
    ],
    [
      'a start that is not a date and time',
      { id: 'w', from: '27.09.2026 18:00', until: span.until },
      { code: 'edition-from-invalid', context: { id: 'w', from: '27.09.2026 18:00' } },
    ],
    [
      'an end that is not a date and time',
      { id: 'w', from: span.from, until: 7 },
      { code: 'edition-until-invalid', context: { id: 'w', until: 'number' } },
    ],
    [
      'an end that is its start, which `until` being exclusive makes empty',
      { id: 'w', from: span.from, until: span.from },
      { code: 'edition-span-empty', context: { id: 'w', from: span.from, until: span.from } },
    ],
    [
      'a start the spring change skips, which Berlin’s clock never shows',
      { id: 'w', from: '2026-03-29T02:30', until: '2026-03-29T06:00' },
      { code: 'edition-span-in-gap', context: { id: 'w', from: '2026-03-29T02:30' } },
    ],
    [
      'an end in the same gap',
      { id: 'w', from: '2026-03-28T20:00', until: '2026-03-29T02:00' },
      { code: 'edition-span-in-gap', context: { id: 'w', until: '2026-03-29T02:00' } },
    ],
    [
      'changes that are not a list',
      { id: 'w', ...span, changes: {} },
      { code: 'edition-changes-invalid', context: { id: 'w', type: 'object' } },
    ],
    [
      'a key nobody here knows',
      { id: 'w', ...span, audience: 'members' },
      { code: 'edition-unknown-key', context: { id: 'w', key: 'audience' } },
    ],
  ])('drops an edition with %s', (_name, bad, problem) => {
    const parse = withEditions([bad]);
    expect(parse.layout?.editions).toEqual([]);
    expect(parse.problems).toEqual([problem]);
  });

  /**
   * `days` is ADR 0059's other condition, and this slice does not build it (§8). So to this
   * app it is a key it cannot apply, and the edition goes the way a section carrying one
   * goes: read as though the weekdays were not there, it would run every day of its span.
   */
  it('drops a weekday edition, which this app cannot apply, and says which key', () => {
    const parse = withEditions([
      { id: 'wochenende', days: ['sat', 'sun'], changes: [{ id: 'hero', hidden: true }] },
      { id: 'w', ...span },
    ]);
    expect(parse.layout?.editions.map((e) => e.id)).toEqual(['w']);
    expect(parse.problems).toEqual([
      { code: 'edition-unknown-key', context: { id: 'wochenende', key: 'days' } },
    ]);
  });

  it('keeps the first of two editions sharing an id', () => {
    const parse = withEditions([
      { id: 'w', ...span, title: 'first' },
      { id: 'w', ...span, title: 'second' },
    ]);
    expect(parse.layout?.editions.map((e) => e.title)).toEqual(['first']);
    expect(parse.problems).toEqual([
      { code: 'edition-id-duplicate', context: { id: 'w', index: 1 } },
    ]);
  });

  /** The title carries no rule, so a bad one costs the title and not the edition. */
  it('drops a title that is not one, and keeps the edition', () => {
    const parse = withEditions([{ id: 'w', ...span, title: 12 }]);
    expect(parse.layout?.editions[0]).not.toHaveProperty('title');
    expect(parse.problems).toEqual([
      { code: 'edition-title-invalid', context: { id: 'w', type: 'number' } },
    ]);
  });

  it('keeps the first of two moments at one time inside an edition, and says whose', () => {
    const parse = withEditions([
      {
        id: 'w',
        ...span,
        moments: [
          { at: '23:00', changes: [{ id: 'hero', hidden: true }] },
          { at: '23:00', changes: [] },
        ],
      },
    ]);
    expect(parse.layout?.editions[0]?.moments).toHaveLength(1);
    expect(parse.problems).toEqual([
      { code: 'moment-time-duplicate', context: { edition: 'w', index: 1, at: '23:00' } },
    ]);
  });

  it('reports a change naming a place the document has not got, in its start or a moment', () => {
    const parse = withEditions([
      {
        id: 'w',
        ...span,
        changes: [{ id: 'quiz', hidden: false }],
        moments: [{ at: '23:00', changes: [{ id: 'quiz', hidden: true }] }],
      },
    ]);
    expect(parse.layout?.editions[0]?.changes).toEqual([]);
    expect(parse.layout?.editions[0]?.moments[0]?.changes).toEqual([]);
    expect(parse.problems).toEqual([
      { code: 'change-id-unknown', context: { edition: 'w', id: 'quiz' } },
      { code: 'change-id-unknown', context: { edition: 'w', at: '23:00', id: 'quiz' } },
    ]);
  });

  it('costs one change of an edition, and never the edition', () => {
    const parse = withEditions([
      {
        id: 'w',
        ...span,
        changes: [
          { id: 'hero', settings: { tone: 'loud' } },
          { id: 'hero', hidden: true },
        ],
      },
    ]);
    expect(parse.layout?.editions[0]?.changes).toEqual([{ id: 'hero', hidden: true }]);
    expect(parse.problems).toEqual([
      {
        code: 'change-setting-unknown',
        context: { edition: 'w', id: 'hero', module: 'article-hero', key: 'tone' },
      },
    ]);
  });
});

/**
 * ADR 0059 §5, which is the whole reason editions are a key beside the day rather than a
 * condition inside it: an app written against version 2 reads the day and never sees an
 * edition, so during a campaign its readers see the ordinary day and not a broken screen.
 *
 * `__fixtures__/home-layout-v2.ts` is that app's parser, frozen at the last commit before
 * editions. This is the only test that runs it, and it runs it on a document with editions.
 */
describe('a version 3 document, read by an app written for version 2', () => {
  const planned = {
    ...homeLayoutDocument,
    editions: [
      {
        id: 'wahlabend',
        title: 'Wahlabend',
        from: '2026-09-27T18:00',
        until: '2026-09-28T02:00',
        changes: [
          { id: 'hero', settings: { pin: 'https://example.org/wahl' } },
          { id: 'briefing', hidden: true },
        ],
        moments: [{ at: '23:00', changes: [{ id: 'hero', settings: { pin: null } }] }],
      },
    ],
  };

  it('is reported for its number and nothing else', () => {
    const parse = v2.parseHomeLayout(planned);
    expect(parse.problems).toEqual([
      { code: 'version-unknown', context: { version: HOME_LAYOUT_VERSION, expected: 2 } },
    ]);
  });

  /**
   * Every minute of the day, in the older app, is the day this app draws with no edition.
   *
   * For a paying member, because a version 2 app knows no audience and so draws every
   * block for everybody; since ADR 0060 the early-access card is for paying members by its
   * module's default, and that is the one reader for whom the two apps agree on it.
   */
  it('draws the ordinary day, the evening of the edition included', () => {
    const old = v2.parseHomeLayout(planned).layout!;
    const now = read(planned);
    for (let minute = 0; minute < 24 * 60; minute += 5) {
      expect(v2.sectionsAt(old, minute)).toEqual(sectionsAt(now, minute, MEMBER));
    }
    // And during the edition the two apps disagree, which is the cost §5 accepts.
    const eight = BERLIN('2026-09-27', 20);
    expect(sectionsAtInstant(now, eight, MEMBER).map((s) => s.id)).not.toContain('briefing');
    expect(v2.sectionsAt(old, minuteOfDay(eight)).map((s) => s.id)).toContain('briefing');
  });
});

describe('the shipped document', () => {
  it('is numbered for this app and carries no edition', () => {
    expect(homeLayoutDocument.version).toBe(HOME_LAYOUT_VERSION);
    expect(DEFAULT_HOME_LAYOUT.editions).toEqual([]);
  });
});

describe('an id that carries a line break or another control character', () => {
  // ADR 0061 §2: the submission workflow prints ids into a pull request's body, where a line
  // of its own reading `Closes #1` is an instruction to GitHub. Refused, and reported by
  // where it stood, never by what it said.
  const smuggled = 'x`\n\nCloses #1\n\n@correctiv/everyone <!--';

  it('refuses such a section, and names its place rather than its text', () => {
    const { layout, problems } = parseHomeLayout({
      version: HOME_LAYOUT_VERSION,
      sections: [
        { id: 'header', module: 'home-header' },
        { id: smuggled, module: 'article-hero' },
      ],
    });
    expect(layout?.sections.map((section) => section.id)).toEqual(['header']);
    expect(problems).toEqual([{ code: 'id-unsafe', context: { of: 'section', index: 1 } }]);
    expect(JSON.stringify(problems)).not.toContain('Closes');
  });

  it('refuses such an edition', () => {
    const { problems } = parseHomeLayout({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'header', module: 'home-header' }],
      editions: [{ id: smuggled, from: '2026-09-27T18:00', until: '2026-09-28T02:00' }],
    });
    expect(problems).toEqual([{ code: 'id-unsafe', context: { of: 'edition', index: 0 } }]);
  });

  it('still takes an id with spaces, umlauts and punctuation', () => {
    const { problems } = parseHomeLayout({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'Wahl-Abend: Ü 2026', module: 'home-header' }],
    });
    expect(problems).toEqual([]);
  });
});
