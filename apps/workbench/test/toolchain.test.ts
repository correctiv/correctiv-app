import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { floorFaults, numberInProse } from '@correctiv/prose-and-code';

import { ROOT } from '../plugin/collect.ts';

/**
 * Which Vite the repository root hands out, which is not a question about this
 * package's own dependency.
 *
 * Two Vites live in this tree and always will until vitest 4: this package asks
 * for 8, vitest asks for a range that tops out at 7, and npm has to put one of
 * them at `node_modules/vite`. Whichever one lands there is the one every
 * *plugin* sees, because a plugin resolves `vite` from where it is installed —
 * the root — and not from the package being built.
 *
 * `uniwind/vite` is the plugin that cares. It reads `require('vite/package.json')`
 * to choose between a Rolldown code path and an esbuild one. With vitest's 7 at
 * the root it took the esbuild path under a Vite 8 build and said so, in a
 * deprecation warning about `optimizeDeps.esbuildOptions` that looked like
 * uniwind's problem rather than this repository's. Adding `vite` to the ROOT
 * package's devDependencies is what fixes it: npm then hoists 8 and nests
 * vitest's 7 under `node_modules/vitest/node_modules/vite`, where only vitest
 * looks.
 *
 * `overrides` is the wrong tool here and this is the reason: `vite` is a regular
 * `dependencies` entry of `vitest` and of `vite-node`, range
 * `^5.0.0 || ^6.0.0 || ^7.0.0-0`, not a peer. Forcing it to 8 would hand vitest a
 * version it does not declare support for.
 *
 * TROUBLESHOOTING.md, "Two Vites in one tree", has the symptom and the check.
 */
describe('the bundler the toolchain resolves', () => {
  function majorOf(from: string): number {
    const require = createRequire(join(from, 'package.json'));
    const { version } = require('vite/package.json') as { version: string };
    return Number(version.split('.')[0]);
  }

  it('hands Vite 8 or later to anything resolving from the repository root', () => {
    expect(majorOf(ROOT)).toBeGreaterThanOrEqual(8);
  });

  it('hands this package the same one', () => {
    // The two have to agree. A plugin reads the first and the build runs on the
    // second, and a disagreement between them is invisible in both.
    expect(majorOf(join(ROOT, 'apps/workbench'))).toBe(majorOf(ROOT));
  });
});

/**
 * The Node version, which is written in several places and was wrong in one.
 *
 * `package.json` refuses to install under an older one, every CI job pins the
 * version it runs, `.nvmrc` is what a developer's shell reads, and `README.md`
 * is the sentence a newcomer acts on. That last one said 20.19 for as long as
 * the others said 24, because nothing here reads prose and a repository that
 * runs fine on the maintainer's machine never finds out.
 *
 * `engines.node` is the fact and the rest are copies of it. This is the weaker
 * arrangement AGENTS.md describes — a real check would install Node and try —
 * but it catches the failure that actually happened, which is one copy moving
 * and the others staying put.
 */
describe('the Node version', () => {
  const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    engines: { node: string };
  };
  const required = Number(/(\d+)/.exec(root.engines.node)?.[1]);

  it('is a major version this test could read at all', () => {
    // Guards every assertion below: a range spelled `^24.1.0` or `>= 24` still
    // yields 24, but a rewrite to something with no leading number would make
    // the three checks below compare against NaN and pass nothing.
    expect(
      floorFaults({ 'a major version in engines.node': { found: required, atLeast: 1 } }),
    ).toEqual([]);
  });

  it('is the one `.nvmrc` hands a developer', () => {
    expect(
      numberInProse({
        documents: [{ name: '.nvmrc', text: readFileSync(join(ROOT, '.nvmrc'), 'utf8') }],
        pattern: /^v?(\d+)/,
        value: required,
        what: 'engines.node asks for',
      }),
    ).toEqual([]);
  });

  it('is the one every CI job runs', () => {
    // Every workflow rather than the interesting one, and each file named: a
    // workflow that pins nothing is a different defect from one that pins the wrong
    // number, and only one of the two is visible in a count. The first defect is
    // the empty-match fault, which fires when NO workflow pins a version at all.
    const dir = join(ROOT, '.github/workflows');
    expect(
      numberInProse({
        documents: readdirSync(dir).map((file) => ({
          name: file,
          text: readFileSync(join(dir, file), 'utf8'),
        })),
        pattern: /node-version:\s*'?(\d+)/,
        value: required,
        what: 'engines.node asks for',
      }),
    ).toEqual([]);
  });

  it('is the one the README tells a newcomer to install', () => {
    expect(
      numberInProse({
        documents: [{ name: 'README.md', text: readFileSync(join(ROOT, 'README.md'), 'utf8') }],
        pattern: /^Node (\d+)/m,
        value: required,
        what: 'engines.node asks for',
      }),
    ).toEqual([]);
  });
});

