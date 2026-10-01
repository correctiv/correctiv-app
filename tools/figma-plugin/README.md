# @correctiv/figma-plugin

The app's Figma plugin. It draws the app's screens onto a Figma board at 360x800 —
the logical size of the Android screenshots in [`screens/`](../../screens) — and the
components they are built from beside them.

It is a **design tool, not a host**: nothing here ships, and the app does not depend
on it. The name is deliberately not "wireframes": a plugin is the only channel with
the full Plugin API, so whatever else this project needs done inside Figma belongs
here too.

## An interpreter, not a builder

`code.js` knows nothing about the app. It draws whatever `spec.json` describes.

    spec.json  ──  server.mjs  ──  ui.html  ──  code.js  ──  Figma
    the board      serves it      polls it     draws it

Changing the board therefore never means changing code, and never means re-importing
the plugin: edit `spec.json`, save, and it redraws within a second — **unless the
`Bausteine` page has been changed by hand**, which it asks about first
([ADR 0069](../../adr/0069-a-redraw-waits-for-a-look.md)). Only a JSON document crosses
the wire, never anything executable: the board's own description travels the same way,
so what a person changed on the board is compared rather than overwritten.

The plugin stamps each node it draws with its path in `spec.json`, describes the
`Bausteine` page back in the spec's own vocabulary, and the server diffs the two. Figma
ids cannot do this job: the owned frames are deleted and rebuilt on every draw, so an
id from the last draw names nothing on this one.

    node tools/figma-plugin/server.mjs      # then run the plugin once, and leave it open

Starting the server also **installs** the plugin's three files where Figma reads
them, and says so when it had to. On Linux that is a copy outside this repository,
because the flatpak can only read a granted directory, and a stale copy is an
interpreter drawing a description with a vocabulary it does not have yet — silently.
`fix-plugin-path.mjs` copies as well, and having to remember to run it is exactly
what failed on 2026-09-10: three interpreter changes were committed, the copy was
not refreshed, the plugin was restarted, and its summary still reported the old
component count. A `code.js` change still needs the plugin closed and reopened,
which only a person can do.

## The wireframe rendering, and why it went

There were two renderings of one description: this one, and a hand-drawn wireframe in
Kalam with every colour flattened onto a grey ramp and every box traced by a
seeded pencil wobble. It answered "how is the app built" where this one answers "what
does it look like", and it was removed on 2026-09-10 because the screens it was drawn
for are settled and nobody was reading it.

What it cost while it existed is the part worth remembering, because it is what any
second rendering costs. Every page, component and instance carried a `mode`.
Components were registered per mode, since a sketched screen has to instance a
sketched kit. Every colour was asked twice, once for what it is and once for what it
becomes. And a text colour needed a ramp of its own, or white-on-brand became
white-on-light-grey and every button label disappeared.

Two smaller things went with it and are worth keeping written down:

**A glyph that Unicode lists as an emoji was a trap.** Kalam has almost no symbols,
so the wireframe fell back to an emoji font, and any codepoint in `emoji-data.txt`
came back as a colour picture on the one page that existed in order not to be about
colour. `♥` U+2665 arrived red and `▶` U+25B6 as a blue play button; both have
`Emoji_Presentation=No`, so nothing warns you, and U+FE0E does not persuade Figma
otherwise. The board still uses their non-emoji twins, `♡` U+2661 and `►` U+25BA.

**And a family that has no such glyph is the other half of that.** Kalam went, so the
board is set in Source Sans 3 and Merriweather throughout, and a codepoint neither of
them carries is substituted from a font nobody chose — a different weight on this
machine and a box on one with nothing to substitute. There is no check for it: the
font check catches a missing *family*, never a missing glyph. Read off the `cmap` of
every cut of both families: `►` U+25BA is in the sans and not in the serif, which is
where it is used and where it stays; `♡` U+2661 is in the serif only, so the one
heart on the board, in `ClubCard`, is substituted today. Both candidates for it trip
something written down here — `♥` U+2665 is an emoji codepoint and `◉` is not a heart
— so it is left as it is and said out loud instead. The icon placeholder was `◎`
U+25CE, which is in neither family, and is now `◉` U+25C9, which is in every cut of
both.

