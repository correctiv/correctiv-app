/**
 * How the gallery is sorted: by what each component IS, not by the folder it is filed in.
 *
 * A gallery in folder order answers "where does this file live", which is a question
 * about the source tree; a newsroom arranging a screen asks "what kind of thing is this",
 * which is the question a block's category answers ([ADR
 * 0073](../../../../adr/0073-every-screen-takes-every-block-and-a-block-declares-its-category.md)
 * §2). So the two hosts that group blocks now group them the same way: the workbench's
 * palette reads `blocksByCategory(screen)` out of the core, and this page reads
 * `categoryOf(entry.block)` out of the same place.
 *
 * **The families are not written here.** `BLOCK_CATEGORIES` is the core's and its order is
 * a property of the set rather than of any one block, and a list of the six names in this
 * file would be the second one that could fall behind the first. `__tests__/gallery-groups.test.ts`
 * is what says no such list has appeared.
 *
 * **The heading is the app's table, not this page's.** `lib/home/category-labels.ts` sits
 * beside the blocks and is where the newsroom's palette reads the six words too; there is
 * one table and this page is not where the second copy would live. Which of the two halves
 * of that table this page reads is `Gallery.tsx`'s decision and its own: the newsroom's
 * picker formats them through the app's provider and gets German, and this page is a
 * developer's page in English and prints the descriptors' `defaultMessage`. Same words, same
 * table, one language per page.
 *
 * **Everything that is not a block goes into one section**, called "Building blocks" here
 * and nowhere else — the gallery's own furniture is English, like the rest of the page, and
 * a section is named by the folder it stands for. It was `Bausteine`, which was a German
 * heading on an English page; a design review named it as the sharpest case of a page that
 * had not decided on a language. Nothing else was available as a grouping: a button has no
 * family, and filing it under one would put a category id in the catalogue that no block
 * declares, which is exactly the second list ADR 0073 §2 refused. So the list of families is
 * the core's, and what is left over is one section that says so.
 */
import {
  BLOCK_CATEGORIES,
  categoryOf,
  type BlockCategory,
} from '@correctiv/app-core/lib/block-category';

import type { Entry } from './catalogue';

/**
 * What the section of components that are not a block's own drawing is called.
 *
 * English, like the rest of this page's furniture. `BAUSTEINE` was the id of this constant
 * before a design review found the mixed page it produced; it is now the words themselves,
 * and `__tests__/gallery-groups.test.ts` asserts they are ASCII so the German cannot come
 * back by a rename nobody looked at.
 */
export const BAUSTEINE = 'Building blocks';

/**
 * What the grouping reads off an entry, which is the block it draws and nothing else.
 *
 * `Entry` is this, plus a name and its specimens, and naming only the half this file uses
 * is what lets `__tests__/gallery-groups.test.ts` hand it a list it built out of the
 * catalogue's own text — the alternative is a `specimens: []` in every one of those, which
 * reads as though the grouping cared about specimens.
 */
export interface BlockEntry {
  block?: string;
}

export interface GalleryGroup<T extends BlockEntry = Entry> {
  /**
   * The family, and `undefined` for the section of components that are not a block's own
   * drawing. Deliberately not a key of its own: the key is the family, and the one
   * section without one is addressed by this string.
   */
  category: BlockCategory | undefined;
  /** How the heading is addressed: a category, or `BAUSTEINE`. */
  key: string;
  /** The entries, in the catalogue's own order within the section. */
  entries: T[];
}

/**
 * One entry's family, which is its block's and never its own.
 *
 * **An entry naming a block the core does not have has no family here**, and falls to the
 * bottom section with the components that are no block's own drawing. That is the silent
 * direction this page can be wrong in, so it is not left to the drawing:
 * `__tests__/gallery-groups.test.ts` reads every `block:` out of the catalogue and fails on
 * one the core cannot answer, which is the same roll-call `MODULE_CATEGORIES` gets in
 * `apps/mobile/__tests__/home-layout.test.tsx`.
 */
export function familyOf(entry: BlockEntry): BlockCategory | undefined {
  return entry.block === undefined ? undefined : categoryOf(entry.block);
}

/**
 * The catalogue in sections: one per family the core knows, in the core's order, each with
 * the entries of a block in it, and one for the components that are no block's own
 * drawing at the end.
 *
 * **A family with nothing in it is left out**, the same answer `blocksByCategory` gives a
 * screen: an empty section on a page is a heading with nothing under it.
 *
 * The remaining folder groups are dropped, deliberately and against the page's own
 * history: `folder` still says where a component's file is, and `?c=folder/Name` still
 * addresses one, but neither is what the page is sorted by any more. The last section
 * therefore draws the folders it holds together, in the catalogue's order, which is the
 * alphabetical one they were written in.
 */
export function galleryGroups<T extends BlockEntry>(
  folders: readonly { folder: string; entries: readonly T[] }[],
): GalleryGroup<T>[] {
  const entries = folders.flatMap((folder) => folder.entries);
  const inFamily = (category: BlockCategory): T[] =>
    entries.filter((entry) => familyOf(entry) === category);
  const groups: GalleryGroup<T>[] = BLOCK_CATEGORIES.map((category) => ({
    category,
    key: category,
    entries: inFamily(category),
  })).filter((group) => group.entries.length > 0);

  const bausteine = entries.filter((entry) => entry.block === undefined);
  if (bausteine.length > 0)
    groups.push({ category: undefined, key: BAUSTEINE, entries: bausteine });
  return groups;
}
