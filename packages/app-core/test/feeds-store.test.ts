import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The store's two network calls, mocked so the cascade can be driven per test.
 *
 * `fetchWpFeed` is the REST path and comes first; `fetchFeed` is the RSS fallback
 * behind it. Every test that only sets up `fetchFeed` is therefore exercising the
 * fallback, which is deliberate: those tests predate the REST path and still
 * describe what RSS has to keep doing.
 */
vi.mock('../src/services/rss.service', () => ({ fetchFeed: vi.fn() }));
vi.mock('../src/services/wp.service', () => ({ fetchWpFeed: vi.fn() }));

import { configurePlatform, createEmptyContentBundle, createMemoryPlatform } from '../src/ports';
import { clearMemoryCache, setCached } from '../src/services/cache.service';
import { fetchFeed } from '../src/services/rss.service';
import { fetchWpFeed } from '../src/services/wp.service';
import {
  enrichImage,
  fetchFeedKey,
  fetchMany,
  investigations,
  loadMore,
  mergedFeedItems,
  mergedFeedStatus,
  patch,
  type FeedSlice,
} from '../src/stores/feeds';
import { createAppStore, type AppStore } from '../src/stores/store';
import type { FeedItem, FeedKey } from '../src/types/models';

/**
 * The feed cascade: fresh cache → stale cache while revalidating → network →
 * bundled snapshot → error. Every rung is a promise to the demo ("never depends on
 * Wi-Fi") and every one of them is invisible until the network is actually down —
 * which is exactly when nobody is watching a test run.
 *
 * The two apps used to implement this twice and disagree about two rungs, so these
 * assertions now cover both of them.
 */
const fetchMock = vi.mocked(fetchFeed);
const restMock = vi.mocked(fetchWpFeed);
let store: AppStore;

function item(id: string, publishedAt = '2026-06-12T10:00:00.000Z'): FeedItem {
  return {
    id,
    feed: 'recherchen',
    title: `Artikel ${id}`,
    url: `https://correctiv.org/${id}/`,
    teaser: '…',
    publishedAt,
    categories: [],
    imageUrl: null,
  };
}

/** A detached state object, for the pure selectors that must not read a store. */
function slices(partial: Partial<Record<FeedKey, Partial<FeedSlice>>>) {
  const byKey = { ...createAppStore().getState().feeds.byKey };
  for (const [key, slice] of Object.entries(partial)) {
    byKey[key as FeedKey] = { ...byKey[key as FeedKey], ...slice };
  }
  return { byKey };
}

/** Puts the same shape into the real store, one patch per feed. */
function seed(partial: Partial<Record<FeedKey, Partial<FeedSlice>>>) {
  for (const [key, slice] of Object.entries(partial)) {
    store.dispatch(patch(key as FeedKey, slice));
  }
}

beforeEach(() => {
  // The REST round is off by default here, and it says so once per call. That is
  // the right behaviour and the wrong test output.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  store = createAppStore();
  fetchMock.mockReset();
  // Default: the REST path is unavailable, so the cascade falls through to RSS.
  // A test that wants the REST path says so by resolving this itself.
  restMock.mockReset();
  restMock.mockRejectedValue(new Error('REST off in this test'));
  clearMemoryCache();
  configurePlatform(createMemoryPlatform());
});

