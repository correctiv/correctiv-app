# ADR 0002 — Vite 8 / Rolldown: measured, not adopted yet

**Status:** ~~rejected for now, revisit~~ · void since [ADR 0027](0027-the-handbook-draws-the-apps-components.md) · **Date:** 2026-08-01 · **Affects:** bundler, build time, two open upstream blockers

> **Moot since [ADR 0007](0007-removing-the-nativescript-host.md) (2026-08-12):** the
> app this measured no longer exists in the repo, and the surviving app bundles with
> Metro. Kept because the measurement — how a bundler can drop polyfills and stay
> green — is the finding, not the version number.
>
> **And the rejection itself is void since
> [ADR 0027](0027-the-handbook-draws-the-apps-components.md) (2026-09-11):** Vite 8
> and Rolldown are what `apps/handbook` builds with, and what the repository root
> resolves. The status above and the decision line below are struck; nothing else
> here is.

## Context

Two of the four blockers documented in `APP-STRATEGIE.md` §3 hang on the bundler:
release builds only work with **minification switched off** (a minified bundle crashes
at startup), and **HMR is broken** — both with the same signature,
`Module evaluation promise rejected: bundle.mjs`.

Vite 8 replaces esbuild + Rollup with **Rolldown**, which is exactly the pipeline this
fault sits in. That was worth measuring rather than assuming.

The template was the sibling project **[gjsify](https://github.com/gjsify/gjsify)**
(MIT), which has already gone this way in `@gjsify/nativescript-vite`: a NativeScript
integration test runs there on `@nativescript/vite@2.0.3` **together with `vite@^8`**.

## What was tried

Two routes, both on this project, both as far as a real `ns build android`:

1. **`@nativescript/vite@8.0.0-beta.0`** (`vite: ^8.0.0`, the native Rolldown line).
   Fails immediately: `Could not resolve entry module "index.html"`, 0 modules
   transformed — **with the plugin config untouched as well**, and through the real CLI
   path. So it is the beta, not our configuration.
2. **`@nativescript/vite@2.0.3` + `vite@8.2.0`** via npm `overrides`, with the three
   interventions from gjsify:
   - remove the function-valued `resolve.alias` entries (Rolldown rejects them),
   - remove `@rollup/plugin-commonjs` (crashes Rolldown with
     `Cannot read properties of undefined (reading 'currentLoadingModule')`),
   - remove the bundler-side `ns-vue-tsc-check` (a bundler should bundle; the
     authoritative gate is `npm run check`).

   Additionally necessary, because Vite 8 **ignores** the plugin's esbuild options and
   with `build.target: 'esnext'` relies on `esbuild.target: 'es2020'`: set
   `build.target: 'es2020'` and `oxc.keepNames: true` explicitly.

## Result: it works — and does resolve a blocker

| | Vite 7 / Rollup | Vite 8 / Rolldown |
|---|---|---|
| `vite build` | 10.3 s | **1.5 s** |
| `bundle.mjs` | 415.0 kB | 352.5 kB |
| `vendor.mjs` | 2,670.7 kB | 2,350.2 kB |
| `ns build android` (clean) | 28.6 s | 26.1 s |
| **Minification** | startup crash | **works** |

The minified build was installed on the emulator (API 36) and launched: the process
lives, `topResumedActivity` is the NativeScriptActivity, **no** `NativeScriptException`,
**no** `Module evaluation promise rejected`. Minified, the bundle shrinks to 181.8 kB
and the vendor chunk to 1,229.9 kB — roughly half.

**The long-documented minify crash is gone under Rolldown.**

## Why it is still not adopted

The build is green, the app starts — **and the entire network layer is dead.** In
logcat, on every feed:

```
E JS : CONSOLE ERROR: Feed fetch 'recherchen' failed: XMLHttpRequest is not defined
```

The NativeScript polyfills never reach the bundle. Counted in the emitted vendor chunk:

| | Vite 7 | Vite 8 |
|---|---|---|
| `installPolyfills` | 12× | **0×** |
| `XMLHttpRequest` | 25× | 2× |

Checked against a **baseline on the same emulator**: with Vite 7, no such errors and the
app runs normally. So it is a regression of the Vite 8 configuration, not a pre-existing
bug.

Two hypotheses were tested and **both refuted**:

- *Rolldown tree-shakes the side-effect import away* → `treeshake: { moduleSideEffects: true }`
  in `build.rollupOptions` changes nothing (`installPolyfills` stays at 0).
- *The discarded function alias `@nativescript/core/(.+)/index` breaks resolution of
  `@nativescript/core/globals/index`* → rewritten into the string form Rolldown accepts,
  with a `$1` back-reference, against the real `@nativescript/core` path; changes
  nothing either.

The cause therefore lies elsewhere — probably in how Rolldown treats the plugin's
`virtual:entry-with-polyfills` module. Digging further was not justified at this point:
the benefit is real, but the change must not cost the data layer.

## 1. Decision

~~**Stay on `@nativescript/vite@2.0.3` / Vite 7.** Minification stays off.~~ Void since
[ADR 0027](0027-the-handbook-draws-the-apps-components.md).

> `apps/handbook` has built with Vite 8 and Rolldown since 2026-09, and every package
> that resolves `vite` from the repository root now gets 8 as well. The measurement
> below is what this record is kept for.

## Revisit when

- `@nativescript/vite@8.x` leaves beta — interventions (1) and (2) fall away anyway
  then, and the polyfill path is rewritten upstream;
- or when gjsify solves the polyfill problem (a NativeScript smoke test runs there
  against Vite 8, which touches exactly this question).

The gain would be considerable: **7× faster builds, ~15 % smaller bundles, and two of
the four blockers cleared in one go.** The configuration is preserved in this branch's
history and described completely in this document.

## Incidental finding

The bundler-side `ns-vue-tsc-check` is the source of the long-standing, seemingly
inexplicable `AndroidActivityBackPressedEventData` message in `app.ts`: it starts its
**own** TypeScript program with `--moduleSuffixes` for Android type resolution, whose
result differs from the app's tsconfig. Remove the plugin entry and the message
disappears — without hiding a real type error, because `npm run check` (tsc + vue-tsc)
still runs and is green. That is applicable independently of Vite 8, should the message
become a nuisance.
