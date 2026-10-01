# ADR 0028 — One shell, and a route that declares its context

Status: accepted, 2026-09-11.

## Context

`apps/handbook/src/App.tsx` was one 330-line component that special-cased the
workbench seven times: `isApp`, `APP_VIEW`, `useWorkbench(isApp)`, a ternary for the
toolbar, one for the tools panel, one for the status bar, and `onFull`. What the
right sidebar held was decided by two booleans (`contents !== null`, `isApp`), and
whether it was open lived in a `useState` that forgot on every navigation — except on
`/workbench`, where `workbench/store.ts` wrote it to the hash under `tools`. Which
inspector panels were open was local to `workbench/ui/Panels.tsx` and reached no link
at all.

Three consequences, and none of them is cosmetic.

**The shell learned what a view had after the view had rendered it.** `useSections`
reads the headings a page put in the DOM, so "is there a contents list" was answered
one commit late. The toggle appeared, then the panel had something in it.

**The workbench was a second site inside the first.** Every part of it that was not
the frame — its controls, its panels, its readout, its link — reached its place
through a branch in `App.tsx` written for it by name. A second view wanting a context
bar would have been an eighth branch.

**Everything about the panel was unshareable.** Opening the console from a warning
count, opening the props of a component, opening a document's contents: none of it
was in the address, so none of it could be handed to anyone. On `/workbench` it was,
which is the proof that it was worth having.

Beside that, `/components` listed all 45 components of `apps/mobile` and drew them by
booting the whole app in an iframe, three at a time. [ADR 0027](0027-the-handbook-draws-the-apps-components.md)
measured the other way of drawing them and shipped two as proof; this is the page
built around that measurement.

## Decision

### 1. The route declares, and the page fills

`apps/handbook/src/shell/views.ts` is a table, one row per view kind. It names the
right panel's sections in order, which of them start open, whether the panel starts
open, what the panel is called, how wide it docks, whether the view fills the
header's context bar, whether it owns the status line, whether `full=1` means
anything on it, and what happens to all of that below the wide breakpoint. It is pure
data and imports no React, so `test/shell.test.ts` reads it without pulling the page
tree in.

`apps/handbook/src/shell/slots.tsx` is how a page fills what the route declared. The
shell renders a target element for every slot the declaration names; the page renders
its content **through a React portal into that target**, from wherever in its own
tree suits it.

Portals rather than a page returning a `{ sections }` object, for one reason that is
not style: **a page's state has to stay in one tree.** `/components`' filter query is
read by the header's bar and by the grid. `/design`'s "loaded" flag is read by the
main area and by the reload button in the context bar. The component route's
rendering switch is read by the panel and by the stage. With a portal each of those
is an ordinary `useState` in the page, and React context crosses a portal unchanged.
And the shell still knows whether a panel exists before the page's first render,
because that comes from the table.

~~A section's badges are a slot of their own, `<id>:tags`, because they stay visible
while the section is shut — "0 warnings" is worth reading without opening the console
— and because the trigger that carries them is the shell's chrome.~~ The slot is
`<id>:mark` and carries one number or nothing;
[ADR 0038](0038-one-tool-at-a-time-in-a-rail.md) §5 measured what it had filled with —
`untouched`, `inert here`, `combination unknown`, `findings, not run` — and a clean
count is one of them. The argument for a slot of its own is untouched and is why two
survive: the chrome outside a tool is the shell's, and a number worth acting on is
worth seeing before the tool is open.

### 2. The address, on every route

`apps/handbook/src/shell/address.ts` owns the hash everywhere, in one grammar:

```
#<head>?<params>
   head    an app route on /workbench (`/artikel`), a heading id on a document
           (`the-four-ports`), empty elsewhere
   params  tools=1|0   the panel, written only when it differs from the default
           open=a,b,c  the open sections, same rule
           full=1      chrome gone, only where the view can go full
           + everything the open view keeps, passed through untouched
```

~~The two parameter lines above~~ are `tool=<id>` since
[ADR 0038](0038-one-tool-at-a-time-in-a-rail.md) §3: the panel holds one tool rather
than a set, so a boolean for the panel and a list of open sections are one name. Both
old spellings are still READ, and that record says what an old link does with them;
neither is written any more. `full=1` and the pass-through are unchanged, and the
grammar around them is this one.

**The two halves cannot collide**, which is what lets one grammar serve both: an app
route starts with `/` and a heading id never does, because `plugin/markdown.ts`'s
`slug()` strips everything but letters, digits, spaces and hyphens.

**A parameter is written only when it differs from the view's declared default.**
That is what keeps a document clean — a reader who toggled nothing keeps a plain
`#the-four-ports`, and the link most people paste is what it was before this change —
and it is what makes a stale parameter harmless, because what the hash says is re-read
against the new view's defaults rather than carried over.

**What it costs, and the two halves of the answer.** `#the-four-ports?tools=1` is not
an anchor the browser scrolls to, because the fragment is no longer an element id. So
the site scrolls itself. That was already half true: `router.tsx` has always scrolled
by `getElementById` after an in-site click, because the target does not exist until
the route has rendered. `App.tsx` adds the other half, on load and on a step through
history, keyed on route and head together so that toggling a panel does not throw the
reader back up the page.

