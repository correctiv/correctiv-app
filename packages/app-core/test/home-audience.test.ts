import { describe, expect, it } from 'vitest';

import { berlinInstant } from '../src/lib/berlin-time';
import {
  AUDIENCES,
  audienceOf,
  defaultAudience,
  isAudience,
  MODULE_AUDIENCES,
  READERS,
  readerOf,
  type Audience,
} from '../src/lib/home-audience';
import {
  changesAt,
  homeLayoutDocument,
  HOME_LAYOUT_VERSION,
  parseHomeLayout,
  sectionsAt,
  sectionsAtInstant,
  stateAt,
  type HomeLayout,
} from '../src/lib/home-layout';
import { simulatedEntitlement } from '../src/services/auth.service';
import type { Entitlement, MembershipTier } from '../src/types/models';
import * as v2 from './__fixtures__/home-layout-v2';
import * as v3 from './__fixtures__/home-layout-v3';

/**
 * Who a place and a change are for (ADR 0060, carrying out ADR 0041).
 *
 * Three halves. The rules: which reader is in which audience, asked of one file. The
 * grammar: what the parser keeps and what it refuses. And the fold: that the reader is one
 * more parameter applied the same way to the day and to an edition, and that an audience
 * on a place and `hidden` are two questions rather than one.
 */

const member = (tier: MembershipTier, over: Partial<Entitlement> = {}): Entitlement => ({
  tier,
  appAccess: true,
  source: tier === 'free' ? 'local-bundle' : 'paid',
  validUntil: null,
  localAreas: [],
  memberSince: null,
  ...over,
});

const PAYING = readerOf(member('paid'));
const FREE = readerOf(member('free'));
const NOBODY = readerOf(null);

const sorted = (reader: ReadonlySet<Audience>) => [...reader].sort();

/** A parse that is expected to be clean, as a layout, so a test can fold it. */
function read(input: unknown): HomeLayout {
  const parse = parseHomeLayout(input);
  expect(parse.problems).toEqual([]);
  return parse.layout!;
}

const codes = (input: unknown) => parseHomeLayout(input).problems.map((problem) => problem.code);

describe('the one file that says what an audience means', () => {
  it('puts every reader in everyone, and each tier in the audience the club calls it', () => {
    expect(sorted(NOBODY)).toEqual(['everyone']);
    expect(sorted(PAYING)).toEqual(['everyone', 'paying-members']);
    expect(sorted(readerOf(member('soli')))).toEqual(['everyone', 'paying-members']);
    expect(sorted(FREE)).toEqual(['everyone', 'free-members']);
  });

  it('counts a trial month as a paying membership, because the tier says so', () => {
    // A trial is a `paid` tier at 0 € for a month (`models.ts`). An audience read off the
    // amount would leave out exactly the people being courted.
    const trial = member('paid', { source: 'trial', validUntil: '2026-10-23T00:00:00.000Z' });
    expect(sorted(readerOf(trial))).toEqual(['everyone', 'paying-members']);
  });

  it('asks nothing but the tier, so a local bundle is a free member when its tier is free', () => {
    const local = member('free', { source: 'local-bundle', localAreas: ['Gelsenkirchen'] });
    expect(sorted(readerOf(local))).toEqual(['everyone', 'free-members']);
  });

  /**
   * The review of #250, item 6: widening `free-members` to every local bundle left every
   * suite green. The sign-in the app simulates gives a `lokal` address a paid tier with a
   * local bundle, and that reader is a member with a contribution, because the rules read
   * the tier and nothing else (ADR 0060 §3).
   */
  it('puts a local bundle on a paid tier among the paying members, and only there', () => {
    const at = (email: string) => sorted(readerOf(simulatedEntitlement(email, { now: 0 })));
    expect(simulatedEntitlement('lokal@example.org', { now: 0 }).source).toBe('local-bundle');
    expect(at('lokal@example.org')).toEqual(['everyone', 'paying-members']);
    expect(at('soli@example.org')).toEqual(['everyone', 'paying-members']);
    expect(at('test@example.org')).toEqual(['everyone', 'paying-members']);
  });

  it('lists every reader the rules can tell apart, and every audience has one in it', () => {
    // READERS is what the editor checks an edit against before calling it a repetition. An
    // audience no listed reader is in is an audience the editor would prune blind.
    for (const audience of AUDIENCES) {
      expect(READERS.some((reader) => reader.has(audience))).toBe(true);
    }
    const spelled = READERS.map((reader) => sorted(reader).join(' '));
    expect(new Set(spelled).size).toBe(READERS.length);
  });

  it('refuses a name it has no rule for, and does not offer "not yet a member"', () => {
    // ADR 0060 §3: nobody inside the door can be in it, so it is not an audience yet.
    expect(isAudience('paying-members')).toBe(true);
    expect(isAudience('not-yet-members')).toBe(false);
    expect(isAudience('toString')).toBe(false);
    expect(AUDIENCES).not.toContain('not-yet-members');
  });

  it('carries only audiences it knows as a module default, and the early-access card has one', () => {
    for (const audience of Object.values(MODULE_AUDIENCES)) expect(isAudience(audience)).toBe(true);
    expect(defaultAudience('early-access-card')).toBe('paying-members');
    expect(defaultAudience('backstage-teaser')).toBe('everyone');
    expect(defaultAudience('a-module-nobody-wrote')).toBe('everyone');
  });

  it('lets the document take a default back off, and put one on', () => {
    expect(audienceOf({ module: 'early-access-card' })).toBe('paying-members');
    expect(audienceOf({ module: 'early-access-card', audience: 'everyone' })).toBe('everyone');
    expect(audienceOf({ module: 'backstage-teaser', audience: 'free-members' })).toBe(
      'free-members',
    );
  });
});

