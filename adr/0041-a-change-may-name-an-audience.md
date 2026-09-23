# ADR 0041 — A change may name an audience, and one file knows what the name means

Status: accepted, 2026-09-17, from the architecture meeting held in
[#200](https://github.com/correctiv/correctiv-app/issues/200) and the design interview
after it. ~~**Not built.**~~ Built by
[ADR 0060](0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md), which adds a module's own conditions
and a module's default audience beside it.

## Context

The note was "Neben der Timeline auch Nutzerrollen": beside the timeline, reader roles.

[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) made the home screen a day.
`sections` are the ordered places as the day begins, `moments` are times, each carrying
only what differs from the state before it, and rendering at a time is a fold: every
moment at or before this minute, applied in order. The document answers **when**.

It does not answer **who**, and the app has always known who. A session carries an
`Entitlement` ([ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md),
[ADR 0019](0019-identity-lives-in-the-session.md)): a tier, whether the membership
includes the app, why it does, until when, which local newsletters it pays for, since
when. The door at the root reads it. Nothing on the home screen does.

So the ask is small in the grammar and large in what it enables: the newsroom wants to
lead with something different for the people who pay for this than for the people who have
not signed in, and it wants to say so in the same breath as "at eleven, lift the callout".

**What the newsroom must not have to say.** `appAccess`, `source: 'local-bundle'`,
`validUntil`. Those are the membership system's vocabulary, they are answered by beabee
and change without an app release — `models.ts` says exactly that about why the app
respects `appAccess` and never derives it — and a document that asked an editor to write
one of them would be a document only we can edit. [ADR 0036](0036-the-home-screen-becomes-data.md)
§1 already decided that the document is designed as though the newsroom owned it: **no
field means "the person editing this knows the codebase"**.

## Decision

### 1. The audience sits on the change, and the fold gains one clause

A change may name an audience. A change that names none is for everybody. Rendering is
then: **every change at or before this minute whose audience matches**.

The audience belongs on the change because **a change is already the unit of "what
differs"**. ADR 0039 §1's whole argument is that a moment carries only the difference, so
that an editor reads a day rather than simulating one. "Who it differs for" is the same
kind of qualifier as "when it differs", and putting it anywhere else separates the two
halves of one editorial thought.

It also reads. "At 18:00, for paying members the lead is X; for everybody else it is Y" is
two changes at one time, two lines, side by side in the file and side by side in the
editor's diff for that moment. Neither line has to know what the other does, which is the
property that makes the fold composable at all.

~~**Not on the place.**~~ A place says who it is for since
[ADR 0060](0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md) §2, for presence only; what it shows
for whom is still a change's, for the reason that follows. A place that carried a set of
audiences could be present or absent per audience and nothing else; the moment the same place should show a *different thing*
to two audiences, it has to become two places. Places are fixed and are the screen's, by
[ADR 0036](0036-the-home-screen-becomes-data.md) §2 — a new place is an app release — so
audiences on places multiply the screen by the audience list and make the app's structure
a function of the newsroom's marketing vocabulary.

**Not a day per audience.** The obvious model, and it fails on maintenance rather than on
expressiveness. Almost everything in a day is the same for everybody; a day per audience
means every ordinary edit is made once per audience, and the one that gets forgotten is
invisible, because each day is internally consistent and nothing compares them. The
divergence would be discovered by a reader.

### 2. The audiences are names the newsroom recognises, and the list is not in this record

Not signed in, free supporter, paying member — or whatever the real set turns out to be,
which is named below as open. What is decided here is the **kind** of name: a word from
the newsroom's own vocabulary, the one they would use in a meeting, and never a field of
the entitlement.

The list is deliberately absent because inventing it here would be inventing the
newsroom's categories on their behalf, and the document's whole design premise is that
they own it.

### 3. Exactly one file turns an audience into an entitlement question

One table, in `packages/app-core`, beside `lib/home-settings.ts`, because which names the
document may use is part of the document's grammar and the grammar is the core's
([ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §4). It maps each audience
to a predicate over the session — over `tier`, `appAccess`, `source`, `validUntil`,
`localAreas`, `memberSince` — and nothing else in the repository may ask that question.

Two things follow, and they are why this is one file rather than a convention.

**When the membership model changes, one file changes.** beabee decides what a membership
grants and changes without an app release. A predicate written into three screens is three
edits and a fourth nobody finds.

**A new audience without a rule does not compile.** `Record<Audience, …>` over a closed
union is mechanism 1 of [ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md),
which is the cheapest rung on that ladder and the one most often missed. The same shape
`MODULE_SETTINGS` already has for settings, for the same reason.

An audience the app does not recognise is refused the way ADR 0039 §6 refuses anything
else: **the smallest thing that carries the rule**, which here is the one change. The place
goes on holding what it inherited, and what it inherited is a state somebody chose for
everybody. That is the right fallback and not a lucky one: the alternative — dropping the
place — would take a working screen away from the readers an older app cannot classify.

### 4. The audience is a parameter of the selector, exactly as the minute is

`sectionsAt(layout, minute, audience)`. The core holds no clock
([ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §8) and it holds no session
here either: the fold is a pure function of the document and two answers, and the host is
what knows both.

That keeps the test surface flat — a day for an audience is a call, not a fixture — and it
is what lets the workbench show somebody else's screen without pretending to be them. The
shell can already seed a signed-in session through `preview/frame/seed.ts`, so previewing
a day for an audience is the state tool and the timeline together rather than a third
mechanism.

### 5. An audience is an editorial filter and never a lock

A change hidden from an audience is not hidden from anybody's device. The document is one
document, fetched whole, by every app; anything in it can be read by anyone who wants to
read it.

So: the audience decides what the home screen *leads with*. It does not decide what a
reader may open. The door stays where [ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md)
and [ADR 0018](0018-removing-the-guest.md) put it, at the root, on `appAccess`, answered by
the server. This sentence is in the record because the mechanism looks like access control
from a distance, and the first person to reach for it as one will be reaching in good
faith.

## Why not the alternatives

**A condition language in the document.** `when: tier == 'paid' && validUntil > now` is
more expressive than a name, and it is a program: the app becomes an interpreter, the
newsroom becomes a group of people writing expressions they cannot test, and the
membership model is now in the document rather than behind one file. ADR 0036 §2 refused a
layout engine for the same reason and the argument transfers without modification.

**The audience as a field of the session, chosen by the reader.** A "show me the members'
view" switch. It is a different product — a preview feature for readers — and it answers a
question nobody asked. The workbench needs it; the app does not.

**Audiences everywhere: on places, on moments and on changes.** Three places to say one
thing, and an editor then has to work out which of the three is in force. ~~One level, the
one that already means "what differs".~~ Two since [ADR 0060](0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md) §2, the place and the change,
which answer two questions and are applied one after the other; moments still carry none.

## What it costs

**"What does the home screen look like at 18:00" stops having one answer.** It has one per
audience. Everything that draws the day — the editor, the timeline, a screenshot in a pull
request — has to say *whose* screen it is showing, including when the document names no
audience at all, or it will show one audience's day and call it the day. That is the real
cost of this record and it lands on the workbench rather than on the app.

**The number of screens a document describes is moments times audiences.** Nothing about
the fold gets slower, but reviewing a document by looking at it does, and it is how
documents are reviewed today.

**A second closed set that has to be got right before the newsroom sees it.** The audience
list is a union in the core, so widening it is an app release, exactly as a new place is.
That is the same trade ADR 0036 §2 accepted for places and it is accepted here for the
same reason: the alternative is a set that can be widened by anybody and checked by
nobody.

## What is still open

**The real list of audiences.** ~~Nobody has written the newsroom's own vocabulary
down.~~ The product owner named three on 2026-09-23, and [ADR 0060](0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md) §3 is the list.
What the shape has to be is decided — a closed, small set of names, each answerable from
the sign-in response the app already holds, with no second request — ~~and what the names are
is not~~, and the names are decided too, by [ADR 0060](0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md) §3.

**What an audience means for a reader who is signed out, and for one whose membership has
lapsed.** The app can already tell those two apart: `AccessShortfall` in
`stores/session.ts` distinguishes `lapsed` — a trial or membership whose end date has
passed — from `tier`, which is every other refusal. What it cannot tell is whether the
newsroom wants them treated alike. Editorially a lapsed paying member is not a stranger,
and "not signed in" may be the right audience for both of them or exactly the wrong one for
one of them. Whoever writes the list above answers this at the same time, because it is the
same question asked about two people.

**Whether `localAreas` is an audience.** The entitlement carries the local newsletters an
account pays for, and `models.ts` says plainly that nothing selects content by them yet. A
local audience is the obvious second use of this mechanism and it is not designed here,
because the names in that field are the membership system's labels and turning a label into
an audience is the one thing §2 above refuses to do by accident.

## What this retires

**Nothing is struck.**

[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §1's fold — "take the sections
as written, apply every moment at or before that minute" — was **read and deliberately not
struck**. It is not false; it is the case where nothing names an audience, which is every
document that exists today and every document written afterwards by somebody who never uses
this. §1 above adds a clause to it rather than replacing it, and a strike would tell a
reader the fold had been overturned when it has been extended. AGENTS.md's rule is that only
a claim somebody would act on and be wrong about is struck.

The same for **ADR 0039 §8's `sectionsAt(layout, minute)`**. The signature grows an
argument; the decision that sentence carries is that the core holds no clock, and §4 above
is that decision applied a second time rather than a contradiction of it.

[ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md),
[ADR 0018](0018-removing-the-guest.md), [ADR 0019](0019-identity-lives-in-the-session.md)
and [ADR 0020](0020-no-contribution-in-the-app.md) were read for it and none is affected.
The entitlement is what an audience is translated into; the door is left where they put it
by the fifth decision above; and nothing here reintroduces a contribution, an amount or a
second identity.
