# ADR 0074 — A block's family is named once, and both hosts read it

Status: accepted, 2026-10-02, decided by the product side and built the same day. It
amends [ADR 0073](0073-every-screen-takes-every-block-and-a-block-declares-its-category.md)
§2's **words**, and nothing else in it: the category stays the app's, the core still
exports `blocksByCategory(screen)` and still holds no label, and the four screen-bound
blocks of §3 are untouched.

## Context

ADR 0073 §2 made a block declare one of six families and put the grouping in the core, and
it said where the German heading over each family goes: the workbench, in
`preview/home/document.ts`, for ADR 0054 §3's reason unchanged — the app declares what a
thing is, the tool says what it is called.

That reason was sound for one host and stops being sound at two. The component gallery is
the app's own page, published like any other route, and it groups its fifty-one entries
the way the newsroom's palette does, because a gallery sorted by folder answers "where does
this file live" while everybody who opens it asks "what kind of thing is this". So the same
six words were wanted in a place that cannot have them where they were:

- **A German word in `packages/app-core` is undefined in light mode** (AGENTS.md, "Not in
  the core"), so the core stays out of it.
- **The app may not import the workbench** ([ADR 0040](0040-the-app-does-not-depend-on-the-workbench.md)),
  and a German string written in `apps/mobile/src` fails `localisation-seam.test.ts`. So
  the app cannot reach the workbench for the word either.
- **The workbench's catalogue is not the app's.** ADR 0050 §3 keeps two, and the two are
  separate because the audiences are. A second copy of six German strings in the
  workbench's catalogue is a table somebody forgets to re-translate, and nothing in the
  repository can see the two part.

That leaves exactly one place both halves can read, and it is the app beside the blocks.
The direction of the dependency does not change: the workbench already reads the app
(ADR 0040's permitted side of that line), and now it reads six more descriptors from it.

## Decision

### 1. The words are the app's, beside the blocks

`apps/mobile/src/lib/home/category-labels.ts` holds `CATEGORY_LABELS`, keyed by the
core's `BlockCategory`, with English `defaultMessage`s and the German in
`packages/catalogue/src/de/home.ts` beside every other `home.*` string. The ids did not
move with the table: `home.category.*` is what the workbench already extracted, so a
translator's entry is reused rather than a new id to be filled in, and the only thing that
changed is which catalogue holds the German.

**ADR 0054 §3 still holds, and this is where its line is.** The app declares what a thing
is; the thing being named is now a family the app itself groups by, and a family the app
groups by is not the workbench's vocabulary to spend. What is retired is only the
conclusion that the words must therefore be the workbench's — which followed from there
being one host.

### 2. A hook, because the workbench may not use the app's formatter

`useCategoryLabel(category)` is the one formatter both hosts call. The gallery could call
`useIntl()` itself, and the workbench must not: `test/i18n.test.ts` fails on a `useIntl`
anywhere in `apps/workbench/src` outside `i18n/`, and rightly, because the palette's dialog
sits inside the `AppHost` the block list mounts, so react-intl's context there is the
APP's. `useWorkbenchIntl()` resolves against the site's own catalogue, which holds no
`home.*` id and renders the English `defaultMessage` in silence.

**The consequence is visible and is the price: these six words follow the app's language,
which the preview's `lg=` chooses and which is German by default, while the words around
them follow the site's setting** (ADR 0052 §1). That is the split the block drawings
beside them already make, and one table is worth more than a page that is uniformly in one
language.

### 3. Two hosts, one table, and the ratchet that keeps it one

`apps/mobile/__tests__/gallery-groups.test.ts` reads every `block:` out of the gallery's
catalogue and fails on one the core cannot answer — the roll-call in the direction a type
cannot see, since `Entry['block']` is a `string`. The same file takes the app's half of
"one list, one table of words". `apps/workbench/test/preview/palette.test.ts` takes the
whole-repo half, because ADR 0040 means an app test could not name this site at all.

## Why not the alternatives

**The six German strings in both catalogues.** It renders correctly on the day it is
written and parts the day a family is added, with nothing to say which copy is current.
ADR 0073 §2 refused a second list of the families for exactly this reason; a second list of
their names is the same fault one level down.

**The core, with `coreMessage()`.** Refused on the measured reason rather than the
argument: the core is where `var(--var-color-always-light)` is undefined in light mode,
and a German heading in the one package every host imports is the wrong place for it.

**A category id as the heading, drawn by each host.** The workbench's own check already
refuses this shape for the palette (`PALETTE` may not contain `>{category}<`), because
`faktencheck` to a newsroom is an id where a word belongs. Both hosts read the same word
or neither does.

**Grouping the gallery by folder still and saying nothing about families.** That is what
the page did, and it is the question about the source tree rather than about the component.

## What it costs

**A half-German picker when the site is English and the app is German**, which §2 states and
which is one `lg=` away from being German throughout. It is the same seam
`HomeBlock.tsx` and `Palette.tsx` already argue at length, and it is cheaper than the
alternative; the honest fix, if it is ever wanted, is for `AppEnvironment` to take the
locale as the prop it already takes for the appearance.

**The gallery's headings are ~~German while its own furniture is English~~ English, like the
rest of its furniture.** Wrong on the day it was written, 2026-10-02, and struck here rather
than left standing as a cost somebody had chosen: a design review of the grouped gallery found
the mixture — an English heading and lede, a German family heading, English again under it — and
read it as a page nobody had given a language. The table is unchanged and still the app's; what
changed is which half of it this page prints. `Gallery.tsx` asks `categoryName` and gets the
descriptors' English `defaultMessage`, where the newsroom's picker asks `useCategoryLabel` and
gets the German that ships: one table, two readers, and `lib/home/category-labels.ts` says why
that is not a second copy of it. The specimens keep the app's real German copy, which is content
here and always was (`Gallery.tsx` is developer-only for the same reason and says so).

## What this retires

**ADR 0073 §2's sentence, "the workbench says what the category is called"**, and with it
its `CATEGORY_LABELS` in `preview/home/document.ts`. Struck there; the reasoning around it
is left standing, because it was right about what the core may not hold.

Nothing in ADR 0054 §3, ADR 0040, ADR 0050, ADR 0052, ADR 0049 or ADR 0073 §1, §3 or §4 is
struck.