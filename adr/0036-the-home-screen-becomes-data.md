# ADR 0036 — The home screen becomes data, and the app survives what it does not know

Status: accepted, 2026-09-16, decided by the product side after an interview that closed
every question but one. ~~**Not built.**~~ Partly built, in
[#177](https://github.com/faktenforum/correctiv-app/pull/177): the document, its parser and
its default layout carry §2, §6, §7, §10 and §14. ~~Fetching one (§4, §5), the configurator
(§1, §15) and scenarios in the workbench (§11–§13) are not.~~ Fetching one (§4, §5) is built
in [#245](https://github.com/correctiv/correctiv-app/pull/245). Scenarios in the workbench (§11–§13) are not. §15 is built in
[#246](https://github.com/correctiv/correctiv-app/pull/246), in the shape [ADR 0058](0058-the-workbench-holds-no-power-and-github-is-who-you-are.md) §2 gave it. The configurator of
this record's §1 is the carrying-out of ADR 0045 to ADR 0053. The open question is named at the end ~~and hangs on the source decision
`SOURCES.md` still carries~~, and is answered by [ADR 0057](0057-the-structure-comes-from-the-workbench-the-selection-from-wordpress.md).

## Context

The ask was for a home screen that changes several times a day, arranged by the newsroom:
which article leads, which podcast, which video.

**Half of that mechanism is already in the tree, hard-coded, for one place.**
~~`packages/app-core/src/lib/daypart.ts` lifts
the participation callout above the hero between 11 and 14, and `(tabs)/index.tsx`
renders the callout in one of two positions depending on the answer. Reading that file is
most of this decision:~~ The file is deleted by
[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §5; what is left of it is
the clock, in `lib/home-layout.ts`. The two positions in the screen are unchanged, and
what chooses between them is two moments in the document.

- ~~`DAYPART_HOURS` is a table of **editorial numbers**, and its own comment says why it is
  a table: *"so moving them is an edit and not a rewrite, and so a reviewer can argue with
  the numbers without reading the code."* That is a configuration. It is compiled in.~~
  The table is gone with the file, voided by
  [ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §5 — which keeps the
  argument inside it word for word and says so: moving those numbers is now a drag on a
  timeline and a line in a JSON file.
- ~~`WANTED` is a `Record<Daypart, TimedModule | null>` — a closed set the compiler checks,
  which is mechanism 1 of [ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md)
  already in place for this exact question.~~ Moved to `home.layout.json` and
  `lib/home-layout.ts` by [#177](https://github.com/faktenforum/correctiv-app/pull/177); ~~the
  closed set is `HomeSection['dayparts']` against the `Daypart` union now~~ — there is no
  `dayparts` key and no `Daypart` type since
  [ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §5, and the mechanism-1
  shape is `MODULE_SETTINGS` in `lib/home-settings.ts` instead — and `daypart.ts`
  no longer declares `WANTED` at all.
- ~~`timedModuleAt` returns `null` for a module the app cannot render, rather than lifting
  an empty slot.~~ Renamed `sectionsAt`, in the same move, in the same file. The app
  **already** draws what it knows and skips the rest.

So this record is not "build a dynamic home screen". It is: **that table stops being
source and becomes a document, and it grows from one place to all of them.** Everything
below is either an extension of a decision `daypart.ts` already made, or an answer to a
question it did not have to ask because it could not be wrong at runtime.

The screen is already a sequence of named places rather than one composition: a header, a
hero, the Spotlight briefing, the early-access card, the latest-research list, the
fact-check rail, the callout, the media row, the backstage teaser, a footer. Several are
already conditional on data — the latest-research list is absent while the feed is empty,
and `SpotlightBriefing` draws nothing when there is no issue to show — so "a place that
may be absent" is not new either. No count is given here on purpose; §14 makes the list a
definition, and a number typed beside it would be the second copy that goes wrong.

Three other things in this repository decide part of it.

**The workbench carries its state in the address.** Device, route, appearance and app
state are URL parameters ([ADR 0028](0028-one-shell-and-a-route-that-declares-its-context.md)),
so a link to a particular view of the app already exists and can be sent to somebody. A
layout scenario is one more parameter of that kind, which is why the workbench is the
obvious place to preview one.

**The workbench has no access control.** It is a developer tool on a public URL. The
moment the newsroom works in it, it is a production tool with production requirements, and
that is a second product in the same shell rather than a feature added to the first.

**The cache is bounded, and its bound was argued about article HTML.**
[`cache.service.ts`](../packages/app-core/src/services/cache.service.ts) holds at most 128
entries and 2 MiB in total, refuses a single entry over 768 KiB, and evicts
least-recently-used. [ADR 0026](0026-react-native-review-and-hardening.md) §4 is where
those limits and that eviction were required, and it deliberately chose no numbers —
"choose limits against representative content and offline needs before rollout" — so the
figures are the file's, each argued from a measured article mean or from the arithmetic of
a podcast list. Holding video offline is not an increment on that; it is a different
budget with a different eviction rule and an answer for a full device.

## Decision

### 1. The configurator is built for us, and the document is designed for the newsroom

We are the first users. The workbench has no sign-in, and where the configuration lives in
production is the question this record leaves open, so building an editorial tool now would
be building against an unknown.

But the **document** is designed as though the newsroom already owned it: no field means
"the person editing this knows the codebase". Then handing it over is a step and not a
rebuild, and everything below can be built today without waiting for the answer.

### 2. Fixed places that get filled, ~~not blocks that get arranged~~, voided by [ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) §4

The configuration says what goes in each named place. ~~It does not say where the places are
or how many there are.~~ It says both, and has since
[#177](https://github.com/faktenforum/correctiv-app/pull/177) made `sections` an ordered
list that `home-layout.ts` calls "Ordered: the host draws them in this order and adds no
order of its own"; the editor has rewritten that order since
[#184](https://github.com/faktenforum/correctiv-app/pull/184).
[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) §4 is the record that
makes it deliberate and adds adding and removing to it.

Free arrangement would mean a layout engine in the app, a rendering rule for every
combination, and a default layout that is itself a program. Fixed places mean the app draws
what it already draws, the default is a short literal, and an unknown arrangement cannot
exist ~~because arrangement is not configurable~~ — because an arrangement can only name
modules the app ships, and one it cannot draw is dropped and reported by §7 below. The
conclusion stands and its reason does not, voided by
[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) §4.

~~The cost is real and accepted: a new place is an app release, not a configuration change.~~
Voided by [ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) §4, and already
false before it: a new **module** is an app release, and a place naming a module the app
already holds is a line in the document — which is what the callout's two sections have
been since [#177](https://github.com/faktenforum/correctiv-app/pull/177).
That is the right way round for a screen of this length, and it is the arrangement
`daypart.ts` already has — its two positions for the callout are both written in the
screen, and only the choice between them is data.

### 3. A place carries either a pinned item or a rule, and the rule is what runs unattended

Every place has a rule — "the newest investigation", "the most recent Salon5 episode" — and
the configuration may override it with a specific item. With no override, the rule runs.

This is what makes "updates several times a day" true without anybody touching it, and it
is what makes an override safe: the thing it replaces is still defined. A screen where
every place must be filled by hand goes stale the first weekend nobody is working.

`daypart.ts` is the degenerate case of this — one place, one rule, no override — and it is
the evidence that the rule half works before any of the rest is built.

### 4. A small document the app fetches and stores

The configuration is one document. The app fetches it, keeps the last good copy, and draws
from that copy. Its shape is decided here; ~~where it is served from is the open question~~.
It is served as a copy of the core's own file inside the published artifact:
[ADR 0057](0057-the-structure-comes-from-the-workbench-the-selection-from-wordpress.md) §4.

### 5. Fetched at launch and on every return to the foreground, with a floor between tries

That is what "accompanies the reader through the day" needs and the whole of what it needs.
No background task, no permission, no battery argument, and no dependency on
[#105](https://github.com/faktenforum/correctiv-app/issues/105), where editorial push is
still undecided.

A minimum interval between fetches keeps a reader who switches apps constantly from
hammering the source.

### 6. ~~No version number in the document~~, voided by [ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §1

~~Skipping what it does not recognise (§7) already solves what a version number would solve,
and it solves the mixed case too — an app that knows every place but one. A version
field would be a second mechanism answering the same question, and a second mechanism for
one question is the one nobody keeps current.~~ The document has carried a `version`
since [#177](https://github.com/faktenforum/correctiv-app/pull/177) built it, against
this clause and with `lib/home-layout.ts` saying so in a comment; what was missing was
any reason for it to be there, and
[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) supplies one by being the
first change to move the number. It is still not a gate — a document numbered for a later
app is reported and then read, section by section — so §7 is unaffected and remains the
mechanism.

### 7. An unknown place is drawn past, and reported

The app draws every place it knows, ignores the rest, and reports what it skipped through
the `ErrorReporter` port
([ADR 0032](0032-a-port-for-the-error-report-before-a-provider-for-it.md)) — from the core,
where the document is parsed, and as a code carrying the unrecognised name as context
rather than as a sentence, which is the shape that record already fixed.

The app on a phone and the configuration on a server move at different speeds, and the
configuration is always the faster of the two. An app that refuses a document it does not
fully understand breaks every time the configuration is ahead of it, which is every time
anything new ships. Drawing past is the only behaviour that survives its own release
schedule.

Reporting is the other half. ~~It is the half `daypart.ts` does not have: its `AVAILABLE`
set silently resolves two of its three named modules to nothing.~~ It was the half
`daypart.ts` did not have: its `AVAILABLE` set silently resolved two of its three named
modules to nothing, until [#177](https://github.com/faktenforum/correctiv-app/pull/177)
deleted `AVAILABLE` along with `WANTED` and `timedModuleAt`. **That silence was correct
there and would be wrong here**, and the difference is worth naming so the code is not
copied along with its reasoning. A module with no source yet is a known gap, deliberate,
recorded in a comment, and true on every launch — reporting it would be reporting our own
backlog. An unrecognised name in a fetched document is the opposite: nobody decided it,
nobody can see it, and it means a reader is looking at a screen the newsroom thinks it
filled. It is ADR 0032's own example of the fault only the core can see, in as many words:
a bundle that parsed half.

### 8. A pinned item that has vanished falls back to the place's rule

The newsroom pins an article; the article is unpublished. The place already has a defined
answer — its rule — so it uses it. A hole on the home screen is the worst available
outcome and the one that needs no code to produce.

### 9. Both ends validate, and the app keeps the last good copy

The configurator refuses to write a document that does not validate. The app refuses to
*use* one, and falls back to the last copy that did.

Both, not one. The configurator prevents the fault; the app survives it. And the app cannot
know the document came from the configurator at all — it fetched a URL.

### 10. The first launch with no network gets a default layout shipped in the bundle

"The last state" does not exist on a first launch. The only thing that works there is a
layout compiled into the app. It is small because of §2: a list of places, each with its
rule and no pinned item — which is what `DAYPART_HOURS` and `WANTED` are today, and the
default layout is where those two tables end up.

### 11. Scenarios are named, live in the repository, and the name goes in the address

`?scenario=<name>`, beside the device, route and appearance ADR 0028 already puts there. A
scenario is shareable as a link, short enough to type, and a test case at the same time.

### 12. A scenario is the same file as a real configuration, only named

Not a separate preview format. A scenario can then be promoted to the real thing, and there
is one validator rather than two that disagree.

### 13. A scenario declares whether it pulls live content or uses fixed sample data

The newsroom wants today's articles in the frame. We want to compare a layout across three
device sizes without the content moving underneath us. Both are legitimate and
incompatible, so the scenario says which it is.

### 14. One definition of the places, and everything else derived from it

The rendering, the validator and the default layout are three copies of one fact. They are
generated from a single definition, so a new place without a rendering is a **compile
error** — mechanism 1 in ADR 0031, a `Record<PlaceId, …>` over a closed union.

~~`WANTED` is already exactly this shape for the daypart table.~~ `WANTED` was already
exactly this shape for the daypart table, before
[#177](https://github.com/faktenforum/correctiv-app/pull/177) carried this section out and
~~gave the shape to `HomeSection['dayparts']` instead~~ — which
[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §5 then deleted with the
dayparts themselves; the shape is `MODULE_SETTINGS` and the three key tables in the
parser now, and this decision is what they follow. The gallery catalogue is the
same move one rung further along the same ladder: `components.generated.ts` reads the
component folder into a union, which is mechanism 2, and `gallery/catalogue.tsx` is held
against that union, so a component with no entry does not compile. Both are chosen for the
same reason: the failure they prevent is silent.

### 15. The configurator writes a file into the repository, as a pull request

The shape the sources job has had since [#114](https://github.com/faktenforum/correctiv-app/issues/114):
a job measures something, writes a file, opens a pull request with what moved. Versioned,
reviewable, revertible, no new infrastructure.

This is the answer *while the configurator is ours*. ~~It is not the answer for the newsroom,
and that is the open question.~~ It is, once each editor has a GitHub account and opens the
pull request themselves: [ADR 0058](0058-the-workbench-holds-no-power-and-github-is-who-you-are.md)
§2 and §3.

### 16. Offline media downloads are a later decision

Holding video for offline use needs a storage budget, an eviction rule, and an answer for a
device that is full. None of it is an increment on the cache above; all of it is a record of
its own. Out of scope here so the rest can be built.

## What is still open

**Where the configuration lives in production, and who may write it.** Every other question
closed. ~~This one depends on the source decision `SOURCES.md` carries: what serves the app's
content decides what can serve its layout, and by whom.~~ It did not:
[ADR 0057](0057-the-structure-comes-from-the-workbench-the-selection-from-wordpress.md)
decides the layout's home without that decision, by splitting the question in two. What
does depend on the content source is which article a place shows, and that half is
WordPress's by ADR 0057 §2.

~~§15 is the answer for as long as we are the ones editing. §1 is what keeps that from
becoming permanent by accident.~~ §15 is the newsroom's answer as well, with each editor
opening the pull request from an account of their own:
[ADR 0058](0058-the-workbench-holds-no-power-and-github-is-who-you-are.md) §2 and §3.

## What it retires

Nothing is struck. No record makes a claim this contradicts, and `daypart.ts`'s reasoning
is extended rather than voided: its table becomes a document, and every sentence in its
comments about *why* it is a table stays true of the document.

It narrows [#163](https://github.com/faktenforum/correctiv-app/issues/163), which listed
five open questions: four are answered above — §1, §2, §10, and §16 for the video
question — and the fifth is the one named above.
