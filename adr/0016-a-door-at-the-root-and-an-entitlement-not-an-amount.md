# ADR 0016 — A door at the root, and an entitlement rather than an amount

Status: accepted, 2026-09-02. Built against the July feature scope, whose premise
reverses the one this prototype was built on. The mechanics are decided here; the
wording CORRECTIV gives the reversal is not, see the last section.

## Context

The scope says: the app is only for members who pay more than 0 €; it is completely
blocked by a login screen; a member without the right membership is blocked and sent
to upgrade; the fee may be reduced to 0 € for a trial month; paying for a local
newsletter includes the app; and once inside, there are no further gates.

The prototype had none of that. There was no account and no token. `membership.isMember`
was a simulated club lever, flipped by a simulated payment and read at 36 sites so that
every club touchpoint reacts in the same tick. Six pieces of copy said outright that
nothing is behind a wall, and three code comments said the same as a rule. Every route
was a public address on the web export, `/backstage` and `/bericht` included.

The only place the whole route tree hangs on one condition is the root layout's
`storeReady` return. The onboarding redirect next to it is not that place: it is
latched once per mount, fires only from `/`, and blocks nothing, all of which is
tested and all of which is right for an onboarding.

## Decision

### 1. A render branch, not a redirect

The root layout renders either the navigator or `components/gate/LoginGate`. While the
session is not admitted, no route is mounted, so there is nothing to deep-link to,
share, or press back into. A redirect would leave every route reachable by address and
would have to be repeated on every screen. The onboarding jump stays a redirect, and it
waits for admission: it is the first thing behind the door, not something in front of
it, and the decision is taken at the moment the navigator mounts.

### 2. An entitlement, never an amount

The door reads `isAdmitted(session, now)`, which reads an `Entitlement`: the tier,
whether the app is included, why (`paid`, `local-bundle`, `trial`) and until when. All
of it is what the membership system answered; the app respects `appAccess` and does not
derive it. Two cases from the scope make an amount the wrong input. A trial pays 0 € for
a month and has the app. A local-newsletter subscription has the app without being an
app membership. Reading `membership.amountEur` would lock out exactly the people being
courted. `now` is a parameter of the selector, so a trial's end is a pure function and a
test can move the clock.

### 3. A `session` slice beside `membership`, not a field on it

`membership` stays the club lever inside the app, and the door must not depend on it:
signing in does not set `isMember`, and joining the simulated club does not open the
door. Persisted are the account and the entitlement; the status is derived from the
account on hydration, so a restart is either signed out or signed in, never mid-request.
The slice hydrates before the first render like everything else, for the same reason as
`onboardingDone`: hydrated late, a returning member sees the form for a frame.

### 4. Simulated, and said so on the screen

`services/auth.service.ts` is the seam to beabee. It answers from a directory of rules
the door prints: any address signs in, "frei" answers with the 0 € tier and no access,
"test" with a trial, "lokal" with the bundle, a password under four characters fails.
The rules exist so that every state of the door is reachable on a device without a
backend. There is no secure-storage port yet, because there is no token to store; a
simulated account is not a secret, and the port comes with the real login (C1 in the
scope plan).

### 5. Four states on one surface

Signed out is the form. Signing in is the form with the button replaced by "Wir prüfen
Ihre Mitgliedschaft …", so the wait explains itself and sets up the fourth state. Failed
is the form with the reason under it and both fields marked, because the answer does not
say which was wrong. Signed in without the app is not a form and not an error: it is
addressed to a member, thanks them, says what the 0 € membership does cover, shows the
entitlement as a tier and an access line, and offers the upgrade outside, a re-check,
and the form again for another account. The page surface rather than the mission
screen's red, because a form on red reads as an alarm and this is a front door.

### 6. Sign-out lives in Einstellungen

Under a "Konto" card, next to the demo reset, until the account area from the scope
exists. A door with no way back out cannot be checked on a device.

## Consequences

- `tour-android.sh` opens with `00-gate`, `00-gate-failed` and `00-gate-no-access`
  and signs in before `01-onboarding-welcome`, which keeps its name because the screen
  is unchanged. `tour-android-routes.sh` signs in when it finds the door, so it can
  still run alone.
- Every preview fixture except `fresh` carries a session. `signed-in` and `no-access`
  are new. The published demo opens on the door; any address signs in.
- `useIsAdmitted()` re-evaluates on every dispatch, so a trial ending while the app is
  open closes it on the next state change, not on a timer.
- ~~The copy that the door contradicts is left as it is.~~ Retired by
  [ADR 0018](0018-removing-the-guest.md), which removed it. How CORRECTIV tells the
  reversal is still an editorial decision, but the sentences that had become false
  did not wait for it. The list stands as the record of what was found:
  - `apps/mobile/src/app/onboarding.tsx`: "Ohne Paywall: Journalismus für alle" and
    "Der Club ist Nähe, keine Paywall"
  - `apps/mobile/src/app/beitreten.tsx`: "alle frei zugänglich", "0 Artikel hinter
    einer Paywall, heute und in Zukunft", "Unser Journalismus bleibt frei. Für alle."
  - `apps/mobile/src/components/home/ImpactFooter.tsx`: "Unser Journalismus bleibt
    frei, für alle."
  - `apps/mobile/src/components/profile/ClubCard.tsx`: "Sie sind als Gast unterwegs"
    and "Alles Wichtige bleibt frei zugänglich"
  - `apps/mobile/src/app/onboarding.tsx`: "Alles bleibt trotzdem zugänglich" under the
    interests
  - `apps/mobile/src/app/backstage.tsx` and `(tabs)/mediathek.tsx`: the guest branches
    ("Mit dem Club jetzt lesen", "Für alle hörbar") now address someone who has
    already been admitted as a paying member.
- The three "never a barrier" code comments (`articles/reader-html.ts`,
  `stores/audio.ts`, `app/backstage.tsx`) and the passages in ADR 0004 and ADR 0006
  are **not** struck through. They describe what is inside the app, and inside the
  app nothing is gated; what changed is who gets inside. They will need a clause
  saying so when the guest branches go, which is the migration the scope plan
  describes in its first section, not this decision.

## What this leaves open

- The wording of the reversal, ~~whether the join flow stays in the app or becomes a
  link out~~, and the store rules on external purchases. All three precede the final
  copy on this screen. The join flow left the app with
  [ADR 0020](0020-no-contribution-in-the-app.md); the store rules for the link that
  replaced it are still open, and that ADR narrows them to the link's wording and
  form.
- The secure-storage port and the `Authorization` header in `http.ts`, when there is
  a token. Until then the session is two JSON fields in the `KeyValueStore`.
- ~~`isMember` and the entitlement are two things. A signed-in paying member still
  sees the guest card on the profile until the club touchpoints migrate.~~ The first
  sentence still holds; the second was carried out by
  [ADR 0018](0018-removing-the-guest.md) rather than left standing, because the guest
  card greeted an account that had just signed in.
- The password-reset address. The door links the support page until the membership
  system names its own.
- The second access level, local areas, is carried in the entitlement ~~and read by
  nothing yet~~. The profile prints the areas since
  [ADR 0020](0020-no-contribution-in-the-app.md); nothing selects content by them, so
  the level itself is as open as it was.
