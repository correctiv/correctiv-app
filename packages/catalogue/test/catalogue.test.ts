import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { floorFaults } from '@correctiv/prose-and-code';

import { CATALOGUES, de } from '../src/index';

/**
 * What is true of a catalogue, as opposed to what is true of a host.
 *
 * These two assertions used to live in `apps/mobile/__tests__/localisation-seam.test.ts`
 * and came here with the files
 * ([ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §5). The split is the
 * same line the package draws: a namespace per file and a merged index are facts
 * about this directory, and no host has an opinion about either. The app keeps what
 * is true of the app — no German in its source, `COPY` as the one name for a block,
 * `en.json` current against a fresh extraction, a description wherever the string
 * cannot speak for itself.
 *
 * The pairing of an id with its English stays there too, deliberately: it needs the
 * extraction, the extraction is the app's script, and a second copy of it here would
 * be a second thing to keep in step.
 */
const SRC = fileURLToPath(new URL('../src', import.meta.url));
const GERMAN = join(SRC, 'de');

describe('the German catalogue', () => {
  it('finds namespace files at all (guards against a silently empty directory)', () => {
    // Every assertion below passes over an empty directory, including the merge
    // check, which reads a file that would then list nothing.
    const files = readdirSync(GERMAN).filter((file) => file !== 'index.ts');
    expect(floorFaults({ 'namespace files': { found: files.length, atLeast: 20 } })).toEqual([]);
  });

  it('keeps every id in the file its namespace names', async () => {
    // `gate.headline` belongs in `de/gate.ts` and nowhere else. Without this the
    // directory is files that happen to be merged, and the first hurried migration
    // puts a screen's strings wherever the file was already open.
    const misfiled: string[] = [];
    for (const file of readdirSync(GERMAN)) {
      if (file === 'index.ts') continue;
      const namespace = basename(file, '.ts');
      const module = (await import(join(GERMAN, file))) as Record<
        string,
        Record<string, string> | undefined
      >;
      const messages = module[namespace];
      // Named in the message rather than passed to `expect`, which takes one argument.
      if (messages === undefined) misfiled.push(`${file}: exports no \`${namespace}\``);
      for (const id of Object.keys(messages ?? {})) {
        if (!id.startsWith(`${namespace}.`)) misfiled.push(`${file}: ${id}`);
      }
    }
    expect(misfiled).toEqual([]);
  });

  it('merges every namespace file into the catalogue', () => {
    // An empty namespace file contributes nothing to the merged object, so its
    // absence from the index cannot be seen there — but it is what the next agent
    // fills, and a file merged by nobody is a screen translated into a void.
    const index = readFileSync(join(GERMAN, 'index.ts'), 'utf8');
    const unmerged = readdirSync(GERMAN)
      .filter((file) => file !== 'index.ts')
      .map((file) => basename(file, '.ts'))
      .filter((namespace) => !index.includes(`from './${namespace}'`));
    expect(unmerged).toEqual([]);
  });
});

describe('the registry', () => {
  it('holds a catalogue for every locale the core declares', () => {
    // The type says this at compile time; the assertion says it at run time, which
    // is what catches a catalogue that resolved to an empty object rather than to
    // the strings — the shape a bad merge or a stripped import leaves behind.
    const empty = Object.entries(CATALOGUES)
      .filter(([, messages]) => Object.keys(messages).length === 0)
      .map(([locale]) => locale);
    expect(empty).toEqual([]);
  });

  it('is the same object the German catalogue exports', () => {
    expect(CATALOGUES.de).toBe(de);
  });
});
