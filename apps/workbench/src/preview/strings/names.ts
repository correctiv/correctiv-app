/**
 * The names both halves of the strings tool use, in one module neither half owns.
 *
 * Here rather than in `draft.ts` because `plugin/strings.ts` runs in Node and reads
 * these too, as `plugin/home-layout.ts` reads `home/names.ts`.
 */

/**
 * The key the framed app reads the reworded strings from.
 *
 * Spelled a second time in `apps/mobile/src/lib/strings.ts`, because the app may not
 * import the workbench ([ADR 0040](../../../../../adr/0040-the-app-does-not-depend-on-the-workbench.md));
 * `test/preview/strings.test.ts` holds the two together.
 */
export const PREVIEW_STRINGS_KEY = 'workbench:strings';

/** The dev server's save, beside `HOME_LAYOUT_ENDPOINT`. */
export const STRINGS_ENDPOINT = '/__workbench/strings';

/** Where the German lives, one file per id namespace (ADR 0049). */
export const GERMAN_CATALOGUE_DIR = 'packages/catalogue/src/de';

/** The extraction, which is where the English each wording is checked against comes from. */
export const ENGLISH_EXTRACTION = 'packages/catalogue/src/en.json';

/** The locale this tool edits: the German is what is edited (ADR 0056 §6). */
export const EDITED_LOCALE = 'de';