describe('the grammar, on a section and on a change', () => {
  const day = (
    sections: unknown[],
    moments: unknown[] = [],
    editions?: unknown[],
    audiences?: unknown,
  ) => ({
    version: HOME_LAYOUT_VERSION,
    sections,
    ...(audiences === undefined ? {} : { audiences }),
    moments,
    ...(editions ? { editions } : {}),
  });

  it('keeps an audience it knows, on both', () => {
    const layout = read(
      day(
        [{ id: 'hero', module: 'a' }],
        [{ at: '18:00', changes: [{ id: 'hero', audience: 'free-members', hidden: true }] }],
        undefined,
        { hero: 'paying-members' },
      ),
    );
    expect(layout.sections[0]?.audience).toBe('paying-members');
    expect(layout.moments[0]?.changes[0]).toEqual({
      id: 'hero',
      audience: 'free-members',
      hidden: true,
    });
  });

  /**
   * ADR 0060 §6: a fault in `audiences` costs the one entry and never the place. The place
   * is drawn as its module would draw it, which is also what an older app does with the key.
   */
  it('keeps a place whose audience it has no rule for, and drops only the entry', () => {
    const parse = parseHomeLayout(
      day(
        [
          { id: 'hero', module: 'a' },
          { id: 'rail', module: 'b' },
        ],
        [],
        undefined,
        {
          hero: 'not-yet-members',
          gone: 'paying-members',
        },
      ),
    );
    expect(parse.layout?.sections).toEqual([
      { id: 'hero', module: 'a' },
      { id: 'rail', module: 'b' },
    ]);
    expect(parse.problems).toEqual([
      { code: 'audience-unknown', context: { id: 'hero', audience: 'not-yet-members' } },
      { code: 'audience-id-unknown', context: { id: 'gone' } },
    ]);
  });

  it('refuses an audience written inside a section, as it refuses any key it does not know', () => {
    const parse = parseHomeLayout(day([{ id: 'hero', module: 'a', audience: 'everyone' }]));
    expect(parse.problems.map((problem) => problem.code)).toEqual(['section-unknown-key']);
  });

  it('reads nothing out of audiences that are not an object, and keeps every place', () => {
    const parse = parseHomeLayout(day([{ id: 'hero', module: 'a' }], [], undefined, ['x']));
    expect(parse.problems.map((problem) => problem.code)).toEqual(['audiences-not-an-object']);
    expect(parse.layout?.sections).toEqual([{ id: 'hero', module: 'a' }]);
  });

  it('drops only the change whose audience it cannot read, and the place keeps its state', () => {
    const input = day(
      [{ id: 'hero', module: 'a' }],
      [
        {
          at: '18:00',
          changes: [
            { id: 'hero', audience: 42, hidden: true },
            { id: 'hero', settings: {} },
          ],
        },
      ],
    );
    expect(codes(input)).toEqual(['change-audience-unknown']);
    expect(parseHomeLayout(input).problems[0]?.context).toEqual({
      at: '18:00',
      id: 'hero',
      audience: 'number',
    });
    expect(parseHomeLayout(input).layout?.moments[0]?.changes).toEqual([{ id: 'hero' }]);
  });

  it('reads an audience inside an edition the way it reads one in the day', () => {
    const input = day(
      [{ id: 'hero', module: 'a' }],
      [],
      [
        {
          id: 'wahl',
          from: '2026-09-27T18:00',
          until: '2026-09-28T02:00',
          changes: [
            { id: 'hero', audience: 'paying-members', hidden: true },
            { id: 'hero', audience: 'somebody', hidden: true },
          ],
        },
      ],
    );
    const parse = parseHomeLayout(input);
    expect(parse.problems.map((problem) => problem.code)).toEqual(['change-audience-unknown']);
    expect(parse.problems[0]?.context.edition).toBe('wahl');
    expect(parse.layout?.editions[0]?.changes).toEqual([
      { id: 'hero', audience: 'paying-members', hidden: true },
    ]);
  });
});

