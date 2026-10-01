// The desktop build.
//
// ADR 0032 section 12: the build chain belongs to the consumer. gjsify supplies the
// plugins; this file is where this application composes them, and every entry below is
// a decision rather than boilerplate.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { rnRouteManifestPlugin } from '@gjsify/rolldown-plugin-gjsify';

const HERE = dirname(fileURLToPath(import.meta.url));
const here = (...parts) => resolve(HERE, ...parts);
const shim = (name) => here('src/shims', name);

/**
 * Exact-match redirects. A bare specifier this application answers itself.
 *
 * NOT `--dialect react-native`, and that is the one genuinely awkward decision in this
 * build. The flag aliases `react-native` onto `@gjsify/react-native` and adds ADR 0032
 * section 8's build-time support gate, which is worth having — but its alias plugin is
 * `pre`, so it would also win over the redirect below, and this application needs a
 * layer in between: 110 call sites pass props the GTK layer refuses by name
 * (`hitSlop`, the five accessibility props, `pointerEvents="box-none"`), and
 * `src/shims/react-native.tsx` is where each gets ONE deliberate answer instead of 110
 * render-time throws.
 *
 * The gate is not given up. `test/support-gate.test.ts` reproduces it against the same
 * published support table, over this application's own source.
 *
 * It reproduces the IMPORT half only. This comment claimed the props half too, and that
 * was never true of either gate: a refused prop is a render-time throw per screen, and
 * three `<Typo onPress>` in `(tabs)/profil.tsx` went through this build, the typecheck
 * and that test green before ending the whole tree at startup. The test's own header
 * says what it does not cover, and names `@gjsify/react-native/prop-table` as what
 * closes it.
 */
const EXACT = {
  'react-native': shim('react-native.tsx'),
  'expo-router': shim('expo-router.ts'),
  uniwind: shim('uniwind.ts'),
  '@expo/vector-icons': shim('vector-icons.tsx'),

  // Only what `apps/mobile/src` actually imports. expo-linking, expo-web-browser and
  // expo-system-ui are declared in the app's package.json and imported NOWHERE, so
  // shimming them would be dead code pretending to be coverage. `expo-constants` was in
  // that sentence until main's home-as-data work gave `lib/home/layout.ts` a reason to
  // read the build's own timestamp through it.
  'expo-constants': shim('expo-constants.ts'),
  'expo-image': shim('expo-image.tsx'),
  'expo-video': shim('expo-video.tsx'),
  'expo-font': shim('expo-font.ts'),
  'expo-status-bar': shim('expo-status-bar.tsx'),
  'expo-splash-screen': shim('expo-splash-screen.ts'),
  'react-native-safe-area-context': shim('react-native-safe-area-context.tsx'),
  'react-native-gesture-handler': shim('react-native-gesture-handler.tsx'),
  'react-native-webview': shim('react-native-webview.tsx'),
  // Runtime-identical: a re-export with one TYPE widened. Its own header says which
  // and why, and names what removes it. `react-intl-upstream` is the real package under
  // the one name this table does not redirect, which is how that file reaches it.
  'react-intl': shim('react-intl.ts'),
  'react-intl-upstream': createRequire(import.meta.url).resolve('react-intl'),
  '@expo-google-fonts/merriweather': shim('expo-google-fonts.ts'),
  '@expo-google-fonts/source-sans-3': shim('expo-google-fonts.ts'),

  // Video is a placeholder on this host; the override's own header says why that is a
  // decision rather than a gap in the toolkit. Redirected by MODULE rather than forked
  // as a `.gtk.tsx` sibling, because a sibling would have to live inside
  // `apps/mobile/src`, where the app's typecheck and two of its recursive test guards
  // would each need an exception for it.
  '@/components/media/VideoFrame': here('src/overrides/VideoFrame.tsx'),

  // The scrubber's fill is scaled with a transform on the phone, and a transform is a
  // Gsk render node here rather than a widget property. The override sizes it instead
  // and says what that costs; same redirect mechanism, same reason as above.
  '@/components/player/ProgressBar': here('src/overrides/ProgressBar.tsx'),

  // Uniwind's CSS entry. It is the file Uniwind's Metro transform reads, and there is
  // no Metro here — the class vocabulary reaches GTK through `configureStyle`. Nothing
  // in the desktop tree imports it, but a mobile module that grows the import should
  // find an empty module rather than a bundler that cannot parse CSS.
  '@/global.css': here('src/shims/empty.ts'),

  // The app's Hermes polyfills, left out of a build whose runtime is not Hermes — the
  // same exclusion `apps/workbench/vite.app.mjs` makes, for the same reason and with
  // the argument written out in `apps/mobile/src/i18n/polyfills.ts` itself: the three
  // `require` calls are inside an `if`, which only Metro leaves inside it, and a
  // bundler that hoists them out imports some 90 KB of CLDR data per locale to replace
  // an implementation that is already present and better.
  //
  // GJS is SpiderMonkey with a full ICU, so both objects the file installs are there.
  // MEASURED on this machine's gjs 1.88.1: `Intl.PluralRules` and `Intl.Locale` are
  // both present, which is the condition each branch guards on.
  '@/i18n/polyfills': here('src/shims/empty.ts'),
};

