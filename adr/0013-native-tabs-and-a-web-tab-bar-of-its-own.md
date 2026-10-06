# ADR 0013 — Native tabs on the phone, and a web tab bar of its own

Status: accepted, 2026-08-28. Verified on an Android emulator 2026-08-29, which found
two faults in the first version of it; iOS remains unrun. See the last two sections.
§1 amended by [ADR 0070](0070-a-left-rail-on-tablet.md): native tabs are the phone
answer; tablets take a left rail. ~~Native tabs are the phone answer.~~ Voided by
[ADR 0079](0079-the-app-draws-its-tabs-from-the-layout.md): every platform draws the app's own
bar, because a tab is an address and the platform's bar needs a route file per tab.

## Context

The tab bar was ours: `Tabs` from `expo-router`, styled to the design draft down to
the hairline and the 11px label, with the mini player overlaid on top of it at a
height both sides read from one constant. It looked right in every screenshot in
`screens/`.

The argument against it is not that it looked wrong. It is that the tab bar is the
one control in this app a user has already learned somewhere else. A drawn bar
imitates the system's appearance and then stops: no scroll-to-top on a second tap,
no iOS 26 minimise-on-scroll, no growing with the system font size, and press
feedback that is ours rather than the platform's. Every one of those is something a
user knows without being told, and none of them survives being redrawn.

Two things made this the moment. `Tabs` from `expo-router` is **deprecated** in SDK
56 (`@deprecated Use 'expo-router/js-tabs' instead`), so the old import was on a path
Expo is moving off regardless. And `NativeTabs.BottomAccessory` exists in the
installed version — the system slot for the bar Apple Music puts a track in, which is
the mini player's problem solved by the platform instead of by us.

## 1. Decision

**~~Native tabs on iOS and Android.~~ On iOS and Android phones, tablets excepted — [ADR 0070](0070-a-left-rail-on-tablet.md).** `expo-router/unstable-native-tabs`, with the
colours still from the token palette so the bar follows the appearance setting.
Only its shape is the platform's.

**Icons in each platform's own vocabulary**, not one set stretched over both: SF
Symbols on iOS, Material Symbols on Android, each with a filled selected variant.
Ionicons stays what the rest of the app draws with. The tab bar is the part users
read as belonging to their phone rather than to us, and it is the only part that
defers.

~~**Web keeps the drawn tab bar, as its own layout — `_layout.web.tsx`, holding what
`_layout.tsx` held before.~~ At phone widths web keeps its drawn tab bar, its own layout
— `_layout.web.tsx`, holding what `_layout.tsx` held before; from 768 px upward both
targets take the left rail — [ADR 0070](0070-a-left-rail-on-tablet.md). This is the
part worth being explicit about: expo-router's
web implementation of native tabs is 74 lines that render labels and **no icons**.
Sharing one layout would have meant the web inheriting a worse tab bar so that the
code could be the same. Web is published on every push to `main` and is how most
people will ever see this app, so it is a target in its own right, and the right
answer there is the drawn bar rather than a borrowed one it cannot borrow — below the breakpoint.

The pattern is the repo's existing one (`ReaderView.web.tsx`, `VideoFrame.web.tsx`,
`shareArticle.web.ts`), applied for the first time to a route rather than a
component.

## The mini player, three platforms, three answers

This is the part that changed most, and it is a good illustration of the rule above.

**iOS: `NativeTabs.BottomAccessory`.** The system's own slot. It handles the tab
bar's height and its translucency, and on iOS 26 it knows `regular` and `inline`
placement without being told any of it.

**Android: the overlay, kept.** `NativeTabsView.android.js` reads no accessory —
there is no counterpart. Drawing your own bar above the navigation bar is what
Android media apps do, so the overlay is the Android answer rather than a fallback
from the iOS one.

**Web: unchanged**, because the drawn bar is still there and its height is still
ours.

## Consequences

**The Android height constant changed meaning, and had to be measured.** It used to be
a value we SET — the drawn bar took `height: 56 + insets.bottom` from it, so the bar
and the mini player could not disagree. A native bar sizes itself, and native tabs
expose no height: `useBottomTabBarHeight` belongs to the JS tabs only, and the
documentation says plainly that layout information is unavailable.

