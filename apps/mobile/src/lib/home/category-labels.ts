/**
 * What each family of blocks is CALLED, and the one hook that says it in the reader's
 * language.
 *
 * The category itself is the app's vocabulary, declared beside the blocks in
 * `./blocks.ts` and carried into the core by `scripts/generate-home-settings.mjs`, which
 * is what gives `blocksByCategory(screen)` to every tool ([ADR
 * 0073](../../../../../../adr/0073-every-screen-takes-every-block-and-a-block-declares-its-category.md)
 * §2). **The words were the workbench's and now are the app's**, which is the one claim
 * ADR 0073 §2 made that a later decision struck: the newsroom's palette reads them, and
 * so does the component gallery, and the gallery is the APP's own page — a German word
 * cannot be written there and an app cannot import the workbench to ask for one
 * ([ADR 0040](../../../../../../adr/0040-the-app-does-not-depend-on-the-workbench.md)).
 * One table for both hosts is the only arrangement in which neither holds a second copy
 * of six words.
 *
 * **Still not in the core.** ADR 0054 §3's line is the app declares what a thing is and
 * the tool says what it is called; `packages/app-core` holds neither, and the German that
 * ships is `packages/catalogue/src/de/home.ts`, beside every other `home.*` string.
 *
 * **And the ids did not move with the table.** `home.category.*` is what the workbench
 * already extracted, so a translator's existing entry is the one that is reused rather
 * than a new id to fill in; the only thing that moved is which catalogue holds it.
 *
 * ## Why a hook and not a bare table
 *
 * `useCategoryLabel` exists because the two hosts cannot both format this table
 * themselves. The gallery sits under the app's own `IntlProvider` and would simply call
 * `useIntl()`. The workbench must not: `test/i18n.test.ts` fails on a `useIntl` anywhere
 * in `apps/workbench/src` outside `i18n/`, and rightly, because its context there is the
 * APP's — the palette's dialog is inside the `AppHost` the block list mounts. So the
 * picker asks this hook, which resolves against the app's catalogue like every other word
 * in a drawing, and the tool's own words keep following the SITE's language setting
 * ([ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 *
 * The consequence is worth stating once, because it is visible rather than theoretical:
 * these six words follow the app's language, which the preview's `lg=` chooses and which
 * is German unless a build says otherwise, while the words around them follow the site's
 * setting. That is the same split the block drawings beside them already make, and it is
 * the price of there being one table.
 */
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';

import type { BlockCategory } from '@correctiv/app-core/lib/block-category';

/**
 * What each family of blocks is called, for the heading a picker or a gallery groups
 * under.
 *
 * Keyed by `BlockCategory` rather than by a string, which is the difference from
 * `MODULE_LABELS` in the workbench's `preview/home/document.ts`: the union is the core's,
 * so a category added without a word is a type error here rather than a heading reading
 * `faktencheck` to a newsroom.
 */
export const CATEGORY_LABELS: Readonly<Record<BlockCategory, MessageDescriptor>> = defineMessages({
  struktur: {
    id: 'home.category.struktur',
    defaultMessage: 'Structure and notices',
    description:
      'The heading over the blocks that build a screen’s frame rather than its content: the headers, the search field, the loading notice and the footer.',
  },
  recherche: {
    id: 'home.category.recherche',
    defaultMessage: 'News and investigations',
  },
  faktencheck: {
    id: 'home.category.faktencheck',
    defaultMessage: 'Fact checking',
  },
  medien: {
    id: 'home.category.medien',
    defaultMessage: 'Audio and video',
  },
  mitmachen: {
    id: 'home.category.mitmachen',
    defaultMessage: 'Taking part and community',
  },
  club: {
    id: 'home.category.club',
    defaultMessage: 'Club and profile',
    description:
      'The heading over the blocks a membership pays for and the ones that show it: early access, Backstage, and the profile’s own rows.',
  },
});

/**
 * One family's name in the reader's language.
 *
 * A hook rather than a formatter argument, because the caller that needs it inside the
 * workbench has no `IntlShape` it may use: `useWorkbenchIntl()` resolves against the
 * site's own catalogue, which holds no `home.*` id, and `useIntl()` there resolves
 * against the app's, which is the one this table belongs to.
 */
export function useCategoryLabel(category: BlockCategory): string {
  return useIntl().formatMessage(CATEGORY_LABELS[category]);
}
