# ADR 0067 — A feed's end is one field with three values

Status: accepted, 2026-09-30.

## Context

[ADR 0066](0066-a-project-feed-has-a-load-more-and-its-own-list.md) §3 put two booleans
on the feed slice, `hasMore` and `paged`, and a third, `exhaustive`, on what
`readFromNetwork` returns. Together they meant three things: nobody has asked whether
more exists, there is another page, the list ends.

Two booleans have four combinations, and the fourth, `paged: false` with
`hasMore: true`, was reachable. A cache hit set `paged: false` and left `hasMore` from
the load before it, so `loadMore` would page a feed the foot had just called
unanswered. The screen's test held that state on purpose, because the model allowed it.

## Decision

### 1. `end: 'unknown' | 'more' | 'end'` replaces `hasMore`, `paged` and `exhaustive`

`FeedEnd` in `packages/app-core/src/stores/feeds.ts`. A REST page answers `more` or
`end`; RSS, a cache hit, a stale entry and the bundled snapshot leave it `unknown`;
WordPress's 400 for a page past the end sets `end`. `loadMore` runs only on `more`, and
the project feed's foot is silent on `unknown`. The fourth state can no longer be
written, so the test that held it went with it.

`fetchWpFeed` keeps its `hasMore`: it describes one REST response, where a boolean is
the whole answer.

## Retires

- ADR 0066 §3: `hasMore` and `paged` as fields of `FeedState`, and the slice recording
  whether the answer was exhaustive as a flag of its own. The reasoning for keeping an
  unanswered feed silent stands; only its encoding changed.