**The pencil outline had to stretch.** An instance takes no children, so it showed
the outline drawn inside its component, at the width the component had. `ui/Button`
hugs its label, so without that every button stretched to fill a column wore a box
stopping short of its own edge. Any future decoration drawn *inside* a component has
the same problem.

## The app's tokens, as Figma variables

`sync-tokens.mjs` reads `packages/design-tokens/theme.css` — the generated file the
app itself uses — and writes the values into `spec.json` under `tokens`. The plugin
turns those into a Figma variable collection called **CORRECTIV** and **binds** the
replica's fills to them, so changing a value in Figma repaints every screen that uses
it.

**The colours bind; the scales resolve.** Thirty-five of the sixty-two tokens are
colours and reach the board through `fill`, `stroke` and `color`, where a Figma
variable can hold them. The other twenty-seven are the `spacing-*`, `radius-*` and
`text-*` scales, and Figma has no variable a `gap` or a `cornerRadius` can bind to —
so a description may write `@spacing-2xs` and the plugin turns it into six before it
draws. The name is what `measure.mjs` reads off the app, and keeping it means a diff
of the description says which step of the scale changed rather than which number.

    node tools/figma-plugin/sync-tokens.mjs      # after npm run tokens

Run it whenever the tokens change, and the board follows the app. Figma is a place to
try a value out; it is never where a value is decided. The next sync overwrites
anything edited there, which is the intended direction of travel.

A colour in the spec written as `"@color-accent"` is bound; a literal `"#ff5064"`
is copied. The mapping from the board's palette to token names lives in `AS_TOKEN`
and is deliberately **not** exhaustive: the media-placeholder greys, the YouTube red
and the disabled tint stay literal, because giving them a token name would put a
label on a decision nobody made.

**A second variable mode is a paid Figma feature.** The tokens carry a light and a
dark value, but on a Starter plan `addMode` throws and the collection stays
light-only. The plugin catches that and says so in its summary rather than losing the
whole token set over it.

## A token the table does not have

`draw()` walks the description against its own `tokens` block before it creates a
single frame, and throws with every unresolved `@name` at once.

That check exists because `bind()` cannot make it. It runs per paint, deep inside the
draw, and its only option on a name it cannot resolve is to return an unbound colour —
so the board kept drawing with the last-synced hex baked in and quietly stopped
following the tokens. Nothing errored, and a stale board looks exactly like a current
one. Checking up front names every bad token rather than the first, the way the font
check does, and leaves nothing half-drawn, the way `kit.mjs` refuses before it writes.

## Which token, and in which role

The board speaks the semantic tier, and the mapping is the app's rather than one of
its own. `Card` writes `bg-canvas` / `bg-surface` / `border-stroke`, `Hairline`
`bg-stroke`, `CalloutCard`'s progress fill `bg-on-surface`, `LiveBanner`'s white text
`color="always-light"` — so the board writes the same, and it depends on the ROLE, not
only on the old name:

| was | as | is now |
| --- | --- | --- |
| `grey-100` | a fill | `canvas` |
| `grey-100` | a text colour | `always-light` — white text never sits on white |
| `grey-200` | a fill | `surface` |
| `grey-300` | a border or rule | `stroke`, which is **darker**: #cecece, not #e6e6e6 |
| `grey-300` | a fill | unchanged — no semantic surface at that value |
| `grey-600` | text or an icon | `on-canvas-muted` |
| `grey-700` | a text colour | `on-canvas` |
| `grey-700` | a fill | `on-surface` — the progress bar, and only that |
| `emphasis` | anything | `accent` |
| `alternative` | anything | `accent-alternative` |

Four names stay where they are, each because the app kept them too: `grey-250`,
`grey-300`-as-a-fill, `grey-500`-as-text and the two `always-*` primitives. ADR 0022
lists the first three as the feedback upstream needs before it drops the old tier.

The border darkening is the one visible change. It was measured rather than judged —
eleven routes diffed in both appearance settings — and #cecece reads as a hairline
where #e6e6e6 was nearly not there.

