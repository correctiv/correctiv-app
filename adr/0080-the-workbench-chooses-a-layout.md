# ADR 0080 — The workbench chooses a layout

Status: accepted, 2026-10-06, built. Carries out the open points 3 and 4 of
[ADR 0078](0078-layouts-ship-and-demo.md) and the first two of what
[ADR 0079](0079-the-app-draws-its-tabs-from-the-layout.md) left undecided: the workbench edits
and shows any layout, the frame draws a layout whole, and no screen is a special case in the
tool either.

## Context

0078 §7 had the workbench edit `demo` until it could choose, and 0079 left three consequences
standing: the frame, which is the app and bundles `ship`, drew the empty state unless a
per-screen override put something there; a screen the layout did not override fell back to
what the build bundles, so another layout's screen could show through; and the navigation
editor offered the demo's five names and nothing else. Each was a way of saying that the five
are built in, in the one place that no longer believed it.

## 1. The layout is in the address, and `ship` is the default

`ly=<layout>` in the frame's half of the address (`PreviewState.layout`), written only when it
is not `ship`. A name that is no folder under `data/layouts/` is no layout, as a junk time is no
time: the link still opens, on `ship`. The toolbar lists every folder, `ship` first, then `demo`,
then the rest by name, so a layout somebody commits appears without a line here.

The default is `ship`, the layout readers get, so that what is edited and what is submitted is by
default what ships. The cost is that the tool opens on an empty layout today, which says so and
offers the way to make a screen.

## 2. The frame gets the whole layout under one key

`workbench:layout-set` holds `{ layout, navigation, screens }`: the navigation and every screen of
the chosen layout. While it is set the app treats it as the layout and nothing else: a screen it
lacks is not found, the bundled and fetched copies are not read, and a refused navigation is the
empty bar, not the bundle's. That is what lets `demo` look as `demo` did and `ship` show its empty
state, with nothing of the other showing through.

The key is written whenever the tool has a layout open, **also for one nobody has edited**: leaving
it out would let the app's own bundle answer for the layout. The older per-screen keys and
`workbench:navigation` stay readable by the app, which still has the seam for any other tool, and
the workbench no longer writes them.

## 3. Every screen can be deleted, and a deletion is a draft

The five have no special place in the tool: the list holds every screen of the open layout, and
deleting any of them, a file in the repository included, is the same act. A screen that was only
ever a draft is gone. One the repository carries is **marked deleted in storage**, because the file
stays in `main` until a submission merges. So a reload leaves it deleted for as long as the draft
is kept, and the tool says so where the screen was: a note, a way back (Restore) and the link that
submits the deletion. Deleting a screen takes its tab out of the navigation draft, since the check
refuses a tab that names no screen, and Restore puts the tab back where the repository had it.

## 4. The navigation editor offers every screen, and has no minimum of its own

It offers the screens of the open layout, by their own titles, and a screen that was deleted is in
neither its choices nor its bar. Zero entries and one are valid, as the document and the app say
(0078 §5); `maxTabs` stays two to five. The order is the bar's and the first entry is the start;
taking one off puts it behind "Mehr" (0078 §5, 0079 §2).

## 5. A submission names one layout, and says when it is the shipped one

The workbench sends `layout` in every `[layout]` submission, for screens, deletions and the
navigation alike. **Home too: the workbench no longer uses `[startseite]`**, which has no layout
in its payload and writes `demo`'s file; the kind stays for links and issues already written. A
submission to `ship` carries a plain note beside Submit that it is the layout the app ships,
because it is the only one whose change reaches readers. A link carries its layout in the envelope
and opens on it; one made before layouts has none and means `demo`.

## 6. Drafts are kept per layout, and the old keys are read once

A draft lives at `workbench:layout:<layout>:<screen>` and `workbench:navigation:<layout>`: the tool's
own record, from which the frame's key is built. Switching layouts drops what the tool holds and
loses nothing. The keys of the time before layouts were `demo`'s, the only layout the tool could
edit, so the first read moves them to `demo`'s drafts and removes them: a draft that was there is
kept, never overwritten, and the old keys are not written again.

## What it costs

- **The frame's key outlives the workbench page.** The app at `/app` opened apart from the tool
  keeps drawing the last layout the tool set, until the key is cleared. The per-screen keys had the
  same property; the difference is that this one is always present.
- **A deletion's draft and the repository can disagree** if somebody merges the file's deletion
  elsewhere: the draft then marks nothing, and Discard removes it.
- **The navigation draft follows deletions.** Deleting a screen edits the navigation draft as
  well, so Discard on the navigation alone does not bring a deleted screen back.

## What is not decided

1. **Making a layout from the workbench** (0078 point 5). Today it is a commit.
2. **What goes into `ship`** (0078 point 6).
3. **A way to leave the whole-layout override**, so that the frame can show the app as it ships,
   without the tool in between.
