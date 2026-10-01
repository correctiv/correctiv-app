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

The rail holds the five tab triggers and the mini player at its bottom. It is the
tab bar of a real navigator, not a layout drawn beside one: expo-router's JS `Tabs`
(`expo-router/js-tabs`) with `tabBarPosition: 'left'` and a custom `tabBar` that
renders `NavRail` (`lib/navigation/railTabs.tsx`). The navigator owns the five
screens, their history, the Android back button, web history and deep links; the
rail only reports a press, emitting `tabPress` and navigating the way react-navigation's
own bar does. The screens are laid out beside the rail's 88 px, so the reading
column centres in the space that is left and no width needs a special case.

Which tabs mount and when is the navigator's: JS `Tabs` mounts a screen the first
time it is focused (`lazy`, the default), where `NativeTabs` mounts all five. That
difference is real and is the one thing this trades away on tablet.

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

**No fixed bar needed changing.** An earlier draft of this record promised that the
form footer, the search bar and the mini player would re-anchor from the tab bar's
height on tablet. None of them is positioned from it: both navigators lay the screens
out above or beside their bar. The only bar-height arithmetic in the app is the
mini player's overlay on phones (`ANDROID_TAB_BAR_HEIGHT = 80` on Android, the drawn
bar's 56 on web), and on tablet that overlay is not rendered because the mini player
lives in the rail.

**The web target shares the rail at tablet widths, in one navigator.**
`_layout.web.tsx` has one JS `Tabs`; from `sizes.railBreakpoint` up it sets
`tabBar` and spreads `railScreenOptions` into `screenOptions`, so crossing 768 px changes options and
remounts no screen. `_layout.tsx` (native) returns `RailTabs` from the same width.
Both read the token, so they cannot disagree on when the rail appears.

## What this has not delivered

**The rail has not been measured on a device.** The 88 px width is arithmetic
from the gutter, not a photograph. A tablet screenshot is the check that
sees whether the rail's targets are reachable and the mini player does not
clip.

**Crossing 768 px on native still swaps the navigator.** Below it the layout is
`NativeTabs`, above it JS `Tabs`; they are different components, so a rotation or a
window resize across the breakpoint unmounts one and mounts the other, and the
screens' local state (scroll position, an open search) is lost. It is avoidable only
by giving up one side of the decision: JS `Tabs` on phones loses the system tab bar
ADR 0013 chose it for, and `NativeTabs` draws the system's bar, which has no prop that
puts our rail in its place. How often a tablet crosses 768 px has not been measured.
The web has no such swap.

**Not verified on a device:** the Android back button from a non-initial tab, a deep
link into a tab while the rail is showing, and a rotation across the breakpoint. The
tests cover the tree and the press-to-route wiring, not the platform's back stack.

**Tabs mount lazily on tablet.** JS `Tabs` mounts a screen on first focus, so
the eager mounting ADR 0013 accepted on phones does not apply here. It makes startup
cheaper, and a screen that must warm up before it is opened would need `lazy: false`.

## Addendum, 2026-10-01: labels and top spacing, a proposal

Device photographs of the rail (`screens/evidence/301-device-*.webp`) showed two things
this record did not decide: the five icons carried no visible label, and the first one sat
against the status bar. The rail now draws each label under its icon, with the phone bar's
copy, typeface and colours, and starts `spacingPx.s` below the top safe-area inset. No
decision above changes. **This is a design proposal pending the project owner's review**
and may be reverted or reshaped without a new record. The owner accepted it on 2026-10-01
as the rail's design to build on.
