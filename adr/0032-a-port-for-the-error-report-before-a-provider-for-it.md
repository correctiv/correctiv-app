# ADR 0032 — A port for the error report, before a provider for it

Status: accepted, 2026-09-16, and carried out the same day. It was written as a
proposal and accepted as written. This records the shape so that choosing a provider
later is a wiring change rather than a rebuild, and so that the decision is argued once
instead of at the moment somebody is under pressure to ship reporting.

Everything under "What this deliberately does not decide" is still not decided, and
that is the half that keeps [#95](https://github.com/faktenforum/correctiv-app/issues/95)
open.

## Context

[Issue #95](https://github.com/faktenforum/correctiv-app/issues/95) asks for an
error-reporting provider and has been open since the error boundary landed.
`apps/mobile/src/app/_layout.tsx` carries the seam already, in a comment that says
what it is:

> THE PLACE AN ERROR REPORT LEAVES THE APP. Issue #95 replaces this one line with the
> call to whichever crash reporter is chosen; no provider is picked yet, so for now it
> goes to the log and nowhere else.

That comment is right about the seam and wrong about the sequence. It reads as though
nothing can be built until a provider is chosen. The opposite is true: **the provider
is the cheap half, and it is the half that needs a decision nobody has made.** What is
expensive is the shape underneath — where an error is reported from, what it carries,
and whether the core is allowed to report at all — and none of that depends on which
service receives it.

Two things happened on 2026-09-15 and 2026-09-16 that make the shape decidable now.

**The state stopped carrying sentences.** `stores/audio.ts` used to dispatch
`failed('Wiedergabe unterbrochen. Prüfen Sie Ihre Internetverbindung …')`. It now
carries `AudioError`, a closed union of three codes, with the wording beside it in
`AUDIO_ERROR_LABELS`. That arrived through the localisation work rather than through
any error plan, and it is the same shape `LoginGate.tsx` already had for
`SignInFailure`. Two instances is a convention.

**The core learned to hand words out without owning them.** `coreMessage()`,
`salon5RadioCopy` and `RATING_LABELS` are all the same move: the core knows *what*
happened, the host decides *how it reads*. An error report is that move again, pointed
at a machine instead of at a person.

## Decision

### 1. A fifth port, with a no-op default

`ErrorReporter` joins `KeyValueStore`, `BlobStore`, `ContentBundle` and `AudioBackend`
in `packages/app-core/src/ports/index.ts`, and inherits that file's rule: *each port
has a session-only or empty default, so an unconfigured core degrades instead of
throwing.*

This is the part that matters and the part that is nearly free. It means:

- `packages/app-core/test/boundary.test.ts` covers it, so nothing can reach for a
  reporting SDK from inside the core by accident. That test was made strict on
  2026-09-15 and now catches `require`, bare side-effect imports and scoped packages.
- The host wires it in `configurePlatform`, one line beside the four that are there.
- Choosing a provider later touches **one file**, `apps/mobile/src/lib/platform/expo.ts`,
  and nothing else.
- Tests and scripts get the empty default and report nowhere, which is what they want.

### 2. What a report carries: a code, not a sentence

The same argument as `AudioError`, for the same reasons:

- It is the smallest thing that is *true*. The player knows what failed, not what to
  say about it. A screen, a log line and a crash report each want a different
  rendering of one fact, and a sentence has already chosen one of them.
- A closed union makes `Record<Code, …>` fail to compile when a new code arrives with
  no wording, which is a compiler error instead of an empty string on a screen.
- It survives translation, because it is not language.

A report is therefore a code, a domain, and whatever context the caller can add
without inventing it. Not a rendered message, and not a stack trace fished out of a
`catch` and stringified.

### 3. Where reporting is allowed to happen

Two places, and it is worth naming them so a third does not appear quietly:

**The error boundary**, which is the only place that sees a render fault, and which
already exists. It is the host's.

**The core, through the port**, for the faults a host cannot see — a feed that failed
in a way the screen swallowed, a cache write that was refused, a bundle that parsed
half. Those are the ones nobody hears about today, and they are the reason the port
belongs in the core rather than staying a host-side call.

Not from a screen. A screen that catches something and reports it is a screen that has
decided the fault is worth a stranger's attention, which is a decision the core is
better placed to make and a habit that grows quietly.

## What this deliberately does not decide

**Which provider.** Sentry, Bugsnag, a self-hosted GlitchTip, a POST to CORRECTIV's
own endpoint: all of them satisfy this interface, and the choice turns on data
protection and on who runs the thing, neither of which is a software question. #95
stays open and keeps that question.

**What is reported in production.** Today the seam logs and nothing else, and
`Localisation.tsx` made the same call in the other direction: throw in development,
stay silent in production, because a release build has no console and no sink, so a
log there is not a quieter report — it is no report. That reasoning applies here and
should be re-made, not inherited, once there is somewhere for a report to go.

**Retry, backoff, batching, offline queueing.** All of it is policy about a service
that does not exist yet. Building it now would be guessing at the failure modes of a
system nobody has run.

**Whether a user is told.** Reporting and telling are different features. The recovery
screen already tells, in German, and says what it depends on; nothing here changes it.

## The reason to do the shape now and not later

A port is thirty lines and an argument. The argument is the expensive half and it is
cheapest today, while the two conventions it rests on — a code in the state, words
handed in by the host — are fresh and have exactly two instances each. In six months
they will have twenty instances and one of them will have drifted, and the port will
be built to match whichever one somebody read first.

## What it retires

**Two counts in [ADR 0006](0006-one-core-two-hosts.md)**, which says "four ports" in its
superseded-in-part note and again over the port table. Both are struck there. The
argument that section makes — what a port is, and why the core declares one instead of
widening an allow-list — is untouched; only the number moved.

Six more places said "four" outside the records and are corrected rather than struck,
because prose in a living document gets corrected: `README.md`, `ARCHITECTURE.md`'s
heading, `apps/handbook/plugin/registry.ts`, `apps/handbook/src/pages/Landing.tsx`, a
comment in `Document.tsx`, and a pointer in `apps/mobile/__tests__/web-target.test.ts`.
`apps/handbook/test/diagrams.test.ts` derives the number from `CorePlatform` now, so the
next port does not need this paragraph.

The comment at `apps/mobile/src/app/_layout.tsx` about issue #95 stays
true about the seam; if this is accepted, the sentence "no provider is picked yet, so
for now it goes to the log and nowhere else" becomes the host's implementation of this
port rather than a placeholder, and the comment should say so.
