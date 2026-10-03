/**
 * The families a block can belong to.
 *
 * [ADR 0073](../../../../adr/0073-every-screen-takes-every-block-and-a-block-declares-its-category.md)
 * §1: every configurable screen takes every block. It held with one exception until
 * [ADR 0075](../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §6 — `SCREEN_BOUND_BLOCKS`, the four blocks that each printed one screen's name — and
 * the exception is gone with them: `screen-header` prints the title of whatever screen it
 * is on, so there is no longer a block that can lie about where the reader is. Nothing
 * here asks about a screen any more, and the parser has no `section-module-not-on-screen`
 * left to report.
 *
 * **The type is the core's and the declaration is the app's**, which is ADR 0054 §3
 * unchanged: `apps/mobile/src/lib/home/blocks.ts` says which family each block is in, and
 * `apps/mobile/scripts/generate-home-settings.mjs` carries it into the generated file
 * beside this one. The core owns the type because the parser and this module are the core's.
 *
 * **The words are nobody's here.** A category id is the app's vocabulary, the same in
 * every language; what a newsroom reads is a descriptor in
 * `apps/workbench/src/preview/home/document.ts` (ADR 0050, ADR 0052). Nothing in this
 * package may hold a label for one.
 */

import { MODULE_CATEGORIES } from './block-catalogue.generated';

/**
 * A block's family. A union, so a category nobody has thought about is a type error
 * where it is declared rather than a heading nobody translated.
 */
export type BlockCategory =
  | 'struktur'
  | 'recherche'
  | 'faktencheck'
  | 'medien'
  | 'mitmachen'
  | 'club';

/**
 * The order a picker draws the categories in, which is roughly the order a screen is
 * built: the frame first, then what it is filled with, then the club's own things.
 *
 * Here rather than in the app's declaration because it is a property of the set and not
 * of any one block, and because a reader of `blocksByCategory` wants one answer about
 * order rather than two.
 */
export const BLOCK_CATEGORIES: readonly BlockCategory[] = [
  'struktur',
  'recherche',
  'faktencheck',
  'medien',
  'mitmachen',
  'club',
];

export { MODULE_CATEGORIES };

/**
 * Every block the app declares, in the order it declares them — and so the palette of
 * every screen alike.
 *
 * It took a screen until ADR 0075 §6 and answers one list now. The parameter is gone
 * rather than kept and ignored, because a function that asks for a screen it does not
 * read is a restriction a reader keeps looking for.
 */
export function allBlocks(): readonly string[] {
  return Object.keys(MODULE_CATEGORIES);
}

/** The family a block is in, or `undefined` for a block this build does not know. */
export function categoryOf(block: string): BlockCategory | undefined {
  return Object.hasOwn(MODULE_CATEGORIES, block) ? MODULE_CATEGORIES[block] : undefined;
}

/** One category and the blocks in it. */
export interface BlockGroup {
  category: BlockCategory;
  blocks: readonly string[];
}

/**
 * What a picker draws: the categories in `BLOCK_CATEGORIES` order with their blocks, and
 * a category nothing is filed under left out entirely rather than drawn empty.
 *
 * The one export a tabbed picker needs, so that the grouping is decided once here and
 * not once per tool.
 */
export function blocksByCategory(): readonly BlockGroup[] {
  return BLOCK_CATEGORIES.map((category) => ({
    category,
    blocks: allBlocks().filter((block) => MODULE_CATEGORIES[block] === category),
  })).filter((group) => group.blocks.length > 0);
}
