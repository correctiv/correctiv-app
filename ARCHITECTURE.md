# Architecture

One core holds the behaviour. The app holds its screens and one adapter.

```text diagram=core-host
        ┌────────────────────────────────────────┐
        │           packages/app-core            │
        │                                        │
        │   model · parsers · services · cache   │
        │   articles · feeds · audio · stores    │
        │                                        │
        │   imports NO UI framework,             │
        │   NO platform SDK                      │
        └───────────────────┬────────────────────┘
                       ports│
        ┌───────────────────┴────────────────────┐
        │              apps/mobile               │
        │           Expo / React Native          │
        │           iOS · Android · web          │
        └────────────────────────────────────────┘
```

Why keep the split with only one host? A view layer is the part any framework change
rewrites anyway, and the domain is not. This repo has already replaced its whole view
layer once, and when the old host was removed the feed cascade, the reader, the audio
state machine and the membership logic did not move. That is the split paying for
itself, and the same reason a third host costs one file rather than a rewrite.
[ADR 0006](adr/0006-one-core-two-hosts.md) records how the behaviour got here.
`packages/app-core/test/boundary.test.ts` fails the build if a platform import ever
appears in the core.

## The five ports

Everything the core cannot do on its own is declared in
`packages/app-core/src/ports/index.ts` and supplied at startup with
`configurePlatform(...)`. That file is the whole cost of adding a host.

| Port | What the host answers | How this host answers it |
| --- | --- | --- |
| `KeyValueStore` | small settings, asynchronously | MMKV, the store holding what the reader chose |
| `BlobStore` | the HTTP cache, asynchronously | a second MMKV store, bounded and evictable |
| `ContentBundle` | what shipped inside the app | generated TS modules |
| `AudioBackend` | playback, as status ticks | expo-audio's status events |
| `ErrorReporter` | where a fault goes | a log line, and nothing else yet |

Both storage ports are asynchronous, and what separates them is what they hold: a
settings string against a megabyte of cached feeds. `KeyValueStore` was synchronous
once, because `persist()` read it while a store was being constructed — which forced
this host to keep an in-memory mirror, hydrate it before the first render, and carry
a data-loss trap in two file headers. Redux moved store construction to module load
and made `persist()` a later call the host already awaits, so there was nothing left
to be earlier than. [ADR 0009](adr/0009-redux-toolkit-for-the-cores-state.md) records
the change and what it deleted.

**They stay asynchronous under MMKV, which can answer without a promise.** Making
them synchronous again would buy back exactly that mirror and that trap, because a
port is synchronous for every host or for none, and MMKV's web build behind
localStorage is no more able to answer before the first frame than AsyncStorage was.
A synchronous backend under an asynchronous port simply resolves a value.
[ADR 0026](adr/0026-react-native-review-and-hardening.md) §4 has the swap and its
measurements.

