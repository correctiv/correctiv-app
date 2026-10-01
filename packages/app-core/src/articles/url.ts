/**
 * What a correctiv.org URL says about the page behind it.
 *
 * Two rules, both read off a permalink and neither of them a screen's: whether a
 * link is an article this app can render, and whether that article is a fact
 * check. `services/wp.service.ts` argues from the first one to explain why it
 * checks the post it got back against the URL it asked for, which is the tell that
 * these belong beside it rather than in a host — a rule the core reasons about
 * cannot live somewhere the core cannot read.
 */

/**
 * Paths on correctiv.org that list or serve rather than read: taxonomy pages, the
 * WordPress plumbing, and file downloads. Everything else with at least a section
 * and a slug is an article.
 */
const LISTING =
  /^\/(?:category|thema|tag|autor|author|suche|search|seite|page|feed|wp-json|wp-content|wp-admin)(?:\/|$)/;
const FILE = /\.(?:pdf|jpe?g|png|gif|svg|zip|csv|xlsx?|docx?|mp3|mp4)$/i;

/**
 * Whether a link inside an article should open in the reader rather than the
 * system browser.
 *
 * The rule used to require a date in the path (`/faktencheck/2026/08/04/…`), which
 * is what most articles look like — but not all of them: Spotlight pieces live at
 * `correctiv.org/spotlight-newsletter/<slug>/` with no date, and those are exactly
 * the articles this app links to most, from the briefing on Home. Every one of them
 * left the app.
 *
 * So the test is inverted: internal unless the path is a listing, a file, or too
 * short to be an article. A bare section (`/lokal/`) is a landing page and belongs
 * in the browser. Should this still guess wrong, the reader's error state offers
 * "im Browser öffnen" — a misjudgement costs one tap, not the article.
 */
export function isInternalArticleUrl(target: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'correctiv.org') return false;
  if (LISTING.test(parsed.pathname) || FILE.test(parsed.pathname)) return false;
  return parsed.pathname.split('/').filter(Boolean).length >= 2;
}

/**
 * Whether a correctiv.org article is a fact check, read off its permalink.
 *
 * The reason this is a URL rule and not a look at `FeedItem.feed`: the site-wide
 * `recherchen` stream stamps every card with the feed that was asked for, on
 * purpose, so that Home's "Neueste Recherchen" does not sprout Faktencheck badges
 * (`services/wp.service.ts` → `fetchWpFeed`). Every item in that stream therefore
 * says `feed: 'recherchen'`, fact checks included, and the field cannot answer this
 * question. `categories` cannot either: it carries display names rather than the
 * slugs `FEED_PRIORITY` matches on, and upstream files some posts under a
 * misspelled "Fakencheck" beside the correct one.
 *
 * The first path segment is the test, not a substring: fact checks live at
 * `/faktencheck/…`, including the sub-sectioned ones (`/faktencheck/hintergrund/…`,
 * `/faktencheck/aus-der-community/…`), and nothing else does.
 */
export function isFactCheckUrl(target: string): boolean {
  try {
    return new URL(target).pathname.startsWith('/faktencheck/');
  } catch {
    return false;
  }
}
