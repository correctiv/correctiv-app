# ADR 0038 — One tool at a time, in a rail

Status: accepted and carried out, 2026-09-16. The right panel of `/preview` shows one
tool at its full height, switched from a rail on the right edge; below 1024 the rail
lies along the bottom and the panel stands on it.

## Context

[ADR 0028](0028-one-shell-and-a-route-that-declares-its-context.md) gave every view of
the site the same right-hand panel and put its state in the address. That was the right
move and this record does not undo any of it. What it did not decide is how many things
that panel shows at once, and the answer it inherited from the page it replaced was
"all of them, stacked".

On `/preview` that is six: Appearance, State, Console, Tokens, Measure, Inspect, each a
collapsible section, all six sharing one column that the declaration sets to 31% of the
window. At 1440px that column is about 440px and the six titles, their chevrons, their
icons and their badges are about 190px of it before anything opens. Every section that
does open is therefore a sliver, and a sliver needs a caption saying what the sliver is
— which is where most of the panel's prose came from, and why the panel reads as an
essay with controls in it rather than as a tool.

Three specific defects, all of them consequences of the stack rather than of Radix:

**Two buttons, one job, nearly one icon.** The header carried a `PanelRight` /
`PanelRightClose` toggle at the end of the bar, and the panel carried a
`PanelRightClose` of its own in its title row. Both shut the same panel. Neither said
which of the six things inside was about to appear.

**Badges that report that nothing has happened.** `untouched`, `inert here`,
`combination unknown`, `findings, not run` — four of the six sections' badges, on screen
whether or not anything is open, each saying that a thing has not been done.

**Below 1024 it is not usable and it looks it.** A `narrow: 'page'` view rendered its
sections inline after the page, so on a phone the preview's six tools were a column of
accordions under a device frame, reachable only after pressing "show chrome", because
the same view arrives `full` at that width. That half is the half that was broken, and
it was found by looking rather than by any check.

The panel's contents are good and mostly stay. What changes is that six things stop
competing for one column.

## Decision

### 1. One tool at a time, opened from a rail on the right edge

`apps/workbench/src/ui/ToolRail.tsx` is a narrow column of icons pinned to the right
edge of the window, one per entry in the open view's `sections`, always visible whether
or not the panel is. It is the mirror of `ui/ActivityBar.tsx` on the other edge and the
same idea one level down: the left rail reaches any view from any view, this one reaches
any tool of the open view from any other.

The panel, `ui/ToolPanel.tsx`, shows the one that was asked for, at the panel's full
height, with a title row naming it and nothing else. No chevrons, no five other headers,
no strip above them.

Every tool's body stays mounted and the ones that are not showing are `hidden`. That is
the accordion's one piece of hard-won knowledge carried across: unmounting a tool takes
its slot target with it, and with the target gone the page's `Slot` draws nothing, so
the console's level filter and the component route's device choice reset every time
somebody looked at another tool. The accordion learnt it as Radix's `forceMount` plus an
explicit `hidden`, because `forceMount` is what takes Radix's own `hidden` away. There
is no Radix in the way here, and the trap that is left is the plain one: `hidden` is
`display: none` from the user agent's stylesheet, which any `display` in a class beats,
so the element carrying it carries no class. `apps/workbench/test/shell/tool-panel.test.tsx`
asserts all three — mounted, hidden, and no `display` on the wrapper — over every tool of
every view, and is the successor to `section.test.tsx`, which asserted the same three
things about the accordion.

### 2. The rail is the only switch, and nothing is open by default

Pressing a tool's icon opens it. Pressing the open tool's icon shuts the panel. That is
the whole of the toggle: the header's button is deleted and so is the panel's own close
button, and with them the pair that showed one icon for one job twice.

⌘J stays and means what it meant, adjusted for one-of-N: it opens the last tool this
session, or the view's first where there has been none. The memory is a ref in
`App.tsx` and not part of the address — it is a record of what was asked for, not a
statement about what is on screen, and writing it to the hash would put a tool into
every link that had merely been looked at once and shut again.

