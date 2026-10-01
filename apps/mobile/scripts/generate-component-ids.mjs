#!/usr/bin/env node
/**
 * Produces src/gallery/components.generated.ts: the union of every component
 * address `src/components` actually contains.
 *
 * ## Why this exists rather than a test
 *
 * "Every component has a catalogue entry" used to be a source-reading test with a
 * list of exceptions — the weakest of ADR 0031's four mechanisms, and the one it
 * names as standing a rung too low. TypeScript cannot read a directory, so the
 * set the catalogue must cover is not a union anybody typed. This script is the
 * half that makes it one; `src/gallery/catalogue.tsx` is the half that spends it.
 * Forgetting a component is then a compile error, and forgetting to run this is a
 * red test (`__tests__/gallery-catalogue.test.ts`, the drift check).
 *
 * ## Why the walk is exported
 *
 * The test still has to read `src/components` for the three facts no type can see
 * — one component per file, named after its file; nothing hiding in a `.ts`; the
 * directory is not silently empty. Two walks with two ideas of what a component
 * is would be two answers, so there is one walk and the test imports it.
 *
 * Run: npm run component-ids
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { filesUnder, withoutComments } from '@correctiv/prose-and-code';

/** How the emitted file names itself, so a reader of the artefact lands here. */
const SCRIPT = 'scripts/generate-component-ids.mjs';
/** The one spelling of the command, printed in the artefact's header. */
const COMMAND = 'npm run component-ids';

/** This package, by its own name, so nothing above the repo can answer instead. */
const APP_PKG_NAME = '@correctiv/mobile';

/**
 * Where this app is, found rather than counted in `..`s.
 *
 * This module is loaded two ways: as real ESM by `npm run component-ids`, and
 * transpiled to CommonJS by babel-jest for the drift check. Under the latter
 * `import.meta.url` is **null**, so using it unguarded throws before any test can
 * run — `scripts/tokens-source.mjs` carries the same note and learned it the same
 * way. The fallback is the working directory, which is inside this package for
 * jest (cwd = rootDir) and inside the repo for a `node` invocation from anywhere.
 *
 * @returns {string}
 */
function findAppRoot() {
  const self = typeof import.meta?.url === 'string' ? import.meta.url : null;
  const from = self ? resolve(dirname(fileURLToPath(self)), '..') : process.cwd();
  for (let dir = from; ; dir = dirname(dir)) {
    const pkg = join(dir, 'package.json');
    try {
      if (JSON.parse(readFileSync(pkg, 'utf8')).name === APP_PKG_NAME) return dir;
    } catch {
      // No package.json here, or an unreadable one — not this app, keep walking.
    }
    if (dirname(dir) === dir) {
      throw new Error(`${SCRIPT}: no ${APP_PKG_NAME} package.json at or above ${from}`);
    }
  }
}

const APP = findAppRoot();
const COMPONENTS = resolve(APP, 'src/components');
const OUT = resolve(APP, 'src/gallery/components.generated.ts');

/**
 * **What counts as a component**: a PascalCase value exported from a `.tsx` file
 * under `src/components`, addressed as `folder/Name`.
 *
 * Three lines drawn, each for a reason that can be checked rather than argued:
 *
 *  - **The export, not the file.** `VideoFrame.web.tsx` exports `VideoFrame`,
 *    because the suffix is Metro's and not the caller's, so a platform split
 *    collapses to one address without a suffix rule — which is what the gallery
 *    needs, since it draws whichever half the bundler kept and cannot say which.
 *    Both halves therefore produce the same address and the union holds it once.
 *  - **`.tsx`, not `.ts`.** JSX in a `.ts` file is a typecheck error, so a `.ts`
 *    file under this folder renders nothing — the barrel and the shared prop
 *    types (`reader/types.ts`, `media/videoFrameTypes.ts`,
 *    `ui/screenHeaderTypes.ts`) are excluded by the extension and need no
 *    exception of their own. The test's `hides no component in a .ts file` keeps
 *    the extension a rule rather than an assumption.
 *  - **PascalCase, and it must contain a lower-case letter.** `sampleTarget` is
 *    callable and lower case; `HEADER_COPY` and `READER_BASE_URL` are capitalised
 *    and are not components. `apps/workbench/scripts/api.mjs` draws the same line
 *    with a real type graph — "a capitalised callable", `componentSignature` —
 *    and it is the same line for the same reason: nothing under `src/components`
 *    is both callable and capitalised except a component. This reads spelling
 *    instead of callability, so it errs towards noticing: a PascalCase export
 *    that is not a component has to be catalogued or excused, and that is a
 *    conversation rather than a silence.
 *
 * **Which spellings of "export" it sees**, because the first version saw two and
 * the ones it missed were the dangerous half: a component the walk cannot see is
 * absent from the union, and an absence makes nothing fail. `export function`,
 * `export const`, `export class`, `export let`, `export var`, any of those after
 * `export default`, any of them after `async`, `export default Name;` on its own,
 * and a local declaration published by `export { Name }` or `export { Name as
 * Other }`. `export default function Foo` is the form a screen turned into a
 * component would arrive in, and it used to be invisible.
 *
 * **And what it still cannot see**, which is the list to add to rather than to
 * widen a pattern for:
 *
 *  - **A default export with no name.** `export default () => …` and `export
 *    default function () {}` have nothing to address, so there is nothing to put
 *    in the union. A component here is named after its file and the test asserts
 *    it; an anonymous default cannot satisfy that and should be given a name.
 *  - **A default export through a call.** `export default memo(Card)` and
 *    `forwardRef` wrappers name the component inside an argument. Reading that
 *    would mean guessing which argument of which call is a component, and the
 *    guess would be wrong the first time somebody wrapped a hook.
 *  - **A re-export from another file.** `export { X } from './X'` is deliberately
 *    not matched: it is what a barrel does, and matching it would list the same
 *    component once per barrel that mentions it.
 *  - **Anything after a `//` inside a string literal**, which is the limit the
 *    comment stripper carries. It is `@correctiv/prose-and-code`'s, its docblock
 *    is where the limit is written down, and `componentFiles` below says why this
 *    file no longer keeps a copy of it.
 */
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const DECLARED_KEYWORD = String.raw`(?:function|const|let|var|class)`;
const EXPORTED_DECLARATION = new RegExp(
  String.raw`^export (?:default )?(?:async )?${DECLARED_KEYWORD} (\w+)`,
  'gm',
);
/** `export default Name;` — a declaration above, published on its own line. */
const EXPORTED_DEFAULT_NAME = /^export default (\w+);?[ \t]*$/gm;
/**
 * `export { Name }` and `export { Name as Other }`, but never `… from './x'`.
 *
 * The published name is the address, so the alias wins where there is one — and
 * the file then has to be called after it, which the catalogue test asserts.
 */
