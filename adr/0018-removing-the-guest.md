# ADR 0018 — Removing the guest

Status: accepted, 2026-09-02. Follows directly from
[ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md) and was found
by looking at the screenshots that ADR produced, not by reading the code.

## Context

ADR 0016 put a door at the root: nobody renders a route without an entitlement that
includes the app. It deliberately stopped there, and left the 36 mentions of
`membership.isMember` in 13 files alone, on the grounds that the entitlement and the
club lever are two different things.

That was right for one commit and wrong to leave standing. The app then held two
incompatible ideas of who is reading it, and the emulator round after ADR 0016 shows
both on the same walk:

- `screens/android/00-gate.webp` says "Diese App ist der Ort für Mitglieder mit
  Beitrag." You cannot get past it without one.
- Two steps later the onboarding's last screen said "Der Club ist Nähe, keine Paywall"
  and offered "Unterstützer:in werden" beside **"Erstmal umsehen"**. Looking around
  was the thing that had just been paid for.
- `screens/android/60-profil.webp` greeted the account that had signed in with
  "**Sie sind als Gast unterwegs**".

The last one is not stale copy, it is wrong on its face, and the cause is structural
rather than editorial: the door reads `session.entitlement`, the profile read
`membership.isMember`, and the join flow that sets the second had not run.

## 1. Decision

**Remove the guest.** Every branch that rendered a second version of a screen for
someone who had not paid is deleted rather than reworded, because behind the door it
has no audience.

| Where | What went |
| --- | --- |
| `components/profile/ClubCard` | the guest card; the club card now names the tier and takes its name from the session |
| `app/(tabs)/profil` | every `isMember` conditional; membership, impact and the report are unconditional |
| `app/onboarding` | the fourth step, the club pitch, with "Unterstützer:in werden" and "Erstmal umsehen"; the walk ends on "Fertig" |
| `app/onboarding` | the mission line "Ohne Paywall: Journalismus für alle" |
| `components/home/EarlyAccessCard` | the guest copy, and with it the bug that Home never passed the flag, so members saw it |
| `components/home/ImpactFooter` | the join link and "Unser Journalismus bleibt frei, für alle" |
| `app/backstage` | the teaser line and "Mit dem Club jetzt lesen", which routed to the join flow instead of the article |
| `articles/reader-html` | the second footer with its `correctiv://join` button, and the now-unused `.support-btn` rule |
| `app/(tabs)/mediathek`, `app/serie/[id]` | the "Für alle hörbar" note |
| `screens/tools/tour-android.sh` | the step `04-onboarding-club` |

## What deliberately stays

- **Nothing inside the app is locked, and that rule is untouched.** The scope says so
  too: once past the door there are no further gates. So the "never a barrier"
  comments in the reader, the audio store and Backstage are *not* struck through, and
  neither is [ADR 0006](0006-one-core-two-hosts.md)'s passage stating the rule, nor
  ADR 0004's "the club is proximity, not a paywall". They describe the interior and
  the interior has not changed. What became false is narrower and is retired below: the
  copy that spoke about the *offer*, and ADR 0004's claim that an escape hatch sits
  beside every step. The door is at the entrance, not between the screens.
- **The club's vocabulary.** The yellow, the `CLUB` badge, the `club` button variant.
  They mark what the membership brings, and they never gated anything.
- **~~The `membership` slice and the join flow.~~** ~~The slice still holds the simulated
  contribution and still feeds "Beitrag ändern".~~ Whether a contribution is set inside
  the app at all is a product and app-store decision that is not this repo's to take;
  ~~ADR 0016 named it and it is still open.~~ Both are gone with
  [ADR 0020](0020-no-contribution-in-the-app.md): the requirements answered the
  question, and the slice went with the flow it existed for. ~~`useIsMember` therefore stays as a binding,
  with a comment saying no screen reads it and none should read it as a gate again.~~
  Retired by [ADR 0019](0019-identity-lives-in-the-session.md): the field it read was
  a second stored answer to a question `memberSince` already answered, so both the
  field and the binding went.

## What this retires

Two statements in [ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md),
struck through where they stand:

- "The copy that the door contradicts is left as it is." It is not; it is removed here.
  The list it introduces stays, as the record of what was found.
- "A signed-in paying member still sees the guest card on the profile until the club
  touchpoints migrate." They migrated here.

And one in [ADR 0004](0004-react-native-pivot.md), where the walk-through records
"No dark pattern, and that is tested. Until the final step, every 'Weiter' has an
equivalent 'Erstmal umsehen' beside it … Backstage is fully visible to guests." The
reasoning stays: an escape hatch beside every step is right when there is somewhere to
escape to. Behind the door there is not, so the hatch is gone and the test that pinned
it is inverted. Backstage is still fully visible, to everyone who is inside.

## Consequences

- The tests that pinned the guest states are inverted rather than deleted wherever a
  state remained to assert; where the guest and the member case had collapsed into the
  same render, the two were merged into one. "A document that offers someone what they already pay
  for" is a failure this shipped once, and an assertion is cheaper than remembering.
- The onboarding is three steps rather than four, so
  `screens/android/04-onboarding-club.webp` is removed and the tour taps "Fertig".
- The profile's impact line had to grow a second sentence: `memberSince` is stamped by
  the simulated join, and the section is now reachable by an account that never ran it.
- What is still inconsistent after this is upstream, not in the app: the door hands out
  an entitlement, and the contribution shown under "Ihr Beitrag" is still the simulated
  one rather than what the membership system knows. That closes with C1.
