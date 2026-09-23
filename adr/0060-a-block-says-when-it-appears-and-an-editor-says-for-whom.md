# ADR 0060 — A block says when it appears, and an editor says for whom

Status: accepted and built the same day, 2026-09-23, from the product owner's ask on the
configurator's block view. It carries out
[ADR 0041](0041-a-change-may-name-an-audience.md) and extends it by a module's own
conditions and a module's default audience.

## Context

The ask, in its own words: in the configurator's block view there are options such as the
settings and hiding a block. At the same time some blocks have conditions under which they
appear, the loading and offline notice for one. For some of them a fixed condition makes
sense. But there are further conditions, the kind of membership (a free member, not yet a
member, a paying member), and it makes sense to unify these conditions and make them
configurable, where for example the Backstage blocks come with them preconfigured.

Three things already in the repository decide most of the answer.

- **ADR 0041 is accepted and not built.** An audience sits on the change and the fold gains
  one clause; the audiences are names the newsroom recognises; one file turns an audience
  into a question about the entitlement; the audience is a parameter of the selector as the
  minute is; and an audience is an editorial filter, never a lock.
- **There is no guest.** The door at the root admits only an entitlement that includes the
  app ([ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md),
  [ADR 0018](0018-removing-the-guest.md)). So "not yet a member" is an audience no reader of
  the app can be in today. Whether the app becomes installable for people who are not
  members is the open question in [#242](https://github.com/correctiv/correctiv-app/issues/242)
  §4, and it is not this record's to answer.
- **Some blocks already decide for themselves when they draw.** Measured in
  `apps/mobile/src/lib/home/modules.tsx` and the components under it on 2026-09-23: the feed
  status draws only while the app loads or is offline, the lead article only when a pin or
  the newest investigation exists, the Spotlight briefing only once an issue has loaded, the
  latest-research list only when the feed holds more than the lead, the fact-check rail only
  when fact checks have loaded, the callout only while one is open. In the editor each of
  them read "… zeichnet hier nichts." and gave no reason.

Who is inside the door, by the entitlement (`packages/app-core/src/types/models.ts`): a
`paid` or `soli` tier, a trial month (a `paid` tier at 0 €), and a local newsletter that
includes the app without an app membership, whose tier is the membership's own and can be
`free`.

## Decision

### 1. Two kinds of condition, one vocabulary in the editor

**What a block owns** is a condition nobody configures: loading or offline, an issue to
show, a feed that is not empty. It stays in the module's code, and its **name** is declared
beside the module in `apps/mobile/src/lib/home/conditions.ts`, the way its settings
([ADR 0045](0045-the-home-editor-arranges-the-blocks-it-draws.md) §9) and its screens
([ADR 0054](0054-a-block-declares-where-it-may-appear.md) §2) are. Every block has an entry
and `null` is written for one that always draws, asserted against `HOME_MODULES` in both
directions. The core has no use for it, so no generator carries it there.

The configurator prints it read-only in the block's popover, and in place of "zeichnet hier
nichts" when the block measures nothing: "Erscheint nur, wenn die App lädt oder offline
ist." An editor then sees why a block is empty.

**What an editor sets** is the audience: who a place is for, and who a change is for. Both
sit in the same part of the same popover as the block's own condition, so the three read as
one list of when and for whom.

What the declaration cannot promise is that the name is true. It names a rule written in
code, and nothing reads one against the other. That is written where the list is.

### 2. A module may declare the audience it is for, and the document may override it

`HOME_MODULE_AUDIENCES` in the same file, for the modules that have one. Absent is
everyone. The fold needs it, so `scripts/generate-home-settings.mjs` carries it into
`packages/app-core/src/lib/home-audience.generated.ts`, the same crossing for the same
reason as the settings, with the same drift check. The document overrides it in
`audiences`, a map from section id to audience beside `sections` (§6 says why it is not
inside the section), and the editor writes an entry only where it differs from the default.

**The early-access card is for paying members.** Its own words are a club member's,
"Backstage · Früher lesen" over "Sie lesen jetzt, drei Tage vor allen anderen", and to a
reader who is in by a local newsletter at the 0 € tier that sentence is not true.

**The Backstage teaser declares nothing**, against the ask's example, and that is a
decision. Its own docblock makes the case: the diary is open, the bonus is the member's
part, and the card is the club's argument made on Home to whoever reads it. Filtering it to
the people already in the club would take the argument away from the one reader it is for.
Either way it is one line to change, and the product side can overrule it there.

### 3. Three audiences, in the club's words, and one file that says what each means

| In the document | In the editor | Who |
| --- | --- | --- |
| `everyone` | Alle | every reader; written only to take a module's default back off |
| `paying-members` | Mitglieder mit Beitrag | a `paid` or `soli` tier, a trial month included |
| `free-members` | Kostenlose Mitglieder | the 0 € tier, which inside the door is a local newsletter that includes the app |

"Mitglieder mit Beitrag" is what the door says the app is for, and "Kostenlose
Mitgliedschaft" is the profile's word for the tier, so the configurator and the app call a
person the same thing. The rules read the tier and nothing else, because the tier is what
tells these three apart; a trial is `paid` by the membership system's own answer, and an
audience read off an amount would lock out the people being courted.

**A local newsletter on a paid tier is a paying member.** `source: 'local-bundle'` says why
the app is included, not who pays, and the simulated sign-in answers exactly that for a
`lokal` address. Only a local bundle on the `free` tier is a free member.
`packages/app-core/test/home-audience.test.ts` holds both, because widening `free-members` to
every local bundle left every suite green until it did.

**What the rules answer for a reader Home never draws for is harmless.** An expired trial, a
membership without `appAccess`, and nobody signed in are refused at the door, so no fold is
ever run for them. `readerOf` still answers for them, `everyone` and a tier, which is what the
workbench needs to name the reader of a frame whose door is shut.

`packages/app-core/src/lib/home-audience.ts` is ADR 0041 §3's one file: a `Record` over the
union, so an audience without a rule does not compile.

**"Not yet a member" is not an audience.** Nobody inside the door can be in it, so a rule
for it would always answer no: an audience that parses, can be chosen and makes a block
vanish for everybody. The editor shows it in the list, switched off, with the reason in the
option's own words, and the parser refuses it like any name it has no rule for. It becomes
an audience the day #242 §4 is answered with a yes, and then it is one line in the table
and one rule.

### 4. The reader is the fold's third parameter, beside the instant, and the preview is the fixtures

`sectionsAtInstant(layout, instant, reader)`, and `stateAt`, `sectionsAt`, `stateAtInstant`
and `changesAt` with it. `reader` is the set of audiences one reader is in, answered by
`readerOf(entitlement)`, because a paying member is in `everyone` too and a change for
either applies. It is a parameter and never a default, so nothing can draw one audience's
day and call it the day.

The fold then is ADR 0041 §1 with one more clause: every change at or before the instant
whose audience the reader is in, in the day and in every active edition
([ADR 0059](0059-the-day-gets-a-date-and-the-newsroom-plans-in-editions.md) §4) alike, then
every place that is not hidden **and is for this reader**. The two are separate questions.
`hidden` is the state the day put the place in; the audience is who the place is for at all,
so a moment that switches a place on does not widen who it is for.

The app passes the session's entitlement. The workbench passes the session the framed app
holds, read out of the storage the two share and followed through `storage` events and the
seed step's own announcement, so it is the reader the frame is showing: the fixture's, the
held-open door's on a first visit, or whoever signed in inside the frame. It is not read off
the address, which on a first visit named nobody while the frame drew a paid member.
**That is the preview, and there is no second mechanism**: `s=onboarded` is a paying
member, and a new fixture, `s=free-member`, is a 0 € member with a local newsletter. A block
the framed reader is not in the audience of is greyed in the list, as a hidden one is, and
its popover says why.

### 5. The editor writes one change per block and point, and checks a repetition against every reader

The popover gains "Zeigen für", who the block is for all day, and, where the point at the
playhead has a change about the block, "Diese Änderung gilt für", which retargets that change.
It does not choose a second one, and it does not offer an audience another change about the
block at that point already carries, because two changes for one audience at one point would
be a rule about which wins.

**An edit lands on the change the framed reader is in.** A document may carry two changes
for one place at one time for two audiences, ADR 0041's own example. The editor edits the
last of them that reaches the reader in the frame, because that is the one whose word stands
on the screen beside it, and leaves the other exactly as it is. Where the point holds changes
about the block and none of them reaches that reader, the controls are switched off and the
popover says so: writing a new change for everybody there would override the others'
audience as well, on a screen nobody is looking at. Framing a reader in that audience is how
it is edited. Writing a new pair is done by retargeting one change and adding the other.

ADR 0039 §10 has the editor take out a change that restates what the point inherits. With
audiences in a document, what a point inherits depends on the reader, so **a change repeats
only if it repeats for every reader it reaches**. The core lists every reader the rules can
tell apart (`READERS`), and the editor asks each. A document with no audience in it folds
the same day for all of them, so this changes nothing for any document written before this
record.

### 6. What an older app does with it

The version is 4, and this is a live case: apps fetch the document
(`packages/app-core/src/stores/homeLayout.ts`, #245), so an app built before this record will
meet one written after it.

**A place's audience sits beside the sections, in `audiences`,** a map from section id to
audience, for the reason editions sit beside the day (ADR 0059 §5): a version 3 app reads the
top level's known keys and nothing else, so it never sees the map and draws every place for
everybody. That is a filter ignored, which §7 says is harmless, and never a block lost. The
first version of this record wrote the audience inside the section, and a version 3 app drops
a section carrying a key it does not know (ADR 0039 §6): one word, `everyone` on the
early-access card to take its default off, removed the card for every reader of an older app,
and on a callout the callout. Measured in review on 2026-09-23 against the frozen version 2
parser, which has the same rule, and held since against the version 3 parser itself, frozen
beside it. The cost of the map is that what is written about one place is in two parts of the
file. That does not touch ADR 0039 §2, which refused a place's starting state living inside a
moment, where it could be moved or deleted; a map beside `sections` is a sibling of them, as
editions are (ADR 0059 §3), and a filter is not state.

**A change carrying `audience` is dropped by an older app**, by the same rule for an unknown
key. The place keeps what it inherited, which is a state somebody chose for everybody: an
older app shows every reader the day as it is for everyone, and ADR 0041's pair reaches
neither of its audiences there. That is the cost that stands, and the editor writes the key
only where a change is for somebody in particular; `everyone` is the key's absence.

**What the editor refuses for it.** The day for everyone is also every older app's day, and
ADR 0059 §5 needs it to stay a whole screen. The shipped callout is a swap, two changes at
11:00, one showing the lifted place and one hiding the other; retargeting only the first to
paying members leaves everybody else, and every older app, with neither callout, because the
hiding half still applies to them and the showing half no longer does. So the editor refuses
a retarget that leaves some reader, the reader in no audience included, with none of a block
that another change at the same point hides, and the popover switches those audiences off
and says why. That holds the swap and nothing wider: a document written by hand can still
build one, and the fold draws it as written.

**An audience this app has no rule for** costs the least that carries it. In `audiences` it
is the one entry, and the place is drawn as its module would draw it, which is what an older
app does with the whole map; on a change it is the change, as ADR 0041 §3 said.

### 7. A filter, and nothing inside the door becomes locked

ADR 0041 §5 holds without change. The document is one file, fetched whole by every app. An
audience decides what Home leads with; it does not decide what a reader may open. The
early-access card is not drawn on Home for a free member, and `/backstage` is as open to
them as it was.

## What it costs

**Every picture of Home is a picture of one reader's Home.** ADR 0041 said so and it is now
true: the editor, the frame and a screenshot in a pull request show one reader's screen, and
the fixture in the address says whose.

**An older app ignores who a place is for and drops a change for somebody in particular.**
Both are filters falling away, and §6 is why that is the better failure.

**A declared condition can be wrong.** The name in `conditions.ts` and the early return in
the module are two halves, and only a person reading both keeps them together.

**The editor's repetition check is complete only while the rules read the tier.** `READERS`
is one entitlement per tier and nobody, and a rule that reads `localAreas` has to add its
cases there. The test beside the file holds each audience to at least one listed reader.

## What this retires

[ADR 0041](0041-a-change-may-name-an-audience.md), **three claims and two clauses of one open item,
struck in place.**

- **Its status, "Not built."** This record builds it.
- **§1, "Not on the place."** A place now says who it is for. What the argument under it was
  about, a place showing a different thing to two audiences, is still a change's and not a
  place's; what the place carries is presence, and the reasoning is left as it is.
- **"Why not the alternatives", "One level, the one that already means 'what differs'."**
  There are two levels now, the place and the change. Moments still carry none, which is the
  half of that paragraph that stands.
- **"What is still open", "Nobody has written the newsroom's own vocabulary down", and
  "and what the names are is not" beside it.** The product owner named three on
  2026-09-23, and §3 above is the list.

[ADR 0053](0053-the-editor-is-the-screen-and-the-drag-is-the-answer.md), **one clause.**
"What it costs" says a block that measures no height draws a strip carrying its own name.
A block with a condition of its own now says the condition instead (§1).

Read and deliberately left standing:

- **ADR 0039 §2, that a place's starting state is the document and not a moment.** The
  `audiences` map sits beside `sections` and inside no moment, so it is the rule kept, as
  editions keep it.
- **ADR 0041 §4's `sectionsAt(layout, minute, audience)`.** The third argument is a set of
  audiences rather than one, and the call is `sectionsAtInstant` since ADR 0059. The decision
  the sentence carries, that the core holds no session, is what §4 above builds.
- **ADR 0041 §3, that an unknown audience drops the one change and not the place.** True of
  a change, and the sixth decision above keeps it for a place as well.
- **ADR 0041's other two open items**, what an audience means for a reader who is signed out
  or has lapsed, and whether `localAreas` is an audience. Neither reader is inside the door,
  and neither question is answered here.
- **ADR 0039 §8's `sectionsAt(layout, minute)`**, for the reason ADR 0041 gave for not
  striking it.
- **ADR 0018 §1, that behind the door a second version of a screen for somebody who has not
  paid has no audience.** A filter on what Home leads with is not a second version of a
  screen, and nothing here reintroduces one.
- **ADR 0059 §8, which leaves audiences out of its slice.** A sentence about that slice.
- **ADR 0045 §9 and ADR 0054 §2.** This record is both mechanisms applied once more.

## What is still open

1. **"Not yet a member"**, which waits on #242 §4.
2. **Whether the Backstage teaser is for paying members**, which §2 decides against and the
   product side may decide otherwise, in one line.
3. **An editor for two changes about one place at one time**, which §5 leaves to the file.
4. **A check that a declared condition is the module's real one**, which nothing can make
   today short of rendering each module in each state.
