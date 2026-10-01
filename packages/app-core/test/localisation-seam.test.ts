import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  filesUnder,
  floorFaults,
  under,
  withEscapesDecoded,
  withoutComments,
} from '@correctiv/prose-and-code';

/**
 * German in the core, and why this file exists at all.
 *
 * `apps/mobile/__tests__/localisation-seam.test.ts` holds the same net over
 * `apps/mobile/src`, and until the core's four user-facing strings were lifted
 * (#141) that was the whole of it — the core was simply not a place German lived,
 * so nothing had to say it could not grow there. The lift makes it one: the core
 * now owns descriptors, and a descriptor is one careless `defaultMessage` away
 * from being the German itself. An unwatched workspace is where a migrated
 * codebase grows its German back, and it grows it in the half nobody is looking
 * at.
 *
 * The other half of the seam needs no counterpart here and has one anyway.
 * `npm run i18n:extract` already globs every `.ts` under `packages/app-core/src`, so
 * every `core.` id lands in `en.json` and the app's test pairs it against
 * `catalogue/de/core.ts` in both directions. What that cannot see is a German
 * string that never became a descriptor, which is exactly what this walk is for.
 *
 * The shape is `boundary.test.ts`'s and the app's: walk the tree, collect the
 * offenders, assert the list is empty, and assert the same of the excuses.
 */
const SRC = fileURLToPath(new URL('../src', import.meta.url));

/**
 * The characters that betray a German string. A partial net on purpose, and the
 * same one the app uses: "Suchen" slips through, and no cheap check catches it.
 */
const GERMAN_CHARACTERS = /[äöüßÄÖÜ„“]/;

/**
 * `src/data/`, which is MOSTLY content rather than UI.
 *
 * ADR 0026 §6 gives the rule and it is worth typing out rather than pointing at:
 * *would this string still exist if the content came from a CMS?* It asks that of
 * a STRING, and this exclusion answers for a DIRECTORY, which is a wider claim
 * than the rule makes. It is excluded by path all the same, because the answer is
 * the same for two hundred of them — the project descriptions, the Spotlight
 * subjects, the sample claims, the callout questions and the Abriss-Atlas reports
 * would all arrive from a CMS, so they are the articles' case and not the seam's,
 * and listing them below would bury the four that matter.
 *
 * What the path cannot say is where that stops, so the members it covers WITHOUT
 * answering for are named in `UI_VOCABULARY_IN_DATA` below rather than left to
 * read as content by association.
 *
 * One member is neither, and was decided rather than assumed: `data/abriss-atlas.ts`
 * types a report's status as `'gemeldet' | 'bestätigt'`. A union of states is
 * vocabulary in data's clothing — a CMS would still have to say which of the two a
 * report is — but it is vocabulary in the IDENTIFIER, not in a string a screen
 * prints, and `apps/mobile/src/app/atlas.tsx` already spells both out in its own
 * `STATUS_LABELS`. Renaming the two values to English is a change to sample data
 * with no user-visible half, so it is worth doing and is not worth doing here,
 * where it would arrive mixed into a lift of somebody else's strings.
 */
const CONTENT = /^data\//;

/**
 * The two files under `data/` whose strings FAIL the CMS question, and which the
 * path exclusion above is therefore covering rather than answering for.
 *
 * Named because the alternative is a comment claiming the whole directory is
 * content, which is the claim that was here and is not true:
 *
 *  - `data/interests.ts` — the `label` of each topic chip ("AfD & Rechtsextremismus",
 *    "Jugend & Salon5"), rendered by `apps/mobile/src/app/onboarding.tsx` onto a
 *    `Chip`. The list is the app's own onboarding vocabulary; articles arriving
 *    from a CMS would not bring it.
 *  - `data/feeds.config.ts` — `badge`, which `components/feed/ArticleHero.tsx` and
 *    `articles/offline-bundle.ts` print as an article's kicker, and `label`, which
 *    is a display name by construction (`test/feeds.config.test.ts` asserts every
 *    feed has a non-empty one) although no screen reads it today. "Recherchen",
 *    "Faktencheck" and "Klima" are German words; the rest are marks.
 *
 * Not lifted here, and that is the decision rather than an oversight: both are
 * indexed by key across screens and one of them is baked into a generated offline
 * bundle, so the lift is its own change with its own screenshots. What this entry
 * buys is that the next reader of the exclusion above is not told they are content.
 */
const UI_VOCABULARY_IN_DATA = ['data/interests.ts', 'data/feeds.config.ts'];

/**
 * The German that is still written in the core, and why each one is. Each entry
 * is the STRING, not the file it sits in — a whole-file exemption excuses
 * everything anybody adds to that file afterwards.
 *
 * Asserted in both directions, as the app's is: German that is not one of these
 * fails, and a fragment named here that its file no longer contains fails too, so
 * a reason cannot outlive the thing it was about.
 *
 * None of these is a string a person reads, which is the test each one had to
 * pass. They are German as INPUT (a pattern that matches somebody else's prose,
 * a key in somebody else's JSON) and German as a CHARACTER (a quotation mark that
 * is the value, not the language).
 */