`ErrorReporter` is the fifth and the newest, and it is declared before anybody has
chosen what receives a report. The expensive half of reporting is the shape — where
a fault is reported from, what it carries, and whether the core may report at all —
and none of that depends on the service. So the port exists, its default reports
nowhere, and choosing a provider is a change to
`apps/mobile/src/lib/platform/expo.ts` and to nothing else. A report carries a code,
a domain and whatever context the caller already held, never a sentence; two places
report, the host's error boundary and the core, and a screen is deliberately not one
of them. [ADR 0032](adr/0032-a-port-for-the-error-report-before-a-provider-for-it.md)
argues all of it, and [#95](https://github.com/faktenforum/correctiv-app/issues/95)
still holds the question it does not answer.

**Two stores, not one, and that is the eviction policy's fence.** The cache has a
count limit, a byte budget, a maximum entry size and least-recently-used eviction
(`packages/app-core/src/services/cache.service.ts`, where the limits carry the
measurements they were derived from). Eviction speaks only to `BlobStore`, and
`BlobStore` is a different MMKV instance from the one holding bookmarks, settings and
the session — two files on device, two key prefixes in localStorage. So a bookmark is
not merely not evicted; it is not addressable by the code that evicts.

The adapter is `apps/mobile/src/lib/platform/expo.ts`, and it is small on purpose.
While the repo had a second host, one file per host knew the platform SDK, so
dropping a host meant dropping that file plus its screens. It is one file on all
three platforms: `react-native-mmkv` 4.3.2 ships a web build backed by localStorage,
so there is no platform split here to keep in step.

## Three conventions in the core

1. **State is framework-neutral.** `stores/` is one Redux Toolkit store with several
   slices. The core owns the slices and exports `createAppStore()`; the **host**
   constructs the instance, which is what lets it pass the DevTools enhancer
   ([ADR 0023](adr/0023-the-host-constructs-the-store.md), and `stores/store.ts` for
   the argument). The host adds the reactivity binding with it,
   `apps/mobile/src/lib/store/core.ts` over react-redux. A second host once bound the state this replaced to Vue's
   `reactive` in about forty lines, which is the measure of what framework-neutral
   bought.
2. **Derived values are exported selectors taking state, never store methods.** In
   React a method is merely awkward. The rule comes from the Vue binding, where a
   method read past the dependency tracking and the template silently stopped
   updating, invisible until a demo.
3. **Subpath imports, no barrel.** `@correctiv/app-core/stores/session`, not a
   root re-export. The root entry exposes only the ports, because that is the one
   thing every host must touch.

`membership.isMember` was the demo's central lever, read in the render path by every
club touchpoint. The whole slice is gone. Behind the door everyone has an entitlement
that includes the app, so a branch on it asks a question with one answer
([ADR 0018](adr/0018-removing-the-guest.md)); the flag itself was a second stored
answer to what `memberSince` already said
([ADR 0019](adr/0019-identity-lives-in-the-session.md)); and the contribution it was
left holding went with the join flow, because the app offers no payment functions
([ADR 0020](adr/0020-no-contribution-in-the-app.md)). Who is signed in is
`stores/session`, and for "may this person be here" the answer is `useIsAdmitted`.

## The door

The app is for members whose membership includes it, so the root layout renders one
of two things: the route tree, or `components/gate/LoginGate` in its place. That is a
render branch on `isAdmitted(state.session, now)`, not a redirect. A redirect leaves
every route reachable by address, and on the static export every route is an address;
a branch mounts none of them. The onboarding jump stays a redirect and waits behind
the door, taken at the moment of admission.

What the door reads is `stores/session`: an account and an `Entitlement` (the tier,
whether the app is included, why, until when), as the membership system answered it.
It never reads an amount, because a trial month pays 0 € and has the app, and a
local-newsletter bundle has the app without being an app membership. There is no
amount in the app to read. Sign-in is
simulated in `services/auth.service.ts` against a directory of rules the screen
prints, and that file is the seam to beabee.
[ADR 0016](adr/0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md).

The web demo's fixtures carry a session for the same reason: `/preview#/?s=signed-in`
is a member's first start, `s=no-access` is the door's fourth state, and every fixture
that shows a screen signs in first.

**Why the directory is `packages/app-core` and not `packages/core`:** the original
reason was a build trap in the previous host's bundler, which mistook a directory
called `packages/core` for its own framework source and hijacked the resolution. That
host is gone and the trap with it, but the name stays. It is in every import path in
the repo, and a rename would be churn for nothing.
[ADR 0001](adr/0001-monorepo-and-platform-free-core.md).

## The article path, end to end

The one worth tracing, because it crosses every layer.

```text diagram=article-path
a tap on a card
  → loadArticle(url)                    articles/load.ts
      1. platform().content.article()    the host's bundle, no network
      2. getCached()                     a fresh read from earlier today
      3. fetchWpArticle(url)             the REST API: one request, everything
      4. fetchText() → extract(html)     the page, for what the API cannot answer
      5. getStale()                      expired beats absent
  → buildReaderHtml(article, copy)      articles/reader-html.ts
  → ReaderView                          WebView on native, iframe on web
```

Rung 3 arrived with [ADR 0015](adr/0015-reading-correctiv-org-through-its-rest-api.md)
and answers everything rung 4 used to scrape for, the fact-check verdict included. Rung
4 stays because a plugin can switch the API off per endpoint, and because it is the only
rung that works on a URL the API does not know — every page in the app that is not a
post.

`buildReaderHtml` owns the document: structure, class names, which words it prints and
the verdict plaque. It does not own the WORDS. A document built as a string for a
WebView can reach no provider, so `ReaderCopy` is a required second parameter and
`READER_COPY` names the descriptors the host has to format
([ADR 0026](adr/0026-react-native-review-and-hardening.md) §6). The host supplies
those and the CSS, which here means the token variables and the fonts base64-embedded
in a `<style>`, because the WebView is a browser context of its own and cannot use the
fonts React Native loaded. Dark mode costs one appended variable block, since
`READER_LAYOUT_CSS` takes every colour from `--var-color-*`.
See `apps/mobile/src/lib/articles/reader.ts`.

## Where things are

In the core, `ports/` and `types/` hold the contracts, `articles/` the Article model
and its load cascade, `services/` the HTTP, cache, WordPress REST, RSS, search,
podcast, PeerTube, Spotlight and radio clients, `stores/` the Redux slices, `data/`
the typed content, `lib/` the
dependency-free string and date helpers, and `media/` the rule that only one medium
plays at a time. `articles/extract/` holds two backends, string and DOM, behind one
`ArticleExtractor` type.

In the app, `src/app/` is expo-router's route tree, `src/components/ui/` the design
system, `src/components/gate/` the door, and `src/lib/` the wiring: `platform/` implements the ports, `audio/` wraps
expo-audio, `feeds/` puts React hooks over the core's feed store, `theme/` re-exports
the tokens with the palette hook. `src/components/reader/`,
`src/components/media/` and `src/components/ui/ScreenHeader` are the three platform
splits, each a `.tsx`, a `.web.tsx` and a shared props type.

Outside both, `apps/workbench` is the published site: the repository's own documents,
the source inventory, the diagrams, a reference generated from the core, and the app
itself in a device frame at `/preview`. It is a second host in the sense that
matters here, a thing with screens, but it hosts the documentation rather than the
core, and it implements no port.

The device frame was its own workspace, `tools/preview`, and built into
`apps/mobile/public/` so that it stayed on the app's origin
([ADR 0014](adr/0014-the-preview-shell-as-a-package.md)). Same-origin is still what
lets it reach the frame at all, and it is now reached differently: the Pages deploy
uploads the workbench and the app's export as one artifact, so `/` and `/app/` are the
same origin, and in development the workbench's Vite server proxies `/app` to the
app's dev server ([ADR 0024](adr/0024-the-handbook-owns-the-root.md),
[ADR 0037](adr/0037-the-whole-site-is-the-workbench.md)).

