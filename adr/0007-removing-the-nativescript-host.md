# ADR 0007 — Removing the NativeScript host

Status: accepted, 2026-08-12. Carries out the removal
[ADR 0005](0005-react-native-over-nativescript.md) scheduled and
[ADR 0006](0006-one-core-two-hosts.md) suspended.

## Context

ADR 0005 chose Expo and scheduled `apps/mobile` (NativeScript / Vue) for removal.
ADR 0006 suspended that schedule, for a good reason: at the time the second app was
not merely a second view layer, it was a second *implementation* — its own audio
store, its own feed store, its own reader. Deleting it then would have deleted
working behaviour along with it, and the comparison between the two was still
finding real defects (see [`screens/`](../screens/), where every round of it is
recorded).

Both of those conditions have since expired.

The core absorbed the behaviour, which was ADR 0006's whole point: by the end, what
was left in `apps/mobile` was screens, a Vue store binding and one file implementing
the four ports. And the Expo app stopped being the weaker of the two — four rounds of
side-by-side screenshots closed the layout gaps, and several screens went past the
NativeScript version rather than merely level with it (the Spotlight archive, the
participate module on Home, the kicker and reading time in the hero, the CLUB badges
in the profile).

What remained was the cost ADR 0005 named first and ADR 0006 never disputed: **every
screen is built twice.** That cost is paid on each change, forever, and it now buys
nothing that is not already bought.

## 1. Decision

**`apps/mobile` is deleted. `apps/mobile-rn` is the app; the core stays as it is.**

The core is not simplified along with it. It keeps its ports, its host-agnostic
stores and both extraction backends. Those exist so that behaviour survives a change
of view layer — which is precisely what just happened, and the reason this removal
touched no behaviour at all.

~~**`apps/mobile-rn` is not renamed to `apps/mobile`**, which ADR 0005's phase 5
proposed.~~ Renamed on 2026-08-28 by [ADR 0011](0011-naming-the-app-for-release.md), which
found that with one host the framework name distinguishes nothing while the platform
is about to. The rest of this paragraph still holds as a cost estimate: the name is
in every import path, both tsconfigs, three workflows and every document here; the
rename buys a shorter directory name and costs a diff that touches everything while
proving nothing. `-rn` reads as "React Native", which is true and will stay true.

## The audit, and what it found

Removing the reference before checking against it would have been the one
irreversible mistake available here, so the check came first: every NativeScript
view, service and asset against its counterpart. Twenty-five screens, all present.
Four gaps, all closed before the deletion:

| Gap | Why it mattered | Closed by |
| --- | --- | --- |
| **Bundled podcast snapshots** | `ContentBundle.podcastSeries` answered `null` on this host, so the Mediathek fell through to the core's four-show sample seed. In a browser that is not a fallback but the normal case — Castopod sends no CORS header either | `scripts/fetch-offline-podcasts.mts`, 7 shows and 132 episodes into a generated module |
| **Sharing an article** | The NativeScript reader had the button; publishing journalism and offering no way to pass it on is a hole, not a nicety | `lib/shareArticle.ts` + a `.web.ts` branch (Web Share API, clipboard fallback) |
| **Bundled cover images** | The core's `adoptBundledImages` swaps a feed item's image for the bundled one *because* the remote URL cannot load offline. This host echoed the remote URL back, making that a no-op and an offline Home a list of grey rectangles | covers downscaled and inlined as data URIs, kept out of the web bundle by `lib/articles/covers.web.ts` |
| **Dark mode** | The Settings screen offered light / dark / system and **nothing read it**. A switch that does nothing is worse than an absent one | CSS variables plus `.dark:root`, driven by the app's own setting |

The dark mode port is the one worth reading about, because it is not a
transliteration. NativeScript did it with ~200 lines of hand-written per-class
overrides in `styles/dark.scss`. Here the colour utilities resolve through CSS
variables that `.dark:root` redefines, so **no component carries a `dark:` variant**
— the same result from the token bridge instead of from a stylesheet.

What did carry over is that file's central insight, and it is the part that would
have been lost with the code: **the grey scale is not semantic.** `grey-100` is a
page surface *and* white text on the brand red; `grey-700` is body text *and* the
video stage. A dark palette assigned by shade breaks half of those uses. So each grey
takes the dark value of its majority role, and the minority uses move to two fixed
role colours, `always-light` and `always-dark`, which mean the same thing in both
schemes. `packages/design-tokens/palette.js` states that reasoning where the next person will
need it.

Two things were checked and deliberately **not** carried over:

- **`peertube-offline.service.ts`** — an offline video download, never wired to any
  UI, built on Android's `DownloadManager` because NativeScript's `Http.getFile`
  buffers a whole response in memory. Its findings survive where they matter: the
  HLS split-track discovery is in `app/video.tsx`, and expo-video's `downloadFirst`
  is the first-party answer to the rest ([ADR 0004](0004-react-native-pivot.md)).
- **The `ns:` scripts, the Vite 7 pin, the `packages/core` naming trap** — all of
  them properties of that toolchain. [ADR 0002](0002-vite-8-rolldown-evaluation.md)
  keeps the measurement; `TROUBLESHOOTING.md` no longer carries rules for a platform
  the repo does not build.

## Consequences

- **A screen is built once.** The parity cost ADR 0006 accepted is gone. This is the
  entire benefit, and it is worth stating plainly that it is the only one.
- **The comparison is over.** `screens/nativescript/` is now the only trace of that
  app, and `screens/README.md` says so. ~~It stays: it is the record of a version
  that was, in places, the better-looking one, and its layout decisions are still
  worth reading.~~ Deleted on 2026-08-28 by [ADR 0011](0011-naming-the-app-for-release.md),
  together with `screens/draft/` and the three-way montages, when `screens/` was
  reorganised by platform.
- **CI is three jobs, not four**, and a release is one APK. The test keystore moved to
  `apps/mobile-rn/signing/` — the Expo release job was already using it, which is the
  kind of dependency a deletion finds the hard way if nobody looks.
- **The vector master of the app icon moved** to `apps/mobile-rn/assets/images/`. It
  only ever existed under `App_Resources/`.
- **The repo is fully English.** Translating the surviving German comments was a
  side effect of touching nearly every file, and `AGENTS.md` now says a German
  comment is a regression rather than a leftover.
- **Two of ADR 0006's open items are closed by disappearing**: lock-screen metadata
  and iOS live radio were both NativeScript limitations. ~~CORS on the web target is
  unchanged and still open.~~ It was neither: correctiv.org's REST API sends the
  header and its RSS feeds do not, which
  [ADR 0015](0015-reading-correctiv-org-through-its-rest-api.md) found and acted on.
- **A second host is still cheap.** Nothing here re-couples the core to React. The
  next one implements four interfaces in one file — that estimate is not theoretical
  any more, because this removal is what tested it.

## When to revisit

Not the stack question; [ADR 0005](0005-react-native-over-nativescript.md) still
holds and nothing here argues about it on the merits. What is worth revisiting is
`packages/app-core` itself: with one host, the ports could be inlined and the core
folded into the app. **Do not.** The split is what made this removal a deletion of
screens rather than a rewrite, and the reason to keep it is exactly the event that
just demonstrated it.
