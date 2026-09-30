import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { loadPageMeta } from '../articles/load';
import { isFactCheckUrl } from '../articles/url';
import { FEEDS } from '../data/feeds.config';
import { byPublishedAt } from '../lib/sort';
import { platform } from '../ports';
import { getCached, getStale, setCached } from '../services/cache.service';
import { fetchFeed } from '../services/rss.service';
import { fetchWpFeed } from '../services/wp.service';
import type { FeedItem, FeedKey } from '../types/models';
import type { AppThunk } from './store';

/**
 * The article feeds.
 *
 * One cascade for every host: fresh cache → stale-while-revalidate → network →
 * the host's bundled snapshot. The host contributes only its bundle (via the
 * `ContentBundle` port) and its own reactivity binding.
 *
 * The network rung has two rounds since 2026-09-01, REST then RSS. See
 * `readFromNetwork` for why the order is not negotiable and why the second round
 * is worth keeping.
 */

const CACHE_NS = 'feeds';
const TTL_MS = 15 * 60 * 1000;

/**
 * How many articles a page asks for.
 *
 * RSS decided this before: it answered with 100, 10 or 7 items depending on the
 * category, take it or leave it. A page size is a choice now, and 20 is one
 * screen and a bit at about 2 KB per card.
 */
const PAGE_SIZE = 20;

/**
 * How much of a feed is real.
 *
 * `offline` is not an error: it means the list on screen came out of the app
 * bundle. A user should be able to tell that from "we have nothing for you".
 */
export type FeedStatus = 'idle' | 'loading' | 'ready' | 'offline' | 'error';

/**
 * What follows the loaded pages. `unknown` until a paged source has answered: a
 * cache hit, the bundled snapshot and RSS all return rows without knowing whether
 * the archive goes on, and none of them may claim it ends.
 */
export type FeedEnd = 'unknown' | 'more' | 'end';

export interface FeedSlice {
  items: FeedItem[];
  status: FeedStatus;
  /** Epoch ms of the last successful network read; 0 if there was none. */
  lastFetched: number;
  /** Highest page number loaded. 1-based, as WordPress counts. */
  page: number;
  end: FeedEnd;
  /** A `loadMore` is in flight — for a spinner under the list, not over it. */
  loadingMore: boolean;
}

export interface FeedsState {
  byKey: Record<FeedKey, FeedSlice>;
}

const ALL_KEYS = Object.keys(FEEDS) as FeedKey[];

/** One slice per configured feed, so the state cannot drift from the catalogue. */
function emptySlices(): Record<FeedKey, FeedSlice> {
  const slices = {} as Record<FeedKey, FeedSlice>;
  for (const key of ALL_KEYS) {
    slices[key] = {
      items: [],
      status: 'idle',
      lastFetched: 0,
      page: 0,
      end: 'unknown',
      loadingMore: false,
    };
  }
  return slices;
}

const initialState: FeedsState = { byKey: emptySlices() };

// --- pure selectors (see stores/interests.ts for why not part of the slice) ---

/**
 * Newest first, by the item's own timestamp.
 *
 * **A feed does not arrive in date order.** Measured on `correctiv.org/feed/` on
 * 2026-09-01, twice, cache-busted: position 1 was a post from 1 August while
 * positions 2 to 6 descended correctly from 31 August. Home reads the first item
 * of `recherchen` as its lead, so the front page led with a four-week-old staff
 * notice while the feed behind it was current. Only `mergedFeedItems` sorted, so
 * a merged list was right and every single-feed list was wrong.
 *
 * Sorted here and not in `parseWpFeed`, because arrival order is information the
 * parser should not throw away: an editorial pick hoisted to position 1 is one
 * plausible reason a feed does this, and if that turns out to be what it is, the
 * lead becomes a decision rather than a bug. What the app owes every reader of a
 * slice is one order, and that guarantee belongs to the state.
 */
function sortNewestFirst(items: FeedItem[]): FeedItem[] {
  return [...items].sort(byPublishedAt);
}

/** Several feeds as one stream: newest first, one entry per article. */
export function mergedFeedItems(state: FeedsState, keys: FeedKey[]): FeedItem[] {
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  for (const key of keys) {
    for (const item of state.byKey[key].items) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      items.push(item);
    }
  }
  return sortNewestFirst(items);
}

