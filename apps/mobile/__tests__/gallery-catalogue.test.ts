import { readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import {
  componentFiles,
  declaredComponents,
  exportedComponents,
  nestedComponentFiles,
  render,
} from '../scripts/generate-component-ids.mjs';
import { excusesWithoutReason, floorFaults, withoutComments } from '@correctiv/prose-and-code';

/**
 * What is left of "nothing gets forgotten" once a TYPE carries most of it.
 *
 * This file used to assert that every component under `src/components` had a
 * catalogue entry, with a hand-written list of exceptions. That is ADR 0031's
 * mechanism 4 — a test somebody had to write — standing in for its mechanism 2,
 * and the ADR names this check by name as the first candidate to move up. It has
 * moved: `scripts/generate-component-ids.mjs` reads the folder and emits
 * `src/gallery/components.generated.ts`, a union of `folder/Name` addresses, and
 * `catalogue.tsx` is held against that union. A component with no entry, an entry
 * with no component, an entry filed under the wrong folder, an excuse for a
 * component that is gone, and an excuse for one that is now catalogued are all
 * **compile errors** now, named in the compiler's own message.
 *
 * **What is left is exactly what a type cannot see**, and the first of them is
 * the reason the rest can be trusted:
 *
 *  - The union is only as good as the walk that produced it, and the committed
 *    file is only as good as the last person who ran the generator. The drift
 *    check is the half that closes that, and the two empty guards are the half
 *    that stops a silent walk making everything vacuously true.
 *  - A union folds duplicates. Two entries for one address is invisible to it.
 *  - Everything about `src/components` that is not the set of addresses: which
 *    file a component is in, what it is named there, whether it is hiding in a
 *    `.ts`.
 *  - Whether an exception carries a REASON. `NoEntryOfItsOwn<'…'>` in the
 *    catalogue is a type and its argument is checked; the sentence above it is a
 *    doc comment and no type can require one.
 *
 * **And what none of it means, type or test.** This holds a set of NAMES against
 * a folder of files. It says every component has an entry; it says nothing about
 * whether the entry shows anything. A specimen built with the wrong props, one
 * that renders an empty box, a component listed with `specimens: []` — all of
 * those pass here and are visible only to somebody looking at the gallery or at
 * `/preview`. ADR 0027's rule applies to this check as much as to the
 * workbench's drawing: where two renderings disagree the app's is right, and
 * nothing automatic compares them.
 *
 * Three more blind spots the union inherits from the walk, each a PR to have
 * rather than a pattern to widen:
 *
 *  - **A component that is not under `src/components`.** A screen in `src/app/`
 *    that grew into a component, a wrapper in `src/lib/` — out of scope by
 *    construction, and the scope is the folder rather than the shape.
 *  - **A component built without JSX.** `createElement` in a `.ts` file is a
 *    component the walk reads as a helper; `hides no component in a .ts file`
 *    below closes the spelling that a person would actually write, and not this
 *    one.
 *  - **A re-export from another file.** `export { X } from './X'` is matched
 *    nowhere, which is right for the barrel; `export { X }` without the `from` is
 *    matched, because there the declaration is in this file and this file is the
 *    component's address.
 *  - **A default export with no name of its own.** `export default () => …` and
 *    `export default memo(Card)` carry nothing to address. `every spelling of an
 *    export the walk claims to see` below is the half of this that CAN fail.
 *
 * The catalogue is read as TEXT rather than imported, which is the same split
 * `apps/workbench/test/direct.test.ts` makes: importing it pulls in every
 * component in the app and the `.tsx` transform for all of them, to answer a
 * question about a list of names. The `//`-inside-a-string limit every check
 * built on `@correctiv/prose-and-code`'s `withoutComments` inherits applies here
 * too; it is written down beside the helper.
 */
const APP = resolve(__dirname, '..');
const COMPONENTS = resolve(APP, 'src/components');
const CATALOGUE = resolve(APP, 'src/gallery/catalogue.tsx');
const GENERATED = resolve(APP, 'src/gallery/components.generated.ts');

/** `ReaderView.web.tsx` is `ReaderView`'s second implementation, not a second one. */
const PLATFORM_SUFFIX = /\.(web|native|ios|android)$/;

/**
 * `folder/Name` for every entry in the catalogue, in the order it writes them.
 *
 * The scan is ordered rather than structural: each `name:` belongs to the last
 * `folder:` above it, which is what the file's own shape says. `Entry`'s
 * declaration (`name: string`) and `componentId`'s parameters carry no quote and
 * are not entries. A `name: '…'` written inside a specimen's label would be read
 * as one.
 */
function cataloguedIds(source: string): string[] {
  const ids: string[] = [];
  let folder = '';
  for (const [, key, value] of withoutComments(source).matchAll(/\b(folder|name): '([^']+)'/g)) {
    if (key === 'folder') folder = value;
    else ids.push(`${folder}/${value}`);
  }
  return ids;
}

