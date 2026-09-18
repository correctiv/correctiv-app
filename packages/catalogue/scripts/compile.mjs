/**
 * The English catalogue the app can render, compiled from the extraction.
 *
 * **Why this exists at all, when `defaultLocale="en"` already falls back.** It does,
 * and that fallback is an ERROR path: `onError` throws on `MISSING_TRANSLATION`
 * under `__DEV__`, so running the app in English without a catalogue is 317 throws
 * and a recovery screen. The compiled file is what makes the second language a
 * thing somebody can look at rather than a thing that can be argued about
 * ([ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §3).
 *
 * `formatjs compile` is the step ADR 0026 §6 promised ("the compiled catalogues are
 * build artifacts") and that nothing in this tree had ever run — the claim is struck
 * there and this is what makes it true. It also validates: a `defaultMessage` that
 * is not parseable ICU fails here rather than on a phone.
 *
 * Committed rather than generated at build time, and held current by
 * `test/catalogue.test.ts`, which is the arrangement `packages/design-tokens` has
 * for `theme.css` and the app has for `en.json`. Metro runs no generators.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');
const IN = join(SRC, 'en.json');
const OUT = join(SRC, 'en.generated.ts');

const scratch = join(mkdtempSync(join(tmpdir(), 'catalogue-')), 'en.json');
execFileSync(
  join(HERE, '..', '..', '..', 'node_modules', '.bin', 'formatjs'),
  ['compile', IN, '--out-file', scratch],
  { stdio: 'inherit' },
);

const compiled = JSON.parse(readFileSync(scratch, 'utf8'));
const entries = Object.entries(compiled)
  .map(([id, message]) => `  ${JSON.stringify(id)}: ${JSON.stringify(message)},`)
  .join('\n');

writeFileSync(
  OUT,
  `/**
 * The English catalogue, compiled from \`en.json\` by \`npm run compile\`.
 *
 * Generated — do not edit. \`test/catalogue.test.ts\` runs the generator and compares,
 * so an edit here is undone by the next run and reported by the check before that.
 *
 * It is the \`defaultMessage\` of every descriptor with the descriptions dropped, which
 * is exactly the shape the provider wants. English therefore ships as data like every
 * other language rather than as a fallback nobody chose.
 */
export const en: Record<string, string> = {
${entries}
};
`,
  'utf8',
);

console.log(`${Object.keys(compiled).length} ids → ${OUT.replace(`${process.cwd()}/`, '')}`);