## The vocabulary

    t: 'frame'     dir V|H, pad, gap, wrap, crossGap, fill, stroke, strokeWeight,
                   strokeSides, radius, w, h, align, cross, clip, dash, opacity,
                   children
    t: 'text'      chars, size, font sans|serif, weight, color, w, tracking, align,
                   style
    t: 'rect'      w, h, fill, stroke, radius
    t: 'ellipse'   w, h, fill, stroke
    t: 'space'     h, w
    t: 'line'      a 1px hairline; `w: 'fill'` to span the parent
    t: 'component' a frame instances can point at; props, and `bind` on a descendant
    t: 'variants'  prop, options[{ value, ... }] — one component set
    t: 'instance'  of, set { property: value }

`w`/`h` take a number, `'fill'` or `'hug'`. Any node may carry `x`/`y`, which Figma
honours inside a plain frame and ignores inside auto-layout — the API's own rule, so
there is nothing extra to remember.

A page entry takes `owned` — a list of frame names, or `'*'` for the whole page —
and the document takes `focus`, the page the file should open on. Without `focus`
that is whichever page was drawn last, and the kit has to be drawn first.

**A component is registered by its caller, not by its name.** Only a component in the
registry can be instanced, and a variant has to stay out of it: it belongs to its set
under the set's name, not under `Ton=club`. That used to be decided by looking for an
`=` in the name, and the measured components are named after their specimen labels,
which the catalogue writes "in the props' own words" — so `discover/SampleHitRow,
kind="podcast"` and eight more were drawn on the board and registered nowhere.
Nothing could ever point at them, they passed every check there is because they *are*
components, and the only visible trace was a count in the summary that nobody reads
against anything.

## The kit, from the app

`kit.mjs` writes the `Bausteine` page: thirteen Figma components, one per component
file in `apps/mobile/src/components` that the screens repeat, each carrying the props
its React counterpart carries.

    node tools/figma-plugin/kit.mjs

**It is built from the source, not cut out of the board.** An earlier version matched
component names against the drawn screens and lifted the first subtree that fitted.
That is the wrong direction, and it showed: the screens are transcribed from
screenshots, so what came back was a *usage* wearing a component's name. `ui/Card`
arrived carrying a heading, a paragraph and two buttons, none of which the thirteen
lines of `ui/Card.tsx` have ever known about.

| in the app | in Figma |
| --- | --- |
| `title: string` | a TEXT property |
| `club?: boolean` | a BOOLEAN property, driving one node's visibility |
| `variant: 'primary' \| …` | a variant set, one component per value |
| `<Badge>` inside `NavCard` | a nested instance, which follows `ui/Badge` |
| `<Typo variant="headline-l">` | a text style, not a component |

The last row is the one worth arguing about. A variant set for typography was the
first attempt and it is the wrong Figma object: `variant` is not something the app
instantiates, it is something the app *applies*, and a text style changes every text
node carrying it across every page — including nodes inside other components, which
a component can never reach. `<Typo variant weight>` is a pair, and Figma has no
partial style, so the four pairs the JSX actually writes (`text-m/bold` and three
more) become styles of their own. Which four is read off the source, not listed.

Colour is deliberately not part of a text style: the app picks a variant and a colour
token separately, so the style carries typography and a bound variable carries the
fill. Both in one would make every coloured headline its own style.

**What Figma cannot express is a slot.** An instance may override text and
visibility; it can never be given children. So `ui/Card` is the container it is in
the code, with a dashed placeholder where content goes, and a card that carries
content has to be its own component — in Figma *and* in the app. Seventeen cards on
the board are copies rather than instances, and the app has the same shape unnamed in
seventeen places that write `Overline` over a `Card` inline. The two counts match by
coincidence, not correspondence: the gate contributes three board copies and no app
site, backstage five app sites and one copy.

A colour is the other thing an instance cannot override, and `ClubCard` shows it:
`ClubCard.tsx` renders an `<Overline color="always-dark">`, but a Figma instance of
`ui/Overline` would arrive in the default grey with no way to change it. A colour
prop would have to become a variant, one per colour, so the kit draws those four
lines itself and says so where it does.

### Every prop accounted for