describe('the fold, with the reader as its third parameter', () => {
  /**
   * ADR 0041's own example: at 18:00 the lead is one thing for paying members and another
   * for everybody else. Two changes at one time, side by side, neither knowing the other.
   */
  const evening = () =>
    read({
      version: HOME_LAYOUT_VERSION,
      sections: [
        { id: 'hero', module: 'article-hero' },
        { id: 'early', module: 'early-access-card' },
        { id: 'free-only', module: 'b', hidden: true },
      ],
      audiences: { 'free-only': 'free-members' },
      moments: [
        {
          at: '18:00',
          changes: [
            { id: 'hero', audience: 'paying-members', settings: { pin: 'https://club/' } },
            { id: 'hero', audience: 'free-members', settings: { pin: 'https://join/' } },
            { id: 'free-only', hidden: false },
          ],
        },
      ],
    });

  const pin = (layout: HomeLayout, minute: number, reader: ReadonlySet<Audience>) =>
    stateAt(layout, minute, reader).find((section) => section.id === 'hero')?.settings?.pin;

  it('applies a change only for a reader in its audience', () => {
    expect(pin(evening(), 18 * 60, PAYING)).toBe('https://club/');
    expect(pin(evening(), 18 * 60, FREE)).toBe('https://join/');
    // Nobody inside the door is in neither, and a reader in neither gets the day's own rule.
    expect(pin(evening(), 18 * 60, NOBODY)).toBeUndefined();
    // Before the moment nothing differs, for anybody.
    expect(pin(evening(), 9 * 60, PAYING)).toBeUndefined();
  });

  it('draws a place only for its audience, and the module default decides when the document does not', () => {
    const drawn = (reader: ReadonlySet<Audience>) =>
      sectionsAt(evening(), 19 * 60, reader).map((section) => section.id);
    expect(drawn(PAYING)).toEqual(['hero', 'early']);
    expect(drawn(FREE)).toEqual(['hero', 'free-only']);
  });

  it('keeps the audience and hidden apart: a change that shows a place does not widen who it is for', () => {
    // `free-only` is switched on for everybody at 18:00 and is still not drawn for a paying
    // member, because who a place is for is not the state a moment changes.
    const state = stateAt(evening(), 19 * 60, PAYING).find((section) => section.id === 'free-only');
    expect(state?.hidden).toBe(false);
    expect(sectionsAt(evening(), 19 * 60, PAYING).map((section) => section.id)).not.toContain(
      'free-only',
    );
  });

  it('filters an edition with the same clause, one level up', () => {
    const layout = read({
      version: HOME_LAYOUT_VERSION,
      sections: [{ id: 'hero', module: 'article-hero' }],
      editions: [
        {
          id: 'wahl',
          from: '2026-09-27T18:00',
          until: '2026-09-28T02:00',
          changes: [{ id: 'hero', audience: 'paying-members', hidden: true }],
        },
      ],
    });
    const eight = berlinInstant('2026-09-27', 20 * 60)!;
    expect(sectionsAtInstant(layout, eight, PAYING)).toEqual([]);
    expect(sectionsAtInstant(layout, eight, FREE).map((section) => section.id)).toEqual(['hero']);
    expect(changesAt(layout, eight, FREE)).toEqual([]);
  });
});

