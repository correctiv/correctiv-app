import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findWording, onlyWordingsChanged } from '../plugin/catalogue.ts';
import { ROOT } from '../plugin/collect.ts';
import {
  applyIssue,
  KINDS,
  mayWrite,
  parsePorcelain,
  verifyIssue,
  type Change,
  type Repo,
  type Tree,
} from '../scripts/submission-kinds.ts';
import {
  applyStrings,
  readWordings,
  STRINGS_PAYLOAD_MAX,
  verifyStrings,
} from '../scripts/submission-strings.ts';
import { readSubmission, Refusal, refusalText, type RefusalCode } from '../scripts/submission.ts';
import { ENGLISH_EXTRACTION, GERMAN_CATALOGUE_DIR } from '../src/preview/strings/names.ts';
import { stringsPayload } from '../src/preview/strings/submit.ts';
import { checkWording, WORDING_MAX } from '../src/preview/strings/validate.ts';
import { de as appGerman } from '../../../packages/catalogue/src/de/index.ts';
import { issueFor } from '../src/preview/submission.ts';

/**
 * ADR 0062: the texts submission, from the issue to the proof, over a copy of the real
 * catalogue. The issue is text anybody can write, and here it names ids as well as
 * wordings, so most of this is what is refused and what the proof catches.
 *
 * Characters a reviewer cannot see are built with `String.fromCodePoint` rather than
 * typed, so that this file shows what it tests.
 */

const HOME = `${GERMAN_CATALOGUE_DIR}/home.ts`;

/** The real catalogue and extraction, read once; every test works on its own copy. */
function snapshot(): Map<string, string> {
  const files = new Map<string, string>();
  for (const name of readdirSync(join(ROOT, GERMAN_CATALOGUE_DIR)))
    files.set(
      `${GERMAN_CATALOGUE_DIR}/${name}`,
      readFileSync(join(ROOT, GERMAN_CATALOGUE_DIR, name), 'utf8'),
    );
  files.set(ENGLISH_EXTRACTION, readFileSync(join(ROOT, ENGLISH_EXTRACTION), 'utf8'));
  return files;
}
const MAIN = snapshot();

function repoOf(files: ReadonlyMap<string, string>): Repo {
  return {
    read: (path) => {
      const text = files.get(path);
      if (text === undefined) throw new Error(`no such file: ${path}`);
      return text;
    },
    list: (dir) =>
      [...files.keys()]
        .filter((path) => path.startsWith(`${dir}/`))
        .map((path) => path.slice(dir.length + 1)),
  };
}
const REPO = repoOf(MAIN);

/** The issue the workbench opens for these wordings. */
function issueOf(wordings: Record<string, string>) {
  return issueFor('strings', stringsPayload(wordings), {
    heading: 'Änderungen an den Texten der App',
    lead: 'Aus der Workbench.',
  });
}

