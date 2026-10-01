# ADR 0022 — Three tiers of colour, and a dark scheme that names roles

Status: accepted, 2026-09-03.

## Context

wp-design-tokens moved from `501ee10` (tag `v0.1.1`) to `8ed7a28`. The change is one
commit that matters, `9d4d922`, and it replaces the flat colour palette with three
tiers:

| Tier | Tokens |
|---|---|
| primitive | `black`, `white`, `neutral-100…700`, `red-500`, `yellow-400` |
| semantic | `accent`, `accent-alternative`, `background`, `canvas`, `surface`, `on-background`, `on-canvas`, `on-surface`, `on-canvas-muted`, `on-canvas-accent`, `stroke`, `stroke-strong` |
| deprecated v1 | `emphasis`, `alternative`, `grey-100…700` |

The v1 names survive as aliases with unchanged values, so nothing breaks by not
migrating. Upstream will remove them once its consumers have moved.

Two things arrived with it that are not just more names.

**`neutral-600` (#4a4a4a) is a new value.** No v1 grey pointed at it. It exists to
back `on-background`, and it is the only colour in this change with no history.

**The placeholder dark block is gone.** Until now `theme.css` carried a
`prefers-color-scheme: dark` block marked `@TODO Set this to the actual values` and
holding the light values verbatim. `9d4d922` deleted it down to a bare
`@TODO define dark mode theme`. Nothing was lost: this repo's generator never read
that block, and there is a comment in `firstRootBlock()` saying why. What was deleted
was a lie that compiled.

The reason this is an ADR and not ordinary work is that the semantic tier answers a
question `packages/design-tokens/palette.js` had been arguing from scratch since
[ADR 0010](0010-design-tokens-as-a-shared-package.md), and answers it better.

That file used to open with an essay: the grey scale is **not** semantic, because
`grey-100` (#fff) is a page surface *and* white text on a red button, and `grey-700`
(#333) is body text *and* a dark video stage. Inverting the scale for dark mode would
therefore turn the video stage white and the text on the brand red invisible. So each
grey was given the dark value of the role it plays in the *majority* of its uses, and
the minority uses were moved to two invented tokens, `always-light` and `always-dark`.

All of that was true, and none of it is ours to argue any more. A page surface is
`canvas`; white on a red button is the primitive `white`. They are different tokens
now and can move independently, which is exactly what the essay wished for.

## 1. Decision

**Adopt all three tiers, and express the dark scheme at the semantic one.**

`palette.js` no longer holds a dark value per colour. It holds two lists:

- `dark` — a value for every colour that names a **role**. Twelve semantic tokens,
  plus the ten deprecated aliases, which keep the values they had.
- `schemeIndependent` — the eleven primitives, which deliberately do **not** follow
  the scheme. `white` is #ffffff on a dark phone too, because "white" names a value.

The generator's palette check is what holds the split up, and it needs both halves.
Every colour in `theme.css` must appear in one of the two lists, and a colour in
neither throws — that is the only decision the generator cannot make for itself. But
being in *a* list is not enough: a name in `schemeIndependent` must also be a
**literal** in `theme.css`, because that is how upstream spells a primitive, while a
`var()` reference is how it spells a role.

The second half exists because the first alone was not sufficient, and the way it
failed is the point. Adding a semantic token upstream and classifying it as
scheme-independent passed the generator, passed all sixteen token tests and passed
`npm run check` — leaving a role pinned to its light value in dark mode with nothing
red. Which is verbatim the failure the check's own error message describes, so the
check now covers it. Only that direction is inferable: the converse, "a literal is a
primitive", is false for `grey-250`, a literal upstream dropped from the ramp that is
nonetheless a surface with a dark value.

**The dark theme did not move.** Each semantic token took the dark value of the
deprecated alias that shares its light value: `canvas` is `grey-100`'s #1a1a1a,
`surface` is `grey-200`'s #242424, `on-canvas-muted` is `grey-600`'s #a8a8a8, and so
on for eleven of the twelve. Only `on-background` is new, because `neutral-600` is.
`apps/mobile/__tests__/tokens.test.ts` asserts the whole table, so "this was a rename
and not a repaint" is checkable rather than claimed.

**The app migrates to the semantic names**, which is the point of the exercise:
`bg-grey-100` → `bg-canvas`, `bg-grey-200` → `bg-surface`, `text-grey-600` →
`text-on-canvas-muted`, `bg-emphasis` → `bg-accent`, and so on. Every one of those is
value-identical in both schemes.

## Consequences

**One migration is not a rename, and it is visible.** `stroke`'s light value is
`neutral-300` #cecece. The app has drawn its hairlines in `grey-300` #e6e6e6, one
step lighter — there is no semantic token at #e6e6e6, so keeping the appearance would
have meant keeping a deprecated alias for the app's most common border. Every border,
divider, input outline, progress track and `<Hairline>` therefore darkens by one step
in light mode, and lightens by one in dark (#3a3a3a → #4a4a4a).

This was checked before it was taken, not after: both schemes were screenshotted
across eleven routes on the web export before and after, and diffed pixel for pixel.
The changed pixels are borders and the small fills that go with them — progress
tracks, the segmented step bars, the onboarding's inactive dots, the switch's off
track — and nothing else. See the PR for the images.

Those fills are `stroke` on purpose rather than by accident: upstream defines it as
the colour of "linear elements — borders, dividers, line iconography — that provide
structure without competing with content", and a 4px progress track is one of those
whatever CSS property draws it.

One route in that set proves less than it appears to, and is worth naming because it is
the trap `TROUBLESHOOTING.md` warns about. `/onboarding` came back 0.00%, which is
**not** evidence that the onboarding is unaffected: only step 0 is the brand-red screen,
and a per-route screenshot renders step 0. Steps 1 and 2 use `bg-canvas`, `bg-surface`,
`border-stroke` and `colors['stroke']` for the inactive step dots, and did move.
`screens/android/02-onboarding-interests.webp` is the state that changed.

`<Hairline>` moved with the borders rather than separately. It draws the same line as
a `border-b` and had to keep agreeing with it; a divider component and a border
utility disagreeing about the divider colour is worse than either value.

**The article reader moved for the same reason**, and it is the case that made the
rule concrete. `READER_LAYOUT_CSS` in the core is a second stylesheet for the same
screen: on `/artikel` the app draws the header's `border-b` and the WebView draws the
byline's `border-bottom` a few hundred pixels below it. Migrating one and not the
other would have put two different hairline greys on the app's primary reading
surface. Eighteen of its nineteen `--var-color-*` uses moved: seventeen to
the semantic tier and one to a primitive, `neutral-700` for the label on club yellow,
which must not follow the scheme. The one that stayed is the neutral verdict plaque's
background, the `grey-300`-as-a-fill gap in the table below.

It also had three `#fff` literals — on the Faktencheck badge and two verdict plaques,
all of them labels on the brand red. Those are the primitive `white` now. There are no
colour literals left in the file.

That migration also **fixed a shipped dark-mode bug**, which is worth stating plainly
because it was found by reviewing the code and not by anyone looking at the app.

The generator used to append `.rating--qualified{color:#333333}` to the reader's dark
CSS, so the "partly false" plaque — which sits on club yellow, and yellow stays yellow
in the dark — would keep a dark label. **That override never applied.**
`buildReaderHtml` joins the stylesheets into one `<style>` in the order
`[FONTS, THEME_CSS, DARK, LAYOUT]`, and `READER_LAYOUT_CSS` carried its own
`.rating--qualified` rule: same selector, same specificity, later in the document, so
it won. In dark mode the plaque resolved to `grey-700` #f2f2f2 on #fde162 — a contrast
ratio of **1.16:1**, effectively unreadable — and had done since the override was
written. Confirmed by resolving `main`'s three stylesheets in a browser, in that order.

The label is `--var-color-neutral-700` now: a primitive, which says "dark in both
schemes" in the token rather than in a rule that has to out-rank another rule. The
override is gone and `READER_DARK_CSS` is nothing but the variable block.

The general lesson is the one this ADR keeps running into. An override that restates a
value can be beaten silently; a token that *means* the value cannot, because there is
nothing left to disagree with it.

**`always-light` and `always-dark` are now redundant, and are kept anyway.** Since
primitives no longer follow the scheme, `always-light` is exactly `white` and
`always-dark` is exactly `neutral-700`, in both schemes.

They are kept because removing them is a rename pass and not this decision — and #72
is already doing that pass over the other ten aliases, so it takes these two with it
rather than two PRs editing the same lines.

~~That pass is 45 call sites in `apps/mobile/src` and 14 more in
`tools/figma-plugin`.~~ Struck on 2026-09-15: **49** in `apps/mobile/src`. Nothing
voided the figure — it was exact on the day, and the app grew under it. The component
gallery landed on 2026-09-10 and writes the other four (`gallery/Gallery.tsx`,
`gallery/catalogue.tsx`). `tools/figma-plugin` is still 14, re-counted the same way,
and its `spec.json` and `measured.json` are generated rather than edited. Only the
size of the pass moved; the scheduling argument above is untouched.

> A call site is a line of `apps/mobile/src` outside a comment that writes one of the
> two names, which is what a rename would have to edit — the gallery's caption
> printing `color="always-light"` beside its specimen included, prose about the
> tokens excluded. `AGENTS.md` carries the live number and
> `apps/mobile/__tests__/tokens.test.ts` takes it on every run, so this paragraph is
> the last copy that can go stale, deliberately: a record says what was true when it
> was written.

An earlier draft gave a different reason: that `tools/figma-plugin`'s `bind()` fails
silently on a token that has gone, so the board would keep drawing with the last synced
hex. **That was true when this work started and is not true now.** #72 landed
`checkTokens()` (`tools/figma-plugin/code.js:846`), which walks the whole description
before a single frame exists and throws with every unknown name at once; `bind()`'s
fallback carries a comment saying it is unreachable for anything the description wrote.
Removing the tokens would fail loudly, before drawing. The reason above is the one that
survives, and it is a scheduling reason rather than a safety one.

**Three app uses have no semantic successor, and stay on deprecated aliases.** Worth
naming, because they are the feedback upstream needs before it drops the v1 tier:

| Use | Token | Why nothing fits |
|---|---|---|
| `Badge` neutral fill, `ClaimStatusTag` | `grey-250` #f0f0f0 | upstream dropped it from the ramp with "no replacement" |
| `Thumbnail` placeholder, the reader's neutral verdict plaque, `SettingRow`'s switch track | `grey-300` #e6e6e6 | `neutral-200` as a **fill**; the semantic tier has no surface there |
| faint text: placeholders, chevrons, inactive tabs (45 uses of `grey-500`, a different 45 from the struck call-site count above) | `grey-500` #b3b3b3 | no foreground token that faint; `stroke-strong` shares the value but names a line |

**And one that is not an alias at all, which is the bigger gap.**
`ClaimStatusTag.CHECKED_TRUE_GREEN` is a raw `#2e7d4f`, carried since the first
implementation and never declared a token. The other three rows are a neutral the
semantic tier dropped; this one is a **hue the palette does not have**. Measured across
all 35 tokens, the only non-neutral names are `red-500`, `yellow-400` and the four
aliases of them — there is no green anywhere in the design system.

That is a real hole rather than a naming one, and the app has been quietly filling it
with a hex: a *confirmed* fact check must not wear the same red as a refuted one, and a
fact-checking organisation needs a colour for "true" the way it needs one for "false".
Upstream should hear this before it hears about `grey-250`.

~~It is the app's only raw colour value. The two other hexes in the source are in
comments — react-native-web's Material teal default, named to explain why `thumbColor`
is set at all, and a contrast figure in the reader's CSS.~~

> Struck on 2026-09-04: it was a miscount on the day, not a claim a later decision
> voided. Someone auditing the app's raw colours off that paragraph would have
> stopped at one site and missed two.
>
> ~~Two raw colour values are in source rather than in comments —
> `apps/mobile/src/app/onboarding.tsx` (`'rgba(255,255,255,0.45)'`, the inactive
> onboarding dot) and `apps/mobile/src/components/media/VideoFrame.tsx`
> (`background:#000` in the embed page's HTML).~~ Struck again on 2026-09-15, six
> days after that correction and by the same failure: **five**, not two. The
> component gallery's reader fixture added three on 2026-09-10 —
> `apps/mobile/src/gallery/fixtures.ts` lines 174 and 175 carry `#fff`, `#333` and
> `#ff5064` as `var()` fallbacks in a hand-built HTML document, and a fallback is a
> hex the palette does not own: repaint `canvas` and it stays where it is. The two
> sites named above are still two of the five.
>
> Six literals in `src/` counting `CHECKED_TRUE_GREEN` itself; every other `#`
> sequence there is prose in a comment or an issue number. The point the paragraph is
> making — that the semantic tier has no colour for "confirmed" and the app fills the
> hole with a hex — is unaffected by either strike. What the two strikes say between
> them is about the count and not the argument: a figure taken against the source
> expires, and this one has now done it twice.

The last is the real gap, and it is not a counting one: the semantic tier has three
neutral foregrounds (`on-canvas` #333333, `on-background` #4a4a4a, `on-canvas-muted`
#707070). What it has none of is anything as faint as #b3b3b3, which is what those 45
call sites use for placeholders, chevrons and inactive tabs.

**Two semantic tokens are not used yet, and one holds the only invented value.**
Nothing in the app reads `background` or `on-background`. `on-background`'s dark
#cfcfcf is the single hand-picked value in this change, so it is also the only one the
screenshots cannot have covered: it has never been rendered. And `background` and
`surface` are the same colour in both schemes (#f8f8f8 / #242424), so the distinction
upstream draws between the page frame and a raised surface is not expressible in this
palette yet. Both are deliberate, and both are worth knowing before the first
`bg-background` lands.

**The `@variant dark` block grew from 12 colours to 35** — the generated block, which
carries `always-light` and `always-dark` on top of upstream's tokens.
`tools/figma-plugin`'s `sync-tokens.mjs` reads it with no allow-list, so the new names
reach Figma the next time it runs. It is deliberately **not** run here: `spec.json`'s
93 `@color-grey-300` references and the twelve hardcoded names are #72's migration
pass, and splitting that across two PRs would leave the board half-moved. Until it
runs, the committed `spec.json` still binds the board's hairlines to `grey-300`, which
this PR moves the app off — so the board is one step behind the app in the meantime,
and knowingly.

## What this retires

[ADR 0010](0010-design-tokens-as-a-shared-package.md), Context, second paragraph:

- "`theme.css` ships a `prefers-color-scheme: dark` block marked `@TODO Set this to
  the actual values` whose values are the light ones." **False since `9d4d922`** —
  the block is empty. The conclusion drawn from it, that the dark palette is this
  repo's to decide, is unchanged and is why `palette.js` still exists.
- "`palette.js` in this repo assigns every grey by the role it plays in the majority
  of its uses, and records why an inverted scale would be wrong." **False since this
  ADR.** It assigns a value per semantic role, and the argument about the grey scale
  is upstream's answer now, not ours.

Both are struck through in place. The decision 0010 records — that the package is the
shared one and the app writes nothing — is untouched.

The same two claims had been restated in the top-level docs, where they are also now
false and also struck:

- `ARCHITECTURE.md` — "`tokens/theme.css` ships a dark block that is a placeholder
  holding the light values", and "that file explains how each grey was assigned by
  role".
- `TROUBLESHOOTING.md` — "**The design tokens' dark block is a placeholder** … holding
  the *light* values", and "`packages/design-tokens/palette.js` records which is which"
  of the grey roles.

Naming them here rather than only striking them is the rule from `AGENTS.md`: the
newer ADR carries a section listing every statement it retires, so the two ends cannot
drift apart. [ADR 0015](0015-reading-correctiv-org-through-its-rest-api.md) set the
precedent for a retirement reaching past the ADRs into the top-level docs.
