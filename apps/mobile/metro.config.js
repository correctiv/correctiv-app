const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');
const { withRozenite } = require('@rozenite/metro');
const { withUniwindConfig } = require('uniwind/metro');

// This app lives in an npm workspace (apps/mobile). Metro defaults to a
// single-project layout, so two things have to be spelled out or module
// resolution fails in ways that look like missing packages:
//   1. watchFolders — without the repo root, edits in packages/app-core are
//      invisible to Fast Refresh and the bundler cannot read the files at all.
//   2. nodeModulesPaths — npm hoists most dependencies to the root
//      node_modules; Metro must look there as well as in the app's own.
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
  // The core's own node_modules — its four parser packages (htmlparser2,
  // css-select, domutils, dom-serializer), which the app pulls in through
  // articles/extract/dom.ts.
  //
  // This was missing for a long time and the bundle built anyway, because npm
  // happened to hoist those four to the root. Hoisting is not a contract: it
  // depends on what else is installed, and when the workspace list changed npm
  // put them back under packages/app-core and the web export stopped resolving
  // `dom-serializer` — a package nothing had touched. With
  // disableHierarchicalLookup below, Metro cannot walk up from the core's source
  // to find them either, so the path has to be named.
  path.resolve(workspaceRoot, 'packages/app-core/node_modules'),
  // @correctiv/design-tokens and @correctiv/catalogue get no entry here, and that
  // is not an oversight: neither declares a runtime dependency, so neither has a
  // node_modules of its own for Metro to miss. The catalogue's two workspace
  // devDependencies are a test helper and a type it imports with `import type`,
  // which is erased before Metro sees the file. Both packages are found as the
  // workspace symlink in the root node_modules above. Add a line here the day one
  // of them grows a dependency — going by the paragraph above, the day it does,
  // the bundle will build anyway until npm stops hoisting.
];
// Resolve each dependency once. Without this a package hoisted to the root and
// also present locally can be loaded twice, which breaks React and any module
// holding singleton state (the store, the audio player).
config.resolver.disableHierarchicalLookup = true;

/**
 * …and this is the price of that line, paid once.
 *
 * A package that npm did NOT hoist, because a version conflict made it keep a
 * nested copy. `react-dom@19` requires `scheduler@^0.27` and react-native requires
 * a different one, so npm puts one inside `node_modules/react-dom/node_modules/`
 * — and with hierarchical lookup off, Metro cannot walk up from react-dom's own
 * source to reach it. The web export failed on `scheduler`, a package nobody in
 * this repo depends on directly.
 *
 * Retrying from the requesting file's directory is what Node would do, and it
 * finds exactly the copy npm chose for that package. It runs only after normal
 * resolution has already failed, so nothing that resolves today starts resolving
 * twice — the guarantee the line above buys is intact.
 *
 * ## A second workaround used to live here, and it is worth knowing why it went
 *
 * React Native declares `pretty-format@^29` and carries its own copy. `@types/jest@30`
 * declares a RUNTIME dependency on `pretty-format@^30` — a types package pulling a
 * runtime package — so npm hoisted v30 to the root while the app was on `jest@^29`.
 * Version 30 exports a different shape, so RN's HMR client read
 * `prettyFormat.default.default` off `undefined` and the DEV BUNDLE DIED AT STARTUP:
 * a blank page with one uncaught TypeError. It stayed unnoticed because every
 * browser check in this project ran against `expo export` output, which has no HMR
 * client.
 *
 * The workaround was a `resolveRequest` branch pointing `pretty-format` at React
 * Native's own directory. Aligning `@types/jest` to `^29` removes the conflict at
 * its source, so the branch is gone. Verified by running the dev bundle on an
 * emulator without it: the app renders and logcat reports no TypeError.
 *
 * If `pretty-format` ever breaks the dev bundle again, look at what pulls a second
 * major to the root before reaching for a resolver branch.
 */
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
  } catch (error) {
    /**
     * Last resort for the OTHER half of the price above: a package that npm did
     * NOT hoist, because a version conflict made it keep a nested copy.
     * `react-dom@19` requires `scheduler@^0.27` and react-native requires a
     * different one, so npm puts one inside `node_modules/react-dom/node_modules/`
     * — and with hierarchical lookup off, Metro cannot walk up from react-dom's
     * own source to reach it. The web export failed on `scheduler`, a package
     * nobody in this repo depends on directly.
     *
     * Retrying from the requesting file's directory is what Node would do, and it
     * finds exactly the copy npm chose for that package. It runs only after normal
     * resolution has already failed, so nothing that resolves today starts
     * resolving twice — the guarantee the line above buys is intact.
     *
     * Both this and the nodeModulesPaths entry for packages/app-core exist because
     * the build used to depend on npm's hoisting, which is not a contract: it
     * changes when the set of installed packages changes, and it did.
     */
    const from = context.originModulePath;
    if (!from || moduleName.startsWith('.')) throw error;
    return {
      type: 'sourceFile',
      filePath: require.resolve(moduleName, { paths: [path.dirname(from)] }),
    };
  }
};

/**
 * Uniwind goes on LAST, and that is a requirement rather than a preference: it
 * has to be the outermost wrapper. It replaces `transformerPath` and wraps
 * `resolveRequest`, taking whatever is already there as its base — which is what
 * keeps the two resolver workarounds above and Rozenite's own resolver intact —
 * and it rewrites every `react-native` import to `uniwind/components` so that
 * `className` reaches the core components.
 *
 * ## Rozenite, and why it is an environment variable rather than a default
 *
 * `enabled` is passed EXPLICITLY, and it has to be. `@rozenite/metro` 2.4.0 does
 * not hold itself back: with the option left undefined it logs that being on by
 * default is going away, and then switches itself on anyway unless its own
 * `isBundling()` recognises the command in `process.argv` as `expo export` or
 * `react-native bundle`. Passing `enabled` skips that check entirely, so `true`
 * would reach an `expo export` exactly as it reaches `expo start`. What keeps
 * `npm run build:web` clean is therefore this variable, which nothing in CI sets,
 * and NOT the bundler — which is why `.github/workflows/pages.yml` greps the
 * published bundle for it rather than trusting the promise.
 * [ADR 0026](../../adr/0026-react-native-review-and-hardening.md) §1.
 *
 * `npm run start:rozenite` is the way to turn it on; a plain `npm start` is the
 * app without a debugger attached.
 *
 * One shape changes here: `withRozenite` returns `() => Promise<config>`, so this
 * file exports an async function instead of the object it used to. Metro accepts
 * either.
 */
module.exports = async () =>
  withUniwindConfig(await withRozenite(config, { enabled: !!process.env.ROZENITE })(), {
    cssEntryFile: './src/global.css',
  });
