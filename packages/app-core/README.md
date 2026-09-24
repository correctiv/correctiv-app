# @correctiv/app-core

The behaviour of the CORRECTIV app, with no UI framework and no platform SDK in it.

`apps/mobile` (Expo / React Native) imports it. Anything that is not a screen and
not an SDK call belongs here: the model, the parsers, the services, the caches and
**all** of the state.

## The rule

No `react`, `react-native`, `expo`, `vue`, `zustand` or `node:*` import, ever. `test/boundary.test.ts` checks every source file on every PR
and names the offender.

If something needs a platform, it becomes a **port**: an interface in
`src/ports/index.ts` that the host implements. There are five, and that file is the
whole cost of adding a host. See [ARCHITECTURE.md](../../ARCHITECTURE.md#the-five-ports).

## Layout

Subpath imports mirror the source tree; there is no barrel:

```ts
import { configurePlatform } from '@correctiv/app-core';            // ports only
import { loadArticle } from '@correctiv/app-core/articles/load';
import { feedsStore } from '@correctiv/app-core/stores/feeds';
import { formatDate } from '@correctiv/app-core/lib/format';
import type { Article } from '@correctiv/app-core/articles/types';
```

```
src/ports/       KeyValueStore · BlobStore · ContentBundle · AudioBackend · ErrorReporter
src/types/       FeedItem, Video, AudioTrack, MediaChannel
src/articles/    the Article model, the fact-check vocabulary, page meta,
                 the reader document, the load cascade, the offline collector
  extract/       string.ts (no dependencies) and dom.ts (htmlparser2);
                 the reader document's gate, body-allowlist.ts, parses too
src/services/    http · cache (network-first / cache-first) · rss · search ·
                 podcast · peertube
src/stores/      feeds · audio · podcasts · media · video · session · interests ·
                 savedArticles · participation · settings · store · persist
src/data/        feeds.config and the typed sample data
src/lib/         html · rss-parse · format
src/media/       exclusive-playback, only one medium plays at a time
```

## Two things that will surprise you

**The store is the core's, not the host's.** `stores/` is one Redux Toolkit store
with several slices, constructed here rather than by the host, because modules that are
not components need to read the same instance the screens are subscribed to
(`media/exclusive-playback.ts`, the audio watchdog). The host still supplies the
binding (react-redux). `zustand` stays on the boundary test's forbidden list not
because it is a UI framework, which it is not, but because a core with two state
containers is a core with two sources of truth; the entry says so. `createAppStore()` is exported beside the singleton so a test can build
an isolated tree. `stores/store.ts` has the full story, including why the async
actions are plain thunks.

**Derived state is an exported selector taking state, never a store method.** In
React a method is merely awkward; the rule was learned on a host whose reactivity
tracked property reads, where a method silently stopped the template updating. That
is a class of bug invisible until a demo. It stays because it is also the shape the next
binding will want.

```ts
export function isSaved(state: Pick<SavedArticlesState, 'items'>, url: string): boolean
```

## Tests

```bash
npm test -w @correctiv/app-core        # vitest, ~0.5 s
npm run test:watch                     # from the repo root
```

Tests run against real captured correctiv.org pages and feeds, plus architectural
guards: the platform boundary, and the agreement between the two extraction
backends (they must produce the same article from the same page, or the choice of
backend has become a fork).
