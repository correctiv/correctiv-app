/**
 * Which screens each block may be arranged on, declared where the block is written.
 *
 * [ADR 0054](../../../../../adr/0054-a-block-declares-where-it-may-appear.md) §2: until
 * now the answer was spelled in the name of the constant that holds the blocks,
 * `HOME_MODULES`, and a name stops answering the moment there is a second screen. This
 * file is that answer written down, and §5 is why it is written before the second screen
 * exists rather than with it: the editor's palette reads it today, so the declaration has
 * somewhere to be wrong.
 *
 * ## Why this is a second list, and what holds it
 *
 * `__tests__/home-layout.test.tsx` says of the palette that it is built from
 * `HOME_MODULES` itself, so there is no second list to fall behind. This file IS that
 * second list, and the trade is deliberate: a block that says nothing about where it
 * belongs is a block whose place is guessed by whoever reads the registry's name. What
 * takes the place of absence is an assertion in both directions, in that same file — a
 * module with no entry here fails, and an entry here naming no module fails.
 *
 * A default would have avoided the list: absent means `['home']`, and only the exceptions
 * get written. It is refused for the reason ADR 0054 §2 gives. A default is the implicit
 * answer again, wearing a table, and the first block that belongs somewhere else would be
 * the only one that had ever said so.
 *
 * ## Why it is a file of its own, beside `settings.ts` rather than inside it
 *
 * Two reasons, and only the second is about this file. `settings.ts` answers what a block
 * may be configured to SHOW and is carried into the core by a generator, because the
 * core's parser has to refuse a setting a block does not understand. Where a block may
 * appear is a different question with a different reader, and nothing in the core asks it
 * yet: there is one configurable screen and one document, so a parser that refused a
 * block on the wrong screen would be refusing something nobody can express (ADR 0054 §5).
 *
 * The other reason is the one `settings.ts` gives about itself: a declaration a generator
 * may one day read by importing it must hold no React and import nothing at a path Node
 * cannot resolve. This file imports nothing at all, which is the cheapest way to keep
 * that door open.
 */

/**
 * A screen whose arrangement is a document the newsroom edits.
 *
 * One member today, and a union rather than a string so that the second one is a type
 * error everywhere it has not been thought about rather than a value that flows through.
 */
export type ConfigurableScreen = 'home';

/**
 * Block name, as the document writes it, to the screens it may be arranged on.
 *
 * Keyed by a string for the reason `settings.ts` gives: typing it against `HOME_MODULES`
 * would mean importing that file and the React Native tree under it.
 *
 * Every list here reads `['home']` and that is the whole of what there is to say today.
 * The list is a list rather than a value because the obvious second case is one block on
 * two screens — the fact-check rail is the same composition on Entdecken as it is here —
 * and two declarations for one block would be two things to keep in step.
 */
export const MODULE_SCREENS: Readonly<Record<string, readonly ConfigurableScreen[]>> = {
  'home-header': ['home'],
  'feed-status': ['home'],
  'article-hero': ['home'],
  'spotlight-briefing': ['home'],
  'early-access-card': ['home'],
  'latest-research': ['home'],
  'faktencheck-rail': ['home'],
  'callout-teaser': ['home'],
  'mediathek-reihe': ['home'],
  'backstage-teaser': ['home'],
  'impact-footer': ['home'],
};

/** The blocks a screen's palette may offer, which is what the editor asks for. */
export function blocksFor(screen: ConfigurableScreen): readonly string[] {
  return Object.keys(MODULE_SCREENS).filter((module) => MODULE_SCREENS[module]?.includes(screen));
}
