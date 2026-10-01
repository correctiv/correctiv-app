import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { applyWordings, findWording, literal, replaceWording } from '../../plugin/catalogue.ts';
import { de } from '../../../../packages/catalogue/src/de/index.ts';
import { ROOT } from '../../plugin/collect.ts';
import {
  buildIndex,
  candidates,
  MIN_FIXED,
  resolve,
  sameFile,
} from '../../src/preview/strings/match.ts';
import {
  ENGLISH_EXTRACTION,
  GERMAN_CATALOGUE_DIR,
  PREVIEW_STRINGS_KEY,
} from '../../src/preview/strings/names.ts';
import { checkWording } from '../../src/preview/strings/validate.ts';

/**
 * The strings tool of ADR 0056, from the pick to the file.
 *
 * Each describe below is one decision of the record, and the last runs over the real
 * catalogue rather than a fixture, because the question the record measured — how much
 * of the German can be recognised by its text — is a fact about that catalogue.
 */

const source = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('the two ends of the strings seam', () => {
  it('spells the storage key the way the app reads it', () => {
    // The shell may not import from `apps/mobile` (ADR 0040), so the app is read as
    // text, the way `locale.test.ts` holds the language key.
    expect(source('apps/mobile/src/lib/strings.ts')).toContain(
      `export const PREVIEW_STRINGS_KEY = '${PREVIEW_STRINGS_KEY}';`,
    );
    expect(PREVIEW_STRINGS_KEY.startsWith('workbench:')).toBe(true);
  });

  // That the app's provider reads the key and follows it is the app's own test,
  // `apps/mobile/__tests__/preview-strings.test.tsx`, which renders the provider.
});

describe('a rendering is looked up by its text (§1)', () => {
  const index = buildIndex([
    ['home.viewAll', 'Alle ansehen'],
    ['a.count', '{count, plural, one {Ein Artikel} other {# Artikel}}'],
    ['a.by', 'Recherchiert von {authors} und {others}'],
  ]);

  it('matches a message with no holes exactly', () => {
    expect(candidates(index, 'Alle ansehen')).toEqual(['home.viewAll']);
  });

  it('matches every branch of a plural', () => {
    expect(candidates(index, 'Ein Artikel')).toEqual(['a.count']);
    expect(candidates(index, '12 Artikel')).toEqual(['a.count']);
  });

  it('matches a placeholder as a hole', () => {
    expect(candidates(index, 'Recherchiert von Anna und Ben')).toEqual(['a.by']);
  });

  it('reads whitespace the way a browser lays it out', () => {
    expect(candidates(index, '  Alle\n ansehen ')).toEqual(['home.viewAll']);
  });

  it('prefers a message that matches word for word over a pattern that also does', () => {
    const both = buildIndex([
      ['x.fixed', 'Alle Beiträge ansehen'],
      ['x.pattern', 'Alle {thing} ansehen'],
    ]);
    expect(candidates(both, 'Alle Beiträge ansehen')).toEqual(['x.fixed']);
    expect(candidates(both, 'Alle Videos ansehen')).toEqual(['x.pattern']);
  });

  it('lets the owner chain break a tie between files', () => {
    const twins = buildIndex([
      ['a.save', 'Speichern'],
      ['b.save', 'Speichern'],
    ]);
    const files: Record<string, string> = {
      'a.save': 'apps/mobile/src/components/A.tsx',
      'b.save': 'apps/mobile/src/components/B.tsx',
    };
    const owners = ['/home/someone/repo/apps/mobile/src/components/B.tsx'];
    expect(resolve(twins, ['Speichern'], owners, (id) => files[id])).toEqual({
      text: 'Speichern',
      ids: ['b.save'],
      narrowed: true,
    });
    // No owner chain, the published export: both stay, and nothing claims otherwise.
    expect(resolve(twins, ['Speichern'], null, (id) => files[id])?.ids).toEqual([
      'a.save',
      'b.save',
    ]);
  });

  it('does not narrow to nothing when no candidate is on the owner chain', () => {
    // A core descriptor is written in a file no component's owner chain passes through.
    const twins = buildIndex([
      ['core.x', 'Fehler'],
      ['ui.x', 'Fehler'],
    ]);
    const owners = ['/r/apps/mobile/src/elsewhere.tsx'];
    expect(resolve(twins, ['Fehler'], owners, () => 'packages/app-core/src/x.ts')?.ids).toEqual([
      'core.x',
      'ui.x',
    ]);
  });

  it('compares a symbolicated path with a repository path on a path boundary', () => {
    expect(sameFile('/abs/apps/mobile/src/A.tsx', 'apps/mobile/src/A.tsx')).toBe(true);
    expect(sameFile('/abs/apps/mobile/src/XA.tsx', 'A.tsx')).toBe(false);
  });
});

