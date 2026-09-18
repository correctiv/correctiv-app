# ADR 0026 — The React Native review, and which of it we are doing

Status: accepted, 2026-09-10. All nine numbered sections are decisions. Three of them
carry a named open item rather than a completed choice: who sends notifications (3),
which provider receives an error report (5), and three details of the header split
(9). Every measurement below names its host, and none was taken on iOS; the last
section says what that costs.

## Context

A React Native review on 2026-09-03 compared `apps/mobile` and `packages/app-core`
with React Native / Expo practice and with the team's Expo template. The template is
a second reference, not a specification this app copies: its Sentry integration,
FormatJS workflow, MMKV-backed persistence and store-release tooling are useful
comparisons, and its navigation, styling and repository tooling answer different
requirements.

The app the review found already holds the parts worth keeping: a platform-free core
with a boundary test, typed routes and a published static web target, semantic colour
tokens, the React Compiler, virtualized unbounded lists, narrow audio subscriptions,
and CI assertions against the generated Android manifest and the web artifact. What
it is missing is runtime reliability, input usability, diagnostics, and a few
decisions nobody had made.

This record is the second half of that review: what the team decided to do about it.
Nine of the reviewer's eleven items survive here, five of them with a different
argument than the one they arrived with, and two were dropped — see *What this record
drops*. One decision was not in the review at all, the tablet half of section 7, which
is why the count of sections and the count of surviving items agree by coincidence.
Where a finding turned out to be answerable by reading the source or running the app,
it was, and the answer is in the section rather than in a follow-up.

## Decision

Use the review to harden the app without adopting the template's stack. Absence of
manual memoization, custom `FlatList` settings or Reanimated usage is not by itself a
defect, and a performance recommendation stays a measurement task until a runtime
problem is demonstrated.

### 1. Rozenite, which replaces the Redux debugger rather than joining it

