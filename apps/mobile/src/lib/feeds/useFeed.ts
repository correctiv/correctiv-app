import { useEffect, useMemo } from 'react';

import {
  fetchFeedKey,
  fetchMany,
  investigations,
  loadMore as loadMoreItems,
  mergedFeedItems,
  mergedFeedStatus,
  type FeedStatus,
} from '@correctiv/app-core/stores/feeds';
import type { FeedItem, FeedKey } from '@correctiv/app-core/types/models';

import { useAppDispatch, useAppSelector, useLazyLoad } from '@/lib/store/core';

/**
 * React bindings for the core's feed slice.
 *
 * This used to be a `useAsyncData` hook over a `client.ts` of its own: one request
 * per mounting component, no shared state, and its own offline cascade. The cascade
 * is the core's now (`stores/feeds.ts`), so Home and a project page reading the same
 * feed share one load, one cache entry and one status.
 *
 * The shape below only ever grows: every call site already destructures
 * `{ data, loading, error }`, so `offline` was added beside them rather than
 * folded into either.
 */

/**
 * A single feed, and the one thing `AsyncState` cannot express: whether more of it
 * exists. `AsyncState` describes one request's outcome, and a merge of several feeds
 * has no page two — so the three fields live here rather than on `AsyncState`, where
 * every caller would have to answer for a pagination that only one feed has.
 */
export interface FeedState extends AsyncState<FeedItem[]> {
  hasMore: boolean;
  /**
   * Whether `hasMore` is an answer rather than its initial value. A screen that
   * says "that is everything" needs this: a cache hit and the bundled snapshot
   * both return rows without ever asking, and reading their `hasMore` as a fact
   * about the newsroom is the mistake this field exists to prevent.
   */
  paged: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  /**
   * The list came out of the app bundle rather than off the network — a snapshot,
   * not today's news. Not an error, and not the same as `error`: there is something
   * to read. A screen that shows the data owes the reader this much. It used to be
   * every screen on the web target, every time; since ADR 0015 the REST API answers
   * a browser, so this is the state of a reader with no network on either target.
   */
  offline: boolean;
  reload: () => void;
}

/** `error` is derived rather than stored: the slice's failure state IS `'error'`. */
function toAsyncState<T>(items: T | null, status: FeedStatus, reload: () => void): AsyncState<T> {
  return {
    data: items,
    loading: status === 'loading' || status === 'idle',
    error: status === 'error' ? new Error('Feed konnte nicht geladen werden') : null,
    offline: status === 'offline',
    reload,
  };
}

/**
 * One RSS feed, loaded on first use.
 *
 * `byKey[feed]` is a stable reference between updates (Immer patches the feed in
 * place and leaves its siblings alone), so it is safe to select directly — unlike
 * a selector that builds a fresh object, which `useSelector` compares by
 * reference and would therefore re-render on every unrelated dispatch.
 *
 * The load itself is `useLazyLoad` in `lib/store/core.ts` — the same lines
 * `useVideoChannel` and `usePodcastLibrary` need, including the reason all three
 * dispatch through the Provider rather than the imported store.
 */
export function useFeed(feed: FeedKey): FeedState {
  const dispatch = useAppDispatch();
  const slice = useAppSelector((s) => s.feeds.byKey[feed]);

  useLazyLoad(slice.status, fetchFeedKey, feed);

  return {
    ...toAsyncState(
      slice.items.length > 0 ? slice.items : null,
      slice.status,
      () => void dispatch(fetchFeedKey(feed, { force: true })),
    ),
    hasMore: slice.hasMore,
    paged: slice.paged,
    loadingMore: slice.loadingMore,
    loadMore: () => void dispatch(loadMoreItems(feed)),
  };
}

/**
 * Several feeds merged, newest first and deduplicated by URL.
 *
 * Pass a stable array (a module constant or a `useMemo` result) — a fresh literal
 * on every render would re-run the effect on every render.
 */
export function useMergedFeeds(feeds: FeedKey[]): AsyncState<FeedItem[]> {
  const dispatch = useAppDispatch();
  const byKey = useAppSelector((s) => s.feeds.byKey);

  useEffect(() => {
    void dispatch(fetchMany(feeds.filter((key) => byKey[key].status === 'idle')));
    // `byKey` is intentionally not a dependency: this only has to fire for feeds
    // that have never been asked for, and re-running it on every store update
    // would restart the fetch each time one of them lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeds]);

  const items = useMemo(() => mergedFeedItems({ byKey }, feeds), [byKey, feeds]);
  const status = useMemo(() => mergedFeedStatus({ byKey }, feeds), [byKey, feeds]);

  return toAsyncState(
    items.length > 0 ? items : null,
    status,
    () => void Promise.all(feeds.map((key) => dispatch(fetchFeedKey(key, { force: true })))),
  );
}

/**
 * The site-wide stream with its fact checks taken out, loaded on first use.
 *
 * `investigations` is the core's selector rather than a `.filter().slice()` in a
 * screen, and it is memoised because it builds a fresh array: handed straight to
 * `useSelector` it would compare unequal on every unrelated dispatch. Same shape
 * and the same reason as `useSpotlight` in `lib/store/core.ts`.
 *
 * ONE slice is subscribed to, not `s.feeds`. Immer patches `byKey[feed]` in place
 * and leaves its siblings alone, so `byKey.recherchen` keeps its identity while the
 * other six feeds land and `s.feeds` does not — reading the whole object would
 * re-render the profile every time Home finished loading something it does not
 * show. The selector takes that slice (`RecherchenFeed`), so the narrow read is
 * what it asks for rather than something this hook has to remember.
 */
export function useInvestigations(limit: number): FeedItem[] {
  const recherchen = useAppSelector((s) => s.feeds.byKey.recherchen);

  useLazyLoad(recherchen.status, fetchFeedKey, 'recherchen');

  return useMemo(() => investigations({ byKey: { recherchen } }, limit), [recherchen, limit]);
}
