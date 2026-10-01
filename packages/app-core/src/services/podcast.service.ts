import type { PodcastSeries, PodcastEpisode } from '../data/podcasts';
import { PODCAST_HOST } from '../data/feeds.config';
import { fetchText } from './http';
import { parsePodcastFeed } from '../lib/rss-parse';
import { formatMinutesDe } from '../lib/format';

/**
 * Salon5 podcast data layer. Each show is a standard podcast RSS feed on
 * CORRECTIV's Castopod instance; episodes carry real MP3 enclosures that the
 * existing audio player streams directly. No auth.
 */
const PUBLISHER = 'Salon5';

/**
 * How much of a show to keep.
 *
 * It was 20, which turned "Pausenbrot" into a taster: that feed carries 439
 * episodes and "Politik" 396. Measured on the live feed, the parsed episodes cost
 * about 0.3 KB each in the cache, so 20 was 6 KB and this is 31 KB per show,
 * and under 200 KB for the seven curated ones, most of which are far shorter.
 * Taking everything would be 127 KB for
 * Pausenbrot alone, for a tail nobody scrolls to.
 *
 * The screen that shows these is a `FlatList` (ADR 0012), so the number of rows
 * costs nothing to render — the ceiling is the cache, not the list.
 *
 * Exported because it is now half of a limit somewhere else: `podcasts/all` is the
 * largest entry the cache holds, and `MAX_ENTRY_BYTES` in `services/cache.service.ts`
 * is argued from `shows × MAX_EPISODES × the cost of an episode`. Raising either
 * factor without raising that cap is caught by `test/cache-bound.test.ts`.
 */
export const MAX_EPISODES = 100;
const MAX_DESCRIPTION = 240;

function feedUrl(handle: string): string {
  return `${PODCAST_HOST}/@${handle}/feed.xml`;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Fetch one Salon5 show as the app's PodcastSeries (newest episodes first). */
export async function fetchPodcastSeries(handle: string): Promise<PodcastSeries> {
  const feed = parsePodcastFeed(await fetchText(feedUrl(handle), { timeoutMs: 12000 }));
  const episodes: PodcastEpisode[] = feed.episodes.slice(0, MAX_EPISODES).map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    durationLabel: formatMinutesDe(e.durationSec),
    audio: e.audioUrl,
  }));
  return {
    id: handle,
    title: feed.title || handle,
    publisher: PUBLISHER,
    description: clip(feed.description, MAX_DESCRIPTION),
    imageUrl: feed.imageUrl,
    episodes,
  };
}
