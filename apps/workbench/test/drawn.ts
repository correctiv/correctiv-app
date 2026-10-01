import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import ts from 'typescript';

import { filesUnder } from './source.ts';

import { ROOT } from '../plugin/collect.ts';

/**
 * How the drawings are read, in one place.
 *
 * This used to live inside `diagrams.test.ts`, which was the only file asking. It
 * is here because three files ask now, and the reading rule is the part that must
 * not differ between them: `drawnText` below is a *narrower* claim than reading a
 * source file, deliberately, and a second copy of it that quietly widened would
 * leave one drawing checked against its picture and another against the sentence
 * describing the picture. The doc comments came with the functions.
 *
 * Nothing here is a test, so vitest does not collect it.
 */

export const DIAGRAMS = join(ROOT, 'apps/workbench/src/diagrams');
export const CORE = join(ROOT, 'packages/app-core/src');

/** Every source of the drawings, so a new one is checked without being listed. */
export function diagramSources(): { name: string; text: string }[] {
  return readdirSync(DIAGRAMS)
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => ({ name, text: readFileSync(join(DIAGRAMS, name), 'utf8') }));
}

/**
 * What a drawing DRAWS, which is the text inside its `<svg>` and nothing else.
 *
 * This used to be `text.includes(name)` over the whole file, and that is a weaker
 * claim than the test's name makes: every one of these files carries a caption and
 * a description list naming each port in prose, so a port could be written into
 * the list beneath a drawing that still drew four, and the check would pass on the
 * strength of the sentence describing the picture rather than the picture. Only
 * the `<svg>` is the drawing, and inside it only the text nodes: an id, a class or
 * a path is not something a reader sees.
 *
 * `{…}` is excluded along with `<…>` so that a JSX expression, and with it every
 * `{/* … *\/}` comment inside the drawing, is not read as drawn text.
 *
 * **What follows from that, for a drawing built out of an array.** A label written
 * as `{row.call}` is a JSX expression and is invisible here, correctly: this
 * function reads the file, not the render. A drawing with labels in an array
 * exports the array and is checked against it directly, which is the stronger
 * reading of the two and the reason `ArticlePath.tsx` exports `RUNGS`. The same
 * follows for a label that has become a message descriptor, and that is why three
 * of the drawings are still English: see `test/rendered-literals.test.ts`'s table.
 *
 * **Do not write the opening tag of an `svg` element in a comment in one of these
 * files.** The match above starts at the first one in the file and runs to the
 * first closing tag after it, so a docblock mentioning the element by name puts
 * its own prose inside the drawing. Found by `pathsDrawn` reporting two test files
 * as paths a drawing names and cannot find.
 */
export function drawnText(name: string): string {
  const source = readFileSync(join(DIAGRAMS, name), 'utf8');
  const svg = [...source.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((match) => match[0]).join('\n');
  if (svg === '') throw new Error(`${name} holds no <svg>, so nothing in it is a drawing`);
  return [...svg.matchAll(/>([^<>{}]+)</g)].map((match) => match[1]).join(' / ');
}

/**
 * How a drawing spells a small number, since a picture writes words not digits.
 *
 * Three copies of this array existed, two of them in one file, and the pair of
 * checks that read it read it in opposite directions: one asks what a count should
 * look like, the other what a word the drawing wrote is worth. Both directions off
 * one array, because two arrays that disagree would make a drawing right and wrong
 * at once. The array is `@correctiv/prose-and-code`'s now, where the check that
 * compares a spelled figure with a counted one also lives, and it is re-exported
 * here so that the drawings' own vocabulary stays one import.
 */
export { NUMBER_WORDS, spelledNumber } from '@correctiv/prose-and-code';

export function drawn(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(text);
}

/** The same question without caring how a sentence capitalised its first word. */
export function says(text: string, phrase: string): boolean {
  return new RegExp(`\\b${phrase}\\b`, 'i').test(text);
}

/**
 * Every repository path a drawing prints, as a reader would read one.
 *
 * A path in a drawing is a promise that a file is there, and it is the promise
 * most likely to be quietly broken: a file moves in one pull request and the
 * picture naming it is in another directory entirely. The pattern is deliberately
 * narrow — a slash and a TypeScript extension — because a prose phrase with a
 * slash in it is not a path and a rule that thought it was would fail on the
 * first sentence saying "and/or".
 *
 * A `*` stands for the glob a drawing is entitled to print when two files differ
 * by one word; it is expanded against the directory rather than believed.
 */
export function pathsNamedIn(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\b[\w.-]+(?:\/[\w.*-]+)+\.(?:tsx?|mts|mjs)\b/g)) {
    found.add(match[0]);
  }
  return [...found];
}

