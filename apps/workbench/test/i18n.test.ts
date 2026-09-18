import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';

import { filesUnder, floorFaults, under, withoutComments } from '@correctiv/prose-and-code';

import { de } from '../src/i18n/catalogue/de';
import { LANGUAGE_KEY, DEFAULT_LANGUAGE, LANGUAGES } from '../src/i18n/language';

/**
 * This site's own localisation seam, which is the app's with one thing reversed.
 *
 * The app's rule is that **no** German may be written outside its catalogue. Here
 * the rule cannot be that, because the scope is decided by audience rather than by
 * completeness ([ADR 0050](../../../adr/0050-the-workbench-gets-a-second-audience.md)
 * §2): the records, the reference and the diagrams stay English on purpose, so a
 * walk demanding that every string be a descriptor would be demanding the opposite
 * of the decision.
 *
 * What can be checked is everything else, and it is the part that rots quietly:
 * that the two sides of the catalogue agree, that `en.json` is what the extractor
 * produces right now, that a descriptor block is named the way the repository names
 * them, and that a translator is told what the string cannot tell them.
 *
 * The one thing this cannot see is a German string typed straight into a translated
 * area. `apps/mobile`'s character net cannot be borrowed, because German characters
 * are *expected* in `src/i18n/catalogue/de/` here as there, and everywhere else they
 * are neither expected nor forbidden — `Sprache` in the settings picker is correct
 * and `„Mitmachen“` quoted in a comment about the app is correct. Named here so the
 * gap is known rather than assumed away.
 */
const WORKBENCH = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(WORKBENCH, 'src');
const GERMAN = join(SRC, 'i18n', 'catalogue', 'de');
const ENGLISH = join(SRC, 'i18n', 'catalogue', 'en.json');

interface Extracted {
  defaultMessage?: string;
  description?: string;
}

const english = JSON.parse(readFileSync(ENGLISH, 'utf8')) as Record<string, Extracted>;

/** Every ICU argument a message takes. `ignoreTag`, because `<b>` is not an argument. */
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

describe('every id exists on both sides', () => {
  it('finds messages at all (guards against a silently empty extraction)', () => {
    expect(
      floorFaults({ 'ids in en.json': { found: Object.keys(english).length, atLeast: 20 } }),
    ).toEqual([]);
  });

  it('has a German string for every extracted id', () => {
    expect(Object.keys(english).filter((id) => !de[id]?.trim())).toEqual([]);
  });

  it('has an extracted id for every German string', () => {
    // The direction that finds the leftovers: a message renamed or deleted leaves
    // its German behind, where it reads as a translation somebody still needs.
    expect(Object.keys(de).filter((id) => !english[id])).toEqual([]);
  });

  it('carries a non-empty English defaultMessage for every id', () => {
    expect(
      Object.entries(english)
        .filter(([, message]) => !message.defaultMessage?.trim())
        .map(([id]) => id),
    ).toEqual([]);
  });

  it('keeps every id in the file its namespace names', () => {
    const misfiled: string[] = [];
    for (const file of readdirSync(GERMAN)) {
      if (file === 'index.ts') continue;
      const namespace = basename(file, '.ts');
      const source = readFileSync(join(GERMAN, file), 'utf8');
      for (const [, id] of source.matchAll(/^\s*'([\w.]+)':/gm)) {
        if (!id!.startsWith(`${namespace}.`)) misfiled.push(`${file}: ${id}`);
      }
    }
    expect(misfiled).toEqual([]);
  });

  it('merges every namespace file into the catalogue', () => {
    const index = readFileSync(join(GERMAN, 'index.ts'), 'utf8');
    const unmerged = readdirSync(GERMAN)
      .filter((file) => file !== 'index.ts')
      .map((file) => basename(file, '.ts'))
      .filter((namespace) => !index.includes(`from './${namespace}'`));
    expect(unmerged).toEqual([]);
  });
});

describe('descriptors live under one name', () => {
  const CONTAINER = /^(COPY|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:LABELS|COPY))$/;

  it('names every `defineMessages` block COPY or <DOMAIN>_LABELS', () => {
    const offenders = filesUnder(SRC, /\.tsx?$/).flatMap((full) =>
      [
        ...withoutComments(readFileSync(full, 'utf8')).matchAll(
          /\bconst (\w+)(?::[^=]+)? = defineMessages\(/g,
        ),
      ]
        .filter(([, name]) => !CONTAINER.test(name!))
        .map(([, name]) => `${under(SRC, full)}: ${name}`),
    );

    expect(offenders).toEqual([]);
  });
});

