/**
 * The strings kind of a submission: an issue's `[texte]` block into the German catalogue.
 *
 * [ADR 0062](../../../adr/0062-the-texts-submission-may-change-wordings-and-nothing-else.md),
 * the kind [ADR 0061](../../../adr/0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md)
 * §3 named. Everything here is the dev server's save made again, on purpose: the same
 * shape check (`isWordings`), the same validator (`checkWording`, through `applyWordings`),
 * the same write through the syntax tree (`applyWordings` in `plugin/catalogue.ts`) and
 * the same German for a refusal (`src/preview/strings/problems.ts`). What is added is only
 * what a public issue needs and a developer's own checkout does not: a bound on the
 * payload, sentences for the issue, a summary for the pull request, and the proof the
 * workflow runs over the files before it commits them (`verifyStrings`).
 *
 * **The issue's text is untrusted**, as `./submission.ts` says for every kind, and here
 * it names ids as well as wordings. An id is only ever a key looked up in two tables the
 * repository wrote, the extraction and the catalogue's own literals, and never a path, so
 * `../../etc/passwd` and `__proto__` are both simply ids nobody has. Every id and wording
 * that is printed on GitHub goes through `shown`.
 */
import { createIntl, type IntlShape } from 'react-intl';
import ts from 'typescript';

import {
  applyWordings,
  CATALOGUE_FILE,
  catalogueFiles,
  indexWordings,
  onlyWordingsChanged,
} from '../plugin/catalogue.ts';
import { de } from '../src/i18n/catalogue/de/index.ts';
import { ENGLISH_EXTRACTION, GERMAN_CATALOGUE_DIR } from '../src/preview/strings/names.ts';
import { problemText } from '../src/preview/strings/problems.ts';
import { isWordings } from '../src/preview/strings/validate.ts';
import { bulleted, Refusal, shown } from './submission.ts';

/** What a kind reads of the repository: a file's text, and a directory's names. */
export interface Repo {
  read(path: string): string;
  list(dir: string): string[];
}

/**
 * The largest block taken, in characters: 64 KiB, the bound the dev server's save puts on
 * its body (`plugin/home-layout.ts`), which is the same payload arriving another way.
 * GitHub caps an issue body at 65,536 characters, so a whole catalogue's worth of
 * rewording, some 30,000 characters of German, fits under both.
 */
export const STRINGS_PAYLOAD_MAX = 64 * 1024;

/** The site's German, for the same refusal sentences the tool shows under the field. */
const INTL: IntlShape = createIntl({ locale: 'de', defaultLocale: 'en', messages: de });

/** How long a wording may be when it is quoted back on GitHub. */
const QUOTED_MAX = 300;

/**
 * The block as id to German, or a `Refusal`.
 *
 * The same shape the dev server takes (`isWordings`), with at least one entry. Nothing
 * about the ids or the wordings is decided here; `applyWordings` decides both, for every
 * entry, and refuses the whole block if it refuses one.
 */
export function readWordings(payload: string): Record<string, string> {
  if (payload.length > STRINGS_PAYLOAD_MAX)
    throw new Refusal(
      'texts-too-large',
      `${payload.length} Zeichen, höchstens ${STRINGS_PAYLOAD_MAX}`,
    );
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch (error) {
    throw new Refusal('not-json', error instanceof Error ? error.message : String(error));
  }
  if (!isWordings(value) || Object.keys(value).length === 0) throw new Refusal('not-wordings');
  const twice = duplicateKeys(payload);
  if (twice.length > 0)
    throw new Refusal(
      'duplicate-ids',
      '',
      twice.map((id) => shown(id)),
    );
  return value;
}

/**
 * The keys a JSON object names more than once. `JSON.parse` keeps the last and says
 * nothing, so a block could show a reviewer one wording for an id and apply another
 * further down. The workbench never writes an id twice (ADR 0062 §5). Read with the
 * TypeScript compiler's JSON parser, which keeps every property it sees, and decoded,
 * so `"home.viewAll"` and its escaped spelling are the same key.
 */
export function duplicateKeys(payload: string): string[] {
  const file = ts.parseJsonText('payload.json', payload);
  const root = file.statements[0]?.expression;
  if (!root || !ts.isObjectLiteralExpression(root)) return [];
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const property of root.properties) {
    const name = property.name;
    if (!name || !(ts.isStringLiteral(name) || ts.isIdentifier(name))) continue;
    if (seen.has(name.text)) twice.add(name.text);
    seen.add(name.text);
  }
  return [...twice].sort();
}

/** Every catalogue file, by path, as the repository holds it. */
function catalogue(repo: Repo): Map<string, string> {
  return new Map(
    catalogueFiles(repo.list(GERMAN_CATALOGUE_DIR)).map((path) => [path, repo.read(path)]),
  );
}

export interface AppliedStrings {
  files: { path: string; content: string }[];
  summary: string;
}

/**
 * The strings kind's write: every file an id's wording lives in, with that literal
 * replaced and nothing else, or a `Refusal` naming every id that stopped it.
 *
 * The files are not formatted here; the workflow formats them with the repository's own
 * oxfmt, as the dev server does after its save, and then proves that the formatter moved
 * nothing but whitespace (`verifyStrings`).
 */
export function applyStrings(payload: string, repo: Repo): AppliedStrings {
  const wordings = readWordings(payload);
  const english = JSON.parse(repo.read(ENGLISH_EXTRACTION)) as Record<
    string,
    { defaultMessage?: string }
  >;
  const sources = catalogue(repo);
  const { written, refused, unchanged } = applyWordings(wordings, english, sources);
  if (refused.length > 0)
    throw new Refusal(
      'texts-refused',
      '',
      refused.map(
        ({ id, problems }) =>
          `${shown(id)}: ${problems
            .map((problem) =>
              problemText(
                (message, values) => INTL.formatMessage(message, values),
                problem,
                (text) => shown(text, 120),
              ),
            )
            .join(' ')}`,
      ),
    );
  if (written.size === 0) throw new Refusal('texts-unchanged');
  return {
    files: [...written].map(([path, content]) => ({ path, content })).sort(byPath),
    summary: summariseStrings(wordings, sources, unchanged),
  };
}

