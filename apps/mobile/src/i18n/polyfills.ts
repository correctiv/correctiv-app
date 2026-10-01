/**
 * The two `Intl` objects Hermes does not ship, installed before anything formats.
 *
 * Measured against the Hermes actually in use, `hermes-android 250829098.0.17`,
 * arm64: the VM exposes `Intl.Collator`, `Intl.DateTimeFormat`, `Intl.NumberFormat`
 * and `Intl.getCanonicalLocales`, and NOT `PluralRules`, `RelativeTimeFormat`,
 * `ListFormat`, `DisplayNames`, `Locale` or `Segmenter`
 * ([ADR 0026](../../../../adr/0026-react-native-review-and-hardening.md) §6).
 * `react-intl` needs `PluralRules` for any plural message, so this is not a
 * second-language problem: the first German plural crashes without it.
 *
 * **Conditional, and `require` rather than `import`.** A static import runs on
 * every platform, and web and iOS have both objects natively — the polyfill is
 * some 90 KB of CLDR data each, parsed at startup, to replace an implementation
 * that is already there and better. Only a `require` inside the branch can be
 * skipped at runtime; Metro still bundles it, which is the trade
 * ([ADR 0025](../../../../adr/0025-the-published-app-is-a-production-bundle.md)
 * measured the same thing for the DevTools enhancer).
 *
 * Imported for its side effect by `i18n/Localisation.tsx`, whose module body runs
 * before any provider mounts. Nothing else should import it.
 *
 * **The workbench does not compile this file at all**, and that is the fix for
 * [#160](https://github.com/correctiv/correctiv-app/issues/160) rather than a
 * convenience. A bundler that is not Metro hoists the three `require` calls out of
 * the condition and into imports, and the two halves of the workbench's toolchain
 * disagree about which kind: the production build read `(ns.default || ns)` and
 * printed three `IMPORT_IS_UNDEFINED` warnings, documented in this very
 * paragraph as expected, while its dev server emitted a DEFAULT import of
 * `locale-data/de.js` — a module that exports nothing — and every page of
 * `npm run workbench` went blank on a link-time `SyntaxError`. The workbench's
 * runtime is a browser, which has both objects, so `vite.app.mjs` replaces this
 * module with an empty one and the argument is written there. Nothing below
 * changes for Metro, which is the only bundler this file is written for.
 *
 * `@formatjs/intl-relativetimeformat` is the next one, and it is missing too — it
 * arrives the first time a string says "vor drei Tagen".
 */

if (!('PluralRules' in Intl)) {
  // The `.js` is load-bearing: this package's `exports` map names
  // `./polyfill.js` and `./locale-data/*`, so the extensionless spellings the
  // README uses resolve to nothing under package exports.
  require('@formatjs/intl-pluralrules/polyfill.js');
  // The two the catalogue has, and not one more. The full locale data is megabytes
  // and Metro bundles every branch of this whether or not the condition fires, so
  // each line is a bundle-size decision rather than a runtime one. German is what
  // ships; English is here because the second language has to be renderable for a
  // check or the workbench to exercise it at all (ADR 0049 §3), and a plural
  // rendered without its data throws rather than degrading.
  require('@formatjs/intl-pluralrules/locale-data/de.js');
  require('@formatjs/intl-pluralrules/locale-data/en.js');
}

if (!('Locale' in Intl)) {
  require('@formatjs/intl-locale/polyfill.js');
}