/** Prefix redirects, longest first so `@/assets/` wins over `@/`. */
const PREFIX = [
  ['@/assets/', here('../mobile/assets/')],
  ['@/', here('../mobile/src/')],
  ['@correctiv/app-core/', here('../../packages/app-core/src/')],
  ['@correctiv/design-tokens/', here('../../packages/design-tokens/src/')],
  // The German every user-facing string is rendered in (ADR 0049). Data only — no
  // React, no platform SDK — so this host consumes it as source exactly as the phone
  // does, and the provider that reads it is `@/i18n/Localisation`.
  ['@correctiv/catalogue/', here('../../packages/catalogue/src/')],
];

/**
 * The extension search, and why it is here rather than left to the resolver.
 *
 * `@correctiv/app-core`'s exports map is `"./*": "./src/*"` — extensionless on
 * purpose, because it is only ever resolved by Metro and by this repo's tsconfig
 * paths, "both of which guess an extension" (ADR 0010). Nothing guesses once a
 * redirect has produced an absolute path, so this guesses.
 *
 * `.gtk.*` comes first, which is ADR 0032 section 9's platform chain: a
 * `Foo.gtk.tsx` beside a `Foo.tsx` wins on this host. Nothing uses it yet, and it
 * costs one array entry to leave the door open.
 *
 * The middle rung is the OS one, and leaving it out was a hole rather than a thrift.
 * gjsify's own `platformResolvePlugin` searches `['gtk', <os>, 'desktop']` — but it
 * answers RELATIVE imports only, and this plugin runs at `order: 'pre'`, so it wins for
 * every specifier the redirects above produce: every `@/…`, `@correctiv/app-core/…`,
 * `@correctiv/design-tokens/…`. Without the rung a `Foo.macos.tsx` beside a `Foo.tsx`
 * was INVISIBLE, with no error — and that shape is exactly what the macOS WebView needs,
 * so the hole was about to be stepped in.
 *
 * Order is load-bearing: `.gtk` → `.<os>` → `.desktop` → bare, most specific host first.
 * `.native` and `.web` stay OUT — they belong to Metro and to the web target, and
 * gjsify's own chain refuses them by name for the same reason.
 */
const OS_SUFFIX = { linux: 'linux', darwin: 'macos', win32: 'windows' }[process.platform];
const EXTENSIONS = [
  '.gtk',
  ...(OS_SUFFIX === undefined ? [] : [`.${OS_SUFFIX}`]),
  '.desktop',
  '',
].flatMap((platform) =>
  ['.tsx', '.ts', '.mjs', '.js', '.json'].map((extension) => `${platform}${extension}`),
);

