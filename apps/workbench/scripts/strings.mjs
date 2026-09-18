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
const CATALOGUE = join(ROOT, 'packages/catalogue/src');
const OUT = join(HERE, '..', 'content', 'strings.generated.json');

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
 * The extraction the app's own script runs, plus positions.
 *
 * Read out of `apps/mobile/package.json` rather than repeated, so that a glob added
 * there reaches this table too. A copy here would be the second place to keep in
 * step, and the first symptom would be a table quietly missing a screen.
 *
 * The temporary directory is removed on the way out, success or failure, the way
 * `apps/workbench/scripts/renders.mjs` removes its own — otherwise `/tmp` gains one
 * `strings-*` directory per run and never loses one.
 */
function extractWithPositions() {
  const { scripts } = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8'));
  const command = scripts['i18n:extract'];
  if (!command) throw new Error('apps/mobile has no `i18n:extract` script to borrow.');

  const dir = mkdtempSync(join(tmpdir(), 'strings-'));
  try {
    const out = join(dir, 'located.json');
    const args = rewriteExtractCommand(command, out);
    execFileSync(join(ROOT, 'node_modules/.bin/formatjs'), args, { cwd: APP, stdio: 'pipe' });
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

/** Every locale's catalogue, by locale, read the way the app reads them. */
async function catalogues() {
  const { CATALOGUES } = await import(join(CATALOGUE, 'index.ts'));
  return CATALOGUES;
}

/**
 * Throws unless every namespace's rows sit in one unbroken run of `strings`.
 *
 * The page renders one `<h2 id="ns-NAME">` per run of entries that share a
 * namespace. A namespace that reappears after a different one has intervened
 * would print a second heading for rows that belong under the first, silently —
 * which is exactly the shape of bug a locale-dependent sort (fixed above) could
 * reintroduce without anyone changing this function. Checked once, here, rather
 * than trusted to the sort that is meant to produce it.
 */
function assertNamespacesContiguous(strings) {
  let current = null;
  const closed = new Set();
  for (const { namespace } of strings) {
    if (namespace === current) continue;
    if (closed.has(namespace)) {
      throw new Error(
        `strings.generated.json: namespace "${namespace}" is split across two runs of ` +
          `entries — it reappears after "${current}" closed it, and the page needs every ` +
          "namespace's entries contiguous so it can print one heading each.",
      );
    }
    if (current !== null) closed.add(current);
    current = namespace;
  }
}

/**
 * The rows `strings.generated.json` holds: every extracted id, joined against
 * every locale's catalogue.
 *
 * Sorted by UTF-16 code unit (`<` / `>`) rather than `.localeCompare`, which reads
 * the process's default ICU locale — so the same input would order its rows one
 * way on a developer's machine and another way in CI, and the page's grouping by
 * namespace run depends on that order being the same everywhere.
 */
export function buildRows(located, byLocale) {
  const locales = Object.keys(byLocale).sort();

  const strings = Object.entries(located)
    .map(([id, entry]) => ({
      id,
      // A dotless id is its own namespace, rather than `slice(0, -1)` of it: no
      // id today lacks a dot, but `indexOf('.')` returning -1 must not silently
      // drop the id's last character into a namespace heading nobody asked for.
      namespace: id.includes('.') ? id.slice(0, id.indexOf('.')) : id,
      english: entry.defaultMessage ?? '',
      description: entry.description ?? null,
      // Relative to the repository root, because that is the address a person
      // pastes into an editor and the one a review comment can carry.
      file: relative(ROOT, join(APP, entry.file ?? '')).replaceAll('\\', '/'),
      line: entry.line ?? 0,
      translations: Object.fromEntries(
        locales.map((locale) => [locale, byLocale[locale][id] ?? null]),
      ),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  assertNamespacesContiguous(strings);

  return { locales, strings };
}

function main(located, byLocale) {
  const { locales, strings } = buildRows(located, byLocale);

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify({ locales, strings }, null, 2)}\n`);

  const missing = strings.filter((s) => locales.some((l) => !s.translations[l])).length;
  const described = strings.filter((s) => s.description).length;
  const size = Math.round(readFileSync(OUT).length / 1024);
  console.log(
    `strings.generated.json: ${strings.length} ids in ${new Set(strings.map((s) => s.namespace)).size} namespaces, ` +
      `${locales.length} languages, ${described} described, ${missing} with a gap; ${size} KB`,
  );
}

// Only when this file is the command. `npm run strings` needs a real FormatJS
// extraction and the real catalogues; a test that wants `rewriteExtractCommand`
// or `buildRows` imports the module instead, and `test/strings-join.test.ts`
// does exactly that.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(extractWithPositions(), await catalogues());
}
