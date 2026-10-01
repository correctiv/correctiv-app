# ADR 0034 — One component for the two-sided row, and a tab bar that stops pretending at 130 %

Status: accepted, 2026-09-16, and carried out the same day. Written after the fact:
[#158](https://github.com/faktenforum/correctiv-app/issues/158) asked for four defects
to be fixed and got a component and a check instead, which is a wider change than the
issue proposed and is the part worth arguing.

[ADR 0033](0033-one-text-size-for-the-whole-app-the-systems-by-default.md) names #158
as what has to land before an in-app text size can be offered. This is that landing.

## Context

`screens/tools/tour-a11y.sh` walked the app at 200 % system font on 2026-09-16 and
photographed four instances of one fault, plus a fifth of a different kind. **None of
them is visible at 100 %, and none of them is visible to `npm run check`.** The
pictures are in the issue and in `screens/evidence/`.

The four share a shape, and the shape is a class string:

```
<View className="flex-row items-center justify-between">
```

Eleven of those were written out by hand across the app. `space-between` distributes
the room that is **left over**, so a row built from it is correct exactly while there
is room left over. At 200 % there is none, and the two sides do not stop at each
other: they meet, then overlap, then the right-hand one leaves the screen. Home's
date ran off the right edge, `SPOTLIGHT` and `Alle Ausgaben →` printed as one word,
and the door's two footer links overlapped with a third of the second one's target
off screen.

The fifth, the search field, is the same omission in its third form: a fixed
`height: 44` that the placeholder outgrew, so its second line was drawn below the
field's own border and across the chip rail underneath.

**The tab bar is not one of these**, and that is the whole of why it needs a second
answer. It is Material's `BottomNavigationView` through
`expo-router/unstable-native-tabs` ([ADR 0013](0013-native-tabs-and-a-web-tab-bar-of-its-own.md)),
this app does not lay it out, and `react-native-screens` exposes its colours, its font
and its label visibility and nothing else — no padding, no minimum gap, no second line.

## Decision

### 1. A two-sided row is a component, and the class is banned

`apps/mobile/src/components/ui/SplitRow.tsx`. It owns the two things the eleven call
sites each forgot:

- **A gap that cannot collapse** (`gap-s`). It is a minimum, not a spacing: while the
  row has room, `justify-between` still pushes both sides to their edges and the gap
  is invisible. It starts to matter at exactly the width where the old row started to
  fail, which is why it changes nothing at 100 %.
- **Permission to wrap** (`flex-wrap`). This is what makes the gap keepable. A row too
  narrow for its contents has no legal layout without it, and Yoga produces an illegal
  one; with it the second side takes a line of its own and both stay whole.

**Not shrink, which is the other obvious answer.** Shrinking both sides ends in two
ellipses touching across a 12 px gap — which is the tab bar's picture in that issue and
is the thing being fixed, not a fix for it. ~~A caller that genuinely wants one side to
give says so on that child (`className="shrink"`), because it is that child's property
and not the row's.~~ Struck, because it cannot work: flexbox breaks lines before it
flexes, so under this row's own `flex-wrap` a `shrink`ing child wraps at exactly the
width it would have wrapped at without it. Measured on the two label/value rows that
carry `shrink text-right` — the door's access shortfall and the profile's membership
card — where at 200 % the value sits on its own line at its label's left edge and
`text-right` draws nothing
(`screens/evidence/158-membership-rows-at-200-light.webp` and the three beside it).
There is no child-side escape from the wrap and `SplitRow` grows no prop for one; its
docblock carries the argument.

**`apps/mobile/__tests__/split-rows.test.ts` holds the app to it.** `justify-between`
appears in `SplitRow.tsx` and in two excused files, each with a written reason: the
reader's floating header (fixed-size icons, absolutely positioned, must not grow
downwards into the article) and one media tile (a column, no second side). This is
mechanism 2 on [ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md)'s
ladder, and it is there rather than in AGENTS.md because all four defects passed review
and a green check: a convention that can only be broken silently is not one.

### 2. The tab bar drops four labels above 130 %, and the threshold is measured

`labelVisibilityMode` is `labeled` up to a system font scale of 1.3 and `selected`
above it. Photographed on `Medium_Phone_API_36`, 1080x2400 at 420dpi, one shot per
step of Android's own slider:

| scale | what the bar shows |
| --- | --- |
| 1.0, 1.15 | five labels, whole, clear space between them |
| 1.3 | five labels, whole, the gap down to about two pixels — the last step that is legible |
| 1.5 | `EntdeckenMediathekMitmach…` — two touching, a third truncated into the fourth |
| 2.0 | `Entde…Media…Mitm…` |

**Making the labels smaller is not available**, and saying why is the point of writing
this down. ADR 0033 puts one text size on the whole app with the system's as the
default and names this defect as its prerequisite; pinning the tab bar's font to make
five German words fit would defeat the setting it is being fixed for. Dropping the
labels is the only other lever the platform exposes.

Nothing is lost to a screen reader: Material takes each item's `contentDescription`
from its title rather than from the visible label, checked with `uiautomator dump` at
2.0, where all five tabs still report their names.

### 3. One line for the word break, and it stops at the headlines

`Typo` answers it per variant, from a `Record<TypoVariant, 'none' | 'normal'>`:
`normal` on the body sizes, `none` on the `headline-*` ones and on `button`. Android
breaks a word too long for the line wherever the line happens to end and prints no
hyphen, which is how the hero's teaser read `Gebäud / emodernisierungsgesetz`. German
compounds are longer than the lines a phone draws, so this is a property of the
language and belongs at the component the app's prose is set in.