function refused(run: () => unknown): Refusal {
  try {
    run();
  } catch (error) {
    if (error instanceof Refusal) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}
const code = (run: () => unknown): RefusalCode => refused(run).code;

/** Every way a comment or a body can tell GitHub to do something, or hide what follows. */
function harmless(markdown: string) {
  expect(markdown).not.toMatch(/#\d/);
  expect(markdown).not.toContain('@correctiv');
  expect(markdown).not.toContain('<!--');
  expect(markdown).not.toMatch(/^\s*(closes|fixes|resolves)\b/im);
  for (const line of markdown.split('\n')) expect((line.match(/`/g) ?? []).length % 2).toBe(0);
}

/** What the German of `id` says after a write, read back through the compiler. */
function wordingIn(files: { path: string; content: string }[], id: string): string | undefined {
  for (const file of files) {
    const found = findWording(file.content, id);
    if (found) return found.text;
  }
  return undefined;
}

function parses(source: string): boolean {
  const file = ts.createSourceFile('x.ts', source, ts.ScriptTarget.Latest, true);
  return (file as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics.length === 0;
}

/** A tree for the proof: `main` as snapshot, the working tree as `after`. */
function treeOf(after: ReadonlyMap<string, string>): Tree {
  return {
    before: (path) => MAIN.get(path)!,
    after: (path) => after.get(path)!,
    list: (dir) => repoOf(MAIN).list(dir),
  };
}

/** Apply, then the tree the write leaves, and the changes git would report for it. */
function written(wordings: Record<string, string>) {
  const applied = applyStrings(stringsPayload(wordings), REPO);
  const after = new Map(MAIN);
  for (const { path, content } of applied.files) after.set(path, content);
  const changes: Change[] = applied.files.map(({ path }) => ({ status: ' M', path }));
  return { applied, after, changes };
}

describe('reading a texts issue', () => {
  it('takes the wordings out of what the workbench writes, and applies them', () => {
    const { title, body } = issueOf({ 'home.viewAll': 'Alle zeigen', 'ui.back': 'Zumachen' });
    const applied = applyIssue(title, body, REPO);
    expect(applied.kind).toBe('strings');
    expect(applied.format).toBe(true);
    expect(applied.files.map((file) => file.path)).toEqual([HOME, `${GERMAN_CATALOGUE_DIR}/ui.ts`]);
    expect(wordingIn(applied.files, 'home.viewAll')).toBe('Alle zeigen');
    expect(wordingIn(applied.files, 'ui.back')).toBe('Zumachen');
    expect(applied.summary).toContain(
      '- `home.viewAll` in `home.ts`: aus `Alle ansehen` wird `Alle zeigen`.',
    );
  });

  it('refuses Markdown and HTML around the block, since they can show a different block', () => {
    const { title, body } = issueOf({ 'home.viewAll': 'Alle zeigen' });
    const decorated = [
      '# Bitte übernehmen',
      '<details><summary>Warum</summary>',
      '',
      '```ts',
      "export const evil = { 'home.factChecks': 'Nicht das hier' };",
      '```',
      '</details>',
      '',
      body,
      '',
      '> Danke, **@correctiv/everyone**, Fixes #1',
      '<img src=x onerror=alert(1)>',
    ].join('\n');
    expect(code(() => applyIssue(title, decorated, REPO))).toBe('body-shape');
    // Markdown in the lead that hides nothing is fine; it renders, and the block with it.
    const lead = `# Bitte übernehmen\n\n**Danke**, @correctiv/everyone, Fixes #1\n\n${body.slice(body.indexOf('```'))}`;
    expect(applyIssue(title, lead, REPO).files.map((file) => file.path)).toEqual([HOME]);
  });

  it('refuses an id written twice in the block, which JSON.parse would silently keep once', () => {
    const payload = '{\n  "home.viewAll": "Harmlos",\n  "home.v\\u0069ewAll": "Böse"\n}';
    const refusal = refused(() => applyStrings(payload, REPO));
    expect(refusal.code).toBe('duplicate-ids');
    expect(refusalText(refusal)).toContain('- `home.viewAll`');
  });

  it('refuses a second json block, and a block hidden in an HTML comment', () => {
    const { title, body } = issueOf({ 'home.viewAll': 'Alle zeigen' });
    const other = issueOf({ 'home.viewAll': 'Alles' }).body;
    expect(code(() => readSubmission(title, `${body}\n${other}`))).toBe('several-blocks');
    expect(code(() => readSubmission(title, `Harmlos.\n<!--\n${other}-->`))).toBe('hidden-text');
  });

  it('refuses a block that is not an object of id to German, or an empty one', () => {
    for (const payload of ['[]', '"Alle zeigen"', '{}', '{"home.viewAll": 3}', 'null'])
      expect(code(() => applyStrings(payload, REPO))).toBe('not-wordings');
    expect(code(() => applyStrings('{"home.viewAll": ', REPO))).toBe('not-json');
  });

  it('refuses a payload over the bound, before parsing it', () => {
    const big = JSON.stringify({ 'home.viewAll': 'x'.repeat(STRINGS_PAYLOAD_MAX) });
    expect(code(() => readWordings(big))).toBe('texts-too-large');
    // Many small entries, each under the wording bound, are refused by the same bound.
    const many = JSON.stringify(
      Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`home.x${i}`, 'Text'])),
    );
    expect(many.length).toBeGreaterThan(STRINGS_PAYLOAD_MAX);
    expect(code(() => readWordings(many))).toBe('texts-too-large');
  });

  it('refuses a submission that changes nothing', () => {
    expect(code(() => applyStrings(stringsPayload({ 'home.viewAll': 'Alle ansehen' }), REPO))).toBe(
      'texts-unchanged',
    );
  });

  it('leaves an unchanged entry alone beside a changed one, and says so', () => {
    const { applied } = written({
      'home.viewAll': 'Alle zeigen',
      'home.factChecks': 'Faktenchecks',
    });
    expect(applied.summary).toContain('Ein eingereichter Text stand schon so im Katalog');
    expect(applied.summary).not.toContain('`home.factChecks`');
  });
});

