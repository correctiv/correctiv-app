# ADR 0046 — What the editor may add, what a block is called, and what a drawn row costs

Status: accepted, 2026-09-17. ~~**Not built**, and deliberately so~~ — **§5 and §6 are
carried out** in [#210](https://github.com/correctiv/correctiv-app/pull/210), which built
0042 and 0045 §1, §2, §3 and §5, and **§1 to §4** in
[#213](https://github.com/correctiv/correctiv-app/pull/213), which built 0045 §4 and §6.
All six are carried out. This record answers the questions
[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) left to its carrying-out
and nothing else, so that the carrying-out is a build rather than a build plus four
arguments. The build is 0042 and 0045 §1 to §7, in that order.

## Context

ADR 0045 §4 makes the arrangement the editor's: add, remove, reorder. Its "What is still
open" then names five things the interview did not reach, and says of two of them that
"the carrying-out has to answer both". Three of the five block the build. This record
answers those three, adds a fourth question nobody had asked, and leaves the fifth open
because it is editorial rather than structural.

**The fourth question is the one that came out of a measurement**, and it is the reason
this record exists rather than a paragraph in a pull request. ADR 0045's "What it costs"
says the list "is the home screen rendered a second time in the same page as the home
screen. Nobody has measured it and it is the first thing a carrying-out should." It has
been measured now, on 2026-09-17, against `apps/workbench` on the dev server at 1440 ×
960, iPhone 15 Pro in the frame, by mounting every module of the shipped document in the
panel through `AppEnvironment` and timing twenty playhead steps:

| | Without the drawings | With twelve drawings |
| --- | --- | --- |
| DOM nodes on the page | 987 | 1184 |
| One playhead step, median | 37 ms | 69 ms |
| One playhead step, worst | 162 ms | 230 ms |

Three things fall out of that table, and the third is the one that decides §5 below.

- **The drawings are cheap in space.** 187 nodes and two images for twelve blocks, about
  3300 px of drawing. Nothing here needs virtualising.
- **The playhead is already not smooth.** 37 ms is over two frames at 60 Hz *before* a
  single block is drawn. Whatever the drawings cost, they are the smaller half of a
  problem that is in the tree today, and a carrying-out that measured only the new half
  would conclude the drawings were the fault.
- **The added cost is almost entirely avoidable.** The shipped document has **two
  moments** over twelve sections, so at 1438 of the day's 1440 minutes the effective
  sections are the same objects they were a minute earlier. A drawing that re-renders on
  its own section rather than on the clock re-renders twice a day.

**And one thing the measurement settled without a decision.** All twelve modules drew
real content — the lead article, the investigations list, the fact-check rail — with the
core still on its default `createMemoryPlatform()`. The feeds are fetched by the modules
themselves out of the workbench's own React tree, over correctiv.org's REST API, exactly
as they are in the frame ([ADR 0015](0015-reading-correctiv-org-through-its-rest-api.md)).
No port had to be wired in for the drawn rows, which is what the plan for this work
expected to have to decide. Decision 6 below is the half of that question the measurement
did not answer.

## Decision

### 1. The palette is the registry, and the shipped document stops being the roster

The insertion mark offers every module in `HOME_MODULES`. A module the shipped document
does not place is offered anyway, and that is the point of having a palette.

**What has to go for it is a check, and it is a good check.**
`apps/mobile/__tests__/home-layout.test.tsx` asserts, in as many words, that the app
"names every renderer this app holds, so none is written and never drawn". It was written
for a real failure — a module written, forgotten, never reachable — and ADR 0045's own
open question names it as the thing standing between the editor and a palette with
anything unused in it.

It goes because **the condition it flags stops being a fault**. Before the editor could
add a block, a module absent from the document was unreachable by anyone; after, it is a
module waiting in the palette, which is a state the newsroom will create on purpose the
first time it takes a block off the screen for a week.

**What does not go is the protection.** The risk that check was really about is a module
nobody can reach, and two things now cover it, neither of them new:

- The palette is built from the registry itself, so a module added to `HOME_MODULES`
  appears in the editor without anyone listing it anywhere. There is no second list to
  forget.
- `apps/workbench/test/preview/home-document.test.ts` already reads `HOME_MODULES` out of
  `apps/mobile/src/lib/home/modules.tsx` as source text and fails on a module with no
  entry in `MODULE_LABELS` — and on an entry no module answers to. A module that reached
  the palette without a name would be offered to a newsroom as `faktencheck-rail`, and
  that check is what stops it. It is the stronger of the two halves and it was already
  there.

So one check is retired and none is written to replace it, which is worth saying plainly
because "we removed a test" is the shape of a mistake. The replacement is a mechanism —
the palette reading the registry — and ADR 0031's first mechanism beats its fourth.

### 2. A new block's id is minted from its module, and the editor does not offer to change it

`callout-teaser` added to a document that has none becomes `callout-teaser`. Added to one
that has it already, `callout-teaser-2`, then `-3`: the module's name and the smallest
suffix the document is not using.

**An id is an address, not a label.** A moment names it, a parse problem carries it,
`LIFTED_CALLOUT` in `modules.tsx` hangs a margin on one, and `sectionTestId` puts it in
the rendered tree for the frame's outline to find. None of that is a thing a person
should be asked to type, and all of it breaks quietly if they change one later. The
editor shows the id — it already does, in a `code` at the end of each row — and offers no
way to edit it.

**The minted id is therefore ugly and that is correct.** The shipped document's ids are
hand-written and better: `hero`, `briefing`, `callout-lifted`. Those stay as they are;
this decision is about what a machine writes when nobody is there to name it, and a
machine that guessed a prettier name would collide with the next guess.

### 3. A removed id may come back, and the editing model is why that is safe

Remove `callout-teaser-2` and the next callout added is `callout-teaser-2` again,
carrying none of the old one's settings but all of its address.

ADR 0045 named this as a hazard: "an id that comes back inherits every meaning the old one
had in a document somebody has open elsewhere." True, and **"elsewhere" does not exist
yet**. The configurator writes a file in this repository through a pull request
(ADR 0036 §15); the app compiles that file in and does not fetch it (0036 §4 and §5 are
not built). There is one writer, the document is whole in one file, and a removed id is
remembered nowhere — so a ledger of retired ids would be a mechanism guarding against a
concurrency this system does not have.

**What would void this**, named here so it is not rediscovered: the day the configuration
is fetched at runtime, or two people edit it at once, a returning id stops being a fresh
address and starts being an old one. That is the same day ADR 0036 §4 gets built, and the
decision to revisit belongs with it.

### 4. The insertion mark offers every module, and says nothing about where one belongs

Two headers at the top, an impact footer in the middle: the editor allows both and
remarks on neither.

ADR 0045 left this open and pointed at the half that makes it hard — whether "makes sense
here" is a fact a module can declare or a judgement the editor would be inventing on the
newsroom's behalf, which is ADR 0036 §1's question. It is the second, so the editor does
not make it. A tool that greys out a combination is asserting editorial policy in code,
and the policy would be this repository's guess at a newsroom's taste.

**What stands in for it is the frame.** A second header is on screen, at the size it will
ship at, the moment it is placed — which is the whole argument for drawing the blocks
(§3 of 0045) arriving a second time. An arrangement nobody wants is visible immediately
and undone by removing it, and neither half of that needs a rule.

### 5. A drawn block re-renders on its section, not on the clock

The row's drawing is memoised on the section it draws. The playhead moving does not
re-render it; the section changing does.

This is measured rather than assumed, and the numbers are in the Context above: 37 ms per
playhead step becomes 69 ms with twelve blocks drawn, and the shipped document changes
nothing about any section at 1438 of the day's 1440 minutes. Without this the editor pays
the full cost a thousand times for two minutes of difference.

**It is a decision rather than an optimisation** because it constrains what a drawing may
read. A block that reached for the playhead directly — to draw itself differently at a
different hour — would defeat it silently, and the drawing would go stale rather than
slow, which is the worse failure. What a block draws is its section; the clock reaches it
only by changing that section, which is what `sectionsAt` already does.

**The 37 ms underneath is not this record's to fix** and is named so that it is not
mistaken for this work's doing. It is there today, on a playhead in a panel, and whoever
looks at it should look at the frame's reload rather than at the list.

### 6. Offline, the list draws less than the frame, and that is accepted

With no network the app's own bundle answers, because `app/_layout.tsx` hands the core an
`expoPlatform` whose `ContentBundle` is the committed offline articles. The workbench
hands it nothing, so `createMemoryPlatform()`'s `createEmptyContentBundle()` answers and
the feed-driven blocks draw nothing while the frame beside them draws a lead article.

**Not fixed, for now, and the reason is that the fix is bigger than the symptom.** Wiring
the app's bundle into the workbench's tree means the workbench configuring the core's
ports — which `AppEnvironment` deliberately does not do, in a paragraph that says why: a
port is a statement about the running app and not about how a component looks, and the
gallery's specimens want their props to decide what they draw rather than whatever a
bundle holds.

So the editor is a tool for somebody with a network, which everybody using it today has.
**What makes it honest rather than broken** is that the empty row is visibly empty next to
a frame that is not, so nobody mistakes it for the screen being empty. If that turns out
to be wrong, the answer is a line in the panel saying the blocks could not load, not a
port.

This is read from the code and **not measured** — unlike everything in the Context above,
and said so because the two do not carry the same weight.

## Why not the alternatives

**Keep the roster check and let the palette offer only placed modules.** The palette would
then be the document, and "add" could only ever mean "add another one of what is already
there" — which is ADR 0045 §2's silent-duplicates failure arriving through the other door.

**A short opaque id, `b7f3`.** Collision-proof and re-use-proof, and it makes every parse
problem, every moment and every test read like a hash. The ids are the one part of this
document a person reads while debugging it, and `callout-teaser-2` says what it is.

**Let the person name the block.** It is the friendliest option and it hands somebody a
stable address to rename. The rename would succeed, the moments naming the old id would
become `change-id-unknown`, and the editor would report it as a document problem rather
than as what they just did.

**Memoise the whole list instead of each drawing.** One `changed` flag over twelve blocks
means one section changing re-renders all of them — which at two moments a day is
correct 1438 times and wrong twice, in the direction that matters, because the two
minutes that change are the two the editor is looking at.

## What it costs

**A module can now be in the app and on no screen, and nothing says so.** That is decision
1 working as intended, and the price is that the failure it used to catch — a module
written and forgotten — becomes invisible again if the palette is ever not built from the
registry. The palette reading `HOME_MODULES` directly is therefore load-bearing and not
an implementation detail.

**Minted ids accumulate.** Add and remove a callout ten times and the document holds
`callout-teaser-2` again, not `-12`; but a document edited for a year will have ids whose
numbers no longer match anything a person would count. They are addresses, so this is
cosmetic, and the alternative was decision 3 keeping a ledger.

**Memoisation is a rule somebody has to keep.** §5 constrains what a drawing may read, and
nothing in a type says so. The first block that wants the hour will want it for a good
reason and will get it by reaching, not by asking.

## What is still open

**What happens to a block's settings when it is switched off and on again.** ADR 0045
asked it and this record does not answer it: whether a block brought back at 18:00 should
still be pinned to the article somebody chose in the morning, or whether coming back is a
new appearance that should run the module's rule. It is editorial, the mechanism admits
both, and nothing in the build below is blocked by it.

**What the gallery does with a setting somebody changes there.** ADR 0045 §10's question,
untouched, and it stays with §10.

## What this retires

[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md), **three of the five
items in "What is still open", answered rather than struck.** They are questions and not
claims, so there is nothing in them a reader would act on and be wrong about; what would
be wrong is to leave them reading as open once they are decided. Answered here: whether a
block may be added whose module the shipped document never uses (§1), what a new block's
id is and whether a removed one may come back (§2 and §3), and whether the insertion mark
offers every module (§4). The two that remain open are named above as still open.

**ADR 0045's "Nobody has measured it and it is the first thing a carrying-out should" is
now done**, and the table is in the Context above. The sentence is not struck: it was an
instruction to a carrying-out and it was followed, which is the sentence working rather
than failing.

[ADR 0036](0036-the-home-screen-becomes-data.md) §1, **read and deliberately not struck.**
§4 above leans on it: what the newsroom may configure is the newsroom's question, and the
editor refusing to encode taste is that decision applied rather than narrowed.

[ADR 0028](0028-one-shell-and-a-route-that-declares-its-context.md) and
[ADR 0027](0027-the-handbook-draws-the-apps-components.md) **were read for the offline
question decided above and neither is affected.** `AppEnvironment` not configuring the core's ports is described in
`apps/mobile/src/lib/env/AppEnvironment.tsx` and in
`apps/workbench/src/components/DirectPreview.tsx` rather than in either record, and §6
leaves it exactly as it is.

[ADR 0042](0042-the-timeline-belongs-to-the-stage.md), **nothing struck.** §5 above is
about what a drawing reads and 0042 §3 is about what a control may write; they meet only
in that both keep the playhead a thing that selects rather than a thing that is stored
twice.
