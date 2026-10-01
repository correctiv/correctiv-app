import ts from 'typescript';

import { GERMAN_CATALOGUE_DIR } from '../src/preview/strings/names.ts';
import { checkWording, type WordingProblem } from '../src/preview/strings/validate.ts';

/**
 * One wording in a German catalogue file, replaced where it stands.
 *
 * [ADR 0056](../../../adr/0056-a-string-is-picked-where-it-renders.md) §8. A file in
 * `packages/catalogue/src/de/` is TypeScript with comments in it, and those comments are
 * the reasons somebody left for the next translator, so the file is never reprinted:
 * the id's string literal is found in the syntax tree and only the characters of that
 * literal are replaced. Everything else in the file, the comments included, stays byte
 * for byte.
 *
 * Node-only, because the compiler is. Here in the workbench and not in
 * `packages/prose-and-code`, which owns reading this repository as text and holds no
 * writes; the ADR says the same. The strings submission (ADR 0061 §3, built by ADR 0062)
 * is the second caller, from `scripts/submission-strings.ts`, and the proof at the end of
 * this file is what its workflow checks the written files with.
 */

/**
 * A German catalogue file, repository-relative: one flat name in `GERMAN_CATALOGUE_DIR`,
 * letters and digits and `.ts`. `index.ts` is the merge and holds no wording.
 *
 * This is the allow-list the submission workflow holds a changed path to (ADR 0062 §2),
 * and the same test decides which files a write reads at all, so a file the workflow
 * would refuse to commit is never a place a wording is looked for.
 */
export const CATALOGUE_FILE = new RegExp(
  `^${GERMAN_CATALOGUE_DIR.replaceAll('/', '\\/')}\\/(?!index\\.ts$)[A-Za-z][A-Za-z0-9]*\\.ts$`,
);

/** The catalogue files among a directory listing of `GERMAN_CATALOGUE_DIR`. */
export function catalogueFiles(names: readonly string[]): string[] {
  return names
    .map((name) => `${GERMAN_CATALOGUE_DIR}/${name}`)
    .filter((path) => CATALOGUE_FILE.test(path))
    .sort();
}

export interface Located {
  /** Offset of the literal's first quote. */
  start: number;
  /** Offset just past its last quote. */
  end: number;
  /** What the literal says. */
  text: string;
}

function keyText(name: ts.PropertyName): string | null {
  if (ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
  if (ts.isIdentifier(name)) return name.text;
  return null;
}

/**
 * The literal holding `id`'s wording, or null where the file has none.
 *
 * A property whose key is the id and whose value is a plain string: `'home.viewAll':
 * 'Alle ansehen'`. A value that is anything else, a template with a substitution or an
 * expression, is not a wording this can replace, and answers null rather than guessing.
 */
export function findWording(source: string, id: string, path = 'catalogue.ts'): Located | null {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  let found: Located | null = null;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isPropertyAssignment(node) && keyText(node.name) === id) {
      const value = node.initializer;
      if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) {
        found = { start: value.getStart(file), end: value.getEnd(), text: value.text };
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/**
 * A string literal spelled the way the formatter spells one.
 *
 * Single quotes, which `.oxfmtrc` asks for, and double quotes where the text holds an
 * apostrophe and no double quote, which is what oxfmt itself prints then. So a German
 * `Sie’s` with a typographic apostrophe stays in single quotes, and a straight one moves
 * the literal to double quotes rather than growing an escape.
 */
export function literal(text: string): string {
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  const escaped = text
    .replaceAll('\\', '\\\\')
    .replaceAll(quote, `\\${quote}`)
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
  return `${quote}${escaped}${quote}`;
}

/** The file with `id`'s wording replaced, or null where the file holds no such wording. */
export function replaceWording(source: string, id: string, wording: string): string | null {
  const at = findWording(source, id);
  if (!at) return null;
  return source.slice(0, at.start) + literal(wording) + source.slice(at.end);
}

/**
 * Every wording a catalogue file carries, by id, parsed once.
 *
 * The same reading as `findWording`, for every property at once: a key that is a string
 * or an identifier, and a value that is a plain string literal. A value that is anything
 * else is not a wording and is not listed. An id listed twice is kept twice, so a caller
 * can refuse rather than pick one; `tsc` refuses a duplicate key in one object literal and
 * `packages/catalogue/test/catalogue.test.ts` keeps each id in its namespace's file, so on
 * `main` every list has one entry.
 *
 * `applyWordings` reads this once per file rather than calling `findWording` once per id
 * and file. The submission workflow hands it whatever an issue carried, and a payload of
 * thousands of invented ids would otherwise parse every file thousands of times.
 */
export function indexWordings(source: string, path = 'catalogue.ts'): Map<string, Located[]> {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const index = new Map<string, Located[]>();
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node)) {
      const id = keyText(node.name);
      const value = node.initializer;
      if (id !== null && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value))) {
        const at = { start: value.getStart(file), end: value.getEnd(), text: value.text };
        index.set(id, [...(index.get(id) ?? []), at]);
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return index;
}

