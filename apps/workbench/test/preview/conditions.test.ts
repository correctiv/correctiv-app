import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { berlinInstant } from '@correctiv/app-core/lib/berlin-time';
import { AUDIENCES, readerOf } from '@correctiv/app-core/lib/home-audience';
import { parseHomeLayout, type HomeLayout } from '@correctiv/app-core/lib/home-layout';
import type { Entitlement } from '@correctiv/app-core/types/models';

import { MODULE_CONDITIONS } from '@/lib/home/conditions';

import { ROOT } from '../../plugin/collect.ts';
import { AUDIENCE_LABELS, CONDITION_LABELS, conditionOf } from '../../src/preview/home/Conditions';
import {
  changeHeldAt,
  formatLayoutDocument,
  SHIPPED,
  withAudience,
  withEdition,
  withHidden,
  withMoment,
  withSetting,
  writeChangeAudience,
  writeHidden,
} from '../../src/preview/home/document';
import { entitlementFor, FIXTURES } from '../../src/preview/frame/seed';

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
    expect(changeHeldAt(club, noon, 'mediathek')?.audience).toBe('paying-members');
    // Everyone is the absence of the key, as the document writes it.
    expect(writeChangeAudience(club, noon, 'mediathek', 'everyone')).toEqual(edited);
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
    expect(changeHeldAt(again, DAY(12), 'mediathek')?.audience).toBe('paying-members');
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

  it('prints what oxfmt would print, with audiences on sections and on changes', () => {
    const lifted = withMoment(SHIPPED, AT(6, 30));
    const cases: HomeLayout[] = [
      withAudience(SHIPPED, 'backstage', 'paying-members'),
      withAudience(SHIPPED, 'early-access', 'everyone'),
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
  it('reads the reader off the fixture in the address, by what the fixture writes', () => {
    expect(entitlementFor('onboarded', null)?.tier).toBe('paid');
    expect(entitlementFor('free-member', null)).toMatchObject({
      tier: 'free',
      appAccess: true,
      source: 'local-bundle',
    });
    expect(entitlementFor('fresh', null)).toBeNull();
  });

  it('puts the two fixtures in different audiences, which is what previewing one is', () => {
    const paying = readerOf(entitlementFor('onboarded', null));
    const free = readerOf(entitlementFor('free-member', null));
    expect(paying.has('paying-members')).toBe(true);
    expect(free.has('free-members')).toBe(true);
    expect(free.has('paying-members')).toBe(false);
    expect(readerOf(member('soli')).has('paying-members')).toBe(true);
  });

  it('falls back to what the app will find in storage when no fixture is named', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
    } as unknown as Storage;
    expect(entitlementFor(null, storage)).toBeNull();
    FIXTURES.find((fixture) => fixture.id === 'free-member')!.write({
      setItem: (key: string, value: string) => store.set(key, value),
    } as unknown as Storage);
    expect(entitlementFor(null, storage)?.tier).toBe('free');
    expect(entitlementFor('no-such-fixture', storage)?.tier).toBe('free');
  });
});
