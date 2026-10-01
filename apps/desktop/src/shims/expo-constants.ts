// `expo-constants`, which on this host knows nothing — and says so in the one shape the
// caller already handles.
//
// ONE READER: `lib/home/layout.ts` asks for `expoConfig.extra.builtAt`, the moment
// `app.config.js` stamps into every Expo export. That stamp is the clock the home
// document's freshness is judged against: the core draws a FETCHED home layout only
// when it was published at or after the build that is reading it, because a build with
// no moment of its own cannot tell an older published document from a newer one.
//
// There is no Expo build here and so no stamp, and the caller's own docblock names what
// that means: `Date.parse(String(undefined))` is `NaN`, and "NaN draws none and fetches
// none … the bundle is the safe answer". So this host renders the home screen the
// bundle ships, which is the screen it rendered before main's home-as-data work existed.
// That is the behaviour this merge was asked to keep, reached by the caller's own safe
// branch rather than by anything written here.
//
// Giving it a moment is the obvious next step and is deliberately not taken: it would
// turn on a network fetch of a published document against a clock nobody has verified
// on this host, which is a feature with a measurement attached rather than a line in a
// shim. `src/shims/react-native.tsx`'s `AppState` is the other half of the same absence
// and says the same thing from the other side.
//
// The rest of the surface is `null` rather than absent. `expoConfig` is declared
// nullable by expo-constants itself, so a reader that reaches further is already
// obliged to cope; a thrown "not implemented" would be a louder answer to a question
// the package's own types say may be answered with nothing.

export interface ExpoConfig {
  extra?: Record<string, unknown>;
}

export interface Constants {
  expoConfig: ExpoConfig | null;
}

const constants: Constants = { expoConfig: null };

export default constants;
