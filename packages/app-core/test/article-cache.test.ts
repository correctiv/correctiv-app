import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadArticle } from '../src/articles/load';
import type { Article } from '../src/articles/types';
import { configurePlatform, createMemoryPlatform } from '../src/ports';
import { clearMemoryCache, setCached } from '../src/services/cache.service';

/**
 * An article cached before the reader learned what an ad is must not come back.
 *
 * The cache holds the EXTRACTED article, cleanup included, so a body saved by an
 * older build keeps its ads and its empty accordion headings for as long as the
 * entry lives, and `getStale` serves it past its window whenever the network is
 * down. The namespace is what separates the two generations; this pins that the
 * old one is no longer read, by either rung.
 */
const URL_ = 'https://correctiv.org/aktuelles/2026/09/01/x/';

const OLD: Article = {
  url: URL_,
  title: 'Cached by an older build',
  authors: [],
  publishedAt: '',
  readingMinutes: 3,
  bodyHtml: '<p>Text</p><p>Bitte nehmen Sie sich einen Moment Zeit</p><h3></h3>',
};

beforeEach(() => {
  configurePlatform(createMemoryPlatform());
  clearMemoryCache();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the article cache after the block cleanup', () => {
  it('does not serve a body an older build cached, fresh or stale', async () => {
    await setCached('articles', URL_, OLD);
    clearMemoryCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    await expect(loadArticle(URL_)).rejects.toThrow('offline');
  });
});
