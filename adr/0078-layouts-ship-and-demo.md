# ADR 0078 — Layouts: ship and demo

Status: accepted, 2026-10-06, decided by the product side. **Built:** the data model, the
scripts and the submission's payload (steps 1 and 2 of 5), the tab bar's rules, the empty state
and the routes ([ADR 0079](0079-the-app-draws-its-tabs-from-the-layout.md)), and the
workbench's choice of layout with a whole layout as the frame's override
([ADR 0080](0080-the-workbench-chooses-a-layout.md)). The last section lists what is still open.

It changes where the documents of [ADR 0071](0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
live, and what [ADR 0075](0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md) §7
and [ADR 0061](0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md) §2 mean by "a
screen".

## Context

The app bundles one set of documents, `data/layout/`: five screens and a navigation. They
began as the arrangement the app *would have had* in code, and they have been doing two jobs
since: they are what ships, and they are the example every tool and test is written
against. Those are not the same thing, and the gap is now a cost:

- **What goes into the app has not been agreed.** The five screens are a demonstration of
  what the blocks can do. Shipping them as the product says that it is decided, and it is not.
- **The workbench needs something to show.** An editor with nothing in it teaches nobody what
  a document is. The tests need the same: a grammar is exercised against rich documents.
- **Five names are a special case.** The core refuses a custom screen called `home` or
  `profil` (`customScreenIdFault`), a declared screen may not be deleted, and one must hold
  a section (ADR 0071 §1's check). Each rule was reasonable while the five were the app.
  Together they say that a built-in screen is a different kind of thing from one the
  newsroom made, and the only thing that makes it so is that the first set was written
  first.

So the question is not which screens to ship, which is for the people who decide it. It is
how to ship *nothing yet* without making the example set disappear.

## Decision

### 1. A layout is a folder under `data/layouts/`

`packages/app-core/src/data/layouts/<layout-id>/` holds a `navigation.json` and a
`screens/<id>.json` for each screen. Nothing else is in it. The layout is the unit the deploy
joins (ADR 0071 §1), the unit the check judges and the unit a submission names (§6).

The id is a screen id's grammar and no more: lower-case letters and digits with single
hyphens, at most 40 characters, so no slash, no dot and no capital, and `..` is not a layout.
`layoutIdFault` in the core says which rule an id breaks. A layout's folder is made by a
commit; a submission changes the folders there are and never makes one.

### 2. There are two layouts today, `ship` and `demo`

`demo` is the former `data/layout/`, moved with `git mv` so that its history stays: the five
screens and the navigation as they were.

`ship` is what the app contains, and it is **empty on purpose**: no screen, and a navigation
with no entry. It is empty because it has not been agreed what goes onto the app, and an
empty folder is the honest form of that. A layout with no screen is valid.

### 3. The app bundles `ship` and nothing else

Every other layout exists for the workbench and the tests, and none of them may reach an app
bundle. The core holds the two seams, `ship/bundle.ts` and `demo/bundle.ts`, each naming its
files because Metro has no directory import. `test/layouts.test.ts` fails when the list and
the folder part, and when anything under `packages/app-core/src` or `apps/mobile/src` imports
a layout that is not `ship`. The deploy publishes `ship` as the document the installed app
fetches, and the `ship` bundle is its floor (ADR 0036 §10).

There is **no pointer and no switch in the app**: it does not know that another layout exists.
A switch would be a way to open the demo on a phone, and nothing wants that.

The app's own tests read `demo` in `ship`'s place (`apps/mobile/__tests__/support/mocks.ts`),
since content to draw is what they were written against. A suite about the empty bundle
puts `ship` back.

### 4. A screen is a screen, whatever its name

No screen is built in. The five names are not reserved, a screen may be created, written
and deleted whatever its id, and there is **no minimum**: a layout may hold none, and a
screen may hold no block, because a screen that is only a heading is a screen (ADR 0075 §7).
The one id that stays reserved is `navigation`, the name a submission gives the tab bar's
document (ADR 0071 §4).

`screenIdFault` and `isScreenId` say this in the core. ~~`customScreenIdFault` is unchanged,
because the app still draws the five from code, and the two stay apart until the app's side
(the open points) lets a route stand for any id.~~ Voided by
[ADR 0079](0079-the-app-draws-its-tabs-from-the-layout.md) §4: a route stands for any id now,
and the two are one question.

### 5. The order in `navigation.json` is the order of the bar, and its first entry is the start

The rule that Home is always first and always there, and the rule that a bar has at least two
tabs, both go. What replaces them is what a reader sees, by the number of entries `n` and the
limit `max` the document configures (the former "tabs before Mehr", two to five, with "Mehr"
counted as one of them):

| entries | the app draws |
|---|---|
| 0 | an empty state |
| 1 | the screen, with no tab bar |
| 2 to `max` | every entry as a tab |
| more than `max` | the first `max − 1` as tabs and "Mehr", which lists the rest |

An entry the bar leaves out is behind "Mehr", so no screen is unreachable for being listed
late. ~~**This is decided and not built:** the core's `parseNavigation` still reads Home as the
fixed first tab that is not in the document, which is the first of the open points.~~ Built by
[ADR 0079](0079-the-app-draws-its-tabs-from-the-layout.md) §2.

### 6. A submission names exactly one layout

ADR 0061's `[layout]` payload gains a field: `{ layout, target, document }`, with `via` where
the draft came by a link (ADR 0076 §3). The workflow writes or deletes
`data/layouts/<layout>/screens/<id>.json`, or that layout's `navigation.json`.

The payload's `layout` passes the id grammar of §1, and names a folder that exists with its
navigation, or the run is refused with a sentence of its own. A payload with no `layout` is
refused, because a submission that does not say which layout it changes would be choosing
one. Any screen may be written or deleted, Home's file included; the `[startseite]` kind
stays and writes `demo`'s, which is the file it always meant.

The check the workflow runs is the deploy's, once per submission: join the layout, then check
the joined document. The check is stricter than the app in one way and looser in another: a
tab that names no screen of its layout is refused, and a layout with no screen is not.

### 7. Until the workbench can choose, it works on `demo`

~~The editor's baseline, its dev save and the payload it builds name `demo`: it is the layout
with something in it. `shippedOf` and the navigation editor read `demo/bundle.ts`.
One consequence is visible: the frame beside the editor is the app, which bundles `ship`, so
it draws no screen until the editor's own draft (the override seam, ADR 0057) puts one there.~~
Voided by [ADR 0080](0080-the-workbench-chooses-a-layout.md) §1 and §2: the workbench chooses
its layout, opens on `ship`, and the frame draws the chosen layout whole. `demo` stays the layout
with something in it, and the one a link made before layouts means.

## Consequences

- `data/layout/` is gone. Code and comments that named it name `demo` or `ship`.
  `join-screen-layouts.ts` and `check-screen-layouts.ts` take a layout; Pages joins `ship`.
- **The published `home.layout.json`** was a copy of Home's file for builds that fetch only
  that one (ADR 0057 §4). `ship` has no Home, so the copy is made when the file exists.
- A deploy of `ship` while it is empty publishes a document with no screen. An installed app
  keeps what it has fetched and draws its bundle when it has nothing (ADR 0036 §10), so what
  a phone shows is its own empty state, once the empty state is built, and its last good copy until.
- The `ADR 0071 §1` check no longer wants every declared screen, and no longer refuses a
  declared screen with no section. Both were the special case of §4.
- ~~A navigation editor that refuses a bar of fewer than two entries is stricter than the
  document now is. The submission no longer says so; the editor's own affordance does, until
  the open points are built.~~ The editor takes the last entry off as well, since
  [ADR 0079](0079-the-app-draws-its-tabs-from-the-layout.md).

## What this does not decide, and what comes next

1. ~~**The tab bar in the app** (§5): `parseNavigation`, `arrangeTabBar`, the tab bar's host
   and the empty state, with the navigation document carrying every entry, Home's included.
   Nothing here changes what the app draws until then, which is why the app still reads a
   navigation of no entries as Home alone.~~ Built by
   [ADR 0079](0079-the-app-draws-its-tabs-from-the-layout.md) §2.
2. ~~**Routes for any screen**: the app declares five and draws a custom screen at `/s/<id>`.
   When every id is a screen, a route has to stand for any of them, and `customScreenIdFault`
   loses its `declared` fault.~~ Built by
   [ADR 0079](0079-the-app-draws-its-tabs-from-the-layout.md) §1 and §4.
3. ~~**The workbench chooses a layout**, and may offer `ship` as an editing target. The frame
   then needs a way to show a layout the app does not bundle.~~ Built by
   [ADR 0080](0080-the-workbench-chooses-a-layout.md) §1.
4. ~~**A whole layout as an override** in the frame, instead of a screen at a time (ADR 0057).~~
   Built by [ADR 0080](0080-the-workbench-chooses-a-layout.md) §2.
5. **Making a layout** from the workbench. Today it is a commit (§1).
6. **What goes into `ship`.** This record is the reason the question can wait; it does not
   answer it.
