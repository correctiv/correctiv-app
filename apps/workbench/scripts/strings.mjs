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
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const APP = join(ROOT, 'apps/mobile');
const CATALOGUE = join(ROOT, 'packages/catalogue/src');
const OUT = join(HERE, '..', 'content', 'strings.generated.json');

/**
 * The extraction the app's own script runs, plus positions.
 *
 * Read out of `apps/mobile/package.json` rather than repeated, so that a glob added
 * there reaches this table too. A copy here would be the second place to keep in
 * step, and the first symptom would be a table quietly missing a screen.
 */
function extractWithPositions() {
  const { scripts } = JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8'));
  const command = scripts['i18n:extract'];
  if (!command) throw new Error('apps/mobile has no `i18n:extract` script to borrow.');

  const out = join(mkdtempSync(join(tmpdir(), 'strings-')), 'located.json');
  const args = command
    .replace(/^formatjs\s+/, '')
    .replace(/--out-file\s+\S+/, `--extract-source-location --out-file ${out}`)
    .match(/'[^']*'|\S+/g)
    .map((part) => part.replace(/^'|'$/g, ''));

  execFileSync(join(ROOT, 'node_modules/.bin/formatjs'), args, { cwd: APP, stdio: 'pipe' });
  return JSON.parse(readFileSync(out, 'utf8'));
}

/** Every locale's catalogue, by locale, read the way the app reads them. */
async function catalogues() {
  const { CATALOGUES } = await import(join(CATALOGUE, 'index.ts'));
  return CATALOGUES;
}

function main(located, byLocale) {
  const locales = Object.keys(byLocale).sort();

  const strings = Object.entries(located)
    .map(([id, entry]) => ({
      id,
      namespace: id.slice(0, id.indexOf('.')),
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
    .sort((a, b) => a.id.localeCompare(b.id));

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

main(extractWithPositions(), await catalogues());
