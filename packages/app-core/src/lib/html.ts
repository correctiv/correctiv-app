/**
 * String primitives for the markup this app reads: entity decoding, tag
 * stripping, tag balancing and meta-tag lookup.
 *
 * Dependency-free and DOM-free on purpose. Everything here runs in React Native,
 * in a browser and in a Node script without a parser package, which is what lets
 * the feed parsers and the string-based article extractor be one implementation
 * rather than three.
 */

/**
 * The entities WordPress and the feeds actually emit.
 *
 * Curated, not the full HTML5 set: correctiv.org serves UTF-8, so named entities
 * beyond these are vanishingly rare and a 2000-entry table is not worth shipping
 * to a phone. `&uuml;` therefore passes through untouched — pinned by a test, so
 * the day a source starts emitting it, that test is where it shows up.
 */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#?(?:apos|039);/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&#8220;|&ldquo;/g, '“')
    .replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&#8222;|&bdquo;/g, '„')
    .replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8230;|&hellip;/g, '…');
}

/** Markup out, text in, whitespace collapsed. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * One line of plain text out of a WordPress `rendered` field.
 *
 * Not the same as `stripTags`, and the second decode is the reason. A `rendered`
 * title or excerpt can carry its entities encoded twice (`&amp;#8217;` for an
 * apostrophe), where one pass leaves a visible `&#8217;` standing in a headline.
 * The collapse repeats after it because that pass can turn an `&nbsp;` into a
 * space.
 *
 * `services/wp.service.ts` and `services/spotlight.service.ts` read two different
 * post types out of the same API and had a private copy of this each.
 */
export function plainText(html: string): string {
  return decodeEntities(stripTags(html)).replace(/\s+/g, ' ').trim();
}

/** The inverse, for text going into HTML we build ourselves. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The inner HTML of the first element whose opening tag matches `startRe`, with
 * nesting counted so a `<div>` inside the block does not end it early. Returns
 * null on markup it cannot balance.
 */
export function balancedBlock(html: string, startRe: RegExp): string | null {
  const m = startRe.exec(html);
  if (!m) return null;
  const tag = /^<(\w+)/.exec(m[0])?.[1];
  if (!tag) return null;
  const open = new RegExp(`<${tag}[\\s>]`, 'gi');
  const close = new RegExp(`</${tag}>`, 'gi');
  let depth = 1;
  let pos = m.index + m[0].length;
  while (depth > 0) {
    open.lastIndex = pos;
    close.lastIndex = pos;
    const o = open.exec(html);
    const c = close.exec(html);
    if (!c) return null; // broken markup
    if (o && o.index < c.index) {
      depth += 1;
      pos = o.index + o[0].length;
    } else {
      depth -= 1;
      pos = c.index + c[0].length;
    }
  }
  return html.slice(m.index + m[0].length, pos - `</${tag}>`.length);
}

const META_TAG = /<meta[^>]*>/gi;

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}=["']([^"']*)["']`, 'i').exec(tag)?.[1];
}

/**
 * Every `<meta>` on the page as `name`/`property` → `content`.
 *
 * Built as a map rather than searched per lookup because WordPress emits both
 * attribute orders on the same page, sometimes for the same key — so the order
 * inside a tag must not matter. First occurrence wins, which is what a browser
 * would use.
 */
export function metaTags(html: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const [tag] of html.matchAll(META_TAG)) {
    const key = attribute(tag, 'property') ?? attribute(tag, 'name');
    const content = attribute(tag, 'content');
    if (key && content && !tags.has(key)) tags.set(key, decodeEntities(content));
  }
  return tags;
}

/**
 * Elements that are never article content. Removed with their contents.
 *
 * `iframe` is not on it: every caller hands the body through `rewriteEmbeds`
 * (`articles/embeds.ts`) first, which decides what a frame becomes, and
 * `OTHER_FRAMES` below drops whatever reaches here in any other shape.
 */
const DROP_TAGS = ['script', 'noscript', 'form', 'style', 'svg', 'button'];

/**
 * Elements that act from the body without a script: a `<meta>` refresh
 * navigates the document, `<base>` re-points every relative address, `<link>`
 * loads and prerenders, and the rest are plug-ins and frames of other kinds.
 * Only the tags go, opening and closing, because what an `<object>` holds is
 * fallback content and inert without it (ADR 0065 §7).
 */
const ACTIVE_TAGS =
  /<\/?(?:meta|base|link|portal|object|embed|applet|param|frame|frameset)\b[^>]*>/gi;

/**
 * Take out every element that acts without a script, to a fixpoint.
 *
 * Repeated because a removal can put a tag back together: `<me<meta>ta …>` is a
 * refresh once the inner tag is gone. Exported for `buildReaderHtml`, which runs
 * it again over a body from the cache or the offline bundle, written by whatever
 * cleaner was current then.
 */
export function stripActiveMarkup(html: string): string {
  let out = html;
  for (let previous = ''; previous !== out;) {
    previous = out;
    out = out.replace(/<(script|noscript)\b[\s\S]*?<\/\1\s*>/gi, '');
    out = out.replace(/<\/?(?:script|noscript)\b[^>]*>/gi, '');
    out = out.replace(ACTIVE_TAGS, '');
  }
  return out;
}

/**
 * The one frame that may stay: exactly as `rewriteEmbeds` writes it, attribute
 * for attribute. Whether its host is on the list is `buildReaderHtml`'s check and
 * the document's policy, not this pattern's; what this pattern refuses is a frame
 * with anything else on it, a `srcdoc` first of all.
 */
const CANONICAL_FRAME =
  /^<iframe class="reader-embed" src="https:\/\/[^"<>\s]+"(?: sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox")?(?: title="[^"<>]*")?(?: name="[^"<>]*")?(?: height="\d{2,4}")? loading="lazy"><\/iframe>$/;

/** Any frame but the canonical one, with what it holds. */
const OTHER_FRAMES = /<iframe\b[^>]*>(?:[\s\S]*?<\/iframe\s*>)?/gi;

/**
 * Clean an article body for the reader, by denylist.
 *
 * Known-bad elements are cut out and everything else survives, wrappers and
 * classes included. It lived in `articles/extract/string.ts` while HTML scraping
 * was the only way in; `services/wp.service.ts` needs the same treatment for the
 * REST API's `content.rendered`, and two copies of a security-shaped function is
 * one copy too many. Measured on a live article body, `content.rendered` carries
 * only `a br div em figure h2 hr img p span strong` — so this is defence against
 * the post that embeds something, not a fix for one that already does.
 */
export function sanitizeArticleHtml(body: string): string {
  let out = body;
  // To a fixpoint, and the frames last, because every removal here can put a tag
  // back together out of the text on either side of it: `<ifr<script></script>ame`
  // is a frame once the script is gone.
  for (let previous = ''; previous !== out;) {
    previous = out;
    for (const tag of DROP_TAGS) {
      out = out.replace(new RegExp(`<${tag}[\\s\\S]*?</${tag}>`, 'gi'), '');
    }
    out = stripActiveMarkup(out);
    out = out.replace(OTHER_FRAMES, (frame) => (CANONICAL_FRAME.test(frame) ? frame : ''));
  }
  // Tracking pixels (1x1) and empty lazyload imgs without a src.
  out = out.replace(/<img[^>]+(facebook\.com\/tr|height="1")[^>]*>/gi, '');
  // Reduce <picture>/<source> variants to the <img> - the reader loads srcset itself.
  out = out.replace(/<source[^>]*>/gi, '');
  return out.trim();
}
