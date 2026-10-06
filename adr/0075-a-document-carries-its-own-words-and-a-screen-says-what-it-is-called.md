# ADR 0075 — A document carries its own words, and a screen says what it is called

Status: accepted, 2026-10-02, decided by the product side. Built in part, 2026-10-06: §1 to §6 in #328, #330, #333 and
#336; §7 is not built, there is no `/s/<id>` route and no custom screen yet. It supersedes
[ADR 0073](0073-every-screen-takes-every-block-and-a-block-declares-its-category.md) §3
whole, the clause of
[ADR 0071](0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md) §4 that has the
app declare a destination's label and icon, and the reading of
[ADR 0057](0057-the-structure-comes-from-the-workbench-the-selection-from-wordpress.md) §2
that ADR 0073 §3 wrote down. It is written before any of it is built, because the parts it
decides are the parts every screen the newsroom makes from here on will need at once.

## Context

The workbench is becoming an app builder: not a generic one for arbitrary apps, which is a
question for after the release, but one aimed at this app's own needs. Five screens are
documents (ADR 0071 §1), every screen takes every block (ADR 0073 §1), and the tab bar is a
document of its own (ADR 0071 §4). What the newsroom still cannot do without a developer is
anything that involves a **word**: name a screen, write the sentence under its heading, make
a screen that did not exist when the release was built.

Three decisions stand in the way, and all three were right when they were taken.

- **ADR 0054 §3**: the app declares what a thing is, the workbench says what it is called.
  Written about the editor's own vocabulary, a block's name and a category's heading.
- **ADR 0073 §3**: four blocks print the name of the screen they sit on and are therefore
  bound to it, and a generic title block is refused because its title would be a setting,
  and a setting carrying a heading would put German prose into the layout document.
- **ADR 0057 §2**: the document holds structure and never holds an article.

ADR 0073 §3 is the load-bearing one, and it is worth quoting its own argument against
itself: "Its title would have to be a setting, and a setting carrying a heading puts German
prose into the layout document." That is an accurate description of what this record
decides to do. What makes it the right thing now and the wrong thing then is not taste; it
is that a screen the newsroom invents has no name anywhere else. An id the catalogue does
not carry cannot be added by a `[texte]` submission — ADR 0062 §2 refuses an unknown id on
purpose — so under the old arrangement a new screen needs a commit for its name and a
submission for its arrangement: two pull requests for one thing, one of them a developer's.

ADR 0057 §2 says less than ADR 0073 §3 read into it. Its claim is about **an article**: the
document does not carry the identity of a piece of content, and a place whose job is "the
leading investigation" says so rather than naming one. That is untouched here, and so is
the pin as its named exception (ADR 0071 §7).

## Decision

### 1. A document may carry words, and a word is a localised text

A setting may be of a new kind, `text`, and its value is not a string. It is an object
keyed by language:

```json
{ "de": "Mitmachen", "en": "Take part" }
```

The kind is declared beside the block it belongs to and travels into the core through the
generator the other four kinds already use (ADR 0045 §9), so `parseHomeLayout` knows which
keys are texts and refuses a text where a count belongs, as it does today.

What the parser holds a text to:

- **The keys are languages this build knows.** `de` and `en` today, which are the catalogue's
  two. Another key is refused the way any unknown key is, because a document that may carry
  arbitrary keys is a document that becomes a place to put things.
- **A bound per language, declared with the setting.** A title is a line and an introduction
  is a sentence or two; the number lives beside the declaration like a default does, and
  the parser refuses a longer one. Not a bound written here: the one figure that actually
  fails is the whole document's, which is the app's own 256 KiB (ADR 0061 §2).
- **No control characters**, with one exception a declaration may grant: a newline, in a
  text declared as more than one line. A lone carriage return, a direction mark and a
  zero-width character are refused everywhere. ADR 0062 measured that no wording in the
  catalogue holds one, and the writer there is the same newsroom; the difference is that a
  public issue can carry a document too (ADR 0061 §4), and the longest string in one is now
  prose rather than an id.
- **Plain text and never markup.** No Markdown, no HTML. The app draws a `Typo`; the one
  place HTML belongs here is the reader's document, which has a sanitiser and a record.

**Three kinds of word, and three owners.** This is the line to keep, because it is the one
ADR 0054 §3 drew with two owners and it now has three:

| Words | Owner | Where | How they change |
| --- | --- | --- | --- |
| What the app says about itself: a playback failure, a verdict, "Mehr" | the app | `packages/catalogue/src/de/` | a commit, or a `[texte]` submission (ADR 0062) |
| What a block is called in the editor, what a category's heading says | the workbench | `apps/workbench/src/i18n/catalogue/de/` | a commit |
| What a screen is called, and what it says about itself | the newsroom | the layout document | a `[layout]` submission (ADR 0061 §3) |

