import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  excusesWithoutReason,
  filesUnder,
  floorFaults,
  ratchet,
  under,
  withoutComments,
} from '../src/index';

/**
 * This package is Apache-2.0 inside a repository that is AGPL-3.0-or-later, and a
 * licence is a statement about what may be linked.
 *
 * ADR 0043 §3 named this as the first check either extracted package needs, before
 * either of them existed: an import of `@correctiv/app-core` from here would
 * compile, pass every other check, and be wrong — Apache-2.0 in the manifest and
 * something else in practice. The first person to discover that would be a lawyer
 * at another organisation, which is late.
 *
 * Two rules, and the second is the one a reviewer would not think of:
 *
 *  - **Nothing in this repository.** Not the core, not the app, not the workbench,
 *    not the design tokens. Every one of them is AGPL, and none of them has anything
 *    this package needs: the helpers here take strings and paths.
 *  - **Nothing outside this package at all**, by a relative path either. `../..` out
 *    of `src/` reaches the same files by another spelling, and a rule written only
 *    against the package NAMES would let it through.
 *
 * A dependency on something Apache-2.0 may take is a different question, and it is
 * now decided here: `LICENCES_SOMEBODY_READ` below is the list, one line per
 * dependency naming what it ships under, and the last two cases hold it in both
 * directions.
 */
const PKG = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Everything this package ships, which is what a licence is a statement about. */
const FILES = filesUnder(resolve(PKG, 'src'), /\.ts$/);

/**
 * The workspaces of this repository, by the name an import would write.
 *
 * Listed rather than derived from the root `package.json`, deliberately: the rule is
 * "nothing from here", so a new workspace that nobody adds to this list is still
 * caught by the relative-path rule below and by the fact that a bare import of
 * something not declared as a dependency fails to resolve. This list is what makes
 * the failure MESSAGE name the licence rather than the resolution.
 */
const THE_REPOSITORY_IS_AGPL = [
  '@correctiv/app-core',
  '@correctiv/mobile',
  '@correctiv/workbench',
  '@correctiv/design-tokens',
];

/**
 * What this package takes from outside, and what each one ships under.
 *
 * The reason is the licence, read off the dependency's own manifest on the day it
 * was added, because that is the only fact this list exists to carry. A name here
 * without one is a dependency nobody looked at, which is the case below.
 */
const LICENCES_SOMEBODY_READ: Record<string, string> = {
  typescript:
    'Apache-2.0, the same licence as this package: the compiler, for the one pattern here that parses a syntax tree instead of matching text. `node_modules/typescript/package.json` says so, read on 2026-09-18 at 6.0.3.',
};

/** Every module a file imports, `import` and `require` alike. */
function imports(source: string): string[] {
  const code = withoutComments(source);
  return [
    ...[...code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((hit) => hit[1]),
    ...[...code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((hit) => hit[1]),
    ...[...code.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((hit) => hit[1]),
  ];
}

describe('the licence boundary', () => {
  it('reads the package it is checking (guards against a silently empty walk)', () => {
    // The check below is "no file imports one of these", so a walk that read no
    // files reports no imports and passes. Its own first pattern, applied to
    // itself — and both stages of it, because this package is one module and a
    // floor of "at least one file" is satisfied by a walk that found that file
    // beside an import reader that has stopped reading imports. `node:fs` and
    // `node:path` are what the module takes, and they are what it must not stop
    // finding.
    const specifiers = FILES.flatMap((path) => imports(readFileSync(path, 'utf8')));

    expect(
      floorFaults({
        'files under src/': { found: FILES.length, atLeast: 1 },
        'imports read out of them': { found: specifiers.length, atLeast: 2 },
      }),
    ).toEqual([]);
  });

  it('imports nothing from this repository, which is AGPL', () => {
    const borrowed = FILES.flatMap((path) =>
      imports(readFileSync(path, 'utf8'))
        .filter((id) =>
          THE_REPOSITORY_IS_AGPL.some((name) => id === name || id.startsWith(`${name}/`)),
        )
        .map((id) => `${under(PKG, path)} imports ${id}`),
    );

    expect(borrowed.sort()).toEqual([]);
  });

  it('reaches outside itself by no relative path either', () => {
    const escaping = FILES.flatMap((path) =>
      imports(readFileSync(path, 'utf8'))
        .filter((id) => id.startsWith('.') && !resolve(dirname(path), id).startsWith(PKG))
        .map((id) => `${under(PKG, path)} imports ${id}`),
    );

    expect(escaping.sort()).toEqual([]);
  });

  it('says Apache-2.0 in the manifest and carries the text beside it', () => {
    // The two halves of the statement, which go wrong separately: a manifest field
    // nobody put a file under, or a file nobody pointed the manifest at. The root
    // README says which subtree is under which, and that sentence is the third
    // half — held by nothing, because it is prose about a licence and not a fact
    // the code computes.
    const manifest = JSON.parse(readFileSync(resolve(PKG, 'package.json'), 'utf8')) as {
      license: string;
    };
    expect(manifest.license).toBe('Apache-2.0');
    expect(readFileSync(resolve(PKG, 'LICENSE'), 'utf8')).toContain('Apache License');
  });

  it('declares every dependency under a licence somebody read', () => {
    // A ratchet rather than a ban: an entry here is a promise that somebody
    // checked what the dependency is licensed under, and the reason beside it is
    // that check written down. The list was empty until the parse arrived, which
    // is the thing to notice — a package that reaches for a second one has to
    // answer the same question again, here, in the same form.
    const manifest = JSON.parse(readFileSync(resolve(PKG, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const { arrivals, stale } = ratchet(
      Object.keys(manifest.dependencies ?? {}),
      LICENCES_SOMEBODY_READ,
    );

    expect(arrivals).toEqual([]);
    expect(stale).toEqual([]);
  });

  it('says which licence, for every dependency on that list', () => {
    expect(excusesWithoutReason(LICENCES_SOMEBODY_READ)).toEqual([]);
  });
});