/** The one slice `investigations` reads, so a caller can subscribe to that alone. */
export type RecherchenFeed = { byKey: Pick<FeedsState['byKey'], 'recherchen'> };

/**
 * The investigations in the site-wide stream: `recherchen` without its fact checks.
 *
 * `recherchen` is `correctiv.org/feed/`, which carries both and stamps every item
 * `feed: 'recherchen'` on purpose, so that Home's "Neueste Recherchen" does not
 * sprout Faktencheck badges (`services/wp.service.ts` → `fetchWpFeed`). The price
 * of that is that "an investigation" is not a field anywhere and has to be read off
 * the permalink — `articles/url.ts`, where the reasons the other two candidate
 * fields cannot answer it are written down.
 *
 * Which is why this is here and not in the screen that wants it. The profile's
 * impact card did the filter itself, so the one screen that must not list a fact
 * check was also the only place that knew the stream contains them; a second reader
 * of the same feed would have had to learn it again from the same paragraph.
 *
 * `limit` is the caller's, like `recentIssues` in `stores/spotlight.ts`: how many
 * a card has room for is a layout decision and this slice has no business knowing
 * it.
 *
 * It takes the ONE slice it reads rather than `FeedsState`, and that is a fact
 * about the host rather than a tidiness: a binding that has to hand over the whole
 * `feeds` object has to subscribe to the whole `feeds` object, and Immer gives it a
 * new identity whenever any feed lands. `byKey.recherchen` keeps its identity while
 * its siblings change, so this signature is what lets `useInvestigations` re-render
 * the profile for its own feed and no other. A full `FeedsState` still satisfies it.
 */
export function investigations(state: RecherchenFeed, limit?: number): FeedItem[] {
  const items = state.byKey.recherchen.items.filter((item) => !isFactCheckUrl(item.url));
  return limit === undefined ? items : items.slice(0, limit);
}

/** The worst status among `keys` — what a merged list should show. */
export function mergedFeedStatus(state: FeedsState, keys: FeedKey[]): FeedStatus {
  const statuses = keys.map((key) => state.byKey[key].status);
  if (statuses.some((s) => s === 'ready')) return 'ready';
  if (statuses.some((s) => s === 'offline')) return 'offline';
  if (statuses.some((s) => s === 'loading')) return 'loading';
  if (statuses.every((s) => s === 'error')) return 'error';
  return 'idle';
}

/**
 * Swap remote image URLs for bundled covers where the host has one.
 *
 * Offline this is the difference between a list of articles and a list of grey
 * rectangles: stale items still carry the remote URLs they were fetched with, and
 * none of those can load.
 */
function adoptBundledImages(items: FeedItem[]): FeedItem[] {
  const { content } = platform();
  return items.map((item) => {
    const local = content.image(item.url);
    return local ? { ...item, imageUrl: local } : item;
  });
}

const slice = createSlice({
  name: 'feeds',
  initialState,
  reducers: {
    /**
     * Replaces one feed's slice. Immer patches in place, so the other feeds keep
     * their object identity — see the same note in stores/media.ts for why that
     * matters to every component selecting `byKey[key]`.
     *
     * Every route into the slice goes through here — network, fresh cache, stale
     * cache, bundled snapshot, image enrichment — which is why the sort sits here
     * and not in the thunk. A cache written before this existed holds an unsorted
     * list, and it is read on the next cold start.
     */
    patch: {
      reducer(state, action: PayloadAction<{ key: FeedKey; slice: Partial<FeedSlice> }>) {
        const { key, slice } = action.payload;
        Object.assign(state.byKey[key], slice);
        if (slice.items) state.byKey[key].items = sortNewestFirst(slice.items);
      },
      prepare: (key: FeedKey, slice: Partial<FeedSlice>) => ({ payload: { key, slice } }),
    },
  },
});

export const feedsReducer = slice.reducer;
export const { patch } = slice.actions;

/** One page off the network: REST, then RSS. */
interface NetworkPage {
  items: FeedItem[];
  /** RSS is a fixed window of recent posts, so its end says nothing about the archive. */
  end: FeedEnd;
}

