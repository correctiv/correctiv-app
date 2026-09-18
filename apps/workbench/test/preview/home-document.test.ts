import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseHomeLayout, stateAt, type HomeLayout } from '@correctiv/app-core/lib/home-layout';
import { MODULE_SETTINGS } from '@correctiv/app-core/lib/home-settings';

import { ROOT } from '../../plugin/collect.ts';
import { SOURCES } from '../../content/sources.manifest.ts';
import {
  changedAt,
  differs,
  effectiveAt,
  formatLayoutDocument,
  HOME_LAYOUT_ENDPOINT,
  HOME_LAYOUT_KEY,
  HOME_TIME_KEY,
  inheritedAt,
  added,
  mintId,
  moduleLabel,
  MODULE_LABELS,
  momentAt,
  moved,
  movedMoment,
  pointAt,
  removed,
  sectionTestId,
  SETTING_LABELS,
  settingLabel,
  SHIPPED,
  spanOf,
  withHidden,
  withMoment,
  withoutMoment,
  withSetting,
} from '../../src/preview/home/document';

/**
 * The home-layout editor, held to what it cannot check itself.
 *
 * **It prints the file the way the repository does.** Save is only worth having if the
 * diff it leaves says what was changed and nothing else, and a printer that puts every
 * key on its own line turns a one-line edit into a sixty-line diff. `JSON.stringify` is
 * that printer, which is why there is one here, and why it is measured against the
 * repository's own oxfmt rather than against a description of what oxfmt does.
 *
 * **It never writes a change that changes nothing.** That is the model's own promise and
 * the editor is the half that can keep it: the parser will happily read a moment that
 * restates what it inherits, and a document full of them is a day nobody can read.
 *
 * **It names the modules and the settings in words.** Both label tables are a second
 * copy of something in the app or the core, and the direction a type cannot see is an
 * entry here that nothing answers to.
 *
 * **All three keys are spelled the same way at both ends.** That one is silent in
 * exactly the way ADR 0014 warns about: every edit would still "succeed", the app would
 * go on drawing the compiled-in document at the hour it actually is, and nothing
 * anywhere would say why.
 */

const FILE = 'packages/app-core/src/data/home.layout.json';

/** The order a layout puts its sections in, which is most of what an edit changes. */
function ids(layout: HomeLayout): string[] {
  return layout.sections.map((section) => section.id);
}