And a hash that says nothing does not shut the panel. Following a link inside a
rendered document sets a bare `#the-four-ports` with no `?`; parsed against the
defaults that would close a panel somebody had opened, so what they last asked for is
held and put back with `replaceState` — which does not scroll, and the browser has
already scrolled on the click.

Every write is `replaceState`. Toggling a panel is not a place to come back to, and a
back button that walked through six panel states is a back button nobody can use to
leave the page.

### 3. Two defaults that look inconsistent and are not

**`/workbench` opens shut**, although it is the view with the most tools on it.
`RELEASE.md` hands out that address to people who want to see the app, and `tools=1`
exists precisely so somebody debugging can opt in and send the opened state as a
link. ~~**`/design` and `/components/<group>/<name>` open open**, because a reader
arrives at those to use the panel rather than to look past it: the design page's main
area is a Figma frame and everything else about it is in the sections, and the
component page's props are the second thing anybody came for.~~ Nothing opens by
default on any view now, and this decision has no second half left —
[ADR 0038](0038-one-tool-at-a-time-in-a-rail.md) §2 is what voided it, and the reason
is that a panel showing one of N cannot open by default without also choosing which,
which no view can answer for its reader. What pays for it there is the rail: every
tool is named and on screen whether or not the panel is.

### 4. Below 1024, the context is the page

`WIDE` stays `(min-width: 64rem)`, which is also `HOST_BELOW` in `workbench/devices.ts`,
so the shell's line and the device line are one number.

~~A `narrow: 'drawer'` view keeps today's sheet. A `narrow: 'page'` view — design,
component, workbench — has no panel and no drawer at that width: the sections are
rendered inline after the page, at the column's full width, and the header's toggle
is hidden because there is nothing to toggle.~~ The two narrow layouts are one since
[ADR 0038](0038-one-tool-at-a-time-in-a-rail.md) §4, so the `narrow` field is gone
with them: the rail lies along the bottom and the panel stands on it over about half
the window. The observation that decides this section is untouched and is what §4
starts from — there is no width to divide at 390px — and what it adds is that there is
height. Where the main area is a frame, it shrinks to a button that sets `full=1`.

The workbench is the exception inside the exception, and it is declared rather than
special-cased: `fullWhenNarrow` is true for it alone, because that is what it has
always done below 1024 — the header, the rail, a sidebar and a status line are most
of a 390px screen, and the app is what the link was for.

### 5. The frame moves to the component's own page

`/components` draws **no frames at all**. Each card draws the component itself, in
this site's React tree, ~~when the reader presses Draw~~. Voided by §6 below,
"Every card draws, and there is nothing to press": the button was item 12
of the redesign brief, settled while a preview still meant booting an app, and mounting all
47 at once was measured only after it had shipped. It draws on arrival.

The reason is a mechanism and not a taste. **A drawn component takes the space its
content needs; a frame always carries a viewport.** A card of roughly 300px would
have to scale a 393pt device window down, the way `workbench/ui/Stage.tsx` already
does, and show a shrunken phone with a component somewhere on it instead of the
component. On `/components/<group>/<name>` the relation inverts: the frame has room,
the device size becomes a real choice again, and `workbench/devices.ts` already holds
the presets for it. That is also the panel's second justification — props, source,
device size and the rendering switch all belong on the right.

The three-frame cap and the "load all" control went with the frames; `src/lib/rows.ts`
and its test are deleted.

**Nothing compares the two renderings and nothing should.** Screenshot diffing is the
flakiest thing in CI, and a check that reddens without cause gets switched off. Where
they disagree the app's bundle is right (ADR 0027), and the disagreement is a finding
for a person.

### 6. Every card draws, and there is nothing to press

The cards shipped with a Draw button on each of them, and it is gone.

It was decision 12 of the redesign, and decision 12 was right about a different page.
It was taken while every preview was a frame booting the whole app: mounting one cost
an app boot, forty-seven of them was forty-seven app boots, and a control that made
the reader ask for each one was the brake on a real cost. The frames left the page in
this same change, and the brake outlived the thing it was braking.

**What a drawing costs now is a React mount, and the bytes are already paid.**
`src/components/direct.tsx` imports `apps/mobile`'s catalogue statically, so every
one of the 45 components is in the chunk the page loads whether or not anybody
presses anything. A button that gates a mount while the download has already
happened does not save the reader the cost; it only tells them there is one. **A
control that gates nothing misrepresents what it costs to look**, and it asks 47
times.

That is the argument, and it is not evidence, so the mount was measured before the
button came off. Chrome for Testing 153 headless, the production build served the way
Pages serves it, `Emulation.setCPUThrottlingRate` for the slow machine, on
2026-09-11. Both columns are the same page and the difference is only whether the
specimens are mounted: the left one is the page with every Draw button untouched.