/**
 * The network rung, in two rounds.
 *
 * **REST first, and the order is not a preference.** RSS answers a category with
 * 100, 10 or 7 items and no way to ask for more, carries no image at all, and
 * sends no `Access-Control-Allow-Origin` — so in a browser it does not answer at
 * all. Every one of those is fixed on the REST path. See `services/wp.service.ts`
 * for the measurements.
 *
 * **RSS second, and it is worth keeping.** The two are not two halves of one
 * outage: the REST API is a WordPress feature that a security plugin can switch
 * off per endpoint, and one on correctiv.org already does exactly that to
 * `wp/v2/users`. If the same ever happens to `wp/v2/posts`, this falls back to a
 * path that has served the app for months instead of falling to the snapshot.
 *
 * A feed marked `empty` skips both rounds. `europe` has no category upstream, so
 * asking REST without a `categoryId` would quietly return the whole site under
 * the label "CORRECTIV.Europe".
 *
 * **Throws rather than answering with an empty page**, and the difference is not
 * academic. Returning `{ items: [], end: 'end' }` for a page it cannot serve
 * reads to `loadMore` as "the list ends here": it would bank the page number,
 * drop the button, and leave "mehr laden" gone until the app restarts, over
 * nothing worse than one timeout. A throw leaves the list exactly as it was. A
 * test asked for page 2 with both rounds failing and caught precisely that.
 */
async function readFromNetwork(key: FeedKey, page: number): Promise<NetworkPage> {
  const config = FEEDS[key];
  if (config.empty) throw new Error(`Feed '${key}' has no source: no such category upstream`);

  try {
    const rest = await fetchWpFeed(key, {
      categoryId: config.categoryId,
      page,
      perPage: PAGE_SIZE,
    });
    /**
     * An empty page counts as a failed round, not as an answer.
     *
     * A category id that stops matching upstream does not produce an error: WP
     * answers `200 []`. Accepting that would skip the RSS round entirely and put
     * the feed on the bundled snapshot while `/category/<slug>/feed/` was serving
     * fine — the one shape of outage the second round exists for, and the one it
     * could not see. On page 2 and beyond an empty page is the honest end of the
     * list, so it is only the first page that falls through.
     */
    if (page > 1 || rest.items.length > 0) {
      return { items: rest.items, end: rest.hasMore ? 'more' : 'end' };
    }
    console.warn(`Feed '${key}': REST answered an empty first page, trying RSS`);
  } catch (err) {
    /**
     * Rethrown as it came for a later page, not replaced with a message of our
     * own. RSS has no pages, so there is no second round to describe — and the
     * caller reads this error: `loadMore` recognises WordPress's 400 for a page
     * past the end and stops offering "mehr laden". Swallowing the cause here
     * cost exactly that, and a test caught it.
     */
    if (page > 1) throw err;
    console.warn(
      `Feed '${key}' page 1: REST failed, trying RSS:`,
      err instanceof Error ? err.message : err,
    );
  }

  // Only page 1 can reach RSS. Asking it for a second page would re-serve the first.
  if (page > 1) throw new Error(`Feed '${key}': no page ${page}, RSS cannot paginate`);
  return { items: await fetchFeed(key, config.url), end: 'unknown' };
}

/**
 * Items only. A cached `end` would be a claim frozen for the entry's fifteen
 * minutes, so a warm start knows the rows and nothing about what follows them.
 */
type CachedFeed = FeedItem[];

/** A cache entry is the array; anything else is not one. */
function asCachedFeed(value: unknown): CachedFeed | null {
  return Array.isArray(value) ? (value as FeedItem[]) : null;
}

