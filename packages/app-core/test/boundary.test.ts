import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { filesUnder, floorFaults } from '@correctiv/prose-and-code';

import { IMPORT_RE, specifier } from './support/source';

/**
 * The architectural guard.
 *
 * `@correctiv/app-core` only has value if it stays platform-free: it is what a
 * web target, a future native rewrite and this test suite all share. That
 * property is one careless import away from being lost, and nothing else in the
 * toolchain enforces it — so it is enforced here, in the same `npm run check`
 * that runs on every PR.
 *
 * If this test fails, the fix is never to widen the allow-list: move the code
 * that needs the SDK into a host (apps/mobile/src/lib/platform/…) and declare what
 * the core needs as a port in src/ports/index.ts.
 */
const SRC = fileURLToPath(new URL('../src', import.meta.url));

const FORBIDDEN = [
  { pattern: /@nativescript\//, why: 'NativeScript SDK' },
  { pattern: /@nativescript-community\//, why: 'NativeScript community plugin' },
  { pattern: /@nstudio\//, why: 'NativeScript plugin' },
  { pattern: /^nativescript-vue$/, why: 'NativeScript Vue renderer' },
  { pattern: /^react-native/, why: 'React Native' },
  // The scoped half of the same ecosystem, which `^react-native` cannot see because
  // the package name starts with the scope. These are the ones a screen reaches for
  // first — storage, navigation, a faster list — and each would tie the core to a
  // host as firmly as `react-native` itself.
  {
    pattern: /^@react-native(-|\/)/,
    why: 'React Native, scoped (@react-native-async-storage/…, @react-native-community/…)',
  },
  { pattern: /^@react-navigation\//, why: 'React Navigation (a React Native navigator)' },
  { pattern: /^@shopify\/flash-list$/, why: 'FlashList (a React Native list)' },
  // The general form of the two above: anything called react-native-something under
  // somebody else's scope, so a package nobody has named yet is caught on arrival
  // rather than after it ships.
  { pattern: /^@[^/]+\/react-native(-|$)/, why: 'a React Native package under another scope' },
  { pattern: /^expo(-|$)/, why: 'Expo' },
  { pattern: /^@expo(-|\/)/, why: 'Expo, scoped (@expo/vector-icons, @expo-google-fonts/…)' },
  { pattern: /^node:/, why: 'Node built-in (the core runs on device and in a browser too)' },
  // The core was Pinia-based until the React Native pivot; these keep it from
  // drifting back. A UI framework in here would re-tie the core to one host, which
  // is exactly what moving the stores into the core avoided.
  //
  // State itself lives in Redux Toolkit (stores/store.ts), which is deliberately
  // NOT on this list: it is a state container, not a view layer, and it holds the
  // same property the hand-written store had — no UI framework, no platform SDK.
  // The binding stays the host's (react-redux in apps/mobile).
  { pattern: /^vue$|^@vue\//, why: 'Vue (hosts bind the store themselves)' },
  { pattern: /^pinia$/, why: 'Pinia (replaced by Redux Toolkit — see ADR 0004)' },
  { pattern: /^zustand/, why: 'zustand (the core is on Redux Toolkit)' },
  { pattern: /^react$|^react-dom$/, why: 'React (hosts bind the stores themselves)' },
];

/**
 * `.tsx` and `.jsx` are in the net even though the core holds neither, because a
 * file the walk skips is a file every assertion below passes over. The `no JSX`
 * test is what actually rejects one; this is what stops it being invisible first.
 */
const SOURCE = /^(?!.*\.d\.mts$).*\.(tsx|jsx|ts|mts|mjs|js)$/;

describe('core stays platform-free', () => {
  const files = filesUnder(SRC, SOURCE);

  it('finds source files to check (guards against a silently empty scan)', () => {
    expect(floorFaults({ 'files under src/': { found: files.length, atLeast: 25 } })).toEqual([]);
  });

  /**
   * The second net, and the one that can go quiet without anything looking wrong:
   * every assertion below reads the core through IMPORT_RE, so a regex that stopped
   * matching would report a core with no imports at all and pass. The fixture names
   * one specifier per form, so a form that falls out of the net fails here by name
   * rather than by letting a real import through somewhere else.
   *
   * IMPORT_RE is shared — `support/source.ts`, beside the two comment readers — and
   * `apps/mobile/__tests__/no-workbench-dependency.test.ts` reads the app through the
   * same one. This fixture is therefore the proof for both nets, which is why it
   * stays here rather than being copied there.
   */
  it('matches every import form it claims to (guards against a net that catches nothing)', () => {
    const fixture = [
      "import { a } from 'named-import';",
      "import Default from 'default-import';",
      "import type { B } from 'type-only-import';",
      "import 'side-effect-import';",
      "export { c } from 'named-reexport';",
      "export * from 'star-reexport';",
      "const d = await import('dynamic-import');",
      "const e = require('commonjs-require');",
      "import {\n  f,\n} from 'multi-line-import';",
      'export { g };',
      "import 'after-a-from-less-export';",
    ].join('\n');

    expect([...fixture.matchAll(IMPORT_RE)].map((m) => specifier(m)).sort()).toEqual([
      'after-a-from-less-export',
      'commonjs-require',
      'default-import',
      'dynamic-import',
      'multi-line-import',
      'named-import',
      'named-reexport',
      'side-effect-import',
      'star-reexport',
      'type-only-import',
    ]);

    // And that it still finds them in the real thing, not only in the fixture.
    const found = files.flatMap((full) => [...readFileSync(full, 'utf8').matchAll(IMPORT_RE)]);
    expect(
      floorFaults({ 'imports the net matched': { found: found.length, atLeast: 50 } }),
    ).toEqual([]);
  });

  it('holds no JSX file (guards against a view layer the imports cannot show)', () => {
    // A `.tsx` in the core is the violation, before anything it imports is read:
    // JSX compiles to a call into a view layer that the compiler injects
    // (`react/jsx-runtime`), so it never appears as an import and no pattern in
    // FORBIDDEN can see it. The extension is the whole of the evidence, which is
    // why this is its own assertion and not another line in the list above.
    const jsx = files.filter((full) => /\.[jt]sx$/.test(full));
    expect(jsx.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it.each(files.map((f) => [f.slice(SRC.length + 1), f]))(
    '%s imports no platform SDK',
    (_name, full) => {
      const source = readFileSync(full, 'utf8');
      const offenders: string[] = [];

      for (const match of source.matchAll(IMPORT_RE)) {
        const spec = specifier(match);
        if (!spec || spec.startsWith('.')) continue;
        const hit = FORBIDDEN.find((f) => f.pattern.test(spec));
        if (hit) offenders.push(`${spec} (${hit.why})`);
      }

      expect(offenders).toEqual([]);
    },
  );

  it('routes every platform capability through a declared port', () => {
    // Anything the core needs from its host must appear in ports/index.ts — one
    // file to read to know what implementing a new host costs.
    const ports = readFileSync(join(SRC, 'ports/index.ts'), 'utf8');
    for (const port of [
      'KeyValueStore',
      'BlobStore',
      'ContentBundle',
      'AudioBackend',
      'ErrorReporter',
    ]) {
      expect(ports).toMatch(new RegExp(`export interface ${port}`));
    }
    expect(ports).toMatch(/export interface CorePlatform/);
  });

  /**
   * The parser lives in two files, and nothing else may import it. An accidental
   * import somewhere central would pull htmlparser2 into a bundle whose resolver
   * cannot handle it, and that failure shows up on a device, not here.
   *
   * It was ONE file, the DOM extraction backend, so that a host without an HTML
   * parser would not need one. The second is `articles/body-allowlist.ts`, the
   * reader document's last gate, and it is there on purpose: that gate was a
   * regular-expression denylist until 2026-09-24, and two bodies a re-check found
   * went through it that an allowlist over a parsed tree stops by construction
   * (ADR 0065 §7). So a host that builds the reader document carries the parser.
   * A host that only extracts, a plain Node script with the string backend, still
   * does not.
   */
  it('keeps the HTML parser inside the DOM extraction backend and the reader gate', () => {
    const parserImports = files.filter((full) => {
      if (full.endsWith(join('articles', 'extract', 'dom.ts'))) return false;
      if (full.endsWith(join('articles', 'body-allowlist.ts'))) return false;
      return /from '(?:htmlparser2|css-select|domutils|dom-serializer|domhandler)'/.test(
        readFileSync(full, 'utf8'),
      );
    });
    expect(parserImports.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});
