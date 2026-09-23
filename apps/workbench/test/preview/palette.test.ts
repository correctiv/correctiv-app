import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';

import { floorFaults } from '@correctiv/prose-and-code';

import { ROOT } from '../../plugin/collect.ts';
import { de } from '../../src/i18n/catalogue/de';
import { say } from '../../src/i18n/messages';
import { blockName, MODULE_LABELS, SHIPPED, whereAt } from '../../src/preview/home/document';
import { code } from '../source.ts';

/**
 * Adding a block, and saying where it is going before saying what it is.
 *
 * ADR 0045 §4 makes the arrangement the editor's and §6 puts a thin mark between every
 * pair of blocks, opening the modules available. ADR 0046 §1 decides where that list
 * comes from and what it cost: the palette was `HOME_MODULES` itself, and the app's check
 * that the shipped document names every renderer was retired rather than replaced,
 * because a module waiting in a palette stopped being a module nobody can reach.
 *
 * ADR 0054 §2 moves it one step: the palette is the blocks that declare the screen being
 * edited, `blocksFor('home')`. That is the second list ADR 0046 §1 said it did not have,
 * and what stands in for its absence is `apps/mobile/__tests__/home-layout.test.tsx`
 * failing in both directions — a module with no declaration, and a declaration for no
 * module. Neither half is readable from here, which is why this file asserts the wiring
 * and that file asserts the pair.
 *
 * The naming is a pure function and is run here. The wiring is read as text, which is the
 * weaker half — it catches a line deleted or moved and not a mark drawn in the wrong
 * place.
 */

const read = (path: string): string => code(readFileSync(join(ROOT, path), 'utf8'));

const PALETTE = read('apps/workbench/src/preview/home/Palette.tsx');
const PANEL = read('apps/workbench/src/preview/home/HomeDocument.tsx');
const BLOCK = read('apps/workbench/src/preview/home/HomeBlock.tsx');
const APP_CHECK = read('apps/mobile/__tests__/home-layout.test.tsx');

describe('the files this reads', () => {
  it('read them, rather than matching nothing in an empty string', () => {
    /*
     * The first case in a file that reads the repository asserts that it READ it.
     * `prose-and-code`'s README argues this at length and it is sharper here than
     * usual: half the assertions below are of the shape "this token is not in the
     * source", and every one of those is satisfied by a source that is the empty
     * string. A path that moved, a comment stripper that ate a file, a rename — any
     * of them turns this suite green over a panel that no longer exists.
     *
     * Floors far below the real figures, so nothing here needs maintaining.
     */
    expect(
      floorFaults({
        'preview/home/Palette.tsx': { found: PALETTE.length, atLeast: 2000 },
        'preview/home/HomeDocument.tsx': { found: PANEL.length, atLeast: 8000 },
        'preview/home/HomeBlock.tsx': { found: BLOCK.length, atLeast: 1000 },
        'apps/mobile/__tests__/home-layout.test.tsx': { found: APP_CHECK.length, atLeast: 500 },
      }),
    ).toEqual([]);
  });
});