/**
 * Every path a drawing prints, and the ones with nothing behind them.
 *
 * Two drawings asked this in the same eight lines, the comment included. The
 * caller asserts that the list is not empty as well as that nothing is missing,
 * because a pattern that stopped matching would pass on an empty list and the
 * check would be green about a drawing it never read.
 */
export function pathsDrawn(text: string): { named: string[]; missing: string[] } {
  const named = pathsNamedIn(text);
  return { named, missing: named.filter((path) => !pathExists(path)) };
}

/**
 * Whether a path a drawing printed answers to a file, `*` expanded.
 *
 * Relative to the repository root, and to `apps/mobile/src` and
 * `packages/app-core/src` as well, because the drawings shorten a path to the
 * part that identifies it: `lib/platform/expo.ts` is how the first drawing has
 * always written it, and lengthening every one of them to satisfy a test would be
 * the test deciding how the pictures read.
 */
export function pathExists(path: string): boolean {
  const bases = [ROOT, join(ROOT, 'apps/mobile/src'), CORE];
  for (const base of bases) {
    if (!path.includes('*')) {
      if (existsSync(join(base, path))) return true;
      continue;
    }
    const at = path.lastIndexOf('/');
    const dir = join(base, path.slice(0, at));
    if (!existsSync(dir)) continue;
    const pattern = new RegExp(
      `^${path
        .slice(at + 1)
        .replaceAll('.', '\\.')
        .replaceAll('*', '.*')}$`,
    );
    if (readdirSync(dir).some((entry) => pattern.test(entry))) return true;
  }
  return false;
}

// --- reading the code the drawings are about ------------------------------------

/**
 * A source file parsed, syntax only.
 *
 * No program and no checker, for the reason `diagrams.test.ts` gives at length:
 * the parser is the one that compiles the file, so a member is a member whatever
 * its type is written as, and none of the four ways a regex over the same text
 * was silently wrong is reachable from here.
 */
export function parse(path: string): ts.SourceFile {
  return ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
}

/** A piece of one, for asking about the inside of a single function. */
export function parseFragment(code: string): ts.SourceFile {
  return ts.createSourceFile('fragment.ts', code, ts.ScriptTarget.Latest, true);
}

/** The property names an interface declares, in the order it declares them. */
export function interfaceMembers(source: ts.SourceFile, name: string): string[] {
  const declaration = source.statements.find(
    (statement): statement is ts.InterfaceDeclaration =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === name,
  );
  if (!declaration) throw new Error(`${source.fileName} no longer declares an interface ${name}`);
  return declaration.members.map((member) => {
    const property = member.name?.getText(source) ?? '';
    if (property === '') throw new Error(`${name} has a member this cannot read`);
    return property;
  });
}

/**
 * The parameter names of one function, in the order it declares them.
 *
 * For a drawing that prints a signature as a label. The parser rather than a
 * regex for the reason `diagrams.test.ts` gives about `CorePlatform`: a default
 * value, a destructured parameter and a type argument with a comma in it each
 * break a different naive pattern, and all three are things this repository
 * writes. A parameter with no plain name throws rather than being skipped, so a
 * signature this cannot read fails loudly instead of shortening quietly.
 */
export function functionParameters(source: ts.SourceFile, name: string): string[] {
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
      return statement.parameters.map((parameter) => {
        const text = parameter.name.getText(source);
        if (!ts.isIdentifier(parameter.name)) {
          throw new Error(`${name} has a parameter this cannot name: ${text}`);
        }
        return text;
      });
    }
  }
  throw new Error(`${source.fileName} no longer declares a function ${name}`);
}

