# ADR 0052 — The site's own words follow the setting, the repository's are printed as they are written

Status: accepted, 2026-09-18. **§3 built in [#229](https://github.com/correctiv/correctiv-app/pull/229)**, §1, §2 and §4 in [#230](https://github.com/correctiv/correctiv-app/pull/230) — which migrates the FIRST area, `/components` and a component's own page, and lands the check with the rest of the site still in its ratchet. §1 is finished when that table is empty. **§5 was added on 2026-09-18**, after the first four had landed: migrating `/handbook` found a hand-written file that §1 takes and the extraction cannot reach. **§6 was added the same day**, when the drawings were the last area left and three of the six were decided to keep their labels in English. **§7 was added on 2026-09-18** as well, taking the home configurator's block labels, which [ADR 0050](0050-the-workbench-gets-a-second-audience.md) §5 had deferred.

## Context

[ADR 0050](0050-the-workbench-gets-a-second-audience.md) §2 drew the line at **the
shell and the tools against a published page's body**. It arrived at that after two
drafts failed, and the argument for it is good: an area line left the settings
dialog in English, and a chrome line could not be finished.

It has the same shape of failure one step further out, and a single screenshot shows
it. `screens/evidence/230-komponenten-vorher.webp` is that shot, taken on
2026-09-18 from `main` before this record, in a browser asking for German, with the
settings dialog open so that all four of the readings below are in one frame. A
first version of it was cropped and showed only three, which a cold review caught;
TROUBLESHOOTING.md's rule is that a screenshot is evidence only about the part of
the screen it shows. Named as a path and not linked, which is what every other
record here does: this file is also rendered on the website, where a relative link
out of `adr/` resolves against the page's own address and reaches nothing.

With the site set to German, `/components` reads:

- the header, the rails, the status line and the settings dialog: German
- the filter above the page, its placeholder and its summary: **English**
- the heading `Components` and the paragraph under it: **English**
- `All` / `Drawn here`, `Nothing matches that.`, `Also exported here`, `1 prop`: **English**

The filter is in the shell's context bar, so the first of those is a gap in §2's own
line rather than a consequence of it. The others are §2 working as written. Neither
reads as a decision on the page; both read as a half-finished translation.

**The reason §2 cannot be finished is that it names a place and means an author.**
"A published page's body" is a position on the screen. What actually divides these
strings is who wrote them: `Components` is this site's own heading, and the sentence
under each card is a JSDoc comment out of `apps/mobile/src/components`, which
[AGENTS.md](../AGENTS.md) keeps in English because a developer reads it. Those two
are on the same page, a centimetre apart, and no line drawn by position can separate
them.

§2's closing paragraph already says the honest version of this: "Content stays
English because of who reads it, not because it matters less." That is an author
line wearing a position line's clothes.

## Decision

### 1. The line is the site's own words against the repository's

**What this site writes, it translates.** Everything a person reads that is written
in `apps/workbench/src`: the shell and the tools as before, and now also every
heading, lede, section title, empty state, badge, legend, caption, filter label and
accessible name on every page, and the titles and captions of the drawings in
`src/diagrams/`.

**What this site prints from the repository, it prints as it is written.** Text this
site did not author and reads in at build time: the Markdown and the records' own
titles, notes and clauses under `virtual:docs`, the TypeDoc and JSDoc under
`virtual:api`, the app's wordings under `virtual:strings`, and the specimen labels
it borrows from the app's gallery through `components/direct.tsx`. Those are English because AGENTS.md keeps the repository English, which is
the same rule ADR 0050 §2 was reaching for.

**A mixed page is still the answer, and now it is a legible one.** `/handbook` is a
German page listing English documents; `/decisions` is a German board of English
records. The seam is between what the site says and what it quotes, which is a seam
a reader can see the sense of. German chrome around an English heading was not.

### 2. One check holds it, and it is the one the app already has

`apps/workbench/test/rendered-literals.test.ts`, the same AST walk
`apps/mobile/__tests__/rendered-literals.test.ts` uses: a literal in a JSX text
child, or handed to a prop a person reads, that is not inside a descriptor call.

**Language-blind, which is what makes it finishable.** It never asks what language a
string is in — it asks whether the string reaches a person and whether it is a
message. A rule stated as "translate the site's own words" has no test; a rule
stated as "no literal a person reads" has this one, and the two are the same rule
seen from opposite sides.

**A per-file ratchet, asserted in both directions**, so the line arrives with its
own todo list and the list can only shrink. The alternative was to migrate
everything in one change and turn the check on at the end, which is one review
nobody can do.

### 3. The mechanism is shared, the argument is not

The walk moves into [`packages/prose-and-code`](../packages/prose-and-code/README.md)
and both checks call it. What stays in each test file is that check's own argument:
which props a person reads in that package, which calls are descriptors there, what
is excluded and why, and how the debt is excused. The app names every one of its
eighteen literals with a reason; this site counts over a thousand by file, and its
own docblock argues that choice by size. Two arguments, one mechanism, which is the
split working. That is the split the
package's README already states, applied to the first mechanism with two callers.

### 4. `content/` is a record and is printed as written

`apps/workbench/content/sources.manifest.ts` is hand-written in this package, so §1
would take it. It does not, and the reason is what is in it: endpoints, file paths
and a note per row saying what was measured against each. It is this site's ledger
of what the app reads, kept beside `sources.measured.ts`, which a weekly job
rewrites. A ledger is quoted, not narrated.

**The open editorial questions on that board are the case against**, and they are
named here rather than tidied away: they are questions for the newsroom, which is
exactly the audience ADR 0050 §1 names, and they are the one thing in that file a
German reader would act on.

Two things keep them English for now, and only the second is strong.
`sources.manifest.ts` says in its own header that `SOURCES.md` "stays the document
of record: it carries the argument, the editorial questions and the figures", so
the questions are a repository document's before they are this site's, and the new
line leaves the repository's text alone. That is the strong one. The weaker one is
practical: each question is raised by a row and answered by editing the manifest
beside it, so translating the question alone would put German above the English row
it belongs to.

Translating the rows is a bigger decision than this record makes, and it wants the
measurement of who actually reads that board.

**Two clauses added on 2026-09-18, when the first page that prints this file was
migrated.**

The fence is around the file's WORDS and not around the file. `feedFigures()` in it
returned `posts.toLocaleString('en-GB')`, a locale pinned in a ledger, which is not
a word the ledger wrote: it is the page's job done in the wrong place, and it put a
German reader's `2.956` and an English `2,956` in one column. The function hands out
the finding now and `pages/Sources.tsx` words it. A measurement belongs to the
ledger; how it reads belongs to the page.

And the second of the two arguments above is thinner than it was. "German above the
English row it belongs to" described an oddity on a page that was otherwise English.
That board's heading, lede, filters, column heads, state names and every sentence
around the questions are German now, so the mixing it warns of is the page's normal
and decided state. The first argument is the one still carrying §4: `SOURCES.md` is
the document of record for those questions, and the repository's documents stay in
their own language. Whoever revisits this should know that one leg is load-bearing
and the other is not.

### 5. `plugin/registry.ts` is in scope by §1 and out of reach of the extraction

Added on 2026-09-18, after the first four sections had landed, because migrating
`/handbook` found it.

`nav` and `blurb` in `apps/workbench/plugin/registry.ts` are hand-written in this
package: a document's name for the navigation and a one-line description of it.
By §1's own test those are this site's words and follow the setting. They do not,
and the reason is mechanical rather than argued: `apps/workbench/package.json`'s
`i18n:extract` walks `src/**`, `plugin/` is not in it, and a descriptor written
there extracts to nothing. Widening the glob would pull the whole build-time
plugin into the extraction, and moving the strings into `src/` is a refactor of
where a document is declared.

**So this is a gap in the record's reach and is named as one.** Until it closes,
a document has ONE name — the registry's — and `/handbook`'s cards print it
rather than carrying a second. A card that translated the name gave every
document two, and on the German page the card read „Architektur“ where the
breadcrumb of the page it opened read "Architecture", one click apart;
`ui/ActivityBar.tsx`'s `sectionOf()` argues exactly that failure and calls it a
thing that reads as a bug.

`test/rendered-literals.test.ts` cannot see this either, for the same reason it
cannot see a reason written in `components/direct-ids.ts`: it walks `src/` and
reads JSX children and visible props, and `nav: 'Architecture'` is a property in
a data table outside it. Stated here and in both files, rather than enforced.

### 6. Three of the six drawings keep their labels in English

Decided on 2026-09-18, when the drawings were the last area left.

**What did follow the setting**: the title and the lede of all six, so `/diagrams`
is a German page of German cards, and each drawing's own page has a German
breadcrumb, heading and paragraph. Three of the six are translated through and
through: the core and its host, the app and what it talks to, and the inside of
the core.

**What stays English** is the labels inside `ArticlePath.tsx`, `SignIn.tsx` and
`DecisionsChain.tsx`, and the geometry in `layout.ts`. Two reasons, and the second
is the one that decides it.

**A check reads those labels.** `test/drawn.ts`'s `drawnText` pulls a drawing's
text out of its own source and holds it to the code: `diagrams-article-path.test.ts`
and `diagrams-sign-in.test.ts` assert "15 articles", "1500 ms", "under 4
characters", the four `SessionStatus` values and the `ContentBundle` method list
that way, so a figure in a picture cannot quietly stop being true. A label that
becomes a descriptor leaves `drawnText` and takes its check with it. That is
repairable — the three that were translated proved it, and `diagrams.test.ts` now
holds their German figures too — but it moves where a check gets its truth, and
that is a price worth paying only for something somebody reads.

**And these three are read by whoever is reading the code.** They draw a load
cascade's five rungs, a sign-in's four session states and the graph of which
record struck which claim, in module names, file paths and millisecond budgets.
The audience ADR 0050 §1 names is somebody arranging the home screen, and nothing
on these three pictures is addressed to them.

**What would change this**: somebody outside development reading a drawing. The
work is then the check first and the translation second, in that order, and
`test/rendered-literals.test.ts`'s table says so where the three files are listed
— as a decision, not as a backlog.

### 7. The home configurator's blocks say what they are in German, and the module takes a formatter

Decided on 2026-09-18, by looking at the palette on a phone frame. ADR 0050 §5
deferred exactly this and named the design decision it needed; this is that decision.

**The words are the point.** ADR 0050 §1 names one audience outside development,
somebody from the newsroom arranging the home screen, and `MODULE_LABELS` is the
table they arrange it with: eleven block names and the sentence under each, plus
three settings. Nothing else on this site is addressed so directly at the person
that record was written for, and it was the last English thing left in front of them.

**The module takes an `IntlShape`, it does not return one.** §5 of ADR 0050 named two
ways out and this takes the first: `blockName()` and `whereAt()` take a formatter as
their first argument.

The other way, returning a descriptor and values for the caller to format, was
rejected on what `whereAt` does: it composes two `blockName`s inside one sentence, so
a caller would be handed a tree to assemble rather than a string. There are two call
sites today and that is not the argument — one would be enough. A formatter passed
down is one argument; a tree of descriptors is a second implementation of
`formatMessage` in whoever renders it.

**The labels are declared with `wbMessage`, and that half is a preference.** It is
the identity function `shell/views.ts` and `nav.ts` already use, and the reason is
`nav.ts`'s rather than a stronger one: this is a table, and two things load it
outside a browser — the dev server's save endpoint, through `ssrLoadModule`, and the
tests. Neither has a use for React.

A draft of this section claimed more: that the dev server imports `document.ts` into
Vite's own config, so `react-intl` would throw while the site starts. That is false
and was measured false on 2026-09-18 — a `defineMessages` import in `document.ts`
left the save endpoint answering 200 unchanged. `plugin/home-layout.ts` reaches the
module through `ssrLoadModule` at request time and statically imports only
`preview/home/names.ts`, which exists to be a leaf the config can hold; the thing
Vite's config genuinely cannot take is the JSON import under the core's layout
module, which is that plugin's own measurement and not this one. The decision stands
on the weaker reason, which is the true one.

**The field that was `name` is called `label`.** That is not tidying, it is the
repair. `test/rendered-literals.test.ts` reads a list of prop and key names that
carry something a person reads, and `label` has always been on it while `name` never
was, because every `name=` on this site is a radio group's. The table used `name` and
`what`, so eleven blocks and three settings of prose sat in English and no check said
a word. `what` is on that list now, `name` is not, and the `name:` keys in the two
files that still hold them are argued where they sit.

**Nobody had missed these strings, and that is the part worth writing down.** ADR
0050 §5 is a numbered decision about exactly them, quoting two of them; `Palette.tsx`
and `de/home.ts` each carried a comment naming `{name}` and `{what}` as the English
fragments a German sentence was reading around. The deferral was on the record and
the record was read. What was missing was a check under it, and six passes of
translating this site went past because a deferral nothing can fail is a deferral
that survives on somebody remembering. It was found by looking at the screen.

**What this cost the check that was already there.** `test/preview/home-document.test.ts`
asks whether a label merely repeats the module id and whether the sentence under it
says anything; it reads the `defaultMessage` now, which is where those words are
written. `test/preview/palette.test.ts` builds an `intl` at the source language,
because the sentence it asserts is an English one and the German for it is
`test/i18n.test.ts`'s to hold.

## What this retires

- [ADR 0050](0050-the-workbench-gets-a-second-audience.md) §2's line, "the shell and
  the tools follow the setting, a published page's body does not", and its list of
  what stays English — "the landing page's prose, the handbook, the records, the
  reference, the drawings and their captions, the sources board". The handbook, the
  records and the reference keep English *bodies*, but because the repository wrote
  them and not because of where they sit; the landing prose, the drawings' captions
  and the sources board's own prose were this site's own words and now follow the
  setting. Everything §2 says about **why** content is English, and both accounts of
  the drafts that failed, stands and is what this record is built on.
- [ADR 0050](0050-the-workbench-gets-a-second-audience.md) §5's "they are the one part
  not moved here", about `document.ts`'s module labels. Decision 7 of this record moves
  them. The two ways out that section named are both still the two ways out, and what
  it picks between them on is an argument §5 did not have.
- [AGENTS.md](../AGENTS.md)'s sentence naming the same line, which now states this
  one.
