// The desktop tab layout.
//
// Three layouts now exist for these five routes, and ADR 0013 is the reason that is
// correct rather than duplicated: the tab bar is the one control a user has already
// learned somewhere else, so each platform should present it in its own idiom rather
// than have one drawing stretched over all three.
//
//   `_layout.tsx`     native tabs (iOS/Android) — the system's bar
//   `_layout.web.tsx` the drawn bar — because the web has no system bar to borrow
//   this file         `Adw.ViewStack` + `Adw.ViewSwitcher`/`Adw.ViewSwitcherBar`
//
// A WIDE window has no bottom tab bar, and drawing one would be the exact mistake
// ADR 0013 argues against. `Adw.ViewSwitcher` is the GNOME counterpart: it sits in
// the header bar where the window title would be, which is Adwaita's own placement,
// and it is driven by the view stack's own page model — so a route file adds a button
// with no tab-bar bookkeeping.
//
// A NARROW window is a different platform, and the same idiom says so. Below the width
// where the switcher fits, Adwaita moves it into an `Adw.ViewSwitcherBar` at the
// bottom of the window, which is what every adaptive GNOME application does and what a
// Linux phone running this exact binary needs — the same codebase, so the desktop's
// narrow layout IS the phone's. The router does that itself now; this file only
// declares the tabs. Above the threshold nothing changed.
//
// ## The mini player, which used to be the thing this file could not have
//
// ~~NO MINI PLAYER. It cannot simply be wrapped around `<Tabs>`: the switcher is
// created with `slot="title"`, which resolves against the PARENT, so putting a
// `Gtk.Box` between this layout and the header bar takes the switcher's slot away and
// the router refuses it by name.~~ Both halves of that were true, and the second one is
// why the answer had to come from the router rather than from here: gjsify#1617 added
// `<Tabs bottomBar>`, so `Adw.ToolbarView` now carries the strip and the view switcher
// bar together — the strip first, which measured is the one closer to the content.
//
// `media/mini-player.tsx` is that strip, and it is Adwaita widgets rather than the
// phone's `View`/`Pressable` composition redrawn: `.toolbar`, `.circular
// suggested-action`, `.heading`, `.caption dim-label`, and symbolic icons from the
// theme. The STATE is the core's audio slice, shared with the phone; only the drawing
// is native. It returns `null` with nothing playing, and an empty bottom bar measures
// zero pixels high, so the strip is genuinely absent rather than collapsed.
//
// IT IS IN BOTH LAYOUTS, wide and narrow, which the earlier note said a strip should
// not be. That note was about a strip appearing with the window WIDTH — this one
// appears with PLAYBACK and sits in the same place either way, above the switcher bar
// in the narrow layout and at the bottom of the window in the wide one.

import { Tabs } from 'expo-router';

import { MiniPlayer } from '../../media/mini-player.js';

export default function TabsLayout() {
  return (
    <Tabs bottomBar={<MiniPlayer />}>
      <Tabs.Screen name="index" options={{ title: 'Home', iconName: 'go-home-symbolic' }} />
      <Tabs.Screen
        name="entdecken"
        options={{ title: 'Entdecken', iconName: 'view-grid-symbolic' }}
      />
      <Tabs.Screen
        name="mediathek"
        options={{ title: 'Mediathek', iconName: 'applications-multimedia-symbolic' }}
      />
      <Tabs.Screen
        name="mitmachen"
        options={{ title: 'Mitmachen', iconName: 'system-users-symbolic' }}
      />
      <Tabs.Screen
        name="profil"
        options={{ title: 'Profil', iconName: 'avatar-default-symbolic' }}
      />
    </Tabs>
  );
}