| at 1280, CPU throttled 4× | 47 cards empty | 47 cards drawn |
|---|---|---|
| first contentful paint | 908 ms | 1,339 ms |
| the last task that blocked the main thread ends | 874 ms | 1,339 ms |
| the longest single one of them | 451 ms | 723 ms |
| scrolling the page end to end | 16.7 ms median, 16.8 ms worst, 0 frames over 32 ms | 16.7 ms median, 16.8 ms worst, 0 frames over 32 ms |
| the page's height | 7,735 px | 7,735 px |

Unthrottled the whole difference is 294 ms against 395 ms. At 390 px, where the grid
is one column and the page is 17,360 px tall, it is 770 ms against 1,189 ms at 4×,
and the 66 frames of a scroll from top to bottom are again all 16.7 ms. At 6× — a
phone from several years ago — the drawn page is interactive at about 2.0 s.

So: **about 100 ms of the first render, 460 ms on a CPU throttled four times, and
nothing at all afterwards.** Paid once, on a page whose subject is what the
components look like. The scroll is the number that would have decided it the other
way and it does not move: 47 mounted React trees sit in the layout without costing a
frame, ~~because a card's preview area is `overflow: hidden` at a fixed height, so
nothing in it is laid out against the page.~~ Voided in one phrase by "The square is
the column, and a crop says it is one" below: the preview area is reserved by
`aspect-ratio` now rather than by a height. Everything else about the sentence stands,
it is still `overflow: hidden` and nothing in it is still laid out against the page,
and the scroll was measured again after the change: 88 frames end to end at 1280, none
of them over 32 ms.

**Therefore no `IntersectionObserver` either.** Mounting a card as it scrolls into
view was the fallback if this had measured badly — invisible to a reader, and still
no control — and the measurement did not ask for it. Deferring 460 ms that nobody can
feel would buy nothing and would put a second lifecycle under every card, which is a
place for a specimen to fail that the page does not otherwise have.

**The reserved height stays, and it is what the button was accidentally providing.**
47 specimens settle at their own speeds; a preview area sized by its content would
reflow the grid under a reader who was already reading it. ~~The height is `11rem`,
fixed, the same number `/diagrams` gives its previews, and the last row of the table
above is the check on it: the page is exactly as tall drawn as empty.~~ Voided by "The
square is the column, and a crop says it is one" below: it is `aspect-ratio: 1`
against a column the grid holds between 19rem and 24rem, so the two grids no longer
rhyme. The check survives the change and still passes, the page being exactly as tall
drawn as empty, and the sentence before this one, which is the reason anything is
reserved at all, is untouched.

**`NOT_DRAWN` and the card state behind it stay too**, though the list is empty and
nothing reaches that branch. It is a list of exceptions, and it is how the next
exception explains itself on the card instead of appearing as a blank one. Deleting
a branch because nothing currently takes it is how the reason gets lost.

The detail route is untouched by any of this: `/components/<group>/<name>` still
offers `direct|bundle`, because there the two renderings are the question the page
exists to answer, and the frame half of it really does boot an app.

### 7. The square is the column, and a crop says it is one

The preview area shipped as `h-[11rem]`, left-aligned, top-aligned, `overflow: hidden`.
Three things were wrong with it and all three are one thing: **176 pixels is a number
about nothing.**

**It was a number that had to be kept in step with a grid it could not see.**
`sm:grid-cols-2 xl:grid-cols-3` gave a 260px column at 640, 379px at 1280, 432px at
1440 and 301px at 1280 with the right-hand panel open — four answers to one question,
against one height written in rem. So the box is `aspect-ratio: 1` now. It is still
reserved and still cannot reflow, because a square of a known width is as definite as
a height in rem, and there is no longer a second number anywhere to drift.

That leaves the column deciding how big the square is, so the grid states a band
instead of a breakpoint: `repeat(auto-fill, minmax(min(100%, 19rem), 1fr))` on the
grid and `max-w-[24rem]` on the card. **The two halves are written apart because
putting them together changes the answer**: `repeat()` counts an `auto-fill` at the
track's maximum when that maximum is definite, so `minmax(19rem, 24rem)` fits two
24rem columns at 1280 where three 19rem ones fit, and loses a whole column to say the
same thing. Measured, not reasoned about: the first attempt shipped exactly that and
drew two cards a row at 1280 with 377px of empty page beside them.

**A short component read as adrift, and it was not centred because centring is the
wrong word for what a card needs.** Three rules, and the third is the one that has
teeth:

- *Vertically, the specimen is centred in the square.* Where a component sits up and
  down carries no meaning for something that lives in a scrolling column.
- *Horizontally, the COLUMN is centred, never the specimen.* The column is the card's
  full width, so nothing moves today; what the rule forbids is shrinking it to its
  content. `ui/Badge` and `participate/ClaimStatusTag` both say `self-start` in the
  app, and a shrink-wrapped column would draw them centred — the card would
  misdescribe the component, and which components stretch and which hug would stop
  being visible at all. That is the same failure as the `<div>` parents three
  sections down, arrived at from the other side.
- *A component taller than the square keeps its top.* It is `my-auto` and not
  `justify-content: center`, and that is the whole mechanism: auto margins take free
  space when there is some and resolve to zero when there is none, so the same one
  line centres what fits and pins what does not. `justify-content: center` would split
  the overflow between both edges and shave the top off every tall component, which
  is the half a reader most needs — a screen's header, a card's title.

