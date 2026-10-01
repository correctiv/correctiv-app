import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The live search and the two network paths behind the corpus, so the cascade can
 * be driven per test without a network.
 */
vi.mock('../src/services/search.service', () => ({ searchArticles: vi.fn() }));
vi.mock('../src/services/rss.service', () => ({ fetchFeed: vi.fn() }));
vi.mock('../src/services/wp.service', () => ({ fetchWpFeed: vi.fn() }));

import { CONTENT_FEEDS } from '../src/data/feeds.config';
import { configurePlatform, createMemoryPlatform } from '../src/ports';
import { clearMemoryCache } from '../src/services/cache.service';
import { fetchFeed } from '../src/services/rss.service';
import { fetchWpFeed } from '../src/services/wp.service';
import { searchArticles } from '../src/services/search.service';
import { patch, type FeedSlice } from '../src/stores/feeds';
import { searchLocalFeeds, searchProjectHits, searchWithFallback } from '../src/stores/search';
import { createAppStore, type AppStore } from '../src/stores/store';
import type { FeedItem, FeedKey } from '../src/types/models';

/**
 * The search cascade, which used to live in the app: eleven lines inside
 * `suche.tsx` calling a module in `lib/feeds/` that reached the store singleton
 * through a module-level promise. The screen's own tests could only ever pin it by
 * mocking both halves, so the rule itself — live first, local on an error **or** an
 * empty result, and the corpus fetched at most once and only when needed — was
 * asserted nowhere.
 */
const liveMock = vi.mocked(searchArticles);
const rssMock = vi.mocked(fetchFeed);
const restMock = vi.mocked(fetchWpFeed);
let store: AppStore;

function item(
  id: string,
  title: string,
  teaser = '…',
  publishedAt = '2026-06-12T10:00:00.000Z',
): FeedItem {
  return {
    id,
    feed: 'recherchen',
    title,
    url: `https://correctiv.org/${id}/`,
    teaser,
    publishedAt,
    categories: [],
    imageUrl: null,
  };
}

function seed(partial: Partial<Record<FeedKey, Partial<FeedSlice>>>) {
  for (const [key, slice] of Object.entries(partial)) {
    store.dispatch(patch(key as FeedKey, slice));
  }
}

beforeEach(() => {
  // The cascade announces every rung it falls through, which is the right
  // behaviour and the wrong test output.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  store = createAppStore();
  liveMock.mockReset();
  rssMock.mockReset();
  rssMock.mockRejectedValue(new Error('no network in this test'));
  // The REST round is off unless a test turns it on, so the corpus load reaches
  // RSS — and says so honestly rather than tripping over an undefined response.
  restMock.mockReset();
  restMock.mockRejectedValue(new Error('REST off in this test'));
  clearMemoryCache();
  configurePlatform(createMemoryPlatform());
});