/**
 * A wording is written into TypeScript, so the first thing an attacker tries is to end the
 * literal. Each of these must come back through the compiler as exactly the text given,
 * in a file that still parses, and pass the proof the workflow runs.
 */
describe('a wording that tries to leave its literal', () => {
  const HOSTILE = [
    "'; process.exit(1); const x = '",
    '"; process.exit(1); const x = "',
    "Sie's \\'; process.exit(1); //",
    'Rückwärts\\',
    '`$` und `$(rm -rf /)` und `x`',
    '*/ } ; export const evil = 1; /*',
    '</script><!-- \' " ` -->',
  ];

  it.each(HOSTILE)('writes %j as text and nothing else', (wording) => {
    const { applied, after, changes } = written({ 'home.viewAll': wording });
    expect(wordingIn(applied.files, 'home.viewAll')).toBe(wording);
    for (const { content } of applied.files) expect(parses(content)).toBe(true);
    expect(
      verifyStrings(stringsPayload({ 'home.viewAll': wording }), changes, treeOf(after)),
    ).toEqual([]);
    harmless(applied.summary);
  });

  /*
   * `${name}` where the English has `{name}` is a valid ICU message, a dollar sign before
   * the placeholder, and passes the validator. It is harmless only because `literal()`
   * never writes a template literal: the dollar stays text inside quotes.
   */
  it('writes a dollar before a placeholder as text, and refuses a substitution nobody has', () => {
    const english = JSON.parse(MAIN.get(ENGLISH_EXTRACTION)!) as Record<
      string,
      { defaultMessage: string }
    >;
    // A message with exactly one simple placeholder, whatever it is called.
    const id = Object.keys(english).find((key) =>
      /^[^{}]*\{\w+\}[^{}]*$/.test(english[key]!.defaultMessage),
    )!;
    const name = /\{(\w+)\}/.exec(english[id]!.defaultMessage)![1]!;
    const wording = `\${${name}} Artikel`;
    const { applied, after, changes } = written({ [id]: wording });
    expect(wordingIn(applied.files, id)).toBe(wording);
    for (const { content } of applied.files) expect(content).not.toContain(`\`\${${name}`);
    expect(verifyStrings(stringsPayload({ [id]: wording }), changes, treeOf(after))).toEqual([]);
  });

  it('refuses a template substitution, which ICU reads as a placeholder nobody has', () => {
    for (const wording of ['`${process.exit(1)}`', '${globalThis}'])
      expect(code(() => applyStrings(stringsPayload({ 'home.viewAll': wording }), REPO))).toBe(
        'texts-refused',
      );
  });

  it('refuses a line separator, a control character and a direction mark, and names it', () => {
    const cases: [string, string][] = [
      [`Alle${String.fromCodePoint(0x2028)}ansehen`, 'U+2028'],
      [`Alle${String.fromCodePoint(0x2029)}ansehen`, 'U+2029'],
      ['Alle\nansehen', 'U+000A'],
      ['Alle\tansehen', 'U+0009'],
      [`Alle ${String.fromCodePoint(0x202e)}nehesna`, 'U+202E'],
      [`Alle${String.fromCodePoint(0x200b)} ansehen`, 'U+200B'],
      [`Alle ansehen${String.fromCharCode(0xd800)}`, 'U+D800'],
      // The Trojan Source isolates, and the C1 next line.
      ...[0x2066, 0x2067, 0x2068, 0x2069, 0x0085, 0x0080, 0x009f, 0x007f].map(
        (point) =>
          [
            `Alle${String.fromCodePoint(point)} ansehen`,
            `U+${point.toString(16).toUpperCase().padStart(4, '0')}`,
          ] as [string, string],
      ),
      // What the cold review of #263 got through the first version.
      ...[
        0x180e, 0x034f, 0xfe00, 0xfe0f, 0xe0100, 0xe01ef, 0xe0000, 0xe0041, 0xe007f, 0x115f, 0x1160,
        0x3164, 0xffa0, 0x2800, 0x206a, 0x206f, 0xfff9, 0xfffb, 0x1d173, 0x1d17a, 0xfdd0, 0xfdef,
        0xfffe, 0x1fffe, 0x10ffff, 0xe000, 0xf8ff, 0xf0000,
      ].map(
        (point) =>
          [
            `Alle${String.fromCodePoint(point)} ansehen`,
            `U+${point.toString(16).toUpperCase().padStart(4, '0')}`,
          ] as [string, string],
      ),
    ];
    for (const [wording, character] of cases) {
      const refusal = refused(() =>
        applyStrings(stringsPayload({ 'home.viewAll': wording }), REPO),
      );
      expect(refusal.code).toBe('texts-refused');
      expect(refusalText(refusal)).toContain(character);
    }
    // The soft hyphen is a translator's tool and passes.
    const soft = `Faktenchecks${String.fromCodePoint(0xad)}`;
    expect(wordingIn(written({ 'home.factChecks': soft }).applied.files, 'home.factChecks')).toBe(
      soft,
    );
  });

  it('passes every wording the catalogue ships, so a stricter rule refuses nobody’s work', () => {
    const english = JSON.parse(MAIN.get(ENGLISH_EXTRACTION)!) as Record<
      string,
      { defaultMessage: string }
    >;
    const refusedIds = Object.entries(appGerman)
      .filter(([id, wording]) => checkWording(english[id]!.defaultMessage, wording).length > 0)
      .map(([id]) => id);
    expect(Object.keys(appGerman).length).toBeGreaterThan(100);
    expect(refusedIds).toEqual([]);
  });

  it('refuses a wording that is blank once what cannot be seen is taken out', () => {
    for (const wording of [
      String.fromCodePoint(0x3164, 0x3164),
      String.fromCodePoint(0xad),
      ` ${String.fromCodePoint(0xad)} `,
    ]) {
      const refusal = refused(() =>
        applyStrings(stringsPayload({ 'home.viewAll': wording }), REPO),
      );
      expect(refusalText(refusal)).toContain('Das Deutsche ist leer.');
    }
  });

  it('refuses a placeholder that keeps its name and changes its kind', () => {
    const english = JSON.parse(MAIN.get(ENGLISH_EXTRACTION)!) as Record<
      string,
      { defaultMessage: string }
    >;
    const plural = Object.keys(english).find((key) =>
      /\{count, plural,/.test(english[key]!.defaultMessage),
    )!;
    const refusal = refused(() =>
      applyStrings(stringsPayload({ [plural]: '{count, date, short} Artikel' }), REPO),
    );
    expect(refusalText(refusal)).toContain('anders als das Englische: `{count}`');
    const plain = Object.keys(english).find((key) =>
      /^[^{}]*\{\w+\}[^{}]*$/.test(english[key]!.defaultMessage),
    )!;
    const name = /\{(\w+)\}/.exec(english[plain]!.defaultMessage)![1]!;
    expect(
      code(() => applyStrings(stringsPayload({ [plain]: `{${name}, number, percent}` }), REPO)),
    ).toBe('texts-refused');
  });

  it('refuses a wording over the length bound', () => {
    const refusal = refused(() =>
      applyStrings(stringsPayload({ 'home.viewAll': 'x'.repeat(WORDING_MAX + 1) }), REPO),
    );
    expect(refusal.code).toBe('texts-refused');
    expect(refusalText(refusal)).toContain(`länger als ${WORDING_MAX} Zeichen`);
  });
});

describe('an id the catalogue does not carry', () => {
  const UNKNOWN = [
    'home.invented',
    '__proto__',
    'constructor',
    'toString',
    'hasOwnProperty',
    '../../../etc/passwd',
    'home/../../../../.github/workflows/submission',
    `${GERMAN_CATALOGUE_DIR}/home.ts`,
    'packages/catalogue/src/de/index',
    'Closes #1 @correctiv/everyone',
  ];

  it.each(UNKNOWN)('refuses %j, and writes nothing else with it', (id) => {
    const payload = `{${JSON.stringify(id)}: "Neu", "home.viewAll": "Alle zeigen"}`;
    const refusal = refused(() => applyStrings(payload, REPO));
    expect(refusal.code).toBe('texts-refused');
    expect(refusal.items).toHaveLength(1);
    const text = refusalText(refusal);
    expect(text).toContain('Diese ID gibt es im Katalog nicht.');
    harmless(text);
  });

  it('refuses an id the German carries and the extraction does not', () => {
    // Cannot happen on `main`, where the catalogue test holds the two to each other; the
    // write still asks both, because the English is what the wording is checked against.
    const english = JSON.parse(MAIN.get(ENGLISH_EXTRACTION)!) as Record<string, unknown>;
    delete english['home.viewAll'];
    const files = new Map(MAIN);
    files.set(ENGLISH_EXTRACTION, JSON.stringify(english));
    expect(
      code(() => applyStrings(stringsPayload({ 'home.viewAll': 'Alle zeigen' }), repoOf(files))),
    ).toBe('texts-refused');
  });

  it('refuses the whole issue for one lost placeholder, and names it in braces', () => {
    const english = JSON.parse(MAIN.get(ENGLISH_EXTRACTION)!) as Record<
      string,
      { defaultMessage: string }
    >;
    const id = Object.keys(english).find((key) =>
      /\{count[,}]/.test(english[key]!.defaultMessage),
    )!;
    const refusal = refused(() =>
      applyStrings(
        stringsPayload({ [id]: 'ohne Platzhalter', 'home.viewAll': 'Alle zeigen' }),
        REPO,
      ),
    );
    expect(refusal.code).toBe('texts-refused');
    expect(refusalText(refusal)).toContain('fehlen: `{count}`');
    // A placeholder the English does not have is refused as well, and its name is quoted.
    const extra = refused(() =>
      applyStrings(stringsPayload({ 'home.viewAll': 'Alle {Fixes_1}' }), REPO),
    );
    expect(refusalText(extra)).toContain('`{Fixes_1}`');
  });

  it('lists at most twenty refused ids and says how many it left out', () => {
    const payload = JSON.stringify(
      Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`home.invented${i}`, 'Neu'])),
    );
    const text = refusalText(refused(() => applyStrings(payload, REPO)));
    expect(text.split('\n').filter((line) => line.startsWith('- '))).toHaveLength(21);
    expect(text).toContain('- … und 30 weitere.');
  });
});

