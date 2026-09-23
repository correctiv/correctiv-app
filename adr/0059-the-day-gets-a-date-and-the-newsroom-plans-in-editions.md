# ADR 0059 — The day gets a date, and the newsroom plans in editions

Status: accepted, 2026-09-23, decided by the product side on a design memo written for this
record. **Not built.** §8 names the first slice, which is being built beside it.

## Context

[ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) made the home screen a day:
`sections` are the places as the day begins, `moments` are times of day, each carrying only
what changes, and rendering at a minute is a fold. It closed on this:

> **Whether a day is enough.** Everything here repeats every twenty-four hours. A weekend
> edition, a moment that fires once on an election night, a block that appears for three
> days: none of them is expressible and none of them has been asked for. The shape does not
> prevent one — a moment is a time and a set of changes, and a condition beside the time is
> an addition rather than a rewrite — and it is deliberately not built ahead of somebody
> wanting it.

Now it is wanted. The ask is to plan ahead: a campaign that lifts a block for three days, a
donation drive for a fortnight, an election night from 18:00, a weekend edition, and a way
to see a day, a week and a month at once.

Three things already in the repository decide part of the answer.

- **The repository is public.** A future-dated entry in the published document publishes
  the plan before it runs. [ADR 0058](0058-the-workbench-holds-no-power-and-github-is-who-you-are.md)
  §5 named exactly this as the material the private companion exists for, and §4 said its
  check arrives with the first thing that reads it.
- **The app folds on the device, at the minute**, and fetches the document at most every
  ten minutes, because the CDN keeps a copy for 600 seconds
  ([ADR 0057](0057-the-structure-comes-from-the-workbench-the-selection-from-wordpress.md)
  §4). A plan published only when it is due would start whenever the pipeline got round to
  it.
- **An older app must draw past what it does not know**
  ([ADR 0036](0036-the-home-screen-becomes-data.md) §7). Measured against
  `parseHomeLayout` in `packages/app-core/src/lib/home-layout.ts` on 2026-09-23: the top
  level reads `version`, `sections` and `moments` and nothing else, and a version it does
  not expect is reported and then read. A key beside them is never seen.

## Decision

### 1. The newsroom's unit is the edition

An **edition** (*Ausgabe*) is a named layer over the day: a weekend edition, an election
night, a campaign. It has a starting state of its own and moments of its own, exactly the
shape the day has, and it is active either **for a span** (from a date and time, until a
date and time) or **on weekdays**.

The unit is the point. The alternatives both lose to the fact that a newsroom plans in
editions: a date on each moment would make a three-day lift two dated moments that have to
agree, the second restating the day, and a campaign would show in the editor as two dots on
two days. A separate calendar page with a month grid is the generic answer and separates
planning from seeing, because nobody can look at the phone at Saturday 18:00 from a grid.

### 2. One axis, one playhead, and the playhead is an instant

The stage keeps the frame and the day's track under it
([ADR 0042](0042-the-timeline-belongs-to-the-stage.md)). **The playhead becomes an instant, a
date and a minute**, and the frame always shows the fold at that instant. The address carries
it as `tm=2026-09-27T18:00`; a bare `tm=18:30` keeps meaning today, so every link already
sent keeps working. "What will readers see on Saturday at 18:00" is then: step to Saturday,
put the playhead on 18:00, look at the phone, copy the link.

A day, a week and a month are **three zooms of that one axis**, not three views. At day zoom
the strip is the track as it is; further out the same axis shows days, with the editions as
bands. There is one playhead at every zoom.

**Each edition has a colour, derived from its id**, so the same campaign is the same colour on
every machine and in every screenshot in a pull request. Its stops on the track are drawn in
it, and a block in the panel whose state an edition decides carries a hairline at its edge in
that colour: a glance down the panel says what the campaign changed and where the ordinary
day shows through.

**An edit lands on the narrowest edition active at the playhead**, or on the day when none is,
which is [ADR 0039](0039-the-home-screen-is-a-day-not-a-timetable.md) §10 one level up.

### 3. The model: editions beside the day, in the grammar the day already has

