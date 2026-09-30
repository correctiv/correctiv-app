# ADR 0066 — A project feed has a load-more, and its own list

Status: accepted, 2026-09-30.

## Context

`loadMore` has been in the core since [ADR 0015](0015-reading-correctiv-org-through-its-rest-api.md)
made the feeds live, and it has been tested, documented and uncalled. Its own doc
comment named the one screen it belongs on: `projekt/[id].tsx`, and it named the
reason it was not there yet — [ADR 0012](0012-a-list-virtualizer-for-the-unbounded-lists.md)
counts that list as bounded and therefore not worth virtualizing, so a "load more"
would have handed the screen a change it was about to have to absorb.

So the screen read `data?.slice(0, 12)`, and that number was doing two jobs. It was a
ceiling, and it was a lie about how much the app had.

**`PAGE_SIZE` is 20.** The core asks WordPress for twenty pieces and the screen drew
twelve, so on every project page with more than twelve the app fetched eight pieces a
reader could have read and dropped them on the floor. Measured on `projekt/klima`
against the release build on 2026-09-30: the first screen held 12 rows and the fetch
had produced 20. `CORRECTIV.Schweiz` has twelve pieces in total, so on that project the
cap cost nothing — which is exactly why it survived this long. The waste was only ever
visible on a project large enough to notice and nobody had gone looking with the
network panel open.

## Decision

### 1. A load-more on the project feed, and no cap on what it has already fetched

`loadMore` is called, and the list is what the core has rather than the first twelve of
it. The button sits in the `ListFooterComponent`, so it is where a reader's thumb
already is at the end of the rows.

**A button, not `onEndReached`.** Reaching the end of a list and finding the next page
already there is the faster screen, and it is also a request fired for a reader who
happened to be looking at the last row rather than at the end of the list, with nothing
on screen to say it happened and no way to decline it. One tap costs a reader nothing
and tells them what it will do. The web target shares this code, where a scroll-triggered
fetch is also a request nobody asked for on a metered connection.

**The button's absence is the sentence.** `hasMore` is inferred from a full page, so a
category whose post count is an exact multiple of twenty reports one page more than it
has, and a reader pressing the button on the last page gets a list that does not grow.
Rather than hide the button on an estimate the client cannot make, the foot says
`Das ist alles, was bisher erschienen ist.` when `hasMore` is false. It is a claim the
store actually holds, and it is the only sentence on the screen that was written for
this decision.

**While the page is in flight the label changes to `Mehr wird geladen …` and the button
disables.** A button that keeps saying "load more" while it is doing nothing is a
control that has stopped answering, and the label is what a screen reader reads.

### 2. The page's scroller is the list, not a `ScrollView` holding one

The obvious version of this change puts a `FlatList` inside the `ScrollView` the page
already has. That is the nesting ADR 0012 argues against, and it is the version that
would have made the screen worse in exchange for the pagination. So the head moves into
`ListHeaderComponent` and the foot into `ListFooterComponent`, and the list *is* the
scroller.

**Two bodies rather than one, and the reason is a hook.** 19 of the 26 projects have no
feed at all, `useFeed` may not be called conditionally, and a page without a feed has
nothing to virtualize — a name, a description, an action and a card fit on any screen.
So a project with a feed gets `ProjectFeed`, which is a `FlatList`, and a project
without one keeps the `ScrollView` it always had. Both draw the same head through
`ProjectHead`, so the two agree on it by sharing it rather than by two copies someone
has to keep in step.

**The separator moved to `ItemSeparatorComponent`.** The hairline used to be drawn by
each row, which meant every row carried a node for the row above it and the first row
could grow one by forgetting. One component for the list, and the first row cannot
acquire a line by not asking.

### 3. `useFeed` grew three fields, and `AsyncState` did not

Pagination is a property of one feed, not of a request. `AsyncState` describes the
outcome of a single fetch and is also the return type of `useMergedFeeds`, where there
is no page two — a merge of several feeds has nothing to page. So `hasMore`,
`loadingMore` and `loadMore` live on `FeedState`, which extends `AsyncState` and is
returned by `useFeed` alone. The seven existing call sites destructure
`{ data, loading, error }` and none of them changed, which is the point of the shape
having only ever grown.

## Consequences

**`suche.tsx` did not move with it.** ADR 0026 withdrew its `FlatList` conversion
deliberately, so that it converts on this same criterion when a search grows a
pagination of its own. It has none, and issue #106 defers the question of what search
becomes until a trigger fires.

**Nothing here was profiled on a device.** The gain is eight rows a reader can now
reach on a project page, and the cost is a `FlatList` on a screen that was not measured
to need one. The 12-to-20 count is measured, from the built web target against
`correctiv.org`; the render cost of the extra rows is not, and the emulator work that
would say so is issue #102's business.

**The offline snapshot is a first page and now looks like one.** With no network the
cascade serves the bundle's snapshot, `hasMore` is whatever the snapshot was written
with, and a reader can press the button and get nothing. The loading and failed states
say so where the list is empty; a reader who is already looking at rows is not told
that the rest exists only online. Left as it is, because the alternative is a second
status the core does not carry.

## What this retires

- ADR 0012's table row `| projekt/[id].tsx, feed | ≤ 12 | data?.slice(0, 12) |` and its
  claim that every other list stays a mapped `ScrollView`, both struck where they stand.
- ADR 0012's sentence in *What this has not delivered* that raising `slice(0, 12)`
  "would move that screen into the first category without anything in the code saying
  so", struck with a clause naming this record. It said so first, which is what the
  struck-through text is for.