/**
 * The proof the workflow runs before it commits. Each of these is a tree the write could
 * never produce; the point is that if a bug or an attacker ever produced one, the commit
 * would not happen.
 */
describe('the proof', () => {
  const WORDINGS = { 'home.viewAll': 'Alle zeigen' };
  const PAYLOAD = stringsPayload(WORDINGS);

  function tampered(edit: (text: string) => string, path = HOME) {
    const { after, changes } = written(WORDINGS);
    after.set(path, edit(after.get(path)!));
    return { after, changes };
  }

  it('passes the write as it is, and the write with its lines broken differently', () => {
    const { after, changes } = written(WORDINGS);
    expect(verifyStrings(PAYLOAD, changes, treeOf(after))).toEqual([]);
    const rewrapped = tampered((text) => text.replace("'home.viewAll': ", "'home.viewAll':\n    "));
    expect(verifyStrings(PAYLOAD, rewrapped.changes, treeOf(rewrapped.after))).toEqual([]);
  });

  it('fails a changed comment, a changed key, and another id’s wording', () => {
    const cases = [
      (text: string) => text.replace('German for the', 'Deutsch für die'),
      (text: string) => text.replace("'home.factChecks'", "'home.factCheckz'"),
      (text: string) => text.replace("'Faktenchecks'", "'Faktenprüfungen'"),
      (text: string) => text.replace("'Alle zeigen'", "'Alle zeigen!'"),
      (text: string) => text.replace("'Alle zeigen',", "'Alle zeigen', 'home.new': 'Neu',"),
      (text: string) => text.replace("  'home.factChecks': 'Faktenchecks',\n", ''),
      (text: string) => text.replace('Record<string, string>', 'any'),
      (text: string) => `${text}\nprocess.exit(1);\n`,
    ];
    for (const edit of cases) {
      const { after, changes } = tampered(edit);
      expect(verifyStrings(PAYLOAD, changes, treeOf(after)).length).toBeGreaterThan(0);
    }
  });

  it('fails a wording that is right but no longer a string literal', () => {
    const { after, changes } = tampered((text) =>
      text.replace("'Alle zeigen'", '`Alle ${"zeigen"}`'),
    );
    expect(verifyStrings(PAYLOAD, changes, treeOf(after)).length).toBeGreaterThan(0);
  });

  it('fails a file that changed and holds no submitted wording, and a file that should have', () => {
    const { after, changes } = written(WORDINGS);
    const ui = `${GERMAN_CATALOGUE_DIR}/ui.ts`;
    after.set(ui, `${after.get(ui)!}\n`);
    expect(
      verifyStrings(PAYLOAD, [...changes, { status: ' M', path: ui }], treeOf(after)),
    ).toContain(`${ui} changed and holds no submitted wording`);
    expect(verifyStrings(PAYLOAD, [], treeOf(after))).toEqual(['nothing changed']);
    expect(verifyStrings(stringsPayload({ 'ui.back': 'Zu' }), changes, treeOf(after))).toEqual(
      expect.arrayContaining([expect.stringContaining('did not change')]),
    );
  });

  it('holds every changed path to the allow-list', () => {
    const { after } = written(WORDINGS);
    const outside: Change[] = [
      { status: '??', path: `${GERMAN_CATALOGUE_DIR}/evil.ts` },
      { status: ' D', path: `${GERMAN_CATALOGUE_DIR}/ui.ts` },
      { status: 'A ', path: HOME },
      { status: 'R ', path: HOME },
      { status: ' M', path: `${GERMAN_CATALOGUE_DIR}/index.ts` },
      { status: ' M', path: 'packages/catalogue/src/en.json' },
      { status: ' M', path: '.github/workflows/submission.yml' },
      { status: ' M', path: `${GERMAN_CATALOGUE_DIR}/../en.json` },
      { status: ' M', path: `${GERMAN_CATALOGUE_DIR}/sub/home.ts` },
    ];
    for (const change of outside) {
      const problems = verifyStrings(
        PAYLOAD,
        [{ status: ' M', path: HOME }, change],
        treeOf(after),
      );
      expect(problems).toEqual([expect.stringContaining('is not a modified catalogue file')]);
      // The write's own check reads the path alone: a catalogue file's name, and nothing
      // outside the directory, the merge in index.ts included.
      expect(mayWrite('strings', change.path)).toBe(
        /^packages\/catalogue\/src\/de\/(evil|ui|home)\.ts$/.test(change.path),
      );
    }
  });

  it('lets each kind write its own files and nothing else', () => {
    expect(mayWrite('strings', HOME)).toBe(true);
    expect(mayWrite('strings', `${GERMAN_CATALOGUE_DIR}/index.ts`)).toBe(false);
    expect(mayWrite('strings', 'packages/catalogue/src/en.json')).toBe(false);
    expect(mayWrite('strings', `${GERMAN_CATALOGUE_DIR}/../../../../.github/workflows/x.yml`)).toBe(
      false,
    );
    expect(mayWrite('home', 'packages/app-core/src/data/home.layout.json')).toBe(true);
    expect(mayWrite('home', HOME)).toBe(false);
  });

  /*
   * The two uses of `mayWrite` outside a kind, which no real kind can reach, because every
   * kind writes only its own files. A kind that one day does not is what they are for, so
   * the test puts one in the table for the length of a call.
   */
  it('refuses a kind’s write and a kind’s proof that reach outside the kind', () => {
    const original = KINDS.strings!;
    const table = KINDS as Record<string, unknown>;
    try {
      table.strings = {
        apply: () => ({
          files: [{ path: '.github/workflows/x.yml', content: '' }],
          summary: '',
          format: false,
        }),
        verify: () => [],
      };
      const { title, body } = issueOf({ 'home.viewAll': 'Alle zeigen' });
      expect(() => applyIssue(title, body, REPO)).toThrow(/may not write/);
      const outside: Change[] = [{ status: ' M', path: '.github/workflows/x.yml' }];
      expect(verifyIssue(title, body, outside, treeOf(MAIN)).problems).toEqual([
        'the strings kind may not change .github/workflows/x.yml',
      ]);
    } finally {
      table.strings = original;
    }
  });

  it('fails when main itself holds an id twice', () => {
    const { after, changes } = written(WORDINGS);
    const ui = `${GERMAN_CATALOGUE_DIR}/ui.ts`;
    const doubled = new Map(MAIN);
    doubled.set(
      ui,
      MAIN.get(ui)!.replace("'ui.back':", "'home.viewAll': 'Doppelt',\n  'ui.back':"),
    );
    const tree: Tree = { ...treeOf(after), before: (path) => doubled.get(path)! };
    expect(verifyStrings(PAYLOAD, changes, tree)).toContain(
      'home.viewAll is not one wording on main',
    );
  });

  it('reads the scanner rather than the parser, and says what it found', () => {
    const before = "export const x = {\n  // why\n  'x.a': 'A',\n  'x.b': 'B',\n};\n";
    const wanted = new Map([['x.a', 'Neu']]);
    expect(onlyWordingsChanged(before, before.replace("'A'", "'Neu'"), wanted)).toEqual([]);
    expect(onlyWordingsChanged(before, before.replace('why', 'what'), wanted)).toEqual(
      expect.arrayContaining([expect.stringContaining('is not a wording')]),
    );
    expect(onlyWordingsChanged(before, before.replace("'B'", "'Neu'"), wanted)).toEqual(
      expect.arrayContaining(['x.b changed and was not submitted', 'x.a did not change']),
    );
    expect(
      onlyWordingsChanged(before, before.replace("'A'", "'Neu"), wanted).length,
    ).toBeGreaterThan(0);
  });

  it('reads the home kind as one file, modified, and nothing else', () => {
    const home = 'packages/app-core/src/data/home.layout.json';
    const title = '[startseite] x';
    const body = issueFor('home', '{}', { heading: 'x', lead: 'x' }).body;
    const tree = treeOf(new Map());
    expect(verifyIssue(title, body, [{ status: ' M', path: home }], tree).problems).toEqual([]);
    for (const changes of [
      [],
      [{ status: '??', path: home }],
      [
        { status: ' M', path: home },
        { status: ' M', path: HOME },
      ],
    ])
      expect(verifyIssue(title, body, changes, tree).problems.length).toBeGreaterThan(0);
  });

  it('reads git’s porcelain without quoting, and drops a rename’s old path', () => {
    expect(parsePorcelain(' M a b.ts\0?? c\nd\0R  new\0old\0')).toEqual([
      { status: ' M', path: 'a b.ts' },
      { status: '??', path: 'c\nd' },
      { status: 'R ', path: 'new' },
    ]);
  });
});

