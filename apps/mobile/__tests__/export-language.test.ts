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
 *
 * **The shell also says which document is the app's**, which is the same subject
 * read from the other end: the runtime correction that fixes `lang` is mounted with
 * the provider, and the provider can be mounted in a page the app did not write.
 * `__tests__/document-language.test.tsx` renders that guard; here it is the shell's
 * side of it, because a mark nothing writes fails silently in the safe-looking
 * direction.
 */
const APP = resolve(__dirname, '..');
const SHELL = join(APP, 'src', 'app', '+html.tsx');

/** The first `<html>` element in a file, and the source it was read out of. */
function htmlElement(file: string): {
  source: ts.SourceFile;
  opening: ts.JsxOpeningLikeElement | undefined;
} {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let found: ts.JsxOpeningLikeElement | undefined;
  const visit = (node: ts.Node): void => {
    if (found !== undefined) return;
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : undefined;
    if (opening?.tagName.getText(source) === 'html') {
      found = opening;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { source, opening: found };
}

/** The `lang=` of the first `<html>` element in a file, as source text. */
function langAttribute(file: string): string | null {
  const { source, opening } = htmlElement(file);
  if (opening === undefined) return null;
  for (const attribute of opening.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) continue;
    if (attribute.name.getText(source) !== 'lang') continue;
    return attribute.initializer?.getText(source) ?? '';
  }
  return '';
}

/** Whatever the first `<html>` element spreads onto itself, as source text. */
function spreadsOnHtml(file: string): string[] {
  const { source, opening } = htmlElement(file);
  if (opening === undefined) return [];
  return opening.attributes.properties
    .filter(ts.isJsxSpreadAttribute)
    .map((spread) => spread.expression.getText(source));
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

  it('marks the document as the app’s own, from the one place that names the mark', () => {
    // The runtime correction in `i18n/Localisation.tsx` runs wherever the app's
    // provider is mounted, and the provider can be mounted inside a page the app
    // did not write — whose `<html>` is not the app's to stamp. This element is
    // the only one the app owns, so this is where it says so.
    //
    // A spread and not `data-…=""`, so the name exists once: written here,
    // read in `lib/ownDocument.ts`, and impossible to half-rename. Losing the
    // mark is the quiet failure — the guard then answers no for every document,
    // the correction runs nowhere, and nothing about that looks broken.
    expect(spreadsOnHtml(SHELL)).toContain('OWN_DOCUMENT_MARK');
  });

  it('names a language the core knows', () => {
    // The constant is typed `Locale`, so this cannot fail by type — it can fail by
    // somebody widening the type and forgetting the catalogue, which is what the
    // package's own registry check is for. Here it is the floor: a value at all.
    expect(SHIPPED_LOCALE).toBeTruthy();
  });
});