A component that quietly lacks a prop its source has is the same failure as a comment
that says serif over sans: the drawing looks finished and is wrong, and nothing says
so. So `kit.mjs` reads each component's own prop list out of its `.tsx` and requires
every prop to be one of three things.

- **mapped** to a Figma property, one prop possibly feeding several
- **ignored**, having no visual effect or belonging to the call site (`className`,
  every `on*` handler, `fullWidth`)
- **a declared gap**, visual but beyond what Figma can express, printed on every run

Anything else fails the script, before it writes anything. The four gaps today are
`Button.disabled` (four tenths opacity, put on the instance instead of doubling every
variant), `Overline.color` (an instance cannot override a colour, it would need a
variant per colour), `ScreenHeader.children` (a slot) and `NavCard.icon` (an Ionicon,
drawn as a glyph until the spec learns vectors). A gap that is written down is a decision; a gap that
is merely absent is a bug waiting to be found by eye.

## Measuring the app instead of describing it

`kit.mjs` describes thirteen components by hand. The app has forty-four, and the
other thirty-one are thirty-one more descriptions. So the question is whether a
description can be *read off* the app rather than typed, and `measure.mjs` is the
answer to that question rather than a finished generator.

    npm run web                                    # the app's dev server
    node tools/figma-plugin/measure.mjs ui/Badge

It opens the gallery at one component at 393px, once in light and once in dark, and
walks the rendered specimen: box, padding, gap, radius, fill, stroke and its sides,
alignment, and the type. What comes out is the vocabulary `spec.json` speaks, so it
can be held against the hand-written description line by line.

**This is not lifting from the board.** The warning above, against matching names
against the drawn screens, stands: those screens are transcribed from screenshots,
so what comes back is a usage wearing a component's name. The app's own rendering is
the opposite direction, and the only rendering in this repository that is not a
transcription of something else.

### What it recovers, measured on 2026-09-10

**Geometry, exactly.** For `ui/Badge` the measurement reproduced the hand-written
description without a difference: padding `[2xs, 2xs, 4xs, 4xs]`, `radius-s`, size
11, tracking 3.64 % — the same number `kit.mjs` computes as `0.4 / 11` — and the
live tone's seven-pixel dot as an ellipse with `spacing-3xs` beside it.

**The token that was asked for, not the colour that came out.** Uniwind writes the
app's classes into the DOM unchanged, so `bg-accent` is there to read. That matters
more than it sounds: `accent` and `red-500` are the same hex, so a measurement that
only looked at pixels called the badge `@color-red-500` — the right colour and the
wrong word, and the difference between them is most of what a design system is. The
classes decide, the computed values check them.

**The variant axis, off the specimen labels.** The catalogue writes each label "in
the props' own words", so `tone="club"` was already the variant and nobody had to
say so twice. Four specimens on one prop become a variant set; one becomes a
component; several on different props become one component each, and the run says
so rather than inventing an axis.

**Fill or hug, not a pixel width.** A row that fills its parent has no width of its
own; measured in a 1280px window every such row came out 691 wide and the number
said nothing. Both words are auto-layout's, so neither survives a plain frame, and
a child of one takes the pixel number instead. HUG is the half that was missed: it
is a size taken from what is inside, so a box with nothing inside cannot have one,
and react-native-web's switch thumb says `align-self: flex-start` and holds nothing.
It arrived on the board a hundred pixels of white wide, inside a forty-pixel switch,
because a childless auto-layout frame keeps whatever a fresh frame is born at.

**Where a box puts what is in it.** `items-center`, `justify-between` and
`text-center` are read and mapped onto `cross`, `align` and a text node's own
`align`. They were read and dropped until 2026-09-10, so all thirty-four
`items-center` rows in the app drew against their top edge and `HomeHeader`'s date
sat against its own title instead of the far margin. `space-around` and
`space-evenly` have no Figma equivalent; they are printed rather than rounded to the
one that does.

**Which gap, and whether the row wraps.** Auto-layout has one gap along its axis and
one across it; CSS has one per physical axis, and reading whichever was set put six
pixels between the two halves of `ArticleRow`'s byline, where the app writes
`gap-y-2xs` and means the space between two wrapped lines. `flex-wrap` comes over as
`wrap` for a row, so a byline longer than its own width breaks instead of running out
of the component.