describe('the cascade', () => {
  it('answers with the live hits and never touches the corpus', async () => {
    liveMock.mockResolvedValue([item('a', 'Die Klimakrise vor Gericht')]);
    seed({ recherchen: { items: [item('b', 'Aus dem Cache')], status: 'ready' } });

    const hits = await store.dispatch(searchWithFallback('klima'));

    expect(hits.map((i) => i.id)).toEqual(['a']);
    expect(rssMock).not.toHaveBeenCalled();
  });

  it('falls back to what the device has when the live search fails', async () => {
    // The promise the whole cache design exists for: no live network, still hits.
    liveMock.mockRejectedValue(new Error('Network request failed'));
    seed({ recherchen: { items: [item('b', 'Klimadaten aus dem Cache')], status: 'ready' } });

    const hits = await store.dispatch(searchWithFallback('klima'));

    expect(hits.map((i) => i.id)).toEqual(['b']);
  });

  it('falls back when the live search merely returns nothing', async () => {
    // An empty result and an error are the same signal here: the server had
    // nothing to say, and the device might.
    liveMock.mockResolvedValue([]);
    seed({ recherchen: { items: [item('c', 'Nur lokal gefunden: Klima')], status: 'ready' } });

    const hits = await store.dispatch(searchWithFallback('klima'));

    expect(hits.map((i) => i.id)).toEqual(['c']);
  });

  it('loads the corpus only when the fallback actually needs it', async () => {
    liveMock.mockResolvedValue([]);
    rssMock.mockResolvedValue([item('d', 'Klimaklage')]);

    const first = await store.dispatch(searchWithFallback('klima'));
    expect(first.map((i) => i.id)).toEqual(['d']);
    expect(rssMock).toHaveBeenCalledTimes(CONTENT_FEEDS.length);

    // Second search, corpus already in the store: no second round of requests.
    rssMock.mockClear();
    const second = await store.dispatch(searchWithFallback('klimaklage'));

    expect(second.map((i) => i.id)).toEqual(['d']);
    expect(rssMock).not.toHaveBeenCalled();
  });

  it('asks nothing at all below the minimum query length', async () => {
    const hits = await store.dispatch(searchWithFallback('k'));

    expect(hits).toEqual([]);
    expect(liveMock).not.toHaveBeenCalled();
    expect(rssMock).not.toHaveBeenCalled();
  });
});

describe('searchLocalFeeds', () => {
  it('matches the teaser as well as the title', () => {
    seed({
      recherchen: {
        items: [item('a', 'Ein Titel', 'Es geht um Klima'), item('b', 'Klima im Titel', '…')],
        status: 'ready',
      },
    });

    const hits = searchLocalFeeds(store.getState().feeds, 'klima');

    expect(hits.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('returns newest first and honours the limit', () => {
    seed({
      recherchen: {
        items: [
          item('alt', 'Klima 1', '…', '2026-01-01T00:00:00.000Z'),
          item('neu', 'Klima 2', '…', '2026-08-01T00:00:00.000Z'),
        ],
        status: 'ready',
      },
    });

    expect(searchLocalFeeds(store.getState().feeds, 'klima', 1).map((i) => i.id)).toEqual(['neu']);
  });

  it('reaches no store of its own', () => {
    // A selector takes state. The app's version read the singleton directly, which
    // is what made it untestable without mocking the whole module.
    expect(searchLocalFeeds(createAppStore().getState().feeds, 'klima')).toEqual([]);
  });
});

/**
 * The other half of what this app can find, which was a `useMemo` in
 * `app/suche.tsx` until issue #107: the podcasts, callouts, backstage entries and
 * publishing pages that are not articles and so never reach a feed.
 *
 * The titles below are the real ones out of `data/search-samples.ts` rather than
 * invented, because what is worth pinning is that this matches the *subtitle* too
 * — a reader typing "Salon5" is looking for the podcasts and none of them says so
 * in its title.
 */
describe('searchProjectHits', () => {
  it('matches the title', () => {
    expect(searchProjectHits('deeptalk').map((s) => s.id)).toEqual(['ss-deeptalk']);
  });

  it('matches the subtitle, which is where the source is named', () => {
    const hits = searchProjectHits('salon5');

    expect(hits.length).toBeGreaterThan(1);
    expect(hits.every((s) => s.kind === 'podcast')).toBe(true);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(searchProjectHits('  DEEPTALK ').map((s) => s.id)).toEqual(['ss-deeptalk']);
  });

  it('answers with nothing below the minimum query length', () => {
    // The screen used to make this check itself, which is why it is asserted here:
    // a second caller must not have to remember it.
    expect(searchProjectHits('d')).toEqual([]);
    expect(searchProjectHits('')).toEqual([]);
    expect(searchProjectHits('   ')).toEqual([]);
  });

  it('answers with nothing when nothing matches', () => {
    expect(searchProjectHits('zzzz')).toEqual([]);
  });
});