**Nothing is open by default, on any view.** `openByDefault` and `panelOpenByDefault`
are both deleted from the declaration rather than reduced to one field. A panel showing
one of N cannot open by default without also choosing which, and no view can answer that
for its reader; the two views that used to open their panels — `/design` and
`/components/<group>/<name>` — did so because the panel was the only thing that said
what was in it, and the rail says that now without opening anything.

### 3. `tool=` in the address, and what an old `open=` link does

`tools=1|0` and `open=a,b,c` become one name, `tool=<id>`, written only when a tool is
open — which, with no defaults left, is the same rule ADR 0028 §2 states and the whole
of it for the panel. A shut panel writes nothing at all.

Both old names are still read, and neither is ever written. An old link is read for what
its reader **saw**, which is not the same as what it said:

| link | then | now |
| --- | --- | --- |
| `#?open=console,measure` | panel shut, two sections open inside it | nothing open |
| `#?tools=1&open=console,measure` | panel open, Console and Measure | Console |
| `#?tools=1` | panel open, the view's defaults | the view's first tool |
| `#?tools=0` | panel shut | nothing open |
| `#?tool=tokens&tools=1&open=console` | — | Tokens; the new name wins |

The first row is the one worth stating plainly: `open=` and `tools=` were independent,
so a link listing open sections inside a shut panel showed the reader nothing, and it
shows them nothing now. That is the rule — read the link for what was on the screen —
and it is why `tools` and `open` stay on the shell's own list of names. They must, or a
view would find them in `rest` and hand them back out.
`apps/workbench/test/shell/address.test.ts` holds every row of that table.

### 4. Below 1024 the rail lies along the bottom, and the panel stands on it

The `narrow` field is deleted with its two cases. There is one narrow layout: the rail
is a row along the bottom of the window, and the open tool is a panel above it taking
about half the window's height, with the page still on screen above that.

**In the flow, not in a dialog.** The sheet this replaces was a Radix dialog sliding in
from the right, which traps focus and dims what is behind it — and what is behind it
here is the thing the tools are about. Measure's outline and Inspect's picker are both
instructions to look at the frame and tap in it; a modal over the frame makes the tool
that armed them unusable. So the page keeps half the window, keeps its scroll, stays
tappable, and the rail does not move under the reader's thumb when the panel opens.
`ui/kit/sheet.tsx` had no other caller and is deleted.

`fullWhenNarrow` is untouched: `/preview` still arrives with the chrome out of the way
below 1024, because the app is what the link was for. The rail is part of the chrome and
comes back with it.

### 5. A badge only where it reports a number to act on

`<id>:tags` becomes `<id>:mark`, and the rename is the decision: the slot may hold one
number that the reader would do something about, or nothing. It is on the tool's icon in
the rail, so whatever goes in it is on screen permanently, which is a much higher bar
than a row beside a section title.

Kept, two, and both draw nothing at zero:

- **Console** — the errors if there are any, otherwise the warnings. One mark, and the
  worse of the two is the one worth interrupting somebody for; the split is the first
  thing the tool prints.
- **Measure** — the findings of the last run.

Cut, six, with the reason each:

- `untouched` (State) — the fixture nobody has chosen, which is every visit until
  somebody chooses one.
- `inert here` (Appearance, Inspect) — said twice, about a condition that already has a
  card inside each of those two tools explaining it beside the control it disables.
- `combination unknown` / `combination N` (Appearance) — the combination is a row of the
  list inside the tool, marked `on screen`, and the status line says it as well.
- `{scheme} scheme` (Tokens) — the first line of the tool says which scheme it is
  overriding, in the sentence where it matters.
- `findings, not run` (Measure) — "a check has not been run" is the state of the world
  until somebody runs it.