**Which sides the border is on.** `border-b` is a rule under a row, and a box traced
on all four sides is a different component. Only `borderTopWidth` was read, which is
the one side `border-b` leaves at zero, so seven measured components wore a full
outline and none of them says so anywhere. The class is the other half of it: the
tail of a class is not always a token, `border-b` names a *side*, and it read as
`@color-b` — a name the interpreter refuses, so `border-stroke border-b` in the other
order would have taken the whole board down with "no such token". Anything the token
table does not have is now left alone, and the measured value answers instead.

### The five rules, because each one is a decision

Auto-layout has no word for any of these, and a decision that is not written down
gets made again differently.

1. **An icon** is a glyph from an icon font and reads back as the empty string, its
   codepoint being private-use. Drawn as a placeholder and printed as a gap, which
   is `NavCard.icon` seen from the other side. The placeholder is `◉` U+25C9 because
   the board's own families carry it; see the missing-glyph note above for why that
   is not a free choice.
2. **A stack** is a child in `absolute inset-0`. Figma honours x/y only when the
   parent is a plain frame, so the parent gives up its layout and **every** child
   carries coordinates, not only the absolute one. A plain frame lays nothing out, so
   a child the app had centred and that carries no coordinates of its own lands in
   the corner: `MediaCard`'s play button did, 52 pixels at 0,0 in a thumbnail it
   should have been in the middle of.
3. **A fill at part opacity** is `bg-always-dark/70`. `code.js` now reads
   `@color-x/NN` and puts the alpha on the paint rather than on the node, so a
   translucent surface does not fade the icon standing on it, and the token survives.
4. **A margin** has no equivalent: the spec has gaps, which belong to the parent, and
   `space` nodes, which stand between two children. A margin belongs to one child, so
   it becomes a `space` — along the axis the parent lays out on, since a row's
   spacing is written `mr-3xs` and a column's `mt-2xs`.
5. **A circle** is `rounded-full`, which the spec's numeric `radius` cannot take. An
   empty round box is an ellipse; one with children keeps half its height as a
   radius, which is the same drawing by another route. Only the class, though: a
   `borderRadius: 100` written in TypeScript stays a number, and Figma clamps it to
   half the shorter side, which is the same circle as long as the box is square.

### Two schemes, or a role reads as a colour

`always-dark` and `on-canvas` are the same hex in light and different in dark. One
is a colour that must not follow the scheme, the other is the role of text on the
page, and a light-only reading called every title `always-dark` — which would have
made a dark board unreadable, the very fault the gallery draws two surfaces to
catch. So each component is measured twice and a token has to match on both values.

Where a pair matches no token the hex comes through unnamed and the run says which
node it was. Guessing is the thing to avoid: a name that is confidently wrong reads
as a decision somebody made.

**A pair, or no name.** The first version of that check read `dark ?? hex`, which
undid the whole argument by a side door: a node with no dark reading was looked up as
though its colour were the same in both schemes, and the only tokens that match such
a pair are the `always-*` ones. So a missing twin named every title `always-dark` and
every card `always-light` — the light-only reading again, arrived at another way, and
nothing said so. One reading now names nothing and is reported. The dark pass is
paired to the light one by the specimen's label rather than its place in the list,
because the list is filtered for specimens that render nothing and two lists lined up
by index part company the moment one of them is filtered. A dark pass that comes back
with nothing at all is a pass that did not happen, and that component is refused
rather than written as a page of hex.

Two tokens can still share both values, and then the rank decides by what the colour
paints — `stroke-strong` under a rule, `on-canvas-muted` under a date. `MediaCard`'s
date is such a case: the app asks for `grey-500`, which is the deprecated tier ADR
0022 retires, and `stroke-strong` carries the identical pair. The board gets the
successor's name.

### What it still does not recover

- **A slot.** Unchanged from `kit.mjs`: an instance may override text and visibility
  and can never be given children.
- **A prop with no visual effect**, and every handler. Those are the call site's, and
  the accounting for them stays where it is.
- **Which German name a variant property should carry.** `tone` comes out; `Ton` is
  a decision about the board's own language.

