# ADR 0079 — The app draws its tabs from the layout

Status: accepted, 2026-10-06, built. Carries out the open points 1 and 2 of
[ADR 0078](0078-layouts-ship-and-demo.md): the tab bar's rules, the empty state and a route
for any screen. The workbench's choice of layout and a whole layout as an override (points 3
and 4) are built by [ADR 0080](0080-the-workbench-chooses-a-layout.md).

## Context

ADR 0078 decided what the app draws for `n` entries and left it unbuilt, because the app
still drew five screens from five route files under `(tabs)/`, one native trigger each, and
read the navigation once per process. Three things in that arrangement could not carry the
table:

- **A route file per tab.** A document that deletes a screen cannot delete a file, so a
  removed screen left a trigger, and a screen the newsroom adds had no trigger at all.
  `NativeTabs` takes its triggers by route name and `Tabs` by screen name; neither takes the
  same dynamic route twice.
- **A bar fixed at the first call.** Native tabs remount, and lose every tab's state, when
  their triggers change (measured 2026-10-01), so the bar was decided once and a fetch applied
  at the next start. The workbench's frame therefore reloaded after every edit of the
  navigation.
- **Home as a special case.** The core knew `index` as the first tab and the app knew five names.

## 1. Every screen is `/s/<id>`, and the bar is the app's own

One route, `app/(tabs)/s/[id].tsx`, draws every screen, Home included, with the lines a
screen made yesterday is drawn with. A screen nothing carries is `+not-found`, and so is one
whose feature the build cannot reach, so a deleted screen leaves an address that leads
nowhere and no tab. `(tabs)/_layout.tsx` is a shell around a `Slot`: the bar, the rail from
`sizes.railBreakpoint` up and the mini player. `(tabs)/index.tsx` is the start, a redirect to
the first entry, or the empty state ("Bald verfügbar") when there is none.

The bar is drawn by the app on every platform, which is what the web always had, so
`_layout.web.tsx` and `railTabs.tsx` are gone. **This is the decision that costs**, and the
cost is listed below: the platform's tab bar needs a route file per tab, and a route file per
tab is what this record removes.

## 2. The first entry is the start, and the table is the core's

`parseNavigation` takes any well-formed screen id and no known set, and Home is an entry like
the others, first where it is written first. `arrangeTabBar` is ADR 0078 §5's table: no
entry is the empty state with no bar, one is the screen with no bar, two to `maxTabs` are all
tabs, more are `maxTabs - 1` and "Mehr". An entry that cannot be opened (no document carries
it, or its feature is off) is removed before anything is counted.

A screen the layout carries that the navigation does not list is behind "Mehr" too, and "Mehr"
then appears below `maxTabs`, as one of the tabs shown. That is how a screen is taken off the
bar without being lost. `TabBar` carries `kind`, `start`, `entries`, `tabs` and `more`. The
one thing it does not do is draw a bar for a navigation with no entry that can be opened, even
when screens are carried: there is no start, so there is the empty state.

`MIN_TABS` is `MIN_MAX_TABS`: it was the fewest tabs a bar shows and is now the fewest `maxTabs`
may allow, which is two because one tab and "Mehr" is the least that overflows.

## 3. The bar follows the documents

`useTabBarDecision` re-reads the bar when the workbench's navigation or a screen's override
changes (a `storage` event), when a fetch lands and when the reachable features change. The
frame no longer reloads after an edit of the navigation. The decision is a string snapshot so
that a store that notifies twice a second while audio plays does not redraw anything.

## 4. An id names a screen, whatever it is called

`customScreenIdFault` loses its `declared` fault and its second parameter: the grammar and the
reserved `navigation` are all there is. `isCustomScreenId` and `isScreenId` are the same
question. The workbench keeps `declared` as its own fault, because the tool always holds the
demo's five.

## What it costs

- **The platform's tab bar on iOS and Android**: the press feedback, the scroll-to-top on a
  second tap, the iOS 26 minimise-on-scroll, the growth with the system font and
  `NativeTabs.BottomAccessory` for the mini player. The mini player is the overlay the web and
  Android already had. iOS is unrun.
- **A tab keeps no state.** A tab press is a navigation to an address and the screen is drawn
  again, so its scroll position is not kept. The documents draw cheaply and a feed is the
  store's, but this is measured by nothing.
- **The 1.3 label threshold is carried over, not re-measured.** It was photographed on the
  platform's bar. The drawn bar lays five cells out the same way, so it is the best number
  there is, and `tab-bar-labels.test.ts` pins its inputs as it did.
- **A screen made yesterday had a back control** under the platform's header, because it was
  reached from "Mehr". It is a tab root now and has none, as the five always had none.

## What this retires

- ADR 0078's status line, §4's last sentence, §5's last sentence, the open points 1 and 2 and the
  consequence about the navigation editor, each struck where it stands.
- ADR 0013 §1's native tabs on the phone and its separate web layout, struck where they stand.
- ADR 0071 §4's "Home is always the first entry", and the two conditions in §6 that need a
  minimum of two tabs and a destination the app declares.
- ADR 0075 §5's "built once per start" sentence.

## What is not decided

1. ~~**A whole layout as the frame's layout** (ADR 0078 point 4). The frame is the app, which
   bundles `ship` and so draws the empty state until an override puts a screen and a navigation
   there; the navigation editor writes its override only when the navigation differs from
   `demo`'s, so an unedited workbench frame shows the empty state.~~ Built by
   [ADR 0080](0080-the-workbench-chooses-a-layout.md) §2.
2. ~~**Offering a custom screen to the navigation editor.** It offers the demo's five; the
   parser takes any id.~~ Built by [ADR 0080](0080-the-workbench-chooses-a-layout.md) §4.
3. **Whether the system's bar comes back** where the layout is fixed, which a native tab bar
   could do again if a document never changes at runtime.