ADR 0054 §3 stands as written, for its own subject: the editor's vocabulary. The third row
is not a hole in it. A screen's heading is read by a **reader of the app** and not by an
editor, and it is the one word in the app the newsroom means to change without waiting for
a release. And the two submission kinds do not collide, which is ADR 0062's whole point kept
intact: `[texte]` may reword a string the repository already carries and may add none, and
nothing in this row is in the catalogue at all.

### 2. German is required, every other language is optional, and a gap is a mark and never a fault

`de` has to be there and has to hold something other than whitespace. A screen with no name
has nothing to fall back to, so that one is a parse fault.

Every other language is optional. The app resolves a text by asking for its locale and
falling back to `de` — never to the empty string and never to the setting's key, because
both of those reach a reader as a bug they cannot report precisely.

This is the arrangement ADR 0049 already chose for the catalogue, read one level down:
German is the only language that ships, and English exists so that the second language can
be **looked at rather than asserted**. Requiring `en` would make the newsroom write English
for every screen, which they do not do, and a required field somebody has to get past gets
filled with the German.

A missing translation is therefore marked where somebody can act on it: in the workbench,
on the screen that lacks it, and in the check that runs before a submission. It is a
warning there and not an error, for the reason above.

### 3. A screen document carries its own title, its tab label and its icon

Beside `version` and the sections, a screen's document holds three properties: `title`, a
localised text; `tabLabel`, an optional localised text; and `icon`, an optional key out of
§4's set.

**They are the screen's and not the navigation's**, because a screen that is not on the tab
bar still has a name: the "Mehr" list prints it, a link block names it, and a custom screen
(§7) is reached without a tab at all. Put the name in the navigation document and taking a
screen off the bar deletes its name.

