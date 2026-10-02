# ADR 0073 — Every screen takes every block, and a block declares its category

Status: accepted, 2026-10-02, decided by the product side and built the same day. It
supersedes the part of [ADR 0071](0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
§2 that refuses a block on a screen it does not declare, and the part of
[ADR 0054](0054-a-block-declares-where-it-may-appear.md) §2 that has a block name the
screens it may appear on.

## Context

Since ADR 0054 §2 every block named the screens it was allowed on, in
`apps/mobile/src/lib/home/screens.ts`, and ADR 0071 §2 gave the parser that table so a
document placing a block elsewhere was refused. The editor's palette read the same table:
a screen was offered the blocks that had named it.

Thirty-two blocks, and all but two named exactly one screen. The table therefore said
almost nothing except "this block was first written for that screen", and it said it with
the authority of a rule. What it cost was concrete and was reported by the newsroom side:
arranging Home, the palette could not offer the live radio banner, the podcast rail, the
two video rows or the Backstage audio list, because those were written for the Mediathek.
There is no editorial reason for that. A newsroom that wants the live radio at the top of
Home on a broadcast day is asking for something the app can already draw.

ADR 0054 §2's own argument was that a block should say where it belongs rather than have
it inferred from the name of the registry holding it. That was right about the inference
and wrong about the answer: where a block belongs is an editorial judgement made once per
placement, not a property of the block.

ADR 0054 "What it costs" predicted this, in the sentence that said the field "will be
right for one screen and unproven for two" and should be read as unmeasured until a block
declared two. Four screens later it is measured, and the measurement is this record.

## Decision

### 1. Every configurable screen may carry every block

The per-screen declaration is removed rather than widened. A document may place any block
on any of the screens ADR 0071 §1 makes documents, and the parser does not ask which
screen a block was written for, because nothing any longer records it.

What stays validated is everything that was ever load-bearing, and the list is worth
writing out because "the parser got weaker" is the shape of a mistake:

- **The block exists.** A section naming a module no entry in `MODULE_CATEGORIES` answers
  is still refused, now by the host's `renderable` set alone (ADR 0036 §14), as a document
  ahead of the app always was.
- **The settings are the block's.** A key a block does not understand is refused as before
  (ADR 0045 §9), and the settings belong to the placement rather than to the block, which
  is ADR 0071 §3 unchanged and is what makes one block on five screens coherent.
- **The feature gate.** A block of a feature this build cannot reach is dropped before it
  is drawn, wherever it is placed (ADR 0072 §5).
- **Moments, conditions, audiences.** Unchanged, because they were written about a block
  and a reader and never about a screen (ADR 0039, ADR 0060, ADR 0071 §2).

A table of thirty-two rows, nearly all of them saying the same thing, is also a table
somebody has to keep: every new block costs a line and the line is nearly always the
obvious one. Removing it makes the default "anywhere", which needs no maintenance, and
leaves the exceptions to say something.

### 2. A block declares a category, and the workbench says what the category is called

One field, one value, required of every block:
`struktur`, `recherche`, `faktencheck`, `medien`, `mitmachen`, `club`. It is declared in
`apps/mobile/src/lib/home/blocks.ts`, beside the blocks, and carried into the core by the
generator the settings already use, so `packages/app-core/src/lib/block-category.ts`
exports `blocksByCategory(screen)` and every tool groups the same way.

This is the half ADR 0054 §2 was reaching for and named wrongly. A palette of thirty-two
specimens needs an order a person can navigate; what it does not need is a rule about
where a block may go. So the field survives, with its question changed from *where may
this appear* to *what kind of thing is this*, which is a property of the block and
therefore a thing the block can honestly declare.

**One category per block and never a list.** The question the picker answers is "where do
I look for the video row", and that has one answer or it is not worth asking. Where a
block could go in two families it is filed under the one somebody arranging a screen would
reach for first.

**The words are the workbench's**, which is ADR 0054 §3 unchanged and the line that
matters most here: the app declares what a thing is, the workbench says what it is called.
A category id is the app's vocabulary and the same in every language; the German heading
is a descriptor in `apps/workbench/src/preview/home/document.ts` and its string is in that
site's own catalogue (ADR 0050, ADR 0052). Nothing in `packages/app-core` holds a label
for one.

**The ratchet is the roll-call.** `MODULE_CATEGORIES` has an entry per block and
`apps/mobile/__tests__/home-layout.test.tsx` fails in both directions — a block with no
category, and a category for a block the app cannot draw. That is the pair ADR 0054 §2
bought in place of ADR 0046 §1's "no second list to forget", kept whole with the category
standing where the list of screens stood.

### 3. Four blocks stay bound to one screen, and they are the screen titles

~~`home-header`, `discover-header`, `mediathek-header` and `participate-header` each print
the name of the screen they sit on. "Mediathek" at the top of Home is a heading that lies
about where the reader is, and that is not an arrangement the editor should be able to
save. `home-header` is the same argument from the other end: it is the app's answer to
"where am I", which ADR 0071 §4 makes the floor under every fallback.~~ Struck: one
`screen-header` block prints the title of whatever screen it is on, read out of that
screen's own document, so no word is baked into a block to lie about where the reader is
— [ADR 0075](0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md).
The argument is right about the four blocks as they were written and is left intact for
that reason.

~~They are declared in `SCREEN_BOUND_BLOCKS`, a table of four, and the parser refuses one
elsewhere with `section-module-not-on-screen` — the same code ADR 0071 §2 introduced,
kept because the fault it names is still exactly that. **A block absent from the table is
free.** The default takes no maintenance; the restriction is the thing that has to be
argued for, which is the opposite of the arrangement this record replaces.~~ Struck with
it: the table and the problem code go, and §1's "every screen may carry every block" is
left with no exception to maintain
— [ADR 0075](0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md).

~~**A generic per-screen title block was the alternative and is refused.** Its title would
have to be a setting, and a setting carrying a heading puts German prose into the layout
document — ADR 0057 §2 keeps the document to structure and never content, and ADR 0062
exists because a wording change is a different kind of submission from a layout change.
The four headers also differ in more than their word: Home's carries the date, the
greeting and the search, Mitmachen's an introduction under the title. One block with four
shapes and a prose setting is more mechanism than four declarations.~~ Struck, and this is
the paragraph that was wrong rather than overtaken: ADR 0057 §2's claim is about an
article, and "never content" is a wider rule than that record states. The four shapes are
four settings of one block
— [ADR 0075](0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md).

### 4. One registry draws every screen, and a block's data comes with it

This half was already true when the record was written and is stated because it is what
makes §1 real rather than only legal. Every screen is `ScreenBlocks` over one registry,
`HOME_MODULES`, and every block's data arrives through a hook that loads what it needs on
first use (`useLazyLoad` in `apps/mobile/src/lib/store/core.ts`). No screen primes a
slice for the blocks that happen to be written for it, so a block carries no screen with
it, and the podcast rail on Home fetches the library exactly as it does on the Mediathek.

Anything that breaks this — a provider mounted by one screen, a fetch kicked off by a
route — breaks §1 silently, and that is the thing to refuse in review rather than to
measure later.

## Why not the alternatives

**Widen the table instead of removing it.** Give every block `CONFIGURABLE_SCREENS` and
the rule still exists, still has to be written per block, and now says nothing at all. A
rule that is always satisfied is noise beside the ones that can fail (AGENTS.md says this
about documentation rules and it is the same argument).

**Keep the table and let the editor override it.** Two answers to one question, and the
first time they disagreed the newsroom would be told by a parse error that a block it had
just placed was not allowed where the palette had offered it.

~~**A generic title block.** Refused in §3, on ADR 0057 §2 rather than on taste.~~ Struck:
it is the decision now, and §3 is struck with it ([ADR 0075](0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md) §6).

**Categories as a list per block.** Refused in §2: a block in two tabs is a block whose
tab a person has to guess.

## What it costs

**A palette of thirty-two specimens on every screen.** That is the cost the category is
paid to cover and it only half covers it today: the palette groups under headings and
shows everything. A tabbed picker and a compact panel are the follow-up, and they read
`blocksByCategory` rather than inventing a grouping, which is why the grouping is in the
core and not in the dialog.

**An arrangement nobody wants is now expressible.** Five profile cards on the Mediathek
parses, renders and ships. ADR 0046 §4 already decided that the editor remarks on nothing
and that the frame is what stands in for a rule — an arrangement is on screen at the size
it ships the moment it is placed. This record leans on that decision harder than ADR 0046
had to, because the set of things it applies to just got five times bigger.

**A block written for one screen now has to be readable on five.** Nothing enforces that a
block looks right in a context it was not drawn for: `faktencheck-rail` and `tip-card`
already branch on `screen`, and the next block that needs to will have to notice. The
parser cannot help, and the honest answer is that the frame is the check.

## What this retires

**ADR 0071 §2, the sentence that the parser refuses a block on a screen it does not
declare.** Struck there. ~~The mechanism survives for the four blocks of §3 above and the
problem code is unchanged;~~ (the mechanism and `section-module-not-on-screen` are gone too,
with §3 — [ADR 0075](0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md) §6)
what is gone is the table it read.

**ADR 0054 §2, "A block names the screens it may appear on, and it may name more than
one".** Struck there. Its §1 (the declaration belongs to the block and not to the
component), §3 (structure in the app, words in the workbench) and §4 (what ships is decided
by the import) are untouched, and §2's file still exists — it declares the category now.

**ADR 0054 §5's second half and ADR 0054 "What it costs", second paragraph.** Not struck.
§5 said writing the field was cheap and reversible and that the first block declaring two
screens is where the decision would be measured; the measurement happened and this record
is the reversal it allowed for. Leaving both standing is the point: they are the part of
that record that was right.

Nothing in ADR 0046, ADR 0045, ADR 0057 or ADR 0072 is struck. ADR 0046 §4 is leaned on in
"What it costs" above, and ADR 0072 §5 is the gate §1 keeps.