/** The shell may not import from `apps/mobile`, so the app is read as source text. */
function source(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

/** Every source file under a directory, so a new one is checked without being listed. */
function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) sources(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/**
 * The repository's own formatter, over a document this file printed.
 *
 * Its config is found by searching up from `cwd`, so the cwd is the repository and not
 * this package: `.oxfmtrc.json` is at the root and `printWidth` is the whole question.
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

describe('the document the editor writes', () => {
  it('prints the shipped file byte for byte', () => {
    expect(formatLayoutDocument(SHIPPED)).toBe(source(FILE));
  });

  it('prints what oxfmt would print, for an edit of every kind', () => {
    const lifted = withMoment(SHIPPED, AT(6, 30));
    const cases: HomeLayout[] = [
      SHIPPED,
      moved(SHIPPED, 'hero', -1),
      moved(SHIPPED, 'impact', -1),
      // The only documents here that an add or a remove produced, which is the whole of
      // why they are in this list. Not, as this comment claimed until a cold review
      // measured it, the cases nearest the printer's width: a minted id takes the longest
      // line to 75 characters, exactly where the shipped document already has it, against
      // a `printWidth` of 100. The two explicit edge cases below are what covers the break.
      added(SHIPPED, 3, 'callout-teaser'),
      added(added(SHIPPED, 0, 'callout-teaser'), 0, 'callout-teaser'),
      removed(SHIPPED, 'callout-lifted'),
      withHidden(SHIPPED, null, 'early-access', true),
      withHidden(SHIPPED, AT(11), 'mediathek', true),
      withSetting(SHIPPED, null, 'hero', 'pin', 'https://correctiv.org/x/'),
      withSetting(SHIPPED, AT(14), 'fact-checks', 'count', 3),
      lifted,
      withHidden(lifted, AT(6, 30), 'briefing', true),
      withoutMoment(withoutMoment(SHIPPED, AT(11)), AT(14)),
      // The edges: nothing left, a section carrying both optional fields, and the two
      // widths either side of the break. The longest line in the shipped document is
      // exactly `printWidth` without its trailing comma and breaks with it, so a printer
      // that forgets the comma is right on every document but this one.
      { version: 2, sections: [], moments: [] },
      {
        version: 2,
        sections: [{ id: 'a', module: 'article-hero', hidden: true, settings: { pin: null } }],
        moments: [],
      },
      {
        version: 2,
        sections: [
          { id: 'callout-lifted', module: 'callout-teaser', hidden: true },
          { id: 'callout', module: 'callout-teaser' },
        ],
        moments: [{ at: '11:00', minute: 660, changes: [{ id: 'callout-lifted', hidden: false }] }],
      },
    ];

    for (const layout of cases) {
      const printed = formatLayoutDocument(layout);
      expect(oxfmt(printed)).toBe(printed);
    }
  });

  it('writes a document the core takes back without a problem', () => {
    const edited = withSetting(
      withHidden(moved(SHIPPED, 'briefing', 1), AT(11), 'backstage', true),
      AT(14),
      'fact-checks',
      'count',
      4,
    );
    const { layout, problems } = parseHomeLayout(JSON.parse(formatLayoutDocument(edited)));
    expect(problems).toEqual([]);
    expect(layout).toEqual(edited);
  });

  it('leaves the optional fields out when they say nothing', () => {
    // Switching a section off and on again has to leave the line it started as, or "off
    // and on again" is a diff. The same of a setting written and taken away.
    expect(
      formatLayoutDocument(
        withHidden(withHidden(SHIPPED, null, 'hero', true), null, 'hero', false),
      ),
    ).toBe(source(FILE));
    expect(
      formatLayoutDocument(
        withSetting(
          withSetting(SHIPPED, null, 'hero', 'pin', 'https://x/'),
          null,
          'hero',
          'pin',
          undefined,
        ),
      ),
    ).toBe(source(FILE));
  });

  /** A moment nobody has put anything on yet is a point somebody has just put down. */
  it('writes a moment with no changes, and the core reads it back as one', () => {
    const printed = formatLayoutDocument(withMoment(SHIPPED, AT(6, 30)));
    expect(printed).toContain('"at": "06:30"');
    const { problems } = parseHomeLayout(JSON.parse(printed));
    expect(problems).toEqual([]);
  });

  it('writes no moments field at all when the day does not change', () => {
    const flat = withoutMoment(withoutMoment(SHIPPED, AT(11)), AT(14));
    expect(formatLayoutDocument(flat)).not.toContain('moments');
  });
});

