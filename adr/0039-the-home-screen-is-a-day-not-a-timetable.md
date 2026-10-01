# ADR 0039 — The home screen is a day, not a timetable

Status: accepted and carried out, 2026-09-17. The document keeps its ordered places and
gains a list of **moments**; `dayparts` and `lib/daypart.ts` are gone. The workbench's
home tool draws the day as a track and moves the framed app along it.

## Context

[ADR 0036](0036-the-home-screen-becomes-data.md) turned the home screen's source order
into a document and [#177](https://github.com/faktenforum/correctiv-app/pull/177) built
it: an ordered list of sections, each naming a module, each optionally restricted to some
of four named parts of the day. [#190](https://github.com/faktenforum/correctiv-app/pull/190)
gave the editor four checkboxes per block for that restriction.

The product side looked at it and said what it was: **blocks appearing and disappearing
at fixed hours, and that is not the idea.** The idea is that the home screen accompanies
a reader through their day. Four checkboxes per block cannot express that, and the gap is
not one of polish. Three things were asked for that the vocabulary had no word for at
all — a fifth point in the day, a point at half past six, and the same block showing a
different article in the evening — and a fourth that it could only express by accident,
which is a block that is set up once in the morning and then adjusted.

**The measurement that decided the shape.** The shipped document used all four dayparts,
across two sections, and the six hour-boundaries in `DAYPART_HOURS`. What all of that
expressed was **two changes**: at 11:00 the participation callout moves above the lead
article, at 14:00 it moves back. Nothing else in the document was time-dependent, and no
boundary but those two had any effect on any reader's screen. A vocabulary of four named
hours, a table of six numbers and forty-eight checkboxes in the editor was carrying two
facts.

That is the whole argument. It is not that dayparts were wrong; it is that they are a
**pre-computed answer to a question nobody asked in that form**. An editor does not think
"this block belongs to the midday daypart". They think "at eleven, lift the callout" —
and then "leave everything else as it was", which the daypart model has no way to say,
because each section's four checkboxes are independent of every other section's and of
every hour's.

Two things this repository already decided are load-bearing here.

**The workbench carries its state in the address**
([ADR 0028](0028-one-shell-and-a-route-that-declares-its-context.md)), so a way of looking
at the app is a link. A simulated clock is a way of looking at the app.

**The app and the shell are one origin**
([ADR 0014](0014-the-preview-shell-as-a-package.md),
[ADR 0037](0037-the-whole-site-is-the-workbench.md)), so the shell's `localStorage` is
the app's. That is already how the edited document reaches the framed app, and it is the
only seam that works against the published export, where `expo export` leaves no dev
handle to dispatch through.

## Decision

### 1. The document is a day: the places as they start, and a list of what changes

`sections` keeps its meaning — the ordered places, each naming a module, each in the
state it is in when the day begins. `moments` is new: a list of times, each carrying only
what **differs** from the state that precedes it.

Rendering at a time is the fold: take the sections as written, apply every moment at or
before that minute, drop what is hidden. So **inheritance is not a feature with code
behind it. It is what the data already is**, and the editor's per-moment view is a diff
it can show directly rather than compute.

The alternative was a richer rule per block — a list of windows, or a schedule object per
section. Every version of it has the same defect: the blocks do not know about each
other, so "the morning, and then at eleven one thing changes" has to be written out once
per block, and an editor reading the document cannot see what a moment in the day
actually looks like without simulating it in their head. A moment is the unit an editor
already thinks in, and it is the unit that makes the file readable.

### 2. The day's start is the document, not a moment

The sketch this was designed against put the whole layout inside a first moment at 00:00.
It is one concept instead of two, and it is the wrong one: that first moment can then be
moved, removed or duplicated, and each of those is a way to lose the entire screen. It
also makes a section's declaration — its id and its module — a thing that lives inside a
time, which is false: a place exists all day or not at all.

So the sections carry their own starting state, `moments` carries only differences, and a
document with no moments at all is a home screen that is the same at every hour. That is
exactly the shape every document had before this record, which makes the migration a
deletion rather than a rewrite.

### 3. A moment changes state, not arrangement

A moment can switch a place off and another on, and it can change a place's settings. It
cannot reorder the screen.

This is [ADR 0036](0036-the-home-screen-becomes-data.md) §2 held to, not weakened: free
arrangement would mean a layout engine in the app, and arrangement that changed by the
hour would mean one that runs several times a day. What the original mechanism actually
wanted — `daypart.ts`'s own comment, "a module does not appear and disappear; it moves" —
is unaffected, because the callout has **two** sections in two positions and a moment
switches between them. The movement is in the document; the two places are in the screen.

### 4. A place carries settings, and which keys exist is the core's

A section may carry a `settings` object whose shape depends on its module: which article
the lead highlights, how many investigations the list under it shows, how many fact
checks the rail carries. A moment's change merges settings **key by key**, so a moment
that changes one setting does not restate the rest.

The parser refuses a key a module does not understand, which means it has to know them,
which means the table of them is part of the document's grammar — and the grammar is
`packages/app-core`'s. It is `lib/home-settings.ts`. What is deliberately NOT there is
which modules a host can *draw*: that is the host's, it arrives as `renderable`, and the
two questions are asked separately because they have different answers.

Every setting carries its own default, in the same table. `latest-research` drew five
items because `slice(1, 6)` said so in the app; the moment an editor can change that
number, "five" is a fact in two places — the module that slices and the editor that has
to show what happens when nobody has chosen.

`null` is a value and not an absence. For a setting that picks an item it is
[ADR 0036](0036-the-home-screen-becomes-data.md) §3's "no override, so the rule runs",
which an editor has to be able to say at a later moment: the morning pins an article and
the afternoon goes back to whatever is newest, which is one change and not the deletion
of one.

### 5. `dayparts` goes, and `lib/daypart.ts` with it

Everything four named hours could say, moments say; the shipped document's two sections
and six boundaries are two moments, and the behaviour is identical minute for minute.
Keeping both would be two ways to say when a block appears, and the one that goes stale
is whichever one the next person does not reach for.

`daypart.ts` had one part left that was never configuration — the clock — and that part
is now `minuteOfDay` and ~~`nextMomentAfter`~~ `nextChangeAfter`, voided by
[ADR 0059](0059-the-day-gets-a-date-and-the-newsroom-plans-in-editions.md) §4, in `lib/home-layout.ts`, beside the document
they are about. `nextDaypartChange`'s job survives unchanged and is the same job: a
mounted tab screen does not re-render on the hour, so the host sets one timer to the next
moment the document names.

**The argument in `DAYPART_HOURS`'s comment is not retired, it is honoured.** It said the
hours were a table rather than conditions inside a function "so moving them is an edit and
not a rewrite, and so a reviewer can argue with the numbers without reading the code".
Moving them is now a drag on a timeline and a line in a JSON file. That is the same
sentence, one rung further along.

### 6. A fault costs the smallest thing that carries the rule the app cannot apply

[ADR 0036](0036-the-home-screen-becomes-data.md) §7 says the app draws past what it does
not recognise, and the parser it built made one exception: an unrecognised key drops its
whole section, because a place drawn with its rule ignored is a place the newsroom
believes it configured. The document now has three levels, so that exception needs a rule
rather than a precedent.

It is: **drop the smallest thing that carries the rule.** In a section that is the
section, because a section's state IS the section and there is nothing smaller to lose.
In a moment it is the one change, because the other changes at that time are unrelated
instructions about other places. ~~A setting a module does not understand drops its
section, which is the same failure as an unrecognised key and is deliberately not given a
second rule of its own.~~ It drops whichever of the two it is written in, and the parser
has dropped the change since the day it was built; the half of the sentence worth keeping
is that settings get no rule of their own, and the word that is wrong is "section",
written while only one of the two levels was in view. Nothing voided it and there is no
later record to link: it was false the day it was written, and 2026-09-17 is the day
somebody read `parseChange` beside it.

The reader-facing cost was weighed rather than assumed. ~~An older app meeting a newer
document loses the whole lead-article place rather than showing the wrong lead.~~ True of
a section and false of a change: a refused change is dropped and the place goes on holding
what it inherited, so an older app leads at six with the article the newsroom chose for
the morning. Wrong the day it was written rather than overtaken, so there is no record to
link; measured 2026-09-17 by folding such a document and looking. What stands is the rule
above, not this generalisation of one level's cost to both. Losing the place is the worse
outcome for one reader and the right one for the newsroom, because a setting changes
**what a place shows**, not how it looks, and a place quietly showing something nobody
chose is the fault nobody can see.

Everything else in that parser is unchanged, including that it reports rather than
throws, that it costs the fetched copy and never the screen, and that a document numbered
for a later app is read anyway.

### 7. The moments are a set, and only a duplicate time is refused

The parser sorts by time. The order two moments are written in carries no meaning — "at
or before T" is a set, not a sequence — so a document that lists them backwards says
exactly the same thing, and a parser insisting on an order would be refusing a document
that is already unambiguous.

Two moments at the same time is the one case where writing order would decide something,
so it is the one case that is refused: the first wins and the second is reported, for the
reason a duplicate section id is refused, which is that the alternative is a rule about
which of them the editor meant and there is none.

A moment carrying no changes is kept and folds to nothing. That is not a special case
either; folding an empty list is the identity, which is why "a moment that changes
nothing is indistinguishable from its absence" is a property rather than a promise.

### 8. The simulated clock is a parameter of the selector, and the host has one door

`sectionsAt(layout, minute)` takes the minute. The core therefore holds no clock at all,
nothing has to be injected or reset for a test, and the whole question of "what time is
it" is one question in one file in the host: `apps/mobile/src/lib/home/clock.ts`.

That file's one door is `localStorage`, under `workbench:home-time`, beside the document
override that already worked this way. ~~On iOS and Android there is no `window`, so there
is no key.~~ There is one: `react-native/Libraries/Core/setUpGlobals.js` sets
`global.window = global`. The guard is safe on its other half, `!window.localStorage`, and
not on the half this sentence names, which is how `lib/home/layout.ts` already put it
about the same door. Nothing voided this either; it was false when it was written, and
2026-09-17 is the day it was read against React Native's own source.

On the web target the key can be set, and what it can do is move the home screen to
another hour **of the same document** — it selects between states the document already
describes and cannot introduce one, which is strictly less than `workbench:home-layout`
next door can already do.

### 9. The simulated time lives in the address, so it cannot be left behind

`tm=18:30`, beside the device, the route and the appearance
([ADR 0028](0028-one-shell-and-a-route-that-declares-its-context.md)). Two reasons, and
the second is the load-bearing one.

A view of the home screen at half past six is a thing to send somebody, which is the whole
premise of that address bar.

And a simulated clock held only in storage is **durable state nobody can see**: shut the
tab on a simulated evening and every later visit to the published demo opens on a home
screen stuck at eleven at night, with nothing on screen saying why. Held in the address,
the tool writes the key from `state.time` on every render, so an address that names no
time takes the key away. The same shape as the layout override removing its key when the
document matches the file, reached by a different door.

**And a page that has gone away takes it away too**, which is a second event and was not
built. An effect on `state.time` and an unmount both run while the page is alive, so the
key outlived a tab close and the paragraph above described a hole it had left open: with
`frame/handle.ts` making `BASE` the site's own `/app`, setting an hour, opening the app
raw and shutting the workbench pinned `<site>/app/` to that hour for that browser.
`usePreview` listens for `pagehide` now, and writes the address's time back on `pageshow`
so a page restored from the back/forward cache still simulates the hour it names. Added
2026-09-17 against the assembled site, where it was measured;
`apps/workbench/scripts/home-live.mjs` is the check under it, because only a browser has a
document that can go away.

### 10. The editor is a timeline, and an edit lands on the point in effect

~~The panel draws the day as a track: the hours, the moments as stops, the machine's own
clock as a mark, and a playhead.~~ The track is the stage's: it is drawn below the framed
app, at full width, on the route the document governs, because the hour is a fact about
what is being looked at rather than an inspection of it — voided by
[ADR 0042](0042-the-timeline-belongs-to-the-stage.md) §1. Moving the playhead tells the
framed app what time it is. ~~Everything below the track~~ Everything in the panel, which
the track is no longer at the top of — same voiding — edits **the point the playhead is
in** — the day's start, or the moment currently in effect — and shows, per control,
whether what it shows is inherited or set here.

A new moment is an explicit act ("Point here") rather than a side effect of editing at a
time no moment exists at. The alternative reads well in a sentence and badly in use: a
playhead nudged by one minute and a control toggled twice would leave two moments a
minute apart, and the document is meant to be a day somebody can read.

**The editor never writes a change equal to what the point already inherits.** It takes it
out instead, and takes the change entry out when its last field goes. The parser will
happily read a moment that restates what it inherits; a document full of them is a day
nobody can read, and the editor is the half that can know the difference.

Two things that sentence covers and the first version of it did not, added 2026-09-17
after each was reproduced through the controls. **An absent value is one of the values a
point inherits** — it means the module's own default, which §4 put in the same table for
this reason — so "no pin" and a count typed back to five are changes equal to what is
inherited and are not written. And **an edit changes what the points after it inherit**,
so those are re-checked: taking `hidden` off a place at the day's start takes the moment
that used to bring it back out with it.

### 11. The choices a block offers are sample data, and the interface says so from the inventory

WordPress will eventually answer "what may lead the app today". It does not: the feeds
are live, and the editorial query behind that question has not been asked for. So the
article picker offers `packages/app-core/src/data/home-pins.ts` — six real articles out
of the bundled snapshot, typed as `FeedItem`, which is what `wp.service.ts` maps a post
into, so connecting the real thing is a data-layer swap.

The marking is **read out of `apps/workbench/content/sources.manifest.ts`**, not typed
beside the control. That file and `SOURCES.md` are how this repository already tells a
live source from a stand-in, its test already fails on a file in `data/` with no row, and
a row names what it stands in for. So the day that row turns `live`, the "sample data"
badge goes with it and nobody has to remember this panel. A second way of saying "this is
not real yet" would have been the one that disagreed.

The shipped document pins nothing. The mechanism is demonstrated in the editor, not
baked into what every reader sees, because what leads the app is an editorial decision
and not a side effect of building the control for it.

## What this retires

[ADR 0036](0036-the-home-screen-becomes-data.md), **five claims, struck in place.** Four
of them are about one deleted file, and they are struck separately because they are four
separate things a reader would act on.

- **ADR 0036 §6, "No version number in the document"**, decision and argument. The field has been
  in the document since #177 built it, which that record's own code comment says; what
  this change does is give it a job, by being the first thing to move the number. A
  reader acting on it would delete a field the parser reads and reports on. That decision was
  already contradicted on the day it was built and nobody struck it — the strike is this
  record's because this is the change that makes the field mean something.
- **The Context's "Reading that file is most of this decision"**, and the link beside it.
  `lib/daypart.ts` does not exist, so that instruction cannot be followed at all; what is
  left of the file is the clock, in `lib/home-layout.ts`. The sentence before it, that
  half the mechanism was already in the tree, is true and stands.
- **The Context's first bullet**, "`DAYPART_HOURS` is a table of editorial numbers …
  It is a configuration. It is compiled in." The table is gone with the file. The
  *argument* inside it is not retired and §5 above says why at length.
- **The Context's second bullet's trailing clause**, "the closed set is
  `HomeSection['dayparts']` against the `Daypart` union now". There is no `dayparts` key
  and no `Daypart` type. The mechanism-1 argument it is an example of is intact and §4
  above is the same move for the settings table.
- **ADR 0036 §14's trailing clause**, "gave the shape to `HomeSection['dayparts']`
  instead". Same reason. That decision itself — one definition, everything else derived
  from it — is untouched and is what `MODULE_SETTINGS` follows.

[ADR 0036](0036-the-home-screen-becomes-data.md), **three claims read and deliberately
not struck.**

- **ADR 0036 §2, fixed places.** Not weakened by moments; §3 above is it, held to.
- **ADR 0036 §3, a pinned item or a rule.** This is the record that builds it. `pin` with
  `null` meaning "the rule runs" is that decision in the grammar.
- **ADR 0036 §10's "which is what `DAYPART_HOURS` and `WANTED` are today"**. A sentence about what
  was true when it was written, in a record that is a record. Nobody can act on it and be
  wrong; they can only read it as history, which is what it is.

**Nothing in [ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md),
[ADR 0032](0032-a-port-for-the-error-report-before-a-provider-for-it.md),
[ADR 0028](0028-one-shell-and-a-route-that-declares-its-context.md) or
[ADR 0038](0038-one-tool-at-a-time-in-a-rail.md) is affected, and all four were read for
it.** 0031's mechanism 1 is what `MODULE_SETTINGS` and the three key tables in the parser
are. 0032's report shape is unchanged and this adds codes to the same domain.
0028 is where `tm` goes and why. 0038 is the rail the tool sits in, and this tool keeps
its one slot.

## What is still open

**Where the configuration lives in production, and who may write it** — ~~unchanged, and
still [ADR 0036](0036-the-home-screen-becomes-data.md)'s open question~~, answered by
[ADR 0057](0057-the-structure-comes-from-the-workbench-the-selection-from-wordpress.md) §1
and §4 and by [ADR 0058](0058-the-workbench-holds-no-power-and-github-is-who-you-are.md) §2.
This record makes the document more expressive and does not touch where it is served from.

**Whether a day is enough.** Everything here repeats every twenty-four hours. A weekend
edition, a moment that fires once on an election night, a block that appears for three
days: none of them is expressible ~~and none of them has been asked for~~. The shape does not
prevent one — a moment is a time and a set of changes, and a condition beside the time is
an addition rather than a rewrite — ~~and it is deliberately not built ahead of somebody
wanting it~~. It was asked for on 2026-09-23, and
[ADR 0059](0059-the-day-gets-a-date-and-the-newsroom-plans-in-editions.md) is that addition.

**The pinned article's fallback is untested against a real vanished article.** ADR 0036
§8 wants a pin that has gone to fall back to the place's rule, and the module does that
in three rungs. What nobody has done is unpublish an article and watch. Worth a line here
because the code looks like it works and the interesting case is somebody else's CMS.
