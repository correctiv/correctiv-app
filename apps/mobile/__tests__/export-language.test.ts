import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import ts from 'typescript';

import { SHIPPED_LOCALE } from '@/lib/locale';

/**
 * The web export declares the language the app renders in.
 *
 * **This exists because the bug it catches shipped**, and because deleting one file
 * brings it straight back with nothing going red. `expo export --platform web`
 * writes the HTML shell itself when there is no `app/+html.tsx`, and its default
 * says `lang="en"`. The published demo therefore served German prose in a document
 * announced as English: a browser hyphenating by the wrong rules, and a screen
 * reader choosing an English voice for German. Measured on the export on
 * 2026-09-18, before that file existed, and measured again after: all 69 route
 * shells changed together.
 *
 * **Read rather than rendered, and that is a limit worth stating.** The shell is
 * DOM host elements, and this suite runs under `jest-expo`'s native preset, where
 * `react-test-renderer` produces `null` for an `<html>` — verified. What can be
 * asserted here is the source, so this walks it with the TypeScript AST rather than
 * grepping: a `lang` attribute is a node, and asking the tree what it holds cannot
 * be answered by the docblock above quoting the attribute it argues about.
 *
 * The other half is the artefact, and `.github/workflows/ci.yml`'s web-export job is
 * where that belongs — this suite runs in seconds and an export takes minutes.
 */
const APP = resolve(__dirname, '..');
const SHELL = join(APP, 'src', 'app', '+html.tsx');

/** The `lang=` of the first `<html>` element in a file, as source text. */
function langAttribute(file: string): string | null {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let found: string | null = null;
  const visit = (node: ts.Node): void => {
    if (found !== null) return;
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : undefined;
    if (opening?.tagName.getText(source) === 'html') {
      for (const attribute of opening.attributes.properties) {
        if (!ts.isJsxAttribute(attribute)) continue;
        if (attribute.name.getText(source) !== 'lang') continue;
        found = attribute.initializer?.getText(source) ?? '';
        return;
      }
      found = '';
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('the web export declares its language', () => {
  it('has a shell of its own rather than Expo’s default', () => {
    // A missing file here is not a test that cannot run: it is the defect.
    expect(existsSync(SHELL)).toBe(true);
  });

  it('gives its `<html>` a lang', () => {
    expect(langAttribute(SHELL)).not.toBe('');
    expect(langAttribute(SHELL)).not.toBeNull();
  });

  it('takes it from the one place that names it, not from a literal', () => {
    // A literal would be right today and wrong on the day `lib/locale.ts` changes,
    // which is the shape the bug had before: two places, agreeing until they did
    // not. The app names its language once and three readers ask that one place.
    expect(langAttribute(SHELL)).toBe('{SHIPPED_LOCALE}');
  });

  it('names a language the core knows', () => {
    // The constant is typed `Locale`, so this cannot fail by type — it can fail by
    // somebody widening the type and forgetting the catalogue, which is what the
    // package's own registry check is for. Here it is the floor: a value at all.
    expect(SHIPPED_LOCALE).toBeTruthy();
  });
});
