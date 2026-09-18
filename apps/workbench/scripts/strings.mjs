/**
 * Every user-facing string the app ships, with where it is written and how it reads
 * in each language.
 *
 * **Why a generated artefact and not a read at run time.** Three sources have to be
 * joined and only one of them is data: the extraction knows every id and where its
 * descriptor is, the catalogues know the words, and neither knows the other. Doing
 * the join in the browser would ship the extractor; doing it here ships a table.
 * `content/api.generated.json` has the same shape of reason and the same treatment
 * — written by `npm run strings`, not committed, and a clear failure rather than an
 * empty page when it is missing.
 *
 * **The source position comes from a SECOND extraction**, with
 * `--extract-source-location`, into a temporary file. It cannot come from the
 * committed `en.json`: `apps/mobile/__tests__/localisation-seam.test.ts` compares
 * that file byte for byte against a fresh extraction, so a `file`, `line` and `col`
 * in it would be a diff on every line anybody moves. Two extractions, one committed
 * without positions and one thrown away with them, is the cheaper of the two.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const APP = join(ROOT, 'apps/mobile');
const WORKBENCH = join(ROOT, 'apps/workbench');
const CATALOGUE = join(ROOT, 'packages/catalogue/src');
const OUT = join(HERE, '..', 'content', 'strings.generated.json');

/**
 * The two sets of strings this repository has, and why they are two.
 *
 * The app's and this site's are separate catalogues on purpose — two audiences,
 * and the app may never depend on the workbench
 * ([ADR 0050](../../../adr/0050-the-workbench-gets-a-second-audience.md) §3,
 * [ADR 0040](../../../adr/0040-the-app-does-not-depend-on-the-workbench.md)).
 * That is a fact about where the strings live, not about who wants to look at
 * them, and the board is where somebody looks.
 *
 * **They cannot be poured into one list.** `settings.title` is an id in both, and
 * `home` and `settings` are namespaces in both. A table keyed by id alone would
 * have shown one of the two and dropped the other without a word. So a row carries
 * the surface it belongs to, and everything the page keys by an id keys by the
 * pair.
 *
 * `name` is what the page prints and the anchor it builds; `dir` is the package
 * whose `i18n:extract` is borrowed and whose files the positions are relative to.
 */
const SURFACES = [
  { name: 'app', dir: APP },
  { name: 'workbench', dir: WORKBENCH },
];

/**
 * Rewrites the app's `i18n:extract` command so the same extraction also writes a
 * source-position map to `out`, alongside the `en.json` it already writes.
 *
 * A blind `.replace(/--out-file\s+\S+/, …)` would do nothing if that script ever
 * spelled the flag `-o`, or grew an `&&`, and the failure would only surface later
 * as an `ENOENT` on a temp path that means nothing to the reader. Checking the flag
 * is there before rewriting, and naming the script and what it expected, is the
 * same idea `apps/workbench/test/i18n.test.ts` asserts at test time for the
 * workbench's own `i18n:extract` — applied here at generation time instead, for
 * the one this script borrows.
 *
 * Returns argv for `execFileSync`, because the quoting in a globbed shell command
 * has to be resolved once, here, rather than handed to a shell that never runs.
 */
export function rewriteExtractCommand(command, out) {
  if (!/--out-file\s+\S+/.test(command)) {
    throw new Error(
      "apps/mobile's `i18n:extract` script has no `--out-file <path>` flag for " +
        `strings.mjs to redirect, so the borrowed extraction cannot be pointed at ${out}. ` +
        `Command: ${command}`,
    );
  }

  const rewritten = command
    .replace(/^formatjs\s+/, '')
    .replace(/--out-file\s+\S+/, `--extract-source-location --out-file ${out}`);

  const parts = rewritten.match(/'[^']*'|\S+/g);
  if (!parts) {
    throw new Error(
      `Rewriting apps/mobile's \`i18n:extract\` command left nothing to run: ${rewritten}`,
    );
  }
  return parts.map((part) => part.replace(/^'|'$/g, ''));
}

/**
 * A package's own extraction, plus positions.
 *
 * Read out of that package's `package.json` rather than repeated, so that a glob
 * added there reaches this table too. A copy here would be the second place to keep
 * in step, and the first symptom would be a table quietly missing a screen.
 *
 * Both surfaces have an `i18n:extract` of their own and the two are not the same
 * command — the app names `coreMessage` as an additional function and writes into
 * the catalogue package, this site names `wbMessage` and writes beside its own
 * German. Borrowing each rather than writing one here is what keeps that difference
 * from having to be known twice.
 *
 * The temporary directory is removed on the way out, success or failure, the way
 * `apps/workbench/scripts/renders.mjs` removes its own — otherwise `/tmp` gains one
 * `strings-*` directory per run and never loses one.
 */
