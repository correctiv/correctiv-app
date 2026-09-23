/**
 * The names the editor's two ends have to spell the same way.
 *
 * A leaf with no imports at all, and that is the whole reason it is a file. Vite loads
 * `vite.config.ts` with Node, and Node refuses the core's `home.layout.json` without an
 * import attribute — so a dev-server plugin cannot reach a module that imports the core,
 * and the endpoint needs both the key and the address before a request can even be
 * matched. Everything else it needs is loaded through Vite's own pipeline when a request
 * arrives, which is what `plugin/home-layout.ts` does and says.
 *
 * `document.ts` re-exports them, so nothing in the browser has to know this file exists.
 * The third name below, the simulated clock's, is here for the company rather than for
 * the dev server: it is the second half of the same seam, and a key that named the same
 * tool from another file is how two spellings of one key start.
 */

/**
 * Where the app looks for a document somebody else wrote.
 *
 * The same string as `HOME_LAYOUT_OVERRIDE_KEY` in
 * `apps/mobile/src/lib/home/layout.ts`, and the app's file is where the argument for it
 * lives. Two spellings of one key is the failure ADR 0014 warns about for cross-origin,
 * reached by a different door: every edit would still "succeed", the app would go on
 * drawing the compiled-in document, and nothing anywhere would say why.
 * `test/preview/home-document.test.ts` holds the two together.
 */
export const HOME_LAYOUT_KEY = 'workbench:home-layout';

/**
 * Where the app looks for a time somebody else is pretending it is.
 *
 * The same string as `HOME_TIME_OVERRIDE_KEY` in `apps/mobile/src/lib/home/clock.ts`,
 * and the app's file is where the argument for it lives. It is here rather than beside
 * the tool that writes it for the same reason the layout key is: this file has no
 * imports, so the dev server can read a name out of it without loading the core.
 *
 * `test/preview/home-document.test.ts` holds the two spellings together, because the
 * failure is silent in the same way — the timeline would move, the frame would go on
 * showing whatever hour it actually is, and nothing anywhere would say why.
 */
export const HOME_TIME_KEY = 'workbench:home-time';

/**
 * The endpoint `plugin/home-layout.ts` answers on, in development and nowhere else.
 *
 * `__workbench` is a prefix no route, no document and no proxy rule in `vite.config.ts`
 * uses, which is what keeps it from being shadowed by the app on `/app` or by a document
 * whose slug somebody adds later.
 */
export const HOME_LAYOUT_ENDPOINT = '/__workbench/home-layout';

/**
 * Where the document lives in the repository, spelled once for both of its writers.
 *
 * The dev server's Save writes it (`plugin/home-layout.ts`), and Submit changes opens
 * GitHub's editor on it (`write.ts`). Two spellings of one path would be two places for a
 * move of the file to be half done, and the half that went unnoticed would be the one that
 * opens an editor on a file that is no longer there.
 */
export const HOME_LAYOUT_FILE = 'packages/app-core/src/data/home.layout.json';

/**
 * The address a section gets in the rendered tree, spelled a second time.
 *
 * The same string `placeTestID` in `apps/mobile/src/lib/home/modules.tsx` writes onto
 * every section's wrapper — `data-testid` once React Native Web has rendered it — and
 * the shell may not import that file to share the one function, for the reason this
 * file's own doc comment gives. So this is the other half of the pair `HOME_LAYOUT_KEY`
 * already is: two spellings of one key, kept apart rather than reconciled, because nothing
 * enforces the two staying equal but reading them side by side.
 */
export function sectionTestId(id: string): string {
  return `home-section-${id}`;
}
