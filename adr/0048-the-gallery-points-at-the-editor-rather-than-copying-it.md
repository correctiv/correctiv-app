# ADR 0048 — The gallery points at the editor rather than copying it

Status: accepted, 2026-09-18, from finishing
[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) and finding its last
section answered by the work rather than waiting for it. Four decisions, three of them to
stop.

It stood as **proposed** for a day, which would have been the first status of its kind
here, because stopping is the team's call rather than the carrying-out's. The review
answered it: all four decisions stand, and the question underneath §1 — where a block
declares itself, if not in a component's folder — became
[ADR 0054](0054-a-block-declares-where-it-may-appear.md). The status is the review's, and
the record is left as it was argued. §3, the one thing it builds, is built in
[#215](https://github.com/correctiv/correctiv-app/pull/215).

## Context

ADR 0045 §10 says the component gallery can show a module's settings and let somebody work
them "where the component is already drawn", and gives the reason plainly: "A setting is a
question about what a component shows, and the gallery is the page that draws components,
so it is one page rather than a second copy of the controls."

It also says, in as many words, that it is "a consequence being claimed, not a mechanism
being specified", and names the obstacle: the modules are deliberately outside
`src/components`, which is the folder the gallery walks. ADR 0045's own open items add
three more questions — whether moving a control there changes anything beyond the one
drawing, whether it can be linked to the way `?c=` links to a component, and whether a
value set there has any way to reach a document.

**Four open questions and a claimed consequence is not a design, and that was honest of
0045 to say.** What has changed since is not that somebody answered them. It is that
§1 to §9 were built, and the thing ADR 0045 §10 wanted now exists somewhere else.

**The editor draws every module with its settings, live, beside the running app.** The
list in `/preview`'s home tool draws each block as the app's real component at the phone's
own width (0045 §3), the palette offers every module in the registry drawn the same way
(0045 §6, [ADR 0046](0046-what-the-editor-may-add-and-what-a-block-is-called.md) §1), and
a block's settings open under it with a slider or a picker (0045 §8). Somebody who wants
to see what `latest-research` looks like with three items instead of five moves a slider
and watches two drawings change: the row, and the app in the frame beside it.

So ADR 0045 §10's own sentence now points the other way. There is a page that draws the
modules and carries the controls. Putting a second set in the gallery would be the second
copy that sentence was written to avoid.

## Decision

### 1. The modules stay out of the gallery, and out of `src/components`

`apps/mobile/src/lib/home/modules.tsx` says why and the reason is untouched: these are
compositions of one screen, not components of the app, and "a specimen of 'the fact-check
rail plus its heading' is the screen".

What moving them would cost is worth stating, because "just move the folder" is the
obvious suggestion. `scripts/generate-component-ids.mjs` walks `src/components` and emits
a union; `gallery/catalogue.tsx` is a hand-written list held against that union by three
type-level checks, so a component with no entry is a compile error. Moving the modules in
means eleven catalogue entries whose specimens are screens, and leaving them out means a
second walk, a second union and a second completeness check beside the first — two lists
where the repository has spent a generator and a type on having one.

### 2. A module's settings are worked in the editor, and that is the one place

Not because the gallery could not host a copy, but because a copy is what it would be.
ADR 0045 §3's argument for drawing the blocks — "a theme editor shows the theme" — is
satisfied in the editor, with the document the module will actually appear in.

The editor shows one thing the gallery structurally cannot: **a module in a day.** A
setting on the home screen is read at a minute, against what the moments before it left
behind, beside the blocks above and below. A specimen is a component out of its document
by definition, and a slider on one would answer "what does eight fact checks look like"
while the question a newsroom is asking is "what does the screen look like at eight in the
morning".

### 3. The gallery says where the modules are, and links to it

One row on `/components`, naming the home screen's blocks and pointing at
`/preview?tool=home`. Not a drawing, not a control: a sentence and a link.

This is the whole of what ADR 0045 §10's reader would have been looking for — "where do I
see the
modules" — and it costs one paragraph rather than a surface. It also answers the
navigation half of the original idea, which is the half that was really missing: the
editor is behind a tool rail on another route, and somebody reading the component
reference had no reason to know it exists.

### 4. `?c=` is left alone

ADR 0045's open item asks whether a module could be linked to the way `?c=` links to a
component. It could, and it is not built, because the thing to link to is a block in a
document rather than a module in the abstract — and that link already exists in a better
form. `/preview` carries the route, the device, the appearance, the hour and whether the
day is drawn, all in the address; a link to the editor at half past six is a link to a
module in the state somebody wants to argue about.

Extending `?c=` to name a module would produce a second address for a thing the first one
already addresses better. What is not decided here is whether the editor should be able to
name one BLOCK in its address so that a link opens with that row expanded; that is a real
gap and it is named below rather than answered.

## Why not the alternatives

**Build it as ADR 0045 §10 describes.** The work is a second catalogue walk, eleven
entries whose
specimens are screens, an invented `HomeSection` per specimen, and a settings control
wired to state that reaches no document. The last of those is the one that decides it: a
control that changes a drawing and nothing else teaches somebody that they have configured
something when they have not. `preview/ui/Panels.tsx`'s token editor is the same shape and
gets away with it only because it says so on the page and offers a Copy that carries the
proposal into a file.

**Move the modules into `src/components` and let the gallery find them.** It would work
and it would make the gallery's list eleven entries longer, each of them a screen. It also
spends `modules.tsx`'s argument, which is not about folders but about what a specimen is
for. If that argument is wrong, the record to change is that file's reasoning, not this
one.

**Declare beside the module which screens it may be used on, and let the gallery read
that.** Raised in the review of this record, and it is the right shape for a question this
record does not ask: `apps/mobile/src/lib/home/settings.ts` is already a declaration beside
the modules that a generator carries into the core, and one more field on it would say
where a block belongs. It does not dissolve §1, because the obstacle is the unit rather
than the absence of a declaration: `latest-research` is a section header, a hairline and a
row per item over a feed, `feed-status` draws no component at all, and a field on
`FaktencheckRail` saying it may be used on the home screen would promise what that
component alone cannot keep. What the declaration is right for is a second configurable
screen, and [ADR 0054](0054-a-block-declares-where-it-may-appear.md) is where that goes.

**Leave ADR 0045 §10 standing as an unbuilt intention.** Tempting, and it is what "not
built" would
normally mean. It is refused because ADR 0045 §10 is not waiting for time: it is waiting
for four
answers, and three of them stopped applying when the editor landed. A section that will
never be built is a promise the board keeps making, and this repository has a mechanism
for exactly that — strike it, say what voided it, and link the record.

## What it costs

**Somebody looking for a module in the gallery will not find it there**, and will find a
sentence instead. That is the trade: one indirection, in exchange for one place where a
module's settings are worked.

**The editor is a heavier page than the gallery.** It boots the app in a frame, and
somebody who wanted to look at one block now waits for that. Real, and not worth a second
surface to avoid; the alternative charges everybody a second list to save one person a few
seconds.

**A record that mostly says "stop" is easy to write and hard to check.** Nothing here
fails if it is wrong. What stands in for a check is §3's link: if the editor ever stops
being where the modules are drawn, that link goes stale and somebody following it will
say so.

## What this retires

[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md), **ADR 0045 §10 struck
whole**,
and its open item with it.

- **ADR 0045 §10's first paragraph, that the gallery can show a module's settings and
  let somebody work them where the component is already drawn.** It will not. §2 above
  says where they are worked, and ADR 0045 §10's own reason — one page rather than a
  second copy of the controls — is what now argues against it, because the page that
  draws the modules and carries the controls is the editor.
- **ADR 0045's open item "What the gallery does with a setting somebody changes there."**
  Nothing, because nothing changes there. Its four questions are answered by not building
  the surface that raised them, and §4 above says which part of the fourth is real and
  stays open.

[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md), **read and deliberately
not struck.**

- **ADR 0045 §9, that a module declares its settings beside itself.** Untouched and
  load-bearing. ADR 0045 §10 was written as a consequence of that decision; the
  consequence does not hold and the decision does.
- **ADR 0045 §3, that the blocks are drawn.** This record leans on it entirely. It is the
  reason the editor is a sufficient answer.

## What is still open

**Whether the editor's address can name a block.** `/preview` carries the route, the
device, the appearance, the hour and the day's visibility, and a link to a block would
open the editor with that row in view. Not built, and the first thing to reach for if
somebody asks for ADR 0045 §10 again, because it is the navigation half of what ADR 0045
§10 wanted without
the surface.

**Where a block says which screen it belongs to**, which the review of this record raised
and [ADR 0054](0054-a-block-declares-where-it-may-appear.md) answers. It touches nothing
decided here; it is the question underneath §1 rather than an objection to it.

**Whether a module ever becomes a component.** If one of the eleven turns out to be
reusable off the home screen, it moves to `src/components`, the gallery finds it by the
walk that is already there, and none of this applies to it. That is a thing to notice when
it happens rather than to plan for.