const GERMAN_OUTSIDE_THE_CATALOGUE: Record<string, string[]> = {
  // Patterns over the prose correctiv.org publishes beside its verdict image, so
  // the German is the thing being READ. A translation of these would stop them
  // matching the pages they exist for. The labels this file used to hold beside
  // them are gone — they are `RATING_LABELS`, and their German is in the
  // catalogue.
  'articles/rating.ts': [
    'gr(ö|oe)(ß|ss)tenteils falsch',
    'gr(ö|oe)(ß|ss)tenteils richtig',
    'irref(ü|ue)hrend',
  ],
  // The characters themselves, as the replacement half of an entity decoder:
  // `&bdquo;` becomes `„` in any language, and the rule in AGENTS.md that German
  // typography uses „…“ is what makes these the right output rather than a
  // German string.
  'lib/html.ts': ["'“'", "'„'"],
  // A field name in the JSON Yoast attaches to a WordPress post. It is spelled by
  // correctiv.org's plugin configuration, not by this app, and reading it with
  // any other spelling reads nothing.
  'services/wp.service.ts': ["'Geschätzte Lesezeit'"],
};

/**
 * Every extension a source file in the core can carry.
 *
 * `cts` and `cjs` are in the list although the core has none: an extension the
 * walk does not know is a file the walk does not read, and a check that silently
 * skips a file is worse than no check. The list is every extension the TypeScript
 * and CommonJS spellings produce, so adding a `.cjs` shim here cannot also add a
 * blind spot.
 */
const SOURCE = /\.(tsx|jsx|ts|mts|cts|mjs|cjs|js)$/;

/**
 * The lines of a file that still carry German, once its excused fragments are
 * taken out of it. One occurrence each, deliberately: a fragment excused once and
 * pasted a second time in the same file is a second decision and shows up here.
 *
 * Comments go first, because a comment is not a string a user reads. The cost is
 * the app's too and is named there: a German COMMENT is invisible to this, and
 * has been a regression rather than a leftover since 2026-08-12.
 *
 * **What this still cannot do, measured rather than guessed.** Three things get
 * past it and each is named where it can be acted on rather than left to be
 * rediscovered:
 *
 *  - A German word spelled with none of `äöüß„“`. The ADR says so — "Suchen"
 *    slips through — and the one the core still renders is `Min.` in
 *    `src/lib/format.ts`, named in that function's own comment.
 *  - A German string after a ` //` inside a string literal, which `withoutComments`
 *    takes for a comment and truncates. Named in `@correctiv/prose-and-code`, where
 *    the function is, because every check that reads source shares it.
 *  - German inside `src/data/`, excluded by path — see `CONTENT` and
 *    `UI_VOCABULARY_IN_DATA` above for what that does and does not claim.
 *
 * Escapes are NOT on that list any more: `withEscapesDecoded` closes them.
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
  const sources = filesUnder(SRC, SOURCE)
    .map((full) => under(SRC, full))
    .filter((path) => !CONTENT.test(path));

  const read = (path: string) => readFileSync(join(SRC, path), 'utf8');

  it('reads the core it is checking (guards against a silently empty walk)', () => {
    expect(floorFaults({ 'files under src/': { found: sources.length, atLeast: 25 } })).toEqual([]);
  });

  it('holds German in the catalogue, and in three inputs that say why not', () => {
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
    const stale = Object.entries(GERMAN_OUTSIDE_THE_CATALOGUE).flatMap(([path, fragments]) =>
      fragments
        .filter((fragment) => !sources.includes(path) || !read(path).includes(fragment))
        .map((fragment) => `${path}: ${fragment}`),
    );

    expect(stale).toEqual([]);
  });

  it('excludes the content directory and nothing else', () => {
    // The exclusion is a path rule, so it is the one part of this file that can
    // widen by accident. Named here, so widening it is a visible edit.
    const excluded = filesUnder(SRC, SOURCE)
      .map((full) => under(SRC, full))
      .filter((path) => CONTENT.test(path));

    expect(excluded.every((path) => path.startsWith('data/'))).toBe(true);
    expect(excluded.length).toBeGreaterThan(0);

    // And the two the exclusion covers without answering for are still in it. A
    // file renamed or lifted out of `data/` leaves its entry behind, where it
    // reads as a standing exception to a rule it is no longer an exception to.
    expect(excluded).toEqual(expect.arrayContaining(UI_VOCABULARY_IN_DATA));
  });

  /**
   * The net, made to fail, in the two ways this file claims to have closed.
   *
   * Both were open when it was written: a `.cjs` file was not walked at all, and
   * `'Pr\u00fcfen'` read as ASCII. Asserted rather than described, because a
   * closure nobody can break is the same as no closure — and each of these is one
   * character away from being reopened by a tidy-up.
   */
  it('sees German through a \\u escape', () => {
    expect(germanLines("const hint = 'Pr\\u00fcfen Sie Ihre Verbindung.';", [])).toEqual([
      "const hint = 'Prüfen Sie Ihre Verbindung.';",
    ]);
    expect(germanLines("const hint = 'Pr\\u{fc}fen';", [])).toEqual(["const hint = 'Prüfen';"]);
    expect(germanLines("const hint = 'Pr\\xfcfen';", [])).toEqual(["const hint = 'Prüfen';"]);
  });

  it('walks every source extension, including the two the core has none of', () => {
    // Against the real walk rather than against a copy of its pattern: a regex
    // repeated in the assertion passes whatever the function does.
    const dir = mkdtempSync(join(tmpdir(), 'seam-'));
    const extensions = ['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'];
    for (const extension of extensions) writeFileSync(join(dir, `x.${extension}`), '');
    writeFileSync(join(dir, 'x.json'), '{}');

    expect(
      filesUnder(dir, SOURCE)
        .map((full) => basename(full))
        .sort(),
    ).toEqual(extensions.map((extension) => `x.${extension}`).sort());
  });
});