const EXPORTED_LIST = /^export \{([^}]*)\};?[ \t]*$/gm;

/**
 * Every file under `src/components`, as a path with `/` on every OS.
 *
 * Both halves come from `@correctiv/prose-and-code`, and the reason is what a copy
 * of a stripper cost here. This file used to carry its own pair of expressions,
 * over a comment claiming they were "the same two as
 * `packages/app-core/test/support/source.ts`" and that importing that file was
 * impossible — three claims and all of them wrong by now. That file holds no
 * strippers at all any more, the expressions had stopped being the same, and Node
 * reads the package's TypeScript without a build step, so the import this script
 * could not have is one line.
 *
 * **What the stale copy actually did**, because a comment being wrong is the
 * smaller half: it opened a block comment on a slash-star ANYWHERE, so a component
 * file holding a path alias in a literal opened one that the next recursive glob
 * closed — a star slash, which is what one of those carries — and every export
 * between them was gone. A component the walk cannot see is absent from the union,
 * an absence makes nothing fail, and `src/gallery/catalogue.tsx` is then typed
 * against a union with a hole in it. Measured on this file, with a component
 * holding the alias and the glob: the export between them left the union and
 * nothing went red. The package's opener cannot be a path alias.
 *
 * The limit that remains is the package's and is written down beside it: a pair of
 * regular expressions cannot tell a `//` inside a string literal from one that
 * opens a comment, so an `export const Name` written after one on the same line is
 * invisible to this walk and therefore absent from the union.
 *
 * `/./` is every name, because this walk wants the `.ts` files too — the test reads
 * them to assert that nothing is hiding in one.
 *
 * @returns {string[]}
 */
export function componentFiles() {
  return filesUnder(COMPONENTS, /./).map((path) => relative(COMPONENTS, path).split(sep).join('/'));
}

/**
 * Every name a file publishes, in any of the spellings named above.
 *
 * @param {string} source
 * @returns {string[]}
 */
function exportedNames(source) {
  const bare = withoutComments(source);
  const declared = [...bare.matchAll(EXPORTED_DECLARATION)].map(([, name]) => name);
  const defaulted = [...bare.matchAll(EXPORTED_DEFAULT_NAME)].map(([, name]) => name);
  // `Name` and `Name as Other`: the published half is the address.
  const listed = [...bare.matchAll(EXPORTED_LIST)].flatMap(([, body]) =>
    body
      .split(',')
      .map(
        (entry) =>
          entry
            .trim()
            .split(/\s+as\s+/)
            .at(-1) ?? '',
      )
      .filter(Boolean),
  );
  return [...declared, ...defaulted, ...listed];
}