describe('loading one feed', () => {
  it('shows what the network returns and caches it', async () => {
    fetchMock.mockResolvedValue([item('a'), item('b')]);

    await store.dispatch(fetchFeedKey('recherchen'));

    const slice = store.getState().feeds.byKey.recherchen;
    expect(slice.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(slice.status).toBe('ready');
    expect(slice.lastFetched).toBeGreaterThan(0);
  });

  it('does not hit the network while the cache is fresh', async () => {
    fetchMock.mockResolvedValue([item('a')]);
    await store.dispatch(fetchFeedKey('recherchen'));
    fetchMock.mockClear();

    await store.dispatch(fetchFeedKey('recherchen'));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('force refetches even with a fresh cache', async () => {
    fetchMock.mockResolvedValue([item('a')]);
    await store.dispatch(fetchFeedKey('recherchen'));
    fetchMock.mockClear();

    await store.dispatch(fetchFeedKey('recherchen', { force: true }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * Stale-while-revalidate is the difference between a spinner and a screen: an
   * expired cache is shown immediately, and the network result replaces it.
   */
  it('shows an expired cache at once and then the network result', async () => {
    await setCached('feeds', 'recherchen', [item('old')]);
    clearMemoryCache();
    const later = Date.now() + 60 * 60 * 1000;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(later);

    let release: (items: FeedItem[]) => void = () => {};
    fetchMock.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const pending = store.dispatch(fetchFeedKey('recherchen'));
    // A macrotask, so every pending microtask of the stale read has settled —
    // counting `await Promise.resolve()`s would break on the next refactor.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(store.getState().feeds.byKey.recherchen.items.map((i) => i.id)).toEqual(['old']);
    expect(store.getState().feeds.byKey.recherchen.status).toBe('ready');

    release([item('fresh')]);
    await pending;
    expect(store.getState().feeds.byKey.recherchen.items.map((i) => i.id)).toEqual(['fresh']);
    clock.mockRestore();
  });

  it('keeps images an earlier enrichment resolved across a refresh', async () => {
    fetchMock.mockResolvedValue([item('a')]);
    await store.dispatch(fetchFeedKey('recherchen'));
    seed({ recherchen: { items: [{ ...item('a'), imageUrl: 'https://x/cover.jpg' }] } });

    await store.dispatch(fetchFeedKey('recherchen', { force: true }));

    expect(store.getState().feeds.byKey.recherchen.items[0].imageUrl).toBe('https://x/cover.jpg');
  });
});

describe('when the network is gone', () => {
  it('falls back to the bundled snapshot and says so', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    configurePlatform({
      ...createMemoryPlatform(),
      content: { ...createEmptyContentBundle(), feed: () => [item('bundled')] },
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await store.dispatch(fetchFeedKey('recherchen'));

    const slice = store.getState().feeds.byKey.recherchen;
    expect(slice.items.map((i) => i.id)).toEqual(['bundled']);
    // Not 'error': the list on screen is real content, just not today's.
    expect(slice.status).toBe('offline');
    error.mockRestore();
  });

  /**
   * Stale items still carry the remote image URLs they were fetched with, and none
   * of those can load offline — so the bundle's local covers are borrowed. Without
   * this the offline demo is a list of grey rectangles.
   */
  it('borrows bundled cover images for items it is already showing', async () => {
    fetchMock.mockResolvedValueOnce([item('a')]);
    await store.dispatch(fetchFeedKey('recherchen'));

    configurePlatform({
      ...createMemoryPlatform(),
      content: { ...createEmptyContentBundle(), image: () => '~/assets/images/a.jpg' },
    });
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await store.dispatch(fetchFeedKey('recherchen', { force: true }));

    expect(store.getState().feeds.byKey.recherchen.items[0].imageUrl).toBe('~/assets/images/a.jpg');
    error.mockRestore();
  });

  it('reports error only when there is nothing at all to show', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await store.dispatch(fetchFeedKey('recherchen'));

    expect(store.getState().feeds.byKey.recherchen.status).toBe('error');
    error.mockRestore();
  });

  it('does not let one failing feed take the others down', async () => {
    fetchMock.mockImplementation((key) =>
      key === 'klima' ? Promise.reject(new Error('HTTP 502')) : Promise.resolve([item(`${key}-1`)]),
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await store.dispatch(fetchMany(['recherchen', 'klima', 'faktencheck']));

    expect(store.getState().feeds.byKey.recherchen.status).toBe('ready');
    expect(store.getState().feeds.byKey.faktencheck.status).toBe('ready');
    expect(store.getState().feeds.byKey.klima.status).toBe('error');
    error.mockRestore();
  });
});

describe('merged reads', () => {
  const state = () =>
    slices({
      recherchen: { items: [item('a', '2026-06-10T00:00:00.000Z')], status: 'ready' },
      faktencheck: {
        items: [item('b', '2026-06-12T00:00:00.000Z'), item('a', '2026-06-10T00:00:00.000Z')],
        status: 'offline',
      },
    });

  it('sorts newest first and keeps one entry per article', () => {
    const merged = mergedFeedItems(state(), ['recherchen', 'faktencheck']);
    expect(merged.map((i) => i.id)).toEqual(['b', 'a']);
  });

  it('reports the most optimistic real status — some content beats none', () => {
    expect(mergedFeedStatus(state(), ['recherchen', 'faktencheck'])).toBe('ready');
    expect(mergedFeedStatus(state(), ['faktencheck'])).toBe('offline');
    expect(mergedFeedStatus(state(), ['klima'])).toBe('idle');
  });
});

describe('the REST path', () => {
  it('prefers the API and never touches RSS when it answers', async () => {
    restMock.mockResolvedValue({ items: [item('a'), item('b')], hasMore: true });
    await store.dispatch(fetchFeedKey('recherchen'));

    const slice = store.getState().feeds.byKey.recherchen;
    expect(slice.items).toHaveLength(2);
    expect(slice.status).toBe('ready');
    expect(slice.page).toBe(1);
    expect(slice.hasMore).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks for the configured category, and for none on the site-wide feed', async () => {
    restMock.mockResolvedValue({ items: [item('a')], hasMore: false });
    await store.dispatch(fetchFeedKey('faktencheck'));
    await store.dispatch(fetchFeedKey('recherchen'));

    expect(restMock).toHaveBeenNthCalledWith(
      1,
      'faktencheck',
      expect.objectContaining({ categoryId: 5, page: 1 }),
    );
    expect(restMock).toHaveBeenNthCalledWith(
      2,
      'recherchen',
      expect.objectContaining({ categoryId: undefined }),
    );
  });

  /**
   * The failure the second round exists for, and the one it could not see: a
   * category id that stops matching upstream answers `200 []`, not an error.
   */
  it('falls through to RSS when the API answers an empty first page', async () => {
    restMock.mockResolvedValue({ items: [], hasMore: false });
    fetchMock.mockResolvedValue([item('a')]);

    await store.dispatch(fetchFeedKey('faktencheck'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.getState().feeds.byKey.faktencheck.items.map((i) => i.id)).toEqual(['a']);
    expect(store.getState().feeds.byKey.faktencheck.status).toBe('ready');
  });

  it('falls through to RSS when the API fails, without disturbing the reader', async () => {
    fetchMock.mockResolvedValue([item('a')]);
    await store.dispatch(fetchFeedKey('recherchen'));

    const slice = store.getState().feeds.byKey.recherchen;
    expect(slice.items.map((i) => i.id)).toEqual(['a']);
    expect(slice.status).toBe('ready');
    // RSS cannot page, so nothing may offer a "mehr laden" button.
    expect(slice.hasMore).toBe(false);
  });

  /**
   * `europe` has no category upstream. Without the guard, a REST call without a
   * `categoryId` returns the whole site under the label "CORRECTIV.Europe".
   */
  it('never asks the network for a feed whose category does not exist', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await store.dispatch(fetchFeedKey('europe'));
    expect(restMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.getState().feeds.byKey.europe.items).toHaveLength(0);
    error.mockRestore();
  });
});

describe('loading more', () => {
  async function firstPage(hasMore = true) {
    restMock.mockResolvedValueOnce({
      items: [item('a', '2026-08-31T10:00:00.000Z'), item('b', '2026-08-30T10:00:00.000Z')],
      hasMore,
    });
    await store.dispatch(fetchFeedKey('faktencheck'));
  }

  it('appends the next page and remembers where it is', async () => {
    await firstPage();
    restMock.mockResolvedValueOnce({
      items: [item('c', '2026-08-29T10:00:00.000Z')],
      hasMore: false,
    });
    await store.dispatch(loadMore('faktencheck'));

    const slice = store.getState().feeds.byKey.faktencheck;
    expect(slice.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(slice.page).toBe(2);
    expect(slice.hasMore).toBe(false);
    expect(slice.loadingMore).toBe(false);
  });

  /**
   * WordPress pages an offset into a list that moves. Publish something between
   * two requests and the last item of page 1 arrives again as the first of page 2.
   */
  it('drops an item the moving offset served twice', async () => {
    await firstPage();
    restMock.mockResolvedValueOnce({
      items: [item('b', '2026-08-30T10:00:00.000Z'), item('c', '2026-08-29T10:00:00.000Z')],
      hasMore: false,
    });
    await store.dispatch(loadMore('faktencheck'));

    expect(store.getState().feeds.byKey.faktencheck.items.map((i) => i.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  /**
   * WordPress answers a page past the end with 400, and `hasMore` is a guess from
   * a full page, so a category with an exact multiple of PAGE_SIZE posts asks for
   * one page too many. Leaving `hasMore` set would keep a button that fails on
   * every press.
   */
  it('treats a 400 on the next page as the end of the list', async () => {
    await firstPage();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    restMock.mockRejectedValueOnce(new Error('HTTP 400 for https://correctiv.org/wp-json'));

    await store.dispatch(loadMore('faktencheck'));

    const slice = store.getState().feeds.byKey.faktencheck;
    expect(slice.hasMore).toBe(false);
    expect(slice.items.map((i) => i.id)).toEqual(['a', 'b']);
    error.mockRestore();
  });

  /**
   * A refresh that lands while a page is in flight must not be undone. The thunk
   * used to append to a snapshot taken before its own await.
   */
  it('appends to the list as it is after the await, not as it was before', async () => {
    await firstPage();
    let release: (page: { items: FeedItem[]; hasMore: boolean }) => void = () => {};
    restMock.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));

    const pending = store.dispatch(loadMore('faktencheck'));
    // A pull-to-refresh resolves first, with an article published since page 1.
    store.dispatch(
      patch('faktencheck', {
        items: [item('neu', '2026-09-01T08:00:00.000Z'), item('a', '2026-08-31T10:00:00.000Z')],
      }),
    );
    release({ items: [item('c', '2026-08-29T10:00:00.000Z')], hasMore: false });
    await pending;

    expect(store.getState().feeds.byKey.faktencheck.items.map((i) => i.id)).toContain('neu');
  });

  it('does nothing when there is no next page', async () => {
    await firstPage(false);
    restMock.mockClear();
    await store.dispatch(loadMore('faktencheck'));
    expect(restMock).not.toHaveBeenCalled();
  });

  it('leaves the list untouched when the next page fails', async () => {
    await firstPage();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    restMock.mockRejectedValueOnce(new Error('gone'));
    await store.dispatch(loadMore('faktencheck'));
    error.mockRestore();

    const slice = store.getState().feeds.byKey.faktencheck;
    expect(slice.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(slice.page).toBe(1);
    expect(slice.loadingMore).toBe(false);
  });
});

describe('order', () => {
  /**
   * The shape correctiv.org/feed/ actually returns: one older post hoisted to
   * position 1, the rest descending. Measured 2026-09-01. Home takes the first
   * item as its lead, so an unsorted slice puts a four-week-old post on the front
   * page while the feed behind it is current.
   */
  const hoisted = [
    item('alt', '2026-08-01T07:27:22.000Z'),
    item('neu', '2026-08-31T16:51:04.000Z'),
    item('mittel', '2026-08-31T12:39:48.000Z'),
  ];

  it('sorts the network result newest first', async () => {
    fetchMock.mockResolvedValue(hoisted);
    await store.dispatch(fetchFeedKey('recherchen'));
    expect(store.getState().feeds.byKey.recherchen.items.map((i) => i.id)).toEqual([
      'neu',
      'mittel',
      'alt',
    ]);
  });

  it('sorts a cache written before the sort existed', async () => {
    await setCached('feeds', 'recherchen', hoisted);
    await store.dispatch(fetchFeedKey('recherchen'));
    expect(store.getState().feeds.byKey.recherchen.items[0].id).toBe('neu');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves items published at the same instant in the order the feed sent them', async () => {
    fetchMock.mockResolvedValue([item('a'), item('b'), item('c')]);
    await store.dispatch(fetchFeedKey('recherchen'));
    expect(store.getState().feeds.byKey.recherchen.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts the bundled snapshot too', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    configurePlatform({
      ...createMemoryPlatform(),
      content: { ...createEmptyContentBundle(), feed: () => hoisted },
    });
    await store.dispatch(fetchFeedKey('recherchen'));
    const { items, status } = store.getState().feeds.byKey.recherchen;
    expect(status).toBe('offline');
    expect(items[0].id).toBe('neu');
  });
});

describe('image enrichment', () => {
  it('patches one item in place and leaves the rest alone', async () => {
    seed({ recherchen: { items: [item('a'), item('b')], status: 'ready' } });
    configurePlatform({
      ...createMemoryPlatform(),
      content: {
        ...createEmptyContentBundle(),
        article: (url) =>
          url.includes('/a/')
            ? {
                url,
                title: 'A',
                authors: [],
                publishedAt: '',
                readingMinutes: 1,
                bodyHtml: '<p>x</p>',
                heroImageUrl: 'https://x/a.jpg',
              }
            : null,
      },
    });

    await store.dispatch(enrichImage('recherchen', 'a'));

    const items = store.getState().feeds.byKey.recherchen.items;
    expect(items[0].imageUrl).toBe('https://x/a.jpg');
    expect(items[1].imageUrl).toBeNull();
  });

  it('does nothing for an item that already has an image', async () => {
    seed({ recherchen: { items: [{ ...item('a'), imageUrl: 'https://x/keep.jpg' }] } });

    await store.dispatch(enrichImage('recherchen', 'a'));

    expect(store.getState().feeds.byKey.recherchen.items[0].imageUrl).toBe('https://x/keep.jpg');
  });
});

/**
 * The impact card's list, which was three lines inside `app/(tabs)/profil.tsx` and
 * therefore untested: the screen that must not name a fact check among CORRECTIV's
 * investigations was also the only place that knew the site-wide stream contains
 * them.
 *
 * The permalinks are the shapes `test/article-url.test.ts` reads off the live feed,
 * cut down to what this selector needs — the point here is the filter and the
 * limit, not the URL rule, which has its own suite.
 */
describe('investigations', () => {
  const at = (id: string, path: string): FeedItem => ({
    ...item(id),
    url: `https://correctiv.org${path}`,
  });

  const CHECK = at('c', '/faktencheck/2026/08/11/keine-ki-foto-von-voigt/');
  const SUB_CHECK = at('s', '/faktencheck/hintergrund/2026/06/30/deutschland-strom-import/');
  const STORY = at('r', '/russland/2026/08/11/russisches-haus/');
  const LOCAL = at('l', '/in-eigener-sache/2026/08/07/jugendliche-erleben-wald/');

  it('drops the fact checks the site-wide stream carries', () => {
    const state = slices({ recherchen: { items: [CHECK, STORY, SUB_CHECK, LOCAL] } });

    expect(investigations(state).map((i) => i.id)).toEqual(['r', 'l']);
  });

  it('honours the limit the caller asks for', () => {
    const state = slices({ recherchen: { items: [CHECK, STORY, LOCAL] } });

    expect(investigations(state, 1).map((i) => i.id)).toEqual(['r']);
  });

  it('answers with everything when no limit is given', () => {
    const state = slices({ recherchen: { items: [STORY, LOCAL] } });

    expect(investigations(state)).toHaveLength(2);
  });

  it('reads `recherchen` and nothing else', () => {
    // The card is about CORRECTIV's own investigations, so a story that only ever
    // arrived through another feed is not one of them.
    const state = slices({
      recherchen: { items: [STORY] },
      faktencheck: { items: [at('x', '/klima/2026/08/11/etwas/')] },
    });

    expect(investigations(state).map((i) => i.id)).toEqual(['r']);
  });

  it('reaches no store of its own', () => {
    expect(investigations(createAppStore().getState().feeds, 3)).toEqual([]);
  });
});

/**
 * `hasMore` and `paged`, which are the same boolean read two ways.
 *
 * Every test above could pass with `hasMore` never set at all, because each of them
 * asks the network. The three rungs that do not — the warm cache, the stale entry and
 * the bundled snapshot — return a list and go no further, and in all three `hasMore`
 * is `false` because nobody filled it in rather than because the list ended. A screen
 * with a "load more" button and a "that is everything published so far" sentence
 * standing on that field cannot tell those apart, and the sentence is the dangerous
 * one: it is a claim about the newsroom.
 *
 * Found by reading the store after a reviewer asked whether a warm start could reach
 * page 2, and measured the same day on `Medium_Phone_API_36` (ADR 0066 §3).
 */
describe('whether `hasMore` is an answer', () => {
  /** A warm cache, written for one test at a time. */
  async function warmCache() {
    await setCached('feeds', 'faktencheck', [item('warm'), item('warmer')]);
  }

  it('marks a network read as answered, on the first page and on every later one', async () => {
    restMock.mockResolvedValueOnce({
      items: [item('a', '2026-08-31T10:00:00.000Z'), item('b', '2026-08-30T10:00:00.000Z')],
      hasMore: true,
    });
    await store.dispatch(fetchFeedKey('faktencheck', { force: true }));
    expect(store.getState().feeds.byKey.faktencheck.paged).toBe(true);

    restMock.mockResolvedValueOnce({ items: [item('c')], hasMore: false });
    await store.dispatch(loadMore('faktencheck'));
    expect(store.getState().feeds.byKey.faktencheck.paged).toBe(true);
  });

  it('leaves a warm start unanswered, so a screen says nothing about the end', async () => {
    await warmCache();
    await store.dispatch(fetchFeedKey('faktencheck'));

    const slice = store.getState().feeds.byKey.faktencheck;
    // The rows are there — the cache did its job …
    expect(slice.items.map((i) => i.id)).toEqual(['warm', 'warmer']);
    // … and the store says it never asked whether more exists, rather than
    // answering "no" with a boolean that started life as a default.
    expect(slice.paged).toBe(false);
    expect(slice.hasMore).toBe(false);
    // The network was not touched at all, which is what makes this the warm path.
    expect(restMock).not.toHaveBeenCalled();
  });

  it('leaves the bundled snapshot unanswered too', async () => {
    configurePlatform({
      ...createMemoryPlatform(),
      content: {
        ...createMemoryPlatform().content,
        feed: (key: string) => (key === 'faktencheck' ? [item('bundled')] : []),
      },
    });
    restMock.mockRejectedValue(new Error('offline'));

    await store.dispatch(fetchFeedKey('faktencheck'));

    const slice = store.getState().feeds.byKey.faktencheck;
    expect(slice.status).toBe('offline');
    expect(slice.items.map((i) => i.id)).toEqual(['bundled']);
    expect(slice.paged).toBe(false);
  });

  it('leaves the RSS fallback unanswered, because RSS is a window and not an archive', async () => {
    restMock.mockRejectedValue(new Error('REST down'));
    fetchMock.mockResolvedValueOnce([item('rss')]);

    await store.dispatch(fetchFeedKey('faktencheck'));

    const slice = store.getState().feeds.byKey.faktencheck;
    expect(slice.items.map((i) => i.id)).toEqual(['rss']);
    // RSS has no page two — a fact about the SOURCE. That is not the same as a
    // fact about the newsroom, which is what "that is everything published so far"
    // claims, and the ten-odd entries an RSS feed serves are the latest of many
    // more. An earlier version of this file asserted `paged: true` here and
    // enshrined the wrong claim in the one place that was supposed to catch it.
    expect(slice.paged).toBe(false);
    expect(slice.hasMore).toBe(false);
  });

  it('marks a REST page one as answered, so the end of the list can be stated', async () => {
    restMock.mockResolvedValueOnce({ items: [item('a'), item('b')], hasMore: false });

    await store.dispatch(fetchFeedKey('faktencheck'));

    const slice = store.getState().feeds.byKey.faktencheck;
    expect(slice.paged).toBe(true);
    expect(slice.hasMore).toBe(false);
  });

  it('refuses to page an unanswered feed rather than asking once', async () => {
    await warmCache();
    await store.dispatch(fetchFeedKey('faktencheck'));
    const before = restMock.mock.calls.length;

    await store.dispatch(loadMore('faktencheck'));

    expect(restMock.mock.calls.length).toBe(before);
  });

  it('does not let a refresh re-arm the button while a load is in flight', async () => {
    restMock.mockResolvedValueOnce({
      items: [item('a', '2026-08-31T10:00:00.000Z'), item('b', '2026-08-30T10:00:00.000Z')],
      hasMore: true,
    });
    await store.dispatch(fetchFeedKey('faktencheck', { force: true }));

    // A page two that is still on its way when a refresh lands. This slice is shared
    // with Home, so that is a real ordering rather than a contrived one.
    let releasePageTwo = () => {};
    restMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releasePageTwo = () => resolve({ items: [item('c')], hasMore: false });
        }),
    );
    const paging = store.dispatch(loadMore('faktencheck'));
    expect(store.getState().feeds.byKey.faktencheck.loadingMore).toBe(true);

    restMock.mockResolvedValueOnce({
      items: [item('fresh', '2026-09-02T10:00:00.000Z')],
      hasMore: true,
    });
    await store.dispatch(fetchFeedKey('faktencheck', { force: true }));
    releasePageTwo();
    await paging;

    // The flag is the guard `loadMore` returns on; a refresh that cleared it would
    // let a second press ask for the same page again.
    expect(store.getState().feeds.byKey.faktencheck.loadingMore).toBe(false);
  });

  /**
   * The page that no longer follows the list.
   *
   * `next` is read before the await, so a refresh in between resets the slice to
   * page 1 and the page that comes back is a page 3. Appending it would leave the
   * reader with pages 1 and 3, `page: 3` stored as if they had walked there, and
   * nothing in the dedup to notice: a missing page and a duplicate are different
   * problems. Found by a reviewer reading the await; older than the button, and
   * unreachable until something called `loadMore`.
   */
  it('discards a page that a refresh made the wrong page', async () => {
    // Page one first, then a page two, so the reader is genuinely at page 2 and a
    // refresh back to page 1 is a real jump backwards rather than a re-read.
    restMock.mockResolvedValueOnce({ items: [item('a')], hasMore: true });
    await store.dispatch(fetchFeedKey('faktencheck', { force: true }));
    restMock.mockResolvedValueOnce({ items: [item('b')], hasMore: true });
    await store.dispatch(loadMore('faktencheck'));
    expect(store.getState().feeds.byKey.faktencheck.page).toBe(2);

    // Page three, held in flight.
    let releasePageThree = () => {};
    restMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releasePageThree = () => resolve({ items: [item('c')], hasMore: true });
        }),
    );
    const paging = store.dispatch(loadMore('faktencheck'));

    // A refresh puts the slice back to page one while page three is on its way.
    restMock.mockResolvedValueOnce({ items: [item('a'), item('neu')], hasMore: true });
    await store.dispatch(fetchFeedKey('faktencheck', { force: true }));
    releasePageThree();
    await paging;

    const slice = store.getState().feeds.byKey.faktencheck;
    // Page three is not in the list, and `page` is the one the refresh left rather
    // than the one the request asked for. Appending it would have given the reader
    // pages 1 and 3 with page 2 missing and `page: 3` claiming they had walked there.
    expect(slice.items.map((i) => i.id)).toEqual(['a', 'neu']);
    expect(slice.page).toBe(1);
    // And the reader can ask again: a list that silently skipped a page behind a
    // button that stays disabled is worse than a wasted press.
    expect(slice.loadingMore).toBe(false);
  });
});
