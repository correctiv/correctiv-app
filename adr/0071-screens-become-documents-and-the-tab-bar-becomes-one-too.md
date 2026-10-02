# ADR 0071 — Screens become documents, and the tab bar becomes one too

Status: accepted, 2026-10-01, decided by the product side. Not built. It answers the
question [ADR 0054](0054-a-block-declares-where-it-may-appear.md)
§5 left open and the two items of its "What is still open" that a second configurable
screen forces, and it is written before the second screen exists for the reason ADR 0054
gave: the first one is already drawn, and the parts that would otherwise be argued
screen by screen are the same parts.

## Context

The home screen is a document ([ADR 0036](0036-the-home-screen-becomes-data.md)): places
in an order, settings per place, moments that change them
([ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md)), a condition and an
audience per block ([ADR 0060](0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md)).
It is edited in the workbench, carried into the repository by a submission
([ADR 0058](0058-the-workbench-holds-no-power-and-github-is-who-you-are.md),
[ADR 0061](0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md)), published
beside the app and fetched, with the bundled copy as the floor
([ADR 0057](0057-the-structure-comes-from-the-workbench-the-selection-from-wordpress.md) §4).

The other tabs are still written in source. The newsroom wants them arranged the same way,
and wants the tab bar itself to be a choice rather than a constant. ADR 0054 §5 named the
four parts a second configurable screen needs and decided none of them; this record decides
them, and adds the part ADR 0054 did not see, which is the navigation.

## Decision

### 1. One document per screen, in one place

Every configurable screen is a document of the shape the home screen already has, under
`packages/app-core/src/data/layout/screens/<screen>.json`, and the home document moves there
with its content unchanged. One file per screen rather than one file with a screen per key,
because the two writers are different people with different reviewers, a change to one screen
should be a diff that touches one file, and a parse fault in one must not be able to take the
others with it.

The published artifact is the files joined into one document at deploy time, so the app
fetches one address and the screens and the navigation (§4) arrive in the same state. The
join is a build step of the Pages workflow and holds no logic: it neither validates nor
rewrites, because the parser is the core's.

### 2. The parser refuses a block on a screen it does not declare