describe('the vocabulary the editor offers', () => {
  /**
   * ADR 0047 §3: one operation with two controls. An arrow passes `-1` or `1`, a drop
   * passes how far the block travelled, and the document sees one function either way.
   */
  it('moves a block any distance, and clamps rather than refusing', () => {
    const last = SHIPPED.sections.length - 1;
    expect(ids(moved(SHIPPED, 'impact', -last))[0]).toBe('impact');
    expect(ids(moved(SHIPPED, 'header', last)).at(-1)).toBe('header');
    // Past the end is the end, because a drop below the last block is a drop at the end
    // and not a refusal: the pointer is where it is.
    expect(ids(moved(SHIPPED, 'header', 99))).toEqual(ids(moved(SHIPPED, 'header', last)));
    expect(ids(moved(SHIPPED, 'impact', -99))).toEqual(ids(moved(SHIPPED, 'impact', -last)));
  });

  it('answers with what it was given when the clamp leaves the block where it was', () => {
    // So that a caller can tell nothing happened. Not, as an earlier comment claimed,
    // because an equal copy would light up Save: `differs` compares the two documents as
    // printed text, so it would read as unchanged either way. A cold review measured that
    // and the justification was wrong rather than the behaviour.
    expect(moved(SHIPPED, SHIPPED.sections[0]!.id, -5)).toBe(SHIPPED);
    expect(moved(SHIPPED, SHIPPED.sections.at(-1)!.id, 5)).toBe(SHIPPED);
    expect(moved(SHIPPED, 'hero', 0)).toBe(SHIPPED);
  });

  it('refuses a delta that is not a whole number of places', () => {
    /*
     * `NaN` survives `Math.max` and `Math.min` unchanged and `splice(NaN, …)` inserts at
     * the front, so a bad delta moved a block to the TOP of the day rather than doing
     * nothing — measured in a cold review. A fraction slipped past the identity test and
     * handed back an equal copy. Neither is reachable from the arrows or from a drop,
     * which is why they are refused rather than thrown at.
     */
    for (const delta of [
      Number.NaN,
      0.5,
      -0.5,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(moved(SHIPPED, 'hero', delta)).toBe(SHIPPED);
    }
    // And the whole numbers either side of them still work.
    expect(ids(moved(SHIPPED, 'hero', -1))[2]).toBe('hero');
    expect(ids(moved(SHIPPED, 'hero', 1))[4]).toBe('hero');
  });

  /**
   * The property a drop rests on, now that there is no conversion in front of it.
   *
   * ADR 0053 §2 replaced the gap-to-distance arithmetic — `deltaTo`, which was wrong by
   * exactly one place in every first attempt and by the amount nobody notices in a
   * screenshot — with a slot counted among the OTHER blocks. `carry.ts` answers that slot
   * and has its own test; what is checked here is the other half of the claim, that
   * `moved` takes it unconverted and puts the block exactly there.
   */
  it('lands a block at the slot it was dropped in, counted among the other blocks', () => {
    const order = ids(SHIPPED);

    for (let from = 0; from < order.length; from += 1) {
      const rest = order.filter((id) => id !== order[from]);
      for (let slot = 0; slot < order.length; slot += 1) {
        const after = ids(moved(SHIPPED, order[from]!, slot - from));
        expect(after).toEqual([...rest.slice(0, slot), order[from]!, ...rest.slice(slot)]);
      }
    }
  });

  it('moves a section one step, and refuses to move it off either end', () => {
    const first = SHIPPED.sections[0]!.id;
    const last = SHIPPED.sections.at(-1)!.id;

    expect(moved(SHIPPED, first, -1)).toBe(SHIPPED);
    expect(moved(SHIPPED, last, 1)).toBe(SHIPPED);
    expect(moved(SHIPPED, 'nothing-by-this-name', 1)).toBe(SHIPPED);
    expect(ids(moved(SHIPPED, 'hero', -1)).slice(0, 4)).toEqual([
      'header',
      'feed-status',
      'hero',
      'callout-lifted',
    ]);
  });

  /**
   * ADR 0046 §2: the module's name, then the smallest suffix the document is not using.
   * An id is an address rather than a label, so nothing offers to edit one and the
   * minting has to be the only thing that ever writes one.
   */
  it('mints an id from the module, and then from the smallest free suffix', () => {
    // `callout-teaser` is in the shipped document twice already, as `callout-lifted` and
    // `callout` — hand-written names, which is why the first mint is the bare module.
    expect(mintId(SHIPPED, 'callout-teaser')).toBe('callout-teaser');

    const once = added(SHIPPED, 0, 'callout-teaser');
    expect(mintId(once, 'callout-teaser')).toBe('callout-teaser-2');
    expect(mintId(added(once, 0, 'callout-teaser'), 'callout-teaser')).toBe('callout-teaser-3');
  });

  it('fills a gap the middle of the run has, rather than counting past it', () => {
    // Smallest free, not next after the highest. A document that lost its `-2` gets it
    // back, which is ADR 0046 §3: a removed id may come back, and the reason that is
    // safe is the single-writer model rather than luck.
    const three = ['callout-teaser', 'callout-teaser', 'callout-teaser'].reduce(
      (layout, module) => added(layout, 0, module),
      SHIPPED,
    );
    const gapped = removed(three, 'callout-teaser-2');
    expect(mintId(gapped, 'callout-teaser')).toBe('callout-teaser-2');
  });

  it('refuses a module name no document could carry', () => {
    // The only input a cold review found where an editing operation produced a file the
    // core rejects: an empty name mints an empty id and the parser answers
    // `section-id-invalid`. The palette cannot reach it, so what this holds is the
    // precondition rather than a path somebody can walk.
    for (const bad of ['', ' ', '-x', '2x', 'a b', 'a/b', '__proto__']) {
      expect(() => mintId(SHIPPED, bad)).toThrow(/module name/);
      expect(() => added(SHIPPED, 0, bad)).toThrow(/module name/);
    }
    // And the shape every real module has still passes.
    for (const good of ['callout-teaser', 'home-header', 'x', 'x-2']) {
      expect(() => mintId(SHIPPED, good)).not.toThrow();
    }
  });

  it('adds a block carrying nothing, at the place it was asked for', () => {
    const at2 = added(SHIPPED, 2, 'impact-footer');
    expect(at2.sections[2]).toEqual({ id: 'impact-footer', module: 'impact-footer' });
    expect(at2.sections).toHaveLength(SHIPPED.sections.length + 1);
    // Nothing else moved, and the block carries no settings and no `hidden`: the honest
    // state of a place somebody has just put down, and the state in which every setting
    // it understands falls back to what the module itself would do.
    expect(ids(at2).filter((id) => id !== 'impact-footer')).toEqual(ids(SHIPPED));

    // Both ends, and past both ends, because the insertion mark hands in an index.
    expect(ids(added(SHIPPED, 0, 'impact-footer'))[0]).toBe('impact-footer');
    expect(ids(added(SHIPPED, SHIPPED.sections.length, 'impact-footer')).at(-1)).toBe(
      'impact-footer',
    );
    expect(ids(added(SHIPPED, 99, 'impact-footer')).at(-1)).toBe('impact-footer');
    expect(ids(added(SHIPPED, -3, 'impact-footer'))[0]).toBe('impact-footer');
  });

  /**
   * ADR 0045 §4: removing a block takes with it every change that names it. A change
   * naming a place that is not there is `change-id-unknown` — the parser reports it and
   * drops it — and the editor is the half that can know.
   */
  it('removes a block and every change that named it', () => {
    // `callout-lifted` is named by the 11:00 moment and by the 14:00 one.
    const before = SHIPPED.moments.flatMap((moment) =>
      moment.changes.filter((change) => change.id === 'callout-lifted'),
    );
    expect(before.length).toBeGreaterThan(0);

    const gone = removed(SHIPPED, 'callout-lifted');
    expect(ids(gone)).not.toContain('callout-lifted');
    expect(
      gone.moments.flatMap((moment) => moment.changes.filter((c) => c.id === 'callout-lifted')),
    ).toEqual([]);
    // And what the core says about the result, which is the only opinion that counts:
    // a document the parser reads back without a complaint.
    expect(parseHomeLayout(JSON.parse(formatLayoutDocument(gone))).problems).toEqual([]);
  });

  it('keeps a moment whose last change it just took away', () => {
    // A point is a thing somebody put down, and `withMoment` makes an empty one on
    // purpose. One emptying itself because a block was removed elsewhere in the day
    // would be the editor undoing something nobody asked it to undo.
    const alone = withHidden(withMoment(SHIPPED, AT(9)), AT(9), 'briefing', true);
    const gone = removed(alone, 'briefing');
    expect(momentAt(gone, AT(9))).not.toBeNull();
    expect(momentAt(gone, AT(9))!.changes).toEqual([]);
  });

  it('answers with what it was given for an id the document does not have', () => {
    expect(removed(SHIPPED, 'nothing-by-this-name')).toBe(SHIPPED);
  });

  /**
   * The rule that makes a day readable, and the one the parser cannot enforce: a change
   * equal to what the point already inherits is not written, it is taken out.
   */
  it('writes no change that restates what the moment already inherits', () => {
    // `callout-lifted` is hidden at the start of the day and shown by the 11:00 moment.
    // Setting it hidden at 11:00 removes that change rather than writing `hidden: true`.
    const back = withHidden(SHIPPED, AT(11), 'callout-lifted', true);
    const at11 = back.moments.find((moment) => moment.minute === AT(11))!;
    expect(at11.changes.map((change) => change.id)).toEqual(['callout']);

    // And the other direction: a value that differs IS written, `false` included, which
    // is the asymmetry the model turns on — `hidden: false` says nothing in a section
    // and is the instruction that brings a place back at a moment.
    const early = withHidden(withMoment(SHIPPED, AT(9)), AT(9), 'callout-lifted', false);
    expect(momentAt(early, AT(9))!.changes).toEqual([{ id: 'callout-lifted', hidden: false }]);
  });

  /**
   * The same rule, reached the way the controls reach it.
   *
   * The test above clears a setting with `undefined`, and no control sends that: the
   * picker sends `null` for "The newest investigation (no pin)" and the number field
   * sends a number. Both are values equal to what the point inherits when nothing else
   * has been chosen — `null` is `HERO_PIN`'s fallback, five is `RESEARCH_COUNT`'s — and
   * both were written into the document and badged SET HERE, because an absent inherited
   * value was read as "nothing to compare against" rather than as the module's default.
   */
  it('writes no setting equal to the module’s own fallback', () => {
    // "The newest investigation (no pin)", at the day's start and at a moment, with
    // nothing pinned anywhere: the state the place is already in, so nothing is written.
    expect(differs(withSetting(SHIPPED, null, 'hero', 'pin', null))).toBe(false);
    expect(differs(withSetting(SHIPPED, AT(11), 'hero', 'pin', null))).toBe(false);

    // The counts, typed back to the number the module draws when nobody has chosen.
    expect(differs(withSetting(SHIPPED, null, 'latest-research', 'count', 5))).toBe(false);
    expect(differs(withSetting(SHIPPED, AT(14), 'fact-checks', 'count', 8))).toBe(false);

    // And the direction that must still be written: a pin taken off at a later moment is
    // ADR 0036 §3's rule coming back, which is one change and not the deletion of one.
    const pinned = withSetting(SHIPPED, null, 'hero', 'pin', 'https://x/');
    const evening = withSetting(pinned, AT(14), 'hero', 'pin', null);
    expect(momentAt(evening, AT(14))!.changes).toContainEqual({
      id: 'hero',
      settings: { pin: null },
    });
  });

  /**
   * The fallback is what the DAY'S START is edited against, and nothing else is.
   *
   * A section's own value is what a person at the day's start is editing, not what they
   * inherit; comparing against it would make typing the number already in the field
   * delete the field and drop the place back to five.
   */
  it('keeps a value at the day’s start when it is typed again', () => {
    const three = withSetting(SHIPPED, null, 'latest-research', 'count', 3);
    expect(withSetting(three, null, 'latest-research', 'count', 3)).toEqual(three);

    // And at a moment, three IS what is inherited, so it is not written there.
    expect(
      momentAt(withSetting(three, AT(11), 'latest-research', 'count', 3), AT(11))!.changes,
    ).toEqual(momentAt(three, AT(11))!.changes);
  });

  /**
   * An edit at one point changes what the points after it inherit, so they are re-checked.
   *
   * `callout-lifted` starts the day hidden, 11:00 brings it back and 14:00 hides it
   * again. Show it at the day's start and 11:00's change is a line saying "look here,
   * something happens" where nothing does.
   */
  it('takes out a later change the edit has made a restatement', () => {
    const shown = withHidden(SHIPPED, null, 'callout-lifted', false);

    expect(momentAt(shown, AT(11))!.changes).toEqual([{ id: 'callout', hidden: true }]);
    // 14:00 still differs from what it inherits, so it stays exactly as it was.
    expect(momentAt(shown, AT(14))!.changes).toEqual([
      { id: 'callout-lifted', hidden: true },
      { id: 'callout', hidden: false },
    ]);
  });

  /**
   * And a gesture on the track does not, because a person repeats and reverses those.
   *
   * Dragging a point past another and back would otherwise lose whatever it made
   * redundant on the way out, and there is no undo here to get it back with.
   */
  it('leaves the later moments alone when a point is moved or removed', () => {
    const later = movedMoment(SHIPPED, AT(11), AT(15));
    expect(momentAt(later, AT(14))!.changes).toEqual([
      { id: 'callout-lifted', hidden: true },
      { id: 'callout', hidden: false },
    ]);
    expect(movedMoment(later, AT(15), AT(11))).toEqual(SHIPPED);

    expect(momentAt(withoutMoment(SHIPPED, AT(11)), AT(14))!.changes).toHaveLength(2);
  });

  it('takes a change out of the document when its last field goes', () => {
    const pinned = withSetting(SHIPPED, AT(14), 'hero', 'pin', 'https://x/');
    expect(pinned.moments.find((m) => m.minute === AT(14))!.changes).toContainEqual({
      id: 'hero',
      settings: { pin: 'https://x/' },
    });

    const cleared = withSetting(pinned, AT(14), 'hero', 'pin', undefined);
    expect(cleared.moments.find((m) => m.minute === AT(14))!.changes.map((c) => c.id)).toEqual([
      'callout-lifted',
      'callout',
    ]);
  });

  it('adds a point, moves it with what it carries, and takes it away again', () => {
    const added = withHidden(withMoment(SHIPPED, AT(6, 30)), AT(6, 30), 'briefing', true);
    expect(added.moments.map((moment) => moment.at)).toEqual(['06:30', '11:00', '14:00']);

    const later = movedMoment(added, AT(6, 30), AT(7, 45));
    expect(later.moments.map((moment) => moment.at)).toEqual(['07:45', '11:00', '14:00']);
    expect(momentAt(later, AT(7, 45))?.changes).toEqual([{ id: 'briefing', hidden: true }]);

    expect(withoutMoment(later, AT(7, 45)).moments.map((m) => m.at)).toEqual(['11:00', '14:00']);
  });

  /** Two moments at one time is the one thing the parser refuses, so the editor cannot make one. */
  it('refuses to move a point onto another point', () => {
    expect(movedMoment(SHIPPED, AT(11), AT(14))).toBe(SHIPPED);
    expect(withMoment(SHIPPED, AT(11))).toBe(SHIPPED);
  });

  it('says which point a minute is in, and how long it lasts', () => {
    expect(pointAt(SHIPPED, AT(9))).toBeNull();
    expect(pointAt(SHIPPED, AT(11))).toBe(AT(11));
    expect(pointAt(SHIPPED, AT(13, 59))).toBe(AT(11));
    expect(pointAt(SHIPPED, AT(14))).toBe(AT(14));

    expect(spanOf(SHIPPED, null)).toEqual({ from: 0, to: AT(11) });
    expect(spanOf(SHIPPED, AT(11))).toEqual({ from: AT(11), to: AT(14) });
    expect(spanOf(SHIPPED, AT(14))).toEqual({ from: AT(14), to: 24 * 60 });
  });

  /** What a point inherits is everything strictly before it; what it produces includes it. */
  it('tells what a point inherits from what it produces', () => {
    const lifted = (sections: readonly { id: string; hidden?: boolean }[]) =>
      Boolean(sections.find((s) => s.id === 'callout-lifted')?.hidden);

    expect(lifted(inheritedAt(SHIPPED, AT(11)))).toBe(true);
    expect(lifted(effectiveAt(SHIPPED, AT(11)))).toBe(false);
    expect(inheritedAt(SHIPPED, null)).toEqual(SHIPPED.sections);
  });

  it('is unchanged until something changes, and says so as the file would', () => {
    expect(differs(SHIPPED)).toBe(false);
    expect(differs(moved(SHIPPED, 'hero', -1))).toBe(true);
    expect(differs(withHidden(withHidden(SHIPPED, null, 'hero', true), null, 'hero', false))).toBe(
      false,
    );
  });

  /**
   * The badge is about the minute being looked at, which is the only honest comparison
   * once the document is a day.
   */
  it('counts a change at the minute it happens and not at the others', () => {
    const edited = withHidden(SHIPPED, AT(11), 'mediathek', true);
    expect(changedAt(edited, AT(9))).toEqual([]);
    expect(changedAt(edited, AT(12))).toEqual(['mediathek']);
    expect(changedAt(edited, AT(15))).toEqual(['mediathek']);
  });

  it('counts a move as one change and not as two', () => {
    // A section that moved makes its neighbour move too, and an editor who lifted one
    // block should not be told they changed four.
    expect(changedAt(SHIPPED, AT(9))).toEqual([]);
    expect(changedAt(moved(SHIPPED, 'hero', -1), AT(9))).toEqual(['hero', 'callout-lifted']);
  });
});

describe('the words an editor reads', () => {
  const modules = source('apps/mobile/src/lib/home/modules.tsx');
  const mapped = [
    ...modules
      .slice(modules.indexOf('export const HOME_MODULES'))
      .matchAll(/^ {2}'([a-z0-9-]+)':/gm),
  ].map((hit) => hit[1]!);

  it('reads the app’s module map', () => {
    // A regular expression that stopped matching would make every assertion below
    // vacuously true, and the map is the thing being checked against.
    expect(mapped.length).toBeGreaterThan(8);
  });

  it('has a name and a description for every module the app can draw', () => {
    expect(mapped.filter((module) => !Object.hasOwn(MODULE_LABELS, module))).toEqual([]);
  });

  it('describes no module the app has not got', () => {
    expect(Object.keys(MODULE_LABELS).filter((module) => !mapped.includes(module))).toEqual([]);
  });

  it('shows no module id where a name belongs', () => {
    // The whole point of the labels: `faktencheck-rail` tells a newsroom nothing about
    // what it will see. A label that merely repeats the id is the failure, and it is one
    // a type cannot see.
    // The English, off the descriptor. Both halves are messages since 2026-09-18,
    // so what this reads is the `defaultMessage` rather than a bare string: the
    // question it asks is about the words a module is given, and the source is
    // where those words are written.
    for (const [module, { label, what }] of Object.entries(MODULE_LABELS)) {
      const english = typeof label === 'string' ? label : label.defaultMessage;
      expect(english).not.toBe(module);
      expect(english).not.toMatch(/-/);
      expect(what.defaultMessage.length).toBeGreaterThan(20);
    }
  });

  it('still draws a row for a module it has never heard of', () => {
    // ADR 0036 §7's rule, in the editor: a document ahead of this tool stays editable.
    // The one label that is a plain string rather than a message: an id.
    expect(moduleLabel('something-new').label).toBe('something-new');
  });

  /**
   * And the same, one rung down, for the settings.
   *
   * The core owns which keys exist; this owns the question a person is asked about one.
   * A setting added there with no words here would be a control labelled `count`.
   */
  it('asks a question for every setting the core declares, and invents none', () => {
    const declared = Object.entries(MODULE_SETTINGS).flatMap(([module, specs]) =>
      specs.map((spec) => `${module}.${spec.key}`),
    );
    expect(declared.filter((key) => !Object.hasOwn(SETTING_LABELS, key))).toEqual([]);
    expect(Object.keys(SETTING_LABELS).filter((key) => !declared.includes(key))).toEqual([]);
    for (const [key, { label, what }] of Object.entries(SETTING_LABELS)) {
      const english = typeof label === 'string' ? label : label.defaultMessage;
      expect(english).not.toBe(key.split('.')[1]);
      expect(what.defaultMessage.length).toBeGreaterThan(10);
    }
  });

  it('falls back to the key for a setting it has no words for', () => {
    expect(
      settingLabel('quiz', { key: 'answers', kind: 'count', min: 1, max: 4, fallback: 2 }).label,
    ).toBe('answers');
  });
});

/**
 * The article picker says it is sample data, and it says it from the inventory.
 *
 * `SOURCES.md` and `content/sources.manifest.ts` are how this repository already tells a
 * live source from a stand-in; the picker reads the row rather than carrying a sentence
 * of its own, so the marking goes by itself on the day the row turns live. What this
 * holds is the join: a row with that id, marked sample, naming what it stands in for.
 */
describe('the sample data behind the article picker', () => {
  const row = SOURCES.find((entry) => entry.id === 'home-pins');

  it('has a row in the inventory, marked as a stand-in', () => {
    expect(row?.status).toBe('sample');
    expect(row?.standsIn).toBeTruthy();
    expect(row?.module).toBe('packages/app-core/src/data/home-pins.ts');
  });

  it('is what the panel reads, rather than a sentence typed beside the control', () => {
    const panel = source('apps/workbench/src/preview/home/HomeDocument.tsx');
    expect(panel).toContain("SOURCES.find((entry) => entry.id === 'home-pins')");
    expect(panel).toContain("PIN_SOURCE?.status === 'sample'");
  });
});

describe('the three ends of the seam', () => {
  it('spells the storage keys the way the app reads them', () => {
    const layout = source('apps/mobile/src/lib/home/layout.ts');
    expect(layout).toContain(`export const HOME_LAYOUT_OVERRIDE_KEY = '${HOME_LAYOUT_KEY}';`);

    const clock = source('apps/mobile/src/lib/home/clock.ts');
    expect(clock).toContain(`export const HOME_TIME_OVERRIDE_KEY = '${HOME_TIME_KEY}';`);
  });

  /**
   * The simulated clock is in the address, which is what stops it becoming durable state
   * nobody can see: shut the tab on a simulated evening and every later visit would open
   * on it. The panel writes the key from `state.time` on every render, so an address
   * that names no time takes the key away.
   */
  it('takes the simulated time from the address and writes it on every render', () => {
    const state = source('apps/workbench/src/preview/state.ts');
    expect(state).toContain("p.set('tm', state.time)");

    /*
     * The write is in `usePreview` and not in the panel, which is the difference
     * between "the address decides" and "the tool that happens to be open decides".
     * A simulated clock that outlived the panel would be a frame showing an hour with
     * nothing on screen saying so, and one that outlived the view would be durable
     * state nobody can see.
     */
    const preview = source('apps/workbench/src/preview/Preview.tsx');
    expect(preview).toContain('useEffect(() => applyHomeTime(state.time), [state.time])');
    expect(preview).toContain('useEffect(() => () => applyHomeTime(null), [])');

    /*
     * And the third exit, which neither of those two is: the DOCUMENT going away. Both
     * of them run while the page is alive, so closing the tab left the key behind and
     * pinned `<site>/app/` to that hour for the whole origin. The assertion is the
     * listener rather than what it does, because what was missing was ever attaching
     * one; `scripts/home-live.mjs` is what proves it works, against a real browser,
     * which is the only thing that has a document to lose.
     */
    expect(preview).toContain("window.addEventListener('pagehide', hide)");
    expect(preview).toContain("window.addEventListener('pageshow', show)");

    const clock = source('apps/workbench/src/preview/home/clock.ts');
    expect(clock).toContain('window.localStorage.removeItem(HOME_TIME_KEY)');
  });

  it('spells a section’s testID the way the app renders it', () => {
    const app = source('apps/mobile/src/lib/home/modules.tsx');
    expect(app).toContain(
      'export const placeTestID = (id: string): string => `home-section-${id}`;',
    );
    expect(sectionTestId('hero')).toBe('home-section-hero');
  });

  it('answers on the address the dev server listens on', () => {
    const plugin = source('apps/workbench/plugin/home-layout.ts');
    expect(plugin).toContain('HOME_LAYOUT_ENDPOINT');
    expect(HOME_LAYOUT_ENDPOINT.startsWith('/__workbench/')).toBe(true);
  });

  /**
   * The endpoint is not in the published bundle, and this is what says so.
   *
   * `configureServer` is a hook `vite build` never calls, so the middleware cannot reach
   * the published site — but only as long as nothing else imports it. An import of
   * `plugin/home-layout.ts` from anywhere under `src/` would put the write path, and
   * `node:fs` with it, into the bundle a browser downloads.
   */
  it('is reachable from the dev server and from nowhere in the bundle', () => {
    const index = source('apps/workbench/plugin/index.ts');
    expect(index).toContain('server.middlewares.use(homeLayoutEndpoint(server))');

    const importers = sources(join(ROOT, 'apps/workbench/src')).filter((file) =>
      /from\s+'[^']*plugin\/home-layout/.test(readFileSync(file, 'utf8')),
    );
    expect(importers).toEqual([]);
  });

  /**
   * And the parser it validates with is loaded through Vite rather than imported.
   *
   * A static import would be an exception thrown while `vite.config.ts` loads — Node
   * refuses the core's `data/home.layout.json` without an import attribute — and the
   * whole site would fail to start with an error about a JSON file. Easy to "fix" by
   * writing a second validator in the plugin, which is the copy ADR 0036 §12 exists to
   * prevent, so the constraint is written down where it would be undone.
   */
  it('loads the core through the dev server, not through Node', () => {
    const plugin = source('apps/workbench/plugin/home-layout.ts');
    expect(plugin).toContain("server.ssrLoadModule(\n      '@correctiv/app-core/lib/home-layout',");
    expect(plugin).not.toMatch(/^import .*@correctiv\/app-core/m);
  });
});

/**
 * The editor and the app agree about what a day looks like.
 *
 * `effectiveAt` is what the panel draws and `stateAt` is what the app draws, and they are
 * the same function reached two ways — this is what says the tool is showing the thing
 * the frame beside it is showing, rather than a second opinion about it.
 */
describe('the panel and the frame', () => {
  it('draws the state the app would draw, at every point of the shipped day', () => {
    for (const point of [null, AT(11), AT(14)]) {
      expect(effectiveAt(SHIPPED, point)).toEqual(stateAt(SHIPPED, point ?? 0));
    }
  });
});
