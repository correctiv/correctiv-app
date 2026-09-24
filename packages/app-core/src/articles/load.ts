import { platform } from '../ports';
import { fetchCachedText, getCached, getStale, setCached } from '../services/cache.service';
import { fetchText } from '../services/http';
import { fetchWpArticle } from '../services/wp.service';
import { extractArticleFromString } from './extract/string';
import { extractPageMeta, type PageMeta } from './page-meta';
import type { Article, ArticleExtractor } from './types';

/**
 * Getting an article onto the screen, as one cascade.
 *
 * There were two of these once, and they disagreed about the order. One asked the
 * cache first and fell back to its bundled copy only after the network failed.
 * The other checked its bundle first and never cached what it extracted. This
 * takes the better half of each.
 *
 *   1. the host's bundle      — pre-extracted, needs no network, never changes
 *   2. a fresh cached article — extracted earlier this day
 *   3. the REST API           — one request, everything, no parsing
 *   4. the article page       — fetch, extract, for what the API cannot answer
 *   5. a stale cached article — expired beats absent
 *
 * The bundle comes first because that is the promise the demo makes: the reader
 * opens without Wi-Fi. Only the extracted article is cached, not the page HTML —
 * a tenth of the bytes and no second extraction on the next open.
 *
 * Rung 3 is new as of 2026-09-01, and it answers everything rung 4 scraped for,
 * the fact-check verdict included. That was the field that looked as though it
 * would need a change at CORRECTIV and did not. Rung 4 stays for two reasons: the
 * REST API is a WordPress feature a plugin can switch off per endpoint, and one on
 * correctiv.org already does that to `wp/v2/users`; and it is the only rung that
 * works on a URL the API does not know, which is every page in the app that is
 * not a post.
 */

/**
 * Versioned, because what is cached is the article AFTER cleanup. Bodies saved
 * before `articles/blocks.ts` carry ads and empty accordion headings, and one of
 * them would be served for a day as fresh and after that by `getStale` for as
 * long as the network is down, which is when the reader has nothing else. A new
 * namespace reads none of them. Raise it whenever the cleanup changes what a
 * stored body looks like. The old entries are not read again; the cache's size
 * bound is what removes them.
 */
const CACHE_NS = 'articles-2';
const TTL_MS = 24 * 60 * 60 * 1000;
const PAGE_TIMEOUT_MS = 12000;

/**
 * The REST rung gets a shorter budget than the page it precedes.
 *
 * Both rungs can time out on a dead network, one after the other, and the stale
 * cache sits behind both — so the reader's spinner runs for their sum. At 12 s
 * each that was 24 s to reach an article already on the device, against 12 s
 * before this rung existed. 6 s is generous for a JSON response that measures a
 * few kilobytes, and it keeps the worst case within sight of the old one.
 */
const API_TIMEOUT_MS = 6000;

/**
 * Which extraction backend this host uses. The string one is the default because
 * it runs anywhere; a host that has installed an HTML parser registers the DOM
 * one at startup. See `articles/types.ts` for the trade-off.
 */
let extract: ArticleExtractor = extractArticleFromString;

export function configureArticleExtractor(next: ArticleExtractor): void {
  extract = next;
}

export interface LoadArticleOptions {
  /** Section badge from the calling screen — the page's own kicker wins if it has one. */
  kicker?: string;
}

/**
 * The API first, the page second.
 *
 * A miss on the API is not an error and does not warn: `fetchWpArticle` answers
 * `null` for a URL that is not a post, and that is the normal case for every
 * project page in the app. Only a thrown error is worth a line in the log,
 * because that one means the API was reachable and unhappy.
 */
async function readFromNetwork(url: string, kicker?: string): Promise<Article> {
  try {
    const fromApi = await fetchWpArticle(url, API_TIMEOUT_MS);
    if (fromApi) return { url, ...fromApi, kicker: fromApi.kicker ?? kicker };
  } catch (err) {
    console.warn(
      `Article '${url}': REST failed, scraping the page:`,
      err instanceof Error ? err.message : err,
    );
  }

  const html = await fetchText(url, { timeoutMs: PAGE_TIMEOUT_MS });
  const extracted = extract(html);
  if (!extracted.bodyHtml) throw new Error(`No article body at ${url}`);
  return { url, ...extracted, kicker: extracted.kicker ?? kicker };
}

export async function loadArticle(url: string, options: LoadArticleOptions = {}): Promise<Article> {
  const bundled = platform().content.article(url);
  if (bundled) return { ...bundled, kicker: bundled.kicker ?? options.kicker, offline: true };

  const cached = await getCached<Article>(CACHE_NS, url, TTL_MS);
  if (cached) return cached;

  try {
    const article = await readFromNetwork(url, options.kicker);
    await setCached(CACHE_NS, url, article);
    return article;
  } catch (err) {
    const stale = await getStale<Article>(CACHE_NS, url);
    if (stale) return stale;
    throw err;
  }
}

/**
 * What a feed item does not carry: the lead image and the reading time.
 *
 * Cheap enough to call per card — the page is fetched cache-first with a 24-hour
 * window, and it is a page the reader will very likely ask for next anyway. Never
 * throws: a card without an image is a card, a card that blew up is a bug.
 */
export async function loadPageMeta(url: string): Promise<PageMeta> {
  const bundled = platform().content.article(url);
  if (bundled) {
    return {
      heroImageUrl: platform().content.image(url) ?? bundled.heroImageUrl,
      readingMinutes: bundled.readingMinutes,
      title: bundled.title,
      excerpt: bundled.excerpt,
    };
  }
  try {
    const html = await fetchCachedText(`page:${url}`, url, {
      policy: 'cache-first',
      ttlMs: TTL_MS,
      timeoutMs: 8000,
    });
    return extractPageMeta(html);
  } catch {
    return {};
  }
}
