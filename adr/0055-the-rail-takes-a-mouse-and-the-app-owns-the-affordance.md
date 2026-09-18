# ADR 0055 — The rail takes a mouse, and the app owns the affordance

Status: accepted, 2026-09-18, **built the same day**. Four decisions, one of them the
boundary question that prompted the record and three of them what the built thing does
and deliberately does not do. Retires nothing.

## Context

The app has one horizontally scrolling component, `components/ui/Rail`, and five call
sites: the fact-check cards on Home, the topic chips on Entdecken, the podcast tiles and
the two video rows on Mediathek, and the gallery's own specimen. A finger scrolls it.
The question that produced this record was asked about a mouse, and the report was that
a rail cannot be scrolled with one — neither in the framed app at `/preview` nor in the
site's own document, where the same component is drawn through the build that compiles
`apps/mobile/src` ([ADR 0027](0027-the-handbook-draws-the-apps-components.md)).

**It is worse than "cannot".** Measured on 2026-09-18 against the assembled site — the
workbench with the app's `EXPO_BASE_URL=/app` export underneath it, which is the
arrangement `pages.yml` deploys — driving a real browser at the Mediathek's FunFacts
rail and at `/components/feed/FaktencheckRail`:

| gesture | what happened |
| --- | --- |
| mouse drag | the headline was selected, the rail did not move, and the release **navigated** — `/app/mediathek` became `/app/video` |
| wheel, vertical | the page scrolled by exactly as much as it does beside the rail (60 of 60 px at both points); the rail did not move |
| wheel, horizontal | the rail scrolled, 150 px for 150 px — a trackpad already works |
| scrollbar | there is none. `showsHorizontalScrollIndicator={false}` is `scrollbar-width: none` in react-native-web |

So the only gesture a mouse-only reader would try was not merely inert: it opened an
article they had not asked for. That is the finding this record is about, and it is not
a development inconvenience — it is in the published export.

**What the two surfaces actually are.** react-native-web renders a horizontal
`ScrollView` as a `<div>` with `overflow-x: auto; overflow-y: hidden`, holding a second
`<div>` in `flex-direction: row`; a forwarded ref receives that outer div itself
(`exports/ScrollView/index.js`, `_setScrollNodeRef` → `mergeRefs`). Read out of the DOM
on both surfaces the same day, it is the same element in both: inside the frame at
`/preview` (`overflow-x: auto`, `scrollbar-width: none`, 1164 px of content in 393) and
inside this site's own document on the component pages (792 in 415). One component, one
element, two documents.

## Decision

### 1. The affordance goes into the app's web target, and the workbench gets nothing

`apps/mobile/src/lib/rail/useRailDrag.web.ts`, reached from `Rail`, with a no-op
`useRailDrag.ts` beside it for iOS and Android.

**Because one fix there reaches both surfaces and one fix in the workbench reaches at
most one.** `apps/workbench/vite.app.mjs` puts `.web.tsx` and `.web.ts` ahead of the
bare extensions in `WEB_FIRST_EXTENSIONS`, so the site compiles the app's web half of a
platform pair exactly as Metro does — which is what makes this asymmetric rather than a
matter of taste. Measured after the change, on the same assembled site: the drag scrolls
the rail inside the frame (0 → 326 px, no navigation) **and** inside the site's own
document (0 → 230 px, only the dragged rail moving).

The workbench could reach the other way — the frame is same-origin by
[ADR 0014](0014-the-preview-shell-as-a-package.md), so a script in the site can find the
app's scrollers and attach handlers to them. Three things are wrong with that. It is the
site patching the app's behaviour, so what a visitor to the published app sees and what a
visitor to the framed app sees stop being the same thing, and `/preview` exists to show
the app rather than an improved copy of it. It would have to find the elements by
guessing at a selector — an `overflow-x` scan over a foreign document — where the app can
simply hand its own component a ref. And it fixes nothing for the people the export is
published for.

**[ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md) is not in the way, and it
is worth saying so rather than leaving it implied.** That record forbids the app
depending on the workbench, in one direction. Nothing here imports, names or infers
anything from `apps/workbench`: it is a browser affordance in a browser target, and it
would be identical if this repository had no workbench at all. The new files say
`react`, `react-native` and `document`, and `no-workbench-dependency.test.ts` reads the
manifests, the configuration and the workflow steps that would have to change for a real
dependency, none of which do.

### 2. One component, one platform pair, and the arithmetic in a module a test can run

`Rail.tsx` stays a single file with a single layout and gains one line, `ref={drag}`.
Splitting the component would have put the bleed, the padding and the gap token in two
files to keep in step, for a difference that is entirely behavioural.

The arithmetic is `lib/rail/drag.ts`, which touches no DOM and no React, so
`__tests__/rail-drag.test.ts` can state its rules: the same split
`apps/workbench/src/preview/home/fit.ts` makes, for the same reason.

