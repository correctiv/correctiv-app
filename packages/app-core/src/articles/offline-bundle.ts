import { CONTENT_FEEDS, FEEDS } from '../data/feeds.config';
import { parseWpFeed, type ParsedFeedItem } from '../lib/rss-parse';
import type { FeedItem, FeedKey } from '../types/models';
import type { Article, ArticleExtractor } from './types';

/**
 * Collecting the offline bundle — the shared half of both apps' build scripts.
 *
 * Each app had its own script that walked the same feeds, picked the top N per
 * feed and extracted each page. They differed in two ways that mattered: one
 * carried a second, hand-written RSS parser next to the core's, and the other
 * only accepted URLs with a date in the path — which silently excluded every
 * Spotlight piece, the articles Home links to most.
 *
 * What stays in the script is the writing — a host wants its bundle in whatever
 * form it can read at runtime, and that has been JSON files in an app folder as well
 * as generated TypeScript modules. That part is genuinely host-specific. This is
 * everything before it.
 *
 * Not used at runtime — the scripts run it under `tsx`.
 */

export interface OfflinePlan {
  /** How many articles to bundle per feed. Feeds absent here are still snapshotted. */
  pick: Partial<Record<FeedKey, number>>;
}

export interface OfflineFeedSnapshot {
  key: FeedKey;
  items: FeedItem[];
}

export interface OfflineArticle {
  article: Article;
  /** Which feed it was picked from, for the index a host may want to write. */
  feed: FeedKey;
  /** The feed item it came from — carries the teaser the article page has no room for. */
  item: FeedItem;
}

export interface OfflineBundle {
  snapshots: OfflineFeedSnapshot[];
  articles: OfflineArticle[];
}

export interface CollectOptions {
  /** Injected so a script can add its own user agent, retries or logging. */
  fetchText: (url: string) => Promise<string>;
  extract: ArticleExtractor;
  plan: OfflinePlan;
  /** Progress reporting; the scripts print it. */
  onProgress?: (message: string) => void;
}

/** `ParsedFeedItem` is structurally a `FeedItem`; this names that once. */
function toFeedItems<K extends FeedKey>(parsed: ParsedFeedItem<K>[]): FeedItem[] {
  return parsed;
}

/**
 * Fetch every content feed, snapshot it, and extract the planned number of
 * articles from each. A feed or a page that fails is reported and skipped — a
 * bundle that is one article short still ships; a script that throws does not.
 */
export async function collectOfflineBundle(options: CollectOptions): Promise<OfflineBundle> {
  const { fetchText, extract, plan, onProgress = () => {} } = options;
  const snapshots: OfflineFeedSnapshot[] = [];
  const articles: OfflineArticle[] = [];
  const seen = new Set<string>();

  for (const key of CONTENT_FEEDS) {
    let items: FeedItem[];
    try {
      items = toFeedItems(parseWpFeed(await fetchText(FEEDS[key].url), key));
    } catch (err) {
      onProgress(`! feed ${key} skipped: ${(err as Error).message}`);
      continue;
    }
    snapshots.push({ key, items });
    onProgress(`feed ${key}: ${items.length} items`);

    let picked = 0;
    const want = plan.pick[key] ?? 0;
    for (const item of items) {
      if (picked >= want) break;
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      try {
        const extracted = extract(await fetchText(item.url));
        if (!extracted.bodyHtml || extracted.bodyHtml.length < 200) {
          onProgress(`  ! no usable body: ${item.url}`);
          continue;
        }
        articles.push({
          feed: key,
          item,
          article: {
            url: item.url,
            ...extracted,
            title: extracted.title || item.title,
            kicker: extracted.kicker ?? FEEDS[key].badge,
            offline: true,
          },
        });
        picked += 1;
        onProgress(`  ✓ ${extracted.title.slice(0, 60)} (${extracted.readingMinutes} min)`);
      } catch (err) {
        onProgress(`  ! ${item.url}: ${(err as Error).message}`);
      }
    }
  }

  return { snapshots, articles };
}
