# ADR 0047 — The handle is the pointer's, the arrows are the keyboard's

Status: accepted, 2026-09-17, from looking at the editor built in
[#210](https://github.com/correctiv/correctiv-app/pull/210) and
[#211](https://github.com/correctiv/correctiv-app/pull/211). ~~**Not built.**~~ **Built in
[#214](https://github.com/correctiv/correctiv-app/pull/214)**, all four decisions,
together with the section of
[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) it reshapes. It changes
one decision in that record and nothing else, so that the three sections of that record still to be carried out — add, remove and
reorder; the insertion mark; the handle — are a build rather than a build plus an
argument.

## Context

ADR 0045 §7 decided that each block gets **one handle that both a pointer and a keyboard
move** — focus it, pick it up, move with the arrow keys, drop it, Escape abandons — and
that the two arrow buttons in the row header go when it lands. Its reason was that the
arrows beside a handle would be a third way to say one thing, "and the one nobody tests".

That section also wrote down the condition on its own decision, in bold: **"The arrow
buttons are the accessible route today, so what replaces them has to do their job before
they go."** It named [#199](https://github.com/correctiv/correctiv-app/pull/199), which
measured the app's controls against a thumb and a screen reader rather than judging them
from the source, and said the editor is held to the same standard even though that pass
did not reach it.

That section was written before any of this existed. Two things have been built since, and
both bear on it.

**The row has an icon button now.** ADR 0045 §5 took the `Shown` checkbox out, and what
replaced it is an eye in the row's header, beside the two arrows. So the arrows are no
longer the only small controls in that header, and the part of its case that was about
clutter is weaker than it was: three icon buttons in a row read as a row of controls,
where two arrows beside a text checkbox read as an afterthought. That is a judgement from
looking at the thing, which that record could not do.

**The track shipped, and it is the shape ADR 0045 §7 cited.** `preview/home/Timeline.tsx`
is a pointer surface with a typed time field beside it as the accessible route. Two
mechanisms, each with one input. It quoted that file's comment as arguing for one
mechanism with two inputs; the comment argues the opposite, and the file is the evidence.
What it refuses is a **third** way — giving the `div` a slider role on top of the pointer
and the field — because that is the one nobody would test.

## Decision

### 1. The drag handle is the pointer's route, and it has no keyboard mode

A pointer picks a block up by its handle and drops it somewhere else in the column. That
is all the handle does. It is not focusable, it has no `tabindex`, and no key does
anything to it.

### 2. The arrow buttons stay, and they are the keyboard's route

Two buttons per row, `Move <name> up` and `Move <name> down`, disabled at the ends,
exactly as they are today. They are what a keyboard and a screen reader use to reorder the
day.

They are not a fallback and not a leftover. They are the route, and the handle is the
other one — the same arrangement the track already has, and the reason it works there is
the reason it works here: **each input gets a control shaped for it**, rather than one
control pretending to be shaped for both.

### 3. Two controls, one operation, and the document never learns there were two

Both call `moved(layout, id, delta)` in `preview/home/document.ts`. The pointer's drop
computes a delta from where the block landed; the button's click passes `-1` or `1`. What
the document sees is one function and one kind of edit, so a difference between the two
inputs cannot exist below the interface, which is where a difference would be expensive.

The cost is two handlers where ADR 0045 §7 wanted one. It is worth naming and it is small:
the handlers are the two lines that turn a gesture into a delta, and everything after them
is shared.

### 4. The keyboard drag is refused now and named as a thing that could be earned

What ADR 0045 §7 asked for is a real mechanism and a good one: pick up, move, drop,
Escape, with the destination announced as it moves. It is refused here for one reason,
which is that nothing in this repository can test it. The announcement is a live region
whose wording is the whole feature; the pick-up is a mode a person can get stuck in; the
drop needs a target a screen reader can name. Those are four failure modes, none visible
to `npm run check`, against two buttons that already work and were already measured.

What would change the answer is a way to test it. If the workbench grows a check that
drives a keyboard and reads what a screen reader would say — the shape
[ADR 0044](0044-the-workbench-drives-a-real-device.md) is reaching for on a device,
applied to this page — then a keyboard drag becomes a thing with a net under it and §1
above is worth
revisiting. Not before.

## Why not the alternatives

**Build the keyboard drag and keep the arrows until it is proven.** This is the cautious
version and it is the one ADR 0045 §7's own condition suggests. It is refused because
"until" has no end: nothing would ever declare the drag proven, and the interim state —
three ways to reorder — is the state that section was right to refuse. A decision that
produces a permanent interim is a decision not taken.

**Drop the handle and keep only the arrows.** Tempting, because the arrows work and the
handle is new code. It loses the thing the whole editor is for: the list is a picture of
the day, and moving a block from the fourth place to the ninth by pressing a button five
times is not arranging, it is counting. A pointer dragging a drawn block to where it
should go is the interaction ADR 0045 §3 spent the drawings on.

**One handle with both inputs, as ADR 0045 §7 wrote it.** The decision this record
changes. It is the better design on paper and it is one code path, which is a real
advantage. What it is not is testable here today, and an accessible route that cannot be
checked is a claim rather than a route.

## What it costs

**Two controls for one operation, on every row, for ever.** Somebody meeting the editor
sees a handle and two arrows and may reasonably wonder why both. The answer is not on
screen and will not be. Accepted, because the alternative is one control that is worse for
one of the two inputs.

**The handle's affordance has to be obvious enough to be found**, since nothing else says
a block can be dragged. That is a design problem this record does not solve and hands to
the carrying-out, where it can be looked at rather than argued.

**That section's "one thing to test" is given up.** There are two things to test now, and
one of them — the pointer drag — is the one this repository is least able to check
automatically. What stands in for a check is that the other route is two ordinary buttons,
so a broken drag leaves the day still arrangeable rather than leaving it stuck.

## What this retires

[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) §7, **two claims, struck
in place**.

- **Its heading clause "and the arrow buttons go", and the sentence "Keeping the arrow
  buttons beside a drag would be that third way."** They do not go, and keeping them is
  the second way rather than the third: the handle and the arrows are one control per
  input, which is what `Timeline.tsx` does. §2 above is what they moved to.
- **Its second paragraph, "The keyboard takes it — focus the handle, pick it up, move with
  the arrow keys, drop it, Escape abandons and puts it back — and the destination is
  announced as it moves."** The handle has no keyboard mode. §4 above says what would have
  to be true for that sentence to come back, and it is a check that does not exist yet.

[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) §7, **read and
deliberately not struck.**

- **Its bold condition, "The arrow buttons are the accessible route today, so what
  replaces them has to do their job before they go."** Untouched, and this record is that
  sentence taken seriously rather than worked around: nothing replaces them, so they stay.
- **Its standard, that the editor is held to what #199 held the app to even though that
  pass did not reach it.** Leaned on rather than retired. It is the whole reason §4 above
  refuses a route it cannot check.

The track and the comment inside it, **read and not touched.** What ADR 0045 §7 quoted
lives in `preview/home/Timeline.tsx` rather than in any record, so there is nothing to
strike; what changes is which way that comment is read, and this record says so above
rather than editing the file to agree with it.
[ADR 0042](0042-the-timeline-belongs-to-the-stage.md) §3, which is what put the track
where it is, is untouched either way: it is about who may write the document, not about
how a block is moved in it.

## What is still open

**Whether the handle should also be the row's grip for anything else.** ADR 0045 §2 lists
"the name, the drag handle, and the mark that says it is off here" as what a collapsed row
keeps, so the handle is on a row whether or not that row draws anything. Whether a
collapsed row is draggable is not in question — it is — but whether the handle is the
sensible place to put anything further is not decided and should be decided by looking.

**What a screen reader hears when the order changes**, by either route. The arrows
announce themselves and say nothing about the result, so a person pressing "Move Lead
article up" hears the button and not the new order. That was true before this record and
is not made worse by it, and the fix is a live region either way, which is the same
unbuilt thing §4 above is about. Named because it is the part of ADR 0045 §7's design that
is worth having independently of the drag.