This is the half ADR 0054 §5 deliberately left unwritten. ~~A block's declaration already
names the screens it may appear on (ADR 0054 §2), and the parser now holds a document to it:
a block on a screen it does not declare is refused by the same rules and with the same
smallest-possible loss ADR 0039 §6 gave a fault, not by drawing it anyway.~~ Struck: every
configurable screen takes every block, so there is no declaration left to hold a document
to — [ADR 0073](0073-every-screen-takes-every-block-and-a-block-declares-its-category.md)
§1. ~~The refusal survives for the four blocks that print a screen's own title (§3 there),
with the same code and the same smallest-possible loss.~~ It does not survive at all:
ADR 0073 §3 is struck in turn and the code with it, because one header block prints the
title of whatever screen it is on
— [ADR 0075](0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
§6. The bundled copies are held to it
by a test, so a committed document that the parser would refuse does not reach a release.

The moments, conditions and audiences of ADR 0039 and ADR 0060 apply to every screen with
no change to their meaning, because they were written about a block and a reader, not about
the home screen.

### 3. A setting belongs to a placement, not to a block

ADR 0054 left open whether one block on two screens wants the same settings on both. It
does not. A fact-check rail on Entdecken may show another number than the one on the home
screen, so the settings a document carries belong to the **placement**, the block as it
stands on one screen, and the declaration beside the block supplies the default for each
key. A block that is placed twice has two sets of settings and nothing links them.

Which keys exist stays the core's ([ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §4),
and a block that appears on a second screen names it in its list of screens rather than being
declared a second time (ADR 0054 §2).

### 4. The tab bar is a navigation document, and the fixed first entry is Home

The tab bar is a document of its own, `packages/app-core/src/data/layout/navigation.json`: an
ordered list of entries, each naming a destination the app declares. ~~The app declares what
can be a destination, with its screen, icon, label as a message and the feature it belongs
to ([ADR 0072](0072-features-are-released-by-a-commit-and-never-by-a-fetch.md));~~ Struck
for the icon and the label: they are properties of the screen's own document, localised, and
the app declares the route and the set of icons a document may name
— [ADR 0075](0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
§3 to §5. The feature a destination belongs to is still the app's (ADR 0072). The document
chooses and orders. Home is always the first entry and cannot be taken out, because it is the
one screen that is the app's answer to "where am I" and the floor under every fallback in §6.

The destinations are tabs, and nothing else yet. A later screen of another kind, a game for
instance, is one more destination in the declaration; whether such a thing is a tab is the
question that record asks, and this one only requires that the mechanism does not stop it.

### 5. Two to five visible tabs, and a "Mehr" menu that is our own

A navigation shows between two and five tabs. When the document lists more entries than a
threshold the document itself sets, the surplus goes behind a tab called "Mehr", which
counts as one of the visible tabs and is itself a screen: a list of the entries that did
not fit. The wish is a threshold above three entries, and it is a field of the document
rather than a constant, so that the number is the newsroom's to tune and not a release's.

The system's own overflow is not used. iOS folds a tab bar into "More" only past five
entries and offers no way to change that number, so it cannot express the wish, and its
behaviour on Android and on the web differs. Whether the native tab components carry a tab
that opens a list cleanly on each platform is a **measurement to take before the menu is
built**, and this record does not claim it.

On a window of 768 px and wider the same entries are the left rail of
[ADR 0070](0070-a-left-rail-on-tablet.md); the rail is another drawing of the same document,
not another document, and it follows the same limits.

### 6. Fetched at runtime, with the bundled copy as the floor

The navigation and the screens are fetched the way the home document is (ADR 0057 §4; ADR
0036 §5, §9, §10): from one address the app holds as a constant, kept as the last good copy,
with the bundled files as what a first launch without a network draws. The app falls back to
the **bundled navigation** when it is offline or the fetch failed, when fewer than two tabs
remain after the unreachable ones are removed, or when an entry names a screen this version
of the app does not know. An older app therefore never draws a tab it cannot open, and a
newer document never needs a newer app to be safe.

Navigation is layout, and layout is fetched. What the app may reach is not: that is
[ADR 0072](0072-features-are-released-by-a-commit-and-never-by-a-fetch.md), and a fetched
document can only arrange what the bundled release already allows.

### 7. A live pin is a post ID, and the pin stays the exception

ADR 0057 §2 holds that the document carries structure and never an article, and that the
pin remains a setting a moment may change where an editor really means one article. This
record keeps that and records one thing about how the editor chooses the pin.

The editor may offer a **search over the live posts** next to the sample pins. What a pin
stores is the **post ID**, never the title or the text, so the document still names no
content, only a handle on it. When the post is gone the place falls back to its rule, which
is ADR 0036 §8 unchanged. The rule remains what runs unattended and the pin remains the
exception to it; a live search makes a pin easier to set and does not make it the usual way
to fill a place.

The same applies to a rule's own inputs: a category or a tag a rule asks for is a setting of
the placement (§3), chosen from the live taxonomy and stored as the term's identifier.

## Why not the alternatives

**One file with a screen per key.** Refused in §1: one diff, one reviewer and one fault
boundary per screen are worth more than one fewer file. The join at deploy time gives the
app its single address without making the repository pay for it.

**Settings per block, shared by every placement.** Simpler, and it is the shape the home
screen has today. It fails on the first block that is on two screens with two different
wishes, and the alternative then is two declarations of one block, which ADR 0045 §9 and
ADR 0054 §2 each refused.

**The system's tab overflow.** Refused in §5 on the threshold, not on taste.

**Navigation compiled into the app and changed by a release.** It would need no fallback
and no parser, and it would put the newsroom back to waiting for a store review to move a
tab, which is the problem ADR 0036 was written against.

## What it costs

**The core grows a notion it did not have: a screen with an identity.** Until now "the home
layout" was the only layout and its name was the whole of its identity. Every selector that
took it now takes which screen, and the first change is mostly renaming.

**A bad navigation document is worse than a bad screen.** A faulty screen document loses a
block; a faulty navigation loses a way into the app. §6's fallback is therefore stricter than
ADR 0039 §6's, and it is the reason the navigation is validated before it replaces anything,
not after.

**The "Mehr" menu is a screen the app draws and the newsroom does not arrange.** It lists what
did not fit, in the order the document gave. Making that list itself configurable is not
decided here.

## What this retires

**ADR 0054 §5, the clause that waits.** "What waits for a second configurable screen is the
rest" is answered by §1 and §2 above: the second document is a file per screen, and the
parser refuses a block on a screen it does not declare.

**ADR 0054, "What is still open".** The first item, whether a screen's document is a second
file of the same shape or one file with a screen per key, is answered by §1. The second,
whether one block on two screens wants the same settings on both, is answered by §3. The
third, the article's own blocks, is **not** touched and stays a separate question.

Nothing in ADR 0057 is struck. Its §2 is kept with the note in decision 7 above, and its §4 is the
mechanism decision 6 above reuses.
