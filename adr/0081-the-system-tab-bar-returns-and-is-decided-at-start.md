# ADR 0081 — The system tab bar returns, and is decided at start

Status: accepted, 2026-10-06, built, unrun on a device. Takes back the cost
[ADR 0079](0079-the-app-draws-its-tabs-from-the-layout.md) §1 named for iOS and Android and
answers its open point 3. The web and the workbench's frame keep the bar 0079 built.

## Context

0079 drew the bar itself on every platform, because the platform's bar takes its triggers by
route name, a dynamic route `/s/<id>` cannot be a trigger twice, and the bar remounts and loses
every tab's state when its triggers change (measured 2026-10-01). The price was the press
feedback, the scroll-to-top on a second tap, the iOS 26 minimise-on-scroll, the growth with the
system font, `NativeTabs.BottomAccessory` for the mini player and a tab's scroll position.

Those are what a person already knows from the rest of their phone, and the navigation they
cost is one that changes rarely: a newsroom edits it, a fetch lands, and nothing about a
reading session needs it to move under the reader's thumb. A change that waits for the next
start is a small restriction against five things lost on every start.

## 1. The store apps decide the bar once, at start

On iOS and Android the tab bar is `NativeTabs` again, and the arrangement 0078 §5 and 0079 §2
describe is read **once per process**, from the layout that is known when the tabs first render:
the bundled `ship` or the last copy fetched, which the shell has put back in the store by then.
A navigation fetched afterwards applies at the next start. `startDecision()` is that one reading;
`useTabBarDecision()` stays the live one the web's bar follows.

The rules do not change: no screen is the empty state, one is that screen without a bar, two to
`maxTabs` are all tabs, more are `maxTabs - 1` and "Mehr", the order decides, and what the
navigation does not list is behind "Mehr" too.

## 2. A trigger is a slot, not a screen

Route names are fixed at build time, so the bar declares **slots**: `index`, `slot-2` to
`slot-5` under `(tabs)`, each drawing the screen of the n-th tab of the start's bar, and `mehr`.
Only the occupied slots are declared, so a layout with three tabs has three triggers. The first
slot is `index` so that `/` is the first tab and no hidden route has to stand in front of it.
`tabSlots`, `slotScreen` and `slotRoute` in the core are the whole of this and hold its tests,
free of any native runtime; `SlotScreen` draws, and `ScreenView` is the body `/s/<id>` shares
with it.

`/s/<id>` stays for the web, as `(tabs)/s/[id].web.tsx` inside the drawn shell. On a phone the
system's bar owns everything under `(tabs)` and a hidden trigger "cannot be navigated to in any
way" (expo-router's own note), so a screen opened by id is `/screen/<id>`, a route of the root
stack (`screenHref` picks the address by platform, `app/+native-intent.tsx` rewrites an outside
`/s/<id>` to it): an id that is on the bar redirects to its slot, any other screen (behind
"Mehr", a link, a deep link) is **pushed over the tabs** with the platform's back control, as
before 0079, and one nothing carries is `+not-found`. `(tabs)/s/[id].tsx` and
`screen/[id].web.tsx` exist only because the router wants a base file for every platform file.

Alternatives looked at, both worse: a trigger per screen id needs the ids at build time, which
is what 0075 took away; and one trigger whose route draws a changing list is a bar with one tab.
`NativeTabs` in expo-router 57 has no API for a trigger by pattern, so the slot is the smallest
thing that gives a document its tabs.

## 3. The platform decides the bar, by file

`_layout.tsx` is the system's bar and `_layout.web.tsx` the drawn one, the pairing the project
had before 0079 and `web-target.test.ts` holds it to; `index` and `s/[id]` are paired the same way; the slot files have no web sibling and
draw not-found there. The workbench's
frame is the web build, so it stays live: an edit of the navigation reaches it at once, which is
what the tool needs and what a phone does not.

The mini player is `NativeTabs.BottomAccessory` on iOS and the overlay above the bar's measured
80dp on Android, as before 0079. The 1.3 label threshold is read from `BottomTabBar.tsx`, one
number for both bars, and `tab-bar-labels.test.ts` pins it as it did.

## What it costs

- **A navigation fetched after the start waits for the next one.** That is the restriction the
  decision is made with, and the workbench's frame does not have it.
- **No rail on a wide window on iOS and Android.** The drawn shell has one; the system's bar
  does not and the rail was not carried over. iPadOS draws its own adaptive bar.
- **A screen behind "Mehr" is pushed, not a tab**, so it has a back control and no bar state of
  its own, as before 0079.
- **A screen's content is live and its place is not**: a screen deleted by a fetch leaves its
  slot on `+not-found` until the next start, and a screen added waits for it.
- **Unrun.** Nothing here ran on iOS or Android; the logic is tested and the native bundle
  builds, the bar itself is not seen.

## What this changes

- ADR 0079 §1's "bar is drawn by the app on every platform" holds for the web; its first cost
  is taken back on iOS and Android, and its open point 3 is answered here.
- ADR 0013 §1's native tabs on the phone stand again, with slots for routes.