function extractWithPositions(packageDir) {
  const { name, scripts } = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  const command = scripts?.['i18n:extract'];
  // The directory and not only the name: a manifest without one would otherwise
  // say "undefined has no …".
  if (!command) {
    throw new Error(`${name ?? packageDir} has no \`i18n:extract\` script to borrow.`);
  }

  const dir = mkdtempSync(join(tmpdir(), 'strings-'));
  try {
    const out = join(dir, 'located.json');
    const args = rewriteExtractCommand(command, out);
    execFileSync(join(ROOT, 'node_modules/.bin/formatjs'), args, {
      cwd: packageDir,
      stdio: 'pipe',
    });
    return JSON.parse(readFileSync(out, 'utf8'));
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort: a failure to clean up must not mask, or stand in for,
      // whatever this run was actually about to report.
    }
  }
}

/** Every locale's catalogue of the APP's strings, read the way the app reads them. */
async function appCatalogues() {
  const { CATALOGUES } = await import(join(CATALOGUE, 'index.ts'));
  return CATALOGUES;
}

/**
 * The same for this site's own strings, which it keeps in one fewer file.
 *
 * **The English side is the extraction**, and that is not a shortcut. This site's
 * provider consults no catalogue for English at all — `src/i18n/Localisation.tsx`
 * passes `{ de }` and lets `defaultLocale` render every `defaultMessage` — so the
 * English column here is what a reader would SEE, taken from the same place the
 * runtime takes it. The app's `en` column is no different in substance:
 * `packages/catalogue/src/en.generated.ts` is compiled from the app's extraction.
 *
 * A first version of this said one of the two has an English file and the other
 * does not. That is false and a cold review caught it:
 * `src/i18n/catalogue/en.json` is tracked, and `test/i18n.test.ts` re-runs the
 * extractor and compares it byte for byte. What is true is narrower — that file is
 * the extractor's OUTPUT and not a catalogue anything imports — and taking `en`
 * from the extraction this run just performed is what keeps the column from
 * disagreeing with the ids beside it in the half hour after somebody edits a
 * `defaultMessage`.
 */
async function workbenchCatalogues(located) {
  const { de } = await import(join(WORKBENCH, 'src/i18n/catalogue/de/index.ts'));
  const en = Object.fromEntries(
    Object.entries(located).map(([id, entry]) => [id, entry.defaultMessage ?? null]),
  );
  return { de, en };
}

/**
 * Throws unless every section's rows sit in one unbroken run of `strings`.
 *
 * A section is a surface and a namespace together, not a namespace on its own:
 * `settings` is a namespace in both surfaces and `home` is too, so `app · settings`
 * and `workbench · settings` are two sections that are meant to be two runs. Keying
 * this on the namespace alone would have thrown on a perfectly correct table the
 * moment the second surface arrived.
 *
 * The page renders one `<h2>` per run. A section that reappears after a different
 * one has intervened would print a second heading for rows that belong under the
 * first, silently — which is exactly the shape of bug a locale-dependent sort
 * (fixed above) could reintroduce without anyone changing this function. Checked
 * once, here, rather than trusted to the sort that is meant to produce it.
 */
function assertSectionsContiguous(strings) {
  const sectionOf = (entry) => `${entry.surface} \u00b7 ${entry.namespace}`;
  let current = null;
  const closed = new Set();
  for (const entry of strings) {
    const section = sectionOf(entry);
    if (section === current) continue;
    if (closed.has(section)) {
      throw new Error(
        `strings.generated.json: section "${section}" is split across two runs of ` +
          `entries — it reappears after "${current}" closed it, and the page needs every ` +
          "section's entries contiguous so it can print one heading each.",
      );
    }
    if (current !== null) closed.add(current);
    current = section;
  }
}

/**
 * Throws unless there is something to build a table out of.
 *
 * A glob left behind by a directory move makes `formatjs extract` match nothing
 * and exit 0, and without this the board would be written empty, the run would
 * print `0 ids (0 app + 0 workbench)` and exit 0 with it. `plugin/index.ts` only
 * checks the file is there. This is `floorFaults`' argument applied to a
 * generator: a stage that came back empty has to say so rather than pass.
 *
 * No number beyond one, deliberately. "At least one id per surface" is the thing
 * that cannot drift; a floor of 300 would be a figure to keep in step with the app.
 */
function assertFloor(surfaces) {
  if (surfaces.length === 0) {
    throw new Error('strings.generated.json: no surfaces to join. `SURFACES` is empty.');
  }
  for (const { name, dir, located } of surfaces) {
    if (Object.keys(located).length > 0) continue;
    throw new Error(
      `strings.generated.json: the extraction for "${name}" matched nothing in ${dir}. ` +
        'Its `i18n:extract` glob is the first thing to look at — FormatJS exits 0 on a ' +
        'glob that matches no file, so this would otherwise be an empty board and a ' +
        'green run.',
    );
  }
}

/**
 * Throws unless every surface offers the same languages.
 *
 * The page draws one column per locale for every row, so a locale one surface has
 * and the other does not would print as a missing wording on every single row of
 * the other — 181 invented gaps, on a board whose whole job is to show the real
 * ones. Both surfaces carry German and English today; this is what says so out
 * loud when the next language lands in one of them first.
 */
