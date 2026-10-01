import { readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { filesUnder, floorFaults, withoutComments } from '@correctiv/prose-and-code';

/**
 * Guards the web target against the one failure mode that does not announce
 * itself.
 *
 * react-native-webview has no web implementation. On web it renders the text
 * "React Native WebView does not support this platform." — and crucially,
 * `expo export --platform web` still succeeds, so a CI job that only checks the
 * export stays green while the route is broken. That is why this is a test and
 * not a comment.
 *
 * The rule: react-native-webview may only be imported from a file Metro
 * resolves exclusively on native. Anything else must go through
 * components/reader/ReaderView, which has a .web.tsx sibling.
 *
 * The file has since collected the rest of the import-shaped incidents in
 * TROUBLESHOOTING.md, because they share that shape: a green build, a green
 * typecheck, a green test run, and a broken app. One of them (`expo-router/tabs`)
 * is not web-only; it lives here because the guard is the same one line of regex
 * over the same file list, not because the failure is about the export.
 */
const SRC = resolve(__dirname, '../src');

/** Files Metro only ever picks on native — safe places for a native-only import. */
const NATIVE_ONLY = [/\.native\.[jt]sx?$/, /\.(android|ios)\.[jt]sx?$/];

/**
 * ReaderView.tsx is the native branch of a platform pair: Metro prefers
 * ReaderView.web.tsx on web, so the bare .tsx never reaches a browser. Verified
 * below by asserting the .web.tsx sibling exists.
 *
 * Membership says one thing: Metro never picks this file on web. The webview rule
 * above reads the list as an exemption because that is what the one thing implies,
 * so an entry is earned by having a real .web sibling and nothing else.
 */
const PLATFORM_PAIRED = [
  'components/reader/ReaderView.tsx',
  // A foreign embed (YouTube). Same deal: .web.tsx renders a real <iframe>.
  'components/media/VideoFrame.tsx',
  // Not a native SDK this time but half a megabyte of base64: the bundled covers
  // are for an offline phone, and .web.ts keeps them out of the page.
  'lib/articles/covers.ts',
  // The screen header. Native configures the platform's stack header; on web
  // that header draws nothing at all — `ScreenStackHeaderConfig.web.js` makes it
  // and every subview a bare `View` — so .web.tsx keeps the app's drawn bar
  // (ADR 0030).
  'components/ui/ScreenHeader.tsx',
  // The browser tab's name. `.web.ts` keeps a list of the screens naming
  // themselves and writes the top of it; the bare `.ts` is the no-op a device
  // gets, because there is no document there (ADR 0030).
  'lib/navigation/documentTitle.ts',
  // The share sheet. `react-native`'s `Share` exists on react-native-web, which is
  // why the gap here is quiet rather than loud: it forwards to `navigator.share`
  // and REJECTS with "Share is not supported in this browser" everywhere else, so
  // without the `.web.ts` the button on a desktop browser does nothing at all and
  // logs a warning nobody reads. The web export is how most people see this app.
  'lib/shareArticle.ts',
  // The tab bar. Native tabs are the system's; the web has no system tab bar to
  // borrow, so `.web.tsx` draws one (ADR 0013). Without the sibling the web target
  // falls back to expo-router's native-tabs web implementation, which renders the
  // five labels and NO icons — a bar that still works, and is not the app.
  'app/(tabs)/_layout.tsx',
];

/**
 * The `COPY = defineMessages({…})` block of a file, one string per descriptor:
 * `key: id = English default`. Read out of the source rather than imported,
 * because importing either tab layout pulls in expo-router and the whole screen
 * with it, for five lines of data.
 */
function tabLabels(rel: string): string[] {
  const source = readFileSync(resolve(SRC, rel), 'utf8');
  const block = /const COPY = defineMessages\(\{([\s\S]*?)\n\}\);/.exec(source);
  if (!block) return [];
  /*
   * One chunk per descriptor, cut at the next key on the block's own indent, and
   * the id and the default read out of the chunk rather than out of one pattern
   * spanning the whole object.
   *
   * It used to be that one pattern, `id: '…', defaultMessage: '…' }`, which
   * required the descriptor to be exactly two properties long. Three of these five
   * carry a `description` now, so the brace no longer follows the default and
   * three rows fell out — caught by the count below rather than passing quietly,
   * which is what that assertion is for.
   *
   * **A chunk is a region, so what is in the region has to be the code.** The first
   * version of this read `id:` from anywhere inside the chunk, and a cold review
   * walked straight past it: a comment saying `// Same as the native file, id:
   * 'ui.tabDiscover', defaultMessage: 'Discover'.` above a descriptor whose real id
   * had been changed to `ui.tabHome` left the check green and the web bar shipping
   * two tabs called "Start" — the exact failure the assertion below says it catches.
   * A cross-referencing comment is the natural thing to write here, because these
   * two files are written out twice by hand precisely because nothing can be
   * imported between them.
   *
   * Two guards, because each covers the other's gap. `withoutComments` takes out
   * the prose; it truncates at a `//` inside a string literal, which is why it
   * cannot be the only one. Anchoring `id:` and `defaultMessage:` to the start of a
   * line rejects anything that follows a `//` or a ` * ` on the same line, which is
   * every comment style in this repo but one — a bare line inside a block comment,
   * which is what the stripper is for. A label that ever contains `//` costs a
   * dropped row and therefore a red count, which is the loud failure.
   */
  return withoutComments(block[1])
    .split(/\n(?=\s{2}\w+: \{)/)
    .map((chunk) => {
      const key = /^\s*(\w+):\s*\{/.exec(chunk);
      // Preceded by the descriptor's own opening brace or by nothing but the start
      // of a line, which is the two layouts oxfmt produces and neither of the two a
      // comment produces (`// …` and ` * …`).
      const id = /(?:^|\{)\s*id:\s*'([^']+)'/m.exec(chunk);
      const message = /(?:^|,)\s*defaultMessage:\s*\n?\s*'((?:[^'\\]|\\.)*)'/m.exec(chunk);
      return key && id && message ? `${key[1]}: ${id[1]} = ${message[1]}` : null;
    })
    .filter((row): row is string => row !== null);
}

