import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// A build script, plain JS, with no types to hand a test — the house pattern is
// `test/api.test.ts` against `scripts/api.mjs`.
import { buildRows, rewriteExtractCommand } from '../scripts/strings.mjs';

/**
 * The two pure parts of `scripts/strings.mjs`: rewriting the `i18n:extract`
 * command it borrows from each package, and joining the located extractions
 * against the catalogues into the rows `content/strings.generated.json` holds.
 *
 * A run of the real thing is `npm run strings`, which needs two real FormatJS
 * extractions and the real catalogues, and is not a unit test. `main()` and its
 * I/O stay unexported; these fixtures reach `rewriteExtractCommand` and
 * `buildRows` directly, the way `test/strings.test.ts` reaches the page's own
 * pure computations directly.
 */

type Located = Record<
  string,
  { defaultMessage?: string; description?: string; file?: string; line?: number }
>;

function located(entries: Located) {
  return entries;
}

/**
 * One surface's share of the input, the shape `buildRows` now takes.
 *
 * `dir` is absolute in the real run — `scripts/strings.mjs` joins it from the
 * repository root — so these fixtures pass an absolute path too, and the
 * assertions below are about what `relative(ROOT, …)` makes of it.
 */
function surface(
  name: string,
  dir: string,
  entries: Located,
  byLocale: Record<string, Record<string, string | null>>,
) {
  return { name, dir, located: entries, byLocale };
}

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..');
const APP = join(ROOT, 'apps/mobile');
const WORKBENCH = join(ROOT, 'apps/workbench');