/**
 * Every component the catalogue excuses from having an entry of its own, with the
 * doc comment that argues for it.
 *
 * The doc comment has to sit immediately above the alias, which is the only
 * placement this can read — and an excuse written without one matches the second
 * expression and not the first, so it arrives with an empty reason rather than
 * invisibly. The comment body is tempered rather than lazy (`(?!\*\/)`), because
 * `[\s\S]*?` would happily reach back over other comments and lend an undocumented
 * excuse somebody else's argument.
 */
function excusedComponents(source: string): { id: string; why: string }[] {
  const documented = new Map<string, string>();
  for (const [, why, id] of source.matchAll(
    /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\ntype \w+ = NoEntryOfItsOwn<'([^']+)'>/g,
  )) {
    documented.set(id, why.replace(/^\s*\*/gm, '').trim());
  }
  return [...withoutComments(source).matchAll(/NoEntryOfItsOwn<'([^']+)'>/g)].map(([, id]) => ({
    id,
    why: documented.get(id) ?? '',
  }));
}

/**
 * The catalogue minus the lines that excuse a component, which is where the
 * question "is it still drawn" can be asked without the excuse answering it.
 *
 * `NoEntryOfItsOwn<'ui/ScreenHeaderBar'>` contains the name it is excusing, so a
 * search over the whole file would find the component in its own exception and
 * pass whatever the catalogue did — a check that cannot fail.
 */
function whatTheCatalogueDraws(source: string): string {
  return withoutComments(source)
    .split('\n')
    .filter((line) => !line.includes('NoEntryOfItsOwn<'))
    .join('\n');
}

describe('the component walk the generated union is built from', () => {
  const declared = declaredComponents();

  it('reads the components it is checking (guards against a silently empty walk)', () => {
    // A moved directory or a resolution fault would otherwise make the union
    // empty — and an empty union satisfies every type-level check the catalogue
    // makes of it, because `Exclude<never, …>` is `never`. The generator refuses
    // to emit nothing at all; this is the floor under that.
    expect(
      floorFaults({ 'components the walk declared': { found: declared.length, atLeast: 40 } }),
    ).toEqual([]);
  });

  it('keeps the generated union current (no drift against src/components)', () => {
    // The hinge of the whole arrangement, and ADR 0031's mechanism 2 in one line:
    // forgetting the component is a compile error, forgetting to regenerate is
    // this. When it fails, the fix is `npm run component-ids` and a commit —
    // never a hand-edit of the artefact.
    //
    // No subprocess and no write, unlike `packages/design-tokens/test/drift.test.ts`,
    // which has to run its generator over the real files and put the bytes back
    // because that generator has no seam between deciding and writing. This one
    // does: `render()` is the same string `main()` writes.
    expect(readFileSync(GENERATED, 'utf8')).toBe(render());
  });

  it('keeps one component per file, named after its file', () => {
    // The address depends on it. `apps/workbench/scripts/api.mjs` prints a
    // component's import line as the folder's barrel or `@/components/<folder>/<name>`,
    // so a second component inside `Card.tsx` gets an import path that does not
    // resolve, and `?c=` gets an id no source link can answer. The union would
    // hold both names happily.
    const misnamed = declared
      .filter(({ file, name }) => basename(file, '.tsx').replace(PLATFORM_SUFFIX, '') !== name)
      .map(({ file, name }) => `${file}: ${name}`);

    expect(misnamed.sort()).toEqual([]);
  });

  it('addresses no component in a nested folder', () => {
    // The address is `folder/Name` and has room for nothing else, so
    // `reader/parts/Foo.tsx` would be addressed `reader/Foo` — an import line the
    // workbench cannot resolve, and the same union member as a `reader/Foo.tsx`
    // beside it, with nothing to say the two folded together. The generator
    // throws rather than emitting that; this is the readable half of the same
    // refusal, and `nestedComponentFiles`' own comment argues the alternative.
    expect(nestedComponentFiles().sort()).toEqual([]);
  });

  it('sees every spelling of an export the walk claims to see', () => {
    // The dangerous direction: a component the walk cannot read is absent from
    // the union, and an absence fails nothing at all. `export function` and
    // `export const` were the only two it read, so `export default function Foo`
    // — the form a screen turned into a component arrives in — was invisible.
    const seen = (source: string) => exportedComponents(source);

    expect(seen('export function Foo() {}')).toEqual(['Foo']);
    expect(seen('export const Foo = () => null;')).toEqual(['Foo']);
    expect(seen('export default function Foo() {}')).toEqual(['Foo']);
    expect(seen('export async function Foo() {}')).toEqual(['Foo']);
    expect(seen('export default async function Foo() {}')).toEqual(['Foo']);
    expect(seen('export class Foo {}')).toEqual(['Foo']);
    expect(seen('export default class Foo {}')).toEqual(['Foo']);
    expect(seen('function Foo() {}\nexport { Foo };')).toEqual(['Foo']);
    expect(seen('function Bar() {}\nexport { Bar as Foo };')).toEqual(['Foo']);
    expect(seen('function Foo() {}\nexport default Foo;')).toEqual(['Foo']);

    // And the two the docblock above says it cannot see, asserted so that the
    // list of blind spots is a claim rather than a note: an anonymous default has
    // no name to address, and a name inside a call would have to be guessed at.
    expect(seen('export default () => null;')).toEqual([]);
    expect(seen('const Foo = () => null;\nexport default memo(Foo);')).toEqual([]);

    // The barrel's spelling stays out: `from` makes it another file's component.
    expect(seen("export { Foo } from './Foo';")).toEqual([]);
  });

  it('hides no component in a .ts file', () => {
    // What makes the walk's extension rule a rule rather than an assumption: a
    // `.ts` file here declares types or re-exports, and a PascalCase value
    // exported from one is a component the walk would never see — so it would be
    // absent from the union and its absence would be invisible.
    const hidden = componentFiles()
      .filter((file) => file.endsWith('.ts'))
      .flatMap((file) =>
        exportedComponents(readFileSync(join(COMPONENTS, file), 'utf8')).map(
          (name) => `${file}: ${name}`,
        ),
      );

    expect(hidden.sort()).toEqual([]);
  });
});