/** One feed: cache-first, stale-while-revalidate, bundled snapshot as the floor. */
export const fetchFeedKey =
  (key: FeedKey, options: { force?: boolean } = {}): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const cached = options.force ? null : asCachedFeed(await getCached(CACHE_NS, key, TTL_MS));
    if (cached) {
      dispatch(patch(key, { items: cached, status: 'ready', end: 'unknown' }));
      return;
    }

    // Stale-while-revalidate: show what we have, then go to the network.
    const current = getState().feeds.byKey[key];
    if (current.items.length === 0) {
      const stale = asCachedFeed(await getStale(CACHE_NS, key));
      dispatch(
        patch(
          key,
          stale ? { items: stale, status: 'ready', end: 'unknown' } : { status: 'loading' },
        ),
      );
    }

    try {
      const { items, end } = await readFromNetwork(key, 1);
      if (items.length === 0) throw new Error(`No items for '${key}'`);
      // Carry over images an earlier enrichment already resolved, so a refresh
      // does not blank every thumbnail for one more round of requests.
      const known = new Map(getState().feeds.byKey[key].items.map((i) => [i.id, i.imageUrl]));
      const merged = items.map((item) => {
        const image = item.imageUrl ?? known.get(item.id);
        return image ? { ...item, imageUrl: image } : item;
      });
      dispatch(
        patch(key, {
          items: merged,
          status: 'ready',
          lastFetched: Date.now(),
          page: 1,
          end,
          // `loadingMore` untouched: a `loadMore` may be in flight on this shared slice.
        }),
      );
      await setCached(CACHE_NS, key, merged);
    } catch (err) {
      console.error(`Feed '${key}' failed:`, err instanceof Error ? err.message : err);
      const shown = getState().feeds.byKey[key].items;
      if (shown.length > 0) {
        dispatch(patch(key, { items: adoptBundledImages(shown) }));
        return;
      }
      const snapshot = platform().content.feed(key);
      dispatch(
        patch(
          key,
          snapshot?.length
            ? { items: adoptBundledImages(snapshot), status: 'offline' }
            : { status: 'error' },
        ),
      );
    }
  };

/** Several feeds at once; failures are skipped, not fatal. */
export const fetchMany =
  (keys: FeedKey[]): AppThunk<Promise<void>> =>
  async (dispatch) => {
    await Promise.all(keys.map((key) => dispatch(fetchFeedKey(key))));
  };

/**
 * The next page, appended.
 *
 * Deduplicated by URL, because WordPress pages an offset into a list that moves:
 * publish an article between page 1 and page 2 and everything shifts down by one,
 * so the last item of page 1 arrives again as the first of page 2. Without the
 * filter the list grows a duplicate on every such refresh, and React gets two
 * children with the same key.
 *
 * Silent on failure by design. A failed "mehr laden" leaves the list exactly as
 * it was, which is the honest outcome; only `loadingMore` goes back to false so
 * the reader can try again.
 */
export const loadMore =
  (key: FeedKey): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const before = getState().feeds.byKey[key];
    if (before.end !== 'more' || before.loadingMore) return;

    dispatch(patch(key, { loadingMore: true }));
    const next = before.page + 1;
    try {
      const { items, end } = await readFromNetwork(key, next);
      /**
       * The list is read again AFTER the await, never from the snapshot taken
       * before it. A pull-to-refresh dispatched while this page was in flight has
       * already replaced page 1, and appending to the copy captured beforehand
       * would put the old page 1 back and persist it — so a newly published
       * article would vanish again until the next forced refresh.
       */
      const live = getState().feeds.byKey[key];
      // A refresh landed meanwhile: this page no longer follows the list, so drop it
      // whole rather than leave a gap the URL dedup cannot see.
      if (live.page !== before.page) {
        dispatch(patch(key, { loadingMore: false }));
        return;
      }
      const seen = new Set(live.items.map((i) => i.url));
      const appended = [...live.items, ...items.filter((i) => !seen.has(i.url))];
      dispatch(patch(key, { items: appended, page: next, end, loadingMore: false }));
      await setCached(CACHE_NS, key, appended);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Feed '${key}' page ${next} failed:`, message);
      /**
       * A 400 from WordPress is the end of the list, not an outage.
       *
       * `more` is inferred from a full page, so a category whose post count is
       * an exact multiple of the page size reports one more page than it has, and
       * WP answers that page with `rest_post_invalid_page_number`. Leaving
       * `more` set would keep a "mehr laden" button that fails on every press
       * for the rest of the session.
       */
      const ended = message.includes('HTTP 400');
      dispatch(patch(key, { loadingMore: false, ...(ended ? { end: 'end' as const } : {}) }));
    }
  };

/** Load one item's lead image and patch it in place. */
export const enrichImage =
  (key: FeedKey, itemId: string): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const item = getState().feeds.byKey[key].items.find((i) => i.id === itemId);
    if (!item || item.imageUrl) return;
    const { heroImageUrl } = await loadPageMeta(item.url);
    if (!heroImageUrl) return;
    const items = getState().feeds.byKey[key].items.map((i) =>
      i.id === itemId ? { ...i, imageUrl: heroImageUrl } : i,
    );
    dispatch(patch(key, { items }));
    await setCached(CACHE_NS, key, items);
  };