Adopt [Rozenite](https://www.rozenite.dev/) as development-only tooling, for two
capabilities React Native DevTools does not have on its own: an agent-facing CLI, and
the Redux, Storage and React Navigation domains.

**Not for network inspection, which React Native already does.** In `react-native`
0.86.3 both `enableNetworkEventReporting` and `fuseboxNetworkInspectionEnabled`
default to `true` (`src/private/featureflags/ReactNativeFeatureFlags.js`), and the
capture is native on both platforms: `Libraries/Network/RCTInspectorNetworkReporter.mm`
wired from `RCTNetworking.mm`, and `InspectorNetworkReporter.kt` beside
`NetworkingModule.kt`. The review named network tracking as the first use case, and it
is the one item that needs no dependency at all.

What it does add is worth having on this state tree. `lib/store/core.ts` already
argues that on a store taking an audio position tick twice a second and running four
network cascades, a named action history is "the difference between reading logs and
seeing what happened". That argument does not stop applying because the reader is an
agent.

**It is a swap, not an addition.** The app carries `redux-devtools-expo-dev-plugin`
today, and `@rozenite/redux-devtools-plugin` occupies the same seat. Two debuggers
fight over one connection, which `lib/store/core.ts` already says in as many words.
The enhancer goes where the current one goes, into `devToolsEnhancers()`.
[ADR 0023](0023-the-host-constructs-the-store.md) built that seam; this is the first
thing to arrive through it that 0023 did not anticipate.

**But not for the reason `core.ts` gives, and this one was measured.** That function's
comment says its `__DEV__`-then-`require` shape means "a release build drops the whole
thing instead of bundling a debugger". It does not. Metro collects dependencies from
the syntax tree, so a `require` statement inside a function keeps its module however
unreachable the call is; five variants were built into a production export on
2026-09-10 and only the two written at MODULE scope
(`__DEV__ ? require(…) : null` and `if (__DEV__) { require(…) }`) left their module
out. The current debugger genuinely does stay out, but because
`redux-devtools-expo-dev-plugin/build/index.js` carries
`if (process.env.NODE_ENV !== "production")` at module scope, which Metro substitutes
and then eliminates. `@rozenite/redux-devtools-plugin` 2.4.0 guards itself the same
way, so the swap keeps the property. ~~The shape in `core.ts` is not what to copy for
a local module, which is why the agent-tools component below is selected at module
scope.~~ It keeps the implementation out and not the NAME, so it is not what to copy
anywhere. Measured while implementing this (#149, 2026-09-15): with the require left
inside `devToolsEnhancers()`, the production export carried the package's no-op module,
and a no-op still carries its export names — `rozeniteDevToolsEnhancer`,
`composeWithRozeniteDevTools` and `useReduxDevToolsAgentTools` all survived
minification. That trips the very grep this section asks CI to run, so the check would
have to be permanently red or permanently loosened. **Module scope is required for both
requires.** A third variant is measured now beside the two above: `__DEV__ &&
process.env.NODE_ENV !== 'test' ? require(…) : …` folds the same way and leaves the
module out, which is the shape both call sites use.

**A developer and an agent cannot look at once.** Rozenite's own documentation states
that React Native DevTools disconnects when an agent session begins, because the
platform permits one debugger connection. Plan for alternating, not for both.

`useReduxDevToolsAgentTools()` needs a different shape than the enhancer, because a
hook cannot go inside an `if` and a top-level import stays in the bundle either way.
Select the component at module load instead:

```tsx
const AgentTools = __DEV__ ? require('@/lib/devtools/AgentTools').default : () => null;
```

**The Metro side does not hold itself back, whatever the documentation says.**
Rozenite's own getting-started page says it "is off by default, so it never runs in
production by accident". `@rozenite/metro` 2.4.0 does not do that. With `enabled` left
undefined it logs that being on by default is going away and then switches itself on
anyway, unless `isBundling()` says otherwise — that function reads `process.argv` and
recognises `expo export` and `react-native bundle`. Pass `enabled` explicitly and
`isBundling()` is never consulted at all, so `true` reaches an `expo export` exactly
as it reaches `expo start`. **So `npm run build:web` stays clean by our discipline, an
environment variable nobody sets in CI, and not by construction.** That is the
opposite of the promise, and it is why the assertion below is not optional.

**The config file changes shape.** `withRozenite` chains `resolveRequest` onto
whatever is already there, so both resolver workarounds in `metro.config.js` survive.
But it returns `() => Promise<config>`, and that file exports an object today. Uniwind
stays outermost, as it must:

```js
module.exports = async () =>
  withUniwindConfig(await withRozenite(config, { enabled: !!process.env.ROZENITE })(), {
    cssEntryFile: './src/global.css',
  });
```

Add the assertion beside the one it belongs with: `pages.yml` already fails the
deploy when the published bundle carries `__correctiv`, the tell for a `--dev` export
([ADR 0025](0025-the-published-app-is-a-production-bundle.md)). A second grep for a
Rozenite marker is three lines, and it is what turns "development-only" from an
intention into something that can fail. Note what has no counterpart: the CI asserts
against the generated Android manifest before the build and against the signature
afterwards, and about the JavaScript inside the release APK nothing at all, which is
true of the current debugger too.

**Capture rules, because the Redux domain can write.** It lists and dispatches
actions and drives rollback, and the network domain records request and response
bodies. Use test accounts, keep captures local, and put none of them in the
repository. Nothing here leaves the machine unless somebody shares a trace, and that
is the line to hold.

Confirm what the session actually sees. The article reader is a WebView
([ADR 0017](0017-native-rendering-as-the-rule-a-webview-for-the-exception.md)) and
`expo-audio` and `expo-video` fetch through their own players, so JavaScript HTTP
inspection says nothing about either.

### 2. Keyboard-aware inputs, as a usability requirement

Three screens set tap handling on an ordinary scroller, two of them dismissal as
well, and none configures keyboard avoidance at all:
[`LoginGate.tsx`](../apps/mobile/src/components/gate/LoginGate.tsx),
[`formular.tsx`](../apps/mobile/src/app/formular.tsx) and
[`suche.tsx`](../apps/mobile/src/app/suche.tsx). `KeyboardAvoidingView` appears
nowhere in the repository, and the participation form's action footer is a sibling of
its `ScrollView` rather than inside it.

`keyboardShouldPersistTaps="handled"` lets a tap reach a control while the keyboard is
open. It does **not** keep the focused field, its validation message or the submit
button above that keyboard, and safe-area padding is not keyboard avoidance either.
Android window resizing may rescue a particular screen and establishes nothing about
the other platform.

`KeyboardAvoidingView` is the default answer for sign-in and participation, with
search in the same pass. If a layout needs more,
[React Native Keyboard Controller](https://kirillzyusko.github.io/react-native-keyboard-controller/)
is the escalation and not a dependency to add first. Coordinate the footer with the
scroller, do not double-apply insets, and keep the web layout.

Done means the focused field, the caret, errors and the next/submit control stay
reachable with the software keyboard open on small iOS and Android screens, including
multiline input and large text. Exercise submission, dismissal and returning to the
screen; sign-in's existing focus-next handling stays and has to keep working.

### 3. Notification delivery stays deferred until it is decided how they are sent

The switch is a simulation and says so.
[`stores/settings.ts`](../packages/app-core/src/stores/settings.ts) persists
`pushOptIn`; onboarding and settings write that boolean and label the row
"(simuliert)". There is no `expo-notifications` dependency, no plugin in the app
configuration, no token registration and no notification-response handling. The audio
player's system media notification is a different capability and provides no
editorial push.

**This record chooses neither Expo Push Service nor direct APNs/FCM**, and does not
assume a backend or an editorial tool already owns sending. The recommendation is to
decide that first and to build the client and the sender as one end-to-end feature.
The decision needs to name:

- Which events trigger a notification, which system owns targeting and delivery, and
  on what transport, with whose credentials, and whether the public web target counts.
- The difference between an app preference and an OS permission, both at first ask and
  after a denial or a later revocation. That difference is the one the current switch
  papers over, so it is the one most likely to be built wrong.
- Token registration, rotation, removal and retention, and what sign-out does to them.
- Tap handling from background and from a cold start, including denied access, an
  expired session and content that no longer exists.

Afterwards, permission and token APIs belong in the host behind ports where the core
needs them, preference and payload policy in the core, and navigation stays the
host's and respects the admission gate. Until then, keep the simulated wording and do
not read `pushOptIn: true` as OS authorisation or as a successful registration.

### 4. MMKV as the single storage engine, with a bounded cache

Use `react-native-mmkv` for both `KeyValueStore` and `BlobStore`, replacing
AsyncStorage: faster runtime access and one backend to maintain. Keep the existing
async ports and separate namespaces for durable state and disposable cache. The
adapter belongs in the host; no native imports or storage mirror belong in the core.

**Revision, 2026-09-10:** ~~AsyncStorage stays for `BlobStore`.~~ Superseded by this
single-engine decision: accept the measured memory cost and bound the cache rather
than maintain two backends.

**Measured runtime benefit.** On 2026-09-10, the same release-mode Android
15/API 35 arm64 emulator build compared AsyncStorage 2.2.0 with MMKV 4.3.2.
Synthetic actions used the unchanged `persist()` code: 30 writes per case across
three alternating-backend rounds, 400 ms apart. Median API completion times,
excluding serialization:

| Persisted payload | AsyncStorage | MMKV |
| --- | --- | --- |
| Settings, about 140 bytes | 5.86 ms | 0.07 ms |
| 100 saved articles, about 26 KB | 5.68 ms | 0.10 ms |
| 1,000 saved articles, about 264 KB | 6.88 ms | 1.37 ms |

The 250 ms throttle stayed: end-to-end persistence improved by **about 5-7 ms**.
Separate warm loops reduced settings reads from 0.242 to 0.006 ms, and 1 MiB blob
writes from 7.989 to 2.599 ms. Redux selectors already read JS memory.

Faster completion is not necessarily less blocking: a 1 MiB write occupied the JS
thread for about 2.5-2.6 ms with either backend, plus 3.18 ms for `JSON.stringify`.
Wrapping MMKV in an async port does not offload that work. These results establish
neither whole-app responsiveness nor equal disk-flush durability.

The team's experience of larger AsyncStorage writes stalling other apps motivates
this choice, but was not reproduced as a UI freeze here.
[Tencent's Android benchmark](https://github.com/Tencent/MMKV/wiki/android_benchmark)
supports the direction, not our ratios: it compares native MMKV with SQLite and
SharedPreferences, not React Native AsyncStorage.

**Accept the memory cost.** Persisting 4 MiB already held in the JS cache added
**4.55-4.56 MiB of settled process PSS with MMKV**, versus **0.49-0.50 MiB with
AsyncStorage**, across three fresh processes per backend. The native representation
is additional to JS objects. These are not peak figures: AsyncStorage showed
transient spikes, and GC/page residency affect totals. Mapped pages are not
necessarily permanently resident.

**Cap cached articles with either backend.** The current
[`cache.service.ts`](../packages/app-core/src/services/cache.service.ts) has no count
limit or eviction; the article reader's 24-hour TTL only controls freshness.
Add an article-count limit, total byte budget and maximum entry size, with
least-recently-used eviction from both the JS `Map` and persisted cache.
Keep policy in the core and add deletion capability to `BlobStore`. Choose limits
against representative content and offline needs before rollout. Cached bodies are
not bookmarks: never silently evict user-selected bookmarks, settings or session state.

AsyncStorage would require bounds too. Its
[2.2.0 Android limits](https://github.com/react-native-async-storage/async-storage/blob/%40react-native-async-storage%2Fasync-storage%402.2.0/packages/website/docs/Limits.md)
are a configurable **6 MB total database default** and an **approximately 2 MB
per-entry read limit**. Raising the former does not fix the latter.

**The file system was the alternative, and it is rejected.** One key/value store is
the point of this decision, and a blob cache is not a key/value store in the same
sense: `cache.service.ts` already hashes every key to `<djb2>.json`, which is a
filename, and the thing it holds is a few dozen kilobytes of article HTML rather than
a setting. Putting it in `expo-file-system` would satisfy "not two K/V stores" and
avoid the memory cost measured above, since a file on disk is not a mapped page.

It loses on one point, and the point is decisive: **the web target has no file
system.** `BlobStore` would need a second implementation there, against localStorage
or IndexedDB, so the uniformity this decision buys would be spent again immediately —
and MMKV ships a web build backed by localStorage. One implementation on three
platforms is worth the megabytes. Recorded because the argument is not obvious from
the outcome, and the next reader will otherwise re-open it.

**The bound is part of the migration, not a follow-up.** With AsyncStorage an
unbounded cache is a disk that fills; with MMKV it is resident memory, so the same
code becomes a leak with a TTL. `BlobStore` cannot evict at all today — the port is
`read` and `write`, with no `delete` — so the capability, the policy and the limits
land with the swap or the swap should wait for them.

**Adoption.** The app is unreleased, so no legacy-data migration is required.
Replace AsyncStorage directly with MMKV and Nitro Modules, without a fallback;
existing development/test data need not be carried over. Preserve web persistence
through MMKV's `localStorage` implementation and surface quota/unavailable-storage
failures.

~~MMKV would remove most of the 18-21 ms.~~ Withdrawn: no A/B cold-start comparison
was made. Fonts were the bottleneck in one earlier startup run; the measurements
and platform limitations remain recorded below.

### 5. An error boundary, and an error report whose provider is not chosen yet

The review asked for production error tracking and a React error boundary. Both are
wanted. They are separated here because one is buildable today and the other waits on
a choice nobody has made.

**The boundary closes a live hole.** There is exactly one
`SplashScreen.preventAutoHideAsync()` (`app/_layout.tsx:68`) and one `hideAsync()`,
gated on `fontsLoaded && storeReady`. There is no error boundary anywhere in the app
host and no global handler — no `ErrorUtils`, no `setGlobalHandler`. So a throw before
both flags leaves the app on the splash screen for ever, with no crash, no message and
nothing a restart improves. Hydration is covered, but by the host and not by the
core: `persist()` swallows a failed read per slice, and the `.catch` around the
host's own `start()` in `_layout.tsx` sets `storeReady` anyway when something else
throws. `useFonts` and the gate's render have no such floor, and `LoginGate.tsx`
contains no `try`.

**No new dependency for it.** `expo-router` ships the boundary: `Try`
(`views/Try.js`) is a class component with `getDerivedStateFromError`, production-safe
apart from a dev-only `MetroServerError` branch, and `ErrorBoundaryProps` is
`{ error, retry: () => Promise<void> }` — the retry the review asked for. Better for
this app: `getDerivedStateFromError` calls `SplashScreen.hideAsync()` itself, which is
precisely the failure above. Export `ErrorBoundary` from `app/_layout.tsx`, which is
the root route and so covers the tree, with a German recovery screen and a retry
control. One note on the review's wording: `Try` has **no** `onError` callback, that
belongs to `react-error-boundary`. Reporting therefore goes in an effect inside the
boundary component, which is what keeps the two halves of this section one change
apart.

**Reporting is decided; the provider is not**, and the choice carries more than a
package name:

- Which provider, and whether CORRECTIV already runs one for the website. An existing
  contract answers this question and closes it.
- Who signs off on transmitting reports to a third party. At a newsroom this is not a
  formality: a breadcrumb can carry the URL of an unpublished article, and a stack
  frame can carry a source's identifier.
- What a report may never contain, written down before the first one is sent rather
  than after.

Confirm React Native / Expo support before adopting whatever is chosen. A React
boundary catches neither asynchronous failures nor native crashes, so those need their
own mechanism — a global handler and the provider's native SDK — and are not covered
by the boundary above. Until the provider lands, the `console` domain from section 1
is what team-internal testing has.

### 6. German and English from the first string, and German is the only one that ships

CORRECTIV publishes English on the web, and the app's user-facing strings are
hardcoded German today. Prepare for a second language from the start rather than
retrofitting one, because retrofitting means touching every screen twice: once to
lift the string out, once to find that it sat inside a condition.

**German is what ships.** The language is fixed and there is no user-facing switch;
a developer-only switch belongs in the workbench, which already carries route,
appearance and app state in its address, and not in the app's settings. ~~`locale` is
therefore a fixed value in the store~~ — it is supplied by the host at construction,
voided by [ADR 0049](0049-the-catalogue-is-a-package.md) §4. The second half stands:
it is still not read from the device, and the phone still passes `'de'` for the
reason this paragraph gives. `expo-localization` is not needed for this step.

**Where things live.** Message descriptors are plain objects — `{ id, defaultMessage }`
— so they live wherever the string lives, screens in the app and core-owned
vocabulary in the core, and the core imports no React, which
`packages/app-core/test/boundary.test.ts` enforces. The `intl` instance and the
provider are the host's. Extraction runs over both workspaces and ~~the compiled
catalogues are build artifacts~~ — wrong on the day this was written: nothing in this
tree had ever compiled a catalogue. `formatjs extract` ran and wrote `en.json`, read
by a check and by nobody at run time; `formatjs compile` had no script, no CI step
and no output anywhere. Measured 2026-09-18, and **made true the same day** by
[ADR 0049](0049-the-catalogue-is-a-package.md) §3, which compiles `en.generated.ts`
and puts a drift check under it. The sentence stays struck because it was not true
when it was written, and a reader who acted on it that morning would have gone
looking for something that was not there. The German that ships is still
hand-written data, which the rest of this section describes correctly. For `packages/app-core/src/data/`, which holds around
230 German strings, the line is: *would this string still exist if the content came
from a CMS?* If yes it is UI vocabulary in data's clothing and goes in the catalogue;
if no it is content and follows the same rule as articles, which this record does not
translate.

**Two checks, in the same commit as the first message.** An English catalogue that
ships to nobody rots quietly, and "keep it current" cannot fail, so it enforces
nothing. These can fail: every id present in both catalogues with a non-empty
`defaultMessage`, and no `ä ö ü ß „ “` under `apps/mobile/src` outside the catalogue
directory. The second is a partial net — "Suchen" slips through — and it costs about
twenty lines, in the shape `packages/app-core/test/boundary.test.ts` already uses.

**`Intl.PluralRules` is missing and this is not an English problem.** Measured against
the Hermes actually in use, `hermes-android 250829098.0.17`, arm64: the VM exposes
`Intl.Collator`, `Intl.DateTimeFormat`, `Intl.NumberFormat` and
`Intl.getCanonicalLocales`, and **not** `PluralRules`, `RelativeTimeFormat`,
`ListFormat`, `DisplayNames`, `Locale` or `Segmenter`. `react-intl` needs
`PluralRules` for any plural message, so `@formatjs/intl-pluralrules` is required from
the first German plural, not later for English. Budget for
`@formatjs/intl-locale` beside it and for `@formatjs/intl-relativetimeformat` the
first time a string says "vor drei Tagen".

**The same measurement makes `lib/format.ts` smaller, not bigger.** Its twelve month
names and seven weekday names exist because "The NS runtime has no German ICU", and
NativeScript left this tree with [ADR 0007](0007-removing-the-nativescript-host.md) on
2026-08-12. `Intl.DateTimeFormat` and `Intl.NumberFormat` are both present, so those
tables are deletable rather than parameterisable. Confirm on a device first, and on
iOS separately.

**[AGENTS.md](../AGENTS.md) has to change with this**, because it currently says
German "for everything a user reads, and only there" and that multilingual support is
under consideration. Both stop being true the day the first descriptor lands.

### 7. Tablet is in scope, and accessibility is the work beside it

**Tablet layouts are in scope and the views become responsive.** This half was not in
the review; it is the team's own addition, and it is the only decision here that
arrived from outside it. The starting point is zero: no breakpoints in
`apps/mobile/src/global.css`, no `sm:`/`md:`/`lg:` variant anywhere under
`apps/mobile/src`, and no `useWindowDimensions` or `Dimensions.get` in either the app
or the core. This is work from nothing rather than a polish pass.

Two things follow immediately. Looking at it needs no device:
`apps/handbook/src/workbench/devices.ts` already frames a tablet breakpoint at
768 × 1024, an iPad mini at 744 × 1133 and an iPad Pro 11" at 834 × 1194. And it
reaches [ADR 0013](0013-native-tabs-and-a-web-tab-bar-of-its-own.md): native tabs are
Material 3's navigation bar, a tablet wants a navigation rail at the side, and 0013
records that `unstable-native-tabs` is alpha, exposes no height and mounts all five
tabs eagerly. A tablet layout is therefore not the same screens made wider, and where
it lands is 0013's territory rather than this record's.

Accessibility, on the same screens:

- Touch targets at least **44 × 44 logical units** (not device pixels), aiming for
  **48 × 48 dp on Android**. Prefer enlarging the pressable area to adding `hitSlop`:
  a slop rectangle can overlap the control beside it, and unlike padding it does not
  grow with the system font. It is also invisible in a screenshot, which is how this
  repository checks layout, so the twelve current sites need a hand and a screen
  reader rather than a lint.
- Dynamic font scaling at the largest system sizes, including the reader's own
  text-size setting. Fix clipped labels, overlapping controls and fixed heights, and
  keep content reachable rather than switching scaling off. Nothing in the app sets
  `allowFontScaling={false}` today, so this is about layout and not about undoing
  something.
- Meaningful `accessibilityLabel` values where they are missing, especially on
  icon-only buttons: name the action rather than the glyph, expose role and state, and
  hide decorative icons. Counted under `apps/mobile/src` on 2026-09-10: 44 labels, 39
  roles and 5 states over 43 `<Pressable` sites, and none of the four anywhere in the
  core. So this is incremental rather than absent.

Walk the main flows with VoiceOver and TalkBack to confirm focus order, announced
labels and operable controls.

### 8. Commit hooks, which format rather than complain

Decided: a Husky `pre-commit` hook that formats the staged files with oxfmt and
re-stages them, and runs oxlint over them as a check; plus a `pre-push` hook running
the whole `npm run check`.

Measured on 2026-09-09, over the whole repository:

| | |
| --- | --- |
| `typecheck` | 10 557 ms |
| `test` | 5 793 ms |
| `lint` (oxlint) | 363 ms |
| `format:check` (oxfmt) | 360 ms |
| `check` total | 17 181 ms |

The review proposed `lint-staged` to narrow oxlint and oxfmt to staged files. On speed
that buys nothing: those two take 0.72 s over the entire repository, four percent of
the work, and the ten-second item cannot be narrowed because TypeScript needs the
whole project.

**`lint-staged` earns its place for a different reason.** A hook that *formats* writes
files during the commit, and what it writes has to end up in that commit. Restricting
the write to the staged files and re-staging them is exactly the job `lint-staged`
does; running oxfmt across the repository from a commit hook would pull unstaged files
into the commit. So the tool stays and the justification changes: it is there for
correctness, not for speed.

oxfmt writes, oxlint only reports. A formatting change is whitespace and safe to apply
unseen; a lint fix is a change of meaning and should not happen silently. Typecheck and
tests stay out of `pre-commit` — 16 s of the 17 — and run on `pre-push`, which is the
moment the work starts to matter to somebody else.

One consequence to accept knowingly: a commit then contains a change its author did not
look at. That is the price of formatting automatically, and it is a small price while
the formatter is oxfmt and the diff is whitespace.

CI stays the authority either way. A hook exists only for whoever ran `npm install`,
and `git commit --no-verify` skips it, so this is a convenience and never a gate.

One figure to correct while the hooks land: [AGENTS.md](../AGENTS.md) says
`npm run check` takes "about ten seconds", and it took 17.2 s here. That sentence sets
the expectation the `pre-commit`/`pre-push` split is argued from, so it is part of
this work rather than a note beside it. **Done**, and not where this expected: the
figure is in [ARCHITECTURE.md](../ARCHITECTURE.md) now and AGENTS.md carries none,
because a number typed in two documents is the shape AGENTS.md has a section about
([#151](https://github.com/faktenforum/correctiv-app/pull/151), 18.9 to 19.9 s over
three warm runs). Not struck: the sentence was true when it was written and the
instruction in it was carried out, which is what a record should look like afterwards.

### 9. Navigation headers: the platform's on iOS and Android, ours on web

Decided: three implementations behind one seam. The native stack header on iOS and on
Android, each looking like the platform it runs on rather than like one drawing
stretched over both, and the drawn bar on web. This is
[ADR 0013](0013-native-tabs-and-a-web-tab-bar-of-its-own.md)'s pattern applied one
level up, and it reverses the paragraph in `components/ui/ScreenHeader.tsx` that says
the app builds its own bars everywhere.

**Web keeps its own because nothing else renders there.** On web, `Stack` resolves
through `Stack.web.js` and `BaseStack` to expo-router's vendored native-stack, which
reaches `ScreenStackHeaderConfig` from `react-native-screens`, and in
`lib/module/components/ScreenStackHeaderConfig.web.js` that component and its subviews
are bare `View`s. The one exception proves the rest: the back-button image is a real
`Image`, with no bar to sit in and nothing that positions it. No back control, no
title, no layout. The claim in `ScreenHeader.tsx` was checked and holds. So on web this
is not a preference between two good options, it is the only half that draws anything.

**The seam is one component, not fifteen screens.** `ScreenHeader.web.tsx` keeps
today's drawn bar; `ScreenHeader.tsx` configures the stack header through
`<Stack.Screen options>` instead. Fourteen of the sixteen call sites pass nothing at
all and do not change; the two that pass anything are `suche.tsx`, with the search
field as a child, and `formular.tsx`, with `backLabel`, which are the two exceptions
argued below.

Three details this decision does not settle, and the implementation ADR has to:

- **The search field.** `SearchBar.web.js` is `const SearchBar = View`, so
  `headerSearchBarOptions` renders nothing on web — which the split absorbs, since web
  keeps the drawn bar. What is open is native: the platform search UI, or `suche.tsx`
  as a named exception that keeps the drawn bar everywhere.
- **`formular.tsx`'s `backLabel="Abbrechen"`**, which exists so that two controls named
  "Zurück" cannot mean two things. `headerBackTitle` is iOS-only and Android's native
  header shows no back title, so the label would disappear on Android. The form is
  probably a second exception; say so rather than let it be discovered.
- **The native back control does not route through `lib/navigation/goBack.ts`.** The
  anchor in `app/_layout.tsx` covers the deep-link case and `goBack` is the floor under
  it. Whether the floor is still needed is a ten-minute check with
  `correctiv://gespeichert` and the native arrow.

Lower risk than 0013 in one respect: native stack headers are the oldest path in
react-navigation, not an alpha API. A cost worth naming: a title has to be written for
each of the fifteen routes that use `ScreenHeader`, because no `Stack.Screen` sets one
today, which is also the fix for ~~every pushed route on the published web target
sharing one browser-tab title~~ — they share none: every one of them ships an empty
`<title>`, measured and retired by
[ADR 0030](0030-the-platforms-header-and-ours-on-web.md), which also found that
`options.title` does not reach a browser tab at all here and that writing the titles is
therefore only half the fix. The conclusion this paragraph draws from the wrong premise
— that the titles have to be written — is right.
And the chevron's colour comes from `useColors()`
rather than from a class, because `Ionicons` takes a colour prop and not a class name,
so this is a change that has to be seen in both appearance settings and with "System"
against a dark device.

## What this record drops from the review

**The app icon.** The review reported it missing; the repository contradicts that, and
the team supplied the accurate finding: the assets present are AI-generated
placeholders and are not approved artwork. That is a release task with a checklist,
not an architecture decision, and it is
[issue #90](https://github.com/faktenforum/correctiv-app/issues/90).

**`FlatList` for `suche.tsx`, as stated.** Withdrawn, and search is left undecided
rather than answered a different way.

The review's argument was cleaner code and rows outside the viewport under the existing
cap. Read against the screen it does not hold: `suche.tsx` renders two heterogeneous
sections and three empty states, so `data`/`renderItem` replaces nothing — it needs a
tagged array and a type switch, which is more code — and 0012's cost argument was store
subscriptions per row, which `ArticleRow` does not have.

But the reason not to do it is not that search is finished. Search is the least-built
part of the app, the only content area without a slice — the root reducer holds twelve
and search is not among them, and `stores/search.ts` is a thunk and a selector with no
state of its own — and its sources sit in two places: the REST query and its feed
fallback in that file, the project hits filtered in a `useMemo` inside the screen.
Whether that matters depends on something nobody knows yet, which is how many
sources search ends up with. **That question is not answered here, and answering it by
implication would be worse than leaving it open.** A result model with per-source status
is the right shape for several sources and speculative structure for one.

One part does not wait, because it is the existing rule rather than a bet on the answer:
the project-hit filter belongs in the core, where `searchLocalFeeds` already sits doing
the same job on feeds. Ten lines, and it makes that path testable beside the two that
already are.

Two triggers reopen the rest, and they can fire independently:

- **A second asynchronous source.** The screen's single `searching` flag is correct
  today, because there is one async source and the project hits are filtered
  synchronously with no loading state of their own. A second async source makes it
  wrong rather than imprecise — two sources can finish at different times, and the
  screen then says "Keine Treffer" too early or holds a spinner too long. That is when
  a typed result model with per-source status earns itself, and when the scroller
  question comes with it. It would be `SectionList` rather than `FlatList`, because a
  list of groups is what `SectionList` takes, and it passes 0012's tie-breaker
  equally: React Native's own export surface, and named in `@gjsify/react-native`
  alongside `FlatList` and `VirtualizedList`, all three on `Gtk.ListView` +
  `Gio.ListStore`.
- **The first source that paginates**, which makes the list unbounded and is
  [ADR 0012](0012-a-list-virtualizer-for-the-unbounded-lists.md)'s own written trigger
  for a virtualizer plus an amendment to it. 0012 therefore stands unchanged here, and
  its criterion stays intact for the other twenty-one lists it counts.

**The iOS build and distribution gap**, which `RELEASE.md` already records under "iOS
(not yet wired up)". Naming it twice does not make it smaller.

## What it measured

Taken 2026-09-09 unless stated, and the host is in the second column, because a
measurement without one expires invisibly.

| What | Host | Result |
| --- | --- | --- |
| `persist()` cold start | Android 16 (API 36), x86_64 emulator, debug build | 18–21 ms; first read 11–13 ms |
| fonts against store | same | `fontsLoaded` 183–272 ms, `storeReady` 189–248 ms |
| Ongoing persistence, 2026-09-10 | Pixel 8a Android 15/API 35 arm64 emulator on macOS arm64, release Hermes; AsyncStorage 2.2.0 / MMKV 4.3.2 + Nitro 0.37.1 | 30 writes per case; API timings and 5-7 ms action-to-completion improvement in section 4 |
| Warm storage API, 2026-09-10 | Same release build and backends | Five alternating rounds; 500 reads/writes per case, 200 for 1 MiB; section 4 |
| JS cache plus persistence, 2026-09-10 | Same release build; three fresh processes per backend, three PSS samples per stage | For 4 MiB already in JS cache, additional settled PSS: MMKV 4.55-4.56 MiB, AsyncStorage 0.49-0.50 MiB |
| AsyncStorage Android limits, 2026-09-10 | 2.2.0 documentation and default Android configuration, not a runtime limit test | 6 MB total database default; approximately 2 MB per-entry read limit |
| Hermes `Intl` surface | `hermes-android 250829098.0.17`, arm64 | Collator, DateTimeFormat, NumberFormat; no PluralRules |
| network inspection | `react-native` 0.86.3, source | on by default, native capture |
| error boundary | `expo-router` 57, source | `Try` + `{ error, retry }`, hides the splash |
| native header on web | `react-native-screens` 4.26.2, source | header config and search bar are bare `View`s |
| MMKV on web | `react-native-mmkv` 4.3.2, source inspection only | web build present, `localStorage`-backed; web persistence not runtime-tested |
| Rozenite under `expo export` | `@rozenite/metro` 2.4.0, npm tarball, not installed here | on unless `isBundling()`; an explicit `enabled` skips that check |
| `__DEV__` + `require` in a function | production web export | keeps the module; only module scope drops it |
| `npm run check` | this machine | 17.2 s total, oxlint + oxfmt 0.72 s of it |
| responsive code | repository | none |

## What this retires

~~Nothing in another ADR.~~ Two cells in [ADR 0006](0006-one-core-two-hosts.md)'s ports
table, struck there when section 4 was carried out in
[#136](https://github.com/faktenforum/correctiv-app/pull/136): the Expo host's answer
for `KeyValueStore`, "AsyncStorage", and its answer for `BlobStore`, also
"AsyncStorage". Both are MMKV now, in a store of its own each, and anyone reading
either cell would go looking in the wrong place. The rest of that table and the
argument around it stand.

Three claims in the source, and none is struck here, because a claim is struck when the
code that made it true changes and not when a record says it will:

- The comment atop `packages/app-core/src/lib/format.ts` justifies hand-written German
  month and weekday names with "The NS runtime has no German ICU". That runtime left
  the tree with [ADR 0007](0007-removing-the-nativescript-host.md), and section 6
  measured the replacement as present. Strike it when the formatters go.
- The paragraph in `components/ui/ScreenHeader.tsx` explaining why the app draws its
  own bars everywhere. Section 9 reverses it for iOS and Android and keeps its web half
  intact. Strike the first half when the split lands, and leave the second standing,
  because section 9 measured it and it is still the reason web keeps the drawn bar.
- The sentence in `lib/store/core.ts` that credits its own `__DEV__`-then-`require`
  shape with keeping the debugger out of a release build. The outcome is still true and
  the mechanism is not, so nothing is broken and somebody copying the shape for a local
  module would ship that module. Strike it when section 1 lands.

And three sentences in [AGENTS.md](../AGENTS.md), which is a living document and so
gets corrected rather than struck. Each correction belongs in the commit that makes it
necessary, not in this one: German "for everything a user reads, and only there" and
multilingual support being "under consideration" both stop being true with the first
message descriptor (section 6), and `npm run check` taking "about ten seconds" is
already 7 s out (section 8). **All three are done**: the first two in
[#144](https://github.com/faktenforum/correctiv-app/pull/144) with the localisation
seam, the third in [#151](https://github.com/faktenforum/correctiv-app/pull/151),
which moved the figure to ARCHITECTURE.md rather than correcting it in place.

## What this has not delivered

**Nothing was measured on iOS**, and the app has never been built for it. That falls
hardest on section 9, where a native header is most of the point, and on section 6,
where Hermes on Apple platforms was not checked at all.

**The startup numbers are from a debug build with a Metro-served bundle.**
They remain specific to that build and emulator. Section 4's later release-mode
comparison measures ongoing storage operations, not cold start, and does not
establish how either startup figure transfers to release or physical devices.

**`useFonts` is unexamined.** Section 4 found it on the critical path in one run of
two and then went no further, which makes it the largest unclaimed startup item in
this record.

**The other twenty-one lists in 0012 remain unmeasured**, as 0012 itself says. Nothing
here changed that, and dropping the search recommendation does not settle it either
way.

**MMKV was benchmarked, not adopted.** MMKV 4.3.2 and Nitro Modules 0.37.1 were
temporarily installed in a separate benchmark application ID, then removed with the
instrumentation. Section 4 exercised the real core persistence and cache code with
synthetic data, not screen rendering, navigation or scrolling. No physical-device,
iOS, battery, peak-memory or power-loss-durability conclusion follows. The storage
adapter replacement and bounded-cache policy ~~remain implementation work~~ landed in
[#136](https://github.com/faktenforum/correctiv-app/pull/136); the retires section
above already records section 4 as built, and this sentence contradicted it.

~~**Rozenite was read, not run.** Section 1 still relies on the published
`@rozenite/metro` 2.4.0 tarball, not an installed integration. Its runtime behaviour
in this app remains unobserved.~~ Installed and run in
[#149](https://github.com/faktenforum/correctiv-app/pull/149), which found the export
above and two things section 1 could not have known from a tarball: the Storage domain
is `@rozenite/mmkv-plugin`, there being no async-storage plugin, and expo-router 57
vendors its own react-navigation, so the navigation plugin talks to a second copy.