describe('where a block is going, in words', () => {
  /*
   * At the source language, which is what these assertions are written in. Both
   * functions take a formatter since 2026-09-18, because the words they build are
   * this site's own and the home configurator is the one tool ADR 0050 §1 names an
   * audience for. `test/i18n.test.ts` is what holds the German for them; this holds
   * the sentence they assemble.
   */
  const intl = createIntl({ locale: 'en', defaultLocale: 'en' });

  /*
   * The mark is a hairline between two rows and the dialog covers the list it came from,
   * so this sentence is the only thing that says where. Named by its neighbours rather
   * than by a number: "after the lead article" is a place, "at index 3" is something
   * somebody would have to count to check.
   */
  it('names the two ends of the day rather than the block beyond them', () => {
    expect(whereAt(intl, SHIPPED, 0)).toBe('at the top of the day');
    expect(whereAt(intl, SHIPPED, SHIPPED.sections.length)).toBe('at the end of the day');
  });

  it('names the blocks either side, in the words the rows use', () => {
    expect(whereAt(intl, SHIPPED, 1)).toBe(
      `between ${blockName(intl, SHIPPED.sections[0]!)} and ${blockName(intl, SHIPPED.sections[1]!)}`,
    );
  });

  it('tells two blocks of one module apart, which the module’s words cannot', () => {
    // The shipped document has the callout twice, so "between Participation callout and
    // Participation callout" was a place and "Remove Participation callout from the day"
    // was the name of two different buttons. Measured in the accessibility tree by a cold
    // review. The id is what is unique and it is already at the end of every row.
    const callouts = SHIPPED.sections.filter((section) => section.module === 'callout-teaser');
    expect(callouts.length).toBeGreaterThan(1);
    expect(new Set(callouts.map((section) => blockName(intl, section))).size).toBe(callouts.length);
    for (const section of callouts) expect(blockName(intl, section)).toContain(section.id);
  });

  it('answers for an index past the end rather than throwing', () => {
    // The marks hand in `index + 1` and the ends are where an off-by-one lives.
    expect(whereAt(intl, SHIPPED, 99)).toBe('at the end of the day');
    expect(whereAt(intl, SHIPPED, -1)).toBe('at the top of the day');
  });

  /*
   * The one assertion in this file that formats a descriptor rather than reading a
   * source, and it is here because of what it caught elsewhere: a cold review once
   * rewrote `say` to skip `formatMessage`, which leaves every translated label reading
   * "[object Object]", and the whole suite stayed green. The mutation goes red today
   * only in `test/i18n.test.ts`, over the LANGUAGE PICKER's rows — so the configurator's
   * own words are covered by somebody else's test, and the day that test moves they are
   * covered by nothing. This is the configurator holding its own.
   */
  it('formats a module label through `say`, and gets the German', () => {
    const german = createIntl({ locale: 'de', defaultLocale: 'en', messages: de });
    expect(say(german, MODULE_LABELS['article-hero']!.label)).toBe('Aufmacher');
    expect(german.formatMessage(MODULE_LABELS['article-hero']!.what)).toBe(
      'Die neueste Recherche, über die volle Breite.',
    );
    // And the fallback half of `say`: a module this tool has no name for is its id,
    // which is the app's vocabulary and the same word in every language.
    expect(say(german, 'something-new')).toBe('something-new');
  });
});

