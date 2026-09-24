import ts from 'typescript';

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
 * writes; the ADR says the same. ADR 0061 §3 names the strings submission as the second
 * caller, from `scripts/submission.ts`, when it is built.
 */

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