## Generated artefacts

Committed, so a fresh clone builds. Regenerate only when the source changes. A test
regenerates the tokens and byte-compares on every CI run, so forgetting is a failed
PR rather than silent drift.

| Command | Produces |
| --- | --- |
| `npm run tokens` | Tailwind v4 `theme.css` (both colour schemes), typed TS constants, reader CSS |
| `npm run offline-articles` | feed snapshots, pre-extracted articles, inlined covers |
| `npm run offline-podcasts` | per-show Salon5 snapshots |
| `npm run fonts` | base64-subsetted reader fonts (needs `pyftsubset`) |

`npm run offline-articles` additionally needs ImageMagick for the covers. Without it
it says so and writes none, and the app falls back to remote URLs. The collecting
half of that generator lives in `@correctiv/app-core/articles/offline-bundle` rather
than in the script, which is what let a second host bundle the same content in a
completely different file format.

The token generator lives in `packages/design-tokens` so a second consumer, the
CORRECTIV WordPress CMS, can import the same values. Its `theme.css` is plain
Tailwind v4 and needs nothing from this repo to be useful. The app keeps only what is
meaningless outside it, the loaded font family names. It reads `tokens/theme.css`
through `scripts/tokens-source.mjs`, which resolves it by a marker rather than by
counting `../`, because a hard-coded depth broke the bridge when the app moved into
`apps/*`.

## Colour, and the two schemes

Colours reach components as CSS variables, not as hex values. The generator emits
each palette into an `@variant light` / `@variant dark` block in
`packages/design-tokens/theme.css`. Uniwind scans those, registers the names as
Tailwind theme keys, and generates the values under both a `.light`/`.dark` class on
the element or an ancestor and a `prefers-color-scheme` fallback. So `bg-canvas`
and `border-stroke` follow the appearance setting **without a single `dark:`
variant in the app**, and neither half can be left waiting on the other.

**The names come in three tiers**, since wp-design-tokens `8ed7a28`
([ADR 0022](adr/0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md)):

| Tier | Examples | Follows the scheme |
|---|---|---|
| semantic | `canvas`, `surface`, `on-canvas`, `on-canvas-muted`, `stroke`, `accent` | yes — reach for these |
| primitive | `white`, `black`, `neutral-100…700`, `red-500`, `yellow-400` | **no** — they name values |
| deprecated v1 | `grey-100…700`, `emphasis`, `alternative` | yes — aliases, nothing new should use one |