describe('the site formats against its own provider', () => {
  /**
   * The check that exists because a measurement found the bug, and because the bug
   * is invisible: it renders English where German was meant and logs nothing.
   *
   * `components/AppHost.tsx` mounts the APP's `IntlProvider` so that a borrowed
   * component keeps the app's words. Anything of OURS rendered inside one — the
   * home tool's insertion mark, the palette's dialog, a block's placeholder row —
   * resolves `useIntl()` to that provider, finds no id of ours in it, and falls
   * through to the English default. `vite.app.mjs` defines `__DEV__` false for this
   * whole site, so the app's `onError` does not throw either.
   *
   * `useWorkbenchIntl()` reads a context of this site's own, which nothing the app
   * mounts can shadow. So the rule is: never `useIntl` here.
   */
  it('never calls useIntl outside the i18n directory', () => {
    const offenders = filesUnder(SRC, /\.tsx?$/)
      .filter((full) => !under(SRC, full).startsWith('i18n/'))
      .filter((full) => /\buseIntl\s*\(/.test(withoutComments(readFileSync(full, 'utf8'))))
      .map((full) => under(SRC, full));

    expect(offenders).toEqual([]);
  });

  it('imports useIntl from react-intl nowhere outside the i18n directory', () => {
    // The call above is the mistake; this is the import that makes it available,
    // and catching it too means the rule is legible at the top of a file rather
    // than only where somebody used it.
    const offenders = filesUnder(SRC, /\.tsx?$/)
      .filter((full) => !under(SRC, full).startsWith('i18n/'))
      .filter((full) =>
        /import\s*\{[^}]*\buseIntl\b[^}]*\}\s*from\s*'react-intl'/.test(
          withoutComments(readFileSync(full, 'utf8')),
        ),
      )
      .map((full) => under(SRC, full));

    expect(offenders).toEqual([]);
  });

  it('reads the site it is checking (guards against a silently empty walk)', () => {
    expect(
      floorFaults({
        'source files under src/': { found: filesUnder(SRC, /\.tsx?$/).length, atLeast: 40 },
      }),
    ).toEqual([]);
  });
});

describe('a translator is told what the string cannot tell them', () => {
  const byMessage = new Map<string, string[]>();
  for (const [id, message] of Object.entries(english)) {
    const key = message.defaultMessage ?? '';
    byMessage.set(key, [...(byMessage.get(key) ?? []), id]);
  }
  const described = (id: string) => Boolean(english[id]?.description?.trim());

  it('describes every id whose English is word for word another id’s', () => {
    const shared = [...byMessage.values()].filter((ids) => ids.length > 1).flat();
    expect(shared.filter((id) => !described(id)).sort()).toEqual([]);
  });

  it('gives each id in a group a description of its own', () => {
    const copied = [...byMessage.values()]
      .filter((ids) => ids.length > 1)
      .flatMap((ids) => {
        const seen = new Map<string, string>();
        return ids.flatMap((id) => {
          const text = (english[id]?.description ?? '').trim();
          if (text === '') return [];
          const first = seen.get(text);
          if (first === undefined) {
            seen.set(text, id);
            return [];
          }
          return [`${first} and ${id} share one description`];
        });
      })
      .sort();

    expect(copied).toEqual([]);
  });

  it('describes every id that carries a placeholder, and names each one', () => {
    const faults = Object.entries(english).flatMap(([id, message]) => {
      const takes = argumentsOf(message.defaultMessage ?? '');
      if (takes.length === 0) return [];
      const says = message.description ?? '';
      if (says.trim() === '') return [`${id}: no description`];
      const named = [...says.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
      return [
        ...takes.filter((name) => !named.includes(name)).map((name) => `${id}: {${name}} unnamed`),
        ...named.filter((name) => !takes.includes(name)).map((name) => `${id}: {${name}} invented`),
      ];
    });

    expect(faults.sort()).toEqual([]);
  });
});

describe('the language setting', () => {
  it('is written under the prefix this site owns', () => {
    expect(LANGUAGE_KEY.startsWith('workbench:')).toBe(true);
  });

  it('defaults to the language the source is written in', () => {
    // English is the absence of the key, the way `system` is for the appearance,
    // and it is also every `defaultMessage`. A default of German would mean the
    // catalogue decides what an untouched browser shows.
    expect(DEFAULT_LANGUAGE).toBe('en');
    expect(LANGUAGES).toContain(DEFAULT_LANGUAGE);
  });

  it('has a catalogue for every language but the default', () => {
    // The provider consults no catalogue for English on purpose: the source IS the
    // English. One for German, none for English, and a third language would add a
    // file here rather than a branch anywhere.
    const needing = LANGUAGES.filter((language) => language !== DEFAULT_LANGUAGE);
    const merged = readFileSync(join(GERMAN, 'index.ts'), 'utf8');
    expect(needing).toEqual(['de']);
    expect(merged).toContain('export const de');
  });
});

describe('the extracted English catalogue is current', () => {
  /**
   * Generated, so it goes stale the moment a descriptor is edited without the
   * extractor — and stale is invisible, because the site renders the German
   * catalogue and never reads this file. Run the generator and compare, which is
   * the shape `packages/design-tokens/test/drift.test.ts` uses for the tokens and
   * the app's seam test uses for its own `en.json`.
   *
   * The command is READ from `package.json` with its output redirected, rather than
   * repeated here: a copy would be the second place to keep in step, and the
   * committed artefact must not be rewritten by the test that judges it.
   */
  it('is what `npm run i18n:extract` produces right now', () => {
    const script = (
      JSON.parse(readFileSync(join(WORKBENCH, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts['i18n:extract']!;
    const out = 'src/i18n/catalogue/en.json';
    expect(script).toContain(out);

    const fresh = join(mkdtempSync(join(tmpdir(), 'wb-i18n-')), 'en.json');
    execSync(script.replace(out, fresh), {
      cwd: WORKBENCH,
      env: {
        ...process.env,
        PATH: `${join(WORKBENCH, '../../node_modules/.bin')}:${process.env.PATH}`,
      },
    });

    expect(readFileSync(ENGLISH, 'utf8')).toEqual(readFileSync(fresh, 'utf8'));
  });
});
