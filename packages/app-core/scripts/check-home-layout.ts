/**
 * Refuses a home document that the app would refuse, or draw past.
 *
 *     npx tsx packages/app-core/scripts/check-home-layout.ts site/home.layout.json
 *
 * What `.github/workflows/pages.yml` runs over the file it is about to publish
 * (ADR 0057 §4), because a phone that is handed a bad document keeps its last good copy,
 * which is correct and invisible: a broken publish would stand for as long as nobody
 * compared a phone with the repository.
 *
 * It judges with the app's own parser rather than with `JSON.parse`, and it is stricter
 * than the app. The app keeps a document that parses with problems, because §7 wants a
 * document written for a newer app drawn past by an older one; the deploy publishes for
 * the newest app there is, so any problem here is a document nobody meant to write.
 * What it cannot judge is which modules a host can draw, because that set is the
 * host's (ADR 0036 §14); unknown module names are the app's to report.
 *
 * Exits 1 with the problems as the parser names them, codes and values.
 */
import { readFileSync } from 'node:fs';

import { parseHomeLayout } from '../src/lib/home-layout';

const path = process.argv[2];
if (!path) {
  console.error('usage: check-home-layout.ts <home.layout.json>');
  process.exit(2);
}

let document: unknown;
try {
  document = JSON.parse(readFileSync(path, 'utf8'));
} catch (err) {
  console.error(`${path}: not a JSON file: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}

const { layout, problems } = parseHomeLayout(document);
for (const problem of problems)
  console.error(`${path}: ${problem.code} ${JSON.stringify(problem.context)}`);

if (!layout || layout.sections.length === 0 || problems.length > 0) {
  console.error(
    `${path}: refused: ${layout ? `${layout.sections.length} sections` : 'not a layout'}, ${problems.length} problems`,
  );
  process.exit(1);
}

console.log(
  `${path}: ${layout.sections.length} sections, ${layout.moments.length} moments, no problems`,
);