/** The string members of a union type alias, in declaration order. */
export function unionMembers(source: ts.SourceFile, name: string): string[] {
  const declaration = source.statements.find(
    (statement): statement is ts.TypeAliasDeclaration =>
      ts.isTypeAliasDeclaration(statement) && statement.name.text === name,
  );
  if (!declaration) throw new Error(`${source.fileName} no longer declares a type ${name}`);
  const union = declaration.type;
  if (!ts.isUnionTypeNode(union)) throw new Error(`${name} is no longer a union`);
  return union.types.map((member) => {
    if (!ts.isLiteralTypeNode(member) || !ts.isStringLiteral(member.literal)) {
      throw new Error(`${name} has a member that is not a string literal`);
    }
    return member.literal.text;
  });
}

/**
 * A module-level constant, evaluated.
 *
 * Only what this repository actually writes: a number, a string, and a product of
 * numbers, because `24 * 60 * 60 * 1000` is how every duration here is spelled and
 * a check that could not read one would be a check nobody could keep. Anything
 * else throws rather than returning a wrong answer quietly.
 */
export function constantValue(source: ts.SourceFile, name: string): number | string {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) !== name || !declaration.initializer) continue;
      return evaluate(declaration.initializer, source);
    }
  }
  throw new Error(`${source.fileName} no longer declares ${name}`);
}

function evaluate(node: ts.Expression, source: ts.SourceFile): number | string {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isBinaryExpression(node)) {
    const left = evaluate(node.left, source);
    const right = evaluate(node.right, source);
    if (typeof left !== 'number' || typeof right !== 'number') {
      throw new Error(`not an arithmetic expression: ${node.getText(source)}`);
    }
    if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken) return left * right;
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) return left + right;
  }
  throw new Error(`this cannot evaluate ${node.getText(source)}`);
}

/** The body text of one function declaration, for asking about the order of calls. */
export function functionBody(source: ts.SourceFile, name: string): string {
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name && statement.body) {
      return statement.body.getText(source);
    }
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(source) === name && declaration.initializer) {
        return declaration.initializer.getText(source);
      }
    }
  }
  throw new Error(`${source.fileName} no longer declares a function ${name}`);
}

/** Every string handed to `<receiver>.<method>(…)`, in source order. */
export function stringArguments(source: ts.SourceFile, receiver: string, method: string): string[] {
  const found: string[] = [];
  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === method &&
      node.expression.expression.getText(source) === receiver &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  return found;
}

/**
 * The values of a module-level object literal of strings, keyed as written.
 *
 * For the handful of places a drawing quotes an address the code holds in a
 * table: `LoginGate`'s three links are one value repeated, and a drawing saying
 * so has to be able to fail when one of them stops being that value.
 */
export function stringRecord(source: ts.SourceFile, name: string): Record<string, string> {
  const literal = functionBody(source, name);
  const parsed = ts.createSourceFile(
    'literal.ts',
    `const x = ${literal}`,
    ts.ScriptTarget.Latest,
    true,
  );
  const out: Record<string, string> = {};
  const walk = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer)) {
      out[node.name.getText(parsed)] = node.initializer.text;
    }
    ts.forEachChild(node, walk);
  };
  walk(parsed);
  return out;
}

/**
 * Every file under a directory, minus the generated ones.
 *
 * A generated module is not code somebody wrote, and two of them here are
 * megabytes of base64 that match almost any short word by accident: the cover
 * bundle contains the four letters of `pKCE` inside an image. A sweep that read
 * them would be answering a question about a JPEG.
 */
export function handWritten(dir: string): string[] {
  return filesUnder(dir, /^(?!.*\.generated\.).*\.tsx?$/);
}

/** A line that is prose about code rather than code. */
export function isComment(line: string): boolean {
  return /^\s*(\/\/|\*|\/\*)/.test(line.trimEnd());
}