**`tabLabel` defaults to `title`.** A tab has room for one short word and a heading may
want more. Today the two coincide for all four screens that have both, which
`apps/mobile/src/lib/tabTargets.ts` says in its own descriptions ("the same word as the
heading of the screen it opens"), so the field exists for the first time they do not and
defaults so that nobody types the word twice. ADR 0054 §5's lesson applies to it and is
named as open below.

**They are not settings of a block.** A screen's name is one fact about the screen. As a
setting it would have as many values as the screen has headers, and the "Mehr" list and a
link block have no header to read.

### 4. An icon is a key out of a set the app declares

The app declares the icons a screen may choose from: one key answering to the three native
names it already needs, an SF Symbol pair, a Material pair and an Ionicon pair — the shape
`TabTarget` has today. The document names the key and nothing else. The set travels into the
core through the same generator as the settings, so the parser knows the keys and the
workbench's picker reads one list rather than inventing a second.

**A fixed set, because every choice has to exist natively on both platforms.** A free string
renders on Android, is blank on iOS, and the newsroom finds out from a reader.

An icon this build does not know is the smallest possible loss (ADR 0039 §6): the key is
dropped with a problem reported, and the screen draws the fallback icon the app declares. It
does not refuse the document. An older app meeting a newer document is exactly the case ADR
0071 §6 was built for, and losing an icon is less than losing a way into the app.

### 5. The navigation document keeps placement and order, and the words come from the screens

`navigation.json` keeps its three keys: `version`, `tabs`, `maxTabs`. Which screens are on
the bar, in what order, and where "Mehr" begins. Nothing else.

**A screen's placement is one of three, and which one is the newsroom's.** On the bar; behind
"Mehr", which ADR 0071 §5 makes a threshold the document sets rather than a constant; or off
the bar entirely, where a link block, a deep link or "Mehr" itself reaches it and a tab does
not. Off the bar is not a fourth state a screen has to be marked for: a screen that the
document does not put on the bar is off it, and the name it keeps there is why §3 puts the
words in the screen's own document.

What moves is on the app's side of the seam, not the document's: `DESTINATIONS` in
`tabTargets.ts` stops declaring a label and an icon and keeps the route, the feature stays
`TAB_FEATURES` (ADR 0072), and the four `ui.tab*` ids leave the catalogue, Home's included.
`ui.tabMore` stays, because "Mehr" is the screen the app draws and the newsroom does not
arrange (ADR 0071 §5).

**The bar's words come from the same copy of the document its entries come from.** The
native tab components take their triggers before the navigator mounts, and changing them
remounts it and resets the state (measured 2026-10-01). So the bar is built once per start
out of one copy: the last good fetched document if there is one, the bundled files
otherwise. A fetch that lands later changes the next start and not this one, which is what
ADR 0071 §6 already says about the entries and now says about the words as well.

**The floor is the bundled document, and it is a stronger floor than a message.** A test
holds every bundled document to parse (ADR 0071 §2), so there is no state in which the bar
has entries and no words — whereas a message beside a document is two answers to one
question, and the day they disagreed the tab would say one thing and the heading another.

**The tool that edited the navigation becomes the tool that edits the screens.** "Screens"
rather than "Navigation": the list of screens, the bar as it will look, the order, and each
screen's properties, with a way across to the layout tool, which stays the content editor.
One question per tool, which is ADR 0038's rail.

### 6. One header block prints the screen's own words, and the four bound headers go

`screen-header`, one block, category `struktur`. It prints the **title of the screen it is
on**, read from that screen's document and not from a setting of its own, and it carries
four settings: `mark`, the wordmark in place of the title; `intro`, a text; `date`; and
`search`.

The default documents of the five screens reproduce today's four rows exactly. Byte-identical
rendering is the test, and it is a screenshot comparison against `screens/` and the web
export rather than a green check, because a green check proves nothing about how the app
looks (AGENTS.md). The rule under the mark row and the spacing above a place stay the
renderer's, not the document's (ADR 0036 §1).

**The binding goes because the word is no longer baked into the block.** ADR 0073 §3 bound
four blocks to four screens because `mediathek-header` printed the word "Mediathek": on Home
it was a heading that lied about where the reader was, and that was true of the block as
written. A header that prints the title of whatever screen it is on cannot lie. So
`SCREEN_BOUND_BLOCKS` and the `section-module-not-on-screen` code go with it, and ADR 0073
§1's "every configurable screen may carry every block" becomes true with no exception left
to maintain.

### 7. What a custom screen must satisfy, and why it is not a tab

The newsroom makes a screen — a topic page, a campaign — without a release. This record does
not build it; it decides the constraints the mechanism has to meet, because every one of
them is a property of the decisions above.

- **The id is a route segment.** Lower-case ASCII letters, digits and single hyphens
  between them, bounded, and not one of the ids the app declares. Stricter than the core's
  `id-unsafe` (ADR 0061 §2) asks of any other id, because this one becomes a path segment, a
  file name under `screens/`, a key in the joined document and the suffix of
  `workbench:layout:<screen>`.
- **One route file for all of them**, `/s/<id>`, so a new screen is a document and no code.
  `s` and not `screen`, because the segment appears in every deep link.
- **A custom screen is not a tab in this version.** The native tab components decide their
  triggers before the navigator mounts and each one needs a route file of its own (measured
  2026-10-01, ADR 0071 §5), so a tab the document invents has no file to be. It is reachable
  from "Mehr", from a link block that stores a screen id, and from a deep link.
- **What a release build does with a screen it cannot find**: `/s/<id>` for a screen the
  document does not carry is the app's `+not-found`, and an entry in "Mehr" or a link block
  naming one is left out — ADR 0039 §6's smallest possible loss, and the same shape as ADR
  0071 §6's rule for a tab naming an unknown screen. An older app reading a newer document
  already ignores a screen it was not asked for (`screenDocumentOf`).
- **No count of its own.** The bound is the joined document's, which is the app's own 256
  KiB. That is the figure that actually fails; a second number would be one more thing to
  keep in step, and the workbench warns before a document gets near the first one.

## Why not the alternatives

**The words stay in the catalogue and the document names an id.** What exists, and what ADR
0054 §3 points at. It fails on the day the newsroom makes a screen, for the reason in the
context: `[texte]` cannot add an id (ADR 0062 §2, on purpose), so the name needs a commit
and the arrangement needs a submission, and the thing the newsroom wanted to do alone takes
a developer after all.

**A plain string instead of a localised one.** Cheaper today, since German is the only
language that ships. It puts the whole cost on the day somebody adds a second language,
when every document ever written has to be found and reworded — and the documents are the
one part of this repository where a missing translation cannot be caught by a ratchet over
source, because they are data.

**`en` required.** Refused in §2: a required field somebody has to get past gets the German
typed into it, and then nothing distinguishes a translation from a placeholder.

**A free-text icon name.** Refused in §4. Its failure is a reader's blank tab rather than a
parse error, which is the wrong end to find out at.

**The title as a setting of the header block.** Refused in §3: a screen with two headers
would have two names, and the "Mehr" list has no header to read at all.

**Keep the four bound headers and add a generic fifth.** Two ways to put a heading on a
screen. The first time they disagreed the newsroom would be told by a parse error that the
block the palette had just offered is not allowed where they put it, which is the mistake
ADR 0073 refused in another shape ("Keep the table and let the editor override it").

**Markdown in a text.** A heading that may carry markup is a heading somebody can style,
and then script. The sanitiser exists for the reader's document and has a record; a title
does not need one.

## What it costs

**A document is now prose that anybody on the internet can write, landing in a file the app
imports.** The strings submission got here first (ADR 0062) and the answer is the same one
applied twice: the parser refuses what must not be in the file, and `plain` (ADR 0061 §7)
neutralises what reaches a pull request's body. What is new is that the longest string in a
document is prose rather than an id, so §7's security inputs are worth re-running against a
title and an introduction rather than against an edition's name.

**A second place a reader's word can come from.** Until now every word a reader saw was in
`packages/catalogue`, and one walk over the app could ask whether a string was a descriptor.
A heading out of a document passes no such check, and nothing proves that a document's `de`
is good German. The reviewer of a `[layout]` pull request is what stands there, and that is
the honest answer rather than a check somebody could write.

**The localisation seam does not reach it, and that is deliberate.**
`packages/app-core/test/localisation-seam.test.ts` already excludes `src/data/`, by its own
question: *would this string still exist if the content came from a CMS?* A screen's title
answers no. So an exclusion written for sample data now covers real prose, and whoever
narrows that walk later has to know it.

**Every screen's name lives in a document, so a document fault is a bar without a word.**
§5 answers it with the bundled floor, and the test that holds the bundled documents to parse
is now load-bearing in a way it was not: it was proving that a committed document draws, and
it is now also proving that the app can name its own tabs.

**A tab label stops being a translator's job.** The German in `ui.tab*` moves out of the
catalogue into five documents, `__tests__/tab-bar-labels.test.ts` stops reading messages, and
whoever adds a language has one more kind of file to go through.

## What this retires

**ADR 0073 §3, whole.** "Four blocks stay bound to one screen, and they are the screen
titles", its table of four, and the paragraph refusing a generic per-screen title block on
ADR 0057 §2. Struck there. Its argument is kept intact and is right about the block it
describes: a header with the word baked in cannot be moved. Decision 6 of this record
removes the word from the block rather than permitting the lie.

**ADR 0073, "Why not the alternatives", the entry "A generic title block".** Struck there;
it points at that record's §3, which decision 6 here replaces.

**ADR 0071 §4, the clause "The app declares what can be a destination, with its screen,
icon, label as a message and the feature it belongs to".** Struck there for the icon and the
label, which decision 3 here makes properties of the screen's own document. The rest of
ADR 0071 §4 stands:
the document chooses and orders, Home is always first and cannot be taken out, and the
feature a destination belongs to is still the app's (ADR 0072).

**ADR 0057 §2, read as "no prose in a layout document" — not struck, and this is why.** Its
claim is that the document does not carry the identity of a piece of content, and that is
still true: a place still says "the leading investigation" rather than naming one, and the
pin is still the named exception (ADR 0071 §7). The wider reading, that the document holds
no content of any kind, is not in that record's text; it was written in ADR 0073 §3, and it
is struck there. Nothing in ADR 0057 is rewritten, because nothing in it has become false.

**ADR 0054 §3 — not struck.** "The app declares what a thing is, the workbench says what it
is called" stands for its subject, the editor's vocabulary: a block's name, a category's
heading. §1's table above adds the third owner it did not have to consider, and names which
words belong to which.

**ADR 0062 — nothing struck.** A wording change and a layout change stay different kinds of
submission, and §1 says why they cannot collide: `[texte]` may reword only an id the
repository already carries, and a screen's words are in no catalogue.

**ADR 0049 §3 and §4 — nothing struck.** The locale is still named by the host. A document
carries languages; it does not choose one.

## What is still open

1. **Which languages a document may carry** beyond `de` and `en`. §1 ties the set to the
   catalogue's languages, which is one fact in one place; whether a document may ever carry
   a language the app does not ship is not decided.
2. **Time windows for a screen or a tab.** A moment for a whole screen rather than for a
   block. Named by the product side as undecided, and not touched here.
3. **The link block, what "Mehr" lists, and whether a custom screen may be a notification's
   target.** §7 decides the constraints; the record that builds custom screens decides these.
4. **Whether a screen's title and its tab label ever actually differ.** `tabLabel` is a field
   waiting for its first use, which is the position ADR 0054 §5 was in when it wrote the list
   of screens, and ADR 0073 is what happened next. If nothing uses it, it goes the same way.
   Checked 2026-10-06: it is built (`screen-layout.ts`, read by the tab bar) and no document
   under `data/layout/screens/` sets it, so every tab label is today its screen's title.
   Still undecided.
5. **Whether a missing translation should ever be an error** rather than the warning §2
   makes it. It depends on whether a second language ever ships, which is ADR 0049's question
   and not this one's.
