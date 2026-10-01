import type { SpotlightIssue } from '../data/spotlight';
import { plainText } from '../lib/html';
import { byDate } from '../lib/sort';
import { fetchJson } from './http';

/**
 * The Spotlight newsletter archive.
 *
 * A public WordPress post type, `newspack_nl_cpt`, from the Newspack Newsletters
 * plugin. 523 issues on 2026-09-01, newest first, and a page of twelve with the
 * four fields below is 4.5 KB. No auth, and the same `Origin`-reflecting CORS
 * header as the rest of the API, so this works in the browser build too.
 *
 * `content` is deliberately not requested: it is tens of kilobytes per issue and the
 * lists show none of it. The reader asks for one issue's body by slug
 * (`fetchWpArticle`); see `data/spotlight.ts`.
 */
export const SPOTLIGHT_ENDPOINT = 'https://correctiv.org/wp-json/wp/v2/newspack_nl_cpt';

/**
 * `yoast_head_json.og_image` and not `cvui_featured_image`.
 *
 * The theme's image field is a post-only thing: on every sampled issue
 * `featured_media` is 0 and `acf` is an empty array, while Yoast still resolves a
 * social image. Which is often the newsletter's standing masthead GIF, hence the
 * warning on `SpotlightIssue.imageUrl`.
 */
const FIELDS = 'id,date,link,title,excerpt,yoast_head_json.og_image';

const TIMEOUT_MS = 10000;

interface NewsletterPost {
  id?: number;
  date?: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  yoast_head_json?: { og_image?: { url?: string }[] } | null;
}

function toIssue(post: NewsletterPost): SpotlightIssue {
  return {
    id: `nl-${post.id ?? post.link ?? ''}`,
    date: post.date ? new Date(post.date).toISOString() : new Date(0).toISOString(),
    subject: plainText(post.title?.rendered ?? ''),
    teaser: plainText(post.excerpt?.rendered ?? ''),
    url: post.link ?? '',
    imageUrl: post.yoast_head_json?.og_image?.[0]?.url ?? null,
  };
}

/**
 * The newest issues, newest first. Throws so the caller can fall back.
 *
 * **Sorted here rather than trusted.** This promised the order and took the
 * API's word for it, which is the assumption `stores/feeds.ts` exists to
 * disprove: `correctiv.org/feed/` hoists one item out of date order, and Home
 * reading the first one was a four-week-old lead article. `latestIssue` reads
 * `issues[0]`, so the promise has to be kept by something.
 *
 * `count` is the store's to decide, because how many issues are worth holding is
 * a question about the cache and the screens, not about the archive.
 */
export async function fetchSpotlightIssues(count: number): Promise<SpotlightIssue[]> {
  const params = new URLSearchParams({ per_page: String(count), _fields: FIELDS });
  const posts = await fetchJson<NewsletterPost[]>(`${SPOTLIGHT_ENDPOINT}?${params}`, {
    timeoutMs: TIMEOUT_MS,
  });
  return (Array.isArray(posts) ? posts : [])
    .filter((post) => post?.link && post?.title?.rendered)
    .map(toIssue)
    .sort(byDate);
}