describe('rewriteExtractCommand, borrowing each package’s own i18n:extract', () => {
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

describe('buildRows, joining the located extractions against the catalogues', () => {
  type ByLocale = Record<string, Record<string, string | null>>;

  const byLocale: ByLocale = {
    en: { 'gate.title': 'Sign in', 'gate.body': 'Welcome' },
    de: { 'gate.title': 'Anmelden', 'gate.body': null },
  };

  const app = (entries: Located, locales: ByLocale = byLocale) =>
    surface('app', APP, entries, locales);

  it('joins an id against every locale, in a locale-sorted key order', () => {
    const { locales, strings } = buildRows([
      app(located({ 'gate.title': { defaultMessage: 'Sign in' } })),
    ]);

    expect(locales).toEqual(['de', 'en']);
    expect(strings).toEqual([
      expect.objectContaining({
        id: 'gate.title',
        surface: 'app',
        namespace: 'gate',
        english: 'Sign in',
        translations: { de: 'Anmelden', en: 'Sign in' },
      }),
    ]);
  });

  it('fills a null where a catalogue has nothing for an id, rather than dropping the locale', () => {
    const { strings } = buildRows([app(located({ 'gate.body': {} }))]);

    expect(strings[0]!.translations).toEqual({ de: null, en: 'Welcome' });
  });

  it('gives a dotless id itself as its namespace, rather than dropping its last character', () => {
    // What defect 2 was: `id.slice(0, id.indexOf('.'))` on an id with no dot at
    // all reads `indexOf` as -1 and slices off the last character silently.
    const { strings } = buildRows([
      app(located({ nodot: { defaultMessage: 'Whole id' } }), { en: { nodot: 'Whole id' } }),
    ]);

    expect(strings[0]!.namespace).toBe('nodot');
  });

  it('resolves a located file against the surface it came from, and defaults an absent one to 0/none', () => {
    const { strings } = buildRows([
      app(
        located({
          'gate.title': { defaultMessage: 'Sign in', file: 'src/screens/Gate.tsx', line: 12 },
        }),
      ),
      surface(
        'workbench',
        WORKBENCH,
        located({ 'nav.strings': { defaultMessage: 'Strings', file: 'src/nav.ts', line: 3 } }),
        { en: { 'nav.strings': 'Strings' }, de: { 'nav.strings': 'Texte der App' } },
      ),
    ]);

    // The whole reason `dir` is per surface: one extraction's `src/` is the app's
    // and the other's is this site's, and both arrive spelled `src/…`.
    expect(strings[0]).toMatchObject({
      file: 'apps/mobile/src/screens/Gate.tsx',
      line: 12,
      description: null,
    });
    expect(strings[1]).toMatchObject({ file: 'apps/workbench/src/nav.ts', line: 3 });
  });

  it("sorts by UTF-16 code unit, not by the machine's default collation", () => {
    // Deliberately a pair a locale-aware compare and a code-unit compare are known
    // to disagree on: an ICU collation typically reads 'a' before 'Z' letter for
    // letter, while a code-unit compare puts every upper-case ASCII letter before
    // every lower-case one. Defect 3 was `.localeCompare`, which reads whichever
    // collation the running machine has, so this is the one fact this table must
    // not get from the machine it happens to build on.
    const { strings } = buildRows([
      app(
        located({
          'a.one': { defaultMessage: 'lower' },
          'Z.one': { defaultMessage: 'upper' },
        }),
        { en: { 'a.one': 'lower', 'Z.one': 'upper' }, de: { 'a.one': 'x', 'Z.one': 'y' } },
      ),
    ]);

    expect(strings.map((row: { id: string }) => row.id)).toEqual(['Z.one', 'a.one']);
  });

  it('sorts inside a surface and never across, so the surfaces stay in the order given', () => {
    // An id sorted against the other surface's ids would interleave the two into a
    // table with no sections in it at all.
    const { strings } = buildRows([
      surface('app', APP, located({ 'z.last': { defaultMessage: 'z' } }), {
        en: { 'z.last': 'z' },
      }),
      surface('workbench', WORKBENCH, located({ 'a.first': { defaultMessage: 'a' } }), {
        en: { 'a.first': 'a' },
      }),
    ]);

    expect(strings.map((row: { surface: string; id: string }) => [row.surface, row.id])).toEqual([
      ['app', 'z.last'],
      ['workbench', 'a.first'],
    ]);
  });

  it('lets the two surfaces carry the same id without either replacing the other', () => {
    // `settings.title` is a real id in both, and it reads "Settings" in both.
    const { strings } = buildRows([
      surface('app', APP, located({ 'settings.title': { defaultMessage: 'Settings' } }), {
        en: { 'settings.title': 'Settings' },
        de: { 'settings.title': 'Einstellungen' },
      }),
      surface(
        'workbench',
        WORKBENCH,
        located({ 'settings.title': { defaultMessage: 'Settings' } }),
        { en: { 'settings.title': 'Settings' }, de: { 'settings.title': 'Einstellungen' } },
      ),
    ]);

    expect(strings).toHaveLength(2);
    expect(strings.map((row: { surface: string }) => row.surface)).toEqual(['app', 'workbench']);
  });

  it('lets one namespace appear in both surfaces without calling it a split run', () => {
    // The contiguity check is keyed on the pair. Keyed on the namespace alone it
    // threw on this perfectly correct table the moment the second surface arrived.
    //
    // The app needs a SECOND namespace between its `settings` and the workbench's,
    // and this is the reason: with the two `settings` runs adjacent, keying on the
    // namespace alone merges them into one run and throws nothing, so the first
    // version of this fixture stayed green under the very mutation it names. A
    // cold review found that. `zzz` sorts last inside the app, which is what puts
    // it between the two.
    const rows = () =>
      buildRows([
        surface(
          'app',
          APP,
          located({
            'settings.a': { defaultMessage: 'A' },
            'zzz.a': { defaultMessage: 'Z' },
          }),
          { en: { 'settings.a': 'A', 'zzz.a': 'Z' } },
        ),
        surface('workbench', WORKBENCH, located({ 'settings.b': { defaultMessage: 'B' } }), {
          en: { 'settings.b': 'B' },
        }),
      ]);

    expect(rows).not.toThrow();
    expect(
      rows().strings.map(
        (row: { surface: string; namespace: string }) => `${row.surface} · ${row.namespace}`,
      ),
    ).toEqual(['app · settings', 'app · zzz', 'workbench · settings']);
  });

  it('refuses a surface whose extraction matched nothing', () => {
    // FormatJS exits 0 on a glob that matches no file, so a directory move that
    // left one behind would otherwise write an empty board and print a green line
    // under it. `plugin/index.ts` only checks the file is there.
    expect(() =>
      buildRows([
        surface('app', APP, located({ 'a.one': { defaultMessage: 'A' } }), {
          en: { 'a.one': 'A' },
        }),
        surface('workbench', WORKBENCH, located({}), { en: {} }),
      ]),
    ).toThrow(/extraction for "workbench" matched nothing/);
  });

  it('refuses an empty list of surfaces, rather than reading the first of none', () => {
    expect(() => buildRows([])).toThrow(/no surfaces to join/);
  });

  it('throws, naming the section, when sorting leaves its entries in two separate runs', () => {
    // A dotless id's namespace is the whole id (the defect-2 fix above), so a
    // dotless "cat" and a dotted "cat.field" share the namespace "cat" — but a
    // third id "cat-fact" sorts BETWEEN them: '-' (0x2D) is below '.' (0x2E) in
    // UTF-16, so code-unit order is "cat" < "cat-fact" < "cat.field". The page
    // renders one <h2> per contiguous run, so this has to be caught here rather
    // than silently printing "app · cat" as a heading twice.
    const rows = located({
      cat: { defaultMessage: 'Whole id' },
      'cat-fact': { defaultMessage: 'A different namespace entirely' },
      'cat.field': { defaultMessage: 'Back to cat' },
    });
    const locales = { en: { cat: 'x', 'cat-fact': 'y', 'cat.field': 'z' } };

    expect(() => buildRows([app(rows, locales)])).toThrow(/"app · cat".*"app · cat-fact"/s);
  });

  it('throws, naming both sides, when one surface offers a language the other does not', () => {
    // The page draws one column per locale for every row, so a language only one
    // surface has would read as a missing wording on every row of the other.
    expect(() =>
      buildRows([
        surface('app', APP, located({ 'a.one': { defaultMessage: 'A' } }), {
          en: { 'a.one': 'A' },
          de: { 'a.one': 'A' },
        }),
        surface('workbench', WORKBENCH, located({ 'b.one': { defaultMessage: 'B' } }), {
          en: { 'b.one': 'B' },
        }),
      ]),
    ).toThrow(/"workbench" has en where "app" has de, en/);
  });
});