**The anchor is the grab, not the previous move**, and that is the one rule in there
worth arguing. Summing per-move deltas — which is what the `dragscroll` this borrows from
does, in one expression — loses the over-travel at the ends of a rail: once `scrollLeft`
has clamped, each further delta is absorbed rather than remembered, so the content starts
moving again the instant the pointer turns round and is thereafter offset from the hand by
however far it over-travelled. Anchoring on the grab has no such state to lose, and it is
also what makes the rule testable at all: an incremental answer depends on the path taken,
and a path is not something a unit test can state in a line.

### 3. A press becomes a drag at six pixels, and that click is swallowed

The threshold is asymmetric on purpose: every card in a rail is a link, so swallowing a
click somebody meant is worse than ignoring a five-pixel scroll they did not. Past it,
the `click` that ends the press is taken out by a capture-phase listener on the rail,
because react-native-web invokes `onPress` from the native `click`
(`modules/usePressEvents/PressResponder.js`: "Only when the browser produces a `click`
event is `onPress` invoked") and React's delegated listener sits on the root container,
which the capture phase reaches first.

What decides it is the pointer's **furthest travel from the grab**, not its distance at
the release and not how far the rail moved. Both of the others are wrong in a case that
happens: a drag into the end of a rail moves the pointer a long way and the rail not at
all.

The pointer is captured at the threshold rather than at the press, and the order is
load-bearing. Capture is what makes a release outside the browser window still arrive,
which is the failure mode of a drag-scroll that listens on `window` instead. It also
retargets the compatibility mouse events to the capturing element, so capturing from
`pointerdown` would have made every **tap** on a rail card dead. Measured after the
change, in the frame: a 130 px drag scrolls and does not navigate, a 2 px press
navigates.

### 4. The vertical wheel keeps scrolling the page

Translating a vertical wheel into horizontal movement is the other half of what such a
component usually does. It is rejected here on the measurement in the context above: the
page already scrolls correctly with the pointer over a rail, by exactly as much as it
does beside one. Mediathek stacks three rails down one screen, and a reader scrolling
past them would find the page stop under the cursor and a row slide sideways instead.
Breaking a gesture that works, to reach a rail that now has a gesture of its own, is the
worse trade.

## Why not the alternatives

**A grab cursor, so that the rail says it can be dragged.** Measured the same day and
rejected: the cards are `Pressable`s, so the element under the pointer over almost all of
a rail's area carries `cursor: pointer` of its own, and a child's cursor wins over its
scroller's. A `grab` on the scroller would appear only in the gaps between cards and
flicker as the pointer crossed one, which says less than nothing. Saying it properly
needs a rule reaching every descendant — a stylesheet injected from a hook — and that is
more machinery than the gesture is worth. The affordance is the card cut off at the
screen edge, which is what `Rail`'s own doc comment says the bleed is arranged around.

**Momentum after the release.** Not built. It is a rAF loop, a velocity estimate and a
second way for the swallowed click to go wrong, for a row that is two or three cards
long. The browser gives a finger momentum for free and this gives a mouse none, which is
a difference between the two gestures and not a defect in one of them.

**`dragscroll` as it is written.** The framework it comes from was read for this and two
of its choices were deliberately not taken. It disables itself on a touch-capable
*device* (`'ontouchstart' in window`), which is a question about the machine: a
touchscreen laptop answers yes and loses the drag on the mouse it also has. This asks
about the pointer that is actually pressing (`pointerType === 'mouse'`). And it has no
threshold and no click suppression at all — it dropped upstream's `preventDefault` on
mousedown to keep focus working and never replaced what that was also doing — so a drag
across a link there still follows the link. That is the defect measured above, so
copying it would have fixed half the problem. What was worth taking is the shape: bind
the press on the scroller, drive the move from something wider than it, assign
`scrollLeft` directly, and refuse the native drag image.

**`preventDefault()` on `pointerdown`**, which would stop the text selection and the
drag image in one line. It also stops the compatibility `mousedown`, and `mousedown` is
what focuses an element, so a rail's cards would stop taking focus from a click. A real
loss for a real keyboard user in exchange for a tidier implementation. `selectstart` and
`dragstart` are refused instead, and only while a button is down on the rail.

## What is still open

- **Nothing here has run on a phone**, because there is nothing to run: the native half
  is a no-op and hands `ScrollView` no ref, which is the tree it had before. The web
  half is measured in Chrome and in Chrome only. Firefox and Safari are unrun, and the
  pointer-capture and `selectstart` behaviour is where they would differ if they do.
- **A rail is still not reachable by the keyboard as a rail.** Tabbing to a card scrolls
  it into view, which is how a keyboard gets down a rail today, and a rail whose items
  are not focusable would have no keyboard path at all. None exists in the app now.
  [ADR 0047](0047-the-handle-is-the-pointers-and-the-arrows-are-the-keyboards.md) made
  exactly this split for the home editor's handle, and the same question is open here
  with nobody asking it yet.
- **Right-to-left is not considered.** `scrollLeft` is signed differently across
  browsers in an RTL document; German is the only language that ships
  ([ADR 0049](0049-the-catalogue-is-a-package.md)), so the arithmetic assumes LTR and
  says nothing about the other case rather than pretending to handle it.