/**
 * The workflow's three calls in a row, against a git repository holding a copy of the
 * catalogue: the write, the repository's own formatter, and the proof reading git's own
 * status and `HEAD`. This is the part a unit test above cannot show, that the formatter
 * moves nothing the proof would refuse.
 */
describe('the whole path, in a throwaway repository', () => {
  let root: string;
  /*
   * A git that can see no repository but the throwaway one, whoever runs this suite.
   *
   * The pre-push hook runs `npm run check` with `GIT_DIR` set to this repository's. The
   * first version of this test ran `git init` and `git add .` under it: the add staged the
   * copy over this repository's own index, and a `git init` with `GIT_DIR` pointing at a
   * linked worktree's directory reinitialises the repository behind it as bare, which set
   * `core.bare = true` in the configuration every worktree of this machine shares, measured
   * on 2026-09-24. So: every `GIT_*` variable is dropped, no system or global
   * configuration is read, discovery stops at the temporary directory's parent, hooks are
   * off, the repository is created at an explicit path, and before anything is written
   * the test asks git where the repository it would use is and stops unless the answer is
   * inside the temporary directory.
   */
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith('GIT_')) delete env[key];
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
      env: {
        ...env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CEILING_DIRECTORIES: dirname(root),
      },
    });
  const inside = (path: string) => {
    const real = realpathSync(path);
    const base = realpathSync(root);
    return real === base || real.startsWith(`${base}/`);
  };

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'strings-submission-'));
    // Before the first write: no repository may be visible from here at all.
    let visible: string | null = null;
    try {
      visible = git('rev-parse', '--absolute-git-dir').trim();
    } catch {
      visible = null;
    }
    if (visible !== null) throw new Error(`git sees a repository from the temp dir: ${visible}`);
    mkdirSync(join(root, dirname(ENGLISH_EXTRACTION)), { recursive: true });
    cpSync(join(ROOT, GERMAN_CATALOGUE_DIR), join(root, GERMAN_CATALOGUE_DIR), { recursive: true });
    cpSync(join(ROOT, ENGLISH_EXTRACTION), join(root, ENGLISH_EXTRACTION));
    cpSync(join(ROOT, '.oxfmtrc.json'), join(root, '.oxfmtrc.json'));
    git('init', '-q', '--initial-branch=main', root);
    // Nothing below may touch any repository but the throwaway one.
    for (const asked of ['--show-toplevel', '--absolute-git-dir', '--git-common-dir']) {
      const answer = git('rev-parse', asked).trim();
      if (
        !inside(join(root, answer.startsWith('/') ? '' : '.')) ||
        !inside(answer.startsWith('/') ? answer : join(root, answer))
      )
        throw new Error(`git rev-parse ${asked} is outside the throwaway directory: ${answer}`);
    }
    git('add', '.');
    git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-qm', 'main');
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('writes, formats and proves a long wording across two files', () => {
    const wordings = {
      'home.viewAll':
        'Alle ansehen, und zwar wirklich alle, auch die, die schon etwas älter sind und die man leicht übersieht',
      'ui.back': "Schließen, wenn's sein muss",
    };
    const { title, body } = issueOf(wordings);
    const repo: Repo = {
      read: (path) => readFileSync(join(root, path), 'utf8'),
      list: (dir) => readdirSync(join(root, dir)),
    };
    const applied = applyIssue(title, body, repo);
    for (const { path, content } of applied.files) writeFileSync(join(root, path), content);
    execFileSync(
      join(ROOT, 'node_modules/.bin/oxfmt'),
      applied.files.map((file) => file.path),
      { cwd: root, stdio: 'pipe' },
    );

    const changes = parsePorcelain(git('status', '--porcelain=v1', '-z', '--untracked-files=all'));
    const proven = verifyIssue(title, body, changes, {
      before: (path) => git('show', `HEAD:${path}`),
      after: repo.read,
      list: repo.list,
    });
    expect(proven.problems).toEqual([]);
    expect(proven.files).toEqual([HOME, `${GERMAN_CATALOGUE_DIR}/ui.ts`]);
    // The formatter did break the long line, which is what the proof let through.
    expect(git('diff', '--', HOME)).toMatch(/\+\s{2}'home\.viewAll':\n\+\s{4}'Alle ansehen, und/);
    execFileSync(join(ROOT, 'node_modules/.bin/oxfmt'), ['--check', ...proven.files], {
      cwd: root,
      stdio: 'pipe',
    });
  });
});
