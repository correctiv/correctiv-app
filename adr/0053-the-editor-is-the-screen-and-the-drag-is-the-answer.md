# ADR 0053 — The editor is the screen, and the drag is its own answer

Status: accepted, 2026-09-18, from looking at the editor built in
[#214](https://github.com/correctiv/correctiv-app/pull/214) and asking whether the panel
could be arranged the way the app is. Five decisions. They reshape two sections of
[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) and lean on two more.

## Context

ADR 0045 §3 decided that the blocks are **drawn, not described**: each row renders the
app's real component through the build that compiles `apps/mobile/src` into this site, on
the grounds that a theme editor shows the theme. That decision was carried out and it
works. What it did not reach was everything around the drawing.

A row today is a card: a border, padding, the module's name, a sentence about what it
draws, two badges, four icon buttons, the block's id in a monospace box, and the module's
settings underneath. The drawing sits in the middle of that. So the panel shows you the
blocks and does not show you the **screen** — whether the vertical rhythm holds, whether
two blocks sit badly against each other, whether the day reads as a page. The one place
those questions can be asked is the frame beside it, and the frame can only ever show one
minute of the day.

### The alternative that was considered and refused

The obvious other answer is to move the editing into the framed app: hover a block on the
phone, get its controls there. It was refused, and the reason is worth writing down
because the case for it is better than it looks.

**It is not refused on mechanism.** Nothing about it would need a channel. The document
already reaches the app through `localStorage` and the `storage` event
(`preview/home/write.ts`), which works against the published export and needs no dev
handle; and the workbench already reaches **into** the frame by same-origin property
access — `frame/highlight.ts` marks nodes and injects a rule, `frame/reveal.ts` scrolls
the app's own scroller, `frame/locate.ts` attaches capture-phase listeners to the frame's
document and swallows its clicks. In-frame controls would need no `postMessage` and no
line in `apps/mobile`.

**It is refused on the model.** The frame shows the screen at the playhead, so a block
switched off at that minute is not in its document at all — `outlineByTestId` says exactly
that, and quietly outlines nothing when asked for one. An editor that could only address
what is on screen is the editor ADR 0045 §2 spent its longest argument refusing: "remove"
would mean *not on the home screen at all* and *not at this hour* with nothing telling the
two apart, and because module **types** are not distinguishable, a second callout that is
off would be unpickable, so "add a callout here" could only ever mean a third one.

So the editing stays in the panel, and what moves is how much the panel looks like the
thing it is editing.

### What the drawn list is not allowed to lose

ADR 0045 §2 kept a switched-off block's header row and took its drawing away, so that the
whole day stays visible and every block stays addressable.
[ADR 0047](0047-the-handle-is-the-pointers-and-the-arrows-are-the-keyboards.md) §2, with
ADR 0045 §7 behind it, makes the arrow buttons **the** keyboard's route through the order,
and ADR 0045 §7 says in as many words that an arrangement reachable only by a mouse would
be this repository shipping, in the tool it builds the app with, the thing
[#199](https://github.com/correctiv/correctiv-app/pull/199) took out of the app. ADR 0045 §8 puts a block's settings under it, "where the block they
belong to is drawn". Each of those is a constraint on what follows, and two of them are
what the decisions below reshape rather than keep.

## Decision

### 1. The list is the screen, and a block that is off is drawn greyed

No cards, no borders, no gaps. The blocks meet the way they meet on the phone, at the
device's own width, and the column is the phone's width wide.

A block switched off at the point being edited is **drawn, in grey, at reduced opacity**
— not collapsed to a row. ADR 0045 §2's reason is not weakened by this, it is served
better: what §2 was defending is that the whole day stays visible and every block stays
addressable, and a block that is drawn is more addressable than a row standing in for one,
not less. What §2 actually chose was to spend the picture only on what is showing, and
that was a judgement about a list of cards, where a collapsed card is still a card. In a
list that is a screen, a collapsed block is a hole, and a hole is the one thing a person
cannot point at.

Grey and faded, rather than faded alone, because §2 of this record needs the other half of
that vocabulary.

**And `inert`.** A drawn block is the app's real components, so a block that is not on
screen at this hour otherwise keeps a live button in the tab order, with the one word that
says it is off announced once, before it, and never again. Greying says it to an eye and
nothing else; `inert` says it to the tab order, to the accessibility tree and to the
pointer. `Palette.tsx` already answers the same question the same way for its specimens.
This was a consequence nobody had decided until a cold review asked for a yes or a no.

### 2. A drag is shown by moving the block, not by marking a gap

While a block is carried, **every block is drawn where a release would put it**, and the
carried one glides to the place it would take, faded and in full colour. Nothing else marks
the landing: the hairline between two blocks lost its `dropping` state rather than gaining
a rule about when to draw it, because two answers to "where does this go" would part the
first time one of them moved.

**The list keeps the document's order the whole time.** What moves is a `transform` per
row, which costs no layout and can therefore be transitioned — the rows slide rather than
jump, which with blocks the height of a lead article is the difference between an
arrangement and a lurch. `preview/home/carry.ts` is the arithmetic and it has the property
the whole thing rests on: a row's resting top plus its offset is exactly where the
committed document would lay it out. So writing the new order and clearing the transforms
is, on screen, a no-op. **The drop cannot jump**, and that is a consequence of the design
rather than a tuning.

Nothing is written until the drop. So an abandoned carry — Escape, a release off the list,
a touch the browser takes over — needs no undo, because nothing was done.

**The first version really did reorder the list, and it cost the pointer.** It reads as the
simpler design: apply `moved()` to the document on every move, throw it away on the next.
Two things were wrong with it and only one was visible.

The visible one is that a swap is instantaneous and several hundred pixels tall, so the
list lurches under the hand.

The other was found by dragging in a browser and could not have been found any other way.
React reorders keyed children with `insertBefore`; the DOM performs that as a **remove**
followed by an insert; and Chrome releases an implicit pointer capture the moment the
capturing element is removed. Measured on the dev server: `lostpointercapture` fired on the
first move that changed the slot, every `pointermove` after it went to whatever happened to
be under the cursor, and the carried block followed the hand exactly once and then stopped.
A green check said nothing about it, and a screenshot of a drag in progress looked correct.
With nothing moving in the DOM the handle can hold its own capture, which is what ADR 0047
§1 already assumes.

**The geometry is the third thing it buys.** A list that really reorders has to be measured
while it is moving, and the measurement is what decides the move: send the carried block
from slot 3 to slot 2 and the block that was at 2 shifts **down** by the carried block's
height, back past the pointer, which answers slot 3 again. With a 420px block against a
pointer that moved four, one step cascades and settles nowhere. Here the resting layout is
the layout, so there is no circle to break — and the rows are still measured on every move
rather than snapshotted at the grab, because a drawing inside a row can finish measuring
itself mid-carry. What is measured is each row's height, with tops summed from the heights
above, which a `translateY` cannot disturb.

What decides the slot is the carried block's **top edge** against the seams between the
resting blocks, nearest wins. Comparing the pointer against the blocks' centres is the
first thing anybody writes and it is wrong before the pointer has moved: measured against a
list of `[64, 420, 28, 180, 96, 300]`, grabbing the 420px block in its middle answered slot
3 rather than slot 1, so the block would have jumped two places on `pointerdown`. A top edge
starts on its own seam, and a block then travels half of its neighbour before it passes that
neighbour, in both directions.

**A block held against an edge scrolls the panel.** The pointer is captured for the length
of a carry, so without it the only way to reach the far end of the day was a wheel, and on
a touch screen there was no way at all. Measured at a 1300px window: the shipped day is
3356px of blocks in a panel 1049px tall. The speed is proportional to how far into the
margin the block is held, and clamped, so that carrying it out over the phone frame — which
is how a carry is abandoned — does not accelerate the list to the end of the day on the way.

`deltaTo` is gone with the gaps. It converted a gap number into a distance and was the one
piece of arithmetic that is wrong by exactly one place in every first attempt at a drag; a
slot counted among the other blocks is what `moved()` already takes, so there is nothing
left to convert.

### 3. A block's name, its sentence, its id and its settings move into a popover beside it

Opened from the block's own controls, anchored to the side, over the stage rather than over
the panel.

This changes the **form** of ADR 0045 §8 and keeps its reason. §8's argument was that a
setting is judged by what it does to the block, so the control belongs where the block is
drawn. A modal dialog would have thrown that away by covering the block; a popover to the
side keeps it on screen, which is why this needs `@radix-ui/react-popover` rather than the
dialog the palette already uses. The one thing ADR 0045 §8 decided that is untouched is
the controls themselves: a count is still a slider with its ends on show, for the reasons
that section gives, and a module that declares no settings still gets no empty section
promising one.

### 4. The controls are revealed over the block, and the keyboard's route is not conditional

A bar in the block's top corner, appearing on hover. It holds the eye, the two arrows, the
popover and remove.

**It is revealed, not conditional.** Every control is in the tree at all times; what
follows the hover is opacity and pointer events. A control that is `hidden` until a pointer
arrives is an arrangement reachable only by a mouse, which is the thing ADR 0045 §7 refuses
by name, so `group-focus-within` shows the bar to somebody tabbing into it and the arrows
stay exactly the route ADR 0047 §2 made them. `pointer-events-none` while it is invisible,
or a row of unseen buttons sits over the corner of every block and swallows what was aimed
at the drawing.

The badges that used to say "off" and "changed" are gone from the row, and both sentences
survive as screen-reader text beside the marks that replaced them. Grey is not information
a person can be assumed to have, and neither is an accent dot.

### 5. A gutter down the left, which is the one thing the list has that the app has not

A narrow strip beside every block, carrying the drag handle and the two marks — off, and
changed at this point — that must not need a hover to be seen.

It is there for two reasons and the second one is the load-bearing one. It gives the marks
somewhere to live that is not on top of the drawing. And it is what stops a list that looks
exactly like the app from being **taken** for the app: the frame is a foot to the right and
it is the one that answers a tap. A seam that is always visible says, without a word, that
this is an editor.

The column is sized against it — the phone's width plus the gutter, centred in whatever the
panel has — so a drawing at a scale of 1 leaves the marks their own room instead of standing
under them. ADR 0045 §3 refuses to scale a block up, so without that the drawing would stand
in a row half again its size with the controls floating in the empty half.

## What it costs

**The list is no longer self-describing.** A person who does not recognise a block by
sight has to open its popover to learn what it is. That is the trade §1 makes on purpose —
recognition is what §3 of ADR 0045 said the drawings were for — but it is a real loss for
somebody new to the app, and it lands hardest on a block that draws nothing at all.
`HomeBlock` is why that case does not become an anonymous gap: a block that measures no
height draws a strip ~~carrying its own name~~ that says what is missing, its own name or,
since [ADR 0060](0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md) §1, the condition it waits for, which it did not have to do while the row
above it printed one.

**Two faded states in one list.** A carried block is faded and coloured; a switched-off
block is faded and grey. They are told apart by saturation, which is a weaker distinction
than two different shapes would have been. What makes it survivable is that only one block
is ever carried and only while a pointer is down.

**A dependency for a panel.** `@radix-ui/react-popover` composes out of parts this kit
already pulls in through its dialog and its tooltip, so it is close to free on the wire,
but it is a name in `package.json` that a dialog would not have cost.

**The drag has more to go wrong and no more automatic checking than it had.** ADR 0047
§4's answer stands: the arrows are two ordinary buttons, so a broken drag leaves the day
arrangeable. What is new is that the arithmetic under the drag is a leaf module with a test
that checks every block against every slot, including the property the no-jump claim rests
on. What that test cannot reach is the half this record found by dragging: a pointer
capture released by a DOM move is invisible to every check in this repository, and the only
thing standing under it is that somebody opened the editor and pulled a block.

## What this retires

[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) §2, **one claim, struck
in place.**

- **"The drawing goes away, and comes back when the block comes back", and the sentence
  "only the picture is spent on what is showing".** The drawing stays and is greyed. §1
  above says why the reason under that claim now points the other way. Everything else in
  §2 — that the whole day stays visible, that every block stays addressable, and the long
  argument about what a hidden list would do to "remove" and to a second callout — is
  untouched and is what this record is built on.

[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) §8, **one claim, struck
in place.**

- **"A block's settings open under it, in the list", and the clause of its own heading that
  says the same, "Settings expand under their block".** They open beside it. §3 above keeps
  the rest of that sentence, "where the block they belong to is drawn", and says what had
  to be true of the container for it to survive. Both are struck where they stand, because
  a heading is what somebody reads when they cite a section by its number. That section's
  slider and its no-empty-section rule are untouched.

[ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) §5 and §7, **read and
deliberately not struck.**

- **§5's pair of verbs** — on and off are a moment's, add and remove are the day's — is
  unchanged, and §1 above is what now makes the difference visible: an off block goes grey
  where a removed one goes away. §5 wondered whether the eye would stop being a button of
  its own; it has not, and this record does not need it to.
- **ADR 0045 §7's condition, "an arrangement reachable only by mouse would be this repository
  shipping the thing it spent a pull request removing from the app".** Leaned on rather
  than retired. It is the whole reason §4 above reveals its controls instead of mounting
  them.

The record proposed in [#215](https://github.com/correctiv/correctiv-app/pull/215), **read
and not touched.** That one is open, stands on `proposed`, and answers a different
question: whether the component gallery should carry a module's settings as well. Its
answer is that the editor is **the one place** a module's settings are edited, and §3 above
leaves that standing — the settings move from under a block to beside it, which is a move
inside the editor and not out of it. Its own open remainder, whether the editor's address
can name a single block, is untouched and is still the first thing to reach for. It is
cited by pull request rather than by number because it is not in `main`, and a citation
this tree cannot resolve is one `test/decision-numbers.test.ts` is right to refuse.

[ADR 0046](0046-what-the-editor-may-add-and-what-a-block-is-called.md) §5, **read and not
touched.** `sameSection` is what keeps §2's reflow from redrawing the whole day on every
pointer event, because `moved()` returns new arrays of sections that are equal by value.
That is the mechanism §5 exists for, applied to a case it did not foresee.

## What is still open

**Whether the details popover should be modal.** It is not, so focus can tab out of it
while it stays open, to wherever the portal's position in `<body>` sends it. Escape and a
second press of the trigger both put focus back, so nothing is trapped or lost, and the
block underneath stays operable — which is what a non-modal popup is for. What was not
established is how the tab-out actually reads, because the one environment available for
looking could not dispatch a Tab that moves focus. Making it modal would settle it and
would cost a scroll lock over the panel and an `aria-hidden` over the rest of the page,
which is more than an unmeasured worry is worth. Somebody with a keyboard and five minutes
can close this.

**The drop has no animation of its own.** Every block is already where it will be, so there
is nothing to settle; what is missing is the small lift and drop that says a gesture ended.
It would want a state that outlives the carry by a few hundred milliseconds, and that is
worth writing only if somebody says the release feels abrupt.

**Whether the gutter should carry more.** It has room for a mark per moment, which would
say at a glance which blocks the day changes and when. That is an editor for the day rather
than for a point in it, and it belongs with ADR 0039's model rather than here.