/**
 * The PascalCase values a file exports, comments taken out first.
 *
 * Deduplicated, because one component can be published twice in one file — a
 * `export function Card` re-stated in an `export { Card }` is one component and
 * two matches, and the union folds duplicates while the per-file assertions in
 * `__tests__/gallery-catalogue.test.ts` do not.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function exportedComponents(source) {
  return [
    ...new Set(
      exportedNames(source).filter((name) => PASCAL_CASE.test(name) && /[a-z]/.test(name)),
    ),
  ];
}

/**
 * Every `.tsx` under `src/components` that sits more than one folder deep, which
 * is the shape this walk refuses to address.
 *
 * **The address is two segments, `folder/Name`, and three readers spend it**: the
 * gallery groups its page by the first segment, `apps/workbench/scripts/api.mjs`
 * prints a component's import line as `@/components/<folder>/<name>`, and `?c=`
 * carries the whole string between the two sites. So `reader/parts/Foo.tsx` has
 * no good answer here. Taking the top folder — which is what this did — addresses
 * it `reader/Foo`: an import line that does not resolve, and the same member of
 * the union as a `reader/Foo.tsx` beside it, with nothing anywhere to say the two
 * folded together. Taking the full path instead would make the address
 * variable-depth and put `reader/parts` in the gallery as a group of its own,
 * which is a change to all three readers and a navigation change nobody asked
 * for.
 *
 * **So a third segment fails rather than being guessed at.** `src/components` has
 * no nested folder today, so this costs nothing now and refuses the silence
 * later; the day one is genuinely wanted, the conversation is about all three
 * readers at once, and that is the conversation to have rather than a folder that
 * quietly addresses wrong.
 *
 * @returns {string[]}
 */
export function nestedComponentFiles() {
  return componentFiles().filter(
    (file) => file.endsWith('.tsx') && file.includes('/', file.indexOf('/') + 1),
  );
}

/**
 * @typedef {object} Declared
 * @property {string} id `folder/Name`: the app's own address, and `?c=` on both sites.
 * @property {string} file Path under `src/components`, so a failure names a file to open.
 * @property {string} name
 */

/**
 * Every component under `src/components`, one record per export.
 *
 * Not deduplicated: `ReaderView.tsx` and `ReaderView.web.tsx` are two files with
 * one address, and the test's per-file assertions need both of them. The union
 * below is what folds them together.
 *
 * @returns {Declared[]}
 */
export function declaredComponents() {
  return componentFiles()
    .filter((file) => file.endsWith('.tsx'))
    .flatMap((file) => {
      // A file directly under `src/components` has no folder over it. There is
      // none today; one added tomorrow gets the address `components/Name` here
      // and in the workbench's reference, which uses the same fallback.
      const folder = file.includes('/') ? file.slice(0, file.indexOf('/')) : 'components';
      return exportedComponents(readFileSync(join(COMPONENTS, file), 'utf8')).map((name) => ({
        id: `${folder}/${name}`,
        file,
        name,
      }));
    });
}

/**
 * Every address, once, in a fixed order.
 *
 * Sorted rather than written in walk order, because the walk order is the
 * filesystem's and an artefact that changes when a directory is re-created is an
 * artefact that drifts for nothing.
 *
 * @returns {string[]}
 */
export function componentIds() {
  return [...new Set(declaredComponents().map(({ id }) => id))].sort();
}

/**
 * The artefact's text, which is what the drift check compares against.
 *
 * Separated from writing it so that check needs neither a subprocess nor a write:
 * `packages/design-tokens/test/drift.test.ts` has to run its generator and put
 * the bytes back afterwards, because that generator has no seam between deciding
 * and writing. This one does, and the write path below is the same string.
 *
 * @returns {string}
 */
export function render() {
  const nested = nestedComponentFiles();
  if (nested.length > 0) {
    throw new Error(
      `${SCRIPT}: a component address is \`folder/Name\` and cannot hold a third segment, ` +
        `so these would be addressed wrong or folded together silently:\n` +
        nested.map((file) => `  src/components/${file}`).join('\n') +
        `\nMove each one up to \`<folder>/<Name>.tsx\`, or change the address in this ` +
        `script, in \`src/gallery/catalogue.tsx\` and in \`apps/workbench/scripts/api.mjs\` ` +
        `together — see \`nestedComponentFiles\` for why those three go together.`,
    );
  }
  const ids = componentIds();
  if (ids.length === 0) {
    // A resolution fault or a moved directory would otherwise emit `never`, and
    // `never` satisfies every check the catalogue makes of this union.
    throw new Error(`${SCRIPT}: found no component under ${COMPONENTS}`);
  }
  return `// AUTO-GENERATED by ${SCRIPT} — do not edit by hand.
// Source: src/components/**/*.tsx · Regenerate: ${COMMAND}

/**
 * Every component \`src/components\` contains, addressed \`folder/Name\`.
 *
 * The address is the app's own and is the same string on both sides of the seam:
 * the gallery's entry, the workbench's reference row, and \`?c=\` between the two
 * sites. The platform suffix is deliberately not part of it — \`ReaderView.tsx\`
 * and \`ReaderView.web.tsx\` are one member here.
 *
 * \`src/gallery/catalogue.tsx\` is typed against this union, so a component added
 * to \`src/components\` stops the app compiling until it has an entry or a written
 * reason not to have one.
 */
export type ComponentId =
${ids.map((id) => `  | '${id}'`).join('\n')};
`;
}

function main() {
  writeFileSync(OUT, render());
  console.log(`${relative(APP, OUT)}: ${componentIds().length} components`);
}

/**
 * Nothing runs when a test imports the walk above, and nothing runs under
 * babel-jest either: `import.meta.url` is null there, which is the same fact
 * `findAppRoot` is written around and would throw here if it were read unguarded.
 */
const self = typeof import.meta?.url === 'string' ? import.meta.url : null;
if (self && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(self)) main();