describe('web target', () => {
  const files = filesUnder(SRC, /\.[jt]sx?$/);

  it('finds source files to check', () => {
    expect(floorFaults({ 'files under src/': { found: files.length, atLeast: 20 } })).toEqual([]);
  });

  it('imports react-native-webview only from native-only or platform-paired files', () => {
    const offenders = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (NATIVE_ONLY.some((p) => p.test(rel)) || PLATFORM_PAIRED.includes(rel)) return false;
      return /from\s+['"]react-native-webview['"]/.test(readFileSync(file, 'utf8'));
    });

    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('gives every platform-paired file a .web counterpart', () => {
    for (const rel of PLATFORM_PAIRED) {
      const web = resolve(SRC, rel.replace(/\.(tsx?)$/, '.web.$1'));
      expect(statSync(web).isFile()).toBe(true);
    }
  });

  it('reaches the bundled covers only through the platform-paired module', () => {
    // Importing the generated module directly would put every data URI back into
    // the web export, and nothing about the page would look wrong — it would just
    // be half a megabyte heavier. Exactly the failure this file exists to catch.
    const offenders = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (rel === 'lib/articles/covers.ts') return false;
      return /from\s+'[^']*offlineCovers\.generated'/.test(readFileSync(file, 'utf8'));
    });

    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('reaches the bundled articles and feeds only through the platform adapter', () => {
    // The sibling rule above, for the other generated module. `lib/platform/expo.ts`
    // is the one file that knows the bundle exists — that is what the `ContentBundle`
    // port is (ARCHITECTURE.md → The five ports, ADR 0006 and 0032). A screen that imports it
    // directly gets a list that cannot go live, evaluated once at module scope, plus
    // 6000 lines of snapshots in its route's import graph. `(tabs)/profil.tsx` did.
    const offenders = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (rel === 'lib/platform/expo.ts') return false;
      return /from\s+'[^']*articles\/offlineBundle\.generated'/.test(readFileSync(file, 'utf8'));
    });

    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('reaches the system share sheet only through the platform-paired module', () => {
    // `Share` from react-native is the native branch of `lib/shareArticle`, and the
    // reason that module is a pair at all. A second importer gets react-native-web's
    // `Share` instead, which rejects on every browser without the Web Share API —
    // a dead button, a console warning, and a green build. The failure is the one
    // the covers and the bundle above have: nothing about the page looks wrong.
    const offenders = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (rel === 'lib/shareArticle.ts') return false;
      return /import\s*\{[^}]*\bShare\b[^}]*\}\s*from\s*'react-native'/.test(
        readFileSync(file, 'utf8'),
      );
    });

    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('gives every dynamic route a generateStaticParams', () => {
    // `expo export --platform web` turns a route without it into a single
    // `[id].html`, so on a static host every real URL under it 404s. `/projekt/klima`
    // shipped that way while the build and every test stayed green
    // (TROUBLESHOOTING.md → The web target). Native never notices; it has no URLs.
    const dynamicRoutes = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      return rel.startsWith('app/') && /\[[^\]]+\]\.tsx$/.test(rel);
    });

    expect(
      floorFaults({ 'dynamic routes found': { found: dynamicRoutes.length, atLeast: 1 } }),
    ).toEqual([]);

    const offenders = dynamicRoutes.filter(
      (file) => !/export\s+function\s+generateStaticParams\b/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('declares the same five tab labels on both targets', () => {
    // The two tab bars are drawn by different files with nothing between them to
    // import a constant through, so the five labels are written out twice. One
    // shape of drift is already caught elsewhere: the same id with two different
    // English defaults changes what `npm run i18n:extract` produces, and
    // `localisation-seam.test.ts` compares that against the committed `en.json`.
    // Every other shape is silent. A web tab reusing an id that already exists
    // extracts to the same catalogue, keeps its German, and ships a bar with two
    // tabs called "Home" past a fully green `npm run check` — verified.
    //
    // So the agreement is checked where it is written: key, id, default and order,
    // one row per tab, both files.
    const native = tabLabels('app/(tabs)/_layout.tsx');

    // Also the guard against a parse that matched nothing, since two empty lists
    // are equal. A default containing an apostrophe would land here rather than
    // pass quietly — the row is dropped and the count is wrong.
    expect(native).toHaveLength(5);
    expect(tabLabels('app/(tabs)/_layout.web.tsx')).toEqual(native);
  });

  it('never imports from expo-router/tabs', () => {
    // Importing `BottomTabBar` from there to build a custom tab bar pulls a second
    // React instance into the bundle and the app dies at startup with minified React
    // error #321, on every platform, while build, typecheck and tests stay green
    // (TROUBLESHOOTING.md → The web target). `(tabs)/_layout.web.tsx` carries the
    // comment; this is the part that fails.
    const offenders = files.filter((file) =>
      /from\s+['"]expo-router\/tabs['"]/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('keeps the font files out of the theme barrel', () => {
    // `lib/theme` is the app's most-imported module: a component asks it for
    // `useColors` and, through `export * from './fonts'`, used to get
    // `@expo-google-fonts/*` with it — five `require()`s of a `.ttf` in the import
    // graph of every component in the app. Metro dedupes those into its asset
    // registry, so nothing on a phone notices; a plain bundler emits every cut the
    // package re-exports, which measured 19,828 kB against 424 kB for a single
    // `<Typo>` built outside Metro (ADR 0027). The families a component actually
    // wants are plain strings in `lib/theme/fonts.ts`; the files are in
    // `font-assets.ts`, and `lib/env/fonts.ts` is the only module that has any use
    // for them — one importer, so that the second host loads the app's five cuts by
    // loading the app's environment rather than by transcribing a list of names
    // (ADR 0028).
    const barrel = readFileSync(resolve(SRC, 'lib/theme/index.ts'), 'utf8');
    expect(barrel).not.toMatch(/font-assets/);

    const expoFonts = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (rel === 'lib/theme/font-assets.ts') return false;
      return /from\s+'@expo-google-fonts\//.test(readFileSync(file, 'utf8'));
    });
    expect(expoFonts.map((f) => relative(SRC, f))).toEqual([]);

    const importers = files.filter((file) => {
      const rel = relative(SRC, file).replaceAll('\\', '/');
      if (rel === 'lib/env/fonts.ts') return false;
      return /from\s+'[^']*theme\/font-assets'/.test(readFileSync(file, 'utf8'));
    });
    expect(importers.map((f) => relative(SRC, f))).toEqual([]);
  });

  it('routes both reader implementations through one shared props type', () => {
    // If these drift apart the platforms can diverge silently, so both must
    // import the contract rather than declare their own props inline.
    for (const variant of ['ReaderView.tsx', 'ReaderView.web.tsx']) {
      const source = readFileSync(resolve(SRC, 'components/reader', variant), 'utf8');
      expect(source).toMatch(/ReaderViewProps.*from\s+'\.\/types'/s);
    }
  });

  it('routes both video-frame implementations through one shared props type', () => {
    // The third pair, and the one whose own comment already claimed this test
    // existed: VideoFrame.tsx says `className` is part of the contract in
    // videoFrameTypes.ts and that the branches cannot drift because of it. They
    // could. `className` reaches a real DOM attribute on web and a wrapped
    // `WebView` prop on native, so a props type copied into one file is two
    // components with one name — and nothing about the build, the typecheck or a
    // screenshot of either platform alone would show it.
    for (const variant of ['VideoFrame.tsx', 'VideoFrame.web.tsx']) {
      const source = readFileSync(resolve(SRC, 'components/media', variant), 'utf8');
      expect(source).toMatch(/VideoFrameProps.*from\s+'\.\/videoFrameTypes'/s);
    }
  });

  it('routes both screen-header implementations through one shared props type', () => {
    // The same rule as above, for the pair ADR 0030 added. This one carries more
    // than shape: the props type is where the two named exceptions are declared,
    // so a copy of it in one file would let the other accept a prop it cannot
    // honour.
    for (const variant of ['ScreenHeader.tsx', 'ScreenHeader.web.tsx']) {
      const source = readFileSync(resolve(SRC, 'components/ui', variant), 'utf8');
      expect(source).toMatch(/ScreenHeaderProps.*from\s+'\.\/screenHeaderTypes'/s);
    }
  });
});
