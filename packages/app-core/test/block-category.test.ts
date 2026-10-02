import { describe, expect, it } from 'vitest';

import {
  allBlocks,
  blocksByCategory,
  blocksFor,
  BLOCK_CATEGORIES,
  categoryOf,
  mayAppearOn,
  MODULE_CATEGORIES,
  SCREEN_BOUND_BLOCKS,
  screenBoundTo,
} from '../src/lib/block-category';
import { CONFIGURABLE_SCREENS } from '../src/lib/screen-layout';

/**
 * What a picker reads
 * ([ADR 0073](../../../adr/0073-every-screen-takes-every-block-and-a-block-declares-its-category.md)).
 *
 * The declarations themselves are the app's and `apps/mobile/__tests__/home-layout.test.tsx`
 * holds them against the registry in both directions. What is asked here is the grouping:
 * that the order is the one `BLOCK_CATEGORIES` gives, that every block lands in exactly
 * one group, and that a screen is offered everything but another screen's title.
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
    expect(screenBoundTo('quiz')).toBeUndefined();
    // And a block nobody declared may go anywhere, which is what leaves `renderable` to
    // say that it does not exist (`parseHomeLayout`).
    expect(mayAppearOn('quiz', 'home')).toBe(true);
  });

  it('offers every screen every block but the titles of the others', () => {
    for (const screen of CONFIGURABLE_SCREENS) {
      const offered = blocksFor(screen);
      const withheld = allBlocks().filter((block) => !offered.includes(block));
      expect({ screen, withheld }).toEqual({
        screen,
        withheld: Object.entries(SCREEN_BOUND_BLOCKS)
          .filter(([, own]) => own !== screen)
          .map(([block]) => block),
      });
    }
  });

  it('groups them in the declared order, losing and repeating nothing', () => {
    for (const screen of CONFIGURABLE_SCREENS) {
      const groups = blocksByCategory(screen);
      expect(groups.map((group) => group.category)).toEqual(
        BLOCK_CATEGORIES.filter((category) =>
          blocksFor(screen).some((block) => MODULE_CATEGORIES[block] === category),
        ),
      );
      expect(groups.flatMap((group) => group.blocks).sort()).toEqual([...blocksFor(screen)].sort());
      for (const group of groups) {
        expect(group.blocks.length).toBeGreaterThan(0);
        for (const block of group.blocks) expect(categoryOf(block)).toBe(group.category);
      }
    }
  });
});