describe('a document with audiences, read by an app that knows none', () => {
  /**
   * ADR 0060 §6. The older parser is the frozen version 2 one, and a version 3 app reads a
   * top-level key it does not know the same way: it never sees it. So a place with an
   * audience is drawn for everybody, which is a filter ignored and not a block lost, and a
   * change carrying `audience` is refused by the rule for a key it does not know, so the
   * place keeps what every reader inherits.
   */
  const input = {
    version: HOME_LAYOUT_VERSION,
    sections: [
      { id: 'hero', module: 'article-hero' },
      { id: 'club', module: 'backstage-teaser' },
    ],
    audiences: { club: 'paying-members' },
    moments: [
      {
        at: '18:00',
        changes: [{ id: 'hero', audience: 'paying-members', hidden: true }],
      },
    ],
  };

  it('keeps every place, drops the change, and reports only the change', () => {
    const parse = v2.parseHomeLayout(input);
    expect(parse.problems.map((problem) => problem.code)).toEqual([
      'version-unknown',
      'change-unknown-key',
    ]);
    expect(v2.sectionsAt(parse.layout!, 19 * 60).map((section) => section.id)).toEqual([
      'hero',
      'club',
    ]);
  });
});

/**
 * The same questions against the parser `main` shipped the day before audiences, which
 * reads editions (review of #250, second round, item 2). The version 2 fixture above cannot
 * say what a version 3 app does with an audience inside an edition.
 */
describe('a document with audiences, read by the version 3 app', () => {
  const planned = {
    version: HOME_LAYOUT_VERSION,
    sections: [
      { id: 'hero', module: 'article-hero' },
      { id: 'club', module: 'backstage-teaser' },
    ],
    audiences: { club: 'paying-members', hero: 'everyone' },
    moments: [{ at: '18:00', changes: [{ id: 'hero', audience: 'paying-members', hidden: true }] }],
    editions: [
      {
        id: 'wahl',
        from: '2026-09-27T18:00',
        until: '2026-09-28T02:00',
        changes: [
          { id: 'club', audience: 'free-members', hidden: true },
          { id: 'hero', settings: { pin: 'https://wahl/' } },
        ],
      },
    ],
  };

  it('never sees the audiences map, and reports nothing but the number for it', () => {
    const parse = v3.parseHomeLayout({ ...planned, moments: [], editions: [] });
    expect(parse.problems.map((problem) => problem.code)).toEqual(['version-unknown']);
    expect(parse.layout?.sections.map((section) => section.id)).toEqual(['hero', 'club']);
  });

  it('drops a change naming an audience, in the day and in an edition, and keeps the rest', () => {
    const parse = v3.parseHomeLayout(planned);
    expect(parse.problems).toEqual([
      { code: 'version-unknown', context: { version: HOME_LAYOUT_VERSION, expected: 3 } },
      { code: 'change-unknown-key', context: { at: '18:00', id: 'hero', key: 'audience' } },
      { code: 'change-unknown-key', context: { edition: 'wahl', id: 'club', key: 'audience' } },
    ]);
    const night = berlinInstant('2026-09-27', 20 * 60)!;
    const drawn = v3.stateAtInstant(parse.layout!, night);
    expect(drawn.map((section) => [section.id, section.hidden ?? false])).toEqual([
      ['hero', false],
      ['club', false],
    ]);
    expect(drawn[0]?.settings?.pin).toBe('https://wahl/');
  });

  it('draws the shipped document exactly as the version 3 document it was', () => {
    const now = v3.parseHomeLayout(homeLayoutDocument);
    const before = v3.parseHomeLayout({ ...homeLayoutDocument, version: 3 });
    expect(now.problems.map((problem) => problem.code)).toEqual(['version-unknown']);
    expect(before.problems).toEqual([]);
    for (let minute = 0; minute < 24 * 60; minute += 5) {
      const instant = berlinInstant('2026-09-03', minute)!;
      expect(v3.sectionsAtInstant(now.layout!, instant)).toEqual(
        v3.sectionsAtInstant(before.layout!, instant),
      );
      // And for a paying member this app draws what the version 3 app draws.
      expect(sectionsAtInstant(read(homeLayoutDocument), instant, PAYING)).toEqual(
        v3.sectionsAtInstant(now.layout!, instant),
      );
    }
  });
});
