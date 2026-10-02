/**
 * What each block IS — the family it belongs to — and the few that are bound to one
 * screen, declared where the blocks are written.
 *
 * [ADR 0073](../../../../../adr/0073-every-screen-takes-every-block-and-a-block-declares-its-category.md)
 * §1 replaced the table this file used to hold. Until then every block named the screens
 * it was allowed on, `MODULE_SCREENS`, and the palette offered a screen what that table
 * let it offer: Home could not be given the Mediathek's live radio because a row in a
 * table said so. The newsroom's answer is that every block may be placed on every
 * configurable screen, so the table is gone rather than grown.
 *
 * ## What is left, and why each half is here
 *
 * **A category** (§2), because a palette of thirty-two blocks is a list nobody reads.
 * It is the app's vocabulary, like the id and the settings, so it is declared here and
 * carried into the core by `scripts/generate-home-settings.mjs`; the WORDS for it are the
 * workbench's, in `apps/workbench/src/preview/home/document.ts`, which is ADR 0054 §3
 * unchanged — the app declares what a thing is, the workbench says what it is called.
 *
 * **A screen for the handful that are bound to one** (§3). Four blocks print a screen's
 * own title, and "Mediathek" at the top of Home would be a heading that lies about where
 * the reader is. That is a restriction on four blocks rather than a table over all of
 * them, and a block missing from it is free, which is the direction that now takes no
 * maintenance.
 *
 * This file is also the app's roll-call of blocks: `MODULE_CATEGORIES` has an entry per
 * block, asserted against `modules.tsx` in both directions by
 * `__tests__/home-layout.test.tsx`, which is what ADR 0054 §2 bought and this record
 * keeps.
 *
 * ## Why it is a file of its own, beside `settings.ts` rather than inside it
 *
 * `settings.ts` gives the reason about itself: a declaration a generator reads by
 * importing it must hold no React and import nothing at a path Node cannot resolve. This
 * file imports two types and nothing else, which is what keeps that door open.
 */

import type { BlockCategory } from '@correctiv/app-core/lib/block-category';
import type { ConfigurableScreen } from '@correctiv/app-core/lib/screen-layout';

/**
 * Block name, as the document writes it, to the family it belongs to.
 *
 * Keyed by a string for the reason `settings.ts` gives: typing it against `HOME_MODULES`
 * would mean importing that file and the React Native tree under it.
 *
 * One category per block and never a list. A block in two families is a block whose
 * tab a person has to guess at, and the question the picker answers is "where do I look
 * for the video row", which has one answer or it is not worth asking. Where a block could
 * honestly go in two, the one it is filed under is the one somebody arranging a screen
 * would reach for first: the fact-check rail is a `faktencheck` before it is a feed, the
 * tip card is the fact-check desk's line before it is a way to take part.
 *
 * The order here is the order the picker draws within a category, and the order of the
 * categories themselves is `BLOCK_CATEGORIES` in the core.
 */
export const MODULE_CATEGORIES: Readonly<Record<string, BlockCategory>> = {
  'home-header': 'struktur',
  'feed-status': 'struktur',
  'discover-header': 'struktur',
  'search-entry': 'struktur',
  'mediathek-header': 'struktur',
  'participate-header': 'struktur',
  'impact-footer': 'struktur',

  'article-hero': 'recherche',
  'latest-research': 'recherche',
  'spotlight-briefing': 'recherche',
  'topic-rail': 'recherche',
  'project-directory': 'recherche',

  'faktencheck-rail': 'faktencheck',
  'faktenforum-card': 'faktencheck',
  'tip-card': 'faktencheck',

  'mediathek-reihe': 'medien',
  'live-radio-banner': 'medien',
  'podcast-rail': 'medien',
  'gespraech-rail': 'medien',
  'funfacts-rail': 'medien',
  'bonus-audio-list': 'medien',

  'callout-teaser': 'mitmachen',
  'callout-list': 'mitmachen',
  'atlas-card': 'mitmachen',
  'community-note': 'mitmachen',

  'early-access-card': 'club',
  'backstage-teaser': 'club',
  'profile-club-card': 'club',
  'profile-membership': 'club',
  'profile-impact': 'club',
  'profile-area': 'club',
  'profile-newsletter': 'club',
};

/**
 * The blocks that belong to one screen and to no other, and the screen each one is.
 *
 * Four, and all four for one reason: each prints the NAME of the screen it sits on.
 * `mediathek-header` draws the word "Mediathek" and nothing else, so on Home it would be
 * a heading saying the reader is somewhere they are not. `home-header` is the same
 * argument from the other end — it is the app's answer to "where am I", which ADR 0071 §4
 * makes the floor under every fallback, and a second one further down a screen is not an
 * arrangement anybody wants to be able to save.
 *
 * **A generic title block was considered and refused**, and ADR 0073 §3 is where. Its
 * title would have to be a setting, and a setting carrying a heading puts German prose
 * into the layout document, which ADR 0057 §2 keeps free of content. The four headers
 * also differ in more than their word: Home's carries the date, the greeting and the
 * search, Mitmachen's an introduction under the title.
 *
 * A block that is not in here may be placed on every configurable screen. That is the
 * default, so this table only ever grows by somebody deciding it should.
 */
export const SCREEN_BOUND_BLOCKS: Readonly<Record<string, ConfigurableScreen>> = {
  'home-header': 'home',
  'discover-header': 'entdecken',
  'mediathek-header': 'mediathek',
  'participate-header': 'mitmachen',
};
