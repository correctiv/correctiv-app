import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { berlinInstant } from '@correctiv/app-core/lib/berlin-time';
import { AUDIENCES, readerOf } from '@correctiv/app-core/lib/home-audience';
import {
  HOME_LAYOUT_VERSION,
  parseHomeLayout,
  sectionsAtInstant,
  stateAtInstant,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';
import type { Entitlement } from '@correctiv/app-core/types/models';

import { MODULE_CONDITIONS } from '@/lib/home/conditions';

import { ROOT } from '../../plugin/collect.ts';
import { AUDIENCE_LABELS, CONDITION_LABELS, conditionOf } from '../../src/preview/home/Conditions';
import {
  changeHeldAt,
  editableAt,
  formatLayoutDocument,
  SHIPPED,
  withAudience,
  withEdition,
  withHidden,
  withMoment,
  withSetting,
  writeChangeAudience,
  writeHidden,
  writeSetting,
  strandingAudiences,
} from '../../src/preview/home/document';
import {
  applyFixture,
  entitlementIn,
  FIXTURES,
  sessionSnapshot,
} from '../../src/preview/frame/seed';
// The parser `main` shipped before audiences, frozen: what a version 3 app does.
import * as older from '../../../../packages/app-core/test/__fixtures__/home-layout-v3';

/**
 * When a block appears and for whom, as the configurator shows and writes it (ADR 0060).
 *
 * A file of its own rather than more of `home-document.test.ts`, which other work is
 * editing at the same time; the formatter below is that file's, over the new fields.
 */

function oxfmt(text: string): string {
  return execFileSync(
    join(ROOT, 'node_modules/.bin/oxfmt'),
    ['--stdin-filepath=home.layout.json'],
    {
      cwd: ROOT,
      input: text,
      encoding: 'utf8',
    },
  );
}

const AT = (hours: number, minutes = 0) => hours * 60 + minutes;
const DAY = (hours: number) => berlinInstant('2026-09-03', hours * 60)!;

const member = (tier: Entitlement['tier']): Entitlement => ({
  tier,
  appAccess: true,
  source: tier === 'free' ? 'local-bundle' : 'paid',
  validUntil: null,
  localAreas: [],
  memberSince: null,
});

describe('the words for a condition', () => {
  it('has a sentence for every condition a block declares, and none nobody declares', () => {
    // Both directions: `Record` makes a missing sentence a type error, and this is the half
    // a type cannot see, a sentence for a condition no block owns any more.
    const declared = new Set(Object.values(MODULE_CONDITIONS).filter((one) => one !== null));
    expect(Object.keys(CONDITION_LABELS).sort()).toEqual([...declared].sort());
  });

  it('names every audience the core knows, and no other', () => {
    expect(Object.keys(AUDIENCE_LABELS).sort()).toEqual([...AUDIENCES].sort());
  });

  it('says why the loading notice draws nothing, and nothing about a block that always draws', () => {
    expect(conditionOf('feed-status')?.id).toBe('conditions.intrinsic.loadingOrOffline');
    expect(conditionOf('impact-footer')).toBeNull();
  });
});

describe('who a block is for, as the editor writes it', () => {
  it('writes an audience only where it differs from the module default', () => {
    const club = withAudience(SHIPPED, 'backstage', 'paying-members');
    expect(club.sections.find((section) => section.id === 'backstage')?.audience).toBe(
      'paying-members',
    );
    // The early-access card is for paying members by default, so choosing that writes nothing.
    expect(withAudience(SHIPPED, 'early-access', 'paying-members')).toEqual(SHIPPED);
    const opened = withAudience(SHIPPED, 'early-access', 'everyone');
    expect(opened.sections.find((section) => section.id === 'early-access')?.audience).toBe(
      'everyone',
    );
    // And choosing the default back takes the key out again.
    expect(formatLayoutDocument(withAudience(opened, 'early-access', 'paying-members'))).toBe(
      formatLayoutDocument(SHIPPED),
    );
  });

  it('retargets the change at the playhead, and leaves a place with none alone', () => {
    const edited = withHidden(SHIPPED, AT(11), 'mediathek', true);
    const noon = DAY(12);
    expect(changeHeldAt(edited, noon, 'mediathek')).toEqual({ id: 'mediathek', hidden: true });

    const club = writeChangeAudience(edited, noon, 'mediathek', 'paying-members');
    expect(changeHeldAt(club, noon, 'mediathek', PAYING)?.audience).toBe('paying-members');
    // Everyone is the absence of the key, as the document writes it.
    expect(writeChangeAudience(club, noon, 'mediathek', 'everyone', PAYING)).toEqual(edited);
    // No change about the briefing at eleven: nothing to retarget.
    expect(writeChangeAudience(edited, noon, 'briefing', 'paying-members')).toBe(edited);
  });

  it('retargets a change in an edition the same way', () => {
    const made = withEdition(SHIPPED, '2026-09-27', AT(18));
    const saturday = berlinInstant('2026-09-27', AT(19))!;
    const edited = writeHidden(made.layout, saturday, 'briefing', true);
    const club = writeChangeAudience(edited, saturday, 'briefing', 'free-members');
    expect(club.editions[0]?.changes).toEqual([
      { id: 'briefing', audience: 'free-members', hidden: true },
    ]);
  });

  it('keeps an audience on a change when the change is edited again', () => {
    const edited = writeChangeAudience(
      withHidden(SHIPPED, AT(11), 'mediathek', true),
      DAY(12),
      'mediathek',
      'paying-members',
    );
    const again = withSetting(edited, AT(11), 'fact-checks', 'count', 3);
    expect(changeHeldAt(again, DAY(12), 'mediathek', PAYING)?.audience).toBe('paying-members');
  });

  /**
   * ADR 0060 §5: a change is a repetition only if it repeats for every reader it reaches.
   * At eleven the paying members' change takes the Mediathek off for them alone; at two a
   * change for everybody brings it back. For a free member that change restates what they
   * already have, and for a paying member it is the one that undoes eleven o'clock, so it
   * must stay.
   */
  it('does not prune a change for everybody that one audience still needs', () => {
    const eleven = writeChangeAudience(
      withHidden(SHIPPED, AT(11), 'mediathek', true),
      DAY(12),
      'mediathek',
      'paying-members',
    );
    const back = withHidden(eleven, AT(14), 'mediathek', false);
    expect(changeHeldAt(back, DAY(15), 'mediathek')).toEqual({ id: 'mediathek', hidden: false });
  });

  it('breaks a map of twelve audiences across lines, one place to a line', () => {
    const every = SHIPPED.sections.reduce(
      (layout, section, index) =>
        withAudience(layout, section.id, index % 2 === 0 ? 'paying-members' : 'free-members'),
      SHIPPED,
    );
    expect(every.sections.every((section) => section.audience !== undefined)).toBe(true);
    const printed = formatLayoutDocument(every);
    expect(printed).toMatch(/"audiences": \{\n/);
    expect(oxfmt(printed)).toBe(printed);
  });

  it('prints what oxfmt would print, with audiences on sections and on changes', () => {
    const lifted = withMoment(SHIPPED, AT(6, 30));
    const cases: HomeLayout[] = [
      withAudience(SHIPPED, 'backstage', 'paying-members'),
      withAudience(SHIPPED, 'early-access', 'everyone'),
      // Every place given an audience: a map of twelve entries, which has to break.
      SHIPPED.sections.reduce(
        (layout, section, index) =>
          withAudience(layout, section.id, index % 2 === 0 ? 'paying-members' : 'free-members'),
        SHIPPED,
      ),
      writeChangeAudience(
        withHidden(SHIPPED, AT(11), 'mediathek', true),
        DAY(12),
        'mediathek',
        'free-members',
      ),
      writeChangeAudience(
        withSetting(
          withHidden(lifted, AT(6, 30), 'briefing', true),
          AT(6, 30),
          'hero',
          'pin',
          'https://correctiv.org/x/',
        ),
        DAY(7),
        'hero',
        'paying-members',
      ),
    ];
    for (const layout of cases) {
      const printed = formatLayoutDocument(layout);
      expect(oxfmt(printed)).toBe(printed);
      // And the core reads it back with nothing left over.
      expect(parseHomeLayout(JSON.parse(printed)).problems).toEqual([]);
    }
  });
});

describe('whose screen the preview shows', () => {
  /** A `Storage` in memory, which is what a fixture writes into and the tool reads out of. */
  const memory = (): Storage => {
    const held = new Map<string, string>();
    return {
      get length() {
        return held.size;
      },
      clear: () => held.clear(),
      getItem: (key) => held.get(key) ?? null,
      key: (index) => [...held.keys()][index] ?? null,
      removeItem: (key) => void held.delete(key),
      setItem: (key, value) => void held.set(key, String(value)),
    };
  };
  /** The entitlement the tool reads after a fixture is applied: the UI's own path. */
  const after = (id: string) => {
    const store = memory();
    applyFixture(store, id);
    return entitlementIn(sessionSnapshot(store));
  };

  it('reads, for every fixture, the entitlement the fixture wrote', () => {
    for (const fixture of FIXTURES) {
      const store = memory();
      fixture.write(store);
      const raw = store.getItem(`correctiv.state\\store.session`);
      const written = raw === null ? null : (JSON.parse(raw).entitlement ?? null);
      expect({ id: fixture.id, read: after(fixture.id) }).toEqual({
        id: fixture.id,
        read: written,
      });
    }
    expect(after('fresh')).toBeNull();
  });

  it('puts the two fixtures in different audiences, which is what previewing one is', () => {
    expect(after('free-member')).toMatchObject({ tier: 'free', source: 'local-bundle' });
    const paying = readerOf(after('onboarded'));
    const free = readerOf(after('free-member'));
    expect(paying.has('paying-members')).toBe(true);
    expect(free.has('free-members')).toBe(true);
    expect(free.has('paying-members')).toBe(false);
    expect(readerOf(member('soli')).has('paying-members')).toBe(true);
  });

  it('reads nothing out of a session it cannot parse, or a store it cannot reach', () => {
    const store = memory();
    store.setItem('correctiv.state\\store.session', '{not json');
    expect(entitlementIn(sessionSnapshot(store))).toBeNull();
    const refusing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    } as unknown as Storage;
    expect(sessionSnapshot(refusing)).toBeNull();
  });
});

/**
 * ADR 0041's own pair, which the review of #250 found the editor mishandled: two changes
 * about one place at one time, for two audiences.
 */
const pair = (): HomeLayout => {
  const parse = parseHomeLayout({
    version: HOME_LAYOUT_VERSION,
    sections: [{ id: 'hero', module: 'article-hero' }],
    moments: [
      {
        at: '18:00',
        changes: [
          { id: 'hero', audience: 'paying-members', settings: { pin: 'https://club/' } },
          { id: 'hero', audience: 'free-members', settings: { pin: 'https://join/' } },
        ],
      },
    ],
  });
  expect(parse.problems).toEqual([]);
  return parse.layout!;
};
const EVENING = DAY(19);
const PAYING = readerOf(member('paid'));
const FREE = readerOf(member('free'));
const pinFor = (layout: HomeLayout, reader: ReturnType<typeof readerOf>) =>
  stateAtInstant(layout, EVENING, reader).find((section) => section.id === 'hero')?.settings?.pin;

describe('two changes for one place, and the reader in the frame', () => {
  it('shows each reader their own change, which the fold has to be told about', () => {
    // Held at the workbench's level because dropping the reader clause from the core's
    // fold left this suite green (review of #250, item 7).
    expect(pinFor(pair(), PAYING)).toBe('https://club/');
    expect(pinFor(pair(), FREE)).toBe('https://join/');
  });

  it('edits the change the framed reader is in, not the first one about the place', () => {
    const edited = writeSetting(pair(), EVENING, 'hero', 'pin', 'https://new/', FREE);
    expect(pinFor(edited, FREE)).toBe('https://new/');
    expect(pinFor(edited, PAYING)).toBe('https://club/');
    expect(changeHeldAt(edited, EVENING, 'hero', FREE)?.audience).toBe('free-members');
  });

  it('locks the controls where the only change here is for somebody else', () => {
    const paying = writeChangeAudience(
      withHidden(SHIPPED, AT(11), 'mediathek', true),
      DAY(12),
      'mediathek',
      'paying-members',
    );
    expect(editableAt(paying, DAY(12), 'mediathek', PAYING)).toBe(true);
    expect(editableAt(paying, DAY(12), 'mediathek', FREE)).toBe(false);
    // Nothing here at all is editable: the first edit makes a change for everybody.
    expect(editableAt(SHIPPED, DAY(12), 'mediathek', FREE)).toBe(true);
    expect(writeHidden(paying, DAY(12), 'mediathek', false, FREE)).toBe(paying);
  });

  it('refuses to retarget a change onto an audience another change here already has', () => {
    const edited = writeChangeAudience(pair(), EVENING, 'hero', 'free-members', PAYING);
    expect(edited.moments[0]?.changes.map((change) => change.audience)).toEqual([
      'paying-members',
      'free-members',
    ]);
  });
});

describe('what an older app does with what the editor writes', () => {
  /**
   * The review of #250, item 4: a version 3 app drops a section carrying a key it does not
   * know, so taking early access's default off with one word removed the card for every
   * reader of an older app. The audiences of places sit beside the sections now.
   */
  it('keeps a place an editor chose an audience for, in an app that knows none', () => {
    for (const audience of ['everyone', 'free-members'] as const) {
      const printed = formatLayoutDocument(withAudience(SHIPPED, 'early-access', audience));
      const read = older.parseHomeLayout(JSON.parse(printed));
      expect(read.problems.map((problem) => problem.code)).toEqual(['version-unknown']);
      expect(read.layout?.sections.map((section) => section.id)).toContain('early-access');
    }
    const callout = formatLayoutDocument(withAudience(SHIPPED, 'callout', 'paying-members'));
    const drawn = older.sectionsAtInstant(
      older.parseHomeLayout(JSON.parse(callout)).layout!,
      DAY(9),
    );
    expect(drawn.map((section) => section.id)).toContain('callout');
  });

  it('draws the place for the audience in this app, as the document says', () => {
    const layout = withAudience(SHIPPED, 'early-access', 'everyone');
    const back = parseHomeLayout(JSON.parse(formatLayoutDocument(layout)));
    expect(back.problems).toEqual([]);
    const ids = sectionsAtInstant(back.layout!, DAY(9), FREE).map((section) => section.id);
    expect(ids).toContain('early-access');
  });
});

/**
 * The review of #250, second round, item 1. The shipped callout swap is two changes at
 * 11:00, one showing the lifted callout and one hiding the other. Retargeting the first to
 * paying members left everybody else, and every reader of an older app, which drops the
 * change, with no callout at all.
 */
describe('a retarget that would strand one half of a swap', () => {
  const ELEVEN = DAY(12);
  const callouts = (layout: HomeLayout, reader: ReturnType<typeof readerOf>) =>
    sectionsAtInstant(layout, ELEVEN, reader)
      .filter((section) => section.module === 'callout-teaser')
      .map((section) => section.id);

  it('is refused, so every reader still gets one callout at eleven', () => {
    const edited = writeChangeAudience(SHIPPED, ELEVEN, 'callout-lifted', 'paying-members');
    expect(edited).toBe(SHIPPED);
    for (const reader of [readerOf(null), FREE, PAYING]) {
      expect(callouts(edited, reader)).toHaveLength(1);
    }
    expect(strandingAudiences(SHIPPED, ELEVEN, 'callout-lifted').has('paying-members')).toBe(true);
  });

  it('is refused inside an edition too', () => {
    const made = withEdition(SHIPPED, '2026-09-27', AT(18));
    const saturday = berlinInstant('2026-09-27', AT(19))!;
    const swapped = writeHidden(
      writeHidden(made.layout, saturday, 'callout-lifted', false),
      saturday,
      'callout',
      true,
    );
    expect(writeChangeAudience(swapped, saturday, 'callout-lifted', 'free-members')).toBe(swapped);
  });

  it('still allows a retarget that takes nothing away from anybody', () => {
    // Hiding the other callout only for paying members leaves everybody else with it.
    const edited = writeChangeAudience(SHIPPED, ELEVEN, 'callout', 'paying-members');
    expect(edited).not.toBe(SHIPPED);
    expect(strandingAudiences(SHIPPED, ELEVEN, 'callout').size).toBe(0);
  });
});