```json
{
  "version": 3,
  "sections": [],
  "moments": [],
  "editions": [
    {
      "id": "wahlabend-2026",
      "title": "Wahlabend",
      "from": "2026-09-27T18:00",
      "until": "2026-09-28T02:00",
      "changes": [{ "id": "hero", "settings": { "pin": "…" } }],
      "moments": [{ "at": "23:00", "changes": [] }]
    },
    { "id": "wochenende", "days": ["sat", "sun"], "changes": [{ "id": "briefing", "hidden": true }] }
  ]
}
```

An edition's `changes` is its starting state, as `sections` is the day's, for the reason ADR
0039 §2 gives: a start living inside a moment could be moved or deleted. Its `moments` are
differences by time of day. `changes` is the type that exists: `hidden` and `settings`,
**never order**, because ADR 0039 §3 holds. A campaign that "moves" a block does it the way
the callout does, with two places and a switch, so the day carries the hidden places a
campaign may lift.

An edition needs one kind of condition. One with neither is the day and is refused; `from`
without `until` is refused, because an exception has to end; `until` is exclusive. What ADR
0039 §6 and §7 refuse is refused here the same way, dropping the smallest thing that carries
the rule and reporting it: a duplicate `at` inside one edition, a duplicate edition id, a
change naming a place that does not exist. `title` is the newsroom's word and data, not
source.

### 4. The fold at an instant, and the narrower window wins

At an instant, with `d` its date and `m` its minute: the sections as written, then the day's
moments at or before `m`, then every edition active at that instant **in precedence order**,
each applying its `changes` and then those of its own moments that lie inside its span and at
or before the instant. Later application wins, so an edition overrides the day where it speaks
and the day shows through where it does not. An edition's end needs no instruction: it simply
stops being in the fold.

**Precedence is the narrower window.** Weekday editions first, as the widest (fewer days
narrower, then by id); then dated editions from the longest span to the shortest, ties by the
later `from`, then by id. A one-off inside a fortnight's campaign beats the campaign, the
campaign beats the weekend edition, everything beats the day. **Overlaps are resolved, never
refused**, because a campaign inside a campaign is legitimate; the editor is the half that
shows the value an overlap shadowed.

`nextMomentAfter` becomes a question about the next change after an instant, counting
edition boundaries, so the host's one timer still wakes at the right minute.

### 5. The day is always a complete home screen on its own

Because an older app reads the day and never sees an edition (the measurement in the
context), **readers on an old app see the ordinary day during a campaign.** That is
acceptable only if the day is always a whole screen, so the editor never lets an edition
become load-bearing for it: a place that exists only to be lifted by a campaign is hidden in
the day, not absent from it.

### 6. The document speaks Berlin time, for everything

`at`, `from`, `until` and `days` are wall-clock time in `Europe/Berlin`. The fold takes an
instant and converts it once, and the core still holds no clock: the instant is a parameter,
as the minute is under ADR 0039 §8.

This **changes how the existing day is read.** `minuteOfDay` in
`packages/app-core/src/lib/home-layout.ts` reads the device's local day today, and no record
says so; the code does. A reader in New York on election night should see the switch at
Berlin 18:00, because the polls close in Berlin, and a second clock for the day would leave
an edition's own `at` ambiguous. So one rule for both, at the cost of a traveller's morning
arriving early. The DACH readership is one zone, the newsroom composes in its own clock, and a
screenshot taken on a CI runner in UTC stops being an hour off.

"At or before" makes the change of clocks harmless: a minute that does not exist on the
spring day is passed and applied at the next, one that occurs twice applies an idempotent
change twice. **Measured first**, before this is relied on: whether Hermes on Android gives a
Berlin wall clock through `Intl`. If not, the EU rule (the last Sundays of March and
October, at 01:00 UTC) is a few lines for one zone. There is no zone field in the document
until a second zone exists.

### 7. The plan is private, and what is public is a projection with a horizon

The full document with every edition is **the plan**, and it lives in
`correctiv/correctiv-app-private` as one file in the same grammar, edited in the same editor.
The open repository holds **the projection**: `packages/app-core/src/data/home.layout.json`,
exactly as ADR 0057 §4 has it.

