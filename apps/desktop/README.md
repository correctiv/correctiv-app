# @correctiv/desktop — an experimental GTK4 host

**This is a feasibility demonstration. It is not a release target, it is not built by
CI, and nothing ships from it.** It exists to answer one question with evidence rather
than argument: can the CORRECTIV app grow a desktop target without the core moving?

It can. The core did not move. What follows is what runs, what does not, and what this
does not prove.

The host is [gjsify](https://github.com/gjsify/gjsify)'s React-Native-on-GTK4 layer
(`@gjsify/react-native`; the manifest pins `^0.48.0` and a working copy is what this is
developed against, see *Against a gjsify working copy*), which renders React Native's
view vocabulary onto GTK4 and Adwaita. [ADR 0012](../../adr/0012-a-list-virtualizer-for-the-unbounded-lists.md)
and [ADR 0013](../../adr/0013-native-tabs-and-a-web-tab-bar-of-its-own.md) already named
this host as a reason for two decisions; this is that host, built.

![Home](screens/home.png)

## What actually runs

| | |
| --- | --- |
| **Routes** | 27 route files (25 openable hrefs + 2 layouts). **25 of 25 rendered** when last swept, 2026-09-11, on Linux under the GJS host. The three routes that used to loop on a deep link are among them; see [*The deep-link loop*](#the-deep-link-loop-fixed-upstream-and-now-measured). The last sweep of the node host was 2026-09-04 on macOS, at 24 of 24, which is also the only sweep of a non-Linux target. |
| **Components** | **45 of 45 rendered**, same day, same host. This is the phone's own catalogue opened here, and it is what found the four refusals below: the route sweep reported every one of those routes `ok`. |
| **The vertical slice** | Start → Artikel → Reader, working, over WebKitGTK. |
| **Audio** | Working, on GStreamer. Position advances, live streams are detected, and the port's re-entrancy contract holds. |
| **Chrome** | Adwaita's own. `Stack` is an `Adw.NavigationView`, `Tabs` an `Adw.ViewStack` + `Adw.ViewSwitcher` — moving to an `Adw.ViewSwitcherBar` at the bottom when the window is too narrow to show it, which is the phone's tab bar on a Linux phone. Nothing restyles a header bar or a button. |
| **Colour** | The app's own tokens, both palettes, generated from `packages/design-tokens/theme.css`. The screenshots here are the dark one. |
| **Video** | PeerTube plays, over GStreamer into a `GdkPaintable`, under GTK's own control strip: play, pause, a seek bar that lands where it is asked, volume, click to pause, and a full-screen window of its own. The YouTube embed is still a notice, and macOS/Windows are — see below. |

### The reader

`buildReaderHtml` in the core produces a complete, self-contained document, and every
host's job is to display it. WebKitGTK displays it, so the article looks the way it does
on the phone — including the typefaces, because the reader embeds its own
base64-subsetted fonts and that mechanism works unchanged inside WebKit.

![Reader](screens/reader.png)

### Audio, measured rather than screenshotted

A screenshot of the player proves a screen rendered, not that audio decoded. `npm run
audio-probe` drives the backend directly and prints what arrived:

```
--- bundled mp3 ---            --- live radio ---
ticks:        9                ticks:        115
loaded:       true             loaded:       true
position:     0.00s -> 2.87s   position:     0.00s -> 5.45s
durationSec:  97.47            durationSec:  0.00
live:         false            live:         true

--- the port's re-entrancy contract ---
ticks emitted from inside a command: 0 (must be 0)
```

That last line is the one worth having. `AudioBackend` states that a command must never
call the status listener synchronously, because a backend that emitted from inside
`pause()` once killed the app with `RangeError: Maximum call stack size exceeded` a
minute into an episode ([ADR 0006](../../adr/0006-one-core-two-hosts.md)). The probe
asserts the property rather than trusting the implementation.

### The recovery screen, which this host had to build for itself

The phone's error screen is reached through expo-router's `Try`, which wraps a route
whose file also exports `ErrorBoundary`. This host's `expo-router` is a shim over
`@gjsify/react-native/router` and has no `Try`, so that export was inert here: present,
correct, and reached by nothing. Nothing said so, because a missing boundary has no
symptom until the first refusal, and then the app dies whole — which is the profil
crash below.

It is a plain React class in `src/app/_layout.tsx`, wrapping the Redux `Provider` so it
also covers a fault in the store's own construction, and it draws the phone's
`components/recovery/RecoveryScreen` rather than a second copy of its German.
`@gjsify/react-native`'s support table lists expo-router's `ErrorBoundary` as planned,
tier P3, and says a boundary "has to be reconciled" with the host rethrowing an uncaught
error from `render()`. Measured here, it needs no reconciling: React reaches that
handler only for an error NO boundary caught, and with the class in the tree
`@gjsify/gtk-host/react` logs `an error boundary caught an error` through
`onCaughtError` instead, the process survives, and a capture still gets written.

**IT CATCHES MORE THAN THE FIRST MEASUREMENT SAID.** The first full `component-sweep`
reported `React hit an error no boundary caught` and this section concluded the
boundary was a partial answer. That was wrong, and the way it was wrong is the useful
part: the boundary caught the fault and rendered the recovery screen, and the recovery
screen then refused as well, because `Screen`'s outermost element carries `flex-1` and
a fallback rendered after a catch has no parent context to resolve it against. The
SECOND refusal was uncaught, and it replaced the first in the log.

So the fallback is wrapped in a bare `<View>` — a parent for the screen below it —
and the original messages come through. Everything below about the two components that
would not render was found by that one element.

**A cast, and it is not cosmetic.** `tsconfig.json` points `jsxImportSource` at
`@gjsify/gtk-host/react` so that an accidental `<div>` is a type error rather than a
blank window. That namespace declares `ElementType` as a GTK tag or a FUNCTION
component, so a class component is `TS2786: cannot be used as a JSX component` — which
excludes every error boundary, because React has no functional one and
`getDerivedStateFromError` is class-only by design. The types forbid what the runtime
supports. The fix belongs upstream in one line, `GtkElementType` admitting a component
class the way React's own `ElementType` does; until then the class is retyped at one
site with the reason written beside it.

### The profil crash, fixed

Home did not render at all for one merge, and it took every route with it, because
the tab stack mounts all five tabs from `/`. `(tabs)/profil.tsx` rendered three
`<Typo onPress>` under "Ihr Impact"; the layer refuses `onPress` on a `Gtk.Label` —
correctly, a label emits no `clicked` — and the uncaught `PrimitiveError` ended the
tree before anything else ran, `CORRECTIV_DESKTOP_ROUTE` included.

It arrived with [ADR 0018](../../adr/0018-removing-the-guest.md): those rows were inside
`{membership.isMember && …}` and were reached by nobody, so removing the guest branch
made them unconditional. Measured on one profile against two bundles of the same host:
the tree from before the merge captured Home at 92 125 bytes, the tree after it threw
and captured 12 848.

The remedy is the one the refusal names — wrap the three rows in a `Pressable`, which
is what the rest of this app already does for a tappable line of text — done in the
phone's screen, so it is correct on both hosts. A clean run now captures Home again,
at 93 470 bytes, with no `PrimitiveError` in the log.

## What does not work

### Twelve seconds of frozen window, from one number in the layer

**Fixed in the gjsify working copy this host is developed against, and in no
published version** — a checkout that installs `@gjsify/*` from npm still freezes.

A cold start pinned one core for 12.7 s. The main loop serviced nothing in that
window, so every feed the app had already asked for hit its timeout while the loop
never ran: the `The operation was aborted` lines in the log are that, not a network
fault, and they print in the millisecond the burn ends. The window was mapped and
correct throughout, which is why this was only ever reported as "it hangs a bit at
the start".

Four answers that sounded better than the right one, each killed by a measurement:

* **not the network** — identical 13.5 s inside `unshare -rn`, with no network at all;
* **not the stylesheet** — `StyleSheet.flush()` instrumented: four flushes, **2 ms** in total;
* **not layout in general** — a resize on the settled window costs 2 to 33 ms;
* **not the size of the tree** — the door, before any session, burns 300 ms all in.

There is no `sysprof` here, so `eu-stack` sampled the main thread three times during
the burn. All three stood in `gather_aligned_item_requests`, under
`gtk_flow_box_measure`, under GTK's own `surface_layout_cb` — GTK's ordinary layout
pass, not JS measuring synchronously.

`@gjsify/react-native` maps `flex-wrap` to `Gtk.FlowBox` and pinned its
`max-children-per-line` to 65535, which is GTK's spelling of "as many as fit" and
was pinned for a good reason: the default of 7 wraps a chip row after seven chips.
But GTK measures THE CAP rather than the children, and quadratically. One
`Gtk.FlowBox` holding TWO children, per measure, on GTK 4.22.4:

| cap | 64 | 1024 | 8192 | 32768 | 65535 |
| --- | --- | --- | --- | --- | --- |
| ms per measure | 0.018 | 0.40 | 19.3 | 421.8 | **1517.9** |

`ArticleRow` puts `flex-wrap` on its meta line, so the feed builds one of these per
article. Five on Home, about 2.5 s each.

**The cap is wrong in the answer too**, which is worse than what it costs and was
found on the way out: at `column-spacing: 8` the natural width carries
`8 × (cap - 1)` px of gaps that do not exist — 524 867 px for content 683 px wide.
The layer's own note said the natural width was "unaffected by it, measured
identical for 12 children at 12, 1024 and 65535", and that holds ONLY at
`column-spacing: 0` — the one case that table cannot produce, since it routes every
`gap-*` into `column-spacing`.

The fix is `ChildPolicy`'s `perLineCap` in `@gjsify/gtk-host`: the host keeps the cap
equal to the child count on every insert and every remove. A line can never hold
more children than exist, so it forbids nothing 65535 allowed and costs nothing to
measure. Measured here after the change: **13 510 ms → 700 ms**, 24 of 24 routes,
and the chip row still wraps into three lines at 560 px.

**Nothing in this app changed**, and that is the part to keep. The markup was
ordinary React Native the whole time, every screenshot of it was right, and
`npm run check` was green for the entire life of the defect. A screenshot proves a
tree rendered; it says nothing about what the render cost.

### Getting into the gallery, which used to need a restart

`/gallery` is the phone's component catalogue, 45 components and 105 specimens, and on
this host it is the most useful screen there is. Nothing in the app links to it,
because it is a developer page and the phone does not put one in a tab bar. So the
only way in was `CORRECTIV_DESKTOP_ROUTE=/gallery` and a restart, which is no way to
compare two components.

**`Ctrl+Shift+G` in the running window.** A `Gio.SimpleAction` on the application with
an accelerator, which is how a GTK application offers a command —
`src/debug/gallery-action.ts`, using the `AppRegistry.getApplication()` accessor
gjsify #1455 added for exactly this. It `push`es, so Adwaita's own back button leads
out again, and it is driveable from outside like any other action:

```sh
gdbus call --session --dest org.correctiv.AppDesktopExperimental   --object-path /org/correctiv/AppDesktopExperimental   --method org.gtk.Actions.Activate gallery '[]' '{}'
```

Not gated on an environment variable, unlike `CORRECTIV_DESKTOP_ROUTE`: that one
REPLACES the initial route and has to be off unless asked for, and this one does
nothing until somebody presses it.

**`npm run gallery`** starts there directly, for when that is what you wanted anyway.
It goes through `start.mjs --route`, which is the same thing the environment variable
does as a flag, so a package script can carry it.

**What the page gives you that a screenshot pair cannot**: its appearance control is
live and writes the app's own setting, so light and dark are two key presses apart on
one component, and the line under it prints both the setting and what it resolved to.
"System" against a dark device is the combination AGENTS.md names as the one that has
already shipped broken, and it is the page's default.

### What the first component sweep found, and the refusal that hid it

The sweep's first run reported 43 of 45, with `participate/FormField` and
`player/ProgressBar` refusing. Both now render, both for reasons that had nothing to
do with what the message said, and the route this took is the useful part.

**Every refusal read as the same one.** Whatever actually went wrong, the log said:

    <View> expand — carries layout that cannot be resolved at this position

That is because the app's error boundary DID catch the real fault and render the
recovery screen, and the recovery screen then refused as well — `Screen`'s outermost
element carries `flex-1`, which needs a parent context to resolve, and a fallback
rendered after a catch sits at the root of a fresh subtree with none. The second
refusal was uncaught, took the tree, and replaced the first one in the log.

`src/app/_layout.tsx` now wraps the fallback in a bare `<View>`, which is a parent for
the screen below it to resolve against. One element, and the real messages came
through immediately.

**What they actually were**, once visible:

| component | refusal | answer |
| --- | --- | --- |
| `participate/FormField` | style `textAlignVertical` is not a property the partition routes | dropped in the shim: a `Gtk.Entry` centres its one line and a `Gtk.TextView` starts at the top, so both values the app passes are the toolkit's own behaviour |
| `participate/FormField` | `<TextInput>` `value` AND `onChangeText`, on a multiline field | `multiline` dropped instead. A `Gtk.TextView` keeps its content in a `Gtk.TextBuffer` rather than a property, so it answers neither; dropping those two would accept typing and report none of it. The textarea is one line tall here |
| `player/ProgressBar` | `<Pressable>` `accessibilityValue` | dropped, and it is a real screen-reader loss: GTK publishes `VALUE_NOW`/`VALUE_MIN`/`VALUE_MAX` on `Gtk.Accessible`, so the gap is in the layer, not the toolkit |
| `player/ProgressBar` | `style={{ transform: [...] }}` is an array; the partition reads numbers and strings, and a transform is a `Gsk` render node rather than a widget property | `src/overrides/ProgressBar.tsx`, which sizes the fill instead of scaling it. Same redirect mechanism as `VideoFrame` |

**Two of the four are `apps/mobile` techniques that GTK expresses differently**, not
defects: a transform instead of a width, because a phone cannot afford a layout pass
per tick; and a buffer-backed multiline input. Neither component changed on the phone.

**WHY NO ROUTE SWEEP WOULD HAVE FOUND ANY OF IT.** Both components have a route, and
`route-sweep` reported both `ok`:

| route | sweep line | what it photographs | what it never draws |
| --- | --- | --- | --- |
| `/player` | `ok  [11829 byte capture]` | "Es läuft gerade nichts." | `ProgressBar` |
| `/formular` | `ok  [18457 byte capture]` | "Dieses Formular gibt es nicht" | `FormField` |

Nothing plays in a swept process and no callout is passed to the form, so each screen
renders a legitimate empty state and passes. `route-sweep.mjs`'s own header warns
about this for `[param]` routes; it is true of these two as well, and nothing about
their `ok` lines says so.

**The obvious remedy was tried first and did not work**, which is worth keeping. The
refusal's own advice is "wrap it in a `<View>`, or move the utility to a child", so
both components were rewritten that way and both still refused: `0 of 2`. The advice
was sound and pointed at the wrong element, because the message could not say which
element it meant. Finding that out needed a patch to the built `lib/` to print the
`className`, and that is one of the two gjsify issues this produced.

**What went upstream.** Two issues, both with file:line evidence:

1. `render()` drops `ParentProvider` for every child when any child is a text run, so
   a sibling's `flex-1` throws. Measured: `''` is a child to `Children.toArray` and
   not a child to the reconciler, so an invisible value removes the provider.
2. `PrimitiveError` cannot name the element it refused, and the unresolved-intent
   message blames a cause that cannot apply — for `expand` the only input is whether a
   parent context exists, so "or its parent is not a box" can never be it.

### The deep-link loop, fixed upstream and now measured

Three tab routes — `/mediathek`, `/mitmachen`, `/profil` — used to enter an infinite
update loop when entered by URL: React error #185 with
`gtk_widget_set_child_visible: assertion 'GTK_IS_WIDGET (widget)' failed` about thirty
times a second, 432 occurrences in 15 seconds. It was TWO defects that looked like one,
and separating them took a control run:

* the **criticals** were libadwaita's, reached through `@gjsify/gtk-host`:
  `adw_view_stack`'s `stack_remove()` clears `visible_child` and leaves
  `last_visible_child` pointing at a page whose widget it has just dropped. The host's
  `keyed` reorder removes all children and re-adds them, walking into that once per
  page per render. `Gtk.Stack` does not have the bug.
* the **loop** was the tab router's, in `@gjsify/react-native`: the effect that selects
  the visible page had no dependency array and a guard that only terminated once the
  selection had taken, so a name the stack does not carry yet never settled.

Both landed upstream as gjsify #1484 and #1485 — **in 0.46, the version this app was
already pinning.** So they were collected without a bump, and had simply never been
re-measured. Swept 2026-09-04 on macOS under the node host: **24 of 24 openable routes
render without a refusal**, the three former offenders included — and 24 of 24 again on
Linux afterwards, which is the regression check for the reader's own header change in
the same batch.

Worth keeping as the lesson rather than the fix: "fixed upstream, this app picks it up
on the next bump" aged into a false statement the moment the fix shipped in a version
the lockfile already held. A claim about a dependency needs re-measuring, not
re-reading.

**PeerTube video plays on Linux**, and the entry is kept because the claim it replaces
was wrong in an instructive way. It read: ~~"`@gjsify/video` is GJS-only while ADR
0032's ship path puts macOS and Windows on Node + node-gi, so real video here would
work on one of the three desktop targets"~~. That is true of `@gjsify/video` and says
nothing about video, and the app had the counter-example in it the whole time — the
audio backend plays over GStreamer through the same `gi://Gst` a video pipeline needs.

MEASURED on GStreamer 1.28.6 against the real feed, `playbin3` + `gtk4paintablesink`
on a FunFacts master playlist:

```
paintable: GstGtk4Paintable
state:     PLAYING
  t=1s  position 0.18s / 1146s  picture 640x360
  t=5s  position 4.20s / 1146s  picture 2560x1440
```

The position tracks the wall clock, and the intrinsic size climbing from 640x360 to
2560x1440 four seconds in is HLS picking a rendition — adaptive streaming happening
rather than merely not refused. `Gtk.MediaFile` is the shorter road that goes nowhere:
it has no `new_for_uri`, and given a `Gio.File` for an `https://` playlist it blocks
instead of failing, because the demuxer resolves its segments against a URI the file
abstraction has taken away.

**macOS and Windows still get the notice, and the reason has moved from the toolkit to
the payload.** Their runtime bundles ship no video plugins at all: MEASURED against the
published `@gjsify/gtk-runtime-win32-x64@0.48.0` (42 GStreamer files) and
`-darwin-arm64` (33), both carry `gstvideo`, which is the LIBRARY, and not one plugin
that decodes or displays — no `videoconvert`, no `libav`, no `hls`/`adaptivedemux`, no
`gtk4paintablesink`. The seed list they are built from is called `GST_AUDIO_PLUGINS`
and is honest about it. So the same code would run there the day the bundle carries
the plugins, and until then `createVideoPlayer` throws by name and the screen says so.

**The YouTube stage is still a notice**, which is the other video path and a different
technology: an embed that would in fact load inside WebKitGTK, in a page this host does
not build. `src/overrides/VideoFrame.tsx` carries that one.

~~**No control strip.** GTK's ready-made one is `Gtk.MediaControls`, which drives a
`Gtk.MediaStream`; a GStreamer pipeline hands out a `GdkPaintable`, and the two do not
meet without a `GtkMediaStream` of our own.~~ **There is one now**, and this entry is
what voided it: [`src/video/stream.ts`](src/video/stream.ts) is that `GtkMediaStream`,
and *The video had no way to pause* further down carries the measurements.

**The reader has its fade back**, as of `@gjsify/react-native` 0.48, and the entry is
kept because the route it took is the lesson. It was first "`Animated` is not
implemented" (tier P3: a subsystem rather than a component, and doing it badly is worse
than not doing it). 0.46 implemented the three names this app uses, and the entry
narrowed to a composition: the phone's overlay header is an `<Animated.View
className="absolute …">`, and an `Animated.View` child did not make its parent a
`Gtk.Overlay` the way a `View` child does. Both features worked alone and did not
compose — filed as gjsify #1451.

0.48 fixed it as a class rather than a case (#1537: a wrapper is transparent to the
facts a parent reads), and `Animated.View` renders through the `View` primitive, which
declares `overlayOnAbsoluteChild`. Measured here on 2026-09-05: the phone's header
markup renders with no `PrimitiveError` and the 160 ms fade is restored on Linux and
macOS. `src/app/artikel.tsx` is still a variant, for the Windows reason below and for
nothing else — see [ADR 0071](../../adr/0071-re-exported-screens-and-a-variant-where-the-host-refuses.md).

**A colour-scheme change needs a restart.** Adwaita's chrome follows the setting
immediately, but the app's own token colours are resolved when their CSS class is
minted, so switching mid-session would leave half the window in each scheme. The palette
is read once, at startup.

**Smaller, each named where it happens:** `Bleed` does not bleed, because GTK does not
clamp a negative margin — it measures with it. ~~No lock-screen metadata~~ — MPRIS is
exported now, and *The shell can see what is playing* below carries what it answers.
~~No mini player~~ — there is one, and *The mini player, as Adwaita widgets* says what
it took.

**A horizontal rail still has too much vertical space, and that is the last piece of
a defect whose other three are fixed.** The covers on Mediathek were 99x31 px where the
phone shows them square; they are square now. What is left is a video rail that
reserves the height of a card twice as wide as the one it draws.

The three that are fixed, because each was a separate thing:

* **`aspectRatio` was dropped**, with a note saying it was "used once, on the video
  stage". `Thumbnail` frames every cover and every still with one, so it was on 97
  image widgets. It becomes a `Gtk.AspectFrame` now — MEASURED, that widget is a
  height-for-width REQUEST and not an alignment: `measure(VERTICAL, 116)` answers 116
  at ratio 1 and 65 at 16/9. The descriptor it needed is upstream.
* **A `Gtk.Picture` sizes its parent.** Its natural width is the paintable's: a
  1400x1400 cover reports 1400, `can-shrink` only moves the MINIMUM to zero, and a
  box, a viewport and an aspect frame all pass it straight up. One 116px tile asked
  for 1437 px and a rail of seven asked for 10 060. React Native does not work that
  way — `<Image style={{ width: '100%' }}>` contributes no intrinsic size — so the
  picture sits in the one container measured to report 0/0, a `Gtk.ScrolledWindow`
  with `propagate-natural-*: false`. It scrolls nothing: both policies are NEVER and
  the child is allocated the viewport exactly. ~~Both policies are EXTERNAL~~ was the
  first shape and cost the rail its scrolling: an EXTERNAL policy leaves the scroller
  able to pan, so every wrapper around every cover swallowed the scroll events the
  rail around them needed.
* **A horizontal scroller never asks its content for a height.** `Gtk.ScrolledWindow`
  asks `VERTICAL for_size -1` and nothing changes that — measured across six
  configurations — so a rail of tiles answered 34 px: the labels, and nothing for the
  images. Fixed upstream by a `Gtk.BoxLayout` SUBCLASS on the content box that answers
  that one question at `max(hadjustment:page-size, the content's own minimum)`, which
  is what a viewport allocates (gjsify #1599).

  ~~Fixed with a `set_size_request` written from a layout effect~~ was the first shape,
  and the reason first given for replacing it was ~~that a request only RAISES a height,
  so a card that fills the rail could not be made shorter than the 160 GTK answers~~ —
  **which is false**, and an upstream review caught it. Four instruments on one card
  tree, wanting 36: plain `Gtk.Box` 18, the layout manager with its watch removed 160,
  the layout manager 36, and **a request at the same width one idle later 36**. GTK's
  `for_size -1` answer is a wrapping row's height at its natural width and therefore
  the smallest height it has, so every target sits above that floor and a request can
  always lift the answer to it. The 160 was the new code with its watch removed.

  What does hold, measured: a title arriving from a re-render BELOW the `<ScrollView>`
  never re-ran a layout effect, so the rail wrote 145 where it needed 161 and clipped
  the third line of every card title; and the request landed on the same field as a
  consumer's `contentContainerStyle` height. A layout manager has neither problem —
  GTK re-measures on the child's own `queue_resize`, and nothing is written.

  The one part that survived is the deferral. `page-size` is written during the
  scroller's own `size_allocate`, and a `queue_resize` from that handler does not reach
  the pass in progress: measured, inline the measurement was already 36 while the
  scroller stayed at 160, and one idle later the scroller followed.

**The window lets itself be narrower than its content, and the content is clipped
rather than scrolled — cause NOT identified.** MEASURED on the merged host at the
Mediathek: the window reports a minimum of `[360, 544]`, `ResizeWindow(360)` is
therefore a size a user can drag to, and at 360 the bottom tab bar shows four of five
tabs — „Profil" is simply gone — while the page box inside reads 439 wide with a
minimum of 439. So 79 px of real interface is cut off inside the window's own stated
minimum.

Three explanations are RULED OUT by measurement, which is the useful half of this
entry:

| candidate | measured |
| --- | --- |
| `hscrollbar-policy: never` swallows the child's minimum | it does not: a 439 px child gives the scroller `[439, 439]`; AUTOMATIC gives 46 and EXTERNAL 0 |
| `Adw.BreakpointBin` caps its child so breakpoints can fire | it does not: a 439 px child gives `[439, 439]` with a 360 px request, and `[500, 500]` with a 500 px one |
| the 360 floor in gjsify's tab router (#1597) caps it | that line is `max(child minimum, 360)`, a floor, and a size request cannot lower a widget's minimum anyway |

What remains unmeasured is which widget between the tab bar and the toplevel reports
360 while its content needs 439. Written down without a cause rather than with a
guessed one; the next step is a recording measure on that chain, the way the rail's
own defect was found.

**Emoji in a stream's track title render as replacement boxes, and that is not this
app.** MEASURED in a twelve-line GTK program with no application code: the default
`PangoCairo` font map lists 100 families INCLUDING „Noto Color Emoji" and „Noto
Emoji", and a plain `Gtk.Label` reading „🎵 Leben 🎵" still lays out with two unknown
glyphs. So Pango is not falling back to a font it can see, the app's own five faces
and its 102-family map are not involved, and nothing in a screen or a shim can answer
it. Recorded rather than chased: a fix belongs in fontconfig or in an explicit emoji
family on the font stack, and it would be measured the same way.

**A chip rail squeezes its chips where the phone lets the rail overflow, and that is
`flexShrink` again.** React Native's `flexShrink` defaults to **0**, so a row item
there is never squeezed below its content — the row overflows and the rail scrolls.
GTK has no shrink factor and a `Gtk.Box` gives its children anything between their
minimum and their natural size. MEASURED on the same four-chip rail in a 260 px
viewport, three ways:

| the label | row minimum | row allocated | label widths | heights |
| --- | --- | --- | --- | --- |
| wrapping, as it was | 293 | 293 | 39, 38, 59, **53** | 18, 18, 18, **54** |
| `numberOfLines={1}` | 168 | 260 | 39, 38, **40**, **39** | all 18 |
| pinned to its natural width | 358 | **358** | 39, 38, 59, **118** | all 18 |

Wrapping is what the chips did: the last one was squeezed to 53 px, wrapped onto
three lines, and the 34 px rail clipped them. **`numberOfLines={1}` is worse**, which
is the measurement worth keeping — `ellipsize` takes a label's minimum width to about
one character, so the box squeezes every chip and truncates all four. Pinned, nothing
is squeezed and the rail scrolls.

So `Chip` writes `flexShrink: 0` out, which is a declaration rather than a change on
the phone, and this host answers it with a width request on the `<Text>`. **The trigger
is that declaration and nothing else**, corrected after it shipped wider: it also read
`numberOfLines === 1 && letterSpacing > 0`, and EVERY variant in
`lib/theme/typography.ts` carries a `letterSpacing` from the design tokens, so that
clause fired on every single-line `<Typo>` in the application. Measured, it pinned the
live banner's now-playing line at its natural 445 px — the exact opposite of what that
line needs — and the mini player's title with it. The
property is refused by name one layer down — measured, `UnknownUtilityError:
"flexShrink" — is not a property the style partition routes`, which React caught as
an unhandled error and left the window empty — so the shim consumes it in the same
switch as `aspectRatio`. It is keyed on the DECLARATION and not on the shape of the
element, because the mini player's title is `numberOfLines={1}` in a flex row and is
supposed to ellipsize.

**The video had no way to pause, and the file said it did.** `VideoView` accepted
`nativeControls` and drew nothing; the docblock promised that "the picture itself
toggles play/pause on a click", and there was no gesture in that file at all. A
docblock is not a feature.

The toolkit now draws the strip, and the two ready-made routes to it were measured
before anything was written — and all three re-measured 2026-09-09, on GTK 4.22.4 and
the same feed:

| route | measured |
| --- | --- |
| `Gtk.Video` + `Gtk.MediaFile` | does not reach this stream: GTK's own media backend never prepares the FunFacts master playlist — `prepared=false` through 7.2 s, `duration=0`, no audio, no video, and `error=none` either. It has no `new_for_uri`, so the playlist can only arrive as a `Gio.File`, and the demuxer then resolves its segments against a URI the file abstraction has taken away |
| a single MP4 rendition instead | PeerTube's own API answers `hasAudio=false` for every video rendition it lists — six of them, 2160p down to 360p, on each of three FunFacts videos — and puts the sound in an `Audio only` rendition of its own, so only the master playlist carries both tracks |
| `Gtk.MediaControls` | wants a `GtkMediaStream`, which is what [`src/video/stream.ts`](src/video/stream.ts) now is |

So the pipeline wears GTK's own media interface: a `Gtk.MediaStream` subclass driving
one `playbin3`, with the frames left to the sink's own paintable.

**AND THE STRIP ALONE IS NOT A PLAYER.** `Gtk.MediaControls` is the strip and only the
strip; `Gtk.Video` keeps the behaviour around it to itself. So
[`src/video/stage.ts`](src/video/stage.ts) adds what a player does: a click that
pauses, a double click and a button for full screen, and a strip that leaves once the
pointer is still — but never while PAUSED, where a strip that vanished would leave no
way back. Measured with the pointer away from the window, the strip reports
`visible=false`; it returns on the first motion.

**FULL SCREEN IS THE VIDEO, NOT THE WINDOW**, and the first shape had that wrong.
`window.fullscreen()` made the whole application fill the screen — header bar, title,
description — with the video still a 548 px box inside it: measured, the window went to
2560x1440 while the picture stayed 548x308. Now a window of its own opens with nothing
but the frames and a strip, and NOTHING IS REPARENTED: it takes a second
`Gtk.Picture` on the same `GdkPaintable`, which is safe because a paintable is a
passive drawing interface with no single owner, and it leaves the reconciler's subtree
where the reconciler put it. Measured: pressing the button gives two toplevels — the
app window untouched at 1100x820 and a `GtkWindow "Video"` at 2560x1440 whose picture
is 2560x1440 at ratio 1.778 — and Escape or its own button takes it back to one.

WHAT IS NOT THERE: the crossfade. `Gtk.Video` reveals its strip through a
`Gtk.Revealer`, and this host declines one — `GtkRevealer` is in the generated property
table but is not curated, so a child placed in it is refused by name. The strip is shown
and hidden outright until one curated descriptor upstream closes that.

**THE PLAY BADGES WERE NOT CENTRED, and it took two attempts.** The layer below maps
React Native's `alignItems`/`justifyContent` onto the BOX's own alignment rather than
its children's, because GTK's box has no main-axis distribution to map them to. That is
right for a box sized to its content and wrong for one with slack. Measured on a 52x52
badge holding a 22 px icon, four ways:

| the icon | allocation |
| --- | --- |
| filling, as it was | 52x22 at y=0 |
| `valign: center` | 22x22 at **y=0** — still at the top |
| `valign: center` + `vexpand` | 22x22 at y=15 |
| in a **homogeneous** box | 22x22 at y=15 |
| two children in a homogeneous box | 22x22 at y=2 and at y=28 |

`valign` alone answers 22x22 and does not move it, because a box packs a non-expanding
child at the start and leaves it nothing to align in — which is why the first fix looked
right horizontally and wrong vertically. **`vexpand` on the icon was tried and reverted
within the hour**: it is set on every icon this app draws, and an expanding child in a
vertical box takes all the slack — the video stage collapsed to `470x0` with the header
drawn inside it. So the decision is made from the BOX's own props instead: a class list
that centres on the main axis plus a fixed size on that axis becomes `homogeneous`,
which reaches a box with slack and leaves a box sized to its own content alone.
Re-measured in the running app: every 52x52 play badge reads `homogeneous=true` around
a 22x22 icon, so does a 36x36 badge around a 16x16 one, and the 24x24 tab-bar icon reads
false. The last row of the table is why the several-children case is written down rather
than guarded — a homogeneous box gives each child an equal share, which is space-around
and not centre — and that combination, a fixed main axis with centred content and more
than one child, does not occur here.

**AND THE FULL-SCREEN BUTTON ALSO PAUSED.** The click gesture sat on the `Gtk.Overlay`,
and an overlay hears the clicks its own children take — so pressing the button went full
screen AND toggled play. It is on the picture now, where "a click on the video" means the
video. Measured across the switch: `0:05 → 0:07 →` press `→ 0:10 → 0:12`, still playing.

**THE PICTURE TAKES THE SINK'S PAINTABLE, and the forwards that used to sit beside that
are gone.** A `double` returned from `vfunc_get_intrinsic_aspect_ratio` never reaches
the caller. Measured with the override instrumented: it is called 28 times, the sink
answers it `1.7777777777777777` inside the call, the override then returns a literal
`1.7777777`, and `stream.get_intrinsic_aspect_ratio()` still answers **`0.000`** — while
the two integer forwards beside it work and 640x360 arrives. `Gtk.Picture` reads that
aspect for `content-fit`, gets 0, and snapshots the video **one pixel wide**:
`lastSnapshotSize=1x261`, which is the thin line this shipped for one commit. With the
sink's own paintable the picture measures `548x308, ratio 1.779`, its 16:9.

~~The forwards stay because they are correct and cost nothing; the day that marshalling
works the stream can paint.~~ **Both halves of that were wrong**, and re-measuring
2026-09-09 is what showed it, so the four overrides and the two invalidate handlers
under them have been deleted:

| asked | measured |
| --- | --- |
| does the aspect override cost nothing? | it costs the aspect ratio. With NO override at all, `GdkPaintable`'s own default divides the two integer forwards and answers **`1.7777778`** — and that arrives. The override replaced a working default with 0. Same result on a plain `GObject.Object` and on a `Gtk.MediaStream` subclass, so it is GJS's vfunc return and not GTK; a `double` **property** round-trips fine |
| would the stream paint, if marshalling worked? | it should not. A forwarded `vfunc_snapshot` is one JS call per frame per picture, for work `gtk4paintablesink` already does natively. The sink's paintable is the permanent answer, not a workaround |
| what did the forwarding cost? | a whole pipeline per visit. It needed the sink paintable's two invalidate signals re-emitted from the stream, and nothing disconnected them: measured at `release()`, both were still connected — the paintable held a closure holding the stream, the stream holds the pipeline, the pipeline holds the sink. Nothing in that ring is collectable |

With the overrides gone, `Implements: [Gdk.Paintable]` goes too: measured, GJS refuses a
class that overrides a paintable vfunc without declaring the interface and accepts one
that overrides none, and the subclass is a `GdkPaintable` either way by inheritance.

~~Verified by geometry rather than by a photograph: with a live video texture in the
window the devtools `Screenshot` returns nothing.~~ **That was false, and it was this
document that invented it.** An empty reply was read as "video cannot be photographed"
when the capture had declined for an unrelated reason and said nothing at all — a
`Screenshot` answered zero bytes for four different absences with no way to tell them
apart. RE-MEASURED 2026-09-09 on GTK 4.22.4 with `GskVulkanRenderer`:

| what | bytes |
| --- | --- |
| a `gtk4paintablesink` picture on `videotestsrc` | 24 042 |
| the same picture on the real HLS stream | 202 645 |
| its window | 204 865 |
| **this application, video playing, window scope** | **308 714** |
| **the same run, the picture alone by path** | **252 192** |

The renderer downloads a video texture like any other. What was actually missing is the
REASON, and it is fixed upstream rather than worked around here: gjsify#1611 gives the
capture a `blocker` — `no-renderer`, `zero-size`, `empty-snapshot`, `empty-png` — and
makes the service log it beside the empty bytes, so the next empty answer cannot have a
cause invented for it either.

What IS true is the narrower thing: the numbers below are read off the CONTROL STRIP's
own clock and the widget tree, not off pixels. On the real feed the strip went
`0:05 / -14:05` → `0:09` → `0:13` with the seek bar populated from the stream's own
duration, and after pressing its button the clock froze at `0:14` across two samples.
Play, pause, elapsed, remaining and volume are Adwaita's widget rather than drawn here.
The route sweep captures `/video` at 13 077 bytes, which is the route before a video is
chosen.

**AND THE SEEK BAR WAS AN ORNAMENT, which nothing here had measured.** `seek_simple`
answered `true` every time and the playhead went to the start every time. MEASURED on
this HLS stream, with the pipeline answering `seekable=true range 0..850s` throughout:

| flags | asked | landed |
| --- | --- | --- |
| `FLUSH \| KEY_UNIT`, as it shipped | 300 s from 19.2 s | **3.7 s** |
| `FLUSH \| KEY_UNIT` | 10 s, 60 s, 600 s | **0.00 s**, every one |
| `FLUSH` alone | 300 s | 3.8 s |
| `FLUSH \| KEY_UNIT \| SNAP_BEFORE` | 300 s | 3.8 s |
| **`FLUSH \| ACCURATE`** | 120 s, 45 s, 700 s, 5 s, 400 s | **all five, within the three seconds the sampling itself takes** |

So it is the key-unit snap picking the playlist's first segment rather than the nearest
keyframe, and one flag is the whole fix. The seek bar cannot be driven from the
devtools — `SendKey` reaches `Gtk.EventControllerKey` handlers and a `GtkScale`'s keys
are class-level shortcuts — so it was measured on the same pipeline shape outside the
app, and then confirmed inside it through the seek the next entry is about.

**OPENING FULL SCREEN MOVED THE PLAYHEAD, because a second strip seeks the stream it is
bound to.** MEASURED against a fake `GtkMediaStream` with no GStreamer in it, so this is
the widget and not this pipeline: a `Gtk.MediaControls` bound to a stream that stands
past ten seconds asks it to seek to exactly `10.00` s — the seek adjustment's own
initial upper bound, clamped and written back through its value before the real duration
replaces it. At 0 s, 3 s and 9.5 s it asks for nothing; from 10.4 s to 500 s it asks for
10.00 s, whether the piece is 60 s or 850 s long; and it does so at construction and
again on a later `set_media_stream`. The target is FIXED, so the further in the viewer
is, the bigger the jump back.

The page's own strip is built while the stream still stands at 0, which is why only the
full-screen window ever showed it. Measured in the app, the same press three ways:

| | the page | full screen |
| --- | --- | --- |
| as it shipped (`KEY_UNIT`) | `0:11` | **`0:00`** — the video restarted |
| `ACCURATE`, no guard | `0:11` | `0:11` → `0:14` — the seek lands where it is asked |
| `ACCURATE`, seeks refused for the length of the binding | `0:11` | `0:13` → `0:16` — no seek at all |

**AND NOBODY WAS LISTENING TO THE PIPELINE'S BUS.** Measured on the real feed seeked to
843 s of 850: it posts EOS and then sits in PLAYING with the position frozen at 850.1 s,
for ever — so the strip kept a pause icon over a video that had stopped, and the 250 ms
tick re-sent the same timestamp four times a second. From the other end, a URI that 404s
posts three errors (`Forbidden`, then `Internal data stream error.`, then one about not
enough data) and the screen kept a black picture and a `0:00` clock. The bus is watched
now, the way the audio backend watches its own, and each is handed to the call GTK has
for it: `stream_ended` — measured, `playing` false and `ended` true, so the strip offers
a play button — and `gerror`. Replaying then needs one more measured line, because a
pipeline that has seen EOS ignores `set_state(PLAYING)`: only a flushing seek back to 0
restarts it (measured, 1.25 s a second and a half later), and `ended` is still true
inside `vfunc_play`, where GTK clears it afterwards.

TWO ORDERING TRAPS PAID FOR THE PLAY BUTTON, and both are worth keeping. The first:
`useVideoPlayer(url, setup)` calls `play()` in its setup callback, which runs BEFORE the
url is known, because the route fetches it. So the stream is already marked playing when
a url arrives, the second `play()` is a no-op, `vfunc_play` never runs and the pipeline
sits in READY — measured, `0:00 / -0:01` and a black picture after seven seconds. `open`
therefore puts the pipeline where the stream's own `playing` already stands instead of
waiting to be told twice, and the backend keeps no second copy of that state.

The second is the same flag read one line too late, and it made ~~"a `replace` after a
`play` needs no second `play` to follow it"~~ false for every video after the first:
`stream_unprepared` CLEARS `playing`, along with the timestamp and the duration. Measured
against GTK directly, and then in the app with a second `open` and no `play()` after it:

| the flag is read | measured |
| --- | --- |
| after the unprepare, as it shipped | `playing` false, position `0.00 s` and staying there, the strip back to `0:00 / -0:01` |
| before it | `playing` true, position `3.60 s` four seconds later, the clock running |

**THREE OF THE FOUR THINGS THE STRIP WAS TOLD WERE ASSERTIONS.**
`stream_prepared(has_audio, has_video, seekable, duration)` was called with a literal
`true` for the first three, which happened to be right on this feed and is wrong on the
`Audio only` rendition beside it. `src/debug/video-probe.ts` is where the real answers
came from — a probe next to the audio and registry ones, so the numbers can be
re-measured rather than trusted. MEASURED 2026-09-09:

| asked | answer |
| --- | --- |
| `playbin3`'s `n-audio` / `n-video` | **there are none.** GStreamer answers "no property n-audio in object" and GJS then criticals on the empty GValue |
| what carries the tracks instead | a `GstStreamCollection` on the bus: three streams, types TEXT(16), AUDIO(2), VIDEO(4), posted at t=0.75 s — before the duration is queryable at t=1.0 s, so the flags are known in time |
| `seekable` | true, range 0..850 s. `parse_seeking()` answers `[format, seekable, start, end]`, and reading index 2 for `seekable` is how the first run of the probe reported `false` on a stream that seeks fine |
| does the duration move? | no: `none`, then 850 s, then unchanged across 24 samples |
| would `duration-changed` be the honest signal? | **no, and this is the useful negative.** It is posted three times, all three before the pipeline reaches PAUSED, and a `query_duration` from inside each handler answers `none`. The 250 ms tick is not a poll standing in for a signal, it is the only thing that ever knows |

The duration is also guarded against `GST_CLOCK_TIME_NONE`, which `query_duration` may
carry with a true return. That one was NOT reproduced here, and the guard is against
the contract rather than an observation — one comparison against a seek bar offering
584 942 years.

**THE FULL-SCREEN WINDOW HAD THE OVERLAY BUG THE PAGE WAS FIXED FOR.** Its click
gesture sat on the `Gtk.Overlay` holding the leave button and the strip, which is the
arrangement that made the page's full-screen button pause the video. Moved to the
picture, and the double click now undoes its own first press so the playback state
comes out of full screen where it went in. Said plainly, because it matters here: this
one is NOT separately reproduced. Synthetic pointer input needs a tool this machine
does not have, so it is one press nobody has counted — what is measured is the page's
identical case and the motion controller on that same overlay, which fires for the
picture underneath it and is what reveals the strip.

**AND THE CENTRING RULE CAUGHT A SCREEN IT WAS WRITTEN NOT TO CATCH.** The
`homogeneous` fix for the play badges said in its own docblock that a fixed-size
centring box with several children "does not occur here" — and `app/atlas.tsx` is
exactly one: `justify-center`, `style={{ height: 130 }}`, an icon and a caption.
Writing it down instead of guarding it is what let it ship, and homogeneous means
EQUAL SHARES rather than centre. MEASURED in the running app:

| the placeholder's caption | box | label |
| --- | --- | --- |
| homogeneous, as it shipped | 1052x142 | **103x65** |
| not homogeneous | 1052x142 | **162x27** |

The box keeps its height; the caption is what broke. Squeezed into its half of a
homogeneous box it took its minimum width and wrapped "Kartenausschnitt (statisch)"
over three lines.

~~So `homogeneous` goes on only where the box has exactly ONE child.~~ **A child count
was the wrong fix, and the PHOTOGRAPH is what said so** — the measurement had passed:
twelve badges still `homogeneous=true`, the atlas box false, the caption on one line.
Looking at the screen showed the icon and caption sitting at the TOP of a 142 px box,
because the guard had removed a wrong distribution without supplying the right one.
This is the entry for why a green measurement is not a look.

**THE STRUCTURAL ANSWER WAS ALREADY IN THE FILE.** `justify-between` is answered by
interleaving a `flex-1` spacer between the children, because that is what
`space-between` IS. `justify-content: center` is the same kind of fact — equal
expanding space at the two ENDS, none between — so `justify-center` now gets a spacer
before and after its children. One child or several, no property to unset, nothing to
decide from a class list, and INERT where there is no slack: an expanding child of a
content-sized box is allocated nothing, so every box that hugs its content lays out
exactly as before. `homogeneous`, `centresOnMainAxis`, the child count and the
two-way write are all deleted; the icon's own `vexpand` and the box's `homogeneous`
stay recorded in the shim as the two wrong answers that preceded it.

Photographed, not just measured: the atlas placeholder now holds its icon and its
one-line caption centred as a pair, and the twelve play badges on `/mediathek` have
their triangle in the middle of the circle.

**Two smaller ones in the same pass, neither of them observed.** `contentFit` was
`props.contentFit === 'cover' ? 2 : 1`, so `fill` and `none` both asked for `CONTAIN`
— nothing passes either, and it now goes through the same nick map `expo-image` uses.
And `allowsPictureInPicture` / `startsPictureInPictureAutomatically` are accepted and
not implemented, which is worth naming because the screen DOES set both, with a comment
saying the system takes over the window: GTK has no picture-in-picture, and this host's
answer to the same want is the full-screen window above.

**THE SHELL CAN SEE WHAT IS PLAYING.** `org.mpris.MediaPlayer2` is the freedesktop
contract behind the GNOME lock screen, the panel's media widget and `playerctl`, and
without it a running episode was invisible outside this app's own window.
[`src/media/mpris.ts`](src/media/mpris.ts) exports it; the audio side reads the CORE's
store and the video side reads the pipeline, and *Why the commands go through the
caller* in that file says why those are different.

Four marshalling mechanics had to be established first, and none of them is something
a type would have caught. [`src/debug/mpris-probe.ts`](src/debug/mpris-probe.ts) is
where they came from — `npm run mpris-probe -w @correctiv/desktop`:

| asked | measured |
| --- | --- |
| two interfaces on ONE object path? | yes. The spec puts `org.mpris.MediaPlayer2` and `…Player` both at `/org/mpris/MediaPlayer2`, `wrapJSObject` wraps one interface per object, and two exported objects at the same path both answer — D-Bus registration is per (path, interface) |
| what does an `a{sv}` getter return? | a PLAIN object whose VALUES are `GLib.Variant`. `mpris:trackid` came back as `objectpath`, `mpris:length` as `int64`, `xesam:artist` as an array, and a title carrying „Größe" survived as UTF-8 |
| does `x` (int64) survive both ways? | yes — a `Seek` of 5 000 000 reached the JS as exactly that |
| does a `readwrite` property reach a setter? | yes — `Volume` set to 0.42 arrived |

Then measured against the running app, over `gdbus`:

| | |
| --- | --- |
| radio playing | `PlaybackStatus` **Playing**, title `Salon5 Radio`, artist `● LIVE · 24/7 aus Bottrop`, position advancing, **`CanSeek` false and no `mpris:length`** — which is right, a live stream has neither |
| control from the bus | `Pause` → **Paused** with the position frozen at 17 776 018 µs across two samples two seconds apart; `PlayPause` → **Playing** and moving again |
| `PropertiesChanged` | **exactly two signals for two changes** over a nine-second window in which the audio store dispatched about eighteen 500 ms ticks. The service diffs against the last published snapshot, and `Position` is deliberately outside that diff because the spec keeps it out |
| a video takes it over | trackid advances to `/org/correctiv/track/2`, the real title and thumbnail, `xesam:artist` `FunFacts`, `mpris:length` **850 000 000 µs** — and `CanSeek` **true**, where the radio was false |
| seeking a video from the bus | `SetPosition` to 400 s landed at 403.08 s; `Seek -60 s` took 406.1 s to 349.6 s; and `SetPosition` carrying a **stale trackid was ignored**, which is the guard the spec asks for |

**THE HAND-BACK IS THE PART A WINDOW COULD NOT TEST, and it is where the bug was.**
`release` first put the service back to silence unconditionally, so radio → video →
close left a GNOME panel empty above a still-playing radio, permanently: the audio
binding claims once and thereafter only reports changes, so its own record said it
still held the name. Two players deep, invisible in a screenshot.

So the ordering moved into [`src/media/arbiter.ts`](src/media/arbiter.ts), which has no
`gi://` import, and [`test/mpris-arbiter.test.ts`](test/mpris-arbiter.test.ts) drives
it: six vectors, and three mutants killed — `release` blanking the stack (the shipped
bug, which fails five of the six), `claim` always reporting a change, and `claim`
duplicating an entry instead of moving it.

**What is NOT driven, said rather than implied:** the hand-back in the running app.
Confirming it needs the video screen to unmount, which needs a navigation this machine
cannot perform — `ActivateWidget` answers `true` on Adw's back button and pops nothing
(measured: the media strip was still in the tree afterwards, because Adw's back action
responds to a click and `gtk_widget_activate` is not one), `SendKey` reaches a widget's
own key handlers rather than routing an event, and there is no synthetic pointer input
here. The claim direction IS driven, end to end, in the table above.

`Raise`, `Quit`, `Next` and `Previous` are exported and answer nothing, with
`CanRaise`, `CanQuit`, `CanGoNext` and `CanGoPrevious` all false so a shell does not
offer them; `Rate` is read-only at 1 rather than reporting a speed a shell could not
change back. `TrackList` and `Playlists` are separate interfaces and are not exported
at all — `HasTrackList` says so.

**THE MINI PLAYER, AS ADWAITA WIDGETS.** The phone pins a now-playing strip above its
tab bar, and this host could not have one — not for want of trying, but because there
was nowhere to put it. `<Tabs>` reads its children as `<Tabs.Screen>` declarations and
refuses anything else, and wrapping `<Tabs>` from outside does not work either: the
switcher is created with `slot="title"`, which resolves against the PARENT, so a box
placed between the tab layout and the header bar takes the switcher's slot away and the
router refuses it by name.

So the seam went upstream: [gjsify#1617](https://github.com/gjsify/gjsify/pull/1617)
gives `<Tabs>` a `bottomBar`, and `Adw.ToolbarView` then carries the strip and the view
switcher bar together. Which one is on top is a fact about Adwaita rather than about the
router — MEASURED on libadwaita 1.9.3, two bottom bars in a 480x320 window:

| bar | y | height |
| --- | --- | --- |
| the content | 0 | 214 |
| added FIRST | 217 | 40 |
| added SECOND | 257 | 24 |

The first-added sits closer to the content, so the router renders the caller's bar
before the switcher bar. Photographed at 420x760, the strip is above the tab bar, which
is the phone's arrangement; at 1100 wide it is at the foot of the window.

**IT IS ADWAITA, NOT THE PHONE'S STRIP REDRAWN**, which is the part worth having.
[`src/media/mini-player.tsx`](src/media/mini-player.tsx) is `.toolbar` around a
`.circular .suggested-action` button, a `.flat` button holding `.heading` and
`.caption .dim-label` labels, and `media-playback-start-symbolic` from the icon theme —
so it inherits Adwaita's padding, focus ring, hover state and dark-mode colours instead
of restating them. The STATE is the core's audio slice, the same selectors and actions
the phone's strip uses; only the drawing is native. `Gtk.Label`'s `ellipsize` does the
one-line title, which also stops a long episode name setting the window's minimum
width.

Nothing playing costs nothing: the component answers `null`, the router's wrapper box
is then an empty bottom bar, and an empty bottom bar takes NO height — measured, the
view stack above it is allocated identically either way. So the strip is absent rather
than collapsed, and there is no reveal animation to arrange.

**ADWAITA'S OWN WIDGETS ARE BRAND RED**, and getting there corrected two wrong claims
of this document's.

The mini player's play button wears `.suggested-action`, which paints in the accent —
and that was Adwaita's blue, two rows under a brand-red LIVE banner. ~~The brand colour
is not on offer in any case, because `Adw.AccentColor` is an enum.~~ **Wrong, and it
turned a choice into a limitation.** That enum is only how an app READS the system's
pick; the accent reaches widgets as CSS, so an app can define it.
[`src/debug/accent-probe.ts`](src/debug/accent-probe.ts) asks each spelling in a process
of its own — `npm run accent-probe -w @correctiv/desktop`, plus `-- --bg-only`,
`-- --legacy`, `-- --legacy-standalone` and `-- --light`. Asking for `#ff5c5c` and
reading a resolved standalone accent off a `.accent` label:

| what the app installs | standalone accent reads |
| --- | --- |
| nothing — the system's, dark scheme | `0.504 0.817 1.219` |
| `--accent-color` and `--accent-bg-color` | `1.000 0.361 0.361` — exactly what was asked |
| **`--accent-bg-color` alone, dark** | `1.231 0.570 0.551` — DERIVED, lightened |
| **`--accent-bg-color` alone, light** | `0.730 0.033 0.138` — DERIVED, darkened |
| `@define-color accent_color` + `accent_bg_color` | `1.231 0.570 0.551` |
| **`@define-color accent_color` ALONE** | **unchanged** — the legacy standalone name is ignored |

~~The pre-1.6 `@define-color` applies, but not as the value given.~~ **Also wrong**, and
the last row is what showed it: on its own the legacy standalone name moves nothing. The
earlier reading came from `@define-color accent_bg_color` in the same run plus Adwaita's
derivation — a conclusion drawn from two variables changed at once.

**SO THE APP SETS ONLY `--accent-bg-color`, and that is the whole design.** libadwaita
keeps two accents: the background one a `.suggested-action` button is painted with, and
the standalone one accent-coloured TEXT uses, which has to stay legible on the window.
Setting both is the obvious move and would have shipped an accessibility regression —
the third and fourth rows are why. Adwaita derives the standalone accent PER SCHEME,
lightening it for a dark window and darkening it for a light one, and pinning it to the
app's own token instead would have put a pale red on white in light mode.

`--accent-fg-color` is left alone too, and for a weaker reason said plainly: the
on-accent foreground read white both before and after in every measurement, so it did
not need setting for THIS colour. Whether Adwaita would flip it to black for a pale
accent is not measured here.

It is installed in `entry.tsx`, from the same token scale every class in the app
resolves against — `rgb(255 80 100)` light, `rgb(255 97 115)` dark — and right after
the preference has been applied and `dark` read, so it agrees with the palette by
construction. Like that read it is once per launch and needs the same restart.

**It costs a SECOND `Gtk.CssProvider`**, which `style/sheet.ts` argues against: that
file keeps one so a minted class cannot be shadowed by a rule at another priority. The
argument is about classes, and `StyleSheet` exposes only `classFor(declarations)` —
there is no API for a rule with a `:root` selector. The two providers touch disjoint
selectors and cannot shadow each other; what it costs is a second entry in the GTK
inspector.

Photographed in both schemes: the strip's play button matches the banner above it, on a
dark window and on a light one.

Two things to know before comparing any of these numbers with an sRGB triple by eye.
The readings run ABOVE 1.0 — the untouched dark-scheme blue reports `1.219` in its blue
channel — so `Gtk.Widget.get_color()` on GTK 4.22 is not handing back plain 0..1 sRGB.
And a write-only module variable holding the provider was deleted rather than renamed:
`no-unused-vars` called it out, and it was insurance against a hazard that does not
exist, because `add_provider_for_display` takes a reference on the C side.

**A letter-spaced mark is one pixel short of its own text, and only one lever moves
that pixel.** MEASURED on GTK 4.22.4: a wrapping `Gtk.Label` whose text contains a
space reports a natural width below what Pango needs to set it on one line, by about
the tracking itself — 0 at `letterSpacing: 0`, 1 px at 0.4, 1, 1.2 and 1.5, 2 px at 2,
3 px at 3. A mark sized to its own content is therefore allocated exactly one pixel
too little at every window size, and what it does then depends on how it runs out:

| the mark | what it did |
| --- | --- |
| the yellow Backstage band, wrapping | „LESEN" on a second line the parent had committed no height for, clipped |
| the rail's badge, `numberOfLines={1}` | ellipsized at its natural width: „FAKTENCHE…" |

Same missing pixel, two symptoms, and a single-word mark („RECHERCHE", „Live",
„Spotlight") has no break opportunity and was never affected — which is why it only
ever showed on the two-word ones.

**Padding cannot fix it**, measured: it raises the natural width and the text's own
budget by the same amount, so the shortfall survives (165 → 166 → 167, still short).
That is why the first attempt at this failed and was reverted. `width-request` is the
only lever that moves one and not the other, and GTK ties it to the MINIMUM width as
well — so the fix is scoped to `numberOfLines={1}` in
[`src/shims/react-native.tsx`](src/shims/react-native.tsx), where a floor at the
one-line width is not a side effect but the behaviour the phone already has:
`flexShrink` defaults to 0, so a one-line label is never squeezed below its content
there either. Upstream it is an `it.failing` vector in gjsify's `text-metrics.spec.ts`,
and when GTK reports the width Pango needs, both go at once.

**A card is pinned open by one unbreakable word, and the obvious fix was measured and
rejected.** The live-radio banner would not shrink with the window, because a stream
announced its track as `20260901_Gamescom_Laberpocast_Sophie_Amelie_final` — one token
with no break in it. MEASURED on GTK 4.22.4: a `Gtk.Label` wraps at WORD boundaries, so
its MINIMUM width is its longest word, and that minimum IS its contribution to the
layout. 394 px for that string, and the card could be no narrower.

`wrap-mode: word-char` takes the minimum to 13 px, and it is the wrong fix. Measured
across five cases:

| text | `numberOfLines` | `word` | `word-char` |
| --- | --- | --- | --- |
| that filename | 1 | 13 | 13 |
| that filename | 2 | 394 | **13** |
| `Bundesverfassungsgericht` | 2 | 187 | **15** |
| `Live` | 1 | 13 | 13 |
| `Live` | 2 | 29 | **14** |

At one line it changes nothing — `ellipsize` already collapses the minimum. At two it
fixes the filename AND lets a short label be squeezed until Pango breaks it inside the
word: the club badge rendered as „LIV-“. A two-line card title in a narrow column is
the ordinary case, so there is no threshold that separates the two.

AND THE REAL CAUSE IS THE SAME ONE AS THE RAIL BELOW. React Native's `flexShrink`
defaults to 0, so a box is never squeezed below its content and its line-breaker never
gets asked; Android's own breaker would in fact break that word. Lowering a GTK label's
minimum lets GTK do something React Native never has the chance to do. It is a
`flexShrink` question wearing a `wrap-mode` costume, and GTK has no property for the
real one. Withdrawn upstream (gjsify #1600) with the measurement rather than merged.

**FIXED HERE INSTEAD, at the one label that needs it.** `numberOfLines={1}` is the
lever the table above was missing: at ONE line `ellipsize` is allowed to do the work
and the minimum collapses for any text at all. Measured on the three cases:

| text | `numberOfLines={1}` | `numberOfLines={2}` |
| --- | --- | --- |
| `20260901_Gamescom_Laberpocast_Sophie_Amelie` | **13** | 358 |
| an ordinary track title | 13 | 32 |
| the „Live" badge | 13 | 29 |

So `LiveBanner`'s now-playing line is single-line. Seen end to end as the station
changed track: with that filename the label's minimum was 311 and the page's 439, and
at 360 px — the window's own minimum — the bottom tab bar lost „Profil" entirely; with
the fix the same label reads 13, the page 238, and at 360 all five tabs are there with
one label ellipsized. The cost is that a long ordinary title ellipsizes instead of
taking a second line, which is what a now-playing line does everywhere else.

**What is left is the natural width.** GTK measures a widget's minimum height in the
other orientation AT ITS NATURAL WIDTH, and a card's natural width is its title on one
line — 400 px for a card that renders at 155. So the rail reserves the height a 400 px
16:9 image would need. The fix is for `width: 155` to CAP the natural width, and GTK
has no property for that: `width-request` is a minimum by its own definition, and the
only container measured to cap a natural size is a scrolled window, which is a widget
per element rather than a property. Named here rather than half-fixed: an earlier
attempt gave the content its natural width instead, which corrected every chip row and
made every fixed-width tile grow past the width it declared.

**A letter-spaced label that is given exactly its natural width wraps and is clipped**,
and the cause is GTK's rather than this app's. Four labels of seventy-six: the masthead
date, two overlines, one centred line of small print. Each is allocated its own natural
width — which is what a flex container gives a child that does not expand — and at that
width GTK lays it out on two lines while its parent measured the height for one.

GTK's natural width for a wrapping label is `ceil(logical width)`, and Pango's logical
extents exclude the spacing after the final glyph while its line-breaker counts it. So
the breaker needs `ceil(logical + spacing)` and is handed one or two pixels less.
Measured on GTK 4.22.4 over four strings and six spacings:

| letter-spacing | 0.0 | 0.2 | 0.5 | 1.0 | 1.5 | 2.0 |
| --- | --- | --- | --- | --- | --- | --- |
| natural width short by | 0 | 0 | 0–1 | 1 | 1–2 | 2 |

It reaches through CSS `letter-spacing` and through a Pango attribute alike, is
unchanged by all three `natural-wrap-mode` values, and is not helped by excluding the
final character — so there is nothing for this app or for the GTK layer to set. It is an
`it.failing` vector in `@gjsify/react-native` now, which retires itself the day GTK
fixes it. The letter-spaced labels here are `Overline` and the masthead, so the app-side
answer, if one is wanted before then, is a pixel of padding on those two components.

Found with `DumpTree`, and only after that call learned to answer it: the widget reports
`wrap: true`, `max-width-chars: -1`, `hexpand: false`, all correct, and the defect lives
entirely in the allocation-versus-request pair that nothing used to report. That readout
is [gjsify #1589](https://github.com/gjsify/gjsify/pull/1589).

**Four entries left this list, and they are the whole accessibility set.** `@gjsify/react-native`
0.48 answers `accessibilityLabel`, `accessibilityRole`, `accessibilityState`,
`accessibilityHint` and `accessible` on every primitive this app uses
([gjsify #1541](https://github.com/gjsify/gjsify/pull/1541)), so `shims/react-native.tsx`
passes all five through and applies none of them. `test/prop-gate.test.ts` went red on
the upgrade and named all four, which is what it is for.

It is a deletion that ADDS a capability. Two of the four were reimplementations; the
other two were losses. **40 `accessibilityRole` call sites reach GTK for the first
time** — 20 `link`, 17 `button`, one `radio`, one `adjustable`, all four mapped by the
layer. Measured on the running window: 18 widgets now carry `GTK_ACCESSIBLE_ROLE_LINK`
and 10 `BUTTON`, read back through `GetProperty(<path>, "accessible-role")`. Nothing in
GTK defaults a widget to `LINK`, so those eighteen are the prop arriving.

Three further entries left this list because they were already fixed and the list had
not been re-read. **A routed window shows ONE header bar**, since
[gjsify #1540](https://github.com/gjsify/gjsify/pull/1540) in 0.48 — the second and third
bars, each with a close button of its own, are gone, and the screenshots on this page
were re-shot for it. **The brand typefaces are in the chrome now** — see below; the faces ship in
the payload and are registered at startup. **A chip row wraps**, since
`@gjsify/react-native` 0.46 maps `flex-wrap` to a wrapping widget; the shim's own note
to remove its stripping branch had been acted on and this sentence had not.

## How to run it

Needs GTK4, libadwaita, WebKitGTK 6.0 and GStreamer (base + good). On Linux it also
needs `gjs`; on macOS and Windows it does not — see *Two hosts, one source* below.

```bash
npm install                                 # from the repo root
npm run build     -w @correctiv/desktop     # dist/app.gjs.mjs   (Linux)
npm run start     -w @correctiv/desktop
```

**The app opens on the door.** Since [ADR 0016](../../adr/0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md)
the root layout renders `LoginGate` instead of the navigator while the session is not
admitted, on this host as on the phone. Sign-in is simulated: any address gets in, with
any password of four characters or more. What that means for the two aids below is that
**they are behind the door too** — no route is mounted until a session is admitted, so
`CORRECTIV_DESKTOP_ROUTE` cannot land, and the log says
`CORRECTIV_DESKTOP_ROUTE was never applied within 15000 ms` rather than pretending. The
route sweep reads that as a failure, on purpose: a run that never left the door has
nothing to say about the route it was asked for.

So sign in once. The session persists to
`$XDG_CONFIG_HOME/correctiv-desktop/settings.ini`, where every later run finds it.

Three development aids, all environment-gated and all no-ops otherwise:

```bash
# Start on a particular route. Needs an admitted session in the profile; see above.
CORRECTIV_DESKTOP_ROUTE=/spotlight npm run start -w @correctiv/desktop

# Capture the window to a PNG and exit. In-process, because GNOME 45+ refuses
# org.gnome.Shell.Screenshot to an unsandboxed caller and this session is Wayland.
npm run screenshot   -w @correctiv/desktop   # writes dist/screenshot.png

npm run audio-probe  -w @correctiv/desktop   # drives the audio port, prints the ticks
npm run route-sweep  -w @correctiv/desktop   # opens every route, reads the log

# The two that exist because a green call is not a green outcome.
npm run font-probe   -w @correctiv/desktop   # asks the FONT MAP what it ended up with
npm run gst-probe    -w @correctiv/desktop   # asks the GStreamer REGISTRY what shipped
```

The last two are the instruments this port needed most, and both exist for the same
reason: the thing that reports success is not the thing that answers the question.
`initFonts()` reports what `add_font_file()` returned, and Pango does not report a
missing family — so a face can register successfully and the app still wear Tahoma.
A GStreamer error string reports a symptom whose cause it names wrongly — the same
`Internal data stream error` means "no TLS backend" in gjsify's own notes and meant "no
mp3 decoder" here. Each probe asks the subsystem instead of the call.

### Driving it from outside

`GJSIFY_DEVTOOLS=1` exports `org.gjsify.Devtools` on the session bus, at
`/org/correctiv/AppDesktopExperimental/devtools` under the application's own name. It
is opt-in and a no-op without the variable, so a normal run is byte-unchanged.

```bash
GJSIFY_DEVTOOLS=1 npm run start -w @correctiv/desktop
```

Twenty-six methods, of which four answer questions this host could not answer before:
`DumpTree` (the widget tree with stable positional paths), `GetProperty`,
`Screenshot` (the window, **or one widget by path** — its PNG dimensions are that
widget's allocation, which is how the clipped header date was measured), and
`FindWidget`/`ActivateWidget`/`SendKey`, which click- and key-drive the running app.

Nothing here wires it. It arrives with `registerRootComponent`, because
`RunApplicationOptions` extends the shell's whole option set rather than forwarding a
list of fields — the option that a forwarding list dropped was this one, and gjsify
#1455 is that omission. Reading a `-w @correctiv/desktop` flag is the whole setup.

**What it does not answer.** A widget's SIZE REQUEST. `DumpTree` says a widget is
mapped and `GetProperty` says its properties are what the code set, and neither
distinguishes a label that was allocated the width it asked for from one that was
allocated less and is now clipped. Rasterising each widget and reading the PNG header
is the workaround, and it reports the allocation without the request, so it says *that*
a widget is the wrong size and never *whose* arithmetic made it so.

### The one-line marks traded one defect for another, and only here

`ui/Overline` carries `numberOfLines={1}` and `flexShrink: 0`, which this branch
measured and `main` now carries with the argument written up (PR #123). On a phone
and in a browser it changes no rectangle at all; that was measured on both targets.
On THIS host it trades one visible defect for another, and the pair of screenshots
says so:

| | `screens/home.png`, 5 September, before the fix | after it |
| --- | --- | --- |
| `BACKSTAGE · FRÜHER LESEN` | wraps, and „LESEN" hangs clipped below the yellow band | one line, whole |
| `SPOTLIGHT` | whole | `SPOTLIG…` |

Both are the same underlying fault: a letter-spaced label is allocated its own
natural width, which Pango finds about the letter-spacing short of what it needs.
Wrapping spends the shortfall on a second line the parent has no height for;
ellipsizing spends it on the last glyph. Neither avoids it, and `flexShrink: 0` does
not either — `SPOTLIGHT` sits in a `justify-between` row beside "Alle Ausgaben", and
it is still the one that gives.

**So the claim in `Overline`'s own docblock that a single-word mark "has no break
opportunity and was never affected" is true of the WRAPPING and not of the fix.**
That sentence is on `main` and should say so; it was written from this branch's
measurement, which only ever looked at the two-word case.

The real remedy is upstream, in the pixel the natural width is short by. Until then
this host shows a truncated `SPOTLIGHT` where it used to show a whole one, and that
is worth more than a clipped `LESEN` only because the band is what a reader notices.

### CI had not looked since August, and the pin was a minor behind

`npm run check` passed here and failed on CI, and the reason was not the one it
looked like. The manifest pinned `^0.47.0`; a caret on a `0.x` version holds the
MINOR, so CI installed 0.47.0 while `@gjsify/react-native` 0.48.0 had been on npm
for weeks. Two failures, one cause:

- `test/prop-gate.test.ts` reported the four accessibility props "refused again, so
  the ledger is wrong". They are answered in 0.48 and refused in 0.47, so the ledger
  was right and the installed layer was old.
- `src/app/(tabs)/_layout.tsx` could not typecheck `<Tabs bottomBar>`.

The pin is `^0.48.0` now, and the check passes against BOTH the published package and
the working copy, which is the pair that matters here.

**`bottomBar` still needs a cast**, and this is where the release line actually falls.
It is in the working copy (`0.48.0-48-g…`, forty-eight commits past the tag) and not
in the 0.48.0 release, so the tab layout carries one cast with a note to delete it on
the release that brings the prop. That is a typed hole somebody wrote down rather than
a red branch, and the reason for preferring that is below.

**WHAT IS WORTH RECORDING IS HOW LONG NOBODY SAW ANY OF IT.** The last CI run on this
branch was 2026-08-31, at `fca1c59`. The mini player arrived after that, in `13bf905`,
and the branch head had never been through CI: it was pushed without a pull request,
so nothing ran. The first run against the current head was the pull request that added
this paragraph, six weeks later, and it found a stale pin, a version-skewed ledger and
a type error in one go.

A host developed against an unreleased library has a gap between what passes here and
what passes there. That gap is narrow and manageable. What it should not have is
nobody looking, and the answer is a pull request per change rather than a push.

### Against a gjsify working copy

Every defect this host has left is in gjsify rather than here, so the loop that matters
is the one from a fix there to a screenshot here. `scripts/gjsify-link.mjs` makes it
minutes instead of a release:

```bash
npm run gjsify:link   -w @correctiv/desktop -- --repo ~/src/gjsify   # once
npm run gjsify:status -w @correctiv/desktop                          # what is linked
npm run gjsify:unlink -w @correctiv/desktop                          # published again
```

It replaces every `node_modules/@gjsify/*` the working copy has a package for — all
ninety, not the four this app names — with a symlink, stashing the published directory
so `--unlink` is a rename rather than a download. All of them, because a linked package
resolves its OWN imports through the working copy: linking four would leave a bundle
holding two release trains, and gjsify's release train promises compatibility inside a
release, not across one.

**Build the working copy first.** `@gjsify/*` publish `lib/`, which is gitignored, so a
fresh checkout has every package's source and none of its entry points. The script
refuses to link an unbuilt package and names it rather than producing a bundler error
about a module that is plainly there.

**A linked package needs its peer dependencies pinned**, and `gjsify.config.mjs` does it
— see `peerDedupePlugin`. `react` and `react-reconciler` are peer dependencies of
`@gjsify/react-native`, which under npm's hoisting means one copy and nothing to decide;
through a symlink the layer resolves them in the gjsify checkout, where a second React
is installed as a devDependency. Two Reacts in one bundle, and the message is
`TypeError: can't access property "useMemo", z.H is null` from inside a `Provider`,
which reads as a bug in the layer.

`build:gjs` and `build:node` print which gjsify produced the bundle, down to the
checkout's `git describe`:

```
gjsify: LINKED — 90 package(s) from a working copy, not npm.
  /home/…/gjsify
    v0.48.0 · detached · v0.48.0-4-g0899bcc9ac · feat(adwaita)!: a page is chosen…
```

That readout is the point rather than the link. A version number does not distinguish
two bundles built an hour apart from a moving checkout, and "fixed upstream, this app
picks it up on the next bump" is the sentence this README already records ageing into a
false one. A claim about a dependency needs the dependency named in the build log.

### Two hosts, one source

Linux runs the `--app gjs` bundle on the distribution's own GJS. macOS and Windows have
no system GJS at all, so there the same source is built `--app node` and runs on Node
with [`@gjsify/node-gi`](https://www.npmjs.com/package/@gjsify/node-gi) bridging `gi://`.
gjsify's own ADR 0024 makes the same split for packaging: on Linux a `Depends: gjs` is
honest, and bundling ~100 MiB of interpreter beside it would not be.

Nothing in `src/` is host-conditional — the bundler rewrites every `gi://` import into a
lazy `requireGi()` call, so the split lives entirely in how the bundle is produced:

```bash
npm run build:node -w @correctiv/desktop     # dist/app.node.mjs  (macOS, Windows)
npm run build:all  -w @correctiv/desktop     # both

npm run start:node -w @correctiv/desktop     # run the other bundle deliberately
npm run route-sweep -w @correctiv/desktop -- --host node
```

**Run the node host from Linux.** It is the only machine that can run both, so it is the
only place the macOS/Windows bundle gets exercised before it reaches those machines.

### The three targets, measured on each

Every cell below was measured on the machine it names, on 2026-09-04, against
`@gjsify/*` `^0.47.0`. Nothing here is inferred from another platform — the note this
table replaced said "a claim proven on one of them has never yet held on the others",
and that turned out to be the most reliable sentence in the file.

| | Linux (gjs) | macOS darwin-x64 (node) | Windows win32-x64 (node) |
|---|---|---|---|
| Window + chrome | ✓ | ✓ | ✓ |
| Routes | **24 of 24** | **24 of 24** | ✓ Home and the reader; not swept |
| **The reader** | ✓ WebKitGTK | ✓ **WKWebView shim** | ✓ **WebView2** |
| Brand typefaces | ✓ | ✓ **inside a `.app`**, never outside one | ✓ |
| Bundled episode | ✓ | ✓ | ✗ no mp3 decoder |
| Live radio | ✓ | ✗ two GObject copies | ✗ no mp3 decoder |
| Accessibility labels | ✓ | ✓ | ✓ |

**The reader works on all three, and the engine was never in the runtime bundle.** It
comes from a package of its own — `@gjsify/webkit-native` on macOS,
`@gjsify/webview2-native` on Windows — and this host had simply never declared either.
Both answer to `gi://WebKit`, so nothing in `src/` branches. Measured, on each:

    [desktop] WebView: loading 523925 bytes of HTML.
    [desktop] WebView: load finished

`decide-policy` exists on neither shim, and that costs nothing: the portable click
interceptor this app already wrote for its web target gates navigation instead, and it
was written before it was needed for exactly this reason.

**On Windows the web view cannot be overlaid, and that is by construction.** WebView2 is
a child window the OS composites on top of the application (gjsify ADR 0035 stage 1), so
it is not a node in GTK's scene graph and anything drawn over it lands underneath. The
backend says so itself, once, naming the arrangement it found:

> this view is the main child of a GtkOverlay, so anything overlaid on it will be drawn
> UNDER the web content instead of over it

That made the reader a dead end there — its only way back is the button in its own
floating header. So the header is now ORDERED rather than positioned: a strip above the
document where the view cannot be overlaid, floating over it where it can. See
[`src/platform/webview.ts`](src/platform/webview.ts), which carries the measurement and
the trigger that removes it (ADR 0035 stage 2 puts the view in the scene graph).

**Audio is the one that got worse the more it was measured**, and the two failures have
nothing to do with each other:

- **macOS** — `souphttpsrc` ships and works; what breaks is that the bundle's own
  `libgstsoup.dylib` reaches libsoup through `g_module_open` **by leaf name**, and on a
  host with Homebrew glib that resolves to Homebrew's copy, which brings Homebrew's
  GObject with it. Two type systems in one process, so `g_type_name()` returns GObject's
  internal qdata quark strings and the stream silently never loads. gjsify #1536.
- **Windows** — the runtime bundle ships **no mp3 decoder**: `mpg123`, `vorbis` and
  `flac` are all absent from the payload while the builder's own seed list names them,
  so `mpg123audiodec` is NULL. The bundled episode and the Icecast stream are both mp3,
  which is why nothing plays. `soup` and the TLS backend are both fine there — the
  `Internal data stream error` the stream reports is the string gjsify documents for a
  missing TLS backend, and it is not that. gjsify #1544; `npm run gst-probe` is the
  probe that separates them.

**Brand typefaces need a `.app` on macOS, and now that is measured rather than
inferred.** `pango_font_map_add_font_file()` is a vfunc the CoreText map does not
implement, so the faces come back `declined` and the intended path is declarative: a
`.app` carries `ATSApplicationFontsPath` and the OS activates the staged directory
before the process starts. Same binary, same five faces, asked the same way:

| | outside a `.app` | inside the `.app` |
|---|---:|---:|
| families on Pango's map | 187 | **189** |
| `Merriweather` / `Source Sans 3` | ABSENT | **present** |
| every cut resolved to | Helvetica | the requested family |
| what `initFonts()` reported | `declined 5` | `declined 5` |

The last row is why `npm run font-probe` exists: the registration result is IDENTICAL in
the working case and the broken one, so nothing but the map can tell them apart. gjsify
had this open — its own ship output says the activation reaching CoreText is
"UNVERIFIED: no leg in this repository runs a `.app`" — and this is the confirmation,
reported back as gjsify #1354.

One precondition is easy to lose: the bundle's launcher must `exec` the node INSIDE
`Contents/MacOS/`, which it does once `@gjsify/node-runtime-darwin-x64` is installed. A
launcher reaching a `node` off `PATH` would run a process whose main bundle is Node's,
and `ATSApplicationFontsPath` would name nothing — same artifact, same `Info.plist`, no
fonts.

And one defect is measured and open upstream: a GTK app on `@gjsify/node-gi` dies
intermittently in the GI bridge (SIGSEGV or SIGABRT, roughly one run in three here),
which is a known nondeterministic lifetime bug in the bridge rather than anything this
app does. `npm run start:node` reports the signal by name rather than swallowing it.

## How it is put together

`ARCHITECTURE.md` puts the cost of a host at one file implementing four interfaces, and
[ADR 0007](../../adr/0007-removing-the-nativescript-host.md) says that estimate stopped
being theoretical when the NativeScript host was removed. It held here too.

```
src/platform/       the four ports        storage.ts (GKeyFile + Gio), content.ts
src/audio/          the fourth port       GStreamer playbin3, ticks on a 500 ms timer
src/generated/      tokens.generated.ts   from packages/design-tokens/theme.css
src/shims/          what gjsify does not answer yet — see below
src/overrides/      VideoFrame, the placeholder
src/app/            27 route files: 24 re-export the phone's screen, 3 are variants
```

**The route tree is re-exports, not forks.** Twenty-four of twenty-seven files are one
line. The three that differ — `_layout`, `(tabs)/_layout`, `artikel` — each carry a
header saying why, and `test/route-tree.test.ts` fails if the phone grows a screen this
host does not.

[ADR 0071](../../adr/0071-re-exported-screens-and-a-variant-where-the-host-refuses.md)
is the rule behind that, and the part worth reading before adding a fourth variant: a
file may differ for the ports, for a platform idiom an ADR already argues for, or for an
import the support table refuses — and **never for a refused prop**. A prop is answered
on the phone if the phone's own idiom answers it, and otherwise once in the shim below.
The profil crash is what that ordering is made of: the fix was a `Pressable` in the
phone's screen, not a desktop copy of a whole tab.

**The shims are the interesting part**, and every one is a real mapping or a named
refusal — never a silent no-op, because GTK's failure mode is exit 0 and a prop nobody
applied is indistinguishable from an application bug forever.

`src/shims/react-native.tsx` is the one that earns its place. The app passes props the
GTK layer refuses BY NAME in about 110 places, and every one of those refusals is
correct; this is where each gets one deliberate answer instead of 110 render-time
throws. `accessibilityLabel` and `accessibilityState` are **implemented** through
`Gtk.Accessible.update_property()`, which is what the refusal message points at. That
call is made on the WIDGET, and since 0.46 a ref does not always carry one — a
`TextInput` receives a `TextInputHandle` with the widget on `.widget`. `widgetOf()`
unwraps it. Without that the door's two fields, the only `TextInput`s in the app, lost
their screen-reader labels behind a warning that named the symptom and not the cause;
everything else on screen kept working, which is why nothing else caught it.
`hitSlop` is dropped, correctly — it is a concession to a fingertip on a platform whose
pointer is a mouse. It also flattens `style` arrays, translates six style properties GTK
spells differently, gives `justify-between` the spacer child its refusal asks for, and
gives a `Pressable` an inner box because a `Gtk.Button` takes one child and cannot be an
overlay.

**Two of its answers are the door's, and both are on their way upstream.**
`accessibilityLiveRegion` is dropped and is the honest loss: GTK4 has no live-region
property, its counterpart `Gtk.Accessible.announce()` is an imperative call needing the
moment and the text, and both uses are on the sign-in form — so a screen-reader user is
told nothing there about a failed sign-in. `@gjsify/react-native` is growing an answer
for it on `Text` through that same call, which is where it belongs. The other **has landed and the local
answer is gone.** React Native declares `TextInput` as a *class*, so the phone's
`useRef<TextInput>(null)` needs an instance type and its `focus()` needs a handle; the
shim declared both, with `focus` only, because a name this host could not honour would
turn a compile error into a silent no-op. The note said: when the layer grows the real
one, delete the local handle rather than extend it.

0.46 grew it. `TextInputHandle` answers all five members React Native documents,
refuses the four it cannot over GTK by name, and keeps the widget on `.widget`. Two of
its answers are better than the deleted code's: `blur()` checks that this widget
actually holds the focus before clearing the root's, and `isFocused()` reads
`is_focus()` rather than `has-focus`, which is false whenever the window is not the
compositor's active one. Neither distinction was in the local handle, and both are the
kind a port gets wrong.

Four shims the brief expected are **absent on purpose**: `expo-linking`,
`expo-web-browser`, `expo-constants` and `expo-system-ui` are declared in the app's
`package.json` and imported nowhere, so shimming them would be dead code pretending to
be coverage.

## Checks

`npm run check` at the repo root covers this workspace: the typecheck, the lint, and
eight suites, 57 tests, in under a second. They are the guards a green build does not
give you.

- **`test/support-gate.test.ts`** reproduces the build-time support gate that
  `gjsify build --dialect react-native` would provide. This build does not use that flag
  (`gjsify.config.mjs` says why), so the gate is reproduced here against the same
  published support table — and it runs in a second, with no GTK, and reads the app's
  source, which is where the change will come from.
  **It gates imports, not props**, and that is the hole the profil crash went through:
  green here, green in the typecheck, green in the build, and then no tree at all. The
  named next step is `@gjsify/react-native/prop-table` — the layer's per-prop answers
  published as data with a generated `PROPS.md`, the way `support-table` already
  publishes the per-import ones. This test already reads the app's source; with that
  table beside it, a `<Typo onPress>` fails in a second instead of in a screenshot.
- **`test/route-tree.test.ts`** fails when the two trees drift, in either direction
  ([ADR 0071](../../adr/0071-re-exported-screens-and-a-variant-where-the-host-refuses.md)).
- **`test/root-layout.test.ts`** fails if this host stops rendering `LoginGate` instead
  of the navigator. It went ten commits with the navigator mounted unconditionally,
  because a missing door has no symptom on the machine of whoever is already admitted —
  which is every machine this host runs on. It checks the phone's file for the same
  construct, so the comparison cannot rot into passing against two files that both
  drifted.
- **`test/webview-gate.test.ts`** covers the reader's navigation gate, including the
  click interception that stands in where there is no `decide-policy` — which is macOS,
  Windows and the web target.
- **`test/tokens.test.ts`** regenerates and byte-compares, then restores the committed
  bytes — "drift is a failed PR, not a discovery"
  ([ADR 0010](../../adr/0010-design-tokens-as-a-shared-package.md)) — and asserts the two
  properties the generator exists to guarantee: whole-pixel spacing, and no token name
  reachable from two scales one family reads.

**What none of that proves is that anything looks right.** The same warning
[TROUBLESHOOTING.md](../../TROUBLESHOOTING.md) opens with applies with more force here,
because this host's refusals happen at RENDER time, per screen: a green check, a green
typecheck and a successful build are all compatible with a screen that throws the moment
it is opened. `npm run route-sweep` is the answer to that — it opens every route and
reads the log — and it is how the three broken tab routes above were found.

**`npm run component-sweep` is the other half of it, and the difference is variants
rather than count.** The route sweep covers whichever components those screens happen
to USE, in whichever variants they happen to PASS. The phone's
`src/gallery/catalogue.tsx` covers every component in `src/components` in the variants
its props allow, and `apps/mobile/__tests__/gallery-catalogue.test.ts` fails when one
is missing, so the list cannot quietly shrink. `<Badge tone="live">` draws a dot the
other three tones do not; `EpisodeRow` has a club form and a default one; `ProgressBar`
has a `durationSec={0}` case for "nothing known yet". A screen passes one of each.
Every prop refusal this host has hit was a prop some particular variant passes.

It runs in two phases, because the whole catalogue at the sweep's deadline is over
half an hour: one process with the whole catalogue first, and only if that shows a refusal,
one process per component — `?c=folder/Name` — so the log names the component rather
than the primitive alone. `<Text> prop "onPress"` says what was refused; it does not
say which of forty-four asked.

## What a review of 2026-09-11 found and this host has not done yet

Four agents read this host against `AGENTS.md`, against the library it is built on, and
against every claim in this file. What they found that is FIXED is above; what is not is
here, because a finding nobody wrote down is a finding that has to be made twice. Ranked
by what it would cost to leave.

**Five shims duplicate a surface the library now ships, and each duplicate is weaker.**
`expo-font`, `expo-status-bar`, `expo-splash-screen`, `react-native-safe-area-context`
and `react-native-gesture-handler` are hand-written here while
`@gjsify/react-native/<surface>` exists: the local `isLoaded()` returns `true` blind
where the surface reads `PangoCairo` families, the local `loadAsync` resolves where the
surface refuses, `initialWindowMetrics` is `null` against a real object, and the surface
refuses the WHOLE package rather than five hand-listed names. Deleting each one GAINS a
capability. It is not done here because each deletion is a behaviour change to verify on
three targets, and the sweep is the only oracle.

**Two dead shim branches, one of them harmful.** `flattenFragments` runs BEFORE
`childNodes`, which expands fragments itself now — so the library's key composition never
sees them and two sibling fragments both yield key `.0`, the duplicate-key bug that code
was added upstream to prevent. `withDefaultTextAlign` duplicates
`widgetProps: { wrap: true, xalign: 0, yalign: 0 }` and says so in its own comment.

**`hrefOf`, `pushed` and `canGoBack` in the router shim are dead and wrong.** The library
takes the object `Href` now and reads `navigationRef.canGoBack()`; the local counter
over-counts after a GTK-side pop and admits it. The shim also interpolates `''` for a
missing path param where the library refuses it, so a bad link lands on `+not-found`
silently.

**The `Pressable` text-sink gate is defeated by its own spacers.** The spacer `<View>`s
are inserted before `hasElementChild` is computed, so `<Pressable>text</Pressable>` gets
an inner box and the string becomes an error — the exact failure the gate exists to
prevent. Compute it on the pre-spacer children.

**A fragment link in the reader is treated as a navigation.** `webview-scripts.ts`
`preventDefault()`s every anchor with an `href`, `#footnote` included, and then classifies
it as internal or external. One line before the `preventDefault` fixes it.

**`onDebugRouteApplied` deadlocks after its deadline.** If the deadline fires, `navigated`
stays false and `deadlineArmed` stays true, so every later registration parks forever —
the hazard the `finally` in `applyDebugRoute` was written against.

**Two MPRIS defects**, both in `media/mpris.ts`: `SetPosition`'s guard calls
`trackPath(track.id)`, which BUMPS the serial and changes the published trackid with no
`PropertiesChanged`; and `publish()` assigns `published = next` before emitting, so a
throw from `emit_property_changed` loses that change permanently.

**Dead code**: `MprisHandle.shutdown()` is unreachable, `resetGstAudio()` is "tests only"
and no test imports it, and `GALLERY_SHORTCUT` exists "so the README and the log agree"
while this file hardcodes the accelerator. `debug/audio-probe.ts` cites
`test/audio-ticks.test.ts` as what `npm run check` owns for the re-entrancy contract; that
file does not exist, so the contract is checked only by a probe outside `check`.

**Counts in prose that nothing checks, and several are already wrong.** The table in
`shims/react-native.tsx`' header gives `accessibilityRole` as 40, 41 and 39 in three
places (42 literals today), and `accessibilityLabel` 45 against 47,
`contentContainerClassName` 10 against 18, `justify-between` nine against 12. The same
class as the component count that went wrong in the merge. The cheap answer is not to
write them down: `route-sweep` and `component-sweep` both print their own, and
`route-tree.test.ts` is the precedent for asserting a count as data.

**What belongs upstream and is filed**: gjsify #1640, #1641 (both fixed in gjsify PR
#1649) and #1648, the oracle defect that let a false entry into this host's own prop
ledger. **Not yet filed, ranked**: `onLayout` — allocation is `vfunc_size_allocate`, a
subclass override only the library can make, and its absence is what made a scrubber
invisible here; pointer coordinates on a press, without which a tap cannot become a
position; `aspectRatio`, which the shim already says belongs upstream; a picture's natural
size sizing its parent, measured in two shims here; the `expo-image` decode pipeline,
which is 25 lines here and a P2 gap there; `accessibilityValue` onto `Gtk.Accessible`; the
`-outline`/`-sharp` icon suffix rule, which is 23 of this app's 39 names; a `Gtk.TextBuffer`
binding for a multiline `TextInput`; and `media/mpris.ts` plus `arbiter.ts`, which are 529
lines of generic MPRIS with nothing CORRECTIV in them but a bus name.

## What this does not prove

- **Nobody has used it.** Every screen here was opened by a script and photographed. No
  one has clicked a tab, scrolled a feed with a mouse wheel, resized the window or
  tabbed through a form. The tab switcher in particular has never been *clicked*: the
  deep-link failure above is the only thing known about selecting a tab, and clicking one
  goes through a different path entirely.
- ~~**Linux only.** … Neither was attempted.~~ Voided by the three-target measurement
  above: both webview backends are declared and the reader loads on each. What is still
  Linux-only is VIDEO, because the macOS and Windows runtime bundles ship `gstvideo` and
  no decoder or sink.
- ~~**No performance measurement of any kind**, on any screen.~~ Voided by the cold-start
  work above: 12.7 s traced to one number in the layer, a `Gtk.FlowBox` cap table, and
  13 510 ms down to 700. What is unmeasured is everything ELSE — no screen has been
  profiled, and nothing is known about scrolling, switching a tab or resizing.
- **Two capabilities are dropped and the loss is functional, not cosmetic.**
  `accessibilityValue` reaches no screen reader from a `Pressable` here, so a scrubber is
  a control with no position — except `player/ProgressBar`, whose override is a
  `Gtk.LevelBar` and gets it from the toolkit instead. And `multiline` is dropped, so
  `participate/FormField`'s textarea is ONE LINE TALL: it scrolls sideways rather than
  wrapping. Both are in the refusals table above; they are repeated here because a table
  of answers reads as a list of solved things.
- **The boundary has a third level nobody has reached.** A refusal inside the recovery
  screen itself was uncaught until it was wrapped, and that is fixed — but a refusal
  inside the WRAPPED screen would still take the tree, and nothing exercises
  `RecoveryBoundaryClass` in a test. `root-layout.test.ts` asserts its shape in the
  file's text, which is not the same as catching something.
- **The accessibility work is unverified.** Labels and states are applied through the
  right API; nobody has listened to Orca read a screen. Two things are known to be
  missing rather than unverified, and both are named in the shim: `accessibilityRole`,
  because GTK sets it at construction, and `accessibilityLiveRegion`, which is why the
  door announces nothing when a sign-in fails.
