/*
 * @vitest-environment jsdom
 *
 * jsdom for the one reason at the bottom of this file: `sessionStorage`. Everything above it
 * is pure and would run in Node, and `preview/home/offered.ts` holds nothing but pure
 * functions and two guarded reads of the browser's storage — which is what the last
 * describe is about, and it cannot be reached without a DOM that has the thing.
 */
import { describe, expect, it } from 'vitest';

import { BLOCK_CATEGORIES, allBlocks, categoryOf } from '@correctiv/app-core/lib/block-category';

import {
  familyTabs,
  FIRST_TAB,
  groupsShown,
  isTab,
  matchCount,
  matchesNothing,
  readTab,
  rememberTab,
  TAB_KEY,
  tabsFor,
} from '../../src/preview/home/offered';

/**
 * What the palette offers, without drawing any of it.
 *
 * ADR 0073 §2 named a palette of thirty-two specimens on every screen as the cost the
 * category pays to cover, and said the way out is to read `blocksByCategory` rather than
 * invent a grouping. So most of what is asserted here is that this file holds no list: the
 * families and the blocks under them come out of the core, and what the palette adds is the
 * two questions a picker asks on top — which family, and which of them matches what was
 * typed — plus the one piece of state about which tab was last open.
 *
 * **Not one of those questions takes a screen.** It did until ADR 0075 §6: the four screen
 * titles were what made a shelf one list on one screen and a shorter one on the next, and
 * one header that prints the title of wherever it stands leaves every screen with the same
 * list. What the tests below hold in its place is that the shelf is the whole of
 * `allBlocks()` — which is what makes a block bound to a screen impossible to reintroduce
 * here rather than merely absent.
 *
 * **`words` is a function and not a formatter**, which is what lets all of this run without
 * a provider. What it stands in for is a block's name and its sentence joined in the
 * reader's language, which is what somebody typing „Faktencheck“ is searching in and is
 * emphatically not the block's id.
 */
const WORDS: Record<string, string> = {
  'article-hero': 'Aufmacher Die neueste Recherche, über die volle Breite.',
  'faktencheck-rail': 'Faktenchecks Faktenchecks nebeneinander.',
  'mediathek-reihe': 'Mediathek Zwei Kanäle als Reihe.',
  'live-radio-banner': 'Live-Radio Das Programm von jetzt, live.',
  'podcast-rail': 'Podcasts Die Serien als Reihe.',
  'screen-header': 'Kopfzeile Der Titel des Bildschirms.',
};

/** A block's name and its sentence in the reader's language, as the search is handed them. */
const words = (module: string): string => WORDS[module] ?? module;

/** Every block the palette offers, flattened, in the core's order. */
const offered = (): string[] => groupsShown(FIRST_TAB, '', words).flatMap((g) => [...g.blocks]);

/** The blocks of one tab, flattened. */
const onTab = (tab: Parameters<typeof groupsShown>[0]): string[] =>
  groupsShown(tab, '', words).flatMap((group) => [...group.blocks]);

describe('the tabs the palette offers', () => {
  it('are "all" and then the families the core has something for, in its order', () => {
    // The order is the core's and not this file's: `BLOCK_CATEGORIES` argues at length that
    // it is a property of the set rather than of any one block, so a tab row in another
    // order would be a second answer to a question already answered.
    const families = familyTabs();
    expect(tabsFor()).toEqual([FIRST_TAB, ...families]);
    expect(families).toEqual(
      BLOCK_CATEGORIES.filter(
        (category) =>
          groupsShown(category, '', words).flatMap((group) => [...group.blocks]).length > 0,
      ),
    );
  });

  it('are the same list whichever screen the palette was opened on', () => {
    // The form of it: `offered.ts` takes no screen at all, so there is nowhere for a
    // per-screen shelf to come from. What this holds is that the list the tab row is built
    // from covers every block the app declares, so a shelf could not be shorter than the
    // registry even by accident.
    expect(offered()).toEqual(allBlocks());
    expect(familyTabs()).toEqual(BLOCK_CATEGORIES);
  });
});

describe('a tab shows one family, and "all" shows every one', () => {
  it('shows the tab’s own blocks and none of another family’s', () => {
    for (const category of familyTabs()) {
      const shown = onTab(category);
      expect(shown.every((block) => categoryOf(block) === category)).toBe(true);
      expect(shown).toEqual(offered().filter((block) => categoryOf(block) === category));
    }
  });

  it('keeps the families in the core’s order under "all", with every block exactly once', () => {
    const groups = groupsShown(FIRST_TAB, '', words);
    expect(groups.map((group) => group.category)).toEqual(familyTabs());
    const blocks = groups.flatMap((group) => [...group.blocks]);
    expect(blocks.length).toBe(new Set(blocks).size);
    expect(blocks).toEqual(allBlocks());
  });
});

