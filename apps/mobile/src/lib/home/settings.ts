import type {
  ArticleSetting,
  CategorySetting,
  CountSetting,
  FlagSetting,
  ScreenSetting,
  SettingSpec,
  TagSetting,
  TextSetting,
} from '@correctiv/app-core/lib/home-settings';

/**
 * What each module on the home screen may be configured to show, declared where the
 * module is written.
 *
 * [ADR 0045](../../../../../adr/0045-the-home-editor-arranges-the-blocks-it-draws.md) §9:
 * a module and its settings are one thing to write and one thing to read. `modules.tsx`
 * beside this file is what reads a value; this file is what says the value may exist.
 * They used to be two halves in two packages, and the failure when they parted was
 * quiet — a spec no module reads does nothing, and a module reading a key the table does
 * not list gets its fallback forever, because the parser refuses the key and drops it.
 *
 * ## Why this is not simply the table the core validates against
 *
 * The core has to refuse a setting a module does not understand, the way it already
 * refuses a key a section does not understand, and refusing means knowing. So the table
 * has to BE in `packages/app-core`: `parseHomeLayout(document)` answers the same way in a
 * test, in a check, in the configurator and in the app, with nothing booted first
 * (ADR 0045 §9, "Runtime registration was refused").
 *
 * It cannot be imported from here, because the core is a dependency of this app and an
 * import the other way is a cycle and the end of the core standing on its own
 * ([ADR 0006](../../../../../adr/0006-one-core-two-hosts.md)). And it cannot sit in the
 * core beside the parser, because then it is not beside the module.
 *
 * `scripts/generate-home-settings.mjs` is what crosses that boundary without reversing
 * it. It reads this file and writes `packages/app-core/src/lib/home-settings.generated.ts`,
 * which imports nothing from this app. The dependency at build time is a script reading a
 * file; the dependency at compile time and at runtime stays what it was.
 * `__tests__/home-settings.test.ts` is what fails when the emitted file and this one have
 * parted, and its fix is `npm run home-settings` and a commit — ADR 0031's mechanism 2,
 * one rung along from `generate-component-ids.mjs`.
 *
 * ## Why this file holds no React and imports only types
 *
 * The generator reads it by IMPORTING it, with Node's own type stripping, so nothing here
 * may survive that stripping into a runtime import. `import type` above is erased; an
 * ordinary import of the core, of a component, of anything under `@/`, would be a module
 * Node has to resolve at a path it has no resolver for. Nothing in `npm run check` sees
 * that by itself — jest resolves this file through babel and the tsconfig paths, so it
 * imports happily while the generator is dead — which is why
 * `__tests__/home-settings.test.ts` reads the import SHAPES here as source.
 *
 * That is also why the declarations are a file of their own rather than a block at the
 * top of `modules.tsx`, and there are two obstacles rather than one. The second is the
 * one usually named: that file imports React Native on its first line. The first is that
 * Node's type stripping does not handle `.tsx` at all, so the file is refused before a
 * single import in it is resolved.
 *
 * ## Why every setting carries its default
 *
 * `latest-research` drew five items because `slice(1, 6)` said so in the app. The moment
 * an editor can change that number, "five" is a fact in two places — the module that
 * slices and the editor that has to show what happens when nobody has chosen. It is one
 * place, here, and both read it.
 *
 * A module with no entry below understands no settings, which is most of them. That is
 * not an omission to fill in: a setting exists because somebody named an editorial
 * question it answers, and inventing one because a module looked bare is how a
 * configuration surface grows fields nobody uses and everybody has to keep working.
 */

/**
 * The settings themselves, each named, then the table that says whose they are.
 *
 * Named rather than written inline in the table below, because a module that READS one
 * needs its exact kind and not the union: `pinnedItem(settings, HERO_PIN)` type-checks
 * and `pinnedItem(settings, HOME_MODULE_SETTINGS['article-hero'][0])` does not, since the
 * table is keyed by a string and answers with the union. Two constants and a table built
 * from them is one fact in one place either way.
 */
