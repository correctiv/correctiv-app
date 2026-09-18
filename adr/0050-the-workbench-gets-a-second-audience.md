# ADR 0050 — The workbench gets a second audience, and the scope of its German follows from that

Status: accepted, 2026-09-18. **§1 to §4 built in [#220](https://github.com/correctiv/correctiv-app/pull/220)**, for the frame's controls and the day's track; the module labels in `preview/home/document.ts` are named in §5 and are not. §4's closing sentence, that the framed app's language belongs in the address beside `t=`, has since been built in [#226](https://github.com/correctiv/correctiv-app/pull/226): the preview carries `lg=`. §4's default is struck: [ADR 0051](0051-the-workbench-starts-in-the-browsers-language.md) makes an untouched browser get the language it asks for. §2's line is struck: [ADR 0052](0052-the-sites-own-words-follow-the-setting.md) draws it between this site's own words and the repository's.

## Context

[AGENTS.md](../AGENTS.md) says English for everything a developer reads, and the
workbench is a developer tool. That was the whole of it while the only people opening
it were the people writing it.

It has stopped being the whole of it, and the records say so before this one does.
[ADR 0036](0036-the-home-screen-becomes-data.md) §1 is titled "The configurator is
built for us, and the document is designed for the newsroom", and its argument is that
the *document* carries no field meaning "the person editing this knows the codebase",
so "handing it over is a step and not a rebuild". ADR 0036 §15 adds that the pull-request route
is the answer "while the configurator is ours. It is not the answer for the newsroom,
and that is the open question." [ADR 0041](0041-a-change-may-name-an-audience.md) then
has the newsroom writing audiences into the day.

So a tool designed for the newsroom to own is in English, and the two questions that
would settle ownership — who signs in, where the configuration lives — are open and
not cheap. A German interface is the step that can be taken without answering either.

## Decision

### 1. The workbench has a second audience, and it is named

Somebody from the newsroom, arranging the home screen. Not a translator, not a
reader of the documentation, not a developer who prefers German. That one audience is
what the rest of this record is measured against.

**Naming it is what keeps the scope from growing.** "The workbench should be German"
has no end; "what the newsroom uses should be German" has one, and the answer changes
by itself as the tool grows rather than needing a list maintained by hand.

### 2. The shell and the tools follow the setting, a published page's body does not

**The shell** is everything that frames a view: the header, the two rails, the panel,
the settings dialog, the search palette, the status line, the error boundary, the
browser tab. **The tools** are the preview and the home configurator. Both follow the
setting.

~~**A publishing page's body** does not: the landing page's prose, the handbook, the
records, the reference, the drawings and their captions, the sources board.~~
[ADR 0052](0052-the-sites-own-words-follow-the-setting.md) draws the line between
what this site WROTE and what it prints from the repository instead, because this
one names a place and means an author: `Components` is this site's heading and the
sentence under each card is a JSDoc comment out of the app, and they sit a
centimetre apart on the same page.

**Two earlier drafts of this line failed, and how they failed is the argument for
this one.** The first drew it by area — the configurator and the frame's controls in,
the documentation areas out — and a cold review found the panel tab *over* the
configurator still reading "Home layout", and the settings dialog somebody has to open
in order to choose German entirely in English. Both are the shell around something in
scope, and an area line puts them on the wrong side of it while reading as though it
had covered them.

The second tried "chrome against content", which fixes that and then takes the landing
page's prose with it, because that prose is not content this site republishes — it is
the site's own writing about the repository, for the same reader as a record. A rule
that cannot be finished is a rule that ends up overstated again.

~~Shell-and-tools against a page's body is the line that holds both: it puts the
settings dialog in, the landing page out, and it can be finished.~~ It could not:
[ADR 0052](0052-the-sites-own-words-follow-the-setting.md) measured a page whose
filter, in the shell's own context bar, was still English, and named the reason a
position line runs out — the two kinds of text are on the same page.

**Content stays English because of who reads it, not because it matters less.** A
record is an argument with the next developer, in the language the code is written in,
and translating one would create a second copy of an argument that is already hard
enough to keep true once. That is [AGENTS.md](../AGENTS.md)'s rule holding exactly
where it always held.

The visible cost is a mixed page: German chrome around an English document. That is a
seam and it is on purpose.

### 3. Two catalogues, one per audience, and neither reaches into the other

`apps/workbench/src/i18n/catalogue/` is this site's, separate from
`packages/catalogue`, the package the app reads. The app may
never depend on the workbench ([ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md)),
so a shared package holding both would put this site's words in the app's dependency
graph for nothing. What is shared is the *shape*: `defineMessages`, an English
`defaultMessage`, German as data, one file per id namespace, extraction into a
generated `en.json`.

They meet in one place and it is the right one. The preview and the component pages
draw the app's own components through `AppEnvironment`, which mounts the app's
`IntlProvider` **inside** this site's. A borrowed component keeps the app's words; the
chrome around it keeps this site's. Nesting is the mechanism and it needs no
arrangement.

`react-intl` rather than something smaller: the app already has it, the messages are
already ICU, and the extraction, the verification and the pseudo-locale come with the
CLI. A second idiom for one job in one repository costs more than the runtime does —
and on this side the runtime costs nothing worth naming, because a browser has the
whole of `Intl` and the bundle already carries the reference model.

### 4. The setting is the reader's, so it lives where the appearance does

`workbench:language` in `localStorage`, ~~default English expressed by the key's
absence~~, written only from the setter — which is issue #131's rule kept rather than
rediscovered, because the default being an absence is exactly the shape that let one
document delete another's choice. The absence is still how the default is expressed;
what it means is now "follow the browser", which
[ADR 0051](0051-the-workbench-starts-in-the-browsers-language.md) decided, on the
grounds that this record solved the wrong half of the problem it had noticed — it
made the way out findable rather than not sending a German reader down an English
corridor.

**Not in the address**, and that is the same split this site already makes.
`theme.ts`'s `Appearance` is the workbench's own and lives in storage; `PreviewState.theme`
is the *app's* and lives in the address, because one is a fact about the reader and the
other a fact about what is on screen. The language of this interface is the first kind.
The language of the app inside the frame is the second, and belongs in the address
beside `t=` when it arrives.

The picker names each language in itself — `English`, `Deutsch` — and those two labels
are the one pair here that must not be translated, because a German reader offered
"Englisch" has been answered in the language they are trying to leave.

### 5. `document.ts`'s module labels are a decision this record does not make

The names and descriptions of the home screen's blocks — "Lead article", "The newest
investigation, full width" — are the most editor-facing prose in the tool, and ~~they are
the one part not moved here~~ they were the last part moved, on 2026-09-18 by
[ADR 0052](0052-the-sites-own-words-follow-the-setting.md) §7. `moduleLabel()` is read by `blockName()`, which is a plain
function in a module with no React and ~~no formatter~~ a formatter handed in as its
first argument since that record, and its result is interpolated into accessible
names. Localising it means either handing `intl` down into that module
or making `blockName` return a descriptor and values for its callers to format.

That is a design decision about the module, not a substitution, and doing it in the
same change as the machinery would bury it. Named here so that the gap is a decision
somebody deferred rather than a thing that was missed.

## What this retires

- [AGENTS.md](../AGENTS.md)'s "English for everything a developer reads" is unchanged
  and this record does not touch it. What changes is that not everything in
  `apps/workbench` is read by a developer, which the file now says in one sentence
  beside the rule.
