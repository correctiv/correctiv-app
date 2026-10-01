/**
 * The import net, which lives in the core's test directory.
 *
 * Re-exported rather than copied: `packages/app-core/test/boundary.test.ts` asks
 * what the core imports and `no-workbench-dependency.test.ts` asks what the app
 * imports, and the app may reach into the core while the core may not reach back.
 * This file is the one line that keeps the two suites reading an import the same
 * way — including the limit, which is written down beside the expression.
 *
 * The source readers are not here any more. `withoutComments` and
 * `withEscapesDecoded` are `@correctiv/prose-and-code`'s, imported by their name in
 * each check that reads source as text.
 */
export { IMPORT_RE, specifier } from '../../../../packages/app-core/test/support/source';
