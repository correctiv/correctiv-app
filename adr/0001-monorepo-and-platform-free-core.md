# ADR 0001 — An npm workspace with a platform-free core

**Status:** accepted · **Date:** 2026-08-01 · **Affects:** repo structure, dev loop, fork strategy

## Context

The prototype was a single package: the NativeScript app at the repo root, everything
in `src/`. Three requirements break that:

1. **A dev loop without an emulator.** Measured on the development machine: a full
   redeploy 41.5 s, an emulator cold start 21 s, HMR broken in this repo. The largest
   lever available is making the platform-free half of the code testable headlessly —
   milliseconds instead of seconds, without a device.
2. **A web reference target.** NativeScript has no web renderer (see
   `APP-STRATEGIE.md` §2). A web build is therefore only reachable through a shared
   core plus a separately implemented web UI — and the core has to exist for that.
3. **Forks as workspace packages.** `nativescript-vue` has one maintainer and no commit
   since 2025-10-17. At 1,538 lines of shipped JS the package is small enough to
   maintain ourselves if it comes to that. That option should be prepared before it is
   needed.

## 1. Decision

npm workspaces, two packages:

```
correctiv-app/
├── package.json              # workspace root, delegating scripts, no code
├── tsconfig.base.json        # shared compiler options
├── apps/mobile/              # @correctiv/mobile — the NativeScript app
│   └── src/platform/         # the ONLY place with NativeScript SDK access for the core
└── packages/app-core/        # @correctiv/app-core — platform-free, testable headlessly
    ├── src/ports/            # what the core needs from its host
    └── test/                 # Vitest plus real correctiv.org fixtures
```

**Ports, not imports.** The core imports no platform SDK. What it needs from the host is
declared as an interface in `packages/app-core/src/ports/index.ts` (`KeyValueStore`,
`FileStore`) and handed over at startup through `configurePlatform()` — in
`apps/mobile/src/app.ts`. Without a registration the core falls back to an in-memory
variant, so tests and tooling need no setup.

**The boundary is tested, not merely documented.**
`packages/app-core/test/boundary.test.ts` scans every core source file for forbidden
imports (`@nativescript/*`, `@nstudio/*`, `nativescript-vue`, `react-native`, `expo`,
`node:*`) and runs as part of `npm run check`. The fix when it fails is **never** to
widen the allow-list, but to move the code into a host and declare the need as a port.

**Cycles resolved, not relocated.** `stores/audio` and `stores/video` coordinated mutual
exclusion by `await import()`ing each other — a module cycle broken at runtime. Replaced
by `media/exclusive-playback.ts`: every medium registers a stop callback, and a medium
that starts stops the others. No store imports another; a third medium (a game, a
livestream) joins without touching the existing ones.

## ⚠️ The directory is called `packages/app-core`, not `packages/core` — deliberately

`@nativescript/vite` 2.0.3, `configuration/base.js:79`:

```js
// Prefer monorepo source (packages/core) when present to match webpack5 behavior,
// else fall back to node_modules resolution.
const workspaceCorePkg = path.resolve(projectRoot, '../../packages/core/package.json');
if (existsSync(workspaceCorePkg)) {
    NS_CORE_ROOT = path.dirname(workspaceCorePkg).replace(/\\/g, '/');
}
```

The plugin assumes `<app>/../../packages/core` is the **NativeScript core source
checkout** — that is how the NativeScript repo itself is laid out. In any workspace with
`apps/*` and a directory named `packages/core` it therefore hijacks
`@nativescript/core`: `NS_CORE_ROOT` feeds three alias entries, and the build dies with
`Could not load .../packages/core/globals (imported by virtual:entry-with-polyfills)`.

Directory and package name are kept in sync (`packages/app-core` ↔
`@correctiv/app-core`) so that nobody renames the directory back "for consistency" and
silently re-arms the trap.

**Open:** report it upstream. Like the minify crash (`vite.config.ts`), this has not
been reported so far.

## Maintaining forks as workspace packages

The workspace is set up so a fork becomes a package like any other. The procedure, using
`nativescript-vue` as the example (1,538 LOC of shipped JS, MIT):

1. Put the sources in `packages/nativescript-vue/` (clone the upstream repo, remove
   `.git`, record the upstream commit SHA in the package's README).
2. Leave `"name"` in the package unchanged (`nativescript-vue`) — npm workspaces then
   put the local folder ahead of the registry version automatically, without a single
   import in the app code changing.
3. Set the dependency to `"*"` in `apps/mobile/package.json`.
4. `npm install`, then `npm run check` and a real Android build.
5. Document the changes against upstream in `packages/nativescript-vue/PATCHES.md` —
   otherwise the next upstream merge cannot be reconstructed.

Avoid a directory name ending in `core` while doing so (see above).

## Consequences

**Gained**

- `npm run check` = both typechecks plus 82 tests in **~0.4 s**, without a device. The
  loop that used to take 41.5 s now covers the data layer, the parsers and the ports.
- 34 source files are demonstrably platform-free from now on and are available
  unchanged to a web target or a change of stack.
- The feed and article parsers are pinned against real correctiv.org captures. They are
  regex-based and break silently on a WordPress theme change — this is the early
  warning for that.

**Paid**

- Two `package.json`, two tsconfigs, one alias in `vite.config.ts`.
- The core is consumed as TypeScript source (no build step). Resolution is therefore
  hard-wired through a Vite alias rather than through the workspace symlinks — the
  subpath exports carry no file extension, which Node resolution would not resolve.
- CI paths (`NS_VITE_DIST_DIR`) and the Node scripts now point at `apps/mobile/`.

**Unchanged**

- A pre-existing `vue-tsc` error in `app.ts` (`AndroidActivityBackPressedEventData`)
  only appears in the ns-vite run, which sets `--moduleSuffixes` for Android type
  resolution. Verified against `main`: present identically, not caused by this
  restructuring. The build passes either way (10.8 s).