describe('the text node comes before the element’s text (§2)', () => {
  const index = buildIndex([['home.viewAll', 'Alle ansehen']]);

  it('finds the message beside its decoration', () => {
    // What `pointedTexts` hands over for the "Alle ansehen →" row: the node, then the
    // element's whole text, which on its own matches nothing.
    expect(resolve(index, ['Alle ansehen', 'Alle ansehen →'], null, () => undefined)?.ids).toEqual([
      'home.viewAll',
    ]);
    expect(resolve(index, ['Alle ansehen →'], null, () => undefined)?.ids).toEqual([]);
  });

  it('falls back to the element’s text where the node matches nothing', () => {
    expect(resolve(index, ['Alle', 'Alle ansehen'], null, () => undefined)?.ids).toEqual([
      'home.viewAll',
    ]);
  });

  // What the picker reads under the pointer, and in which order, is
  // `strings-dom.test.ts`, against a document.
});

describe('a pattern too loose to match on takes no part (§3)', () => {
  const index = buildIndex([
    ['c.cta', '{cta}: {title}'],
    ['c.quote', '„{quote}“'],
    ['c.by', 'von {authors}'],
    ['c.long', 'Ein sehr langer Satz über eine Recherche'],
  ]);

  it('leaves out a message whose fixed text is under the threshold', () => {
    expect([...index.loose].sort()).toEqual(['c.by', 'c.cta', 'c.quote']);
    expect(candidates(index, 'Mehr: Ein sehr langer Satz über eine Recherche')).toEqual([]);
    expect(candidates(index, '„Ein Zitat“')).toEqual([]);
  });

  it('counts letters and digits, not punctuation', () => {
    expect(MIN_FIXED).toBeGreaterThan(': '.length);
    const edge = buildIndex([
      ['c.four', '{a} abcd'],
      ['c.three', '{a} ab!c'],
    ]);
    expect(edge.loose.has('c.four')).toBe(false);
    expect(edge.loose.has('c.three')).toBe(true);
  });

  it('takes a whole id out when one of its branches is loose, and says so of every branch', () => {
    // `# Tag` has three fixed letters and `# Tage` four; per rendering, "3 Tage" could be
    // picked and "1 Tag" not, while the panel called the id "cannot be picked".
    const days = buildIndex([['x.days', '{count, plural, one {# Tag} other {# Tage}}']]);
    expect(days.loose.has('x.days')).toBe(true);
    expect(candidates(days, '1 Tag')).toEqual([]);
    expect(candidates(days, '3 Tage')).toEqual([]);
  });
});

describe('an edge hole does not reach across a composed line’s separator', () => {
  const index = buildIndex([
    ['x.lead', '{minutes} Min. Lesezeit'],
    ['x.tail', 'Recherche von {authors}'],
    ['x.middle', 'Von {authors} geprüft'],
    ['x.own', '{tier} · seit {date}'],
  ]);

  it('keeps a leading or trailing hole inside one segment of the line', () => {
    expect(candidates(index, 'Anna Muster · 23. September · 3 Min. Lesezeit')).toEqual([]);
    expect(candidates(index, 'Recherche von Anna · 3 Min. Lesezeit')).toEqual([]);
    expect(candidates(index, 'Recherche von Anna und Ben')).toEqual(['x.tail']);
  });

  it('leaves a hole in the middle as it was', () => {
    expect(candidates(index, 'Von Anna · Ben geprüft')).toEqual(['x.middle']);
  });

  it('lets a message whose own text holds the separator match across it', () => {
    expect(candidates(index, 'Mitgliedschaft · seit 4. März')).toEqual(['x.own']);
  });
});

describe('a number hole takes a number', () => {
  const index = buildIndex([
    ['x.count', '{count, plural, one {# Beitrag bisher} other {# Beiträge bisher}}'],
    ['x.number', 'Noch {left, number} Plätze frei'],
    ['x.any', 'Noch {left} Plätze frei'],
  ]);

  it('matches digits and the separators a formatted number carries', () => {
    expect(candidates(index, '12 Beiträge bisher')).toEqual(['x.count']);
    expect(candidates(index, '1.234 Beiträge bisher')).toEqual(['x.count']);
    expect(candidates(index, '1\u202f234 Beiträge bisher')).toEqual(['x.count']);
  });

  it('does not match words where a number goes', () => {
    expect(candidates(index, 'Viele Beiträge bisher')).toEqual([]);
    expect(candidates(index, 'Noch viele Plätze frei')).toEqual(['x.any']);
    expect(candidates(index, 'Noch 3 Plätze frei').sort()).toEqual(['x.any', 'x.number']);
  });
});

