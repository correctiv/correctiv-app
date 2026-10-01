# ADR 0070 — A left rail on tablet

Status: accepted, 2026-10-01.

## Context

ADR 0013 decided native tabs on iOS and Android: the tab bar is the one control
users have learned elsewhere, so it should be the system's. That decision was
made for the phone, where a bottom bar is the platform's own shape and the
reading column fills the width.

On a tablet the geometry changes. The reading column (`ContentColumn`, cap
620 px) is centred in the window, so at 834 px there is ~107 px of gutter on
each side. A bottom tab bar on a tablet is a phone layout stretched wide — it
does not use the space the window offers, and it fights the reading column's
centring with a full-width element that belongs to a narrower screen.

The web target already draws its own tab bar (`_layout.web.tsx`), and on a
wide window that bar is a bottom bar too. The tablet native layout should
match the web's behaviour at the same width, not the phone's.

## 1. Decision

**From 768 px upward, navigation is a side rail on the left edge.** The
breakpoint is a `sizes.*` token (`railBreakpoint: 768`) so phone, tablet and
web read the same number. Below it, the phone layout is unchanged: native
tabs on iOS and Android, the drawn bar on web.

The rail holds the five tab triggers and the mini player at its bottom. It
sits in the left gutter the centred reading column leaves. At 834 px the
gutter is 107 px (`columnGutter(834) = 24 + (834 − 48 − 620) / 2 = 107`), so
the rail is 88 px wide — it fits with 19 px to spare.

The five tab screens stay mounted the way `NativeTabs` mounts them today:
all five, eagerly. The rail drives which one is visible; the others are
hidden with `display: 'none'`. This is the same navigation model, only the
chrome moves.

## 2. What this retires

Two statements in ADR 0013 §1 are retired by this record:

1. **"Native tabs on iOS and Android"** — struck through where it stands, replaced
   with "On iOS and Android phones, tablets excepted". The argument that the tab bar
   is the one control users have learned elsewhere holds on the phone. On a tablet it
   does not: a left rail is the shape every tablet OS uses for navigation, and the
   system tab bar's press feedback and scroll-to-top are phone affordances. The trade
   accepted here is that on a tablet the app gives up the system tab bar in exchange
   for a layout that matches the reading column.

2. **"Web keeps the drawn tab bar, as its own layout — at every width"** — web keeps
   its drawn tab bar on phones, but from 768 px upward both layouts take the left rail.
   The project owner's decision names no platform exception, and the two layouts read
   the same `sizes.railBreakpoint` so they cannot disagree on when it triggers.

## 3. Consequences

**The rail is a custom component, not a platform one.** It is drawn with
Ionicons (the app's own icon vocabulary), not SF Symbols or Material Symbols.
This is a deliberate departure from ADR 0013's "each platform's own
vocabulary" for the tab triggers: on a tablet the rail is a layout element,
not a phone tab bar, and the app's icons are the consistent choice.

**The mini player moves into the rail's bottom.** On phone it overlays the
tab bar; on tablet it sits at the bottom of the rail, above the safe area.
Its component is unchanged.

**Fixed bars anchor to the screen bottom on tablet.** The form action
footer, the search bar and the mini player are positioned from the tab bar
height on phone. On tablet there is no bottom bar; they anchor to the screen
bottom instead. The measured Android bar height (80 dp) stays as it is for
phones.

**The web target shares the rail at tablet widths.** `_layout.web.tsx` keeps its
drawn bottom bar below 768 px; at and above the breakpoint both layouts delegate to
`TabletLayout`, so web and native render the same rail at the same width. The web
drawn bar is still the right answer for a narrow window; the two targets agree
because the project owner's decision is platform-agnostic and both read
`sizes.railBreakpoint`.

## What this has not delivered

**The rail has not been measured on a device.** The 88 px width is arithmetic
from the gutter, not a photograph. A tablet screenshot is the check that
sees whether the rail's targets are reachable and the mini player does not
clip.

**The eager-mount cost is unchanged.** Five screens mount at startup on
tablet as they do on phone. `useIsFocused()` remains the documented
mitigation if startup gets slower.
