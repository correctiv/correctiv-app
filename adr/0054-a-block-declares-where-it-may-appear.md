# ADR 0054 — A block declares where it may appear, and the words stay with the tool

Status: accepted in shape, 2026-09-18, from the review of
[ADR 0048](0048-the-gallery-points-at-the-editor-rather-than-copying-it.md), which
proposed a mechanism rather than disputing the outcome. ~~Nothing here is built, and the
last decision below says which part is worth writing before a second configurable screen
exists and which part is waiting for one.~~ The second decision below, and the half of the
last one that says to write the field now, are built in
[#237](https://github.com/correctiv/correctiv-app/pull/237) the day after. What waits for
a second configurable screen is the rest.

The number is 0054 and not 0053 because 0053 was being written in the same working tree at
the same time, where `npm run adr:new` cannot see it: the script reads `origin/main` and
the open pull requests, and an uncommitted file is neither. The gap closes when that record
lands.

## Context

The review of ADR 0048 accepted that the home screen's blocks stay out of the component
gallery and asked the better question underneath it: **where does a block say what it is,
and who may read that?** The suggestion was a file beside each component, skipped by the
production build, naming which screens the component may be used on, with more than one
screen possible.

Half of that shape is already here, which is the useful part of the answer.
`apps/mobile/src/lib/home/settings.ts` is a declaration file beside the modules that holds
no React and imports only types, because `apps/mobile/scripts/generate-home-settings.mjs`
reads it by importing it under Node's own type stripping and writes
`packages/app-core/src/lib/home-settings.generated.ts` from it. ADR 0045 §9 put it there so
that a module and its settings are one thing to write and one thing to read, and the
generator is what crosses into the core without reversing the dependency.

So a block's information already lives in three places, and each of them has a reason:

| What | Where | Who reads it |
|---|---|---|
| How the block draws | `apps/mobile/src/lib/home/modules.tsx` | the app, and the editor through the same import |
| Which settings it understands, and each one's default | `apps/mobile/src/lib/home/settings.ts` | the app at runtime, and the core through the generator |
| What it is called and what it does, for the newsroom | `apps/workbench/src/preview/home/document.ts` | the workbench alone |

What is missing is not a place. It is a field: nothing anywhere says which screen a block
belongs to, because the answer is spelled in the name of the constant that holds them,
`HOME_MODULES`, and a name stops being an answer the moment there is a second screen.

## Decision

### 1. The declaration belongs to the block, not to the component

A block is a composition, so a file beside a component would be a declaration about the
wrong thing. `latest-research` is a section header, a hairline between each pair and a row
per item, over a feed and a count; `feed-status` draws no component at all, only a spinner
and a line of text; `article-hero` is the hero component plus the rule that picks what goes
in it. Only a couple of them are one component wearing a wrapper.

The direction that looks harmless is the one to refuse: a field on `FaktencheckRail` saying
it may be used on the home screen would promise something that component cannot keep on its
own. What the home screen wants is the rail **and** the heading **and** the link to
Entdecken **and** the count, which is the module. ADR 0048 §1 stands, and this record is
what it was missing rather than an argument against it.

### 2. A block names the screens it may appear on, and it may name more than one

One field on the declaration beside the module, a list rather than a single value. Today
every entry reads `['home']` and there is nothing else to write, and that is the point of
writing it: the answer stops being implied by the name of a constant and becomes something
a reader can be held to.

A list rather than a value because the obvious second case is a block that belongs on two
screens. The fact-check rail is the same composition on Entdecken as on the home screen,
and a newsroom arranging either one should meet it in both palettes. Two declarations for
one block would then be two things to keep in step, which is what ADR 0045 §9 spent its
argument avoiding.

### 3. The structure stays in the app, the words stay in the workbench

Ids, settings, defaults and the list of screens are the app's own vocabulary, and the core
has to know them to refuse a document that names something no block understands. They stay
in `apps/mobile/src/lib/home/` and travel into the core the way the settings already do.

The label and the sentence under it stay in the workbench. They exist for the one audience
outside development that ADR 0050 §1 names, the app never renders them, and moving them
into the app would put the site's German in the one place that may not depend on the site
([ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md)). A block's name in the
editor is the tool's word for it, not the app's, and it is already read in more than one
place there: the palette offers a block by that name and the arranged list prints it over
each row.

This is the line worth writing down, because it is the one that a later change will blur:
**the app declares what a thing is, the workbench says what it is called.**

### 4. What stays out of the app's bundle is decided by the import, not by the bundler

The suggestion assumed the production build could skip the declaration. It cannot be
assumed here: the app bundles with Metro and `apps/mobile/metro.config.js` turns on no dead
code elimination. The one measurement this repository holds of a bundler dropping anything
points the other way. `apps/mobile/src/lib/theme/font-assets.ts` records what a barrel of
font cuts cost, because a `require()` of a file is a side effect no tree shaker drops, and
the answer there was to keep the module out of the barrel rather than to expect the build
to notice. Anything the app imports should be taken as shipping.

That is not a problem, because the mechanism is the import and it is already in place.
Defaults are imported and therefore ship, which is right, since the app reads them when
nobody has chosen. Anything only the editor needs belongs in a file the app does not
import, read by the generator at build time and by the workbench directly. What this
decision forbids is planning for a bundler feature that is not switched on.

### 5. The field is written before the second screen, and the screen is not

The palette in the editor lists what `HOME_MODULES` holds. Give it the field and it lists
what declares the screen being edited, which is one small change with a reader on the day
it lands, and it is the whole of what "think of it now" can honestly buy.

Everything else waits, because a second configurable screen is not a field. It is a second
document beside `data/home.layout.json`, a screen that loops over it instead of naming its
sections in source, a tool in the editor that edits it, and a parser that refuses a block
on a screen it does not declare. Writing the field now is cheap and reversible. Writing the
parser's half of it now would be inventing what a screen is before anybody has drawn the
second one.

## Why not the alternatives

**A `.meta.ts` beside each component, as proposed.** Refused for §1's reason and nothing
else: the file's shape is right, its neighbour is wrong. A reader of that file would also
have to be told that most components have no such file and that a few of them are half of a
block, which is a rule about compositions written in the folder layout of components.

**Let the gallery read the field and draw the blocks after all.** This is the same surface
ADR 0048 §2 refused, reached from a new direction. The objection there was not discovery,
it was that a control in the gallery reaches no document, and the field changes nothing
about that.

**Put the label in the app beside the block, so that everything about a block is in one
file.** Tempting and it is the one real cost of §3: a block's name and a block's settings
are read together and written apart. It is refused because the app would then carry strings
only the workbench renders, in a language the app does not otherwise ship for that
audience, and because `test/preview/home-document.test.ts` already holds the two halves
together in both directions.

**Register the screens at runtime instead of declaring them.** Refused for the reason
ADR 0045 §9 gives about settings: refusing means knowing, and a table that only exists once
something has booted cannot answer in a check.

## What it costs

**A block's information is spread over three files and this record adds a field to one of
them.** Somebody meeting the home screen for the first time reads the renderer, the
declaration and the workbench's table before they have the whole of one block. The
alternative is one file that crosses a boundary this repository spent ADR 0040 and
ADR 0045 §9 drawing.

**The field will be right for one screen and unproven for two.** Nothing about `['home']`
on every block tests the idea that a second screen wants the same shape. The first block
that declares two screens is where this decision is actually measured, and it should be
read as unmeasured until then.

## What this retires

~~Nothing is struck.~~ One claim is, and this section said otherwise until the second
decision above was carried out, one change later.

[ADR 0046](0046-what-the-editor-may-add-and-what-a-block-is-called.md), **one claim in §1
struck**.

- **ADR 0046 §1's second protection, that the palette is built from the registry itself
  so there is no second list to forget.** There is one now, and the second decision above
  is what made it. What that sentence was really protecting — a module written and
  reachable by nobody — is held instead by a pair of assertions that fail in both
  directions, a module with no declaration and a declaration for no module. It is a weaker
  rung than the one it replaces, which is the trade and is written down where the
  declaration lives.

  **This record did not see the retirement when it was written**, which is the honest
  account and the argument for building a decision rather than only recording one.

Two claims are read and deliberately left standing:

- **ADR 0048 §1, that the modules stay out of the gallery and out of `src/components`.**
  Untouched. This record answers the question the review raised underneath it and reaches
  the same place by a different route.
- **ADR 0045 §9, that a module declares its settings beside itself.** This record is that
  decision with one more field, and leans on it entirely.

## What is still open

**What a second configurable screen actually is.** §5 names the four parts and decides
none of them. The first one to answer is whether a screen's document is a second file of
the same shape or one file with a screen per key.

**Whether one block on two screens wants the same settings on both.** A fact-check rail on
Entdecken might want a different count from the one on the home screen, and the settings
declaration has no room for that today. It is a real question and it arrives with the
second screen rather than before it.

**The article's own blocks are a different question.**
[#200](https://github.com/correctiv/correctiv-app/issues/200) leaves open how the blocks
that build an article on correctiv.org reach the app. Those are content inside a document
the app renders in a WebView (ADR 0017), not compositions of a screen, and the two should
not be answered by one mechanism because they share a word.