/** Why one id of a set of wordings was not written. */
export interface RefusedWording {
  id: string;
  problems: (WordingProblem | { code: 'unknown-id' })[];
}

export interface AppliedWordings {
  /** Path to its new text, only for files whose text changed, and empty on any refusal. */
  written: Map<string, string>;
  /** Every id that stopped the write, with every reason. */
  refused: RefusedWording[];
  /** Ids whose wording is already what the catalogue says, and were left alone. */
  unchanged: string[];
}

/**
 * The files a set of wordings produces, or the refusals that stop them.
 *
 * The one write both callers make: the dev server's save (`./strings.ts`) and the
 * submission workflow's strings kind (`../scripts/submission-strings.ts`, ADR 0062).
 * **All or nothing**: an id the German catalogue does not carry, which is ADR 0056 §7's
 * limit, or a wording `checkWording` refuses, and `written` is empty.
 *
 * An id is known when the extraction has it as an OWN key and exactly one catalogue file
 * holds a literal for it. Own, because the payload is JSON anybody can write and
 * `english['__proto__']` or `english['constructor']` is not a message; the lookup below
 * never reads through the prototype. More than one literal for an id cannot happen on
 * `main` (see `indexWordings`) and is thrown as the automation's fault rather than
 * refused as the person's.
 *
 * Replacements are made per file from the last offset to the first, so an earlier
 * literal's new length does not move a later one's.
 */
export function applyWordings(
  wordings: Readonly<Record<string, string>>,
  english: Readonly<Record<string, { defaultMessage?: string }>>,
  sources: ReadonlyMap<string, string>,
): AppliedWordings {
  const where = new Map<string, { path: string; at: Located }>();
  for (const [path, source] of sources) {
    for (const [id, found] of indexWordings(source, path)) {
      if (found.length > 1 || where.has(id))
        throw new Error(`${id} has more than one wording in the catalogue`);
      where.set(id, { path, at: found[0]! });
    }
  }

  const refused: RefusedWording[] = [];
  const unchanged: string[] = [];
  const edits = new Map<string, { at: Located; wording: string }[]>();
  for (const [id, wording] of Object.entries(wordings)) {
    const place = where.get(id);
    const source = Object.hasOwn(english, id) ? english[id]!.defaultMessage : undefined;
    if (place === undefined || typeof source !== 'string') {
      refused.push({ id, problems: [{ code: 'unknown-id' }] });
      continue;
    }
    const problems = checkWording(source, wording);
    if (problems.length > 0) {
      refused.push({ id, problems });
      continue;
    }
    if (place.at.text === wording) {
      unchanged.push(id);
      continue;
    }
    edits.set(place.path, [...(edits.get(place.path) ?? []), { at: place.at, wording }]);
  }

  const written = new Map<string, string>();
  if (refused.length > 0) return { written, refused, unchanged };
  for (const [path, list] of edits) {
    let text = sources.get(path)!;
    for (const { at, wording } of [...list].sort((a, b) => b.at.start - a.at.start))
      text = text.slice(0, at.start) + literal(wording) + text.slice(at.end);
    written.set(path, text);
  }
  return { written, refused, unchanged };
}