describe('the palette is the registry', () => {
  /*
   * ADR 0046 §1 and ADR 0054 §2. The list is still the app's and still kept nowhere here;
   * what changed is which of the app's files answers, and that the screen it asks for is
   * written rather than implied.
   */
  it('reads the app’s own declaration and keeps no list beside it', () => {
    expect(PALETTE).toMatch(/import \{ blocksFor \} from '@\/lib\/home\/screens'/);
    expect(PALETTE).toMatch(/blocksFor\('home'\)/);
    expect(PALETTE).not.toMatch(/Object\.keys\(HOME_MODULES\)/);
  });

  it('gives every module in that table words a newsroom can read', () => {
    // A module reaching the palette without an entry in `MODULE_LABELS` would be offered
    // to a newsroom as `faktencheck-rail`. What holds that, in both directions and
    // against the app's own source, is `home-document.test.ts`'s "has a name and a
    // description for every module the app can draw"; what is held here is that the
    // palette shows the label rather than the id. A floor under `MODULE_LABELS`'s size
    // used to sit beside it and could not fail, since it is a literal in the module this
    // file imports — a cold review found it doing nothing and it is gone.
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
    expect(PANEL).toMatch(/whereAt\(intl, layout, index\)/);
    expect(PANEL).toMatch(/whereAt\(intl, layout, layout\.sections\.length\)/);
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
    expect(PANEL).toMatch(
      /aria-label=\{intl\.formatMessage\(COPY\.rowRemove, \{ block: spoken \}\)\}/,
    );
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

describe('one handle for the pointer, and the arrows for the keyboard', () => {
  /**
   * [ADR 0047](../../../../adr/0047-the-handle-is-the-pointers-and-the-arrows-are-the-keyboards.md),
   * which changed ADR 0045 §7 before it was built. The handle is the pointer's route and
   * has no keyboard mode; the arrow buttons stay and are the keyboard's; both end at
   * `moved`, so the document never learns there were two controls.
   *
   * The arithmetic that turns a drop into a destination is `carry.ts` and `carry.test.ts`
   * runs it, including the property ADR 0053 §2 turns on: a list that reflows under the
   * pointer has to answer the same slot twice. What is read here is that the two routes
   * exist and that neither has grown the other's input.
   */
  it('gives the handle a pointer and refuses it a key', () => {
    /*
     * No `tabindex`, no role, and hidden from the accessibility tree: a handle that
     * looked focusable while doing nothing on a key would be the untested route wearing
     * the tested one's clothes.
     *
     * The OPENING TAG and not the element, because the element contains an icon carrying
     * an `aria-hidden` of its own. Measured in a cold review: read to `</span>`, deleting
     * the handle's own attribute left the whole suite green, answered by the icon's.
     */
    const at = PANEL.indexOf('{...grip}');
    const opening = PANEL.slice(at, PANEL.indexOf('>', at));
    expect(opening).toMatch(/aria-hidden="true"/);
    expect(opening).not.toMatch(/tabIndex|role=|onKey/);
    // And `touch-none`, or a touch scrolls the panel and the capture never sees a move.
    expect(opening).toMatch(/touch-none/);
  });

  it('keeps the arrow buttons, and points each one the way its name says', () => {
    /*
     * Each label with its own delta, in one button. Asked separately — both labels
     * somewhere and both deltas somewhere — this stayed green with the two arrows swapped,
     * measured in a cold review, which is ADR 0047 §2's route that must work pointing the
     * wrong way with every check passing.
     */
    const button = (way: 'Up' | 'Down') => {
      // The label is a message now, so what names the button in the source is the
      // descriptor's key rather than the words. `{ block: spoken }` is asked for in
      // the same string: the name a row's controls are read out with is the whole of
      // what `blockName` exists for, and a label that lost it would name two rows the
      // same wherever one module appears twice.
      const at = PANEL.indexOf(
        `aria-label={intl.formatMessage(COPY.move${way}, { block: spoken })}`,
      );
      expect(at).toBeGreaterThan(-1);
      return PANEL.slice(at, PANEL.indexOf('</Button>', at));
    };
    expect(button('Up')).toMatch(/onMove\(-1\)/);
    expect(button('Up')).not.toMatch(/onMove\(1\)/);
    expect(button('Down')).toMatch(/onMove\(1\)/);
    expect(button('Down')).not.toMatch(/onMove\(-1\)/);
  });

  it('ends both routes at one function', () => {
    // ADR 0047 §3. A second way to reorder the document would be a difference between
    // the two inputs living below the interface, which is where it would be expensive.
    expect(PANEL).toMatch(/moved\(layout, section\.id, delta\)/);
    expect(PANEL).toMatch(/moved\(layout, held\.id, held\.slot - held\.from\)/);
    expect(PANEL.match(/setLayout\(moved\(/g) ?? []).toHaveLength(2);
  });

  it('reads the drop from a ref rather than from the state it draws with', () => {
    // A `pointerup` can arrive before React has re-rendered from the last `pointermove`,
    // and the handlers a row carries are the ones built by the render it can see. Reading
    // state at the drop applies the position the pointer was in one move ago: a block
    // landing one place out, rarely, and only on a fast drag.
    // Sliced to the drop, because the move reads the ref too and a check over the whole
    // file stayed green when the drop alone was changed back to state. Measured.
    const drop = PANEL.slice(PANEL.indexOf('onPointerUp:'), PANEL.indexOf('onPointerCancel:'));
    expect(drop).toMatch(/const held = mine\(event\);/);
    expect(drop).not.toMatch(/=\s*carried\b/);
    expect(PANEL).toMatch(/const held = carrying\.current;\s*\n\s*return held !== null/);
    expect(PANEL).toMatch(/carrying\.current = next;/);
  });

  it('shows the drop by moving every block, and draws no second answer beside it', () => {
    /*
     * ADR 0053 §2. Every block is drawn where a release would put it and the carried one
     * glides to the place it would take; a hairline lit at a gap would be a second answer
     * to "where does this go", and the two would part the first time one of them moved. So
     * the mark lost its `dropping` state rather than gaining a rule about when to draw it.
     */
    expect(PALETTE).not.toMatch(/dropping/);
    expect(PANEL).not.toMatch(/dropping/);
    // The faded-but-coloured mark on the carried block, against `HomeBlock`'s greyed one
    // for a block that is switched off. Two states that must not read as one at two
    // strengths.
    expect(PANEL).toMatch(/carried && 'z-10 opacity-60 shadow-xl'/);
    expect(BLOCK).toMatch(/off && 'opacity-45 grayscale'/);
    // And no mark is mounted at all while a block is being carried, so nothing offers to
    // add into a list that is mid-answer.
    expect(PANEL).toMatch(/carried === null \? \(\s*\n?\s*<InsertMark/);
  });

  it('moves the rows with a transform and never with the document’s own order', () => {
    /*
     * The half of ADR 0053 §2 that the browser showed and no check could have: a list that
     * really reorders loses the pointer it is being dragged by, because React moves keyed
     * children with `insertBefore`, the DOM performs that as a remove and an insert, and
     * Chrome releases an implicit capture on removal. Measured on the dev server —
     * `lostpointercapture` fired on the first move that changed the slot.
     *
     * So the list renders the document's own order and the offsets are a `transform`. What
     * is read here is exactly that: the map is over `layout.sections`, the offset reaches
     * the row as a style, and the transition is on `transform` alone rather than on `all`,
     * which would catch the opacity beside it.
     */
    expect(PANEL).toMatch(/\{layout\.sections\.map\(/);
    expect(PANEL).toMatch(/translateY\(\$\{shift\}px\)/);
    expect(PANEL).toMatch(/dragging && 'transition-transform/);
    /*
     * And nothing that a carry hides is UNMOUNTED by it. A hairline or a button that holds
     * the keyboard's focus when somebody else's pointer picks up a block would take that
     * focus to `<body>` on the way out, and nothing puts it back. `opacity-0` leaves it
     * where it is, so the two routes cannot collide.
     */
    expect(PANEL).toMatch(/dragging && 'pointer-events-none opacity-0'/);
    expect(PANEL).toMatch(/carried && 'pointer-events-none opacity-0 group-hover:opacity-0'/);
    expect(PANEL).not.toMatch(/carried && 'hidden'/);
    expect(PANEL).toMatch(/setPointerCapture/);
  });

  it('leaves no gap between the rows for the seam arithmetic to lose', () => {
    /*
     * `measure()` sums the rows' heights and calls the running total their resting tops.
     * That is only true while nothing stands between two rows: a `gap-*` or `space-y-*` on
     * the list would put space in the layout that no height accounts for, and every seam
     * below the first would be out by a growing amount. It would look like a drag that
     * lands one place out more often the further down the day you go, and nothing else
     * here would fail — `carry.test.ts` builds its own rows and never reads this class.
     *
     * The insertion marks are safe and are why this is worth stating rather than assuming:
     * they sit inside a row, absolutely positioned and translated, so mounting and
     * unmounting them mid-carry changes no height at all.
     */
    // The block list's own `<ol>`, found by its ref: the submit steps are an `<ol>` too,
    // and they are spaced on purpose.
    const start = PANEL.search(/<ol\s+ref=\{list\}/);
    expect(start).toBeGreaterThan(-1);
    const list = PANEL.slice(start, PANEL.indexOf('>', start));
    expect(list).toMatch(/ref=\{list\}/);
    expect(list).not.toMatch(/\bgap-|\bspace-y-/);
  });

  it('re-asks where the pointer is on a scroll, and drops what the screen was showing', () => {
    /*
     * There was a check here asserting that `gapAt` measures rather than caches, by
     * looking for `getBoundingClientRect` in it. It could not fail: a cold review rewrote
     * `gapAt` to measure once per drag and cache for ever, and the token was still there.
     * Gone, because a check that cannot fail is worse than none.
     *
     * What replaced it was "the drop re-asks with the release's own `clientY`", which was
     * right while a wheel was the only thing that could move the rows without a
     * `pointermove`. It is wrong now, and a cold review of the drag found why: the panel
     * scrolls itself while a block is held at its edge, at up to eighteen pixels a frame,
     * and a re-ask at the release answers a frame the screen has not drawn. So the drop
     * takes the slot the last painted frame showed, and the `scroll` listener is what
     * keeps that current — for the wheel and for the panel's own scrolling alike.
     *
     * Both lines can be deleted, so both can turn this red.
     */
    const drop = PANEL.slice(PANEL.indexOf('onPointerUp:'), PANEL.indexOf('onPointerCancel:'));
    expect(drop).toMatch(/held\.slot - held\.from/);
    expect(drop).not.toMatch(/aimed\(/);
    expect(PANEL).toMatch(/addEventListener\('scroll'/);
    expect(PANEL).toMatch(/aimed\(held, held\.y\)/);

    /*
     * And the guard that keeps one finger's release from putting down another finger's
     * block: an event from a pointer that is not carrying returns before anything is
     * cleared. Sliced to the drop, because `onPointerCancel` has the same shape and a
     * check over the whole file would pass on that one alone.
     */
    expect(drop).toMatch(/if \(held === null\) return;/);
  });

  it('refuses a second pointer, a second button, and a release away from the list', () => {
    /*
     * All three measured in a cold review. Two touches: one finger carrying the header
     * while a second merely RESTED on another row's handle moved the second block and not
     * the first. A right-click on the handle picked a block up and the right-button
     * release reordered the day. And a release out over the phone frame, nine hundred
     * pixels from the list, reordered it too — which also left a drag somebody had
     * thought better of with no way out, since ADR 0047 §1 gives the handle no key.
     */
    expect(PANEL).toMatch(
      /event\.button !== 0 \|\| !event\.isPrimary \|\| carrying\.current !== null/,
    );
    expect(PANEL).toMatch(/held\.pointer === event\.pointerId/);
    const drop = PANEL.slice(PANEL.indexOf('onPointerUp:'), PANEL.indexOf('onPointerCancel:'));
    expect(drop).toMatch(/overList\(event\.clientX\)/);
    // And the way out that is not a key on the handle: a listener that exists only while
    // a pointer is down, so nothing can be reordered with it.
    expect(PANEL).toMatch(/event\.key === 'Escape'/);
  });
});