Two things do not follow it, on purpose.

- **The primitives, and the role colours that predate them.** A primitive names a
  value, so it is the same colour in both schemes — right for anything sitting on a
  surface that does not switch either: text on the brand red, the label on club
  yellow, the scrim over a photograph, the video stage. In `apps/mobile` that case is
  still written `always-light` / `always-dark`, which are exactly `white` and
  `neutral-700`; ADR 0022 retires them. `packages/app-core` must use the primitives,
  because the role names are this app's invention and never reach the reader's WebView.
  This is the tier that answers what the flat grey scale could not: `grey-100` was a
  page surface *and* white text on a button, and those are `canvas` and `white` now.
- **Colours read in TypeScript.** An `<Ionicons color>` or a `Switch`'s `trackColor`
  takes a plain string, and a string cannot change with the scheme. Those call
  `useColors()` from `lib/theme`. Importing `colors` directly still works and is
  still right for a role colour.

The dark values live in `packages/design-tokens/palette.js`, hand-written, because
~~`tokens/theme.css` ships a dark block that is a placeholder holding the light
values.~~ ~~That file explains how each grey was assigned by role.~~
`__tests__/tokens.test.ts` fails if the role colours ever start following the scheme,
or if the dark palette silently becomes the light one again.

> Both struck claims are voided by
> [ADR 0022](adr/0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md).
> Upstream deleted the placeholder block, so `theme.css` now ships no dark values at
> all; and `palette.js` assigns a value per semantic **role** rather than per grey.
> That the dark values are this repo's to write is unchanged, which is why the
> sentence around them still stands.

## The web target

`apps/mobile` exports to static HTML, and that export is the published demo, best
opened through the device frame at
<https://faktenforum.github.io/correctiv-app/preview>. Same routes, screens and
core as the native builds, with two host-level differences.

- **The three platform splits.** `ReaderView` and `VideoFrame` each have a `.web.tsx`
  sibling, an `<iframe>` where native uses a WebView. So does `ScreenHeader`, since
  [ADR 0030](adr/0030-the-platforms-header-and-ours-on-web.md): iOS and Android
  configure the platform's stack header, and web keeps the app's drawn bar, because
  `react-native-screens` makes every part of that header a bare `View` on web.
  `__tests__/web-target.test.ts` fails if a component without a web implementation
  reaches the bundle.
- **Feeds are live here too, since [ADR 0015](adr/0015-reading-correctiv-org-through-its-rest-api.md).**
  This entry used to read "no feed is ever live", because a browser blocks every
  CORRECTIV *RSS* request. It still does. The REST API is the app's network path now
  and it reflects whatever `Origin` it is given, so the store's cascade reaches the
  network before it reaches the bundled snapshot. The snapshot is the floor for a
  reader with no connection, not the ceiling for everyone in a browser.

`.github/workflows/pages.yml` rebuilds and publishes it on every push to `main`. It
is worth using while developing, because back-without-history and directly opened
routes can only be tested where URLs exist at all.

The published copy is the demo half of the frame only. `expo export` sets `__DEV__`
false, so the appearance control has no dev handle to talk to and disables itself,
and element-to-source has no Metro to ask; both want `npm run web`. The storage
fixtures, the console, the palette and the checks need neither and hold on Pages.

## Checks

`npm run check` at the root is the fast inner loop: typecheck, oxlint, oxfmt, tests,
in about twenty-one seconds without a device — 21.3 s, 21.3 s and 21.4 s over three
warm runs on 2026-09-17. This line said ten for months, then nineteen for two days,
which is what a duration typed into prose does: it is taken once, the suite only
grows, and nothing reads the sentence back. Re-take it rather than trust it, and read
it as wall clock on one machine. It covers the parsers, the German formatters, every
cascade, the platform adapter and the architectural guards.

Linter and formatter are [oxlint](https://oxc.rs) and oxfmt rather than
ESLint/Prettier, so there is no plugin or parser config to maintain. Markdown and
`.github/` are deliberately excluded from formatting, see `.oxfmtrc.json`.

**A green check is not evidence.** Read the first section of
[TROUBLESHOOTING.md](TROUBLESHOOTING.md) before trusting one.
