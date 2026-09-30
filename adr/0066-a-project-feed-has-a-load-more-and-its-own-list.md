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

### 3. `useFeed` grew four fields, and `AsyncState` did not

Pagination is a property of one feed, not of a request. `AsyncState` describes the
outcome of a single fetch and is also the return type of `useMergedFeeds`, where there
is no page two — a merge of several feeds has nothing to page. So `hasMore`, `paged`,
`loadingMore` and `loadMore` live on `FeedState`, which extends `AsyncState` and is
returned by `useFeed` alone. The five other call sites read `.data` or `.offline` off
the result and none of them changed, which is the point of the shape having only ever
grown.

**`paged` is there because `hasMore` alone cannot carry this decision.** Three paths
render a list without ever establishing that the list ends: a cache hit, the bundled
snapshot, and the RSS fallback. In all three `hasMore` is `false`, and in none of the
three does that mean CORRECTIV has published nothing more. A screen reading it as a
fact would tell a reader that twenty rows are everything the newsroom has, having
learned nothing of the kind. So the slice records whether the answer was exhaustive —
`readFromNetwork` says so per source, because RSS is the sharp case: it has no page
two, which is a fact about the feed, and not about the archive, which serves a fixed
window of recent posts. The foot says nothing when the answer did not arrive.
Measured on `Medium_Phone_API_36` on 2026-09-30: the first version of this screen
printed the sentence over a warm start, and two rounds of review after that found the
RSS round and the missing page beneath it.

**The cache still holds a bare array, and that was nearly got wrong.** A cached
`hasMore` is a claim frozen for fifteen minutes: a category that filled a page at 14:00
and emptied at 14:05 keeps offering a button that fails, and a reader who paged to
three comes back to a list that stops growing. Silence costs a reader one press of
patience; a wrong answer cached costs them the rest of the list.

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

**A warm start and a reader without a network get the rows and no foot.** Both paths
return a list without ever asking whether more exists, so neither knows, and the foot
now says nothing rather than guessing. That is a real cost and it is deliberate: the
cache is good for fifteen minutes and the snapshot is the floor under a reader with no
network at all, and for both of those a "load more" button would be one `loadMore`
refuses on `!hasMore`. A second status — "there is more, but only online" — would say
it honestly, and it is not carried today. The alternative taken was silence, which is
the smaller claim of the two.

**A page that a refresh overtook is dropped whole.** `loadMore` reads the page number
before its await, so a refresh landing in between puts the slice back to page 1 while
a page 3 is on its way. Appending it would hand the reader pages 1 and 3 with page 2
missing and store `page: 3` as though they had walked there — and the URL dedup cannot
see it, because a missing page and a duplicate are different problems. So the page
number is compared against what is live afterwards and a page that no longer follows the
list is discarded, with the button re-armed rather than left disabled. This is older
than the button; nothing called `loadMore` until the screen did.

## What this retires

- ADR 0012's table row `| projekt/[id].tsx, feed | ≤ 12 | data?.slice(0, 12) |` and its
  claim that every other list stays a mapped `ScrollView`, both struck where they stand.
- ADR 0012's sentence in *What this has not delivered* that raising `slice(0, 12)`
  "would move that screen into the first category without anything in the code saying
  so", struck with a clause naming this record. It said so first, which is what the
  struck-through text is for.
