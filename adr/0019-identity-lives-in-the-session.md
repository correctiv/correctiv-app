# ADR 0019 — Identity lives in the session, the contribution in membership

Status: accepted, 2026-09-02. Follows [ADR 0018](0018-removing-the-guest.md), and like
it was found by looking at a screenshot rather than at the code.

## Context

[ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md) put the
session beside `membership` rather than inside it, and gave the reason: `session` is
what the membership system answered, `membership` is what the in-app join flow
simulates. That split is right, and this ADR does not undo it.

The boundary ran through the wrong two fields. `membership` also held `name` and
`isMember`, and behind the door both were dead:

- **`name`** could not win. The profile read `session.account?.name || membership.name`,
  and the left side is never empty: a signed-in status implies an account, and
  `nameFromEmail` falls back to "Mitglied". The `||` was there because both fields
  existed, not because either could be missing.
- **`isMember`** was true in exactly the states `memberSince !== null` is. Two stored
  answers to one question, which can disagree and cannot both be right.

The screenshot showed what the second copy cost. `screens/android/60-profil.webp`
printed "Ihr Beitrag: **10 € / Monat**" for an account that had never set one, because
that is the slice's initial value and the row rendered unconditionally. A trial paying
0 €, a Soli membership and a local-newsletter bundle all read the same invented
number, three lines above a sentence saying no join had happened.

A second defect came out of the same seam. `signOut` reset the session and left
`membership` on disk, so the next person to sign in on that device saw their own name
and tier over somebody else's contribution and join date.

## 1. Decision

**`membership` holds the simulated contribution and nothing about the person.**

- `name` and `isMember` are removed. ~~`MembershipState` is `memberSince`, `amountEur`,
  `interval`, `paused`.~~ The slice is gone entirely with
  [ADR 0020](0020-no-contribution-in-the-app.md), and `memberSince` sits on the
  entitlement.
- `hasSimulatedJoin(state)` replaces the flag as an exported selector, per the core's
  convention that derived values are selectors taking state.
- ~~`join(amountEur, interval)` no longer takes a name.~~ There is no join action;
  [ADR 0020](0020-no-contribution-in-the-app.md).
- The slice declares its own `PERSISTED_KEYS`, beside the state, the way `session`
  does. The host used to spell that list out; two styles for one thing is how a list
  drifts from the state it describes.
- ~~**`signOut` clears the contribution**, through an `extraReducer` rather than a
  binding, so a test that dispatches `signOut` directly is covered too.~~
- ~~The profile prints an amount only when somebody set one.~~ Both void with
  [ADR 0020](0020-no-contribution-in-the-app.md): there is no contribution on the
  device to clear or to print. The reasoning stands and is why that removal was one
  file rather than a redesign.

**And the join flow is written for the person who reaches it.** It is entered from
"Beitrag ändern" by somebody already inside, so the opening argument for joining and
the form asking for a name and an email are gone: the case has no audience, and
`session.account` already holds both fields the form asked for. It threw the email
away regardless. ~~Two steps remain, the amount and the confirmation.~~ None remain:
the flow itself left the app with [ADR 0020](0020-no-contribution-in-the-app.md).

## What this does not decide

~~Whether a contribution is set inside the app at all. ADR 0016 named it as a product and
app-store question and it is still open.~~ If the answer is no, this flow leaves and the
profile links out; nothing above depends on which way that goes. Answered by
[ADR 0020](0020-no-contribution-in-the-app.md): the answer was no, and it cost exactly
what that sentence predicted.

Nor does it move the contribution into `session`. That becomes right the moment the
contribution is a server answer rather than a local simulation, which is the C1
dependency in the scope. Until then it would break the one invariant `session` has.
Still true, and still not done: ADR 0020 deleted the contribution rather than moving
it. Only `memberSince` went onto the entitlement, and it went as an answer of the auth
seam rather than as something the app sets, which is the invariant this paragraph
protects.

## What this retires

- In [ADR 0018](0018-removing-the-guest.md): "`useIsMember` therefore stays as a
  binding, with a comment saying no screen reads it and none should read it as a gate
  again." The binding is gone with the field; `useHasSimulatedJoin` took its place.
- In [ADR 0018](0018-removing-the-guest.md): the decision table's silence about
  `apps/mobile/src/app/beitreten.tsx`, and the sentence "that copy is listed above as
  removed". Three lines in the join flow said the offer was free for everyone, they
  were not in the table, and they were still on screen. They are gone here.
- In [ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md):
  "A signed-in paying member still sees the guest card" was already struck by 0018;
  what remains struck here is the assumption behind it, that the two ideas of a member
  could sit side by side without one of them going wrong.
