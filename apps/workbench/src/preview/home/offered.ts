/**
 * What the add-block palette is showing, decided without drawing anything.
 *
 * [ADR 0073](../../../../../adr/0073-every-screen-takes-every-block-and-a-block-declares-its-category.md)
 * §2's "What it costs" named a palette of thirty-two specimens on every screen as the price
 * the category was paid to cover, and said the way out was to read `blocksByCategory`
 * rather than invent a grouping. So this file holds no list: the families, their order and
 * the blocks each one holds come out of the core, and what is here is the two questions a
 * picker asks on top of them — **which family** and **which of them matches what was
 * typed** — as functions with no React in them, so a test can ask them.
 *
 * **`'all'` is a tab and not a family.** It is the one value here that the core does not
 * name, and it is kept out of `BlockCategory` on purpose: a category is a thing a block
 * declares, and "all of them" declares nothing. It is the tab somebody opens the dialog on,
 * because a newsroom arriving to add one block should see the whole shelf rather than have
 * to guess which family the block is in before they can look for it.
 *
 * **A search looks at every family, whatever tab is chosen**, and the tab row switches off
 * while there is one. The alternative — filtering inside the family the tab names — is a
 * search that answers "nothing here" for a block that is on the shelf two tabs along, and
 * the person who typed the word has no way to know that is what happened.
 */
import {
  blocksByCategory,
  type BlockCategory,
  type BlockGroup,
} from '@correctiv/app-core/lib/block-category';
import type { ConfigurableScreen } from '@correctiv/app-core/lib/screen-layout';

/** The family on show, or every family there is. */
export type PickerTab = BlockCategory | 'all';

/** The tab the palette opens on before anybody has chosen one. */
export const FIRST_TAB = 'all';

/**
 * The families a screen offers, in the core's own order.
 *
 * A family with nothing left for this screen is not in it: the four screen titles are bound
 * to their own screen (ADR 0073 §3), so a palette on Home has five families and one on the
 * Mediathek has six, and `blocksByCategory` is what has already dropped the sixth where it
 * would be empty.
 */
export function familyTabs(screen: ConfigurableScreen): BlockCategory[] {
  return blocksByCategory(screen).map((group) => group.category);
}

/** The tabs a screen offers, with "all" in front of the families. */
export function tabsFor(screen: ConfigurableScreen): PickerTab[] {
  return [FIRST_TAB, ...familyTabs(screen)];
}

/** Whether a value off storage is a tab this screen has. Anything else is `all`. */
export function isTab(value: string | null, screen: ConfigurableScreen): value is PickerTab {
  return tabsFor(screen).some((tab) => tab === value);
}

/**
 * The families and the blocks in them, with a tab and a search applied.
 *
 * `words` is what a block is called and what it does, in the reader's language, already
 * joined: the search runs on the words a person reads rather than on the block's id, and
 * handing them in is what keeps this file free of a formatter — and free of the site and
 * the app's catalogues both, which is why a test can call it with two strings.
 */
export function groupsShown(
  screen: ConfigurableScreen,
  tab: PickerTab,
  query: string,
  words: (module: string) => string,
): readonly BlockGroup[] {
  const groups = blocksByCategory(screen);
  if (matchesNothing(query)) return tab === FIRST_TAB ? groups : groups.filter(byCategory(tab));
  return groups
    .map((group) => ({
      category: group.category,
      blocks: group.blocks.filter((block) => says(block, query, words)),
    }))
    .filter((group) => group.blocks.length > 0);
}

/** Whether a search is asking anything at all. */
export function matchesNothing(query: string): boolean {
  return terms(query).length === 0;
}

/**
 * What a search counts, said above the results: how many blocks it found, and out of how
 * many this screen offers. A search that silently narrows the grid to one card leaves the
 * person wondering whether the others are gone.
 */
export function matchCount(
  groups: readonly BlockGroup[],
  screen: ConfigurableScreen,
): { found: number; of: number } {
  const found = groups.reduce((n, group) => n + group.blocks.length, 0);
  return { found, of: blocksByCategory(screen).reduce((n, group) => n + group.blocks.length, 0) };
}

const byCategory = (category: BlockCategory) => (group: BlockGroup) => group.category === category;

/**
 * Whether a block answers to a search.
 *
 * **Every word of the query has to be in the block's own words**, which is what makes
 * "audio mediathek" find the video row and "vide mediathek" find it as well: the
 * comparison folds case and diacritics on both sides, so a German umlaut typed without a
 * keyboard that has one still finds „Audio“. Splitting on whitespace rather than matching
 * the whole string is what makes a second word narrow the result instead of emptying it.
 */
function says(module: string, query: string, words: (module: string) => string): boolean {
  const haystack = fold(words(module));
  return terms(query).every((term) => haystack.includes(term));
}

/** A query split into words, folded the same way a block's words are. */
function terms(query: string): string[] {
  return query.split(/\s+/).filter(Boolean).map(fold);
}

/** Case and diacritics off, so a query does not have to spell the word exactly. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/**
 * Where the last tab is remembered, for as long as the tab is open.
 *
 * **`sessionStorage` and not `localStorage`**, because this is a person coming back to the
 * same task: somebody who opened the Mediathe's palette, looked at Audio und Video and
 * walked away should find it there next time they arrange that screen. It is forgotten when
 * the tab is closed, which is the day the arrangement stops being the thing in front of
 * them.
 *
 * **`workbench:` in front of it, and the reason is one origin rather than taste.** The shell
 * and the app are one origin ([ADR
 * 0014](../../../../../adr/0014-the-preview-shell-as-a-package.md)), so this site's
 * storage IS the app's; `lib/locale.ts` argues the arrangement at length, and a bare key
 * would be one more piece of state the published export could be holding for ever with
 * nothing to say who wrote it.
 *
 * The read is guarded for the other reason: touching `sessionStorage` throws when site data
 * is switched off, and a palette that cannot remember which tab it was on must still open.
 */
export const TAB_KEY = 'workbench:palette.tab';

/** The tab to open on, and `all` whenever storage says nothing or something else. */
export function readTab(screen: ConfigurableScreen): PickerTab {
  try {
    const stored = globalThis.sessionStorage?.getItem(TAB_KEY) ?? null;
    return isTab(stored, screen) ? stored : FIRST_TAB;
  } catch {
    return FIRST_TAB;
  }
}

/** Remembers the tab for this browser tab, and says nothing when it cannot. */
export function rememberTab(tab: PickerTab): void {
  try {
    globalThis.sessionStorage?.setItem(TAB_KEY, tab);
  } catch {
    // Site data switched off. The tab still holds, in the state the dialog owns.
  }
}
