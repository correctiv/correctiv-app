import type { Audience } from '@correctiv/app-core/lib/home-audience';

/**
 * When each block on the home screen appears, declared where the block is written.
 *
 * [ADR 0060](../../../../../adr/0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md)
 * gives a block's conditions two kinds and one vocabulary, and this file holds the block's
 * half of both.
 *
 * **What a block owns.** Some blocks draw nothing in some states, and nobody configures
 * that: the loading and offline notice exists only while the app loads or is offline, the
 * briefing only once an issue is loaded. The rule is in the module's code in `modules.tsx`
 * and stays there; what is written here is the rule's NAME, so the configurator can say why
 * a block draws nothing rather than only that it does (§1). A name is all it is. Nothing
 * reads it to decide anything, and nothing here can check it against the code it names:
 * whoever changes a module's early return changes its line here, and the test that holds
 * the list to `HOME_MODULES` holds only that every block has said something.
 *
 * **What a block suggests.** A block may name the audience it is for unless the document
 * says otherwise (§2). That one the core does read, because the fold draws a place only for
 * its audience, so `scripts/generate-home-settings.mjs` carries `HOME_MODULE_AUDIENCES` into
 * `packages/app-core/src/lib/home-audience.generated.ts` exactly as it carries the settings
 * ([ADR 0045](../../../../../adr/0045-the-home-editor-arranges-the-blocks-it-draws.md) §9).
 * The intrinsic conditions are not carried, because the core has no use for them.
 *
 * This file holds no React and imports only types, for the reason `settings.ts` gives about
 * itself: the generator loads it with Node's type stripping, and an ordinary import is a
 * path Node cannot resolve. `__tests__/home-settings.test.ts` reads the import shapes here
 * as source for that reason.
 */

/**
 * The states a block can need before it draws anything, by the name the configurator
 * prints a sentence for.
 *
 * A closed union, so a new one is a type error in the workbench's table of sentences until
 * somebody writes it (ADR 0031's mechanism 1).
 */
export type IntrinsicCondition =
  | 'loading-or-offline'
  | 'has-lead-article'
  | 'has-spotlight-issue'
  | 'has-more-research'
  | 'has-fact-checks'
  | 'has-open-callout';

/**
 * Block name, as the document writes it, to the one state it needs, or `null` for a block
 * that always draws.
 *
 * Every block has an entry, and `null` is written rather than implied, for the reason
 * `screens.ts` gives for its own list: an absent entry would be the implicit answer again,
 * and a block that has never been asked would read the same as one that always draws.
 * `__tests__/home-layout.test.tsx` asserts this list against `HOME_MODULES` in both
 * directions.
 */
export const MODULE_CONDITIONS: Readonly<Record<string, IntrinsicCondition | null>> = {
  'home-header': null,
  // `offline || loading`, in `FeedStatusModule`.
  'feed-status': 'loading-or-offline',
  // A pin, or the newest item of the investigations feed; nothing when both are missing.
  'article-hero': 'has-lead-article',
  // `recent.length === 0` in `SpotlightBriefing`.
  'spotlight-briefing': 'has-spotlight-issue',
  'early-access-card': null,
  // It lists the items after the lead, so it needs a second one.
  'latest-research': 'has-more-research',
  'faktencheck-rail': 'has-fact-checks',
  // The first callout whose status is `open`.
  'callout-teaser': 'has-open-callout',
  'mediathek-reihe': null,
  'backstage-teaser': null,
  'impact-footer': null,
};

/**
 * Block name to the audience it is for unless the document says otherwise.
 *
 * Only the blocks that have one. Absent is everyone, and it is absent rather than written
 * out here because a default is the exception: every block is for every reader unless it
 * speaks to a membership, and a list of eleven `'everyone'` would bury the one that does.
 *
 * **The early-access card** is for members who pay a contribution. Its own words are a
 * club member's: "Backstage · Früher lesen", "Sie lesen jetzt, drei Tage vor allen anderen".
 * To a reader in by a local newsletter with a 0 € membership, that sentence is not true.
 *
 * **The Backstage teaser is not here, and that is a decision** (ADR 0060 §2). Its own
 * docblock is the argument: the diary is open, the bonus is the member's part, and the card
 * is the club's case made to whoever reads it. Filtering it to the people already in the
 * club would take the case away from the one reader it is made to.
 */
export const HOME_MODULE_AUDIENCES: Readonly<Record<string, Audience>> = {
  'early-access-card': 'paying-members',
};
