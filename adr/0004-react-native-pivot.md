# ADR 0004 — Move to React Native / Expo, with a web target

**Status:** decided, being implemented · **Date:** 2026-08-05 · **Affects:** stack, repo layout, web demo

## Context

[ADR 0003](0003-audio-capability-spike.md) had passed the last open gate for
NativeScript, and `APP-STRATEGIE.md` rev. 2 recommended staying. That decision is hereby
**reversed** — not because the recommendation was wrong, but because two requirements
arrived that it did not cover:

1. **A web target for demo purposes.** NativeScript has none and will not get one:
   `ns platform add linux` answers "Valid platforms are iOS, Android or visionOS", a web
   renderer has been officially rejected (Discussion #10622), and `@nativescript/linux`
   does not exist on npm. That is not a question of effort but a capability gap.
2. **The app versions present in the repo are to be merged.**

## What the inventory found

There were not two artefacts but four — one of them outside this repo:

| Artefact | Location | Size |
|---|---|---|
| NativeScript app | `apps/mobile` | 43 SFCs / 4,346 LOC `.vue` + 1,378 LOC `.ts` |
| Shared core | `packages/app-core` | 2,168 LOC `.ts` + 329 LOC `.mjs`, 82 tests |
| "Web version" | `docs/` | 1,993 LOC HTML — **generated**, not code |
| Expo prototype | sibling repo, no remote | 23 tsx / 828 LOC + 28 ts / 1,437 LOC |

**The "web version" is not a port candidate.** `docs/` is copied in by
`scripts/deploy-demo.sh` from the sibling repo `design-entwurf/project`: `.dc.html`
components that `support.js` resolves at runtime via `<dc-import>`. It is the **design
draft**. Merging here means: the draft stays the design source, and the Pages slot gets
the real Expo web build.

## 1. Decision

Move to `apps/mobile-rn` (Expo SDK 56, RN 0.85.3, React 19.2.3), **build the Expo
prototype out rather than starting over**, and delete `apps/mobile` once it reaches
feature parity.

### Why build out and not start over

- **Operational knowledge is encoded in it.** `lib/feeds/sources.ts` documents the
  "static page trap" (article feeds only under `/category/<slug>/feed/`) and "Icecast
  answers HEAD with 400". A fresh start works out the same traps again.
- **Reasoned architecture decisions**, commented in the code: `cachedFetch` explains why
  no TanStack Query ("the offline order should be explicit and deterministic, so the
  demo never depends on Wi-Fi").
- **It is current:** New Architecture, `experiments.reactCompiler: true`, and
  `useAsyncData` is deliberately written to be React-Compiler-compliant.
- **The audio question is already solved there.** `react-native-track-player` is broken
  under RN 0.85 New Arch, hence `expo-audio` — documented in the prototype's README.

### What decided it: audio and iOS

`expo-audio` provides as a **first-party API** exactly what ADR 0003 had to reach past
the plugin to the platform API for, on Android:

| Requirement | NativeScript | Expo |
|---|---|---|
| `Authorization` header on the stream | plugin knows no headers → platform API directly | `headers` on the `AudioSource` |
| background playback | manual, foreground service open | `shouldPlayInBackground`, config plugin |
| lock screen | MediaSession by hand | `setActiveForLockScreen()` |
| offline | DownloadManager by hand | `downloadFirst` |
| iOS | unverified, needed a Mac | documented for both platforms |
| web | not possible | supported |

On top of that: **EAS Build builds iOS in the cloud.** The iOS audio spike noted as open
therefore stops being a blocker, and the standing "no Mac" constraint is no longer one.

## The web target: what was actually missing

`react-native-web` was already a dependency, `app.json` already declared
`"web": { "output": "static" }`. What was missing was one script and **one** platform
split.

**The one real gap — and the trap in it:** `react-native-webview` has no web
implementation. On web it renders the red sentence "React Native WebView does not
support this platform." — and `expo export --platform web` **still succeeds**. The
exported `/artikel.html` contained that sentence. A CI job that only checks the export
would have reported green while the reader was broken.

That is why the reader is a platform pair behind a shared props type
(`ReaderView.tsx` / `ReaderView.web.tsx` / `types.ts`), and why the rule is a **test**
(`__tests__/web-target.test.ts`), not a comment.

The iframe is the honest equivalent here, because `buildReaderHtml()` builds the
document locally — nothing foreign is framed. ~~It carries `sandbox="allow-same-origin"`
and nothing else: `extract.ts` strips `script`/`style`/`iframe`/`form` anyway, so the
reader needs no JS, and leaving out `allow-scripts` costs nothing.~~ It carries
`allow-scripts` as well since embeds from a short list of hosts render in the reader and
inherit the frame's sandbox, voided by [ADR 0065](0065-embeds-inline-from-a-short-list-and-a-link-for-the-rest.md) §5.
`allow-same-origin` is
needed so clicks inside the iframe run through the same `onNavigate` as in the native
WebView. ~~The two must never be set together~~ (they are, on purpose, voided by
[ADR 0065](0065-embeds-inline-from-a-short-list-and-a-link-for-the-rest.md) §5) — the
frame could then remove its own sandbox.

## Verified

Not merely built, but run in a browser (headless Chrome against the static export, with
**clean URLs**):

- **Home:** complete content — Spotlight briefing, backstage teaser, media library,
  Salon5 radio tile, all five tabs, fonts loaded
- **`/artikel`:** iframe with the article — correct `h1`, 19 paragraphs, 4 embedded
  fonts, 502 KB self-contained document, no WebView stub
- **`contentDocument` reachable under the sandbox**, 15 anchors found — so the click
  interception really does take effect

A trap for the next test: **serve with clean URLs.** `python3 -m http.server` serves
`/index.html` as a literal path, Expo Router then matches nothing and renders its
"unmatched route" page — which looks like an app fault but is a server artefact.

## Price

- **Vue stops being the house standard for the app.** CORRECTIV is a Vue house
  (5 frontends + `@beabee/vue`); that was exactly the argument for NativeScript on
  2026-08-01. The pivot costs the app that proximity to beabee and faktenforum.
  Accepted deliberately.
- **The UI has to catch up.** NativeScript leads 4,346 to 828 LOC; `entdecken`,
  `mediathek`, `mitmachen` and `profil` are stubs in the Expo state.
- **Licence: AGPL-3.0-or-later for everything**, `apps/mobile-rn` included. The
  `create-expo-app` template's MIT `LICENSE` moves to `apps/mobile-rn/NOTICE.md`:
  MIT requires the notice, and a `LICENSE` file would read as "this subtree is MIT".
- **Two apps in CI**, until the swap happens.

## Done after this decision (2026-08-05)

**The core is framework-free.** ~~The 8 stores run on `zustand/vanilla`~~ — they
never did (they ran on the core's own `create-store.ts`, added shortly after this was
written) and there are ten Redux Toolkit slices now, bound with `react-redux`; see
[ADR 0009](0009-redux-toolkit-for-the-cores-state.md). The property this paragraph
claims still holds, and `boundary.test.ts` now additionally forbids `vue`, `pinia`,
`react` and `react-dom`.
Both hosts bind it themselves: `apps/mobile/src/stores/core-bindings.ts` (a Vue
`reactive` mirror that reproduces the old Pinia surface, which is why not a single call
site had to move) and `apps/mobile-rn/src/lib/store/core.ts` (zustand's `useStore`).

One trap along the way, because it does not announce itself: **derived values are
exported selectors taking state as an argument — not methods on the store.** A method
closes over the vanilla store's `get()`; a Vue `computed` calling it therefore reads
state Vue has never seen. The dependency is not registered, the template silently stops
updating — no error, no warning, typecheck and Android build stay green. That is exactly
how I wrote it first; `apps/mobile/test/core-bindings.test.ts` found it and demonstrably
fails if it is built that way again.

**~~The port was synchronous, AsyncStorage is not.~~** Voided by
[ADR 0009](0009-redux-toolkit-for-the-cores-state.md): the port is asynchronous and
the mirror below no longer exists. The failure it describes is worth reading anyway,
because it is the reason the mirror went — `KeyValueStore.getString` was
synchronous, inherited from NativeScript's `ApplicationSettings`, and
`apps/mobile-rn/src/lib/platform/expo.ts` solved that with an in-memory mirror:
`hydratePlatform()` loads once before the first render, reads come from memory, writes
drain in the background. The dangerous case is **reading before hydration** — the app
then starts with empty state and overwrites the real state on the first write, which
shows up as "settings randomly reset". Hence the render waits on hydration and
`persist()` is only registered afterwards. One code path covers all three targets,
because AsyncStorage ships a localStorage-based web build.

`apps/mobile-rn/src/lib/store/saved.ts` is gone — the reader uses the core's
`savedArticles` store. One store therefore drives a Vue and a React screen.

**The design tokens have been taken into the repo** (`tokens/`, vendored from
wp-design-tokens at `501ee10` / `v0.1.1`). Before that it was a sibling checkout that
both bridges searched upwards for — and an upward search cannot tell the repo's own copy
from a foreign checkout: on this machine it found `17b87c8` while the repo means
`501ee10`. Developer and CI would have generated from different sources and called that
agreement.

Vendoring rather than a submodule or an npm dependency, argued in `tokens/README.md`:
the npm variant is not available (the package requires `tailwindcss >=4.1`, NativeWind v4
requires v3 — which would leave only `--force` or repo-wide `legacy-peer-deps`), and a
submodule is too much apparatus for 11 KB of CSS. Resolution now lives centrally in
`scripts/tokens-source.mjs` and hits **exactly one** path; the repo root is found via a
marker (name + `workspaces` in the root `package.json`), not by counting `../` levels —
counting levels is what broke when the apps moved into `apps/*`.

The real gain: **the drift test now runs unconditionally.** Before, it skipped itself in
CI because the source was missing there — that is, precisely where drift has to show up.
Verified by moving `#ff5064` in `tokens/theme.css` and not regenerating: the test fails.

**The feed data layer is unified.** One `FeedItem`, one set of parsers, one feed
catalogue — all in the core. Deleted: `models.ts`,
`feeds/{sources,rss,xml,youtubeAtom}.ts`, `format.ts`, `sample-data/`, the two
byte-identical feed fixtures and `fast-xml-parser`.

Three things came up in the process that needed measurement rather than assumption:

1. **`authors: string[]` was speculative.** The prototype modelled co-bylines as repeated
   `<dc:creator>` elements. Across 200+ live items (main feed + fact check), **every**
   one carries exactly one, and none is a composite value. The core keeps
   `author?: string`; a test records the finding so the array does not come back on a
   hunch.
2. **Seven of the prototype's fourteen model types were dead code** (`Callout`, `Claim`,
   `PodcastSeries`, `MembershipState` …) — models for screens that were never built. The
   core has all of them, with real sample data. Phase 4c–4e builds on that, not on empty
   shells.
3. **The browser user agent is purely defensive.** The prototype's comment claimed bot
   filtering at WordPress/CDN. Measured against the feed and article HTML with both UAs:
   byte-identical responses, HTTP 200. No latent bug in the core's UA.

**FunFacts now runs over PeerTube** (`mediaStore` instead of a bespoke YouTube client) —
and that fixes more than the legacy path: `tube.funfacts.de` sends
`access-control-allow-origin: *`, the YouTube Atom feed does not. Verified in the
browser, with a real video title.

**Two defects found and fixed along the way:** `services/http.ts` never cleared its
timeout `setTimeout` — after every successful request it kept running for up to 8 s
(Promise.race discards the late rejection, so it looked like nothing; it became visible
because Jest stopped exiting). And `core-store-binding.test.tsx` never tore down its
rendered trees: a mounted probe stays subscribed to the store, reacts to the reset in
`beforeEach` and shifts the state for the next test.

**Entdecken is done** (phase 4b): a directory of 7 groups, a topic rail, search with a
local fallback, one template for all project and topic pages. Three decisions in it need
explaining.

*The design draft wins against the NativeScript state where the two contradict.* The NS
state built the directory from grey `hub-card`s with an icon; `DiscoverScreen.dc.html`
shows hairline-separated rows with a small group label. At 17 entries across 7 groups the
list simply reads better — and by plan the draft is the visual reference while the NS
state is the functional specification. The same for the project's own action: an outline
button instead of a second card.

*Two namespaces meet one route.* `/projekt/<id>` serves projects from `projectGroups`
**and** topics from `interests`; `klima`, `lokal` and `schweiz` exist in both.
`resolveProject` in the core decides: the project wins, because its page has the
editorial description and its own action. The NS state built a synthetic topic page for
every chip and thereby overwrote real descriptions with "Alle Beiträge zum Thema
Klima." — deliberately changed.

*A native header search bar would be the wrong route.* `Stack.SearchBar` /
`headerSearchBarOptions` is Expo's recommendation, but ~~this app sets
`headerShown: false` throughout and builds its own header rows, so that iOS, Android and
web show the same brand~~ — that premise is voided by
[ADR 0030](0030-the-platforms-header-and-ours-on-web.md), which gives thirteen routes
the platform's stack header and keeps the drawn bar on web and on two named screens.
The conclusion stands, and 0030 is what confirms it: `/suche` is one of those two
exceptions, for the reason the next sentence gives.
A native bar looks different on every platform and does not appear at all on web.
Hence `ScreenHeader` + `TextInput`. The `autoFocus` there is a deliberate exception to
`jsx-a11y/no-autofocus`, argued in `.oxlintrc.json`: the screen exists for nothing else
and is only reached by an explicit tap on the search entry.

**A defect only the browser revealed:** a dynamic route exports as *one* file
`projekt/[id].html`. On a static host without rewrites — which is exactly GitHub Pages —
every real URL beneath it answers 404; `/projekt/klima` did, while build, typecheck and
all tests stayed green. `generateStaticParams()` in the route solves it: the export now
produces one file per id (21 of them, verified). Native was never affected — there are no
URLs there. A second finding of the same kind: `tsconfig.test.json` did not list
`nativewind-env.d.ts`, which made the first test rendering a real component fail on every
`className` in the tree — latent for as long as tests only render `<Text>`.

**The media library is done** (phase 4c): live radio, seven Castopod series, two video
channels, the club bonus track, mini and full player, series and video pages.

*The player is a module, not a hook.* `useAudioPlayer` binds the instance to a component
and releases it on unmount — exactly what must not happen if playback is to survive tab
switches, pushed routes and the background. So `createAudioPlayer` at module level, a
zustand store beside it, and React only subscribes. Two NativeScript workarounds fall
away with it: the position-regression detection (Android's MediaPlayer jumped to 0 at the
end without firing the complete callback) and the 1-second polling timer. expo-audio
reports `didJustFinish`, `isLoaded`, `isBuffering` and `error` itself. What stayed is the
watchdog: the lesson was that network faults sometimes do not arrive *at all*, and an
eternal spinner is the worst possible answer.

*A hole in the preview gate closed.* The NativeScript state paused club audio at 60
seconds, but its limit fired exactly once (`!this.previewEnded`) — a second press of play
played the episode to the end and thereby released club content. Here `togglePlay`
refuses to resume beyond the limit and shows the invitation again; a test records it.

*Video: one route, two sources, no re-parenting.* PeerTube plays natively through
expo-video (only the HLS master playlist mixes the video and audio track, the renditions
are separate), YouTube stays on the nocookie embed. Deliberately **without** the
collapsing bar of the NativeScript state: there the video surface sat above the tab
frames and shrank on leaving. React Native cannot re-parent a video surface without
recreating it — the natively appropriate answer is picture-in-picture, which expo-video
brings. Incidentally `react-native-youtube-iframe` is gone: the embed the NativeScript
state already used needs no dedicated player package (and the package itself was built on
a WebView again). In exchange `VideoFrame` is the second platform pair next to the
reader, enforced by the same guard.

*The core has gained a podcast store* (previously NativeScript-local), with one layer
fewer: the bundled per-show snapshots read NativeScript's `File`, which must not appear
in the core. A stale cache and a typed seed cover the same ground. And `videoStore.play`
now only queries the PeerTube API for PeerTube videos — for a YouTube item that was a
guaranteed 404 that arrived as "video broken".

**The most expensive finding of this phase again came only from the browser.** To place
the mini bar above the tab bar, the obvious route was building the `tabBar` prop with
`BottomTabBar` from `expo-router/tabs`. That import pulls a **second React instance**
into the bundle; the app dies at startup with the minified React error #321 ("invalid
hook call"). Build green, typecheck green, 78 tests green, page white. Found by loading
the static export in Chrome — and pinned down by recording `Runtime.exceptionThrown`:
uncaught exceptions do not appear in `console.*`, and without that a crash looks like an
empty page. Solution: an absolutely positioned overlay in the tab layout, no
react-navigation import.

Two smaller findings of the same sort: `tsconfig.test.json` did not list `assets.d.ts`
either (the second case after `nativewind-env.d.ts` — both only bit once a test reached
the code in question), and the path aliases want the **opposite** order in tsc and jest:
jest-expo derives a moduleNameMapper from `tsconfig.json`, where the first match wins
with no fallback, while tsc needs the generic `@/*` first for `declare module '*.mp3'` to
take effect at all. The difference now carries one line in `jest.config.js`.

**Mitmachen is done** (phase 4d): three CrowdNewsroom callouts, the multi-step form built
from each callout's schema, Faktenforum with review status and source rating, the
Abriss-Atlas, the tip channel.

*The counter is the product.* "Ihr Beitrag zählt" is the promise, so a submission raises
the visible number immediately and permanently — the same arithmetic on the overview, on
the callout page and on the thank-you page (`responseCount + extraCount(slug)`). A test
records it, because a submission that does not move the number silently breaks the
promise.

*Trust comes before the form.* "Wer fragt?" and "Was passiert mit Ihren Daten?" sit above
the button on the callout page, not in the small print — as in the NativeScript state
already, and the order is deliberate.

*A trap avoided while building:* in the form, the header button was initially also called
"Zurück" — the same text as the step-back button below it, with a completely different
effect (leave the form vs. one slide back). Now "Abbrechen".

*The file attachment stays a dummy.* A real image picker would be another native module
for a flow that arrives nowhere without a backend — the label says "simuliert" rather
than keeping quiet about it.

Noticed along the way: **typed routes are generated by `expo start`, not by
`expo export`** — and `.expo/` is gitignored. A new route therefore fails `tsc` locally
until Metro has run once, while CI without `.expo/types` waves every href through. A
green CI typecheck is therefore **no** evidence about hrefs.

**Profil is done** (phase 4e, first part): profile for guest and member, settings, saved
articles, the quarterly report. The join flow, onboarding and backstage remain open.

In the process the core **gained three actions that only appeared to exist already**:
`membership.setPaused`,
`settings.setNewsletter/setTextScale/setPushOptIn/resetForDemo` and `interests.clear`.
The Vue host managed without them, because its reactive mirror allowed direct assignment
(`membership.paused = !membership.paused`). A store that owns its transitions needs the
action — and both hosts then read the rule from the same place. For pausing, that rule
matters substantively: it is **not** a cancellation, `isMember` stays true and backstage
stays open (per the concept). A test records it.

The "Mein Impact" block shows three real investigations. The NativeScript state filtered
the bundled article index on `feed === 'recherchen'` for that; the Expo bundle is keyed by
URL and carries no feed field, so the URL decides — fact checks are not impact
investigations.

**Phase 4 is finished** (4e, second part): onboarding, join flow, backstage, research
diary. All five tabs and all secondary screens are in place.

*The status change works.* `join()` in the join flow sets `isMember`, and every club
touchpoint reacts in the same tick — clicked through in the browser: onboarding → app →
profile → join → contribution → data.

*No dark pattern, and that is tested.* ~~Until the final step, every "Weiter" has an
equivalent "Erstmal umsehen" beside it~~, and from step 2 of the onboarding a
"Überspringen" — and skipping **counts as completed**, so it does not ask again on the
next start. ~~Backstage is fully visible to guests; the buttons invite rather than lock~~
("the club is proximity, not a paywall"). The struck halves were retired by
[ADR 0018](0018-removing-the-guest.md): behind the door there is no guest to invite and
nowhere to escape to. "Überspringen" and the rule in brackets both still hold.

*Contribution as presets instead of a slider.* React Native no longer has a slider, and
for money tapping is more precise than dragging — the same deviation from the design
draft as the player's progress bar, for the same reason.

*The first-start jump only applies at "/".* At first it was unconditional — and would
therefore have overwritten every shared link on the web target: someone opening
`/backstage` should see backstage. Found in the browser, when the deep link jumped into
the onboarding. The case does not exist natively, where the app always starts at `/`.

**The first Android build of this app at all** (2026-08-05, locally): `BUILD SUCCESSFUL`,
518 Gradle tasks. That demonstrates that `expo-audio`, `expo-video`,
`react-native-webview` and `@expo/ui` compile together under RN 0.85 with the New
Architecture. Noticed along the way: **the CI job "Android debug build" builds
`apps/mobile`**, the NativeScript app. For the Expo app, only the web export ran in CI —
so the swap in phase 5 would have pointed the job at something that had never been built
there.

And the build made a defect visible that no test could find: **autolinking wires in the
native module, but only the config plugin edits the native projects.** `expo-audio` was
not listed in `app.json` → no `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, no media service, no
`UIBackgroundModes: [audio]`. Background playback and lock-screen control could therefore
not have worked, while build, typecheck and 273 tests were green. Fixed and verified
against the generated output; `recordAudioAndroid: false`, because the app does not
record and the default would otherwise demand `RECORD_AUDIO`.

## Open

> The items below are the state as of 2026-08-05.
> [ADR 0006](0006-one-core-two-hosts.md) supersedes this section — read its "What is
> still open" for the current list. The GitHub Pages item is the one that has since been
> resolved; it is marked below.

- **The web target sees no live articles.** `correctiv.org` sends no
  `Access-Control-Allow-Origin` header, so the browser blocks every RSS request
  (measured 2026-08-05; native targets are unaffected). The web demo shows the shell,
  sample data and PeerTube content — but no hero, no "Neueste Recherchen", no fact
  checks. Three routes: (a) CORRECTIV ops set the header (a CDN/WordPress header, and
  RSS is public data — the cheapest and most correct route), (b) a bundled feed snapshot
  as a web fallback (the NS app already generates `assets/data/feeds/<key>.json`),
  (c) a proxy. The decision is pending.
  Since phase 4b the web demo at least claims nothing false: search falls back to the
  local corpus, and the project page writes "Beiträge konnten nicht geladen werden"
  instead of spinning forever (verified in the browser). Phase 4c completed the finding:
  of all sources **only** `tube.funfacts.de` sends the header (`*`, on the HLS playlists
  too — so the FunFacts videos really do play in a browser), while `correctiv.org`,
  `salon5.correctiv.net` (Castopod) and `youtube.com/feeds` send none. On web the media
  library therefore shows real FunFacts videos but sample podcast data, with the note
  "Ohne Verbindung — Sie sehen Beispielfolgen."
- **Take out before the swap (phase 5), or `git rm` deletes it:**
  `scripts/spike-audio-server.mjs` (requires `Authorization: Bearer spike-token`, 401
  otherwise — the proving test for the authenticated Castopod podcast that the Expo app
  needs just as much) and `apps/mobile/src/assets/data/feeds/*.json` together with
  `fetch-offline-{articles,podcasts}.mjs` — that is option (b) of the CORS question
  above. The NativeScript traps from the README belong in this ADR, where they are
  history rather than instructions. Recommendation: the NS state as an **annotated tag**
  `nativescript-final` (a branch invites commits, a tag says snapshot; checking out works
  the same). And: both apps carry the same package id `org.correctiv.app.prototype` — only
  one fits on a device, which effectively rules out running them side by side to compare.
- **Audio is not verified on any device.** The player's rules (preview limit,
  exclusivity, watchdog, lock-screen call) are recorded in 16 tests, and in the browser a
  real click on "Radio abspielen" brings up the mini bar — but that sound actually comes
  out of the Icecast stream, and that background playback and lock-screen control work,
  can only be shown by an Android or iOS build. `scripts/spike-audio-server.mjs` remains
  the proving test for the authenticated podcast (401 without a bearer token).
- **The article/reader type is still duplicated.** `Article` (app) versus `ArticleDetail`
  (core) are cut differently, not merely named differently: `kicker`/`topline`,
  `title`/`headline`, `badge`/`ratingText`, plus `dateText`/`excerpt` in the core only
  and `relatedLinks` in the app only. Unifying them means rewriting `extract.ts` and the
  reader HTML builder — at the **only finished screen**. Deliberately deferred:
  `src/lib/articles/types.ts` says why.
- **The blob cache stays with the host.** Pulling the cache policies into the core fails
  for now on the port: `FileStore` is synchronous, and the Expo adapter therefore
  hydrates *everything* eagerly into a memory mirror at startup. Right for small
  settings, wrong for ~1 MB of feed JSON before the first render. The port would have to
  become async (it is used in exactly one place, `cache.service.ts`) — a step of its own,
  not a side effect of this move.
- ~~GitHub Pages is still on `legacy` (`main:/docs`) and serves the design draft. Switch
  to `build_type: workflow`, so the web build deploys without committing build output.~~
  **Done.** `.github/workflows/pages.yml` builds the export under the Pages base path
  and publishes it as the app's web preview; `docs/` and `scripts/deploy-demo.sh` are
  deleted. Switching `build_type` itself is a repository setting and stays manual —
  see [RELEASE.md](../RELEASE.md#the-web-preview).
