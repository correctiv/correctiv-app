# ADR 0012 — A list virtualizer, for the two lists that need one

Status: accepted, 2026-08-28.

## Context

A React Native best-practices catalogue (`vercel-react-native-skills`) was applied to
the app. Its highest-priority rule is list virtualization, and its wording is
absolute: use a virtualizer "instead of ScrollView with mapped children — even for
short lists", and "default to virtualization".

Read against this app that rule flags almost everything. Twenty-three screens and
components map an array into a `ScrollView`, and none of them virtualizes. Taken at
face value the finding is "the app has no virtualized list", which is true and, on
its own, useless: it does not say which of the twenty-three cost anything.

So the arrays were counted rather than the call sites. Almost all of them are bounded
**in this repo's own code**, and usually to a number small enough that mounting the
lot is cheaper than virtualizing it:

| Where | Length | Bounded by |
| --- | --- | --- |
| `suche.tsx`, articles | ≤ 15 | `searchArticles(debounced, 15)`; the offline fallback caps at 12 |
| `projekt/[id].tsx`, feed | ~~≤ 12~~ **unbounded** | ~~`data?.slice(0, 12)`~~ nothing, since the "load more" that `loadMore` in the core had been waiting for — see [ADR 0066](0066-a-project-feed-has-a-load-more-and-its-own-list.md) |
| `(tabs)/index.tsx`, "Neueste Recherchen" | 5 | `recherchen.data?.slice(1, 6)` |
| `(tabs)/index.tsx`, fact-check rail | ≤ 8 | `.slice(0, 8)` |
| `(tabs)/mediathek.tsx`, videos | ≤ 6 | `videos.slice(0, 6)` |
| `einstellungen`, `onboarding`, ~~`beitreten`~~ (gone with [ADR 0020](0020-no-contribution-in-the-app.md)), `bericht`, `atlas`, `faktenforum`, `backstage` | fixed | sample data in the core |
| `spotlight` | ≤ 12 | ~~sample data in the core~~ the archive's page size, since [ADR 0015](0015-reading-correctiv-org-through-its-rest-api.md) made these issues live. The conclusion is unchanged: still bounded, still not worth virtualizing |
| **`gespeichert.tsx`** | **unbounded** | **the user's bookmarks, and it only grows** |
| **`serie/[id].tsx`** | **unbounded** | **an RSS podcast feed** |

Two of twenty-three. The rule is right about those two and would be busywork on the
other twenty-one — `ListHeaderComponent` plumbing, a changed screen structure, and a
scroller that renders eleven of twelve rows instead of twelve.

The second list is the one that actually hurt. `EpisodeRow` is the heaviest row in
the app: each one opens its own `useEpisodeStatus(id)` subscription, which exists so
that a ticking playback position re-renders one row instead of the list. Mapped into
a `ScrollView` every one of those subscriptions is live from the moment the screen
opens, including for the episodes nobody has scrolled to. A show with two hundred
episodes mounts two hundred store subscriptions to display about eight.

## 1. Decision

`FlatList` on `gespeichert.tsx` and `serie/[id].tsx`. ~~Every other list stays a
mapped `ScrollView`.~~ That second half no longer holds whole, with
[ADR 0066](0066-a-project-feed-has-a-load-more-and-its-own-list.md): the project
feed's cap of `slice(0, 12)` came off, its length stopped being bounded by this
repository, and it is a `FlatList` for the reason the first two are — with the
difference that its scroller became the list rather than a list inside one.

**`FlatList`, not `FlashList` or `LegendList`, and the reason is not performance.**
For lists of this size the three are indistinguishable: FlashList's advantage is row
*recycling*, which pays at a scale — thousands of rows, heterogeneous item types —
that neither of these lists reaches. What separates them here is that `FlatList` is
part of React Native's own export surface and the others are third-party native
modules.

That matters because a **GTK4/Adwaita desktop host via gjsify** is under
consideration, and `@gjsify/react-native` works by aliasing the `react-native`
specifier: it answers RN's own names and refuses anything else by name. `FlatList`,
`SectionList` and `VirtualizedList` are implemented there on `Gtk.ListView` +
`Gio.ListStore` — real virtualization, done by GTK rather than by React. A
`@shopify/flash-list` import has nothing to alias to and would be an iOS/Android
dependency on a screen that is otherwise portable.

This is not a commitment to that host. It is that `FlatList` and `FlashList` are worth
the same on the two platforms that exist today, so the tie is broken by the one that
also survives a third — at the price of no new dependency at all, which is the part
that would need arguing if it went the other way.

## Consequences

**The page heading moved inside the list.** Both screens had a heading above the
scroller. Left as a sibling of a `FlatList` it would sit outside the scroll area and
stay put while the rows moved under it, so it is now `ListHeaderComponent`. On
`gespeichert.tsx` the gap below it is conditional (`mb-s` with rows, nothing without),
because it used to belong to the row container and to the empty notice separately, and
those were two different sizes.

**Uniwind styles a `FlatList`.** `contentContainerClassName`,
`ListHeaderComponentClassName` and `ListFooterComponentClassName` are all declared in
`uniwind/types.d.ts`, so the conversion needed no inline styles and no exception to
the class rule in [AGENTS.md](../AGENTS.md).

**`renderItem` and `keyExtractor` are module-scope constants where they can be.** On
`gespeichert.tsx` they close over nothing; on `serie/[id].tsx` `renderItem` needs the
series and stays inline. The app has the React Compiler on
(`app.json`, `experiments.reactCompiler`), so this is legibility rather than
memoization — the compiler already handles the inline case, which is the same reason
`.oxlintrc.json` leaves `react-perf` off.

## What this has not delivered

**The other twenty-one lists are unmeasured, not proven fine.** The table above counts
array lengths, which is the cheap half. Nothing here was profiled on a device, and the
caps it relies on are caps *this repo currently applies* — ~~raising `slice(0, 12)` on
`projekt/[id].tsx` to a real "load more" would move that screen into the first
category without anything in the code saying so.~~ That is what [ADR
0066](0066-a-project-feed-has-a-load-more-and-its-own-list.md) did, and it said so
here first: the ceiling is gone, the screen is a `FlatList`, and twenty of the
twenty-one are still here unmeasured.

**Home is untouched and is the interesting case.** `(tabs)/index.tsx` is a
heterogeneous feed — hero, briefing, early access, rows, two rails, a callout,
backstage, a footer — and the catalogue's `list-performance-item-types` rule wants
exactly that expressed as a typed array with `getItemType`. It would be a real
restructuring of the app's most-read screen for a benefit nobody has measured, and it
was deliberately not attempted here.

**The desktop host is a reason, not a plan.** ~~No gjsify target exists in this
repo.~~ One does, in `apps/desktop`, and
[ADR 0071](0071-re-exported-screens-and-a-variant-where-the-host-refuses.md) records
what became of the three decisions this paragraph asks for: all three were needed, and
all three are made. If one is ever built, three things this app does today are not
answered by `@gjsify/react-native`'s support table and would need their own decisions:
`Animated` (planned, tier P3 — `artikel.tsx`'s reader-header fade), `hitSlop` (refused
by name; used in four places), and remote-URL images (`Gtk.Picture` takes local paths,
and the app is on `expo-image` rather than RN's `Image` in any case).
