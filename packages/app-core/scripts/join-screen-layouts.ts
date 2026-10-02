/**
 * Joins the screen documents into the one the app fetches.
 *
 *     npx tsx packages/app-core/scripts/join-screen-layouts.ts site/layout.json
 *
 * What `.github/workflows/pages.yml` runs (ADR 0071 §1): every file under
 * `data/layout/screens/` becomes the entry of its file name, `data/layout/navigation.json` goes beside them, and nothing is validated or
 * rewritten here, because the parser is the core's and the check step judges the result.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { joinScreenDocuments } from '../src/lib/screen-layout';

const out = process.argv[2];
if (!out) {
  console.error('usage: join-screen-layouts.ts <layout.json>');
  process.exit(2);
}

const directory = new URL('../src/data/layout/screens/', import.meta.url).pathname;
const documents: Record<string, unknown> = {};
for (const file of readdirSync(directory)
  .filter((name) => name.endsWith('.json'))
  .sort()) {
  documents[basename(file, '.json')] = JSON.parse(readFileSync(join(directory, file), 'utf8'));
}

const navigation = JSON.parse(
  readFileSync(new URL('../src/data/layout/navigation.json', import.meta.url).pathname, 'utf8'),
);

writeFileSync(out, `${JSON.stringify(joinScreenDocuments(documents, navigation))}\n`);
console.log(`${out}: ${Object.keys(documents).join(', ')}, navigation`);
