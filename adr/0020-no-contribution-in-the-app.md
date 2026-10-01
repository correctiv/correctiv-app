# ADR 0020 — No contribution in the app, and one link out

Status: accepted, 2026-09-03. Answers the question [ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md)
opened and [ADR 0019](0019-identity-lives-in-the-session.md) left standing. Half of it.
The other half is named at the end and is not ours to answer.

## Context

CORRECTIV's requirements were reformulated at the end of August 2026. One line in WP2
decides this:

> Die App bietet keine Zahlungsfunktionen und sollte als Reader-App oder Companion-App
> registriert werden, um die Zahlung von App-Store-Gebühren zu vermeiden.

Until now the app set a contribution. `apps/mobile/src/app/beitreten.tsx` offered six
amounts, monthly or yearly, with two perks lighting up above 15 € and 30 €. The profile
carried "Beitrag festlegen", "Beitrag ändern", "Pausieren" and "Fortsetzen", and
`stores/membership.ts` held `amountEur`, `interval` and `paused` behind them.

**None of that broke a store rule, and that is worth stating plainly, because the first
draft of this decision claimed it did.** Apple's 3.1.1 requires In-App Purchase for
unlocking features or content; a simulation unlocks nothing and charges nobody. The rule
that could have applied is a different one, the introduction to 3.1.3: outside the US
storefront an app may not, "within the app, encourage users to use a purchasing method
other than in-app purchase". The flow named amounts and pointed at no purchasing method,
in the app or outside it, so it encouraged none. What the flow was, is the wrong
template: it is the journey in the design workshop, the one the agency builds from, and
the one the web export publishes on every push to `main`.

Two further things were checked before this was written, because both had been asserted
without measurement:

| Claim | Verdict |
| --- | --- |
| "Naming prices and tiers in the app disqualifies it as a reader app" | **Not as stated.** 3.1.3(a) lets a reader app show content bought elsewhere and lets people manage an account inside the app, with no entitlement. The rules that bite are the introduction to 3.1.3, which forbids encouraging, within the app and outside the US storefront, any purchasing method other than IAP, and the External Link Account Entitlement, which forbids **price language in or beside the link** and prescribes the link's form. So the constraint lands on the wording and the form of the link out, not on the existence of a screen. |
| "Browser-based OIDC is what Apple and Google want at a login" | **Unsupported, and not this decision's business.** RFC 8252 is an IETF recommendation. Apple's 4.8 governs third-party logins and exempts an app's own account system. The sign-in shape is left to a later ADR. |

## Decision

### 1. The app sets no contribution

The profile reads what the membership system answered and offers one link out.

- `apps/mobile/src/app/beitreten.tsx` is deleted, with its route in
  `apps/mobile/src/app/_layout.tsx`, `tools/preview/src/routes.ts` and the
  `70-join-1` step in `screens/tools/tour-android-routes.sh`.
- **`packages/app-core/src/stores/membership.ts` is deleted entirely.** With the
  contribution gone, `memberSince` was its last field, and a slice with one field and
  no writer is the defect this repo already had one of: `entitlement.localAreas`, set
  by the simulation and, until the card below printed it, read by nothing.
- `memberSince` moves onto `Entitlement`, where the rest of the membership system's
  answer already lives. ADR 0019 refused to move the contribution into `session` and
  named the condition: "the moment the contribution is a server answer rather than a
  local simulation", the C1 dependency. That condition is not met, beabee has answered
  nothing yet, and this decision does not claim otherwise. What it relies on is the
  invariant behind the condition, that `session` holds only what came through the auth
  seam, and a join date keeps it: `services/auth.service.ts` answers it beside the
  tier, and nothing in the app sets it. The contribution itself is not moved anywhere;
  it is deleted. Until beabee answers, the date is `SIMULATED_MEMBER_SINCE`, fixed
  rather than read off the clock, because `refreshEntitlement` can build an
  entitlement twice and a date from `now` would make the membership younger while the
  app was open. The field is nullable, because every entitlement a device persisted
  before it existed hydrates without it and is kept until the next sign-in; the
  profile prints the tier alone in that case.
- The profile's membership card becomes four read-only rows, the tier always and three
  when the entitlement carries them: why the app is open, an end date for a trial, the
  local newsletters. Below them one button, **"Konto verwalten"**, opening the system
  browser.

### 2. The label is the part with a rule behind it

Outside the US, a link from the app to CORRECTIV's own site needs the External Link
Account Entitlement. Its conditions, read off Apple's page on 2026-09-03 rather than
from memory, because the first version of this section listed five and there are more:
content is the app's primary functionality; the app offers no In-App Purchase beside
the link; the link opens the default browser and never a webview; it carries no URL
parameters and goes to the site directly, with no redirect or landing page; it is
declared statically in `Info.plist` and resubmitted when it changes; it appears once
per page, with the same message each time; **it does not name a price**, and Apple's
own permitted example is "go to example.com to create or manage your account"; **it is
formatted like a standard HTML link, blue underlined text, and contains the domain
name**; and every tap first shows Apple's interstitial sheet, the External Link Account
API on iOS 16 and later. Inside the app, account management needs no entitlement at
all, per 3.1.3(a).