**And a card that cannot show all of a component now says so.** A crop passing itself
off as the whole thing is the same lie [ADR 0027](0027-the-handbook-draws-the-apps-components.md)
took the frames off this page for, when a 393pt phone stood in for a one-pixel
`Hairline`; the fixed height was telling a quieter version of it 20 times over. A
clipped card gets a fade to the page's own ground at its lower edge and one line in
it saying how tall the component really is — `Clipped · 484 px tall` — which is
exactly the fact the crop hides.

**Not scaled to fit**, which was the only other candidate. `gate/LoginGate` is a
screen; a screen shrunk into a 340px card is an unreadable thumbnail claiming a size
the component has never had, and that is the frame's failure with a different
mechanism. The whole component is on `/components/<group>/<name>`, which draws every
specimen at its own height and clips none of them, and the link the card already
covers its square with is the way there. The marker is `aria-hidden` and the fact is
in that link's label instead, so the one thing on the card a reader cannot act on
reaches them attached to the thing that resolves it.

**Which components clip is measured at runtime and named nowhere.** A `ResizeObserver`
over the square and the column, and `clips(content, stage)` with a pixel of slack
between them. A list of names in this repository would be right the day it was
written: the set moves with the column, with the window, with the right-hand panel,
and with the app, where a component gaining one row grows by 24 pixels. Measured on
2026-09-11 against the 47 specimens, natural height against card width, counting how
many are taller than a square of that width:

| card width | 277 | 301 | 322 | 340 | 379 | 420 | 432 | 520 |
|---|---|---|---|---|---|---|---|---|
| clipped, of 47 | 9 | 5 | 4 | 3 | 3 | 3 | 3 | 0 |

The median natural height is **122 px at every width**, because most of these are
single-line rows that widening cannot shrink further. What binds is the tall minority,
and it thins out fast between 277 and 340 and then barely at all — which is the
argument for the band's floor being where it is rather than higher.

What the shipped grid gives, measured the same day on the assembled site:

| viewport | column | square | clipped |
|---|---|---|---|
| 390 | 279 | 277 | 8 |
| 768 | 324 | 323 | 4 |
| 1024 | 384, capped | 382 | 3 |
| 1280 | 379 | 377 | **3** — `ArticleHero` 475, `LoginGate` 444, `RecoveryScreen` 484 |
| 1440 | 322 | 320 | 4 — those three and `BackstageTeaser` 347 |

**This is not the "All specimens" pill coming back.** That control sat on every card,
on its own opaque ground, over a region the component was using: it hid `ClubCard`'s
hairline and `CalloutCard`'s progress bar on cards that were showing those components
perfectly well. This appears on the three or four that are already cutting something
off, over the part that is already cut, and it is not a control — the link is the
whole square, as it has been since that pill came off.

The two numbers the section above rests on were re-measured after the change and
neither moved in the direction that would have mattered: the page is 11,559px tall at
1280 against 7,735px before, which is what a square costs over 176 pixels, and
scrolling it end to end is 88 frames with none over 32 ms. Nothing reflows as the
specimens settle: the page's height and the number of markers on it are the same from
the first frame either can be read on.

### 8. The registry's roster is the app's own catalogue

ADR 0027 shipped `src/components/direct.tsx` with two entries typed out by hand, each
importing its component by file so the `ui` barrel's dependencies stayed out of the
bundle. That was right for a proof and wrong for a page: writing specimens for
forty-five components here would be a second answer to "what does this component look
like", and the copy nobody edits.

So the registry imports `CATALOGUE` from `apps/mobile/src/gallery/catalogue.tsx`. It
already says what every component is shown with, in the props' own words, with the
awkward cases deliberately in it, and the app's own
`__tests__/gallery-catalogue.test.ts` fails when a component is missing from it —
a guarantee a list in the handbook could not have.

What the handbook adds is the one thing the app cannot know: which of those entries
its React tree can actually mount. That is `NOT_DRAWN` in `src/components/direct-ids.ts`,
**a list of exceptions rather than of members**, each with the reason in the words the
card prints.

**Measured on 2026-09-11, and the list is empty.** All 45 entries draw. ~~Two things
were needed and both are one line:~~ Voided by "The environment is the app's, and it
was short by five things" below: two things were needed to *mount* a component
without throwing, which is what this paragraph measured, and five are needed to
*draw* it the way the app draws it. The two that threw:

| missing | what threw | components affected |
|---|---|---|
| a redux `Provider` | react-redux refuses rather than degrading | everything that selects from a slice |
| a `SafeAreaProvider` | `useSafeAreaInsets` refuses rather than defaulting | `LoginGate`, `RecoveryScreen`, `Screen`, `ScreenHeader`, `SafeAreaView` |

The store is `apps/mobile`'s own instance, `coreStore`, not a second one, so the
components' bound actions are bound to the store they read. The insets are stated as
zero rather than measured, because a page has no notch and a provider that measures
its own box renders nothing until it has an answer. Nothing else is stubbed: not the
router, not the webview, not the ports — `packages/app-core`'s default platform is
`createMemoryPlatform()`, so a thunk that reaches for storage gets an empty answer
instead of throwing.

