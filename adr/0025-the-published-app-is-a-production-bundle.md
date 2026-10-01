# ADR 0025 — The published app is a production bundle, and the workbench gives up its handle

Status: accepted, 2026-09-05.

## Context

[ADR 0024](0024-the-handbook-owns-the-root.md) publishes the app one directory below
the handbook, at `/app/`, and `apps/mobile/app.config.js` turns `EXPO_BASE_URL` into
`experiments.baseUrl` so that Expo Router knows about the prefix.

The workbench's most useful panels need the app's dev handle: the appearance setting
is written through the app's own store, and the inspector reads that store back. A
production export sets `__DEV__` false, the app leaves no handle, and both panels are
inert on the very site they are published to. So `build:web` was given `--dev`, the
deploy asserted the handle was present, and for a while this looked like a cheap win:
a third more JavaScript, and React's development warnings, in exchange for a
debuggable published demo.

## What the trade actually was

A development bundle applies `experiments.baseUrl` to asset URLs and **not to route
matching**. Every route under the base falls through to the app's own 404.

What made it hard to see is that the door still renders. `apps/mobile/src/app/_layout.tsx`
draws the sign-in door outside the router, so a signed-out visitor sees a working app,
and only somebody past the door sees anything else. Every check the deploy runs was
green, every screenshot taken of the published site was of the door, and the app was
broken for everybody it is for.

Measured on 2026-09-05, one URL and one fixture, three builds:

| build | base | signed in at `/app/entdecken` | dev handle |
| --- | --- | --- | --- |
| `--dev` | `/app` | the app's own 404 | present |
| `--dev` | `/correctiv-app/app` | the app's own 404 | present |
| production | `/app` | Entdecken renders | absent |

The live site at the time, built from `main` before this change, served the app at the
site root with base `/correctiv-app` and a production bundle, and rendered Entdecken
correctly. So this is not about the depth of the base path and not about Pages. It is
`--dev`.

## 1. Decision

`build:web` exports production. `pages.yml` fails the deploy when the bundle carries
`__correctiv`, because the handle is the tell for a `--dev` export and the assertion is
therefore the inverse of the one it used to make.

The published workbench has no store handle. It says so, on the panels that need one
and in the status line, which is what it did before `--dev` was tried and is the
behaviour `Readout` and `NeedsDev` were written for.

## What this costs

The appearance control and the inspector work against a local dev server and not
against the published site. Everything else the workbench does needs no handle and
holds on Pages: the device frame, the route field, the storage fixtures, the console,
the palette overrides and the measure checks.

The same limit applies to the dev server, which is a development bundle by definition.
~~Locally the frame reaches the app's first screen and no further, so the route field is
a desktop convenience there rather than a way to walk the app.~~ Re-measured on
2026-09-10 it reaches no screen at all: through the handbook's dev proxy, signed in with
the `onboarded` fixture, `/app/entdecken` renders the app's own 404 and so does `/app/`
itself. Only what the shell draws outside the router appears. The conclusion about the
route field is unchanged and the reason is the same, a development bundle ignores
`experiments.baseUrl` when it matches routes; the first screen was the part that was
too generous.

Since the same day the route field no longer goes through the address at all: it drives
the app's own router over the dev handle, so locally the field walks the app after all.
The address remains what it was measured to be, which is why anything else that wants a
screen in a development build has to go the same way. `TROUBLESHOOTING.md`, "The web
target", carries both measurements.

## A route that is not published, measured because somebody will want one

The component gallery asked this question on 2026-09-10 and then did not need the
answer, because publishing it turned out to cost almost nothing: every component it
draws is already in the bundle, since real screens use them, so the page adds its
catalogue and nothing else. Measured by exporting twice, with the route and without:
21,560 bytes on a 4.4 MB bundle, plus the 19,915-byte `gallery.html` that any
pre-rendered route costs. It is a published route like any other. But the measurements
are worth keeping, because the next dev-only screen will not be so lucky.

**Guarding the component is not enough.** A route whose component returns `null` unless
`__DEV__` is still pre-rendered. One throwaway route in that shape produced a 19 KB
`dist/probe.html`, a blank page at a public address, with its module still in the bundle
behind it. expo-router offers no opt-out: its route list is
`require.context(EXPO_ROUTER_APP_ROOT, true, …)` in `expo-router/_ctx.web.js`, whose
regex excludes exactly `+api`, `+middleware`, `+html` and `+native-intent`.

**Blocking the file works**, because Metro's file map is what `require.context`
enumerates. A `resolver.blockList` entry added under `process.env.NODE_ENV ===
'production'` removed the page, took the export from 70 files to 69, and left none of
the required modules in the bundle. `NODE_ENV` is the discriminator that needs no flag
anybody has to remember: `expo export` sets it, `expo start` does not.

**And the shape of a `__DEV__` guard decides whether Metro drops the module at all.**
Five variants in one production export, grepping for a string only the required module
contains: a `require` inside a function survives, whatever the condition around it,
because Metro collects dependencies from the syntax tree. Only the module-scope forms,
`__DEV__ ? require(…) : null` and `if (__DEV__) { require(…) }`, are folded away first.
`lib/store/core.ts` uses the surviving shape and its debugger stays out regardless, but
by `redux-devtools-expo-dev-plugin`'s own module-scope guard rather than by the call
site. The comment there claimed the call site did it, and now says this instead; the
code is unchanged.

## What the inspector needs, which is not this

Element-to-source needs Metro. `frame/locate.ts` posts a stack to `/symbolicate`
and a file to `/open-stack-frame`, and both are endpoints of the dev server, so
picking an element can only ever work against one and never on a static host,
whatever bundle is published there. That is worth saying plainly, because it is
easy to read "the published site has no dev handle" as the reason the picker is
quiet there, and it is not.

~~Against the dev server the whole surface works except the route field, which
reaches the app's first screen and no further, for the same base-path reason.~~
Driving the app's own router instead of its address bar was tried on 2026-09-05,
by putting `router` on the dev handle: it moved the URL and not the rendered
tree, ~~so it was not kept~~ — re-measured on 2026-09-10 it moves both, and the route
field has driven the router since. What the attempt of 2026-09-05 was missing is not
recorded; what the kept one needs is a second half, because the same upstream fork
skips `appendBaseUrl` in development as well: the router writes a path without the
base, and the shell has to put it back or the next reload of the frame leaves the app.
Both halves are `apps/handbook/src/workbench/frame/handle.ts`. Against the dev server
the whole surface works.

## What would change this

A second export. Publishing a production app at `/app/` and a development one beside
it would give the workbench a handle to talk to without breaking the app anybody
opens, at the cost of a second bundle in the artifact and a switch in the shell. That
is a real option and it is not taken here, because the published site is a demo first.

## What this retires

Nothing in an earlier record. [ADR 0014](0014-the-preview-shell-as-a-package.md)'s
note that `expo export` sets `__DEV__` false and the published demo therefore has no
handle is true again, and its open question, whether a `?debug` escape hatch should
expose the handle in an export, is still open and still undecided.
