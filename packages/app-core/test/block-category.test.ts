import { describe, expect, it } from 'vitest';

import {
  allBlocks,
  blocksByCategory,
  BLOCK_CATEGORIES,
  categoryOf,
  MODULE_CATEGORIES,
} from '../src/lib/block-category';

/**
 * What a picker reads
 * ([ADR 0073](../../../adr/0073-every-screen-takes-every-block-and-a-block-declares-its-category.md)).
 *
 * The declarations themselves are the app's and `apps/mobile/__tests__/home-layout.test.tsx`
 * holds them against the registry in both directions. What is asked here is the grouping:
 * that the order is the one `BLOCK_CATEGORIES` gives, and that every block lands in
 * exactly one group.
 *
 * **Nothing here takes a screen any more.** §3's four blocks bound to one screen each are
 * gone with
 * [ADR 0075](../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §6's single header, so §1 holds without an exception and one list answers every screen.
 * The test that asserted the withheld ones is not rewritten into a weaker version of
 * itself: what it guarded is now a thing the module cannot express.
 */
describe('the categories a picker groups blocks into', () => {
  it('gives every block exactly one category, and names no category twice', () => {
    expect(new Set(BLOCK_CATEGORIES).size).toBe(BLOCK_CATEGORIES.length);
    const uncategorised = allBlocks().filter(
      (block) => !BLOCK_CATEGORIES.includes(MODULE_CATEGORIES[block]!),
    );
    expect(uncategorised).toEqual([]);
    // The floor under all of it: an empty table would satisfy the line above.
    expect(allBlocks().length).toBeGreaterThan(20);
  });

  it('uses every category it declares, so no tab can open on nothing', () => {
    const used = new Set(Object.values(MODULE_CATEGORIES));
    expect(BLOCK_CATEGORIES.filter((category) => !used.has(category))).toEqual([]);
  });

  it('answers undefined for a block it has never heard of', () => {
    expect(categoryOf('quiz')).toBeUndefined();
  });

  it('offers every block it declares, with nothing held back from anybody', () => {
    // The replacement for the withheld-blocks assertion above: the palette IS the
    // roll-call now, and the one thing left to hold is that the two cannot part.
    expect(
      blocksByCategory()
        .flatMap((group) => group.blocks)
        .sort(),
    ).toEqual([...allBlocks()].sort());
  });

  it('groups them in the declared order, losing and repeating nothing', () => {
    const groups = blocksByCategory();
    expect(groups.map((group) => group.category)).toEqual(
      BLOCK_CATEGORIES.filter((category) =>
        allBlocks().some((block) => MODULE_CATEGORIES[block] === category),
      ),
    );
    expect(groups.flatMap((group) => group.blocks).sort()).toEqual([...allBlocks()].sort());
    for (const group of groups) {
      expect(group.blocks.length).toBeGreaterThan(0);
      for (const block of group.blocks) expect(categoryOf(block)).toBe(group.category);
    }
  });
});