The cost is the one ADR 0027 named as a finding about `apps/mobile`: the catalogue
imports `@/components/ui`, so this bundle now carries `@expo/vector-icons` and
`expo-image`. The site's bundle went from 1,392 kB to 2,514 kB (gzip 436 to 701),
plus the icon fonts as separate assets. That is paid knowingly — every one of the
forty-five is drawn here, so every one of them is needed anyway — and the alternative
was a second catalogue.

### 9. The environment is the app's, and it was short by five things

The section above measured what a component needs in order to **mount** here without
throwing, and got the right answer to that question. What nobody measured was whether
it then **looked** like the app, and it did not. Read on the assembled site on
2026-09-11, every component against its own frame on `/components/<group>/<name>`, in
both appearance settings — which is exactly the comparison that route exists for, and
the first time anybody had actually walked it.

| what differed | components | why |
|---|---|---|
| the typeface, everywhere | all 45 | no `@font-face` at all in the document; Chrome substituted its standard face, which is a **serif** |
| every bold and semibold string drew at regular weight | all 45 | this app names one loaded family per cut, so a family that is not there takes the weight with it |
| `variant="text-article"` was the wrong serif | `ui/Typo`, `reader/ReaderView` | Merriweather is a family name here like any other |
| every row stood on end as a column | `ProjectRow`, `SampleHitRow`, `SearchEntry`, `ArticleRow`, `HomeHeader`, `SpotlightBriefing`, `EpisodeRow`, `LiveBanner`, `MediathekReihe`, `NavCard`, `SettingRow`, `ScreenHeader`, `SectionHeader`, `FormField`, `Badge`, `Overline`, `BackstageTeaser` | `.flex-row` was not in the stylesheet, so `react-native-web`'s own `flex-direction: column` stood |
| white text on no ground at all | `CalloutTeaser`, `LiveBanner` | `.bg-always-dark` was not in the stylesheet |
| thumbnails, play buttons and progress bars lost their fill | `Thumbnail`, `MediaCard`, `SeriesTile`, `ArticleHero`, `EpisodeRow`, `CalloutCard` | `.bg-grey-250`, `.bg-grey-300`, `.bg-on-surface` |
| rail tiles lost their width, spacing was off in places | `MediathekReihe`, `SeriesTile`, and 15 spacing utilities across the set | `.w-32`, `.w-64`, `.mt-ml`, `.pb-3xl`, `.opacity-70` and 34 more |
| pills and tags ran the full width of the column | `Badge`, `ClaimStatusTag` | `align-self: flex-start` means nothing to a child of a block box |
| `ui/Chip` hugged its label where the app stretches it | `Chip` | the same thing from the other side |
| a horizontal rail bled past the card into the page | `Rail`, `TopicRail` | follows from the above |
| the "All specimens" pill covered the specimen | `ClubCard`, `CalloutCard`, `SpotlightBriefing`, and every specimen taller than the card | a control parked on its own opaque ground over the bottom-right corner |

**Three causes, and every row above is one of them.** None is a component's fault and
none is fixed per component.

**One. The app's stylesheet was compiled against the wrong tree.** Tailwind generates
a utility only where it has seen the name, and what it scans by default is the
*bundler's* project rather than the stylesheet's. Metro's project is `apps/mobile`, so
the app was always right; the handbook's Vite root is `apps/handbook`, so it compiled
`apps/mobile/src/global.css` against the handbook's own sources and emitted only the
utilities the handbook happens to write itself. 39 of the app's classes were missing,
and the ones that were *there* were there by coincidence — the handbook writes
`bg-canvas` and `p-m` for its own chrome, and never writes `flex-row`, because a DOM
site has no use for it. Both builds green, the page rendering, nothing to grep for.

The fix is one line, and it goes in the app's stylesheet rather than in the host:
`@source './'`, relative to `global.css`, which is this app saying where its own class
names are written and is the same answer for every bundler that ever compiles the
file. It costs 2.8 kB of the site's CSS. A host-side `@source` pointing at
`apps/mobile/src` would have worked identically and would have been the second
description of a fact the app already owns.

**Two. There was no font file.** The handbook applied the family names and loaded
nothing behind them — `document.fonts` was empty on every page of it. That is the
whole of the typeface, the weight and the `text-article` rows above, and it is one
defect, not three.

**Three. The specimen's parent was a `<div>`.** A React Native view is a flex column
that stretches its children; a `<div>` is a block box that does neither, and a
component's outermost element is laid out by its parent. So `self-start` did nothing
and `align-items` did something else. `DirectPreview`'s stage boxes are `View`s now.

### 10. One environment, exported once

The answer to one and two together is `apps/mobile/src/lib/env/AppEnvironment.tsx`:
the app's stylesheet, its five font files, the store, the safe area, the gesture root,
and the appearance handed to Uniwind. `app/_layout.tsx` wraps the router in it and
`DirectPreview` wraps every specimen in it. **One definition, two hosts**, which is
what [ADR 0006](0006-one-core-two-hosts.md) already prescribes for everything else and
what the handbook was the last thing in the repository not to do.