// --- the proof ----------------------------------------------------------------------

interface Token {
  kind: ts.SyntaxKind;
  /** The token as written, comments included. */
  text: string;
  /** What a string literal says, which is what is compared for one that changed. */
  value: string;
  unterminated: boolean;
}

/**
 * A file as the scanner reads it, without the whitespace and line breaks between tokens.
 *
 * Comments are kept, as tokens of their own, because they are the reasons left for the
 * next translator and a submission may not touch them. Whitespace is dropped because the
 * formatter decides it: a longer wording moves to a line of its own.
 */
function tokens(source: string): Token[] {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    source,
  );
  const out: Token[] = [];
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    if (kind === ts.SyntaxKind.WhitespaceTrivia || kind === ts.SyntaxKind.NewLineTrivia) continue;
    out.push({
      kind,
      text: scanner.getTokenText(),
      value: scanner.getTokenValue(),
      unterminated: scanner.isUnterminated(),
    });
  }
  return out;
}

const STRING: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.StringLiteral,
  ts.SyntaxKind.NoSubstitutionTemplateLiteral,
]);

/**
 * Whether `after` is `before` with exactly the wordings in `expected` replaced, and
 * nothing else: the list of what is wrong, empty when it is proven.
 *
 * The workflow's last word before the commit (ADR 0062 §3), and deliberately not built on
 * `applyWordings` or `indexWordings`: it reads the two files token by token with the
 * scanner, a different reader from the parser the write used, so a mistake in the write
 * is not repeated in its proof. Whitespace is free, since the formatter owns it. Every
 * other token, every comment and every key must be the same text in the same order, and
 * a token that differs must be a string literal standing as a property's value,
 * `'<id>': <here>`, whose id is in `expected` and which now says exactly what `expected`
 * says for it. Every id in `expected` has to have changed, and the file has to parse
 * with no syntax error. The unterminated check and the parse are a second net under the
 * token count, which already fails a literal that swallowed what followed it.
 */
export function onlyWordingsChanged(
  before: string,
  after: string,
  expected: ReadonlyMap<string, string>,
): string[] {
  const old = tokens(before);
  const now = tokens(after);
  if (old.length !== now.length)
    return [`the file has ${now.length} tokens where it had ${old.length}`];

  const problems: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < now.length; i++) {
    const was = old[i]!;
    const is = now[i]!;
    if (was.kind === is.kind && was.text === is.text) continue;
    const key = old[i - 2];
    const isValue =
      STRING.has(was.kind) &&
      STRING.has(is.kind) &&
      !is.unterminated &&
      old[i - 1]?.kind === ts.SyntaxKind.ColonToken &&
      now[i - 1]?.kind === ts.SyntaxKind.ColonToken &&
      key !== undefined &&
      STRING.has(key.kind) &&
      key.text === now[i - 2]?.text;
    if (!isValue) {
      problems.push(
        `token ${i} changed and is not a wording: ${JSON.stringify(is.text.slice(0, 40))}`,
      );
      continue;
    }
    const id = key.value;
    if (!expected.has(id)) problems.push(`${id} changed and was not submitted`);
    else if (expected.get(id) !== is.value) problems.push(`${id} does not say what was submitted`);
    else if (seen.has(id)) problems.push(`${id} changed twice`);
    seen.add(id);
  }
  for (const id of expected.keys()) if (!seen.has(id)) problems.push(`${id} did not change`);

  const { diagnostics = [] } = ts.transpileModule(after, { reportDiagnostics: true });
  if (diagnostics.length > 0)
    problems.push(`the file no longer parses: ${diagnostics.length} errors`);
  return problems;
}