describe('the catalogue as written', () => {
  const source = readFileSync(CATALOGUE, 'utf8');
  const catalogued = cataloguedIds(source);

  it('reads the catalogue it is checking (guards against a silently empty parse)', () => {
    // The parse is over text, so a rename of `folder:` or `name:` in the
    // catalogue's own shape would empty this list rather than break it — and an
    // empty list makes the duplicate check below pass with nothing to say.
    expect(
      floorFaults({
        'entries read out of the catalogue': { found: catalogued.length, atLeast: 40 },
        'folders they are filed under': {
          found: new Set(catalogued.map((id) => id.split('/')[0])).size,
          atLeast: 5,
        },
      }),
    ).toEqual([]);
  });

  it('lists no component twice', () => {
    // The one completeness question a union cannot answer: it folds two entries
    // for one address into one member and both directions of the type check
    // agree. The gallery draws the component twice.
    const duplicates = catalogued.filter((id, index) => catalogued.indexOf(id) !== index);

    expect(duplicates.sort()).toEqual([]);
  });
});

/**
 * The exceptions, and the half of them no type covers.
 *
 * Both directions the old `NOT_AN_ENTRY_OF_ITS_OWN` record asserted by hand are
 * types now — the argument to `NoEntryOfItsOwn` is constrained to `ComponentId`,
 * so an excuse for a deleted component stops compiling, and
 * `NoExcusedComponentIsListed` fails when an excused component is catalogued
 * after all. What no type can reach is the prose: whether there is an argument
 * above the line, and whether the entry it points at still draws the thing.
 */
describe('the components with no entry of their own', () => {
  const source = readFileSync(CATALOGUE, 'utf8');
  const excused = excusedComponents(source);

  it('has something to check (guards against a renamed marker)', () => {
    // Read as text, so renaming `NoEntryOfItsOwn` empties this list rather than
    // breaking it, and both assertions below would then pass on nothing. One
    // today; the number is not the point, the presence is.
    expect(floorFaults({ 'excused components': { found: excused.length, atLeast: 1 } })).toEqual(
      [],
    );
  });

  it('gives every exception a reason rather than a path', () => {
    // `localisation-seam.test.ts` learned this at thirty-six entries: a list of
    // paths says nothing about which is a debt and which is a fact, so the next
    // person adds one more. A doc comment is invisible to the compiler, which is
    // why this assertion survived the move up the ladder.
    expect(
      excusesWithoutReason(
        Object.fromEntries(excused.map(({ id, why }) => [id, why])),
        // Twenty rather than forty: the argument here is a doc comment above the
        // alias and is usually a paragraph, so the floor is only catching the entry
        // that carries a word.
        20,
      ),
    ).toEqual([]);
  });

  it('keeps every excused component drawn somewhere in the catalogue', () => {
    // The reason says the bar is drawn under another entry. That the OTHER entry
    // exists is now a type error to get wrong; that it still draws THIS component
    // is not — an entry redrawn with something else takes the import with it and
    // leaves the reason standing, true-sounding and false.
    const drawn = whatTheCatalogueDraws(source);
    const undrawn = excused
      .filter(({ id }) => !drawn.includes(id.slice(id.indexOf('/') + 1)))
      .map(({ id }) => id);

    expect(undrawn.sort()).toEqual([]);
  });
});