Carrying the 56 across looked free and was not. Material 3's navigation bar is
**80dp**; 56 is the Material 2 figure, and the mini player sat 11px inside the bar
with the selected item's pill clipped underneath it. It is 80 now, measured at
y=2126..2337 on `Medium_Phone_API_36` at 420dpi — 211px, so 80.4dp — which agrees
with the Material spec rather than merely with one device.

Two things still move it and neither is reachable from JS: a large system font scale,
and `labelVisibilityMode`. Under Material's `auto` the same bar measured 60dp, because
dropping the labels makes it shorter.

**All five tabs now mount eagerly.** Native tabs do not support lazy loading. The JS
tabs mounted a tab on first visit; five screens now mount at startup, including the
feeds each one kicks off. The documented mitigation is `useIsFocused()` to defer the
contents, which is not done here and is the first thing to reach for if startup gets
slower. Measuring that needs a device.

**Five tabs is now a ceiling, not a choice.** Android's Material tabs cap at five and
the app has exactly five. A sixth is a redesign, not an edit. The triggers are
written out rather than mapped so that this is visible where someone would add one.

**~~Every destination keeps its label, which took saying so.~~** True up to a system
font scale of 1.3 and false above it, where only the selected tab is labelled and the
other four are glyphs: voided by
[ADR 0034](0034-one-component-for-the-two-sided-row.md), which measured the scale at
which five German labels stop fitting. The argument below is untouched, because
Material's `auto` drops labels by tab COUNT at every size and is still the wrong
answer.

Material's default `auto`
drops the labels of unselected items once there are four or more — with five tabs that
left four of five destinations as an icon and nothing else, and `Entdecken` (a compass)
and `Mitmachen` (three figures) are the two nobody can name from the glyph.
`labelVisibilityMode="labeled"` is one of Material's own four modes and what Material
3's navigation-bar guidance asks for; `auto`'s behaviour is the Material 2 rule it
inherited. So this is still the platform's bar, configured — the same line this ADR
draws for colour. It also keeps the two tab bars legible in the same way, which is
worth something when they are meant to be one product.

**The API is alpha.** `unstable-native-tabs` is the real import path, and Expo says
the API is subject to change. The web half of this decision is insulated from that;
the native half is not.

**`FlatList` inside a tab screen loses scroll-to-top and minimise-on-scroll.** No tab
screen is a `FlatList` today — [ADR 0012](0012-a-list-virtualizer-for-the-unbounded-lists.md)
converted two pushed routes, not tab roots — so this costs nothing yet. It is a
constraint on where the next virtualized list may go.

## What the emulator round found

This decision shipped its first version with a warning that none of the native half
had been run, and that the Android mini player position should be treated as
unverified. Both faults it then found were in exactly that half, and neither was
visible to `npm run check`, to the typechecker, or to the web export:

- **The mini player sat inside the tab bar**, clipping the selected item's pill,
  because 56 was Material 2's height and the bar is 80dp.
- **Four of five destinations had no label**, because Material's `auto` drops them
  past three items.

Both are fixed above. The point worth keeping is that the warning was right and
specific, and the thing that cashed it was one screenshot of a playing track. This is
what [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) means by a green check not being
evidence, and it is the same shape as every other entry in
[`screens/`](../screens/README.md): the finding survived a green build, a green
typecheck and a green test run.

The set in [`screens/android/`](../screens/) was re-shot from a release APK afterwards,
and [`screens/web/`](../screens/web/) holds the five tab screens beside it, so the one
part of the app this ADR deliberately makes different on the two platforms can be
compared by looking.

## What this has not delivered

**iOS has never been built at all**, which is not new (see the README's status note)
but matters more here than usual: `BottomAccessory` is the one piece of this decision
that exists ONLY on the platform nobody has run. Android's fault was found in ten
minutes on an emulator; iOS's equivalent, if there is one, is still sitting there. The
SF Symbol names are typechecked against `sf-symbols-typescript` and that is the whole
of the assurance.

**The eager-mount cost is unmeasured.** Five screens now mount at startup rather than
on first visit, and the emulator round did not time it — it was looking at the tab
bar. `useIsFocused()` is the documented mitigation if it turns out to matter.
