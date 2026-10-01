#!/usr/bin/env node
/*
 * How many of the app's components a Vite build in this package can bundle.
 *
 *   cd apps/workbench && node scripts/measure-direct.mjs [--only <substring>]
 *
 * One `vite build` per component, each with a throwaway entry that imports that
 * one file and nothing else, so a failure names the component rather than the
 * run. It prints `built / failed` with the reason each failure gives, and that
 * output is the evidence behind the number in ADR 0027.
 *
 * A script and not a test, on purpose. The number moves when `react-native`,
 * `expo` or Rolldown move, and none of those are in this repository. A check
 * that reddens for something nobody here changed gets switched off, and then it
 * is not a check. What CI does keep is `test/direct.test.ts`, which asserts that
 * the components the workbench claims to draw exist — a fact this repository owns.
 *
 * Why per component and not one build of all 47: Rolldown stops at the first
 * parse error, so a single build answers "does everything work" and never "how
 * much of it does". The first measurement of this was also run with the wrong
 * Vite — the repository root's, hoisted for vitest — which is the other half of
 * why it is a committed script now and not a command somebody types.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'vite';

import { appPlugins, appResolve } from '../vite.app.mjs';

const WORKBENCH = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/*
 * Uniwind resolves its `cssEntryFile` against `process.cwd()`, and the plugins
 * below are shared with the site's config, which runs here. Moving rather than
 * refusing, so the script works from the repository root too and still measures
 * the same build.
 */
process.chdir(WORKBENCH);

const API = join(WORKBENCH, 'content/api.generated.json');
if (!existsSync(API)) {
  console.error('No content/api.generated.json. Run `npm run api` in apps/workbench first.');
  process.exit(1);
}

const { components } = JSON.parse(readFileSync(API, 'utf8'));

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : undefined;

/** One row per component FILE: a platform split is two, which is what `?c=` sees too. */
const targets = components.groups
  .flatMap((group) =>
    group.components.map((component) => ({
      id: `${group.name}/${component.file.replace(/^.*\/|\.tsx?$/g, '')}`,
      name: component.name,
      // `@/…`, the app's own alias, pointing at the exact file rather than at the
      // directory: naming the file is what keeps `VideoFrame` and `VideoFrame.web`
      // two measurements instead of whichever one the extension order picks.
      specifier: `@/${component.file.replace('apps/mobile/src/', '')}`,
    })),
  )
  .filter((target) => only === undefined || target.id.includes(only));

const WORK = join(WORKBENCH, '.measure');
rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
writeFileSync(
  join(WORK, 'index.html'),
  '<!doctype html><div id="root"></div><script type="module" src="./entry.tsx"></script>\n',
);

/**
 * The line of a Vite failure that names what went wrong.
 *
 * Not the first line: Rolldown's message opens with "Build failed with 2 errors:"
 * and then a blank one, so a naive first-line reader prints the same nine words
 * for every component and the run says nothing about any of them. The line worth
 * having is the first `[CODE] reason` after that header. ANSI colours have to come
 * off first, because Rolldown writes them even at `logLevel: 'silent'`.
 */
function firstReason(thrown) {
  const lines = String(thrown?.message ?? thrown)
    .replaceAll(/\[[0-9;]*m/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.find((line) => /^\[[A-Z_]+\]/.test(line)) ?? lines[0];
}

const results = [];
for (const target of targets) {
  /*
   * `createElement` and not JSX. The entry is written by this script, so giving
   * it no JSX means the measurement never reports its own transform as the
   * component's failure. Rendering it is what keeps it out of the tree shaker.
   */
  writeFileSync(
    join(WORK, 'entry.tsx'),
    [
      "import { createElement } from 'react';",
      "import { createRoot } from 'react-dom/client';",
      "import '@/global.css';",
      `import { ${target.name} } from '${target.specifier}';`,
      `createRoot(document.getElementById('root')).render(createElement(${target.name}));`,
      '',
    ].join('\n'),
  );

  let error;
  try {
    await build({
      root: WORK,
      configFile: false,
      logLevel: 'silent',
      resolve: appResolve,
      plugins: appPlugins(),
      build: { outDir: join(WORK, 'dist'), emptyOutDir: true, reportCompressedSize: false },
    });
  } catch (thrown) {
    error = firstReason(thrown);
  }
  results.push({ id: target.id, error });
  console.log(`${error === undefined ? 'built ' : 'FAILED'}  ${target.id}`);
}

rmSync(WORK, { recursive: true, force: true });

const failed = results.filter((result) => result.error !== undefined);
console.log(`\n${results.length - failed.length} of ${results.length} built.`);
for (const result of failed) console.log(`  ${result.id}: ${result.error}`);