/**
 * Every subpath a workspace package promises resolves to something that is there.
 *
 * **This exists because the mistake it catches is green.** `packages/catalogue`
 * shipped `"./*": "./src/*.ts"` for a `src/` holding a directory and a `.json`. The
 * wildcard APPENDS its suffix, so `@correctiv/catalogue/de` mapped to `src/de.ts`,
 * which is not a file, and `@correctiv/catalogue/en.json` to `src/en.json.ts`,
 * which is not either. Nothing failed: nothing imported a subpath yet, and when
 * something did it would have resolved through `apps/mobile/tsconfig.json`'s
 * `paths` under tsc and through the mapper jest-expo derives from it, and thrown
 * `ERR_MODULE_NOT_FOUND` under Node, Vite and Metro. Typecheck green, tests green,
 * bundle broken — measured 2026-09-18, and found by a cold review rather than by
 * anything here.
 *
 * So the question this asks is the reverse of the obvious one. Not "does every
 * export resolve", which says nothing about the subpaths nobody has written yet,
 * but **"is every file under the wildcard's own directory reachable through it"**.
 * A wildcard is a promise about a whole directory, and an entry the pattern cannot
 * produce a specifier for is a file the package cannot hand out.
 *
 * The suffix is what makes the two spellings differ, and both are legitimate:
 * `./src/*` reaches everything, and `./src/*.ts` reaches a flat directory of
 * TypeScript and is what `@correctiv/design-tokens` wants. It stops being
 * legitimate the moment that directory holds anything else, which is the day this
 * goes red.
 */
describe('what a package says it exports', () => {
  interface Manifest {
    name?: string;
    exports?: Record<string, string>;
  }

  const PACKAGES = join(ROOT, 'packages');

  const manifests = readdirSync(PACKAGES)
    .map((directory) => join(PACKAGES, directory, 'package.json'))
    .filter((path) => existsSync(path))
    .map((path) => ({
      path,
      manifest: JSON.parse(readFileSync(path, 'utf8')) as Manifest,
    }))
    .filter(({ manifest }) => manifest.exports !== undefined);

  it('reads the packages it is checking (guards against a silently empty walk)', () => {
    expect(
      floorFaults({ 'packages with an exports map': { found: manifests.length, atLeast: 3 } }),
    ).toEqual([]);
  });

  it('points every fixed entry at a file that exists', () => {
    const missing = manifests.flatMap(({ path, manifest }) =>
      Object.entries(manifest.exports ?? {})
        .filter(([key]) => !key.includes('*'))
        .filter(([, target]) => !existsSync(join(dirname(path), target)))
        .map(([key, target]) => `${manifest.name}: "${key}" → ${target}, which is not there`),
    );

    expect(missing).toEqual([]);
  });

  /**
   * Every FILE under the wildcard, found by walking rather than by listing.
   *
   * The first version of this listed the directory's own entries and asked whether
   * each name ended in the suffix. That reports a subdirectory as unreachable, and
   * a subdirectory usually is not: under `./src/*.ts`, `src/neu/index.ts` is reached
   * perfectly well as `neu/index`. A check that fires when nothing is wrong teaches
   * people to merge past it, so it walks to the files and asks about those.
   *
   * What it catches is the half of the catalogue's trap that was a real hole:
   * `src/en.json` under `./src/*.ts` is a file no specifier can name.
   */
  it('can name every file under a wildcard', () => {
    const filesUnderDirectory = (directory: string, prefix = ''): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? filesUnderDirectory(join(directory, entry.name), `${prefix}${entry.name}/`)
          : [`${prefix}${entry.name}`],
      );

    const unreachable = manifests.flatMap(({ path, manifest }) =>
      Object.entries(manifest.exports ?? {})
        .filter(([key]) => key.includes('*'))
        .flatMap(([key, target]) => {
          const star = target.indexOf('*');
          const prefix = target.slice(0, star);
          const suffix = target.slice(star + 1);
          const directory = join(dirname(path), prefix);
          if (!existsSync(directory)) {
            return [`${manifest.name}: "${key}" → ${prefix}*, and ${prefix} is not there`];
          }
          return filesUnderDirectory(directory)
            .filter((file) => !file.endsWith(suffix))
            .map(
              (file) =>
                `${manifest.name}: ${prefix}${file} can be named by no specifier of "${key}": "${target}"`,
            );
        }),
    );

    expect(unreachable).toEqual([]);
  });

  /**
   * And a directory under the wildcard is reachable by its own bare name.
   *
   * This is the other half of the trap, and the half a file-by-file walk cannot
   * see. `@correctiv/catalogue/de` is what somebody writes when they want the
   * German; under `./src/*.ts` it maps to `src/de.ts`, which is not a file, while
   * `de/index` maps correctly — so every FILE is reachable and the specifier a
   * person would actually type is not.
   *
   * The rule that follows is short: a wildcard over a directory holding
   * subdirectories must not append anything. `@correctiv/app-core` and
   * `@correctiv/catalogue` write `./src/*` for that reason; `@correctiv/design-tokens`
   * writes `./src/*.ts` and may, because its `src/` is flat. The day it is not, this
   * says which of the two spellings it has to move to.
   */
  it('reaches a directory under a wildcard by its own name', () => {
    const offenders = manifests.flatMap(({ path, manifest }) =>
      Object.entries(manifest.exports ?? {})
        .filter(([key]) => key.includes('*'))
        .flatMap(([key, target]) => {
          const star = target.indexOf('*');
          const prefix = target.slice(0, star);
          const suffix = target.slice(star + 1);
          if (suffix === '') return [];
          const directory = join(dirname(path), prefix);
          if (!existsSync(directory)) return [];
          return readdirSync(directory, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map(
              (entry) =>
                `${manifest.name}: "${key}": "${target}" appends \`${suffix}\`, so ${prefix}${entry.name} ` +
                `is only reachable as ${entry.name}/<file>. Drop the suffix, as app-core does.`,
            );
        }),
    );

    expect(offenders).toEqual([]);
  });
});
