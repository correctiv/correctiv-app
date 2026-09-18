import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';

import { floorFaults } from '@correctiv/prose-and-code';

import { CATALOGUES, de, en, type Locale } from '../src/index';

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
const SCRIPTS = fileURLToPath(new URL('../scripts', import.meta.url));
const GENERATED = join(SRC, 'en.generated.ts');

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

describe('the English catalogue', () => {
  /**
   * Generated, committed, and held current by running the generator and comparing
   * — the arrangement `packages/design-tokens/test/drift.test.ts` has for
   * `theme.css` and the app's seam test has for `en.json`.
   *
   * It goes stale the moment a `defaultMessage` is edited without `npm run compile`,
   * and stale here is invisible in the ordinary way: German renders, so nobody sees
   * an English string that no longer matches its source until somebody switches the
   * language and reads a sentence that was reworded a month ago.
   */
  it('is what `npm run compile` produces right now', () => {
    const before = readFileSync(GENERATED, 'utf8');
    try {
      execFileSync('node', [join(SCRIPTS, 'compile.mjs')], { stdio: 'pipe' });
      expect(readFileSync(GENERATED, 'utf8')).toEqual(before);
    } finally {
      // The generator writes in place, so a stale file would be repaired by the
      // test that judges it. Put back whatever was committed either way.
      writeFileSync(GENERATED, before, 'utf8');
    }
  });

  it('holds every id the extraction found, and only those', () => {
    const extracted = Object.keys(
      JSON.parse(readFileSync(join(SRC, 'en.json'), 'utf8')) as Record<string, unknown>,
    ).sort();
    expect(Object.keys(en).sort()).toEqual(extracted);
  });

  it('carries the defaultMessage and drops the description', () => {
    // `formatjs compile` produces `{ id: message }` from `{ id: { defaultMessage,
    // description } }`. A description reaching the runtime would be a translator's
    // note shipped to a reader.
    const extracted = JSON.parse(readFileSync(join(SRC, 'en.json'), 'utf8')) as Record<
      string,
      { defaultMessage?: string }
    >;
    const wrong = Object.entries(en)
      .filter(([id, message]) => extracted[id]?.defaultMessage !== message)
      .map(([id]) => id);
    expect(wrong).toEqual([]);
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

/**
 * Every message, in every language, actually formats.
 *
 * **This is what makes the second language a fact rather than a claim**
 * ([ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §3). The checks
 * above compare key sets: they say every id has an entry in every catalogue, and
 * say nothing about whether the entry is a pattern a formatter can read. A German
 * plural with an unclosed brace, an English one whose `other` branch somebody
 * deleted, a placeholder renamed on one side — each leaves the key sets equal and
 * throws the first time somebody renders it.
 *
 * Nobody renders English today, which is exactly the problem. A capability that is
 * never exercised is a claim, and the cheapest way to exercise this one is here,
 * over both catalogues, on every check run.
 *
 * `intl-messageformat` rather than `react-intl`: it is the formatter react-intl
 * uses underneath, and it imports no React, which this package may not.
 */
describe('every message formats, in every language', () => {
  /** Arguments a message takes, so that formatting one does not throw for want of a value. */
  function argumentsOf(message: string): string[] {
    const names = new Set<string>();
    const walk = (elements: MessageFormatElement[]): void => {
      for (const element of elements) {
        if (
          element.type !== TYPE.literal &&
          'value' in element &&
          typeof element.value === 'string'
        ) {
          names.add(element.value);
        }
        if ('options' in element)
          for (const option of Object.values(element.options)) walk(option.value);
        if ('children' in element) walk(element.children);
      }
    };
    walk(parse(message, { ignoreTag: true }));
    return [...names];
  }

  it.each(Object.keys(CATALOGUES) as Locale[])('formats every message of %s', (locale) => {
    const messages = CATALOGUES[locale];
    expect(
      floorFaults({
        [`messages in ${locale}`]: { found: Object.keys(messages).length, atLeast: 1 },
      }),
    ).toEqual([]);

    const faults = Object.entries(messages).flatMap(([id, message]) => {
      try {
        // A number for every argument: it stands in for a count, a date and a name
        // alike, and the point is that the PATTERN parses and every branch a plural
        // declares can be reached for this locale — not that the value reads well.
        const values = Object.fromEntries(argumentsOf(message).map((name) => [name, 1]));
        new IntlMessageFormat(message, locale).format(values);
        return [];
      } catch (error) {
        return [`${locale} ${id}: ${error instanceof Error ? error.message : String(error)}`];
      }
    });

    expect(faults).toEqual([]);
  });
});
