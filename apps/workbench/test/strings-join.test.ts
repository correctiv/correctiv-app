import { describe, expect, it } from 'vitest';

// A build script, plain JS, with no types to hand a test — the house pattern is
// `test/api.test.ts` against `scripts/api.mjs`.
import { buildRows, rewriteExtractCommand } from '../scripts/strings.mjs';

/**
 * The two pure parts of `scripts/strings.mjs`: rewriting the `i18n:extract`
 * command it borrows from `apps/mobile`, and joining a located-extraction map
 * against the catalogues into the rows `content/strings.generated.json` holds.
 *
 * A run of the real thing is `npm run strings`, which needs a real FormatJS
 * extraction and the real catalogues, and is not a unit test. `main()` and its
 * I/O stay unexported; these fixtures reach `rewriteExtractCommand` and
 * `buildRows` directly, the way `test/strings.test.ts` reaches the page's own
 * pure computations directly.
 */

function located(
  entries: Record<
    string,
    { defaultMessage?: string; description?: string; file?: string; line?: number }
  >,
) {
  return entries;
}

describe("rewriteExtractCommand, borrowing apps/mobile's own i18n:extract", () => {
  it('adds --extract-source-location and redirects --out-file to the given path', () => {
    const command =
      "formatjs extract 'src/**/*.{ts,tsx}' --additional-function-names coreMessage --throws --out-file ../../packages/catalogue/src/en.json";

    const args = rewriteExtractCommand(command, '/tmp/strings-abc/located.json');

    expect(args).toContain('--extract-source-location');
    expect(args).toContain('--out-file');
    expect(args).toContain('/tmp/strings-abc/located.json');
    expect(args).not.toContain('../../packages/catalogue/src/en.json');
  });

  it('drops a leading `formatjs` from the command, since execFileSync calls the binary directly', () => {
    const command = "formatjs extract 'src/**/*.ts' --out-file en.json";

    const args = rewriteExtractCommand(command, '/tmp/strings-abc/located.json');

    expect(args[0]).toBe('extract');
  });

  it('keeps a single-quoted glob as one argument', () => {
    const command = "formatjs extract 'src/**/*.{ts,tsx}' --out-file en.json";

    const args = rewriteExtractCommand(command, '/tmp/strings-abc/located.json');

    expect(args).toContain('src/**/*.{ts,tsx}');
  });

  it('throws, naming the script and the flag it expected, when there is no --out-file to redirect', () => {
    // What defect 1 was: a blind `.replace` on a script spelling the flag some
    // other way is a silent no-op, and the failure only shows up later as an
    // ENOENT on a temp path nobody recognises.
    const command = "formatjs extract 'src/**/*.ts' -o en.json";

    expect(() => rewriteExtractCommand(command, '/tmp/strings-abc/located.json')).toThrow(
      /i18n:extract.*--out-file/s,
    );
  });

  it('throws the same way when the script has been folded into a longer shell pipeline', () => {
    const command = "formatjs extract 'src/**/*.ts' --out-file en.json && echo done";

    // Still matches --out-file, so this one is expected to succeed and redirect
    // the flag that IS there; the case above is the one that has none at all.
    const args = rewriteExtractCommand(command, '/tmp/strings-abc/located.json');
    expect(args).toContain('/tmp/strings-abc/located.json');
  });
});

describe('buildRows, joining a located extraction against the catalogues', () => {
  const byLocale = {
    en: { 'gate.title': 'Sign in', 'gate.body': 'Welcome' },
    de: { 'gate.title': 'Anmelden', 'gate.body': null },
  };

  it('joins an id against every locale, in a locale-sorted key order', () => {
    const { locales, strings } = buildRows(
      located({ 'gate.title': { defaultMessage: 'Sign in' } }),
      byLocale,
    );

    expect(locales).toEqual(['de', 'en']);
    expect(strings).toEqual([
      expect.objectContaining({
        id: 'gate.title',
        namespace: 'gate',
        english: 'Sign in',
        translations: { de: 'Anmelden', en: 'Sign in' },
      }),
    ]);
  });

  it('fills a null where a catalogue has nothing for an id, rather than dropping the locale', () => {
    const { strings } = buildRows(located({ 'gate.body': {} }), byLocale);

    expect(strings[0]!.translations).toEqual({ de: null, en: 'Welcome' });
  });

  it('gives a dotless id itself as its namespace, rather than dropping its last character', () => {
    // What defect 2 was: `id.slice(0, id.indexOf('.'))` on an id with no dot at
    // all reads `indexOf` as -1 and slices off the last character silently.
    const { strings } = buildRows(located({ nodot: { defaultMessage: 'Whole id' } }), {
      en: { nodot: 'Whole id' },
    });

    expect(strings[0]!.namespace).toBe('nodot');
  });

  it('resolves a located file to a repository-root-relative path, and defaults an absent one to 0/none', () => {
    const { strings } = buildRows(
      located({
        'gate.title': { defaultMessage: 'Sign in', file: 'src/screens/Gate.tsx', line: 12 },
      }),
      byLocale,
    );

    expect(strings[0]).toMatchObject({
      file: 'apps/mobile/src/screens/Gate.tsx',
      line: 12,
      description: null,
    });
  });

  it("sorts by UTF-16 code unit, not by the machine's default collation", () => {
    // Deliberately a pair a locale-aware compare and a code-unit compare are known
    // to disagree on: an ICU collation typically reads 'a' before 'Z' letter for
    // letter, while a code-unit compare puts every upper-case ASCII letter before
    // every lower-case one. Defect 3 was `.localeCompare`, which reads whichever
    // collation the running machine has, so this is the one fact this table must
    // not get from the machine it happens to build on.
    const { strings } = buildRows(
      located({
        'a.one': { defaultMessage: 'lower' },
        'Z.one': { defaultMessage: 'upper' },
      }),
      { en: { 'a.one': 'lower', 'Z.one': 'upper' }, de: { 'a.one': 'x', 'Z.one': 'y' } },
    );

    expect(strings.map((s) => s.id)).toEqual(['Z.one', 'a.one']);
  });

  it('throws, naming the namespace, when sorting leaves its entries in two separate runs', () => {
    // A dotless id's namespace is the whole id (the defect-2 fix above), so a
    // dotless "cat" and a dotted "cat.field" share the namespace "cat" — but a
    // third id "cat-fact" sorts BETWEEN them: '-' (0x2D) is below '.' (0x2E) in
    // UTF-16, so code-unit order is "cat" < "cat-fact" < "cat.field". The page
    // renders one <h2 id="ns-NAME"> per contiguous run of a namespace, so this has
    // to be caught here rather than silently printing "cat" as a heading twice.
    const rows = located({
      cat: { defaultMessage: 'Whole id' },
      'cat-fact': { defaultMessage: 'A different namespace entirely' },
      'cat.field': { defaultMessage: 'Back to cat' },
    });
    const locales = { en: { cat: 'x', 'cat-fact': 'y', 'cat.field': 'z' } };

    expect(() => buildRows(rows, locales)).toThrow(/"cat".*"cat-fact"/s);
  });
});
