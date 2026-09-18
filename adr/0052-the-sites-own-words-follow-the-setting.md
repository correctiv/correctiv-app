# ADR 0052 — The site's own words follow the setting, the repository's are printed as they are written

Status: accepted, 2026-09-18. **§3 built in [#229](https://github.com/correctiv/correctiv-app/pull/229)**, §1, §2 and §4 in [#230](https://github.com/correctiv/correctiv-app/pull/230) — which migrates the FIRST area, `/components` and a component's own page, and lands the check with the rest of the site still in its ratchet. §1 is finished when that table is empty.

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
- [AGENTS.md](../AGENTS.md)'s sentence naming the same line, which now states this
  one.
