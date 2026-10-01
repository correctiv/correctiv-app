import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { describe, expect, it, vi } from 'vitest';

import { filesUnder, floorFaults, under, withoutComments } from '@correctiv/prose-and-code';

import { de } from '../src/i18n/catalogue/de';
import { createIntl } from 'react-intl';

import {
  DEFAULT_CHOICE,
  LANGUAGES,
  LANGUAGE_KEY,
  navigatorLanguages,
  preferredLanguage,
  rememberLanguage,
  resolveLanguage,
  SOURCE_LANGUAGE,
  storedLanguage,
  tagOf,
} from '../src/i18n/language';
import { say } from '../src/i18n/messages';
import { TONGUES } from '../src/ui/Settings';

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
  /**
   * Every way react-intl hands out its own context, not only the obvious one.
   *
   * The first version of this looked for `useIntl` and nothing else, and a cold
   * review walked past it with `<FormattedMessage>` — which is the single most
   * idiomatic call in the library — and with `injectIntl`. Both read react-intl's
   * context, so both get the app's provider inside an `AppHost`, which is the whole
   * failure this rule exists to prevent.
   *
   * Worth saying why the gap was easy to miss: `RawIntlProvider` at the root means
   * such a mistake WORKS on every page without an `AppHost` and fails only inside
   * `/preview`'s home tool. The failure is positional, so it looks correct when it
   * is tried on `/handbook`.
   */
  const READS_REACT_INTL_CONTEXT: [RegExp, string][] = [
    [/\buseIntl\s*\(/, 'useIntl()'],
    [/<\s*FormattedMessage\b/, '<FormattedMessage>'],
    [/<\s*Formatted(Date|Time|Number|Plural|List|RelativeTime|DisplayName)\b/, '<Formatted…>'],
    [/\binjectIntl\s*\(/, 'injectIntl()'],
    [/\bWrappedComponentProps\b/, 'WrappedComponentProps'],
  ];

  it('reads react-intl’s own context nowhere outside the i18n directory', () => {
    const offenders = filesUnder(SRC, /\.tsx?$/)
      .filter((full) => !under(SRC, full).startsWith('i18n/'))
      .flatMap((full) => {
        const source = withoutComments(readFileSync(full, 'utf8'));
        return READS_REACT_INTL_CONTEXT.filter(([pattern]) => pattern.test(source)).map(
          ([, what]) => `${under(SRC, full)}: ${what}`,
        );
      });

    expect(offenders).toEqual([]);
  });

  it('imports none of them from react-intl outside the i18n directory', () => {
    // The calls above are the mistake; this is the import that makes one available,
    // and catching it too means the rule is legible at the top of a file rather
    // than only where somebody used it. `defineMessages` is deliberately not on the
    // list: it is an identity function that touches no context.
    const FORBIDDEN =
      /\b(useIntl|FormattedMessage|FormattedDate|FormattedTime|FormattedNumber|FormattedPlural|FormattedList|FormattedRelativeTime|FormattedDisplayName|injectIntl|WrappedComponentProps|IntlProvider|RawIntlProvider)\b/;
    const offenders = filesUnder(SRC, /\.tsx?$/)
      .filter((full) => !under(SRC, full).startsWith('i18n/'))
      .flatMap((full) => {
        const source = withoutComments(readFileSync(full, 'utf8'));
        return [...source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*'react-intl'/g)]
          .flatMap((match) => match[1]!.split(','))
          .map((name) =>
            name
              .trim()
              .split(/\s+as\s+/)[0]!
              .trim(),
          )
          .filter((name) => FORBIDDEN.test(name))
          .map((name) => `${under(SRC, full)}: ${name}`);
      });

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

/** The browser that answers every storage call by refusing it. `theme.test.ts` has the same. */
const blocked = {
  getItem(): string {
    throw new DOMException('site data is off', 'SecurityError');
  },
  setItem(): void {
    throw new DOMException('site data is off', 'SecurityError');
  },
  removeItem(): void {
    throw new DOMException('site data is off', 'SecurityError');
  },
} as unknown as Storage;

/**
 * A store that really stores, copied from `theme.test.ts` for the reason a cold
 * review gave: the double this file had first was three no-ops, so every
 * assertion about what ends up IN the key passed against a store that never held
 * one. `rememberLanguage('system')` writing the literal `'system'` instead of
 * removing the key went green through the whole suite.
 *
 * `Object.keys()` over it lists the stored keys, as it does over the real one.
 */
class FakeStorage {
  getItem(key: string): string | null {
    return Object.hasOwn(this, key) ? (this as unknown as Record<string, string>)[key] : null;
  }
  setItem(key: string, value: string): void {
    (this as unknown as Record<string, string>)[key] = String(value);
  }
  removeItem(key: string): void {
    delete (this as unknown as Record<string, string>)[key];
  }
}

const fake = () => new FakeStorage() as unknown as Storage;

/** A store that already holds one value under this site's key. */
function stored(value: string): Storage {
  const store = fake();
  store.setItem(LANGUAGE_KEY, value);
  return store;
}

describe('the language setting', () => {
  it('lets the page render in a browser with site data switched off', () => {
    /*
     * The same case `theme.test.ts` holds for the appearance, and it is sharper
     * here: `storedLanguage` is the lazy initialiser of `useState` in
     * `useLanguage()`, which `App.tsx` calls on its first render. An unguarded
     * throw there is not a setting that fails to persist, it is a blank site for
     * anybody browsing with site data blocked.
     *
     * `ownStorage()` alone is not enough and that is the trap: it catches the
     * property ACCESS, which is the sandboxed-iframe case, and a browser with site
     * data switched off hands out a `Storage` whose methods throw instead.
     */
    expect(() => rememberLanguage('de', blocked)).not.toThrow();
    expect(() => rememberLanguage('en', blocked)).not.toThrow();
    expect(() => rememberLanguage('system', blocked)).not.toThrow();
    expect(storedLanguage(blocked)).toBe(DEFAULT_CHOICE);
    expect(storedLanguage(null)).toBe(DEFAULT_CHOICE);
  });

  it('writes the store only from a choice', () => {
    // Issue #131's rule, kept rather than rediscovered: the default is the ABSENCE
    // of the key, so a document that stamps its own reading back on mount deletes a
    // choice it never saw. `theme.ts` paid for that once. One write, one delete,
    // both inside `rememberLanguage`, and nothing in the effect.
    const source = readFileSync(join(SRC, 'i18n', 'language.ts'), 'utf8');
    expect(source.match(/\.setItem\(/g) ?? []).toHaveLength(1);
    expect(source.match(/\.removeItem\(/g) ?? []).toHaveLength(1);
    // Every effect in the file, not only the first: `useLanguage` grew a second
    // one when "system" arrived, and a check that read one of them would have
    // gone on passing while the other stamped the key.
    const effects = [...source.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)];
    expect(effects).toHaveLength(2);
    for (const [, body] of effects) {
      expect(body).not.toMatch(/LANGUAGE_KEY|setItem|removeItem|rememberLanguage/);
    }
  });

  it('is written under the prefix this site owns', () => {
    expect(LANGUAGE_KEY.startsWith('workbench:')).toBe(true);
  });

  it('defaults to the browser, which is the absence of the key', () => {
    // "System" is expressed the way the appearance expresses it: by the key not
    // being there. That is what lets a reader who has never chosen and a reader
    // who chose to follow the browser get the same answer out of `storedLanguage`.
    expect(DEFAULT_CHOICE).toBe('system');
    expect(storedLanguage(fake())).toBe('system');
    expect(storedLanguage(stored('de'))).toBe('de');
    expect(storedLanguage(stored('en'))).toBe('en');
    // Anything else in the key is not a language this site has. A reader who has
    // hand-edited storage, or a value left by an older build, gets the default
    // rather than a site rendering against a catalogue that is not there.
    expect(storedLanguage(stored('fr'))).toBe('system');
  });

  it('says “follow the browser” by leaving the key off, not by storing a third word', () => {
    // The assertion this file did not have, and `theme.test.ts` has had all along
    // for the appearance twelve lines away. "The default is the absence of the
    // key" is what ADR 0051 §2 calls issue #131's rule kept, and a store made of
    // three no-ops cannot tell whether it is kept.
    const store = fake();

    rememberLanguage('de', store);
    expect(store.getItem(LANGUAGE_KEY)).toBe('de');

    rememberLanguage('system', store);
    expect(store.getItem(LANGUAGE_KEY)).toBeNull();
    expect(Object.keys(store)).toEqual([]);
  });

  it('remembers an explicit choice that agrees with the browser', () => {
    // The case the third value exists for: English chosen on a German machine has
    // to survive, and it can only do that as a stored value. With two states it
    // would be indistinguishable from having chosen nothing.
    const store = fake();

    rememberLanguage('en', store);

    expect(store.getItem(LANGUAGE_KEY)).toBe('en');
    expect(storedLanguage(store)).toBe('en');
    expect(resolveLanguage(storedLanguage(store), ['de-DE'])).toBe('en');
  });

  it('takes the first of the browser’s languages this site has', () => {
    // The ranked list and not its head: a reader whose first choice is a language
    // this site does not have still has a second and a third.
    expect(preferredLanguage(['de-DE', 'de', 'en-US', 'en'])).toBe('de');
    expect(preferredLanguage(['fr-FR', 'de-DE', 'en'])).toBe('de');
    expect(preferredLanguage(['en-GB', 'de'])).toBe('en');
    // The primary subtag decides, so every German is German. There is nothing
    // regional in this catalogue to tell them apart with.
    expect(preferredLanguage(['de-CH'])).toBe('de');
    expect(preferredLanguage(['DE-at'])).toBe('de');
  });

  it('falls back to the language the source is written in', () => {
    // English is every `defaultMessage`, so it is what renders when the provider
    // consults no catalogue. A browser asking for neither of ours, and a browser
    // that says nothing at all, both land there.
    expect(SOURCE_LANGUAGE).toBe('en');
    expect(LANGUAGES).toContain(SOURCE_LANGUAGE);
    expect(preferredLanguage(['fr-FR', 'it'])).toBe(SOURCE_LANGUAGE);
    expect(preferredLanguage([])).toBe(SOURCE_LANGUAGE);
  });

  it('resolves a chosen language without asking the browser', () => {
    // The whole point of the third state: choosing English on a German machine
    // has to stay English. `resolveLanguage` is handed a browser asking for German
    // and must ignore it for both explicit choices.
    expect(resolveLanguage('en', ['de-DE'])).toBe('en');
    expect(resolveLanguage('de', ['en-US'])).toBe('de');
    expect(resolveLanguage('system', ['de-DE'])).toBe('de');
    expect(resolveLanguage('system', ['en-US'])).toBe('en');
  });

  it('reads the browser’s ranked list and not just its head', () => {
    // ADR 0051 §1's own bold paragraph, and nothing held it while this function
    // was private: a cold review reduced it to `[navigator.language]` and the
    // whole suite stayed green.
    vi.stubGlobal('navigator', { languages: ['fr-FR', 'de-DE', 'en'], language: 'fr-FR' });
    expect(navigatorLanguages()).toEqual(['fr-FR', 'de-DE', 'en']);
    expect(preferredLanguage()).toBe('de');

    // The one case the singular is for: a browser that hands out no list.
    vi.stubGlobal('navigator', { languages: [], language: 'de-AT' });
    expect(navigatorLanguages()).toEqual(['de-AT']);
    expect(preferredLanguage()).toBe('de');

    // And one that hands out neither, which is a headless run.
    vi.stubGlobal('navigator', { languages: [], language: '' });
    expect(navigatorLanguages()).toEqual([]);
    expect(preferredLanguage()).toBe(SOURCE_LANGUAGE);

    vi.unstubAllGlobals();
  });

  it('gives the picker’s System row no language tag of its own', () => {
    // `lang="system"` is a tag no parser knows and a screen reader would take its
    // voice from it. Nothing in this package renders that dialog, so a cold review
    // restored `lang={tongue.value}` and 484 tests stayed green.
    expect(tagOf('system')).toBeUndefined();
    expect(tagOf('en')).toBe('en');
    expect(tagOf('de')).toBe('de');
  });

  it('offers System first, and it is the only row of the three that is translated', () => {
    // The two languages name themselves — a reader looking for English does not
    // look for "Englisch" — so those labels are literals on purpose. "System" has
    // no language of its own and is a descriptor. `say` is what tells them apart,
    // and a cold review rewrote it to skip `formatMessage` entirely, leaving every
    // translated row reading "[object Object]", with everything green. It lives in
    // `i18n/messages.ts` now, because the home configurator's module labels are the
    // same mixture and were the second place to need it.
    const intl = createIntl({ locale: 'de', defaultLocale: SOURCE_LANGUAGE, messages: de });

    expect(TONGUES.map((tongue) => tongue.value)).toEqual(['system', 'en', 'de']);
    expect(TONGUES.filter((tongue) => typeof tongue.label !== 'string')).toHaveLength(1);
    expect(say(intl, TONGUES[1]!.label)).toBe('English');
    expect(say(intl, TONGUES[0]!.label)).toBe(de['settings.language.system']);
    expect(say(intl, TONGUES[0]!.hint)).toBe(de['settings.language.system.hint']);
  });

  it('follows the browser only while the browser is what is selected', () => {
    // Source text rather than a render, which is what `theme.test.ts` does for the
    // effect beside it: these tests mount nothing with a DOM in it. The guard is a
    // decision (ADR 0051 §2) and deleting it is not cosmetic — with English chosen
    // and the browser changing, the site would switch away from an explicit choice,
    // which is the one way the two pieces of state can come to disagree. Measured
    // in a browser on 2026-09-18: it does not.
    const source = readFileSync(join(SRC, 'i18n', 'language.ts'), 'utf8');
    const follow = /useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[choice\]\);/.exec(source);

    expect(follow?.[1]).toMatch(/if \(choice !== 'system'\) return;/);
    expect(follow?.[1]).toMatch(/addEventListener\('languagechange'/);
    // And lets go of the window again, or StrictMode leaves two listeners on the
    // first mount and one more per change of the setting after that.
    expect(follow?.[1]).toMatch(/return \(\) => window\.removeEventListener\('languagechange'/);
  });

  it('has a catalogue for every language but the default', () => {
    // The provider consults no catalogue for English on purpose: the source IS the
    // English. One for German, none for English.
    //
    // A third language is NOT free, and an earlier version of this comment said it
    // was. `Language`, `LANGUAGES`, `storedLanguage`'s accepted values, `CATALOGUES`
    // and the picker's `TONGUES` are each a branch or a member that has to grow.
    // `preferredLanguage` is the one that grew free of charge: it walks `LANGUAGES`,
    // so a third member is matched against the browser without an edit. What is also
    // free is that this assertion goes red until the rest have, so the list of edits
    // is discovered rather than remembered.
    const needing = LANGUAGES.filter((language) => language !== SOURCE_LANGUAGE);
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
   *
   * The root `node_modules/.bin` on the PATH assumes npm hoisted `@formatjs/cli`,
   * which it does because this package and `apps/mobile` ask for the same version.
   * The day they diverge npm nests one of them and this fails for a reason that has
   * nothing to do with the catalogue. Named rather than defended against: the fix
   * then is to agree on a version, which is what you would want anyway.
   */
  it('is what `npm run i18n:extract` produces right now', () => {
    const script = (
      JSON.parse(readFileSync(join(WORKBENCH, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts['i18n:extract']!;
    const out = 'src/i18n/catalogue/en.json';
    expect(script).toContain(out);

    // Removed on the way out, or this test leaves one directory in `/tmp` per run
    // and never takes one back. It had left 83 before anybody counted.
    const dir = mkdtempSync(join(tmpdir(), 'wb-i18n-'));
    try {
      const fresh = join(dir, 'en.json');
      execSync(script.replace(out, fresh), {
        cwd: WORKBENCH,
        env: {
          ...process.env,
          PATH: `${join(WORKBENCH, '../../node_modules/.bin')}:${process.env.PATH}`,
        },
      });

      expect(readFileSync(ENGLISH, 'utf8')).toEqual(readFileSync(fresh, 'utf8'));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
