# ADR 0014 — The preview shell becomes a package, and has to stay same-origin

**Status:** accepted · **Date:** 2026-09-01 · **Affects:** `tools/preview`, the app's
`public/`, the Pages workflow, one dev-only export in the app

## Context

`apps/mobile/public/preview.html` was a single dependency-free file: a device frame
around the web export, with presets, a route field and a URL that carries both. Two
things made it outgrow that shape at once.

It is not only a debugging shell. `README.md` hands out `/preview.html` as **the** way
to open the app in a browser, and `RELEASE.md` says to hand out that address rather
than the bare one. So the same page serves two audiences: someone following a link to
see the app, and someone taking the app apart.

And the work it was about to grow — control over the app's state and appearance, a
live palette, the frame's console, element-to-source — needs `@correctiv/design-tokens`
as an import and a component with state. Copying twelve colour values into an HTML
file by hand is exactly the drift `packages/design-tokens` exists to prevent.

## 1. Decision

~~A workspace package, `tools/preview`, React and Vite, whose build output is written
into `apps/mobile/public/`.~~ **Deleted on 2026-09-04 by
[ADR 0024](0024-the-handbook-owns-the-root.md)**, which moved the shell into
`apps/handbook` as its `/workbench` route. It is still React and Vite, and it still
reaches the app by same-origin property access; what is gone is the separate package
and the folder it built into.

**Not under `apps/`.** In this repo `apps/*` means *a host of the core*: it implements
the ports and owns screens ([ADR 0006](0006-one-core-two-hosts.md)). A dev tool is
neither, and `AGENTS.md` hangs its central question ("is what you are writing a
screen?") on that word keeping one meaning. Hence `tools/*`, added to the workspaces
beside `apps/*` and `packages/*`.

**The output goes into the app's `public/`, and the package has no dev server of its
own.** This is the part that looks like an accident of the build and is in fact the
whole design. ~~It is also the only way to be on the app's origin in all three
places.~~ **Narrowed on 2026-09-04 by
[ADR 0024](0024-the-handbook-owns-the-root.md)**, which assembles one origin at deploy
time and proxies `/app` in development instead, so that the handbook can own the site
root. The same-origin requirement below is untouched and is why that ADR was written
carefully; what is no longer true is that this folder is the only route to it.

## Same-origin is the constraint, not a detail

~~`@expo/cli` serves `public/` from the dev server and copies it into `dist/` on export,
so one build answers at `localhost:8081/preview.html`, at `serve-clean.mjs`'s port and
on Pages — always on the app's own origin.~~ Voided by
[ADR 0024](0024-the-handbook-owns-the-root.md): the shell is not in the app's `public/`,
so no build answers there. Same origin is still how it is reached, by assembling one
artifact and proxying in development. Every capability the tool has follows from
that and from nothing else:

| Capability | What it actually is |
| --- | --- |
| Route readback, navigation | `frame.contentWindow.location` |
| Appearance, membership, feeds | a dispatch into the app's own store |
| Onboarding skipped, cache primed | `localStorage`, which is literally the app's |
| Warnings and errors surfaced | the frame's `console`, an object we can reach |
| Live palette, outlines | a `<style>` appended to the frame's document |
| Element to source line | `fetch('/symbolicate')`, same host as the frame |

Give this package a dev server of its own, on its own port, and all six stop working
at once — silently, because the browser answers a cross-origin property access with a
`SecurityError` rather than with a broken screen. Anyone tidying this up later needs
to know that the folder it builds into is load-bearing.

For the same reason the iframe carries **no `sandbox` attribute**. The useful values
would have to include `allow-same-origin`, and `allow-same-origin` plus
`allow-scripts` on a document from this very origin is a sandbox that sandboxes
nothing. An attribute that only looks like a precaution is worse than none, so there
is a lint suppression and a comment where a reader will ask.

## What it costs, so nobody is surprised

- ~~**A build step before the app runs.** `npm run web` and `npm run build:web` build
  the shell first (`npm run preview`), because the dev server serves `public/`
  statically and would otherwise serve a stale one. `npm run preview:watch` while
  working on the shell itself.~~ Voided by [ADR 0024](0024-the-handbook-owns-the-root.md):
  neither script exists, and neither `web` nor `build:web` builds a shell.
- ~~**Generated output in the app's tree.** `apps/mobile/public/preview.html` and
  `preview-assets/` are git-ignored. A Vite plugin clears `preview-assets/` before
  each build: `emptyOutDir` cannot be used when the out directory belongs to someone
  else, and without the plugin every build leaves its hashed pair behind and
  `expo export` copies all of them into a target that is published on every push.~~
  Voided by [ADR 0024](0024-the-handbook-owns-the-root.md): nothing is generated into
  the app's tree any more, and `apps/mobile/public/` is empty.
- ~~**One more assertion in `pages.yml`.** It already checks that `dist/preview.html`
  survived the export; it now also checks that the bundle it references did.~~ Voided
  by [ADR 0024](0024-the-handbook-owns-the-root.md): the workflow asserts nothing about
  a shell inside the export. A missing asset is still a white page at the address the
  README hands out, and a green build, which is why the assertions it does carry are
  read off the assembled files.

## The one change inside the app

`apps/mobile/src/lib/store/core.ts` puts the store and the bound actions on
`globalThis` in a `__DEV__` build, guarded exactly like the Redux DevTools enhancer
above it and for the same two reasons. Storage seeding could have covered some of
this without touching the app, but only some: a dispatch speaks the core's vocabulary
instead of copying the key format `stores/persist.ts` owns, it is typed, and it lands
without a reload.

`expo export` sets `__DEV__` false, so the published demo has no handle. That is
deliberate for now and the shell renders the difference — the appearance controls
disable themselves and say why — rather than appearing to work. Whether a `?debug`
escape hatch should expose the handle in the export as well is a real question, with a
real consequence (it lands publicly), and it is not decided here.

## Limits worth knowing before relying on them

- **The palette override reaches surfaces and borders, not text.** Colour utilities
  compile to `var(--color-…)`, so redefining the property recolours every background
  and border at once. Text and icons go through `useColors()`, which resolves a hex in
  JavaScript that ends up in an inline style, and no CSS variable can reach a value
  that was resolved before the element existed. The shell chases those by matching the
  serialised inline value, which works and is a best effort, not a guarantee.
- **Nothing is written back.** `tokens/theme.css` is vendored from `wp-design-tokens`
  and stays the source of truth; the tool produces a CSS block to carry upstream.
- **Element-to-source needs the dev server.** React 19 removed `_debugSource`; what
  remains is the owner chain (`_debugOwner`/`_debugStack`), whose frames point into the
  Metro bundle and are resolved by Metro's own `/symbolicate`. A production bundle
  keeps none of it, and the panel says so instead of guessing.
- **A pinned appearance wins over the app's own control.** The setting is re-asserted
  on a timer, because `persist()` hydrates asynchronously and a single dispatch at load
  time is a race it can lose — observed losing it in one of two otherwise identical
  runs.

## What this retires

Nothing in an earlier ADR. One claim outside them stopped being true: `README.md` said
"Dark mode, safe-area insets and touch are not simulated. Those stay DevTools' job."
The appearance setting is now controlled from the shell, and the sentence has been
narrowed to the two that still hold.