Not a stylesheet in the handbook that simulates the app, which was the obvious move
and is the wrong one: `_layout.tsx` already describes that environment, a second
description is not kept in step by anything, and the drift would surface as exactly
the kind of difference the `direct | bundle` comparison exists to *detect*. The list
this replaced had been right when it was written and was wrong two changes later,
which is the whole argument in one sentence.

Two things it takes as arguments, because they are genuinely the host's:

- **the appearance.** The app's own setting is in its store; the handbook's is a
  control in its header and a class on `<html>`. The handbook reads its class and
  passes the value; `lib/theme/appearance.ts` applies it. `Uniwind.setTheme` is
  called from one place in the repository, which is what ADR 0008 and ADR 0027 both
  cost a defect to learn.
- **the safe-area insets.** In the app expo-router mounts a `SafeAreaProvider` above
  the root route, so the environment adds none — a second one nested inside it would
  measure the same full-screen box and answer the same insets. A host with no router
  states them instead, and the handbook states zero, because a page has no notch and
  a provider with nothing measured yet renders `null`.

What is deliberately not in it: the splash screen, the persistence hydration, the
onboarding redirect, the error boundary, the status bar, the door and the `Stack` —
routing and lifecycle, which a drawn card has neither of. Nor `configurePlatform()`:
the ports are a statement about the running app, and the handbook is right to leave
the core on `createMemoryPlatform()`.

`apps/handbook/test/environment.test.ts` fails if `DirectPreview` grows a `Provider`,
a `SafeAreaProvider`, a `Uniwind.setTheme`, an `import '@/global.css'` or a font name
of its own, if `_layout.tsx` stops using the same component, or if `global.css` loses
its `@source`. It reads the files as text, which is the same choice `shell.test.ts`
makes and for the same reason.

### 11. The card's link is over the drawing, not on it

The "All specimens" pill sat in the bottom-right corner of every card's preview on its
own opaque ground, and what it did there was cover the component: `ClubCard` lost the
line under the member's name, `CalloutCard` its progress bar, `SpotlightBriefing` an
entry. A control that hides the thing it is a control for is worse than no control,
and the card already says where it goes — the component's name below it is a link, and
the page's prose says the component's page has every specimen.

So the pill is gone and the preview area is a link, as an anchor laid over the drawing
rather than wrapped around it: a specimen contains `<button>`s of its own and an `<a>`
around one of those is invalid. That also stops a press landing on a specimen's own
control, which on a card does nothing anybody wants, and it makes the drawn state and
the `NOT_DRAWN` state the same shape, which the card was already trying to be.

### 12. A visible way past the app's door (issue #112)

