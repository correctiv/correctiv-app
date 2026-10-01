// app.json holds the config; this file adds the one value that cannot be static.
//
// GitHub Pages serves this app from https://correctiv.github.io/correctiv-app/,
// not from a domain root. A default export writes absolute URLs — `/_expo/...`,
// `/assets/...` — which resolve to correctiv.github.io/_expo/... there and 404,
// giving a blank page from a green build. `experiments.baseUrl` prefixes them, and
// expo-router uses the same value for its own hrefs and history.
//
// It has to be conditional: the prefix is wrong everywhere else. `npm run web`,
// `serve-clean.mjs` and the native builds all serve from a root, so only the Pages
// workflow sets EXPO_BASE_URL.
//
// The dev server sets it too, in `package.json`'s `web` script, and to the same
// `/app` the deploy uses. The workbench frames the app one directory below itself
// in both modes, so a dev server serving from the root answered `/app/` with the
// app's own 404 screen: expo-router reads the browser's path, and without a base
// it has no route called `app`. The address to open the app on its own in
// development is therefore http://localhost:8081/app/ .
//
// And one value that is different on every build: `extra.builtAt`, the moment this
// config was evaluated, which for `expo export` and a native build is the moment the
// bundle was made. The app compares it with the `last-modified` of the home document
// it fetches and draws the fetched copy only when that is not older than the build
// (`packages/app-core/src/stores/homeLayout.ts`, `fetchedHomeLayout`), so an app update
// or a local export of an edited document is not overridden by an older published one.
// It reaches the app through `expo-constants`, which embeds this config at build time.
//
// **Only a cold bundle carries a fresh one**, and that is why `build:web` passes
// `--clear`. Metro's transform cache keys a module on its source, not on the config
// inlined into it, so a second export reuses the first one's `expo-constants` and with
// it the first one's build time: measured on 2026-09-23, an export at 12:03:46 still
// carried 12:03:16, and an `EXPO_PUBLIC_` variable behaved the same (set to 2001, then
// 2002, the bundle kept 2001). A stale stamp is exactly the failure it exists to
// prevent: a local export of an edited document would show `main`'s copy instead. The
// price is the cache, 18 s for a cold export against 6 s for a warm one on the day it
// was measured. CI and EAS start cold anyway; a local native release build does not,
// and there `--clear` is on whoever builds it.
//
// And a value that is static but needs its reason beside it, which JSON cannot carry:
// `android.predictiveBackGestureEnabled: false` in app.json is a decision, not a
// default left standing ([ADR 0063](../../adr/0063-android-back-is-the-navigators-and-the-onboarding-answers-its-own.md) §2).
// Turned on, it draws nothing: React Native 0.86's `ReactActivity` keeps an
// `OnBackPressedCallback` enabled for as long as the activity lives, and Android
// previews the screen behind only when no callback is enabled. Measured on the
// emulator on 2026-09-24 with the flag on, a half-held back gesture showed the arrow
// and no preview on Home and on a pushed route, while the system's Settings app
// showed the preview under the same gesture.
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL?.trim();
  const stamped = {
    ...config,
    extra: { ...config.extra, builtAt: new Date().toISOString() },
  };
  if (!baseUrl) return stamped;

  return {
    ...stamped,
    experiments: { ...config.experiments, baseUrl: baseUrl.replace(/\/+$/, '') },
  };
};
