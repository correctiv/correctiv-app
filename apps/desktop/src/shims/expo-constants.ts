// `expo-constants`, which on this host knows nothing — and says so in the one shape the
// caller already handles.
//
// ONE READER: `lib/home/layout.ts` asks for `expoConfig.extra.builtAt`, the moment
// `app.config.js` stamps into every Expo export. That stamp is the clock the home
// document's freshness is judged against: the core draws a FETCHED home layout only
// when it was published at or after the build that is reading it, because a build with
// no moment of its own cannot tell an older published document from a newer one.
//
// There is no Expo build here, so `gjsify.config.mjs` stamps the moment itself: it
// defines `__BUILT_AT__` as the ISO time of the build, the same shape and the same
// meaning as `app.config.js`'s `extra.builtAt`. With it the core draws a home document
// fetched from the published site whenever that was published at or after this build,
// and the bundled one otherwise.
//
// A build without the define (vitest, a bundle made by another config) answers `null`
// for `expoConfig`, which the caller's own docblock names as the safe branch:
// `Date.parse(String(undefined))` is `NaN`, and "NaN draws none and fetches none".
//
// fixed upstream in gjsify: #1975 - the layer refuses `expo-constants` outright, so this
// shim stays until it answers `expoConfig.extra` from the build.
//
// The rest of the surface is `null` rather than absent. `expoConfig` is declared
// nullable by expo-constants itself, so a reader that reaches further is already
// obliged to cope; a thrown "not implemented" would be a louder answer to a question
// the package's own types say may be answered with nothing.

declare const __BUILT_AT__: string | undefined;

export interface ExpoConfig {
  extra?: Record<string, unknown>;
}

export interface Constants {
  expoConfig: ExpoConfig | null;
}

const constants: Constants = {
  expoConfig: typeof __BUILT_AT__ === 'string' ? { extra: { builtAt: __BUILT_AT__ } } : null,
};

export default constants;