describe('a search', () => {
  const found = (query: string, tab: Parameters<typeof groupsShown>[0] = FIRST_TAB): string[] =>
    groupsShown(tab, query, words).flatMap((group) => [...group.blocks]);

  it('finds a block by its name and by its sentence, in the reader’s language', () => {
    expect(found('Aufmacher')).toEqual(['article-hero']);
    expect(found('Recherche')).toEqual(['article-hero']);
    expect(found('live')).toEqual(['live-radio-banner']);
    // Case and umlauts are folded on both sides, so a query does not have to spell a word
    // the way the catalogue does: `KANALE` finds „Kanäle" on a keyboard with no umlaut.
    expect(found('KANALE')).toEqual(['mediathek-reihe']);
  });

  it('narrows with every word rather than emptying on the second', () => {
    // The arrangement that makes a search usable: two words are a conjunction, so a second
    // word cuts the result down instead of throwing it away.
    expect(found('reihe')).toEqual(['mediathek-reihe', 'podcast-rail']);
    expect(found('reihe podcast')).toEqual(['podcast-rail']);
    expect(found('reihe nichts')).toEqual([]);
  });

  it('looks at every family whatever tab is chosen, which is why the tabs switch off', () => {
    // A search inside the chosen family would answer "nothing here" for a block two tabs
    // along, and the person who typed the word has no way to learn that is what happened.
    // So the tab is not part of the answer at all while there is a query — which is why the
    // palette switches the row off rather than leaving a control that no longer means what
    // it says.
    for (const tab of tabsFor()) {
      expect(found('reihe', tab)).toEqual(['mediathek-reihe', 'podcast-rail']);
      expect(found('aufmacher', tab)).toEqual(['article-hero']);
    }
  });

  it('answers "none" rather than an empty grid that reads as a fault', () => {
    const groups = groupsShown(FIRST_TAB, 'nothing here', words);
    expect(groups).toEqual([]);
    expect(matchCount(groups).found).toBe(0);
  });

  it('says how many of the blocks it found', () => {
    // The number exists so that a shelf narrowed to one card is not mistaken for the whole
    // of what is there. The denominator is the shelf's own count and not the count of
    // whatever the tab was showing.
    const every = offered().length;
    expect(matchCount(groupsShown(FIRST_TAB, '', words))).toEqual({ found: every, of: every });
    expect(matchCount(groupsShown(FIRST_TAB, 'Aufmacher', words))).toEqual({
      found: 1,
      of: every,
    });
  });

  it('is not a search until something is typed', () => {
    // Whitespace is not an answer, and a field full of it must not narrow the shelf to
    // nothing while looking as though it is still empty.
    expect(matchesNothing('')).toBe(true);
    expect(matchesNothing('   ')).toBe(true);
    expect(matchesNothing('a')).toBe(false);
  });
});

describe('the tab row as a row', () => {
  /**
   * The row's shape, which a design review named as a fault: seven German family names beside
   * „Alle" and one of them on a line of its own. The row is a fixed control here and the
   * fault was in how it was drawn, so what this holds is that every option the row offers is
   * a tab with blocks under it — an empty tab is what a wrap was making the last one look
   * like, and it would be worth knowing about before the pixels rather than after.
   */
  it('offers no tab with nothing under it', () => {
    const tabs = tabsFor();
    // „Alle" plus the six families a screen but the Mediathek's own title had blocks in,
    // which is the row a design review found broken at seven options. ADR 0075 §6 did not
    // change the count: the fourth bound title became the one header, which is still a
    // block in `struktur`.
    expect(tabs.length).toBeGreaterThanOrEqual(6);
    // Named in the value rather than in a second argument to `expect`, which Vitest takes
    // none of: a failure names the empty tab by printing the list under it.
    const empty = tabs.filter(
      (tab) => groupsShown(tab, '', words).flatMap((group) => [...group.blocks]).length === 0,
    );
    expect({ empty }).toEqual({ empty: [] });
    // Every tab is distinct: two of the same name on one row would be a family listed twice,
    // and the reader could not tell which one they had chosen.
    expect(new Set(tabs).size).toBe(tabs.length);
  });

  it('offers every block once across the families, and all of them under "all"', () => {
    // The family tabs partition the shelf: whatever family a block is filed in, it is on that
    // tab and no other, so no block can be listed twice in a row of choices and none can be
    // listed nowhere. „Alle" is then the union of the families rather than something beside
    // them — a picker whose „Alle" held a block no family offered would be a second answer to
    // the same question, and the reader would have no way to tell which was current.
    const tabs = tabsFor();
    const perTab = tabs.map((tab) => groupsShown(tab, '', words).flatMap((g) => [...g.blocks]));
    const families = perTab.slice(1).flatMap((blocks) => blocks);
    expect(families.length).toBe(new Set(families).size);
    expect(new Set(families)).toEqual(new Set(offered()));
    // And „Alle" holds every one of them, so the two cannot part.
    expect(new Set(perTab[0]!)).toEqual(new Set(families));
  });
});

describe('the last tab', () => {
  it('is "all" until a tab is chosen, and then it is that one', () => {
    expect(readTab()).toBe(FIRST_TAB);
    rememberTab('club');
    expect(globalThis.sessionStorage.getItem(TAB_KEY)).toBe('club');
    expect(readTab()).toBe('club');
  });

  it('refuses a tab the row does not have, and a string nobody wrote', () => {
    expect(isTab('medien')).toBe(true);
    expect(isTab('faktenforum')).toBe(false);
    expect(isTab(null)).toBe(false);
    // Read back out of storage, which is where a hand-edited value would come from.
    globalThis.sessionStorage.setItem(TAB_KEY, 'faktenforum');
    expect(readTab()).toBe(FIRST_TAB);
  });

  it('is forgotten rather than kept, which is what a session is', () => {
    // The key is namespaced under the preview's own `workbench:` prefix like every other
    // piece of state this site leaves in the app's storage — a bare key would be one more
    // thing a published export could be holding for ever.
    expect(TAB_KEY).toMatch(/^workbench:/);
  });
});