- `this site` / `390×844` / `6 props` (the component route's three) — each is a restating
  of the control immediately below it.

**The build line goes with them**, and this is the part that is a move rather than a
cut. `Counts` and `BuildLine` were a strip above all six tools: three counts, a `Build`
badge, and a paragraph reading "Store handle absent, the appearance setting and the
inspector are inert. Fixtures and token overrides still work." The fact is real and it
stays; what was wrong was its position, above six tools of which it concerns two. The
counts are the rail's two marks. Which build is in the frame is the status line's, where
it already was. Why a control is dead is the `NeedsDev` card inside each of the two tools
it disables, where it already was. And the paragraph about the route field driving the
app's own router is on the button it is about, the one that opens the app without the
frame, in its tooltip.

### 6. Every view with a panel gets the rail, and a table of contents is not a tool

One mechanism, not two. `/design` gets three icons, `/components/<group>/<name>` four,
`/preview` six, and a document, the sources board, the decisions board and the reference
get one: their contents.

A rail of one is still worth having, and the reason is not that a table of contents is a
tool — it is not, and the code says so where it declares it. It is that the panel needs a
switch, that the edge the panel opens from is where the switch belongs, and that a
reader who wants the contents of anything on this site should find them in the same place
every time. The alternative was to keep the header button for the reading views and give
the rail to the other three, which is two mechanisms doing one job and a header button
whose presence depends on how many things a route happens to declare.

## Why not the alternatives

**Tabs across the top of the panel.** The obvious one-of-N control, and it fails on the
number: six labels do not fit across a 440px panel, so they become six icons, and six
icons across the top of a panel that is not open is nothing at all — the panel has to be
open before the switch exists. That is the two-buttons problem again with the second
button moved.

**A `<select>` at the top of the panel.** Fits, says the names in words, and hides five
of the six behind a press. It also cannot carry the console's error count, which is the
one thing on this panel worth seeing without looking for it.

**Keep the accordion and make the panel wider.** It was tried in the small: the
declaration already gives `/preview` the widest panel of any view, 31%, and 55% is the
most the resizable group allows. At 55% of 1440 the six headers still cost 190px and the
app is in a 600px column, which trades the thing being previewed for the thing previewing
it.

**Keep the accordion and let one section open at a time, without a rail.** Half the
change, and the half that does not fix the phone. It also keeps five headers on screen to
switch between six things, which is the layout this record is about.

**A modal bottom sheet below 1024, rather than one in the flow.** Conventional, and it
would have been less code — Radix's dialog already does the motion, the escape key and
the tap outside. It is wrong for this panel specifically: two of the six tools are
instructions to interact with the page behind the sheet, and a modal makes that
impossible while a non-modal one gives up the only things a dialog was providing. What is
left after that is a positioned div with a focus trap nobody wants, which is what the
flow layout is without the trap.

**Leave the reading views on the header button.** Two switches for one panel across the
site, decided by a count in a table. See §6.

## What it costs

**The panel's docked width is now a width for one tool rather than for six.** 31% is
kept, because the console and the token list are what asked for it and they are what
still uses it. The reading views keep 19%. Nothing was re-measured for this, and that is
the honest statement: the widths were right for the widest tool and the widest tool has
not changed.

**The rail is 3rem of every view that has a panel, for ever.** On a document at 1024 that
is three per cent of the window taken from a centred reading column that was not using
it, which is why this is acceptable and not free. The buttons inside it are 2.75rem —
44 CSS px, the threshold the preview's own Measure check fails a control for being under,
which a rail shipped beside that check has no business failing.

**A link nobody sends any more still has to be parsed.** `tools` and `open` are dead
names that `shell/address.ts` reads, and they cannot be dropped without breaking the
links in `RELEASE.md`'s wake and in whatever anyone has pasted into a pull request.
They are six lines and a table-driven test; the alternative is a dead link with no error
anywhere, which is the failure mode ADR 0037 §3 is about.

**Two files of chrome deleted and two written.** `ui/Section.tsx`, `ui/ContextPanel.tsx`,
`ui/SidePanel.tsx`, `ui/kit/collapsible.tsx` and `ui/kit/sheet.tsx` are gone, with
`@radix-ui/react-collapsible` from `apps/workbench/package.json`; `ui/ToolRail.tsx` and
`ui/ToolPanel.tsx` are the replacement. `SidePanel` was the one shared piece between a
left sidebar and a right one, and there has been no left sidebar since ADR 0028 — the
rail on that side is `ActivityBar` and does not use it.

## What is still open

**The left rail's buttons are 2.25rem and the right rail's are 2.75rem.** The right one
is sized to pass the check it ships beside; the left one predates that argument and was
not touched here, because a change to the site's oldest piece of chrome is not something
to slip into a panel redesign. The two rails therefore do not quite mirror each other at
the pixel level, and one of them is wrong. This record does not say which.

**Nothing checks that the rail is reachable at a given width.** `workbench:renders` opens
`/` in a browser and asserts that the shell mounted, which is the whole of what it
claims. The phone layout of this change was judged by looking at it, in both appearances,
and the pictures are in the pull request. That is the same standing as every other layout
decision in this repository and it is worth naming rather than implying.

## What this retires

[ADR 0028](0028-one-shell-and-a-route-that-declares-its-context.md), **four claims,
struck in place.**

- §1's last paragraph, "A section's badges are a slot of their own, `<id>:tags` … '0
  warnings' is worth reading without opening the console". The slot is `<id>:mark`, and a
  clean count is one of the six things §5 above cut. The argument for a slot of its own —
  that the chrome outside a tool is the shell's, and that a number worth acting on is
  worth seeing before the tool is open — is untouched, and is exactly why two of the eight
  survive.
- §2's parameter block, the two lines `tools=1|0` and `open=a,b,c`. They are `tool=<id>`,
  by §3 above. Read, never written. The rest of that block and the whole argument around
  it — one grammar, the two halves that cannot collide, a parameter written only when it
  differs from the default — is what this change is built on and is untouched.
- §3's second half, "**`/design` and `/components/<group>/<name>` open open**". Nothing
  opens by default anywhere now, by §2 above, so that decision has one half left and its
  title no longer describes a pair. The first half, `/preview` opening shut, is not struck
  and is not merely still true: it is now the rule rather than the exception.
- §4's two narrow layouts, "A `narrow: 'drawer'` view keeps today's sheet. A
  `narrow: 'page'` view … the sections are rendered inline after the page … and the
  header's toggle is hidden". One layout, by §4 above, and the `narrow` field is deleted.
  The observation that decides that section — there is no width to divide at 390px, a
  fourteen per cent panel is fifty-five pixels — is untouched and is where §4 above
  starts.

[ADR 0028](0028-one-shell-and-a-route-that-declares-its-context.md), **one claim read and
deliberately not struck.** Its "Why not the alternatives" says "`tools=1` is the
difference between the link `RELEASE.md` hands out and the link somebody sends a
colleague to show them a console error". The parameter is not written any more and the
sentence is still true in every way a reader could act on: `tools=1` still opens a panel,
the difference it names is the reason the panel's state is in the address at all, and
that reason is the one this record builds on. Struck, it would read as though the
argument had been overturned, and the rule for a strike is that the claim is false and
acting on it goes wrong.

**Nothing in [ADR 0014](0014-the-preview-shell-as-a-package.md),
[ADR 0024](0024-the-handbook-owns-the-root.md), [ADR 0035](0035-a-check-that-opens-the-page.md)
or [ADR 0037](0037-the-whole-site-is-the-workbench.md) is affected, and all four were read
for it.** 0014's same-origin argument is untouched and is why every tool in this panel can
reach the frame at all. 0024 and 0037 are about addresses and origins and neither says
anything about the panel. 0035's two render checks run unchanged and caught nothing here,
which is what its own "what it cannot see" section says they cannot.

**One code comment deleted with the thing it described**: `ui/Section.tsx`'s account of
`forceMount` and the explicit `hidden` beside it. §1 above says where that knowledge went
and why it still applies; `ui/ToolPanel.tsx` carries it, and the test that held it is
`tool-panel.test.tsx` rather than `section.test.tsx`.
