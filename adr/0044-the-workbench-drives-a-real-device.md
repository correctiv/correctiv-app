# ADR 0044 — The workbench drives a real device, in the same view

Status: accepted in shape, 2026-09-17, from the architecture meeting in
[#200](https://github.com/correctiv/correctiv-app/issues/200). **Unmeasured**: the
experiment §5 below names has not been run, and it is what says whether this is a workbench
feature or a devtools session with a nicer window. Nothing is built.

## Context

The note was "Die Workbench sollte auch echte Geräte fernsteuern können."

`/preview` frames the app's **web export** in an iframe. That is the right thing for
layout and it is not a device: the reader is a WebView
([ADR 0017](0017-native-rendering-as-the-rule-a-webview-for-the-exception.md)), the tabs
are the platform's on a phone and ours on the web
([ADR 0013](0013-native-tabs-and-a-web-tab-bar-of-its-own.md)), the header is the
platform's on thirteen routes ([ADR 0030](0030-the-platforms-header-and-ours-on-web.md)),
and both of those records still carry **iOS unrun** in the index. A tool that sets a state
and shows what it looks like is most useful exactly where the frame cannot go.

### What is already here, measured

**Rozenite is installed and it is already fenced.** `@rozenite/metro`,
`@rozenite/mmkv-plugin`, `@rozenite/react-navigation-plugin` and
`@rozenite/redux-devtools-plugin` are devDependencies of `apps/mobile`, wired in
`metro.config.js` behind the `ROZENITE` environment variable, and mounted development-only
by `src/lib/devtools/AgentTools.tsx`.
[ADR 0026](0026-react-native-review-and-hardening.md) §1 decided all of it, including the
part that matters most here: **module-scope selection is load-bearing**, because Metro
collects dependencies from the syntax tree and only drops a `require()` written at module
scope — three of five plausible shapes leaked into a production export — and the real
enforcement is `pages.yml` grepping the **published bundle** for the word.

What that gives, over the Metro-to-Hermes CDP channel: MMKV read **and write**, Redux
dispatch, and React Navigation drive. It needs a debug build, Metro running, and USB
through `adb reverse`.

So the meeting's note is not asking for a new capability. Most of it exists and is
fenced correctly.

### The gap, and it is structural rather than missing

`apps/mobile/src/lib/home/layout.ts` and `apps/mobile/src/lib/home/clock.ts` read
`window.localStorage` and nothing else. On a phone they answer "no override" and the app
runs on its own document and its own clock, which is deliberate and documented in both
files.

The override keys sit **deliberately outside the app's own MMKV prefixes**: `persist()`
writes back only the keys a slice declares, so anything invented under
`correctiv.state\store.` is dropped on the app's first write, and these two are not the
core's state and must not look like it.

The consequence is exact: **the home layout and the simulated clock are unreachable on a
device today, and no Rozenite feature changes that.** The MMKV plugin can write MMKV; these
two do not live in MMKV. This is a hole in our seams, not a hole in the tool.

### The floor, on a release build with nothing added

`adb shell am start` against the `correctiv` scheme, which `app.json` bakes into the
manifest. Navigation, and nothing else. Worth writing down because it is what remains true
whatever else is decided, and because somebody will one day want to drive a store build.

## Decision

### 1. The same view, synchronised with a device — not a device mode

Whatever is decided about transport, the shell shows **one** `/preview`. The device is
another thing the existing controls point at, not a second page with its own layout, its
own tools and its own address grammar.

Two reasons, and the second is the one with evidence behind it. A separate device mode is a
second product inside one shell, and the tools are the value — the appearance override, the
state fixtures, the console, the token list, the home document — so a mode that had to
reimplement them would be worth less than the one that exists. And a second copy of
anything in this repository has drifted: `AppEnvironment.tsx` exists because the workbench
kept its own list of providers and that list silently lost one.

### 2. Setting a state and seeing a screen, not replaying taps

The purpose is: put the app in a state, look at the screen on the device, change the state,
look again. Not an automation harness.

`screens/tools/` already drives taps — `tour-android.sh`, `tour-android-routes.sh`,
`tour-a11y.sh` — and it drives them for a different reason, which is producing a set of
screenshots to compare against `screens/`. Those two jobs look similar from far away and
want opposite things: a tour wants to be reproducible and unattended, and this wants to be
interactive and thrown away. Merging them would make both worse.

### 3. A tool that cannot reach the device is visibly disabled and says why

Not hidden, not silently inert. The pattern is already in the tree twice: the published
build reports "no dev handle" rather than offering controls that do nothing
([ADR 0025](0025-the-published-app-is-a-production-bundle.md)), and
[ADR 0038](0038-one-tool-at-a-time-in-a-rail.md) §5 put the reason a control is dead inside
the tool it disables, on a `NeedsDev` card, rather than in a badge on the outside.

Both halves of that are decided here as the rule for the device: a tool that cannot work
against a phone says so where somebody would reach for it, in a sentence naming what is
missing. The honesty rule is not new and this record does not get to invent a softer one
for itself.

### 4. A native-reachable seam for the two overrides, fenced the way Rozenite is

The home document override and the simulated clock get a seam that works on a device.
**Module-scope selection, plus the existing bundle grep in CI.** Nothing in a release build.

**Why fenced, when the same override is reachable in the published web export.** Because
the two seams are not the same kind of thing. On the web, `localStorage` exists whether we
want it or not; the app only *reads* a key, and
[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §8 argued what that read can
do — it selects between states the document already describes and cannot introduce one. On
native there is no such door, so a seam is something **we add**, for a tool, and ADR 0026
§1 measured what happens to a thing added for a tool when its fence is a `__DEV__` check in
the wrong place. Anything added for the workbench is fenced the way the last thing added
for the workbench was fenced.

There is a second reason and it is about the reader rather than the bundle: these keys can
replace the home document outright. A phone is somebody's phone, and a screen that quietly
differs from what the newsroom published is exactly the fault issue #112's naming rule
exists to prevent.

### 5. The first experiment, and what it settles

Not yet run. Authorise the USB device, `npm run start:rozenite -w @correctiv/mobile`, write
`correctiv.state\store.session` through the MMKV domain the way
`apps/workbench/src/preview/frame/seed.ts`'s signed-in fixture writes it on the web, and
watch whether the app reflects it live.

What that answers is **round-trip latency and reliability over real USB**, and that is the
question this whole record hangs on. A state write that lands in a second and holds is a
workbench. A state write that lands in five seconds, or lands after a reload, or drops the
connection when the screen sleeps, is a devtools session, and a devtools session does not
want a stage, a rail and an address bar built around it.

Naming the experiment in the record rather than doing it and reporting is deliberate: the
shape above is decided and does not depend on the answer, and the answer decides how much
of it is worth building. Writing both down separately is what stops the measurement being
read later as though it had been part of the decision.

## Why not the alternatives

**A device mode of its own.** §1 above.

**Wait for the measurement before deciding anything.** The shape questions — one view or
two, state or taps, disabled-and-honest or hidden — do not depend on the latency, and
leaving them open means they get answered by whoever builds the spike, at the keyboard, in
whatever way the spike happened to work.

**Reach the two overrides through MMKV after all**, by moving the keys inside
`correctiv.state\`. It would make them reachable today with no new seam and no fence. It is
refused for the reason `layout.ts` already gives: `persist()` writes back only the keys a
slice declares, so a key invented in there is dropped on the app's first write. These are
not the core's state and a seam that made them look like it would be a bug waiting for its
first write.

**A release build, driven over the scheme.** That is the floor described in the Context and
it is genuinely useful — but it can only navigate, so every tool named in §3 above would be
permanently disabled, and a workbench where nothing works is not the feature that was
asked for.

## What it costs

**A debug build and Metro running.** Whoever uses this has to be able to build the app,
which is a much higher bar than opening a URL, and it means the device half will never be
the thing shown in a meeting. The iframe stays the demo.

**One more thing the bundle grep has to catch.** §4 above adds a second fenced seam beside
Rozenite's, and the check that both stayed out is a grep over the published export in
`pages.yml`. A grep is mechanism 4 on
[ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md)'s ladder and it reads a
word, so the seam has to carry a word worth grepping for. That is a naming constraint on
code that has not been written, and it is the kind of thing that gets discovered late.

**Two transports, one set of tools.** Every tool now has two backends — the same-origin
property access into the iframe
([ADR 0014](0014-the-preview-shell-as-a-package.md)) and whatever the device channel turns
out to be — and each of them can be the reason a tool does not work. The third decision
above is what keeps that honest, and it does not make it cheap.

## What is still open

**Whether this is workbench-grade at all.** §5 above is the measurement and it has not been
taken. Everything above is a shape, and a shape that turns out to sit on a two-second
round trip is a shape nobody should build.

**iOS.** Everything measured here is Android: `adb reverse`, `adb shell am start`, the USB
authorisation. The iOS equivalents exist and none of them has been run, which is the same
sentence ADRs 0013 and 0030 already carry in the index and for the same reason.

**Which tools can work against a device at all.** §3 above says a tool that cannot must say so;
it does not say which ones those are, because that list is the output of the experiment
rather than an input to it. Measure, Inspect and Tokens each reach into the frame's
document, and a phone has no document to reach into.

**Whether more than one device can be attached.** Nobody asked, and the address grammar
would have to name one, so it is worth knowing that this record assumes a single device
without deciding that it must be.

## What this retires

**Nothing is struck.**

[ADR 0026](0026-react-native-review-and-hardening.md) §1 is the foundation of this record
and is untouched: its fence, its measurement of the five require shapes, and its choice of
the published-bundle grep as the real enforcement are what §4 above adopts rather than
revisits.
[ADR 0025](0025-the-published-app-is-a-production-bundle.md)'s "no dev handle" is the
pattern the third decision above generalises, and the decision behind it — that the
published build is a production bundle and gives the workbench nothing — is not weakened by
a device channel
that is development-only by construction.
[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §8's account of the clock's
one door is read carefully in §4 above and stands: it is about the web target, it says what
key can and cannot do there, and this record adds a second door beside it rather than
changing that one.
