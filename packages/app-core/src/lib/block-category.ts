/**
 * The families a block can belong to, and who may be placed where.
 *
 * [ADR 0073](../../../../adr/0073-every-screen-takes-every-block-and-a-block-declares-its-category.md).
 * Every configurable screen takes every block, so there is no per-screen table any more
 * and `blocksFor` answers nearly the same list for every screen. What is left of the
 * restriction is `SCREEN_BOUND_BLOCKS`, the four blocks that print a screen's own title,
 * and the parser holds a document to it (`home-layout.ts`).
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

import { MODULE_CATEGORIES, SCREEN_BOUND_BLOCKS } from './block-catalogue.generated';
import { type ConfigurableScreen } from './screen-layout';

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

export { MODULE_CATEGORIES, SCREEN_BOUND_BLOCKS };

/** Every block the app declares, in the order it declares them. */
export function allBlocks(): readonly string[] {
  return Object.keys(MODULE_CATEGORIES);
}

/** The family a block is in, or `undefined` for a block this build does not know. */
export function categoryOf(block: string): BlockCategory | undefined {
  return Object.hasOwn(MODULE_CATEGORIES, block) ? MODULE_CATEGORIES[block] : undefined;
}

/** The one screen a block is bound to, or `undefined` when it may go anywhere. */
export function screenBoundTo(block: string): ConfigurableScreen | undefined {
  return Object.hasOwn(SCREEN_BOUND_BLOCKS, block) ? SCREEN_BOUND_BLOCKS[block] : undefined;
}

/**
 * Whether a block may be arranged on a screen. True for a block nobody has declared,
 * which is what leaves `renderable` to say a module does not exist (`parseHomeLayout`).
 */
export function mayAppearOn(block: string, screen: ConfigurableScreen): boolean {
  const bound = screenBoundTo(block);
  return bound === undefined || bound === screen;
}

/** The blocks a screen's palette may offer, in the declaration's own order. */
export function blocksFor(screen: ConfigurableScreen): readonly string[] {
  return allBlocks().filter((block) => mayAppearOn(block, screen));
}

/** One category and the blocks of it a screen may take. */
export interface BlockGroup {
  category: BlockCategory;
  blocks: readonly string[];
}

/**
 * What a picker draws: the categories in `BLOCK_CATEGORIES` order, each with the blocks
 * this screen may take, and a category with nothing left for this screen left out
 * entirely rather than drawn empty.
 *
 * The one export a tabbed picker needs, so that the grouping is decided once here and
 * not once per tool.
 */
export function blocksByCategory(screen: ConfigurableScreen): readonly BlockGroup[] {
  const offered = blocksFor(screen);
  return BLOCK_CATEGORIES.map((category) => ({
    category,
    blocks: offered.filter((block) => MODULE_CATEGORIES[block] === category),
  })).filter((group) => group.blocks.length > 0);
}
