import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../../plugin/collect.ts';
import { blockName, SHIPPED, whereAt } from '../../src/preview/home/document';
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
    expect(whereAt(SHIPPED, 1)).toBe(
      `between ${blockName(SHIPPED.sections[0]!)} and ${blockName(SHIPPED.sections[1]!)}`,
    );
  });

  it('tells two blocks of one module apart, which the module’s words cannot', () => {
    // The shipped document has the callout twice, so "between Participation callout and
    // Participation callout" was a place and "Remove Participation callout from the day"
    // was the name of two different buttons. Measured in the accessibility tree by a cold
    // review. The id is what is unique and it is already at the end of every row.
    const callouts = SHIPPED.sections.filter((section) => section.module === 'callout-teaser');
    expect(callouts.length).toBeGreaterThan(1);
    expect(new Set(callouts.map(blockName)).size).toBe(callouts.length);
    for (const section of callouts) expect(blockName(section)).toContain(section.id);
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
    // Only the first half is held here. `MODULE_LABELS` is a literal in the module this
    // file imports, so a floor under its size would be a floor within nothing of zero —
    // and the real check, in both directions and against the app's own source, is
    // `home-document.test.ts`'s "has a name and a description for every module the app
    // can draw". A cold review found the floor here doing nothing and it is gone.
    expect(PALETTE).toMatch(/moduleLabel\(module\)/);
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
  it('puts a mark before every block and one after the last', () => {
    // One more mark than there are blocks, out of two call sites: the one each row draws
    // above itself, and the one after the list for the gap no block follows.
    expect(PANEL).toMatch(/whereAt\(layout, index\)/);
    expect(PANEL).toMatch(/whereAt\(layout, layout\.sections\.length\)/);
    expect(PANEL).toMatch(/added\(layout, index, module\)/);
    expect(PANEL).toMatch(/added\(layout, layout\.sections\.length, module\)/);
  });

  it('keeps the list a list, so a reader hears the blocks and not the gaps', () => {
    // A `list` may own only `listitem`s. The marks were their own presentational items
    // for a while, and Chrome did report twelve items — but thirteen buttons as
    // non-`listitem` children of a list is a thing other assistive technology may resolve
    // differently. Each mark is inside the row it comes before now, and the last one is
    // outside the list entirely, which is simply valid and needs no prediction.
    expect(PANEL).not.toMatch(/role="presentation"/);
    expect(PANEL).toMatch(/\{before\}/);
  });

  it('removes through the one function that also takes the changes', () => {
    // ADR 0045 §4: removing a block takes with it every change that names it, and
    // `removed` is the half that knows. A row calling `filter` on the sections itself
    // would leave `change-id-unknown` behind on every parse.
    expect(PANEL).toMatch(/removed\(layout, section\.id\)/);
    expect(PANEL).toMatch(/aria-label=\{`Remove \$\{spoken\} from the day`\}/);
  });

  it('names a specimen without wrapping the app’s own controls in a button', () => {
    /*
     * A cold review measured what the wrapped version cost: nine of the modules carry
     * pressables of their own, so clicking the picture of the lead article added nothing,
     * and clicking "Teilnehmen" inside the callout closed the dialog and added nothing,
     * silently. React reported `<button> cannot be a descendant of <button>` on every
     * open and nothing here could see it — `workbench:renders` fails on a console error
     * and never opens a dialog.
     */
    expect(PALETTE).toMatch(/inert/);
    expect(PALETTE).toMatch(/absolute inset-0/);
    // The drawing is a sibling of the button rather than its child: the `<button>` closes
    // before `HomeBlock` is reached.
    const button = PALETTE.indexOf('onClick={onPick}');
    const closed = PALETTE.indexOf('</button>', button);
    expect(closed).toBeGreaterThan(-1);
    expect(PALETTE.indexOf('<HomeBlock')).toBeGreaterThan(closed);
  });
});
