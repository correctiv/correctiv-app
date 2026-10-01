# ADR 0029 — The handbook keeps its own primitives

Status: accepted, 2026-09-11.

## Context

[ADR 0027](0027-the-handbook-draws-the-apps-components.md) made the handbook able to
render `apps/mobile`'s components in its own React tree, and
[ADR 0028](0028-one-shell-and-a-route-that-declares-its-context.md) built a page on
that. The obvious next question followed within the hour: if the site can draw the
app's components, should the site be BUILT from the app's stack? Two React trees, two
styling systems and two sets of primitives in one repository look like an accident,
and three arguments point at merging them — fewer dependencies, one codebase to hold
in your head, and a uniform idiom for the agents that work here.

The question is a good one and the answer is no. It is written down because nothing
in the tree says why, and someone will ask again.

## 1. Decision

`apps/handbook` keeps its DOM primitives: Radix for the interaction ones, `cmdk` for
the palette, `react-resizable-panels` for the split, `lucide-react` for its icons.
The app's components are drawn on the components pages as *specimens*, which is ADR
0027's subject, and are not adopted as the site's own furniture.

## Why not the alternatives

**The app has no interaction primitives to adopt.** A search for `Modal`, `Tooltip` or
`Popover` across `apps/mobile/src/components` on 2026-09-11 returns nothing. The
sixteen components under `ui/` are content-shaped — `Badge`, `Card`, `Chip`, `Typo`,
`Rail` — and what the handbook takes from Radix is the part none of them has: a focus
trap, escape-to-close, aria wiring, a portal with outside-click, scroll locking.
Replacing Radix is therefore not swapping one library for another. It is writing
accessible web widgets by hand, which is more code this repository owns and maintains,
and the likeliest outcome is the class of defect [#102](https://github.com/faktenforum/correctiv-app/issues/102) is already
open about.

**The dependency argument inverts when measured.** Installed, on 2026-09-11:
`@radix-ui` 2.5 MB against `react-native-web` 6.7 MB and `uniwind` 3.0 MB. The
handbook's own bundle roughly doubled when the React Native layer arrived, from about
1.2 MB to about 2.5 MB; ADR 0027 and ADR 0028 carry the exact figures. Moving more of
the site onto the app's stack adds weight. It does not remove any.

**The site is supposed to look unlike the app it frames.** `/components` draws a
component beside the same component running in the app's real bundle, and a reader has
to be able to tell the documentation's furniture from the specimen at a glance. If the
handbook's buttons were the app's buttons, that distinction disappears, and it is the
whole point of the page.

**The uniformity that helps is already shared, and the rest is a platform difference.**
`bg-canvas` means one thing in both halves because both import the same generated
stylesheet ([ADR 0010](0010-design-tokens-as-a-shared-package.md),
[ADR 0022](0022-three-tiers-of-colour-and-a-dark-scheme-that-names-roles.md)). That is
the layer where sharing pays, and it is done. What remains between a DOM tree and a
React Native tree is not a matter of taste, and collapsing it would import React
Native's web behaviour into the half that does not need it. Three of its surprises were
measured in a single day while building ADR 0028:

- `align-self` means nothing to a child of a block box, so `Badge` and `ClaimStatusTag`
  ran the full column width although both say `self-start`.
- With `uniwind()` ahead of `rnw()` in the plugin list, every drawn component loses its
  `className` and paints nothing, while `vite build` stays green, the measurement still
  reports 47 of 47 and no error is logged.
- Tailwind scans comments, so prose in `test/environment.test.ts` naming `flex-row` and
  `bg-always-dark` puts those classes in the stylesheet.

None of the three is caught by a check. More surface of that kind is not more
uniformity; it is more room for the failures this repository's own
`TROUBLESHOOTING.md` exists to collect.

**The icons are not the duplication they look like.** Counted on 2026-09-11: the
handbook imports 24 names from `lucide-react`, the app uses 21 from Ionicons, and the
overlap is **one**, `Search` against `search`. The handbook draws a development
environment — `PanelRightClose`, `GripVertical`, `Braces`, `Maximize2`, `SunMoon` — and
the app draws its own navigation — `entdecken`, `mediathek`, `mitmachen`, `profil`,
`player`, `radio-outline`. Two vocabularies of meaning, not one vocabulary written
twice. `lucide-react` unpacks to 41 MB, which is install size; the build carries the
icons that are imported.

## What it costs

Two styling systems stay in one repository, and a contributor has to know which half
they are in. The line is the file tree and it is not subtle: everything under
`apps/handbook/src` is DOM and Tailwind, everything under `apps/mobile/src` is React
Native and Uniwind, and the one place they meet is
`apps/mobile/src/lib/env/AppEnvironment.tsx`, which ADR 0028 made the single
description of what a component is drawn inside.

It also means a presentational component that exists on both sides — a badge, a button
— is written twice. That is accepted here, because the two are not the same component:
one is a documentation label and the other is a product control, and they answer to
different designs.

## What is still open

Nothing this decision creates. One thing it found and removed: `ui/kit/scroll-area.tsx`
wrapped `@radix-ui/react-scroll-area` and nothing imported it, while the only two places
that mentioned it were explaining why they had chosen a plain scroller instead.

## What would change this

- The app grows real interaction primitives with a web story of their own — a dialog, a
  tooltip, a popover that are correct in a browser. Then the argument above loses its
  first and strongest leg.
- The handbook's design and the app's design deliberately converge, so that the site
  looking like the app becomes the intention rather than the confusion. That is a design
  decision, not a technical one, and it would have to be made first.
- React Native's web behaviour becomes as predictable as the DOM's. The three surprises
  above are not a complaint about Uniwind or `react-native-web`; they are the cost of a
  translation layer, and the cost is what this weighs.
