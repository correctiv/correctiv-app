import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { IntlMessageFormat } from 'intl-messageformat';
import { describe, expect, it } from 'vitest';

import { floorFaults } from '@correctiv/prose-and-code';

import { CATALOGUES, DEFAULT_LOCALE, de, en, type Locale } from '../src/index';

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
    // Into a temporary file, never over the committed one. A check that writes the
    // artefact it is judging repairs a stale file on the run that should have
    // reported it, and a `finally` does not survive a Ctrl-C.
    const fresh = join(mkdtempSync(join(tmpdir(), 'catalogue-')), 'en.generated.ts');
    execFileSync('node', [join(SCRIPTS, 'compile.mjs'), fresh], { stdio: 'pipe' });
    expect(readFileSync(GENERATED, 'utf8')).toEqual(readFileSync(fresh, 'utf8'));
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

  /**
   * Several values, not one, and the reason is what a plural is.
   *
   * With a single `1` every plural takes its `one` branch and no other, so a fault
   * in `other` — a tag left unclosed, a `#` somebody turned into a word — formats
   * cleanly and the check says nothing. Measured: a broken `other` branch was green
   * and the same break in `one` was red.
   *
   * These four reach `zero`, `one`, `two`, `few`, `many` and `other` across the CLDR
   * categories, so a language with more of them than German is covered by the same
   * list: the category is chosen by the value, not by the catalogue.
   */
  const VALUES = [0, 1, 2, 11];

  it.each(Object.keys(CATALOGUES) as Locale[])('formats every message of %s', (locale) => {
    const messages = CATALOGUES[locale];
    expect(
      floorFaults({
        [`messages in ${locale}`]: { found: Object.keys(messages).length, atLeast: 1 },
      }),
    ).toEqual([]);

    const faults = Object.entries(messages).flatMap(([id, message]) =>
      VALUES.flatMap((value) => {
        try {
          // A number for every argument: it stands in for a count, a date and a name
          // alike, and what is asked is that the pattern parses and this branch
          // formats, not that the value reads well.
          const values = Object.fromEntries(argumentsOf(message).map((name) => [name, value]));
          // `ignoreTag` on both sides. `argumentsOf` parses with it, so without it
          // here the first message to use react-intl rich text would be collected one
          // way and formatted the other, and this would report a fault in a message
          // that is fine.
          new IntlMessageFormat(message, locale, undefined, { ignoreTag: true }).format(values);
          return [];
        } catch (error) {
          const said = error instanceof Error ? error.message : String(error);
          return [`${locale} ${id} at ${value}: ${said}`];
        }
      }),
    );

    expect(faults).toEqual([]);
  });

  /**
   * And every catalogue asks for the same arguments, which is the case that
   * formatting each side on its own cannot see.
   *
   * The app formats one id with one set of values against whichever catalogue is on.
   * `{count}` in English and `{anzahl}` in German each parse and each format; what
   * breaks is the pairing, and it breaks at the call site with a `MissingValueError`
   * the first time somebody switches language. An earlier docblock claimed the check
   * above caught this. It did not, and a cold review said so.
   */
  it('asks for the same arguments in every language', () => {
    const locales = Object.keys(CATALOGUES) as Locale[];
    const ids = Object.keys(CATALOGUES[DEFAULT_LOCALE]);
    expect(
      floorFaults({ 'ids compared across locales': { found: ids.length, atLeast: 1 } }),
    ).toEqual([]);

    const disagreements = ids.flatMap((id) => {
      const byLocale = locales.map((locale) => ({
        locale,
        args: argumentsOf(CATALOGUES[locale][id] ?? '').sort(),
      }));
      const first = byLocale[0]!;
      return byLocale
        .slice(1)
        .filter(({ args }) => args.join() !== first.args.join())
        .map(
          ({ locale, args }) =>
            `${id}: ${first.locale} takes [${first.args.join(', ')}], ${locale} takes [${args.join(', ')}]`,
        );
    });

    expect(disagreements).toEqual([]);
  });
});