### The defect it found

`kit.mjs` reads `measured.json` and holds its own thirteen against it: direction,
padding, radius, fill, stroke and which sides the stroke is on, plus the size and
cut of each text child. Values, not spellings — `@spacing-2xs` and `6` are the same
padding, so the scales are resolved before the comparison, while the colours stay
names, because resolving those would make `accent` and `red-500` compare equal and
that difference is the thing the measurement went to trouble to keep. `gap` is left
out: the app writes the space between two children as a margin on one of them, which
becomes a `space` node, so the two descriptions say the same thing in different words.

It has to step through a ground the app does not paint. `ui/Hairline` is described
here as a `line` inside a 280px frame the colour of the page, because a component
that *is* one pixel of `stroke` cannot be picked up on the board, so the measurement's
root is the line and the two descriptions sit at different depths. Comparing the two
roots reported the ground's colour as drift in the component, which is worse than
reporting nothing: a line that is wrong teaches the reader to skip the ones that are
not.

`ui/Badge`'s label was drawn **bold** on the board and has never been bold in the
app: `Badge.tsx` applies `typography['text-s']` and overrides only size, tracking
and case, so the cut is `text-s`'s own, which is regular.

Reading that off the app takes one more step than it looks. On web every cut
computes as `font-weight: 400`, because `theme/fonts.ts` loads one file per weight
and puts the weight in the family name — Android ignores `fontWeight` on a custom
font, which is why. So the family is the only honest reading, and it says
`SourceSans3_400Regular`. A measurement that trusted `font-weight` would have
called the whole app regular and been right by accident here.

### The output

`--emit` writes `measured.json`, one entry per component, in the format the
repository's own check wants so that a run does not turn `npm run check` red. It is
committed for the same reason `spec.json` is: a diff then shows what changed in the
app's rendering, which is a thing worth seeing in a review.

## Pointing the screens at the kit

`use-kit.mjs` replaces each recognised subtree in the screens with an instance.

    node tools/figma-plugin/sync-tokens.mjs      # first, always
    node tools/figma-plugin/use-kit.mjs

Sixty-three of them: 24 buttons, 14 headers, 6 project rows, 5 badges, 5 setting rows,
4 status tags, 4 nav cards, 1 club card. The fifteenth header is `/suche`'s, which
holds a search field where the back label goes; a slot is not something an instance
takes, so that one stays a copy. The eyeballed numbers go with them — a
button label measured off a PNG came out at 13px semibold, and `text-button` is 16
bold — so the screens move visibly, and towards the app.

It is destructive on purpose. `spec.json` is committed, so the copies are one
`git checkout` away; no second description is kept alongside. Running it twice is a
no-op, because a node that is already an instance matches no rule.

**`sync-tokens.mjs` has to have run first.** The matchers classify a button, a badge
and a status tag by their fill, and they compare against `@color-accent` and
friends, because the board's transcribed hexes are eyeballed approximations that only
the token map resolves. On an untokenised spec every one of those rules comes up
empty. That is a hard failure now rather than a board full of grey badges: a node
that matches a rule by name and then cannot be read stops the script.

Two rules worth knowing. A matched node is never descended into, so the containers
come first: `NavCard` and `ClaimStatusTag` both *hold* a badge, and matching the
badge first would convert it out from under them. And a rule may declare `eats`, the
node types to swallow after the instance — the board separates its rows with
`space, line, space` while the component brings its own hairline and padding, so all
three go or every row ends up underlined twice.

**The kit is one page and Figma lays it out.** Nothing in `kit.mjs` says where a
component goes: they are the children of one auto-layout frame with `WRAP`, a fixed
width and generous gaps. Three hand-set columns fitted thirteen entries, and the
guessed heights that replaced them (`120 + options * 90`) packed fifty-two into a
heap, because the guess is nowhere near a real size — an `ArticleRow` is four hundred
wide and the type sheet is a screen tall, and neither number exists before Figma has
drawn them.

## What the plugin does not do any more