So the label says "Konto verwalten" and never "Beitrag erhöhen", and the line under it
names what lives on the other side without pricing it. The label is the half this
decision settles. The form is not: a secondary **button** is not "a standard HTML link
that contains the domain name", and the interstitial sheet does not exist. Both wait
with the address, below, because what gets declared in `Info.plist` and shown behind
the sheet is a link into beabee's account page, and there is no such page to declare.
`ACCOUNT_URL` in
`apps/mobile/src/app/(tabs)/profil.tsx` is a constant of its own, separate from the
door's `LINKS.upgrade`, because the door addresses somebody with no access and the
profile addresses a member: same address today, different rules, and they must be able
to move apart.

## What this does not decide

- **Where the link goes.** beabee will own the account page and does not have one yet,
  so the constant points at `correctiv.org/unterstuetzen/`, which is a donation page
  and therefore exactly the wording risk above. The requirements themselves leave this
  open, twice: "link to beabee in external browser? need to clarify with app store
  settings". Google Play asks the same question from the other side: its Payments
  policy forbids in-app links, buttons and sign-up flows that lead to another payment
  method, and allows a link to an account page only as long as that page does not
  eventually lead to one. A donation page does. In the EEA the alternative is the
  external offers programme, which costs the app Google Play Billing entirely and
  wants a notice before every link out. With the address goes the form of the link,
  above: a text link naming the domain, behind Apple's sheet, once there is an address
  that can be declared.
- **The door's own three labels**, which this decision deliberately did not touch:
  "Mitgliedschaft erweitern", "Beitrag festlegen" (a lapsed trial) and "Mitglied mit
  Beitrag werden", all in `apps/mobile/src/components/gate/LoginGate.tsx`. They point
  at the same page as "Konto verwalten" and they are the riskier wording under the
  same rule, because they direct somebody towards a purchase rather than towards an
  account. They are also the copy of the screen this repo argued over most recently
  ([ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md)), the
  audience is somebody the app does not work for at all, and rewriting user-facing
  German here is a decision for KomFun. Named rather than quietly left: after this
  ADR the profile and the door say different things about the same link, and that is
  a state to resolve, not to keep.
- **Whether the app is a reader app at all.** 3.1.3(a) wants content as the primary
  functionality. This app also has Mitmachen, a CrowdNewsroom, events and, later,
  quizzes. Apple's counter-example is a social network with video. That is a review
  outcome, not a repo decision.
- Apple's reader-app page announces a change for the EU from 2026-10-01, four weeks
  after this: reader apps there may promote out-of-app offers without an actionable
  link, on a page separate from the account link, under the External Purchases or
  Offers Entitlement and the new EU business terms. It changes what may be promoted,
  not the account link's rules above. Whoever finalises the journey should read it
  then.

## What this retires

- In [ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md), under
  "What this leaves open": "whether the join flow stays in the app or becomes a link
  out". Struck there, with a pointer here. The clause beside it, "and the store rules
  on external purchases", stays open and is narrowed above.
- In [ADR 0019](0019-identity-lives-in-the-session.md), under "What this does not
  decide": the first paragraph's claim that the question is still open. The second
  paragraph is **not** struck. It names the condition under which the contribution
  could move into `session`, that condition is still not met, and this decision moved
  no contribution anywhere; a clause beside it says what happened instead.
- In [ADR 0018](0018-removing-the-guest.md), under what the decision did NOT touch:
  "The `membership` slice and the join flow", with the two sentences saying the slice
  still holds the contribution and the question is still open. All three are false
  now; the sentence between them, that the decision is not this repo's to take, was
  true and stays.
- In [ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md), under
  what it leaves open: that the local areas are "read by nothing yet". The profile
  prints them since this decision; nothing selects content by them, so the second
  access level stays as open as it was.
- In [ADR 0012](0012-a-list-virtualizer-for-the-unbounded-lists.md): `beitreten` in
  the table of mapped lists. The screen is gone; the count it contributed to and the
  conclusion drawn from it are unchanged.
- In [ADR 0019](0019-identity-lives-in-the-session.md): "`MembershipState` is
  `memberSince`, `amountEur`, `interval`, `paused`", "`join(amountEur, interval)` no
  longer takes a name", "The profile prints an amount only when somebody set one", the
  `signOut` extraReducer and "Two steps remain, the amount and the confirmation". All
  describe a slice and a screen that no longer exist. The reasoning around them is
  untouched, because it is why this decision could be taken cleanly: the contribution
  had already been cut away from identity, so removing it moved one file and no
  concepts.