export const HERO_PIN: ArticleSetting = { key: 'pin', kind: 'article', fallback: null };

/**
 * The rules of the three blocks with an editorial question about WHAT they draw
 * (ADR 0057 §2, ADR 0071 §7). The fallback of each is what the block draws today, so a
 * document that sets none of them changes nothing: no category for the lead and the
 * investigations, the fact-check category (`FEEDS.faktencheck.categoryId`) for the rail.
 */
export const HERO_CATEGORY: CategorySetting = { key: 'category', kind: 'category', fallback: null };
export const RESEARCH_CATEGORY: CategorySetting = {
  key: 'category',
  kind: 'category',
  fallback: null,
};
export const RESEARCH_TAG: TagSetting = { key: 'tag', kind: 'tag', fallback: null };
export const FACT_CHECK_CATEGORY: CategorySetting = {
  key: 'category',
  kind: 'category',
  fallback: 5,
};

export const RESEARCH_COUNT: CountSetting = {
  key: 'count',
  kind: 'count',
  min: 1,
  max: 8,
  fallback: 5,
};

export const FACT_CHECK_COUNT: CountSetting = {
  key: 'count',
  kind: 'count',
  min: 1,
  max: 12,
  fallback: 8,
};

/**
 * The four questions the screen header asks, which are the whole of what the four title
 * rows it replaced differed in (ADR 0075 §6).
 *
 * The title itself is not among them, and that is §3's decision rather than an omission:
 * the header prints the title of the screen it is on, out of that screen's own document,
 * so a screen with two headers still has one name and the "Mehr" list can read a name off
 * a screen that has no header at all.
 *
 * **Every fallback is the quiet one**, so the four rows are reproduced by what each
 * document says and never by what it leaves out: Home writes `mark` and `date`, Mitmachen
 * writes its `intro`, and Entdecken and Mediathek write nothing at all because a title on
 * its own is what they already drew.
 */
export const HEADER_MARK: FlagSetting = { key: 'mark', kind: 'flag', fallback: false };
export const HEADER_DATE: FlagSetting = { key: 'date', kind: 'flag', fallback: false };
export const HEADER_SEARCH: FlagSetting = { key: 'search', kind: 'flag', fallback: false };

/**
 * The sentence under the title. The core's own bound (120 characters) and one line, which
 * is what an introduction is here: the paragraph under "Mitmachen" is 99 characters in
 * German and 106 in English, and a heading that wants a second paragraph wants a block.
 */
export const HEADER_INTRO: TextSetting = { key: 'intro', kind: 'text', fallback: null };

/**
 * The screen a link block points at, by id (ADR 0075 §7). No fallback but `null`: a link
 * with no target is left out, and so is one whose target no document carries.
 */
export const LINK_SCREEN: ScreenSetting = { key: 'screen', kind: 'screen', fallback: null };

/**
 * Module name, as the document writes it, to the settings it understands.
 *
 * Different blocks want different settings: which article one highlights (the product
 * side asked for that by name), how many a list draws, which category or tag a rule
 * reads from, and what the header at the top of a screen puts beside its title.
 *
 * Keyed by a string rather than by the module names `modules.tsx` holds, because typing
 * it against those would mean importing that file and the React Native tree under it —
 * see above. What holds the two together instead is
 * `__tests__/home-layout.test.tsx`, which fails on a module named here that the app
 * cannot draw.
 */
export const HOME_MODULE_SETTINGS: Readonly<Record<string, readonly SettingSpec[]>> = {
  'screen-header': [HEADER_MARK, HEADER_INTRO, HEADER_DATE, HEADER_SEARCH],
  'screen-link': [LINK_SCREEN],
  'article-hero': [HERO_PIN, HERO_CATEGORY],
  'latest-research': [RESEARCH_COUNT, RESEARCH_CATEGORY, RESEARCH_TAG],
  'faktencheck-rail': [FACT_CHECK_COUNT, FACT_CHECK_CATEGORY],
};