**Not "the one component every line of text goes through", which is what this record
said and is false.** `ui/Button`, `ui/Badge` and `ui/Chip` each render a `Text` of
their own with a `typography[…]` style and never touch `Typo`, so none of the three is
hyphenated whatever that table says. It is right for all three — one short label in a
box sized for it — and it is the reason the declaration was written as a rule about
prose rather than as a rule about text.

It is also a `Record` rather than the `variant.startsWith('headline')` this was
written as. The prefix test classified `button` by accident, nobody having decided
about it, and would have classified the twelfth variant the same way in silence; the
record is [ADR 0031](0031-four-mechanisms-for-this-must-not-be-forgotten.md)'s
mechanism 1 standing where mechanism 4 would otherwise be needed.

It is the same declaration as `flex-wrap`, one layer down: telling the layout engine
what to do when the content is wider than the line rather than leaving it to guess.

**Why it stops at the headlines, measured rather than preferred.** Hyphenation knows
nothing about the font scale, so switching it on for everything changes 100 % as well.
Shot before and after on the emulator: every screen whose words are the app's own came
back identical — the gate, both onboarding steps, Entdecken, the settings, at 0.7 %
RMSE, which is the clock in the status bar. The one thing that moved was a live
headline, which divided as `Abgeord-netenhaus` where it had wrapped whole. German
headlines are not hyphenated and #158 asks for 100 % to be left alone, and those are
the same answer.

## What it costs

**Two stacked lines where there was one row.** At 200 % the wordmark keeps its line and
the date takes the one under it, `SPOTLIGHT` keeps its line and `Alle Ausgaben →` takes
the one under it. That is a layout nobody drew, and it is the readable one.

**And a label/value row that reads two ways in one card.** The membership card at
200 % puts `Stufe` over its value, left aligned, and `Zugang über` beside its own,
right aligned, because only the first is too long for the row. Photographed in both
appearance settings, since a wrapped side lands at `flex-start` and no `text-right` on
it survives that: `screens/evidence/158-membership-rows-at-200-{light,dark}.webp` and
`158-shortfall-rows-at-200-{light,dark}.webp`. Every value is whole and nothing leaves
the card, which is the requirement; one card reading two ways is the price, and it is
smaller than a value that meets its label.

**Four unlabelled glyphs above 130 %.** ADR 0013 argued for `labeled` because
`Entdecken` (a compass) and `Mitmachen` (three figures) are the two nobody can name
from the glyph, and that argument is unchanged and still right. What it did not
consider is the scale at which the labels stop being labels. Above 130 % the choice is
not between a label and a glyph, it is between a glyph and `Entde…Media…` — and the
ADR 0013 sentence is struck for that reason and no other.

**The one label that is left is still truncated.** At 200 % the selected tab reads
`Entde…` on Entdecken and `Media…` on Mediathek. **Measured rather than assumed, after
a review doubted the reason given here**, which was that Material gives every item a
fifth of the width: `uiautomator dump` with `selected` on at 200 % puts all five items
at exactly 216 px on a 1080 px bar, the selected one included, and the selected item's
label view fills its own 216 px and no more. So the reading is right and so is the
reason, and the doubt was worth having — `LABEL_VISIBILITY_SELECTED` is the constant
Material 2's `BottomNavigationView` used for its *shifting* mode, which did widen the
selected item at the others' expense, and the name survived into
`com.google.android.material:material:1.13.0`, the version `react-native-screens`
compiles against, where the behaviour did not. The mode chooses which labels are
drawn and nothing about the widths. That is the issue's own standard met and not
exceeded: truncation is acceptable where a separation survives it, and there is
nothing beside it to run into. `unlabeled` would remove the ellipsis and the name with
it, which is worse.

**A headline can still break inside a word at 200 %.** The rule that keeps 100 %
untouched is the rule that leaves the display sizes unhyphenated, and those are the
same rule. No headline in the app's own copy is a single word longer than a line at
200 %; a feed could carry one, and it would break as the teaser used to.

## What is open

**Whether 130 % is the right threshold anywhere but here.** It is a property of five
German words at 1080 px and there is no way to compute it from inside the app.

~~A second language moves it and nothing would say so.~~ Something says so now:
`apps/mobile/__tests__/tab-bar-labels.test.ts` pins the five German strings, the five
ids, the number as `_layout.tsx` spells it and the fact that one language ships, and
fails when any of the four moves. It is AGENTS.md's rule that the check ships with the
fact, arriving late — this record named the drift and left it, which is the half of a
"what is open" entry that does nothing. The check cannot re-measure and does not
pretend to: a red run means the number is no longer known to be right, and the answer
is another round of `screens/tools/tour-a11y.sh`. **The screen width is the one input
it still cannot see**, so 1080 px remains an assumption this repository cannot hold
anybody to.

**The bar at 130 % itself.** Two pixels between `Mediathek` and `Mitmachen` is legible
and is not comfortable. Whether that step should also drop the labels is a design
question, and this record chose the reading that keeps more of them.

**Every other spelling of a two-sided row.** The check reads one class. A row with one
side pushed over by `ml-auto`, or a three-part row, is invisible to it — the ban covers
the spelling this app actually used eleven times, not the idea.

## What it retires

[ADR 0013](0013-native-tabs-and-a-web-tab-bar-of-its-own.md), one statement:

> **Every destination keeps its label, which took saying so.**

True up to a system font scale of 1.3 and false above it, where only the selected tab
is labelled. Struck where it stands; the paragraph's argument for `labeled` over
Material's `auto` is untouched, because `auto` drops labels by tab **count** at every
size and is still the wrong answer.

Nothing else. The colour tiers, the ports, the door and the header decisions are
unaffected: this record adds a component and one platform concession, and moves no
boundary.