describe('the German is checked against the English’s placeholders (§8)', () => {
  it('passes a wording with the same placeholders in another order', () => {
    expect(checkWording('{count} of {total}', '{total}: {count}')).toEqual([]);
  });

  it('names a lost placeholder and an invented one', () => {
    expect(checkWording('{count} results', 'Ergebnisse')).toEqual([
      { code: 'missing', names: ['count'] },
    ]);
    expect(checkWording('Results', '{count} Ergebnisse')).toEqual([
      { code: 'extra', names: ['count'] },
    ]);
  });

  it('refuses a pattern that does not parse, and an empty one', () => {
    expect(checkWording('{count} results', '{count Ergebnisse')[0]?.code).toBe('syntax');
    expect(checkWording('Results', '  ')).toEqual([{ code: 'empty' }]);
  });

  it('reads a placeholder inside a plural branch', () => {
    const english = '{count, plural, one {# result for {term}} other {# results for {term}}}';
    expect(
      checkWording(english, '{count, plural, one {# Treffer} other {# Treffer für {term}}}'),
    ).toEqual([]);
    expect(checkWording(english, '{count, plural, one {# Treffer} other {# Treffer}}')).toEqual([
      { code: 'missing', names: ['term'] },
    ]);
  });
});

describe('saving replaces one literal and nothing else (§8)', () => {
  const file = [
    '/** German for the `x.*` ids. */',
    'export const x: Record<string, string> = {',
    '  // Kept short: the button is narrow.',
    "  'x.save': 'Speichern',",
    "  'x.long':",
    "    'Ein langer Satz, der über die Zeile hinausreicht und deshalb umbrochen ist, wie der Formatierer es will.',",
    '};',
    '',
  ].join('\n');

  it('keeps every comment and every other line byte for byte', () => {
    const next = replaceWording(file, 'x.save', 'Sichern')!;
    expect(next).toBe(file.replace("'Speichern'", "'Sichern'"));
  });

  it('finds a wording that the formatter put on its own line', () => {
    expect(findWording(file, 'x.long')?.text).toMatch(/^Ein langer Satz/);
  });

  it('answers null for an id the file does not carry', () => {
    expect(replaceWording(file, 'x.missing', 'Neu')).toBeNull();
  });

  it('spells a literal the way the formatter would', () => {
    expect(literal('Sie’s')).toBe("'Sie’s'");
    expect(literal("Sie's")).toBe('"Sie\'s"');
    expect(literal('a\'b"c')).toBe("'a\\'b\"c'");
    expect(literal('back\\slash')).toBe("'back\\\\slash'");
  });

  /**
   * Every literal the writer prints has to read back, through the compiler, as the text
   * it was given. A raw line break inside quotes is not a string literal at all, so the
   * file would stop parsing; U+2028 and U+2029 are legal inside one since ES2019, and are
   * escaped anyway so that an entry stays one line to every line-based reader of the
   * file, `git diff` and the reviewer included, instead of breaking invisibly.
   */
  it('reads back through the compiler as the text it was given', () => {
    for (const text of [
      'eins\nzwei',
      'eins\r\nzwei',
      'eins\u2028zwei',
      'eins\u2029zwei',
      "Sie's",
      'a\'b"c',
      'back\\slash',
      '„Zitat“ {count}',
    ]) {
      const file = `export const x = { 'x.id': ${literal(text)} };\n`;
      const parsed = ts.createSourceFile('x.ts', file, ts.ScriptTarget.Latest, true);
      expect((parsed as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics).toEqual([]);
      expect(findWording(file, 'x.id')?.text).toBe(text);
      expect(file.split('\n').length).toBe(2);
      expect(/[\u2028\u2029]/.test(file)).toBe(false);
    }
  });
});

describe('the save writes into the real catalogue, all or nothing (§7, §8)', () => {
  const english = JSON.parse(source(ENGLISH_EXTRACTION)) as Record<
    string,
    { defaultMessage?: string }
  >;
  const sources = new Map(
    readdirSync(join(ROOT, GERMAN_CATALOGUE_DIR))
      .filter((name) => name.endsWith('.ts') && name !== 'index.ts')
      .map((name) => [
        `${GERMAN_CATALOGUE_DIR}/${name}`,
        source(`${GERMAN_CATALOGUE_DIR}/${name}`),
      ]),
  );

  it('writes the one file an id lives in', () => {
    const { written, refused } = applyWordings({ 'home.viewAll': 'Alle zeigen' }, english, sources);
    expect(refused).toEqual([]);
    expect([...written.keys()]).toEqual([`${GERMAN_CATALOGUE_DIR}/home.ts`]);
    expect(written.get(`${GERMAN_CATALOGUE_DIR}/home.ts`)).toContain(
      "'home.viewAll': 'Alle zeigen',",
    );
  });

  it('refuses an id the catalogue does not carry, and writes nothing else with it', () => {
    const { written, refused } = applyWordings(
      { 'home.viewAll': 'Alle zeigen', 'home.invented': 'Neu' },
      english,
      sources,
    );
    expect(refused).toEqual([{ id: 'home.invented', problems: [{ code: 'unknown-id' }] }]);
    expect(written.size).toBe(0);
  });

  it('refuses a wording that lost a placeholder', () => {
    const id = Object.keys(english).find((key) =>
      /\{\w+\}/.test(english[key]!.defaultMessage ?? ''),
    )!;
    const { refused } = applyWordings({ [id]: 'ohne Platzhalter' }, english, sources);
    expect(refused[0]?.problems[0]?.code).toBe('missing');
  });

  it('leaves a file the formatter has nothing to say about', () => {
    // A long wording crosses the print width; the endpoint runs oxfmt over what it wrote,
    // and this is that run on a copy, so `npm run check` stays quiet after a save.
    const long =
      'Alle ansehen, und zwar wirklich alle, auch die, die schon etwas älter sind und die man leicht übersieht';
    const { written } = applyWordings({ 'home.viewAll': long }, english, sources);
    const dir = mkdtempSync(join(tmpdir(), 'strings-save-'));
    try {
      const path = join(dir, 'home.ts');
      writeFileSync(path, written.get(`${GERMAN_CATALOGUE_DIR}/home.ts`)!);
      execFileSync(join(ROOT, 'node_modules/.bin/oxfmt'), [path], { cwd: ROOT, stdio: 'pipe' });
      execFileSync(join(ROOT, 'node_modules/.bin/oxfmt'), ['--check', path], {
        cwd: ROOT,
        stdio: 'pipe',
      });
      expect(findWording(readFileSync(path, 'utf8'), 'home.viewAll')?.text).toBe(long);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/**
 * Built here from the catalogue and the extraction, which are both in the repository,
 * rather than read from `content/strings.generated.json`, which is a build artifact:
 * CI has none, and the first version of this test failed there on a missing file.
 * `scripts/strings.mjs` joins the same two sources the same way for the app's rows.
 */
describe('over the app’s real German', () => {
  const extracted = JSON.parse(source(ENGLISH_EXTRACTION)) as Record<string, unknown>;
  const app = Object.keys(extracted).map((id) => ({ id, translations: { de: de[id] ?? null } }));
  const index = buildIndex(app.map((entry) => [entry.id, entry.translations.de ?? ''] as const));

  it('reads the catalogue it is checking (guards against a silently empty table)', () => {
    expect(app.length).toBeGreaterThan(100);
  });

  it('recognises every German wording with no holes as its own id', () => {
    // The floor of §1: a message the app renders word for word is found among the
    // candidates for its own text. If this fails the matcher has drifted from how the
    // catalogue is written, and the tool would answer "no id" for a string.
    const missed = app
      .filter((entry) => entry.translations.de && !/[{}]/.test(entry.translations.de))
      .filter((entry) => !candidates(index, entry.translations.de!).includes(entry.id))
      .map((entry) => entry.id);
    expect(missed).toEqual([]);
  });

  /**
   * The line under a feed headline is composed in code, author, date and reading time
   * joined with " · ", and reaches the page as ONE text node. Measured on 2026-09-24:
   * `{minutes} Min. Lesezeit` swallowed the author and the date through its leading
   * hole and was the only candidate, so the panel named the wrong id with confidence.
   * "No id" is an acceptable answer here; that one is not.
   */
  it('does not confidently name the wrong id for the composed byline', () => {
    const line = 'Caroline Lindekamp · 23. September · 3 Min. Lesezeit';
    expect(candidates(index, line)).not.toEqual(['core.reader.readingTime']);
    expect(candidates(index, line)).not.toContain('core.reader.readingTime');
    // The reading time on its own is still found, by both messages that can print it.
    expect(candidates(index, '3 Min. Lesezeit').sort()).toEqual([
      'article.readingTime',
      'core.reader.readingTime',
    ]);
  });

  it('keeps the loose ids to the few the record expected', () => {
    // Not a figure to hold, which ADR 0056 §3 says in as many words: this list may grow
    // by accident. It is printed so that a reviewer sees it, and bounded only far above
    // where a matcher that had stopped counting letters would land.
    const loose = [...index.loose].sort();
    console.log(`strings: ${loose.length} loose ids: ${loose.join(', ')}`);
    expect(loose.length).toBeLessThan(app.length / 10);
  });
});