function byPath(a: { path: string }, b: { path: string }): number {
  return a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
}

/**
 * What changes, one line per id, for the pull request's body.
 *
 * Read from the catalogue as it stands and the wordings as they were submitted, never from
 * the issue's prose. Every id and wording is printed through `shown`, which collapses
 * whitespace and swaps the characters GitHub acts on for look-alikes, so the line is a
 * picture of the wording and the diff is the wording itself; the summary says so.
 */
export function summariseStrings(
  wordings: Readonly<Record<string, string>>,
  sources: ReadonlyMap<string, string>,
  unchanged: readonly string[],
): string {
  const before = new Map<string, { path: string; text: string }>();
  for (const [path, source] of sources)
    for (const [id, found] of indexWordings(source, path))
      before.set(id, { path, text: found[0]!.text });

  const skipped = new Set(unchanged);
  const lines = Object.keys(wordings)
    .filter((id) => !skipped.has(id))
    .sort()
    .map((id) => {
      const was = before.get(id)!;
      const file = was.path.slice(GERMAN_CATALOGUE_DIR.length + 1);
      return `${shown(id)} in ${shown(file)}: aus ${shown(was.text, QUOTED_MAX)} wird ${shown(wordings[id]!, QUOTED_MAX)}.`;
    });
  const notes = [
    'Es ändern sich nur deutsche Wortlaute von IDs, die der Katalog schon hat. Keine ID kommt hinzu, keine entfällt, kein Kommentar und kein englischer Text ändert sich.',
    'In den Zeilen unten sind Zeilenumbrüche und die Zeichen, auf die GitHub reagiert, zur Anzeige ersetzt. Maßgeblich ist der Diff.',
    ...(skipped.size > 0
      ? [
          `${skipped.size === 1 ? 'Ein eingereichter Text stand' : `${skipped.size} eingereichte Texte standen`} schon so im Katalog und ${skipped.size === 1 ? 'bleibt' : 'bleiben'}, wie ${skipped.size === 1 ? 'er ist' : 'sie sind'}.`,
        ]
      : []),
  ];
  return ['### Was sich an den Texten ändert', '', ...notes, '', ...bulleted(lines)].join('\n');
}

/** One line of `git status --porcelain=v1 -z`: its two status letters and its path. */
export interface Change {
  status: string;
  path: string;
}

/** What the proof reads: a file as `main` has it, as the run left it, and a listing. */
export interface Tree {
  before(path: string): string;
  after(path: string): string;
  list(dir: string): string[];
}

/**
 * Whether the working tree holds exactly the submitted wordings and nothing else: the list
 * of what is wrong, empty when it is proven. ADR 0062 §3.
 *
 * Run by the workflow after the write and the formatter, and before the commit. It reads
 * the issue again rather than trusting what the write reported, and it holds the tree to
 * three things. Every changed path is a modified catalogue file (`CATALOGUE_FILE`): not
 * added, not deleted, not renamed, not anywhere else. The changed files are exactly the
 * files that hold an id whose wording the issue changes. And each of those files differs
 * from `main` only in those ids' literals, each now saying what the issue says, which is
 * `onlyWordingsChanged`, read with the scanner rather than the parser the write used.
 *
 * A failure here is never the person's: their submission passed the write's validation.
 * It is the automation disagreeing with itself, so the workflow says so on the issue
 * instead of asking the person to fix something.
 */
export function verifyStrings(payload: string, changes: readonly Change[], tree: Tree): string[] {
  const problems: string[] = [];
  for (const { status, path } of changes)
    if (status !== ' M' || !CATALOGUE_FILE.test(path))
      problems.push(
        `${JSON.stringify(status)} ${JSON.stringify(path)} is not a modified catalogue file`,
      );
  if (changes.length === 0) problems.push('nothing changed');
  if (problems.length > 0) return problems;

  let wordings: Record<string, string>;
  try {
    wordings = readWordings(payload);
  } catch (error) {
    return [`the issue does not read as it did for the write: ${String(error)}`];
  }

  const where = new Map<string, { path: string; text: string }>();
  for (const path of catalogueFiles(tree.list(GERMAN_CATALOGUE_DIR)))
    for (const [id, found] of indexWordings(tree.before(path), path)) {
      if (found.length !== 1 || where.has(id)) problems.push(`${id} is not one wording on main`);
      where.set(id, { path, text: found[0]!.text });
    }

  const expected = new Map<string, Map<string, string>>();
  for (const [id, wording] of Object.entries(wordings)) {
    const place = where.get(id);
    if (!place) {
      problems.push(`${JSON.stringify(id)} is not in the catalogue on main`);
      continue;
    }
    if (place.text === wording) continue;
    const ids = expected.get(place.path) ?? new Map<string, string>();
    ids.set(id, wording);
    expected.set(place.path, ids);
  }

  const changed = new Set(changes.map((change) => change.path));
  for (const path of changed)
    if (!expected.has(path)) problems.push(`${path} changed and holds no submitted wording`);
  for (const path of expected.keys())
    if (!changed.has(path)) problems.push(`${path} holds a submitted wording and did not change`);
  for (const [path, ids] of expected)
    if (changed.has(path))
      problems.push(
        ...onlyWordingsChanged(tree.before(path), tree.after(path), ids).map(
          (problem) => `${path}: ${problem}`,
        ),
      );
  return problems;
}
