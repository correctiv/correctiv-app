import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';

import { de } from '@/i18n/catalogue/de';

import {
  filesUnder,
  floorFaults,
  under,
  withEscapesDecoded,
  withoutComments,
} from '@correctiv/prose-and-code';

/**
 * The localisation seam, and the two things about it that can rot silently.
 *
 * The shape, decided in
 * [ADR 0026](../../../adr/0026-react-native-review-and-hardening.md) §6: a message
 * descriptor's `defaultMessage` is ENGLISH and lives next to the component, the
 * German that ships is data in `src/i18n/catalogue/de/`, and `en.json` beside it
 * is generated from the source. German is the only language that ships.
 *
 * Both halves fail quietly on their own. A German entry deleted while its
 * descriptor stays renders the English default — a screen that still works, in
 * the wrong language, on a device nobody has. A German string written straight
 * into a screen never reaches a catalogue at all and is found by a translator
 * years later. Neither is visible to typecheck, lint or a screenshot, so it is
 * checked here, in the same `npm run check` as everything else. The shape is the
 * one `packages/app-core/test/boundary.test.ts` uses: walk the tree, collect the
 * offenders, assert the list is empty.
 */
const APP = resolve(__dirname, '..');
const SRC = join(APP, 'src');
const CATALOGUE = join(SRC, 'i18n', 'catalogue');
const GERMAN = join(CATALOGUE, 'de');
const ENGLISH = join(CATALOGUE, 'en.json');

/** `en.json` as `@formatjs/cli` writes it: one entry per id. */
interface Extracted {
  defaultMessage?: string;
  description?: string;
}

const english = JSON.parse(readFileSync(ENGLISH, 'utf8')) as Record<string, Extracted>;

/**
 * Every file, whatever it is called: this walk is looking for a German character
 * and a string can be written in a file with any extension.
 */
const ANY_FILE = /./;