A workflow in the open repository (the companion holds no code, ADR 0058 §5) runs hourly and on
a dispatch from a push to the plan. With a read-only key it reads the plan, keeps the day and
every weekday edition whole, keeps each dated edition whose `from` lies inside the
**horizon**, drops the rest, and commits to `main` only when the projection differs. Without
the key it publishes the file as it is checked in, so the open repository is complete on its
own (ADR 0058 §4), and the key's absence is the case its check proves.

The horizon is **the newsroom's number**, set at 36 hours to start. It has to exceed the
longest time two runs of a scheduled job can be late by. What is public when follows: the day
and the weekend edition always; a campaign from the horizon before its start, whole, its end
included; nothing beyond the horizon.

So **precision is the device's minute and not the pipeline's.** An edition is on every phone
hours before it starts and the fold fires it at 18:00. The pipeline's failure is a late
start, bounded by the horizon, never an early end and never an empty screen, which is why a
published edition's `until` is **not** clipped: clipping would make every running campaign's
continuation depend on a scheduled job staying alive.

**What stays exposed is content, and ADR 0057 already answers it.** The projection may say
that a block grows on Thursday morning; it must not say which investigation. An embargoed piece
is led by the rule reading the WordPress flag, set at publication, not by a pin written into
public JSON a day and a half early. The editor says so beside any pin set inside an edition.

### 8. The first slice: the day gets a date

One pull request on the existing editor, complete and useful on its own:

- **Core:** `editions` with `from` and `until` only, their `changes` and `moments`; the fold
  at an instant (§4) with its precedence; Berlin conversion (§6); the next change after an
  instant; `version` 3; a test that an older parse of a new document yields the day.
- **Host:** the clock passes an instant; `workbench:home-time` accepts a date and a time.
- **Workbench:** `tm=` grows a date; a date stepper beside the track's time; the editions
  active that day drawn on the track in their colour; **"Ausgabe hier"** at the playhead
  makes a one-day edition, with its start and end as two fields in its popover and a delete;
  edits land on the narrowest active edition; the colour hairline on blocks an edition
  decides. Submit changes works as it does.

With it the donation campaign and the election night can be scheduled, looked at at their
minute in the frame, and sent as a link. **Left out, deliberately:** the private pipeline of
§7, `days`, the strip and its zooms, a chip naming the layer being edited, conflict badges,
and audiences ([ADR 0041](0041-a-change-may-name-an-audience.md)). Until that pipeline exists an edition submitted is public when it is merged, so the submit steps say so:
submit an edition no earlier than it may be known.

### 9. What is not built, and why

- **A condition language.** An interpreter in the app and expressions nobody in the newsroom
  can test. A span and a weekday are the whole vocabulary.
- **Recurrence beyond weekdays.** "The first Monday" and "every third day" are RRULE, and
  RRULE is a program. What a weekday cannot say is a dated edition.
- **A day per date or per weekday.** Every ordinary edit made several times over, and the
  copy somebody forgot found by a reader.
- **A priority field.** A second way to say what the window already says; the two would part.
- **A job that switches things at 18:00, or a server.** The device folds; the pipeline bounds
  what is visible and nothing more.
- **Clipping `until` in the projection**, for the reason in §7.
- **Encrypting the plan into the open repository.** Ciphertext still gives away the timing and
  puts key handling into a static site.
- **A separate calendar page, a dashboard, colours chosen by hand, a reader's own time zone, a
  zone field, editing inside the frame** (the last refused by
  [ADR 0053](0053-the-editor-is-the-screen-and-the-drag-is-the-answer.md) on grounds that
  still hold).

## What this retires

**ADR 0039, "What is still open".** In "Whether a day is enough", "and none of them has been
asked for" and "and it is deliberately not built ahead of somebody wanting it" are struck. It
was asked for on 2026-09-23, and this record is the addition that paragraph foresaw. "None of
them is expressible" stays true until §8 is built, and is left standing.

No record states that the day is read in the device's local time, so §6 strikes nothing; the
comment on `minuteOfDay` changes with the code.

## What is still open

1. **Hermes and `Europe/Berlin`**, measured on an Android device before §6 is relied on.
2. **The horizon**, which is the newsroom's to set; 36 hours is where it starts.
3. **The strip and its zooms**, the layer chip and the conflict badges, after §8 has been used.
4. **The private pipeline of §7**, which is the companion's first consumer and brings ADR 0058
   §4's check with it.
