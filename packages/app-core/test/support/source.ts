/**
 * The net that says what a file imports, which is this repository's and not a
 * general reading of source.
 *
 * The two source readers that used to live here — `withoutComments` and
 * `withEscapesDecoded` — are `@correctiv/prose-and-code`'s now, with the limits
 * written down beside them, because they are about reading source at all rather
 * than about this repository. What is left is below, and it stays because the
 * question it answers is ours: which specifiers count as an import HERE.
 *
 * It lives in the CORE's test directory and the app re-exports it
 * (`apps/mobile/__tests__/support/source.ts`), which is the only direction that
 * works: the app depends on the core and the core must not depend on the app.
 *
 * **Why each of these is one copy rather than one per workspace**, which is the
 * argument that came with `withEscapesDecoded` and did not travel with it: both
 * localisation seams need an escaped letter written back before they read a string,
 * and a hole closed in one workspace and not the other is a hole. That is still the
 * rule; only the shelf has moved. `IMPORT_RE` obeys it from here, and the two
 * readers obey it from the package, which is the better shelf for them because
 * nothing in either of them is about us.
 *
 * **Where the blank-file guard is**, since the strippers no longer sit beside it:
 * `apps/mobile/__tests__/no-workbench-dependency.test.ts` holds it, and it is the
 * thing that makes the stripper's worst failure loud rather than quiet. Every JSON
 * it reads still has to parse once the comments are out. The shape of that guard is
 * the package's `eatenByStripping`; read its docblock for what it does not see.
 */

/**
 * Every form in which a module name can enter a file. Three alternatives, in this
 * order, because the first that matches at a position wins and consumes the text:
 *
 *  1. `import 'react-native'` — a side-effect import, which has no `from` at all
 *     and is exactly how one pulls in a module for what it does to globals.
 *  2. `import('…')` and `require('…')` — the runtime forms. `require` matters even
 *     in an ESM package: a `.js` under `src` is read by whatever loads it, and it
 *     is the spelling a copied snippet arrives in.
 *  3. `import … from '…'` / `export … from '…'`, over as many lines as it takes.
 *
 * The lookbehind keeps `myImport(` and `foo.require(` out, and `[^;]*?` keeps the
 * third alternative inside one statement — without it a `from`-less `export { a };`
 * swallows the lines after it, side-effect imports included.
 *
 * Here rather than in one of its callers: it is read by `boundary.test.ts` in this
 * workspace, which asks what the core imports, and by
 * `apps/mobile/__tests__/no-workbench-dependency.test.ts`, which asks what the app
 * imports. Two copies of a regular expression is two nets, and the one that stops
 * matching goes quiet rather than red. `boundary.test.ts` carries the fixture that
 * proves it still catches every form it claims to, and that fixture is therefore the
 * proof for both.
 *
 * **A KNOWN LIMIT.** A specifier that is not a literal — `import(someVariable)`,
 * `require(join(dir, name))` — has no text to match and is invisible here.
 */
export const IMPORT_RE = new RegExp(
  [
    String.raw`(?<![\w$.])import\s*['"]([^'"]+)['"]`,
    String.raw`(?<![\w$.])(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)`,
    String.raw`(?<![\w$.])(?:import|export)[^;]*?\bfrom\s+['"]([^'"]+)['"]`,
  ].join('|'),
  'g',
);

/** The module name out of whichever alternative of `IMPORT_RE` matched. */
export function specifier(match: RegExpMatchArray): string | undefined {
  return match[1] ?? match[2] ?? match[3];
}