function withExtension(base) {
  if (existsSync(base) && !statSync(base).isDirectory()) return base;
  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (existsSync(candidate)) return candidate;
  }
  if (existsSync(base) && statSync(base).isDirectory()) {
    for (const extension of EXTENSIONS) {
      const candidate = resolve(base, `index${extension}`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * The redirects, as a plugin.
 *
 * A PLUGIN rather than `bundler.resolve.alias`, and that is measured rather than
 * preferred: the alias table in this file's first version was ignored outright — the
 * build pulled the real `react-native` (`PARSE_ERROR: Flow is not supported`) and the
 * real `@expo/vector-icons` with its eight `.ttf` imports. A `resolveId` hook at
 * `order: 'pre'` is honoured.
 */
function redirectPlugin() {
  return {
    name: 'correctiv-desktop-redirects',
    resolveId: {
      order: 'pre',
      handler(source) {
        const exact = EXACT[source];
        if (exact !== undefined) return exact;
        for (const [prefix, target] of PREFIX) {
          if (!source.startsWith(prefix)) continue;
          const resolved = withExtension(resolve(target, source.slice(prefix.length)));
          if (resolved !== null) return resolved;
        }
        // `@correctiv/app-core` and `@correctiv/design-tokens` with no subpath.
        if (source === '@correctiv/app-core') return here('../../packages/app-core/src/index.ts');
        if (source === '@correctiv/design-tokens') {
          return here('../../packages/design-tokens/src/index.ts');
        }
        if (source === '@correctiv/catalogue') return here('../../packages/catalogue/src/index.ts');
        return null;
      },
    },
  };
}

/**
 * The GTK layer's peer dependencies, pinned to THIS application's copies.
 *
 * WHY IT EXISTS AT ALL. `@gjsify/react-native` declares `react`, `react-reconciler`
 * and the two React Navigation packages as PEER dependencies, which under npm's
 * hoisting means one copy in the tree and nothing to decide. `scripts/gjsify-link.mjs`
 * breaks that: a linked package's real path is inside the gjsify checkout, so every
 * bare specifier it names resolves through THAT tree's `node_modules`, where a second
 * `react` is installed as a devDependency. Two Reacts in one bundle, and the failure
 * is not a duplicate-module warning:
 *
 *     TypeError: can't access property "useMemo", z.H is null
 *
 * `H` is the hooks dispatcher on React's shared internals. The component was rendered
 * by one copy and read its hooks off the other, whose dispatcher is null outside a
 * render. It cost one build to find and reads like a bug in the layer.
 *
 * WHY THE LIST IS READ RATHER THAN WRITTEN. The names come from the layer's own
 * `peerDependencies`, so a peer gjsify adds is deduped the day it is added. A copy of
 * the list here would be a second truth, and the failure it produces is this one.
 *
 * Unresolvable names are skipped rather than reported: `solid-js` is a peer of that
 * package and this application does not use the Solid binding, so there is nothing to
 * pin and nothing wrong.
 */
function peerDedupePlugin() {
  const require = createRequire(import.meta.url);

  // `@gjsify/react-native` does not export `./package.json`, so the manifest is found
  // by walking up from the resolved entry rather than asked for by subpath.
  const manifestOf = (specifier) => {
    let dir = dirname(require.resolve(specifier));
    for (;;) {
      const candidate = resolve(dir, 'package.json');
      if (existsSync(candidate)) return JSON.parse(readFileSync(candidate, 'utf8'));
      const up = dirname(dir);
      if (up === dir) return {};
      dir = up;
    }
  };

  const peers = new Set(Object.keys(manifestOf('@gjsify/react-native').peerDependencies ?? {}));
  const pinned = new Set(
    [...peers].filter((name) => {
      try {
        require.resolve(name);
        return true;
      } catch {
        return false;
      }
    }),
  );

  /** The package a specifier names: two segments when it is scoped, one otherwise. */
  const packageOf = (source) => {
    const parts = source.split('/');
    return source.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  };

  return {
    name: 'correctiv-desktop-peer-dedupe',
    resolveId: {
      order: 'pre',
      handler(source) {
        if (source.startsWith('.') || source.startsWith('/')) return null;
        if (!pinned.has(packageOf(source))) return null;
        try {
          return require.resolve(source);
        } catch {
          return null;
        }
      },
    },
  };
}

export default {
  bundler: {
    /**
     * Compile-time substitutions, HERE rather than on the command line, because there
     * are now two build targets and a `--define` repeated per target is a define that
     * will eventually differ between them. `transform.define` is the only place
     * Rolldown reads (a top-level `bundler.define` is auto-mapped with a warning).
     *
     * Both entries are load-bearing, not hygiene. `@reduxjs/toolkit`'s ESM build reads
     * `process.env.NODE_ENV` in 57 places; undefined there re-enables `serializableCheck`,
     * which the store deliberately narrows because the audio backend dispatches twice a
     * second against a tree holding six feeds and seven podcast series.
     *
     * The value side is a JS EXPRESSION, so a string needs its own quotes.
     */
    transform: {
      define: {
        'process.env.NODE_ENV': '"production"',
        __DEV__: 'false',
      },
    },
    plugins: [
      // Before the redirects, because a peer this application answers itself — nothing
      // does today — should still win over the pin.
      peerDedupePlugin(),
      redirectPlugin(),
      // expo-router discovers routes with Metro's `require.context`, which does not
      // exist in this chain. This walks `src/app` instead and emits one module that
      // statically imports every route file, which `@gjsify/react-native/router` turns
      // into a tree using expo-router's own four file conventions.
      rnRouteManifestPlugin({ routesDir: here('src/app') }),
    ],
  },
};