It used to read a board back out into a description, which is how these screens were
recovered from an earlier, imperative version of this plugin that no longer existed.
That job is done: `spec.json` is the source and the board is the output, so the
importer was dead code — and it was the only thing that made the spec server accept a
write. It is gone, along with the `/export` endpoint. `git log` has it if a board is
ever edited by hand faster than the spec can follow.

## Why a plugin and not the MCP server

Two other routes were tried first, and both have a ceiling this does not:

- **Figma's cloud MCP server** allows **20 tool calls per month** on a Starter plan.
  That budget builds about thirteen screens, then stops until the next month.
- **figma-linux-next's built-in MCP server** has no budget, but its write side is a
  fixed vocabulary: `create_frame`, `create_text`, `create_rectangle`, `update_node`,
  `delete_node`, `reparent_node`, `set_variable`. No vectors, so no arrowheads; no ellipses; no `layoutSizing* = FILL` on children; and
  `update_node` cannot change a font. It is also one HTTP round trip per node, and
  these screens run to hundreds of nodes each.

A plugin has the whole Plugin API and no quota. The read side of that same MCP server
is still the right way to *check* the result, and that is how these screens were
compared against `screens/android/`.

## Reading the board back

The MCP server's read side is the way to check what the plugin drew, and it is
better than a screenshot for anything geometric: `get_metadata` returns every node's
box, so "does this overflow", "did that text wrap" and "do these two overlap" are
questions with numbers for answers. Four defects were found that way on
2026-09-10 and none of them would have been settled by looking — a title that had
become one long line, two children of a stack at 24 and 40 pixels inside a
319-pixel component, a variant set with one variant, and two components whose entire
content was the word "canvas".

Four more on 2026-09-10, from the same instrument and one arithmetic check: a play
button at 0,0 in a 176-pixel thumbnail, a row wearing a border on all four sides
where the app draws one under it, every `items-center` row against its top edge, and
nine components drawn on the board that the interpreter had registered nowhere. The
last one was found by subtracting: the summary said 41 components where the page held
50, and nine is exactly how many measured names carry an `=`.

**`get_screenshot` needs the Figma window visible.** Behind another window or
minimised it returns nothing and the call times out; the canvas is WebGL, and an
Electron window that is not being composited has no pixels to export. It fails the
same way whether the request comes from an MCP client or over HTTP, which is what
makes it look like a broken export rather than a hidden window. Raise the window
first, then export.

## Running it on Linux

Needs a desktop client, which on Linux means
[figma-linux-next](https://github.com/arximus88/figma-linux-next) (the official app is
macOS and Windows only).

    Plugins -> Development -> Import plugin from manifest -> manifest.json

**Importing stores a portal handle, and that handle holds one file.** The XDG document
portal grants access to exactly the file that was picked and mounts it under
`/run/user/<uid>/doc/<handle>`; figma-linux-next saves that as the plugin's path. A
plugin is always at least a manifest plus its main script, so the manifest loads and
then the console says `Unable to load code`. Fix it with the app closed:

    node tools/figma-plugin/fix-plugin-path.mjs [directory]

Re-run that after every re-import. `useZenity` in the app's settings does not help;
zenity is present inside the sandbox but the plugin importer does not use it.

Two further traps on the way there:

- **The sandbox cannot see this repo.** It is granted `xdg-documents` and
  `xdg-download` only. Either keep a copy under `~/Dokumente` (what
  `fix-plugin-path.mjs` defaults to) or grant this directory read access:
  `flatpak override --user --filesystem=$PWD:ro app.borys.FigmaLinuxNext`.
- **`~/Dokumente`, not `~/Documents`.** `xdg-documents` follows
  `XDG_DOCUMENTS_DIR`, which on a German system is the former. A plugin in the
  English-named directory is invisible to the sandbox.

Manifest note: a localhost origin belongs in `devAllowedDomains`, not
`allowedDomains`, and Figma wants `http://localhost:8787` rather than the bare IP.

## Running it on macOS

The official desktop app, so none of the section above applies. Import from manifest
records the directory the files sit in and the plugin runs from there. Nothing to
repair afterwards, which is the entire job of `fix-plugin-path.mjs`.

The **Plugins** menu is native and fills itself late. It is absent until a file is
open, and then reads `Loading…` until someone opens it by hand once. A script that
reads the menu without opening it gets `Loading…` forever and concludes the import
failed.