function assertLocalesAgree(surfaces) {
  const [first, ...rest] = surfaces;
  const expected = Object.keys(first.byLocale).sort();
  for (const surface of rest) {
    const has = Object.keys(surface.byLocale).sort();
    if (has.join() !== expected.join()) {
      throw new Error(
        `strings.generated.json: "${surface.name}" has ${has.join(', ')} where ` +
          `"${first.name}" has ${expected.join(', ')}. The board prints one column per ` +
          'language for every row, so a language only one surface has would read as a ' +
          'gap on every row of the other. Give the missing side a catalogue, or teach ' +
          'the page that a column can be absent rather than empty.',
      );
    }
  }
}

/**
 * The rows `strings.generated.json` holds: every extracted id of every surface,
 * joined against that surface's catalogues.
 *
 * Takes one entry per surface — `{ name, dir, located, byLocale }` — rather than
 * one extraction and one set of catalogues, because the two surfaces share neither.
 * The surfaces keep the order they arrive in, and the app comes first: it is the
 * thing that ships, and this site is the thing that looks at it.
 *
 * Sorted by UTF-16 code unit (`<` / `>`) rather than `.localeCompare`, which reads
 * the process's default ICU locale — so the same input would order its rows one
 * way on a developer's machine and another way in CI, and the page's grouping by
 * section run depends on that order being the same everywhere. Within a surface
 * only: an id is sorted against its own surface's ids, never across, or the two
 * would interleave into a table with no sections in it at all.
 */
export function buildRows(surfaces) {
  assertFloor(surfaces);
  assertLocalesAgree(surfaces);
  const locales = Object.keys(surfaces[0].byLocale).sort();

  const strings = surfaces.flatMap(({ name, dir, located, byLocale }) =>
    Object.entries(located)
      .map(([id, entry]) => ({
        id,
        // Which of the two sets of strings this is. The pair (surface, id) is what
        // is unique: `settings.title` is an id in both.
        surface: name,
        // A dotless id is its own namespace, rather than `slice(0, -1)` of it: no
        // id today lacks a dot, but `indexOf('.')` returning -1 must not silently
        // drop the id's last character into a namespace heading nobody asked for.
        namespace: id.includes('.') ? id.slice(0, id.indexOf('.')) : id,
        english: entry.defaultMessage ?? '',
        description: entry.description ?? null,
        // Relative to the repository root, because that is the address a person
        // pastes into an editor and the one a review comment can carry.
        file: relative(ROOT, join(dir, entry.file ?? '')).replaceAll('\\', '/'),
        line: entry.line ?? 0,
        translations: Object.fromEntries(
          locales.map((locale) => [locale, byLocale[locale][id] ?? null]),
        ),
      }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  );

  assertSectionsContiguous(strings);

  return { locales, strings };
}

function main(surfaces) {
  const { locales, strings } = buildRows(surfaces);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ locales, strings }, null, 2)}\n`);

  const missing = strings.filter((s) => locales.some((l) => !s.translations[l])).length;
  const described = strings.filter((s) => s.description).length;
  const sections = new Set(strings.map((s) => `${s.surface}.${s.namespace}`)).size;
  // Printed every run because the site builds as ONE chunk — `plugin/index.ts`
  // inlines this file verbatim and nothing here is code-split, so every page pays
  // for it. Reported and not gated: a bound typed here would be a figure to keep,
  // and the number is in front of whoever changed it.
  const size = Math.round(readFileSync(OUT).length / 1024);
  const per = surfaces
    .map(({ name, located }) => `${Object.keys(located).length} ${name}`)
    .join(' + ');
  console.log(
    `strings.generated.json: ${strings.length} ids (${per}) in ${sections} sections, ` +
      `${locales.length} languages, ${described} described, ${missing} with a gap; ${size} KB`,
  );
}

/**
 * Where each surface's catalogues come from, by name.
 *
 * A table rather than two calls in `read()`, because `read()` destructured
 * `SURFACES` into exactly two and would have dropped a third in silence — the one
 * place in this file that was not written for N surfaces, under a docstring
 * presenting the array as the list. Looked up by name, so a surface without an
 * entry here fails loudly.
 */
const CATALOGUES_OF = {
  app: () => appCatalogues(),
  workbench: (located) => workbenchCatalogues(located),
};

/** Each surface's extraction and catalogues, in the order the page prints them. */
async function read() {
  return Promise.all(
    SURFACES.map(async (surface) => {
      const catalogues = CATALOGUES_OF[surface.name];
      if (!catalogues) {
        throw new Error(
          `strings.generated.json: no catalogues are declared for the surface "${surface.name}". ` +
            'Add it to `CATALOGUES_OF` beside the entry in `SURFACES`.',
        );
      }
      const located = extractWithPositions(surface.dir);
      return { ...surface, located, byLocale: await catalogues(located) };
    }),
  );
}

// Only when this file is the command. `npm run strings` needs a real FormatJS
// extraction and the real catalogues; a test that wants `rewriteExtractCommand`
// or `buildRows` imports the module instead, and `test/strings-join.test.ts`
// does exactly that.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(await read());
}