`holdTheDoorOpen` in `workbench/frame/seed.ts` already wrote an admitted session
before a frame booted, because the app's root layout renders `LoginGate` **instead of**
the router until the session carries an entitlement. What [issue #112](https://github.com/faktenforum/correctiv-app/issues/112)
asks for beyond that is that the bypass be **visible** and **greppable**, and that it
cannot reach a production build.

- It writes an account named `Handbuch` rather than a plausible person, so the
  profile screen says where the session came from without anybody knowing this file
  exists.
- It writes one key, `handbook:seeded`, outside the app's own two prefixes —
  `persist()` writes back only the keys a slice declares, so anything invented under
  `kv:store.` is dropped on the app's first write.
- `apps/mobile/src/gallery/Gallery.tsx` prints one line when that key is present:
  "Session seeded by the handbook, not signed in."
- Choosing a storage fixture takes the mark away with everything else, because a
  fixture is a whole state.

**No `__DEV__` branch anywhere**, and that is deliberate: ADR 0025 measured that a
route component returning `null` outside a development build is still pre-rendered
into the export as a blank public page, so guarding a component is not the same as
keeping something out of a build. What keeps the bypass out of production is simpler
than a flag — **it is not in the app**. `holdTheDoorOpen` is the handbook's code, and
`test/workbench/seed.test.ts` fails if the string ever appears under `apps/mobile`.
The same test holds the key's two spellings against each other, which is the fact
that would otherwise rot: two files, one string, and a rename in either would leave a
bypass with no marker.

The issue's open question, "where the switch lives", is answered as: in the
handbook's frame, not in the app's settings.

## Why not the alternatives

**Leave the workbench special and give the other views their own layouts.** Cheapest,
and it is what was there. It fails at the second view that wants a context bar, which
arrived in this same change: `/components` and `/reference` both have a filter that
belongs in the header, and `/design` has two frame controls. Three copies of a branch
written by name is where a shell stops being one.

**A page returns its sections as data.** Tidier to read and it cannot carry state: the
filter in the header and the grid below it are one query, and passing a rendered
`ReactNode` up to the shell would either duplicate the state or lift it into `App.tsx`,
which is where it was and is what this change is undoing.

**Keep the panel state in React and out of the URL.** It is what every view except
the workbench did. The workbench is the counter-example: `tools=1` is the difference
between the link `RELEASE.md` hands out and the link somebody sends a colleague to
show them a console error, and that difference is worth having on a document's
contents and on a component's props too.

**Put the device frame on the card, and the drawing on the detail page.** The
mechanism above settles it: a frame on a card is a phone at forty per cent with the
thing you asked about somewhere inside it.

## What it costs

**A page can now write a slot the route did not declare, and it draws nothing.** In
development it warns once; in CI `test/shell.test.ts` reads every page as text,
collects its `<Slot id="…">` literals and fails on one the table has no place for, as
well as on a declared section nobody fills. That is a string-matching test and it is
the honest kind here: the alternative is rendering eleven pages in a test runner to
ask a question about a portal.

**A section's content is mounted while the section is shut.** Radix unmounts a closed
collapsible's children, which would take the slot's target with it — and with the
target gone the page's `Slot` renders nothing, so the console's level filter and the
component route's device choice would reset every time somebody collapsed the section
they live in. `forceMount` plus `hidden` keeps them; `hidden` is `display: none`, so
a shut section is out of the accessibility tree either way.

**The workbench's state and the shell's address meet in exactly one file.**
`pages/Workbench.tsx` writes the frame's half into `rest` and `workbench/store.ts`
reads the hash back on `hashchange`. There is no loop to guard against, because
`shell/address.ts` writes with `replaceState` and that fires no event: only a person
editing the address bar, or a step through history, reaches the listener.

**One address with more than one writer needs a rule, and it cost two defects to
find it.** Both were invisible to every check and both were found by wrapping
`history.replaceState` and reading the trace.

- A patch used to be merged onto the address as the last *render* left it, so two
  writes inside one tick — the frame moving and a reader collapsing a section —
  made the second carry the first's old value. Collapsing Console while the app
  navigated left `open=` out of the URL and the section open on screen.
- The reconciling effect that puts held panel state back after a plain anchor
  click used to run on every address, and a parent's effects run *after* its
  children's: holding the first render's address, it wrote the empty string over
  what the page had just written. On `/workbench` at 390px that wiped the `full=1`
  the view asks for at that width, so the app opened with its chrome on a phone.

The rule: a patch lands on what the last patch left, whether or not React has
rendered in between; and the reconciler acts only on a hash it actually parsed and
only when that hash carries no parameters at all.

**`tools` and `full` left `PreviewState`.** They were always the two fields in it that
were not about the frame. `workbench/state.ts` is `fromAddress`/`toAddress` now
instead of `parseHash`/`writeHash`, and `store.ts` lost its `owning` flag and both of
its `history.replaceState` calls — the flag existed only because the hash belonged to
other views while they were open, and the shell owns it on all of them now.

## What is still open

**The "Drawn here" filter currently filters nothing**, because `NOT_DRAWN` is empty
and all forty-five draw. It is kept because it is the control that finds the
minority whichever way the number goes, and the count beside it — "11 folders, 47
components, 47 drawn here" — is computed rather than typed, so the page never claims
a number it did not count. Two numbers run through this record and they are not the
same number: **45** is the components, which is what the catalogue holds and what
`/components/<group>/<name>` publishes a page for, and **47** is the rows the
reference has, because `reader/ReaderView` and `media/VideoFrame` are each a `.tsx`
and a `.web.tsx`. The grid draws one card per row, so it is 47 cards of 45
components. If the list stays empty for long, the segment is the thing
to delete, not the mechanism behind it.

**The status line's default is one line of prose and one exception.** `/design`
appends the commit it was built from, because that is a fact about the current view;
every other non-owning view says where it is. A third such exception would be the
signal that the status line wants a declaration of its own.

~~**Fonts are still open**, unchanged from ADR 0027: a drawn component's sizes, weights
and line heights are the app's and its typeface is the browser's fallback.~~ Voided by
"The environment is the app's, and it was short by five things" below: the handbook
loads the app's five font files, out of the app's own `fontAssets`, through the
environment the app itself starts in.

**A drawn component is 48 px wider than the framed one at the same device**, and that
is left as it stands. Measured at the 393 px preset: the drawn specimen's outermost
box is 367 px and the framed one's is 319 px, because the frame is the app's gallery
page and that page insets by a screen's own `px-m` before its outline's `p-s`, while
this stage gives one `p-s`. It moves where lines break and nothing else. Matching it would mean
the handbook reproducing the app's gallery furniture, which is the copy this record
has just spent a section removing; the honest fix, if it is ever worth one, is for the
stage to inset by the app's `Screen` padding rather than by the gallery's.

**Two components fetch on mount and fail by CORS in a browser** — `LiveBanner` asks
icecast for the station status and an article row asks correctiv.org for a reading
time. Both degrade exactly as they do in the app, and both log an error in the
console while doing it. That is the app's own behaviour made visible rather than
anything this page introduces, and it is a reason to read
TROUBLESHOOTING.md's "Data sources" before reading the console on this page.

## What this retires

**This record itself, one claim, struck in place.** "Each card draws the component
itself, in this site's React tree, when the reader presses Draw", in "The frame moves
to the component's own page". Voided by "Every card draws, and there is nothing to
press" above, which is a section of this ADR rather than a record of its own because
nothing else about the decision moved: the frames are still gone, the grid is still
the grid, and what came off is a control inherited from the page this one replaced,
measured and found to be gating nothing. Decision 12 of the redesign is withdrawn
with it.

**This record itself, two claims about the preview area's size**, both struck in
place, both by §7 above, "The square is the column, and a crop says it is one", which is
a section of this ADR rather than a record of its own because the decision it belongs
to is this one: the frames are still gone, the cards still draw on arrival, the box is
still reserved so that nothing reflows. What moved is only what reserves it.

- "The height is `11rem`, fixed, the same number `/diagrams` gives its previews …", in
  §6, "Every card draws, and there is nothing to press". It is `aspect-ratio: 1` against a
  column the grid holds between 19rem and 24rem. The two grids no longer rhyme, and
  `/diagrams` is untouched: an SVG scaled into a box has no natural height to be wrong
  about, which is the whole reason one number could serve both and now cannot. The
  sentence's own check — as tall drawn as empty — went under the strike with it and is
  the thing that was re-run rather than assumed.
- "because a card's preview area is `overflow: hidden` at a fixed height …", in the
  same section. Still `overflow: hidden`, still reserved, no longer a height. Struck
  as a whole sentence because the false part is a phrase inside one, and this
  repository annotates a strike with what follows it.

**This record itself, two more claims, struck in place**, both by "The environment is
the app's, and it was short by five things" above, which is a section of this ADR
rather than a record of its own for the same reason as the one before it: nothing
about the decision moved. The handbook still draws the app's components in its own
React tree, the roster is still the app's catalogue, the two renderings are still
offered and still not compared by anything but a person. What changed is what stands
above a specimen.

- "Two things were needed and both are one line", in "The registry's roster is the
  app's own catalogue". Two were needed to *mount* a component without throwing,
  which is what that paragraph measured and stated correctly. Five are needed to draw
  it as the app draws it, and the measurement that would have found the other three
  is the one this ADR's own route was built for and nobody had run.
- "Fonts are still open, unchanged from ADR 0027", in "What is still open". They are
  loaded, out of the app's own `fontAssets`, by the environment the app itself starts
  in.

[ADR 0027](0027-the-handbook-draws-the-apps-components.md), **four claims struck in
place**. The first two by this record as it was first written:

- Its context, "three at a time (`src/lib/rows.ts` says why three)". There are no
  frames on that page at all now and the file with the cap in it is deleted. The
  observation around it — that a frame always carries a viewport, so `Hairline` in
  one is a phone with a line somewhere on it — is the reason for both records and is
  untouched.
- Its decision, "`ui/Card` and `ui/Hairline` ship in it, which is the proof and
  nothing more" and "the components page that is built around this … is the next
  change and is not here". This is that change. The registry's roster is the app's
  own catalogue and the two hand-written entries are gone; the argument above them,
  that the registry is the measurement rather than a description of one, is why the
  exceptions are a list and not a manifest, and is untouched.

And two more by "The environment is the app's, and it was short by five things":

- "The font chain, which was a wall": "`app/_layout.tsx` — the only consumer of
  `fontAssets`, verified against the whole tree — imports it by path". The only
  consumer is `lib/env/fonts.ts` now, and `_layout.tsx` reaches the files through it.
  The reason the chain was cut is untouched and is stronger for it: the barrel still
  keeps Expo's font loader out of every component's import graph, and exactly one
  module in the app has any use for the files.
- "What is still open → Fonts", the whole entry, including "How the handbook loads
  Merriweather and Source Sans 3 for a directly drawn component is unresolved". It is
  resolved, and by neither of the two candidates that paragraph names: not a stub and
  not the reader's font subsets, but `expo-font` itself, on the handbook's own page,
  over the same five files. The paragraph's reasoning is the part worth keeping — the
  families are *applied* and loading one is `expo-font`'s job — and it is what points
  at the fix.

**Two comments in the code**, both deleted with the thing they described:
`App.tsx`'s "that parameter predates this shell", about `tools` — it is every view's
parameter now — and `workbench/ui/Panels.tsx`'s "which panels are open is local to
this component rather than part of `PreviewState`", which was the whole of what
`open=` in the address replaces.

**`TROUBLESHOOTING.md`**, one sentence rewritten rather than struck, because it is a
living document: "`/components` draws each component in its own frame" is now
`/components/<group>/<name>`. Everything the entry says about `about:blank`, the
poll and the two readings of a frame's address is unchanged and is what
`AppFrame.tsx` still does.

**Nothing in [ADR 0014](0014-the-preview-shell-as-a-package.md) or
[ADR 0024](0024-the-handbook-owns-the-root.md) is affected, and both were read for
it.** 0014's same-origin argument is why any of this works and is untouched; its
capability table is a list of property accesses across a frame boundary and none of
them moved. 0024's "the shell is a route of `apps/handbook` now, `/workbench`" is
more true after this change than before it, not less: what this ADR removes is the
seven branches that made that route behave like a separate application while being
one. Neither ADR claims the workbench is its own shell — 0014 says the opposite, that
it is not a host — so there is nothing here to strike.