**What stops a fresh file is the plan, not the platform.** `spec.json` describes four
pages, a Starter file holds three, and a new file has already spent one on `Page 1`.
`drawPage` looks a page up by name before it creates one, so deleting `Page 1` buys
the fourth back. The refusal comes from Figma's own document model, so no client
avoids it.

**A macOS VM has no GPU and Figma will not say so.** Chromium cannot reach
ANGLE-over-Metal, the window paints nothing, and the process sits at 0% CPU, which
reads as a hang. `--disable-gpu` paints the interface and then kills the editor,
because the canvas is WebGL. Software GL is what works:

    open -a Figma --args --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader

`open`, not the binary. A process started over SSH has no Aqua session, so Chromium
cannot reach the Keychain, cannot decrypt its cookie store, and drops the Figma login
on the next start without saying anything.

The emoji twins hold here too. `♡` U+2661 and `►` U+25BA draw as text on macOS, where
the emoji font a missing glyph falls back to is Apple Color Emoji.

## Two things to know

**Re-running is safe.** Every frame a page's `owned` list names is deleted before it
is rebuilt, so a redraw converges instead of stacking copies. Frames it does not own
are never touched. A fully generated page says `owned: '*'` and sweeps itself
instead: a name list only removes what the document still mentions, so a component
that gets renamed would otherwise stay behind for good.

**A deleted screen has to STAY in `owned`.** Same rule, and it catches everyone once.
Drop the name and the plugin stops mentioning the frame, so every board already drawn
keeps it for ever and no later run can reach it. `beitreten` and `(tabs)/profil, Gast`
are in both lists for that reason and no other: they are tombstones, not screens, and
tidying them away would strand exactly what they exist to sweep.

**No arrows.** Figma design files have no Connector node, so navigation had to be
drawn: vectors with `strokeCap: 'ARROW_LINES'` in one locked overlay. Move a screen
and its arrow stayed behind, which is why it was dropped and the code with it. The
navigation flow belongs in a FigJam board, where connectors are real.

## The typeface trap

Every `headline-*` variant in `packages/design-tokens/src/typography.generated.ts` is
`"family": "sans"`. **`text-article` is the only serif variant**, and it has exactly
one call site, `app/tagebuch/[id].tsx`. Everything else serif comes from an explicit
`family="serif"`: `components/gate/LoginGate.tsx` twice and `app/onboarding.tsx` once.
On the board that is the gate's three states, onboarding's four, the reader's
paragraphs, the diary entry and the kit's own `text-article` specimen. Serif anywhere
else is a mistake — four headings were, until a review pass counted them.

An earlier version set every screen title in Merriweather, because two comments in
`components/feed/` said "serif headline" and "serif title" over JSX rendering
`headline-l` and `headline-s`, which are sans. Those comments are corrected upstream
now, so the example no longer reproduces; the lesson is why this section is still
here. If you are about to trust a comment about typography, read the token instead.

## What is derived and what is transcribed

The screen list and the route names come from `apps/mobile/src/app/**`.

**The transcribed text sizes are eyeballed and consistently small.** A group heading
is 9px on the board where `ui/Overline` is 12; a body line is 13 where `text-m` is 15.
Every node the kit draws carries the real number, so the board is a mix, and a heading
written at its correct size next to four measured ones reads as a hierarchy the app
does not have. New copy therefore matches its neighbours rather than the token, and
lifting them all is one job for one day. The **content inside each screen is hand-transcribed** from
the screenshots in `screens/android/`, and that is the part that rots: change a
headline in the app and nothing here notices.

Thirty screens, one fewer than before: `beitreten` was deleted with the contribution
flow ([ADR 0020](../../adr/0020-no-contribution-in-the-app.md)), and the profile's
membership card reads the entitlement instead of setting an amount.

Six screens have no screenshot at all — `projekt/[id]`, `serie/[id]`,
`aufruf/[slug]`, `tagebuch/[id]`, `behauptung/[id]` and `formular`. Their layout is
inferred from the source, and they say so in their frame names, in the file, where
someone reading the board can see it.
