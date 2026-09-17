import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../../plugin/collect.ts';
import { MODULE_LABELS, SHIPPED, whereAt } from '../../src/preview/home/document';
import { code } from '../source.ts';

/**
 * Adding a block, and saying where it is going before saying what it is.
 *
 * ADR 0045 §4 makes the arrangement the editor's and §6 puts a thin mark between every
 * pair of blocks, opening the modules available. ADR 0046 §1 decides where that list
 * comes from and what it cost: the palette IS `HOME_MODULES`, and the app's check that
 * the shipped document names every renderer was retired rather than replaced, because a
 * module waiting in a palette stopped being a module nobody can reach.
 *
 * The naming is a pure function and is run here. The wiring is read as text, which is the
 * weaker half — it catches a line deleted or moved and not a mark drawn in the wrong
 * place.
 */

const read = (path: string): string => code(readFileSync(join(ROOT, path), 'utf8'));

const PALETTE = read('apps/workbench/src/preview/home/Palette.tsx');
const PANEL = read('apps/workbench/src/preview/home/HomeDocument.tsx');
const APP_CHECK = read('apps/mobile/__tests__/home-layout.test.tsx');

describe('where a block is going, in words', () => {
  /*
   * The mark is a hairline between two rows and the dialog covers the list it came from,
   * so this sentence is the only thing that says where. Named by its neighbours rather
   * than by a number: "after the lead article" is a place, "at index 3" is something
   * somebody would have to count to check.
   */
  it('names the two ends of the day rather than the block beyond them', () => {
    expect(whereAt(SHIPPED, 0)).toBe('at the top of the day');
    expect(whereAt(SHIPPED, SHIPPED.sections.length)).toBe('at the end of the day');
  });

  it('names the blocks either side, in the words the rows use', () => {
    const first = MODULE_LABELS[SHIPPED.sections[0]!.module]!.name;
    const second = MODULE_LABELS[SHIPPED.sections[1]!.module]!.name;
    expect(whereAt(SHIPPED, 1)).toBe(`between ${first} and ${second}`);
  });

  it('answers for an index past the end rather than throwing', () => {
    // The marks hand in `index + 1` and the ends are where an off-by-one lives.
    expect(whereAt(SHIPPED, 99)).toBe('at the end of the day');
    expect(whereAt(SHIPPED, -1)).toBe('at the top of the day');
  });
});

describe('the palette is the registry', () => {
  /*
   * ADR 0046 §1. A module added to the app appears in the editor with nothing listing it
   * a second time, and that mechanism is what replaced the check the app used to carry.
   */
  it('reads the app’s own table and keeps no list beside it', () => {
    expect(PALETTE).toMatch(/import \{ HOME_MODULES \} from '@\/lib\/home\/modules'/);
    expect(PALETTE).toMatch(/Object\.keys\(HOME_MODULES\)/);
  });

  it('gives every module in that table words a newsroom can read', () => {
    // The other half of §1, and the half that was already there: a module reaching the
    // palette without an entry here would be offered as `faktencheck-rail`.
    // `home-document.test.ts` holds this in both directions against the app's source;
    // what is held here is that the palette shows the label rather than the id.
    expect(PALETTE).toMatch(/moduleLabel\(module\)/);
    expect(Object.keys(MODULE_LABELS).length).toBeGreaterThan(0);
  });

  it('no longer refuses a module the shipped document does not place', () => {
    // The retired check, named so that putting it back is a decision rather than a habit.
    // Retiring it is ADR 0046 §1: the condition it flagged stopped being a fault the day
    // a module could wait in a palette.
    expect(APP_CHECK).not.toMatch(/names every renderer this app holds/);
    // And the direction that did NOT go: a document naming a module the app has no
    // renderer for is still a fault, and still the app's to refuse.
    expect(APP_CHECK).toMatch(/names a renderer this app holds for every section/);
  });
});

describe('the marks and the verbs they carry', () => {
  it('puts a mark at each end as well as between every pair', () => {
    // One more mark than there are blocks. Read as the two call sites it takes: the one
    // before the map, and the one inside it that follows each row.
    expect(PANEL).toMatch(/whereAt\(layout, 0\)/);
    expect(PANEL).toMatch(/whereAt\(layout, index \+ 1\)/);
    expect(PANEL).toMatch(/added\(layout, 0, module\)/);
    expect(PANEL).toMatch(/added\(layout, index \+ 1, module\)/);
  });

  it('keeps the marks out of the count of what is on the home screen', () => {
    // A reader counting the places on the home screen should hear twelve, not
    // twenty-five. The button inside each mark keeps its own role and its own label.
    expect(PANEL).toMatch(/<li role="presentation">/);
  });

  it('removes through the one function that also takes the changes', () => {
    // ADR 0045 §4: removing a block takes with it every change that names it, and
    // `removed` is the half that knows. A row calling `filter` on the sections itself
    // would leave `change-id-unknown` behind on every parse.
    expect(PANEL).toMatch(/removed\(layout, section\.id\)/);
    expect(PANEL).toMatch(/aria-label=\{`Remove \$\{name\} from the day`\}/);
  });
});
