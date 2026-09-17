# ADR 0045 — The home editor arranges the blocks it draws, and a module declares its own settings

Status: accepted, 2026-09-17, from the design interview held after the product side looked
at the home-layout configurator that landed today. ~~**Not built.** §8 and §9 are built,
in [#208](https://github.com/correctiv/correctiv-app/pull/208); the rest is not.~~
**§8 and §9 in [#208](https://github.com/correctiv/correctiv-app/pull/208), §1, §2,
§3 and §5 in [#210](https://github.com/correctiv/correctiv-app/pull/210), and §4 and §6 in
[#213](https://github.com/correctiv/correctiv-app/pull/213)**. What is left is §7, the handle, and §10, the gallery. §7 is reshaped before it is built by
[ADR 0047](0047-the-handle-is-the-pointers-and-the-arrows-are-the-keyboards.md), which
keeps the arrow buttons rather than replacing them. The second of those changes
carried the whole of [ADR 0042](0042-the-timeline-belongs-to-the-stage.md) with it, in
one commit range, as the paragraph below says it has to.

§8 and §9 are the sections that are NOT part of the one piece of work below — a count is a
control inside a settings block that already exists, and the generator moves a declaration
between packages without touching the list or the playhead — so building them alone leaves
no half of anything waiting for the other.

[ADR 0042](0042-the-timeline-belongs-to-the-stage.md)'s move of the timeline out of the
tool panel is now **the same piece of work as this one**, not a neighbouring one. §1 below
makes the list and the frame two halves of one reading of the day, and one playhead drives
both. Built apart, either half gives somebody a playhead that only some of the interface
answers to: a track on the stage with a list that does not collapse against it, or a list
that collapses against a playhead still buried in the panel 0042 is emptying.
[ADR 0036](0036-the-home-screen-becomes-data.md) stood a day as "accepted, not built" and
that was uncomfortable enough to be worth saying on the first line rather than in the last
paragraph: nothing below exists, and the record before it is the one that says what a
carrying-out has to include.

## Context

The note was: make it work the way a theme editor does. A list of the blocks the screen
is made of, each one visible as the thing it is, added, removed and reordered by hand,
with what it can be configured to show underneath it.

**What is in the tree today** is `apps/workbench/src/preview/home/HomeDocument.tsx`: the
day as a track, a playhead, and under it one row per section carrying the module's name,
a sentence about it, an up button, a down button, a `Shown` checkbox and whatever
settings the module declares. It works, it is keyboard-reachable, and it reads as a form
over a JSON file, which is what it is. Nothing in it shows a person the screen they are
arranging; the frame beside it does, and the two halves do not know about each other
except through `outline`, which draws a box around the hovered row's element in the frame
([#193](https://github.com/correctiv/correctiv-app/pull/193)).

**The measurement that decided the shape of this record, and it is about ADR 0036 §2.**
That section says the configuration "does not say where the places are or how many there
are", and accepts a cost: "a new place is an app release, not a configuration change."
Read against the tree, on 2026-09-17:

- `packages/app-core/src/lib/home-layout.ts` declares `sections` as "Ordered: the host
  draws them in this order and adds no order of its own", and
  `apps/mobile/src/app/(tabs)/index.tsx` is a `map` over what `sectionsAt` returns. The
  order is the document's and has been since
  [#177](https://github.com/correctiv/correctiv-app/pull/177).
- `parseSection` takes any non-empty `id` that is not already taken. It checks the
  **module** against the host's `renderable` set and nothing else. So a section at a new
  position, naming a module the app already holds, parses and draws.
- `document.ts`'s `moved()` rewrites that order from the editor's arrow buttons, and has
  since [#184](https://github.com/correctiv/correctiv-app/pull/184). Its own doc comment
  cites ADR 0036 §2 while doing it.

So the cost sentence was already false, and not because of anything decided here. The one
thing the editor cannot do is add a block or take one away — and the document could
already describe either. What this record adds to the app is nothing; what it adds to the
editor is two verbs and a way of seeing.

**Two things about the shipped document the rest of this leans on.** `callout-teaser` is
named by two sections, `callout` and `callout-lifted`, which is ADR 0036 §2's own example
of one module in two positions and is why "the same block twice" is not hypothetical here.
And `apps/mobile/__tests__/home-layout.test.tsx` holds the registry and the document
against each other **in both directions**: the document names no module the app lacks, and
the app holds no module the document does not name. The second half is what makes the
first open question below a real one rather than a rhetorical one.

**Three decisions already in the repository carry weight below.**

The gallery draws the app's **real** components, compiled out of `apps/mobile/src` by
`apps/workbench/vite.app.mjs` ([ADR 0027](0027-the-handbook-draws-the-apps-components.md)),
so "draw the block rather than describe it" is a use of machinery that exists rather than
a new capability.

`fitScale` in `apps/workbench/src/preview/scale.ts` is never above 1, because "a device
frame scaled up is a lie about how many pixels the app thinks it has". §3 below is its
third caller and inherits the rule.

And the line between looking and writing is already drawn twice:
[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §10 has the editor never
writing a change equal to what the point already inherits, and
[ADR 0042](0042-the-timeline-belongs-to-the-stage.md) §3 has the stage's controls select
between states the document already describes while the panel's controls change which
states there are.

## Decision

### 1. The list is the day, the frame is the moment

The panel's list shows **every block in the day**, in the document's order. The frame shows
the screen at the minute the playhead names. Two different truths, side by side, each
saying what the other cannot.

The list is where the document is; the frame is where a reader would be. A list that
repeated the frame would be a second rendering of one fact and the worse of the two, since
the frame is the app itself. A frame that repeated the list could not show what is not
there.

### 2. A block that is not on screen at the playhead collapses to its row

Its header row stays — the name, the drag handle, and the mark that says it is off here.
The drawing goes away, and comes back when the block comes back. The whole day stays
visible and every block stays addressable; only the picture is spent on what is showing.

**This is the decision the interview turned on**, and the argument is worth the space
because the obvious alternative is wrong in a way that is hard to see afterwards.

If the list showed only what is on screen at the playhead, then **"remove" would mean two
different things that look identical**: *not on the home screen at all*, and *not at this
hour*. One is an edit to the day; the other is an edit to one moment in it. A person who
meant the second and got the first has deleted a block and its settings out of every hour,
and nothing on screen would have told them which they were doing.

It gets worse where it matters most. Blocks are distinguishable — they have ids — but
module **types** are not. The callout is already two blocks of one type. So in a list that
hides what is off, "add the callout here" could only ever mean a *third* instance, because
the second one is invisible and unpickable. The day would silently grow duplicates of
things it already had.

Showing the whole day removes the ambiguity rather than labelling it. **Add always
creates, remove always deletes, and re-using a block that is off at this hour is switching
it back on** — which is an operation on a block a person can see and point at.

### 3. The blocks are drawn, not described

Each row renders the app's real component through the same build the component gallery
uses, not a name and a sentence. A theme editor shows the theme.

At a window wide enough, a block draws at the phone's own width, so what is in the list is
the size it is on the device. Narrower, it scales down as a whole — never up, by
`fitScale`'s rule. The component gallery lets its column decide a specimen's width and
measures whether the result clipped; that is right for a component being inspected on its
own and wrong here, where the block's job is to be recognised as the thing on the phone.

### 4. The arrangement is the document's, and the editor writes it: add, remove, reorder

One column. No nesting, no sizes, nothing side by side. A block is a module from the
registry the app ships, and the document says which ones, in what order, how many.

**This is the claim in ADR 0036 §2 that has to go, and precisely this much of it.** What
that section refused was free arrangement, on three grounds: a layout engine in the app, a
rendering rule for every combination, and a default layout that is itself a program. All
three still hold, and none of them is being spent:

- **No layout engine.** The app's renderer is a `map` over a list. That is what it already
  is, and it does not become anything else when the list gets longer or shorter.
- **No rule per combination.** There are no combinations. One column of blocks in an order
  has no interaction between neighbours to have a rule about, which is exactly what the
  refusal of nesting, sizes and columns buys and why those are refused here rather than
  left for later.
- **The default is still a short literal.** `home.layout.json` is a list of ids and module
  names. Adding the ability to edit it does not change what it is.

What is spent is the sentence about the cost, and it was already spent: a place naming a
module the app holds has been a line in a JSON file since #177. A **new module** is still
an app release, and that is the constraint that survives — the app's vocabulary is fixed
at build time, the document may only use words from it, and a word it does not know is
dropped and reported exactly as ADR 0036 §7 decided. Arrangement became configurable;
**what may be arranged did not.**

Removing a block takes with it every change that names it. A change naming a place that is
not there is `change-id-unknown` — the parser reports it and drops it — and the editor is
the half that can know, which is ADR 0039 §10's "an edit changes what the points after it
inherit" applied to the one edit that can orphan a change outright.

### 5. `hidden` stays in the document and leaves the interface

Switching a block off at the playhead writes the change into the moment in effect there,
exactly as the checkbox does today. What goes is the checkbox: the list shows the result
by collapsing the row (§2), and the switch is the same control a person already used to
put the block there.

**Why `hidden` was not removed with its checkbox**, because the obvious reading of
"remove instead of a checkbox" is that it should have been. Without `hidden`, a moment
could express "the callout is up now" only by inserting a block and taking another out.
That is **arrangement changing by the hour**, which ADR 0039 §3 refused, and its reason is
untouched by anything here: a moment carries what differs, and if what differs could be
the shape of the list then every moment would have to be folded before anybody could say
what the screen is made of. `hidden` is what keeps the day's blocks a fixed set with
states, and the states are what a moment carries.

So the two verbs live at two levels and that is the point of the pair. **Add and remove
are the day's**; they change which blocks exist. **On and off are a moment's**; they change
what a block is doing at an hour. §2 above is what makes the difference visible, which is
the only reason it can be trusted to a person.

### 6. An insertion mark between two blocks, offering the modules drawn the same way

A thin control between every pair of blocks, and at each end. It opens the available
modules, each one drawn as §3 draws a block, and choosing one puts it there.

The position is chosen **before** the block, not after. A person inserting into a list
points at a gap and then says what goes in it; the alternative — pick a module, then be
asked where — has the same two steps in the order that makes the first one abstract.

### 7. One handle, two ways, ~~and the arrow buttons go~~ and the arrow buttons stay

Each block has one handle. A pointer drags it. ~~The keyboard takes it — focus the handle,
pick it up, move with the arrow keys, drop it, Escape abandons and puts it back — and the
destination is announced as it moves.~~ The handle has no keyboard mode, and the arrow
buttons are the keyboard's route rather than something replaced by one — voided by
[ADR 0047](0047-the-handle-is-the-pointers-and-the-arrows-are-the-keyboards.md) §1 and §2,
which takes this section's own condition below seriously: nothing tested replaces them, so
they stay.

One mechanism with two inputs, not two mechanisms. The track above already argues the
distinction in its own comment: it is a pointer surface with a typed field beside it as
the accessible route, and giving it a slider role as well "would have been a third way to
say the same thing, and the one nobody tests". ~~Keeping the arrow buttons beside a drag
would be that third way.~~ It is the second way, one control per input, which is what
`Timeline.tsx` itself does — same voiding. A handle that both inputs move is one code path
and one thing to test.

**The arrow buttons are the accessible route today, so what replaces them has to do their
job before they go.** [#199](https://github.com/correctiv/correctiv-app/pull/199) measured
the app's controls against a thumb and a screen reader rather than judging them from the
source, and fixed the ones that fell short; it is scoped to `apps/mobile` and the editor
is not in it. That difference in scope is not a
difference in standard. An arrangement reachable only by mouse would be this repository
shipping, in the tool it uses to build the app, the thing it spent a pull request removing
from the app on the same day.

### 8. Settings expand under their block, and a count is a slider

A block's settings open under it, in the list, where the block they belong to is drawn. A
block whose module declares no settings has no control for them and no empty section
promising one — which is most of them, and `home-settings.ts` already says why that is a
fact about the modules rather than a gap to fill.

A count is a slider with its value shown beside it, not a number field. The bounds are in
the declaration already — every count spec carries its own `min` and `max` — and a number
field hides them: today, typing a value past the cap is silently ignored, because the
handler returns without setting anything and without saying so. A range input
cannot be out of bounds, carries its ends visibly, and is operable and announced from the
keyboard without anything being added to it.

### 9. A module declares its settings beside itself, and a generator carries them into the core

The declaration is written where the module is written, in `apps/mobile`. A generator
reads the declarations and emits the table `packages/app-core` validates against. A check
fails when the emitted file and the declarations disagree, and its fix is to run the
generator and commit.

That is `scripts/generate-component-ids.mjs` one rung further along: it reads
`src/components` and emits the union `src/gallery/catalogue.tsx` is typed against, so a
component with no entry does not compile, and `__tests__/gallery-catalogue.test.ts` is
what fails when the file is stale. ADR 0036 §14 already names that mechanism as the ladder
this belongs on, and [ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md)'s
mechanism 2 is what it is.

What it buys is that a module and its settings are one thing to write and one thing to
read. `MODULE_SETTINGS` in the core and the module that reads a spec by name are two
halves in two packages today, and the failure when they part is quiet: a spec no module
reads does nothing, and a module reading a key the table does not list gets its fallback
forever, because the parser refuses the key and drops it — visibly only if some document
happens to set it, and then at the cost of the whole section.

**The label is not part of this and does not move.** `MODULE_LABELS` and `SETTING_LABELS`
stay in the workbench, for the reason `home-settings.ts` already gives about the core: a
label is how a tool asks a person for a value, and the app has no use for one.

#### Why the declaration cannot live in the core, and why nothing registers at runtime

The core validates a fetched document **alone**. That is ADR 0036 §9's two-ended
validation and ADR 0039 §4's grammar: the parser refuses a key a module does not
understand, and refusing means knowing. It imports no React
([ADR 0006](0006-one-core-two-hosts.md)) and the modules are React Native components, so
the declaration cannot sit in the core beside the parser and beside its module at the same
time. And it cannot be imported the other way: `packages/app-core` is a dependency of
`apps/mobile`, so an import back into the app is a cycle and the end of the core being a
package that stands on its own.

A generator is what crosses that boundary without reversing it. The dependency at build
time is a script reading files; the dependency at compile time and at runtime stays what
it is. What is committed is a file in the core with no imports from the app in it.

**Runtime registration was refused, and it is the option that looks cheapest.** Have the
host call something at startup that hands the core each module's settings, and the
generator disappears. What disappears with it is the core's ability to validate a document
by itself: `parseHomeLayout(document)` would answer differently depending on what had
booted first, so a test, a check, a configurator and anything that ever validates a
document on the way out would each need an app's registry populated before they could ask.
That is the platform-freedom everything here hangs on, spent to save a script.

It would also collapse a separation ADR 0039 §4 made on purpose. **Which keys exist** is
the document's grammar and is static. **Which modules a host can draw** is the host's and
arrives as `renderable`, at the call. The two questions have different answers and are
asked separately today. Registration would make the first question look like the second
and answer both from whatever was in the room.

### 10. ~~The gallery gets a module's settings with the declaration~~ The editor has them, and the gallery points at it

~~Because the declaration sits with the module, the component gallery can show a module's
settings and let somebody work them where the component is already drawn. A setting is a
question about what a component shows, and the gallery is the page that draws components,
so it is one page rather than a second copy of the controls.~~ The editor is that page:
§1 to §9, built, draw every module with its settings beside the running app, so a second
set in the gallery would be the copy this paragraph was written to avoid — voided by
[ADR 0048](0048-the-gallery-points-at-the-editor-rather-than-copying-it.md) §1 and §2,
which leaves the gallery a sentence and a link.

This is a consequence being claimed, not a mechanism being specified. What the gallery
needs to draw is the **module**, and the modules are deliberately not in `src/components`
— `modules.tsx` says why, that a specimen of "the fact-check rail plus its heading" is the
screen and not a component — while the gallery walks exactly that folder. Which of those
moves, and whether it should, is below.

## What it costs

**The panel and the stage stop being separable.** The list collapses against a playhead
that ADR 0042 puts below the frame, so the two records now have one build order and one
review. Named on the first line for that reason.

**The list gets long and expensive.** Every block in the day is drawn, and drawn as the
app's real component inside the app's real environment. The rows that are off are cheap,
because they collapse; the rest are the home screen rendered a second time in the same
page as the home screen. Nobody has measured it and it is the first thing a carrying-out
should.

**One more generated file that can be stale.** Mechanism 2 buys a compile error and
charges a commit for it. `components.generated.ts` already charges it and the charge is
worth naming a second time rather than discovering it: an agent or a person who edits a
declaration and does not run the generator gets a red check and a one-line fix, which is
the deal, and the deal is only good while the check exists. Add it with the generator.

**Two verbs that both read as "remove".** §2 and §5 make the difference visible, and
visible is not the same as understood. A person who wants the callout gone for good and
switches it off at the wrong moment has made an edit that looks right in the frame in
front of them and is wrong at every other hour. Nothing here prevents that; the whole day
being on screen is what gives them a chance of seeing it.

## What is still open

**Whether a block may be added whose module the shipped document never uses.** Today it
cannot come up, and not by accident: `apps/mobile/__tests__/home-layout.test.tsx` asserts
that the app holds no module the shipped document does not name, so a module that exists
and is unplaced fails the app's own suite. That check is good and was written for a real
failure — a module written, forgotten and never drawn. It is also the thing standing
between the editor and a palette with something in it nobody has used yet. Which of the
two gives is a decision, and it is not this one.

**What happens to a block's settings when it is switched off and on again.** Off is a
state and not a deletion, so the settings are still written in the document and come back
with the block. That is what the parser and the fold do today and it is probably right.
What nobody has decided is whether it is right *editorially* — whether a block brought
back at 18:00 should still be pinned to the article somebody chose for it in the morning,
or whether coming back is a new appearance that should run the module's rule. The
mechanism admits both and the interview did not ask.

**Whether the insertion mark offers every module or only the ones that make sense there.**
Two headers at the top of the screen is a document nobody meant; so is an impact footer
in the middle. Nothing in the grammar refuses either. Whether the editor should, and
whether "makes sense here" is a fact a module can declare or a judgement the editor would
be inventing on the newsroom's behalf, is unanswered — and the second half of that
question is ADR 0036 §1's, which is why it is not being answered casually.

~~**What the gallery does with a setting somebody changes there.** §10 claims the gallery
*can* offer the controls. It does not say whether moving one changes anything beyond that
one drawing, whether it can be linked to like `?c=` already links to a component, or
whether a value set there has any way to reach a document. And underneath it: whether the
gallery draws the module or the component, given that the modules are deliberately not in
the folder the gallery walks.~~ Nothing, because nothing changes there: the surface that
raised all four questions is not built — same voiding. The one part that stays a real gap
is whether the EDITOR's address can name a block, which
[ADR 0048](0048-the-gallery-points-at-the-editor-rather-than-copying-it.md) §4 names as
still open.

**What a new block's id is, and whether a removed one may come back.** An id is the
document's stable address — a moment names it, a report carries it, `LIFTED_CALLOUT` keys
a margin on one — so minting one is not a detail. Nor is re-use: an id that comes back
inherits every meaning the old one had in a document somebody has open elsewhere. The
carrying-out has to answer both and the interview did not reach them.

## What this retires

[ADR 0036](0036-the-home-screen-becomes-data.md), **four claims in ADR 0036 §2, struck in
place**, and they are separate strikes because they are four separate things a reader would
act on. All four were false before this record; it is the record that makes the capability
deliberate, which is why the strikes are its, in the shape ADR 0039 used for ADR 0036 §6
of the same record.

- **ADR 0036 §2's heading, its second half: "not blocks that get arranged".** Blocks get
  arranged. The first half is left standing and the strike is deliberately not wider: a
  place is still filled by exactly one module out of a registry the app ships, and a
  heading is what a citation points at, so a strike that swallowed the whole of it would
  tell a reader the section had been overturned rather than that half of it had moved.
  §4 above is what it moved to.
- **ADR 0036 §2's "It does not say where the places are or how many there are."** It says
  both, and has since #177 made `sections` an ordered list the host draws in the order it
  is written. The editor has rewritten that order since #184. A reader acting on this
  sentence would look for the screen's order in the app and not find it.
- **ADR 0036 §2's "because arrangement is not configurable", the reason clause only.** The
  conclusion it supports — that an arrangement the app cannot draw cannot exist — is true
  and stands; its reason is not, and the true one is ADR 0036 §7, which drops and reports a
  module the host does not hold. A reader acting on the clause would conclude that
  ADR 0036 §7 is defending against nothing.
- **ADR 0036 §2's "The cost is real and accepted: a new place is an app release, not a
  configuration change."** A new **module** is an app release. A place naming a module the
  app already holds is a line in a JSON file, which is what the callout's two sections have
  been since #177.

[ADR 0036](0036-the-home-screen-becomes-data.md), **read and deliberately not struck.**

- **ADR 0036 §2's first two clauses of the argument** — a layout engine, a rule per
  combination, a default that is a program. Sound, and §4 above spends none of them. This
  is the half of that section worth reading and it is why it is not struck whole.
- **ADR 0036 §2's "Fixed places mean the app draws what it already draws, the default is a
  short literal"**. Both still true of the tree: the renderer is a `map`, and the default
  layout is a list of ids and module names.
- **ADR 0036 §7, an unknown place is drawn past and reported.** This record leans on it.
  Making arrangement configurable is precisely what makes it load-bearing rather than
  precautionary.
- **ADR 0036 §14, one definition of the places and everything else derived from it.**
  §9 above is that decision applied to the settings table, one rung up the same ladder it
  already names.

[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) **§3, "A moment changes state,
not arrangement" — read in full and untouched**, and it matters that it is untouched rather
than merely narrower, because §5 above is built on it.

ADR 0039 §3 is about what a **moment** may do. This record changes what the **document**
may say, and the editor is what writes the document. A moment still cannot reorder the
screen, still cannot add a block and still cannot take one away; its vocabulary is `hidden`
and `settings`, unchanged. The reason it gave for the limit is the reason §5 above keeps
`hidden` at all: arrangement that changed by the hour would mean the shape of the list
could only be known by folding, and then nothing on screen could tell a person what the day
is made of. §5 is that argument used, not weakened.

Its sentence "This is ADR 0036 §2 held to, not weakened" is the one thing in it that
touches what is struck above, and it is left alone. It is a claim about ADR 0036 §2, that
section is struck where it is false, and the strikes carry a reader who follows the
citation. Striking it here would mark the wrong sentence: what changed is not that moments
started arranging things.

[ADR 0042](0042-the-timeline-belongs-to-the-stage.md), **nothing struck, and one thing it
says comes due.** ADR 0042 §3's line between looking and writing is the line §4 above
extends: adding, removing and reordering a block are writing the document, so they need the
panel, exactly as adding and moving a moment do. The playhead on the stage goes on selecting
between states the document describes. ADR 0042 §2's "drawn where the document governs the
route" is unaffected, and the sentence that record says its carrying-out will strike —
ADR 0039 §10's "The panel draws the day as a track" — is still that change's to strike, now
that the two changes are one.

[ADR 0027](0027-the-handbook-draws-the-apps-components.md),
[ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md),
[ADR 0038](0038-one-tool-at-a-time-in-a-rail.md),
[ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md) and
[ADR 0041](0041-a-change-may-name-an-audience.md) **were read for this and none is
affected.** 0027 is the machinery the blocks above are drawn with. 0031's mechanism 2 is
what the generator above is. 0038's rail is where the panel still is, and this record opens
no second tool. 0040's direction is unchanged and untouched by that generator, which runs
app to core and adds nothing in either direction between the app and the workbench. 0041
puts an audience on a change; nothing here touches a change, and adding and removing a
block are the day's rather than a moment's, so the two extend the document at different
levels and do not meet.
