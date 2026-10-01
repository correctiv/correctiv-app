const preset = require('jest-expo/jest-preset');

/**
 * Packages jest must transform rather than take as-is, one alternative per line so
 * that adding one is a one-line diff with a reason next to it.
 *
 * Everything here ships ESM that Node's CommonJS require cannot read. Leaving a
 * package off does not degrade gracefully: the suite fails to RUN, with a
 * SyntaxError on the dependency's `export {` that names the importing file rather
 * than the package — so the message points at app code and the real culprit is a
 * dependency nobody touched.
 *
 * These are alternatives inside a negative lookahead, and the group is anchored on
 * `node_modules/` with NO leading slash. That matters: the parser block below is
 * installed under `packages/app-core/node_modules/`, not at the root, and a leading
 * slash would still match it — but see the hoisting entry in TROUBLESHOOTING.md for
 * why the location is not a contract and this pattern must not depend on it.
 */
const TRANSFORMED_PACKAGES = [
  // --- Expo and React Native ------------------------------------------------
  // jest-expo's own list, carried verbatim, because `transformIgnorePatterns` is
  // REPLACED rather than merged: spreading `...preset` first does not preserve it.
  // Several of these (`sentry-expo`, `native-base`, `@unimodules/*`,
  // `unimodules`, `react-navigation`, `react-native-svg`) are not dependencies of
  // this app at all and are inert — they stay because this list is a copy of the
  // preset's, and pruning it would be a change in behaviour on the day one of them
  // arrives as a transitive dependency.
  '(jest-)?react-native',
  '@react-native(-community)?',
  'expo(nent)?',
  '@expo(nent)?/.*',
  '@expo-google-fonts/.*',
  'react-navigation',
  '@react-navigation/.*',
  '@unimodules/.*',
  'unimodules',
  'sentry-expo',
  'native-base',
  'react-native-svg',

  // --- Styling --------------------------------------------------------------
  // The styling engine, since ADR 0008. Every component file reaches it through
  // the className prop, so this one takes the whole suite down when it is missing.
  'uniwind',

  // --- State ----------------------------------------------------------------
  // The core's store is one Redux Toolkit instance; the four below are what it
  // pulls in. immer is the one that actually breaks — it is where the SyntaxError
  // described above comes from.
  '@reduxjs/toolkit',
  'immer',
  'redux',
  'react-redux',
  'reselect',

  // --- Localisation ---------------------------------------------------------
  // react-intl 10 and the whole @formatjs stack under it are ESM-only — no
  // "main", no CommonJS build — so every suite that renders a screen fails to RUN
  // without these three lines.
  'react-intl',
  '@formatjs/.*',
  'intl-messageformat',

  // --- The HTML parser stack ------------------------------------------------
  // htmlparser2 is the article extractor's DOM backend
  // (packages/app-core/src/articles/extract/dom.ts) and the RSS parser's reader.
  // The core declares htmlparser2, css-select, domutils and dom-serializer; the
  // rest arrive underneath them and need transforming just the same, which is why
  // a transitive dependency has to be named here explicitly.
  'htmlparser2',
  'css-select',
  'css-what',
  'domutils',
  'dom-serializer',
  'domhandler',
  'domelementtype',
  'entities',
  'boolbase',
  'nth-check',
];

/** @type {import('jest').Config} */
module.exports = {
  ...preset,
  // Pure logic tests (token bridge, feed parser, extraction) need no RN setup but
  // run happily under jest-expo. Node scripts under scripts/ are covered too.
  testMatch: ['**/__tests__/**/*.test.{ts,tsx,js,mjs}'],
  /**
   * The preset's own setup first, then the doubles every suite used to copy. Spread
   * rather than replaced: jest-expo's entries are what install the React Native
   * environment, and dropping them takes the whole suite down.
   */
  setupFiles: [...(preset.setupFiles ?? []), '<rootDir>/__tests__/support/mocks.ts'],
  transform: {
    ...preset.transform,
    // @correctiv/app-core ships two .mjs modules (the feed parser and the article
    // extractor). jest-expo's transform only matches .js/.jsx/.ts/.tsx, so importing
    // anything that reaches them fails with "Cannot use import statement outside a
    // module". Spread the preset's transform rather than replacing it, or the React
    // Native transforms go away with it.
    '^.+\\.mjs$': 'babel-jest',
  },
  moduleNameMapper: {
    /**
     * This ONE entry has to come before the preset's.
     *
     * jest-expo derives its moduleNameMapper from tsconfig.json "paths" (verified:
     * the preset already carries ^@/(.*)$, ^@/assets/(.*)$ and both
     * @correctiv/app-core patterns — so none of those need mirroring here). But
     * jest takes the first pattern that MATCHES and does not fall through when the
     * file is missing, while tsc consults only the first matching pattern and needs
     * the generic one there so that `declare module '*.mp3'` can apply.
     *
     * Two tools, opposite orders. tsconfig.json keeps the order tsc needs and this
     * line carries the difference: without it, importing the bundled sample episode
     * makes the whole suite fail to run with "Could not locate module".
     */
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    ...preset.moduleNameMapper,
  },
  // Transform everything under node_modules EXCEPT the packages listed above.
  transformIgnorePatterns: [`node_modules/(?!(${TRANSFORMED_PACKAGES.join('|')}))`],
};