describe('every id exists on both sides', () => {
  it('finds messages at all (guards against a silently empty extraction)', () => {
    // An extraction that matched no file writes `{}`, and every assertion below
    // would pass over it.
    expect(
      floorFaults({ 'ids in en.json': { found: Object.keys(english).length, atLeast: 1 } }),
    ).toEqual([]);
  });

  it('has a German string for every extracted id', () => {
    const missing = Object.keys(english).filter((id) => !de[id]?.trim());
    expect(missing).toEqual([]);
  });

  it('has an extracted id for every German string', () => {
    // The other direction, and the one that finds the leftovers: a message
    // renamed or deleted in a screen leaves its German behind, where it reads as
    // a translation somebody still needs.
    const orphans = Object.keys(de).filter((id) => !english[id]);
    expect(orphans).toEqual([]);
  });

  it('carries a non-empty English defaultMessage for every id', () => {
    const empty = Object.entries(english)
      .filter(([, message]) => !message.defaultMessage?.trim())
      .map(([id]) => id);
    expect(empty).toEqual([]);
  });

  it('keeps every id in the file its namespace names', () => {
    // `gate.headline` belongs in `de/gate.ts` and nowhere else. Without this the
    // directory is 26 files that happen to be merged, and the first hurried
    // migration puts a screen's strings wherever the file was already open.
    const misfiled: string[] = [];
    for (const file of readdirSync(GERMAN)) {
      if (file === 'index.ts') continue;
      const namespace = basename(file, '.ts');
      const module = require(join(GERMAN, file)) as Record<string, Record<string, string>>;
      const messages = module[namespace];
      expect(messages).toBeDefined();
      for (const id of Object.keys(messages)) {
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

/**
 * The characters that betray a German string written outside the catalogue.
 *
 * A partial net on purpose, and the ADR says so: "Suchen" slips through, and no
 * cheap check catches it. What it does catch is most of them, for twenty lines.
 *
 * ~~and no false positives, because English prose in this repo has no use for any
 * of these — a comment quoting a German label uses straight quotes~~ The quotes
 * were the only half of that considered. Straight quotes do nothing about `ü`,
 * and the rule in [AGENTS.md](../../../AGENTS.md#language) that an English
 * sentence "leaves an identifier, a path and a command in their own spelling"
 * covers a quoted label too: four files explain a decision by naming the label it
 * is about — `Backstage · Früher lesen`, "Zurück", "im Browser öffnen" — and each
 * was on the migration list for a string that does not exist. Comments are
 * stripped before the test now, which is why they are not.
 */
const GERMAN_CHARACTERS = /[äöüßÄÖÜ„“]/;

/**
 * Bundled CONTENT rather than UI: the offline article and podcast snapshots, which
 * are CORRECTIV's own German journalism as `npm run offline-articles` fetched it.
 * Translating an article is not what this seam is for, and the reader's own copy
 * follows the same rule (ADR 0026 §6, on `packages/app-core/src/data/`).
 */
const CONTENT = new Set([
  'lib/articles/offlineBundle.generated.ts',
  'lib/podcasts/offlineBundle.generated.ts',
]);

/**
 * The gallery, which is a developer's catalogue of the components and is read by
 * nobody else. Its fixtures exist to show those components carrying the copy they
 * really carry, so translating them would make the preview lie and forcing them
 * to English would make it lie differently. Excluded by path rather than listed
 * below, because "not yet" is the wrong word: this one is never.
 */
const DEVELOPER_ONLY = /^gallery\//;

/**
 * The two German strings that are still written in code, and why each one is. Each
 * entry is the STRING, not the file it sits in: a whole-file exemption excuses
 * everything anybody adds to that file afterwards, which is a ratchet with one
 * entry instead of thirty-six.
 *
 * Asserted in both directions. German outside the catalogue that is not one of
 * these fails, and a string named here that the file no longer contains fails too
 * — so the reason has to be deleted with the string it was about, and cannot rot
 * into an excuse for something else.
 *
 * This was thirty-six files and the word for it was "not yet". It is two strings,
 * and the word is now "because" — so each one carries its reason, and a third
 * arriving without one is the thing to argue about.
 *
 * What this cannot do is the other half of a file. The net is partial (see
 * `GERMAN_CHARACTERS`), so the four German strings beside the excused one in
 * `RecoveryScreen.tsx` carry no umlaut and are invisible here whatever this list
 * says. They are covered by the same reason and named in that file.
 */
const GERMAN_OUTSIDE_THE_CATALOGUE: Record<string, string[]> = {
  // A channel's name, `CORRECTIV im Gespräch`. Marks get no id (a mark is not
  // translated), and an id would not help: a descriptor's `defaultMessage` would
  // BE the German spelling and would sit in this file all the same. The ways out
  // are a display name in the feed configuration or a line-level exception here,
  // and neither is worth doing before a second channel needs one.
  'app/(tabs)/mediathek.tsx': ['CORRECTIV im Gespräch'],
  // `useIntl()` throws here. The recovery screen is rendered BY the error
  // boundary, and expo-router's `Try` wraps the root route's default export — so
  // the boundary sits above `RootLayout`, and the `IntlProvider` that
  // `AppEnvironment` mounts is inside the subtree being caught. Measured, not
  // assumed: adding `useIntl()` to this screen fails 7 of the 8 cases in
  // `error-boundary.test.tsx` with "Could not find required `intl` object".
  // Moving the provider above the boundary would fix it and would also put the
  // catalogue between a crash and the screen that reports it, which is the wrong
  // trade for the one screen that has to render when everything else did not.
  'components/recovery/RecoveryScreen.tsx': [
    'Die App konnte diesen Bildschirm nicht anzeigen. Bitte versuchen Sie es noch einmal. Bleibt der Fehler, schließen Sie die App und öffnen Sie sie neu.',
  ],
};

/**
 * The lines of a file that still carry German, once its excused strings are taken
 * out of it.
 *
 * One occurrence each, deliberately: a string excused once and then pasted a
 * second time in the same file is a second decision and shows up here.
 *
 * The comments go first, because a comment is not a string a user reads
 * (`@correctiv/prose-and-code`, shared with `colour-tiers.test.ts`). The cost is real and
 * worth naming: a comment written in German — a regression, not a leftover, since
 * 2026-08-12 — is invisible here. It always was, since every file this would have
 * caught sat on the list below for a different reason. So is a German string
 * written after a ` //` INSIDE a string literal, which that helper takes for a
 * comment and truncates; the limit is written down where the helper is, because
 * every check that reads source inherits it.
 *
 * Escapes are not on that list. `withEscapesDecoded` writes `'Pr\u00fcfen'` back
 * to `'Prüfen'` first, so a German string with one escaped letter in it — what a
 * tool that "fixed the encoding" leaves behind — is caught rather than read as
 * ASCII.
 */
function germanLines(source: string, excused: string[]): string[] {
  let remaining = withEscapesDecoded(withoutComments(source));
  for (const fragment of excused) remaining = remaining.replace(fragment, '');
  return remaining
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => GERMAN_CHARACTERS.test(line));
}

describe('German lives in the catalogue', () => {
  /** Every file under `src/`, as a path relative to it, with `/` on every OS. */
  const sources = filesUnder(SRC, ANY_FILE)
    .map((full) => under(SRC, full))
    .filter(
      (path) =>
        !path.startsWith('i18n/catalogue/de/') && !CONTENT.has(path) && !DEVELOPER_ONLY.test(path),
    );

  const read = (path: string) => readFileSync(join(SRC, path), 'utf8');

  it('reads the app it is checking (guards against a silently empty walk)', () => {
    expect(floorFaults({ 'files under src/': { found: sources.length, atLeast: 50 } })).toEqual([]);
  });

  it('holds German in the catalogue, and in two strings that say why not', () => {
    const german = sources
      .flatMap((path) =>
        germanLines(read(path), GERMAN_OUTSIDE_THE_CATALOGUE[path] ?? []).map(
          (line) => `${path}: ${line}`,
        ),
      )
      .sort();

    expect(german).toEqual([]);
  });

  it('excuses no German that has since been lifted', () => {
    // The other direction, and the one a one-sided allow-list cannot do: a string
    // that has moved into the catalogue leaves its reason behind, where the next
    // reader takes it for a rule about the file.
    const stale = Object.entries(GERMAN_OUTSIDE_THE_CATALOGUE).flatMap(([path, fragments]) =>
      fragments
        .filter((fragment) => !sources.includes(path) || !read(path).includes(fragment))
        .map((fragment) => `${path}: ${fragment}`),
    );

    expect(stale).toEqual([]);
  });
});

/**
 * The name a block of descriptors goes under.
 *
 * Three authors migrated this app in one pass and left eight names for one thing:
 * `COPY`, `TABS`, `HEADER_COPY`, `MESSAGES`, `NO_ACCESS`, `STAGE`, `SOURCE_LABELS`
 * and `TIER_LABELS`. None of them is wrong on its own, which is the problem — the
 * cost is paid by the next person, who has to open the file to find out what the
 * words in it are called, and by the one after that, who invents a ninth.
 *
 * Two kinds, so two names, and [AGENTS.md](../../../AGENTS.md#language) says which:
 *
 *  - `COPY`, the words a file writes in its own voice, one per file. A block
 *    another file IMPORTS takes the name of what it belongs to instead
 *    (`HEADER_COPY`, `SALON5_RADIO_COPY`), because the importer has a `COPY` of
 *    its own and two of them cannot both be called that.
 *  - `<DOMAIN>_LABELS`, a `Record<DomainValue, MessageDescriptor>` the call site
 *    indexes with a value rather than reads top to bottom: `TIER_LABELS`,
 *    `SOURCE_LABELS`, `STAGE_LABELS`, `FAILURE_LABELS`. Not a block of copy, and
 *    naming it `COPY` would hide the one thing worth knowing about it.
 */
const CONTAINER = /^(COPY|[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*_(?:LABELS|COPY))$/;

describe('descriptors live under one name', () => {
  it('names every `defineMessages` block COPY or <DOMAIN>_LABELS', () => {
    const offenders = filesUnder(SRC, /\.tsx?$/).flatMap((full) =>
      [...readFileSync(full, 'utf8').matchAll(/\bconst (\w+)(?::[^=]+)? = defineMessages\(/g)]
        .filter(([, name]) => !CONTAINER.test(name))
        .map(([, name]) => `${under(SRC, full)}: ${name}`),
    );

    expect(offenders).toEqual([]);
  });
});

describe('the extracted English catalogue is current', () => {
  /**
   * `en.json` is generated, so it goes stale the moment a descriptor is edited
   * without `npm run i18n:extract` — and stale is invisible: the app renders the
   * German catalogue and never reads this file. The check is the one
   * `packages/design-tokens/test/drift.test.ts` makes for the tokens: run the
   * generator and compare. It costs ~0.3 s, which is why it is here rather than a
   * step of its own in CI.
   *
   * The command is READ from `package.json` rather than repeated, with its output
   * redirected to a temporary file: a copy here would be the second place to keep
   * in step, and the committed artefact must not be rewritten by the test that
   * judges it.
   */
  it('is what `npm run i18n:extract` produces right now', () => {
    const script = (
      JSON.parse(readFileSync(join(APP, 'package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      }
    ).scripts['i18n:extract'];
    const out = 'src/i18n/catalogue/en.json';
    expect(script).toContain(out);

    const fresh = join(mkdtempSync(join(tmpdir(), 'i18n-')), 'en.json');
    execSync(script.replace(out, fresh), {
      cwd: APP,
      // npm puts the workspace's binaries on PATH; jest does not.
      env: {
        ...process.env,
        PATH: `${resolve(APP, '../../node_modules/.bin')}:${process.env.PATH}`,
      },
    });

    expect(readFileSync(ENGLISH, 'utf8')).toEqual(readFileSync(fresh, 'utf8'));
  });
});

/**
 * Every ICU argument a message takes, by name, in the order the parser meets them.
 *
 * `{count}` and the `count` of `{count, plural, …}` are the same argument and are
 * both wanted; the words inside a plural branch are not. That is why this is a
 * parse and not a regular expression: `/\{(\w+)/` reads `{One contribution}` as an
 * argument called `One`, which is a description nobody can write and a check that
 * can only be switched off.
 *
 * The parser is `react-intl`'s own, declared here rather than borrowed through it,
 * so the version this reads is the version the app formats with.
 *
 * `ignoreTag` because a rich-text tag is not an argument. Without it `<b>` comes
 * back as an element whose `value` is `b`, the walk collects it, and the only way to
 * make the check green is to write `{b}` in the description — which is the wrong
 * spelling for a tag and tells a translator something untrue. No message carries an
 * angle bracket today; the first one that does would have hit this.
 */
function argumentsOf(message: string): string[] {
  const names = new Set<string>();
  const walk = (elements: MessageFormatElement[]): void => {
    for (const element of elements) {
      // `#` inside a plural branch is an element with no name at all, which is why
      // this asks whether there is a `value` rather than reading one.
      if (
        element.type !== TYPE.literal &&
        'value' in element &&
        typeof element.value === 'string'
      ) {
        names.add(element.value);
      }
      if ('options' in element) {
        for (const option of Object.values(element.options)) walk(option.value);
      }
      if ('children' in element) walk(element.children);
    }
  };
  walk(parse(message, { ignoreTag: true }));
  return [...names];
}

/**
 * The field a translator reads, and the two cases where the string cannot speak for
 * itself.
 *
 * A `description` is never rendered. `@formatjs/cli` carries it into `en.json` and a
 * translation tool prints it above the entry field — in a PO file it is the `#.`
 * line. It is the only channel between the person who wrote a string and the person
 * who has to write it again in another language, and it is worth a check because it
 * is invisible everywhere else: a missing one costs nothing today and a wrong
 * translation in a year.
 *
 * Not every id needs one. "Settings" as the heading of the settings screen says
 * everything about itself. Two cases do not, and they are the two below:
 *
 *  - **An id whose English is word for word another id's.** Five ids read "Take
 *    part" and five say "No identifier was passed." A translator handed one of them
 *    has no way to know whether the other four are the same sentence in a different
 *    place — where the language would want one word — or four different decisions
 *    that happen to coincide in English. `callout.crowdnewsroom.countSoFar` and
 *    `callout.detail.responses` are the case that proves it: identical today,
 *    deliberately separate, and merging them would be wrong on one of the two
 *    screens.
 *  - **An id carrying a placeholder.** `{count}` could be anything. Whether the
 *    sentence around it needs a plural, a case or a different word order is
 *    answerable only by knowing what goes in the hole.
 *
 * Both are read off `en.json`, which is generated from the source and compared
 * against a fresh extraction above, so neither can be satisfied by editing the file
 * this test reads.
 *
 * "Word for word" is exact-string, deliberately. `Back` and `Back ` are two groups
 * here and neither is required to be described. Widening it to a normalised
 * comparison would start flagging pairs that differ on purpose, and the pair that
 * matters — two ids a translator could take for one — is the one that is identical.
 */
describe('a translator is told what the string cannot tell them', () => {
  const byMessage = new Map<string, string[]>();
  for (const [id, message] of Object.entries(english)) {
    const key = message.defaultMessage ?? '';
    byMessage.set(key, [...(byMessage.get(key) ?? []), id]);
  }

  const described = (id: string) => Boolean(english[id]?.description?.trim());

  it('describes every id whose English is word for word another id’s', () => {
    const shared = [...byMessage.values()].filter((ids) => ids.length > 1).flat();
    expect(
      floorFaults({ 'ids sharing an English message': { found: shared.length, atLeast: 40 } }),
    ).toEqual([]);
    expect(shared.filter((id) => !described(id)).sort()).toEqual([]);
  });

  it('gives each id in a group a description of its own', () => {
    /*
     * Pairwise distinct inside a group, because the letter of the rule above can be
     * satisfied without meeting any part of its purpose. A cold review copied one
     * twin's description onto the other verbatim and everything stayed green, which
     * left `callout.crowdnewsroom.countSoFar` carrying a sentence reading "identical
     * to callout.crowdnewsroom.countSoFar" and the translator holding the same note
     * twice for two strings they still could not tell apart.
     *
     * Copy-paste is the specific mistake a bulk description pass makes, and this
     * file was written by one.
     */
    const copied = [...byMessage.entries()]
      .filter(([, ids]) => ids.length > 1)
      .flatMap(([, ids]) => {
        const seen = new Map<string, string>();
        return ids.flatMap((id) => {
          const text = (english[id]?.description ?? '').trim();
          const first = seen.get(text);
          if (text === '') return [];
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

  it('describes every id that carries a placeholder', () => {
    const withArguments = Object.keys(english).filter(
      (id) => argumentsOf(english[id]?.defaultMessage ?? '').length > 0,
    );
    expect(
      floorFaults({ 'ids with a placeholder': { found: withArguments.length, atLeast: 40 } }),
    ).toEqual([]);
    expect(withArguments.filter((id) => !described(id)).sort()).toEqual([]);
  });

  it('names every placeholder in the description that carries it, and no other', () => {
    /*
     * The braced spelling, `{count}`, not the bare word. A description saying "the
     * count" reads fine and leaves a translator guessing which of two arguments it
     * meant; this is the difference between a field that is filled in and a field
     * that is answered. Both descriptions on the impact card and one on a callout
     * card were written without it and are the first reason this assertion exists.
     *
     * **Both directions**, and the second is the one a cold review had to point out.
     * Forwards catches a description written for a message that has since gained an
     * argument. Backwards catches the other half of a rename: the new name is added,
     * the sentence about the old one is left behind, and the translator is told about
     * a hole that does not exist — so they write a sentence around it and react-intl
     * formats with a value nobody passes.
     *
     * A floor of its own rather than borrowed from the assertion above, because a
     * damaged `argumentsOf` would otherwise leave this one green over an empty list
     * and nothing here would say so.
     */
    const named = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);

    const pairs = Object.entries(english).flatMap(([id, message]) => {
      const takes = argumentsOf(message.defaultMessage ?? '');
      const says = named(message.description ?? '');
      return [
        ...takes.filter((name) => !says.includes(name)).map((name) => `${id}: {${name}} unnamed`),
        ...says.filter((name) => !takes.includes(name)).map((name) => `${id}: {${name}} invented`),
      ];
    });

    const carrying = Object.keys(english).filter(
      (id) => argumentsOf(english[id]?.defaultMessage ?? '').length > 0,
    ).length;
    expect(
      floorFaults({ 'ids whose placeholders are checked': { found: carrying, atLeast: 40 } }),
    ).toEqual([]);
    expect(pairs.sort()).toEqual([]);
  });
});
