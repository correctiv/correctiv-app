import { decodeEntities, escapeHtml } from '../lib/html';

/**
 * What the reader does with content an article embeds from somewhere else.
 *
 * Every cleaner used to drop `<iframe>` and `<script>` and say nothing, so a chart,
 * a map or a video left no trace: the text around it would say "in the chart
 * below" over nothing at all. This module is the one policy for all three of them
 * ([ADR 0065](../../../../adr/0065-embeds-inline-from-a-short-list-and-a-link-for-the-rest.md)):
 * `services/wp.service.ts` and `extract/string.ts` hand a body through
 * `rewriteEmbeds` before `sanitizeArticleHtml`, and `extract/dom.ts` before its own
 * allowlist.
 *
 * An embed ends up as one of two canonical elements, and nothing else in the body
 * is an embed afterwards:
 *
 * - `<iframe class="reader-embed">`, for a host on `INLINE_EMBED_HOSTS`: it
 *   renders in the reader.
 * - `<a class="embed-fallback" href data-embed-host>` with NO text, for every other
 *   embed. It carries no prose because a body is cached without a locale;
 *   `buildReaderHtml` writes the words into it, in the language of the moment,
 *   through `embedFallbackLink` while its gate walks the tree.
 *
 * Regular expressions rather than a parser, because the string cleaner has to run
 * where the core cannot carry one (`articles/types.ts`). The DOM cleaner calls the
 * same transform on its serialised body for the same reason the two share a page
 * meta module: one rule, not two that agree.
 */

/**
 * Hosts whose frames render inline, as measured on 2026-09-24 in a fresh browser
 * context per embed. None of them set a cookie a person would have to be asked
 * about; the ADR carries the table, and the one borderline case (DocumentCloud's
 * Cloudflare bot cookie).
 *
 * This is a PROPOSAL that the newsroom and data protection may still change, and
 * changing it is an edit to this list and nothing else: the cleaners, the reader's
 * Content Security Policy and the app's frame handling all read it from here.
 * What is not on it is a link, never a frame.
 */
export const INLINE_EMBED_HOSTS: readonly string[] = [
  'datawrapper.dwcdn.net',
  'cdn.correctiv.org',
  'app.23degrees.io',
  'embed.documentcloud.org',
  // Flourish, reached by turning its script embed into this frame (see below).
  'flo.uri.sh',
];

/**
 * The listed hosts whose frames also work WITHOUT an origin of their own, and are
 * given none: a `sandbox` without `allow-same-origin`, which every frame inside
 * them inherits.
 *
 * Measured 2026-09-24 (ADR 0065 §7): a frame nested in an embed that loads a page
 * on the app's own origin reaches the app's storage through `top`, and a sandbox
 * here closes that for everything under the embed. Datawrapper and Flourish draw
 * the same inside it; WordPress embeds Datawrapper that way itself. CORRECTIV's own
 * apps and 23degrees read their own storage and draw nothing, and DocumentCloud
 * could not be measured behind Cloudflare's bot check, so those three keep theirs.
 */
export const OPAQUE_EMBED_HOSTS: readonly string[] = ['datawrapper.dwcdn.net', 'flo.uri.sh'];

/** The sandbox an `OPAQUE_EMBED_HOSTS` frame gets. Popups, so a source link opens. */
export const EMBED_SANDBOX = 'allow-scripts allow-popups allow-popups-to-escape-sandbox';

export const EMBED_FRAME_CLASS = 'reader-embed';
export const EMBED_FALLBACK_CLASS = 'embed-fallback';

/**
 * A correctiv.org post embedded in another one. It opens as an article in the
 * reader rather than in a browser, so it takes different words; `buildReaderHtml`
 * reads this attribute to choose them.
 */
export const EMBED_KIND_ARTICLE = 'article';

const BASE = 'https://correctiv.org/';

/** Whether `url` may be framed in the reader: https, and a host on the list. */
export function isInlineEmbedUrl(url: string): boolean {
  const parsed = parseUrl(url);
  return parsed?.protocol === 'https:' && INLINE_EMBED_HOSTS.includes(parsed.hostname);
}

/**
 * Every embed in `html` rewritten to one of the two canonical elements, or
 * removed.
 *
 * Scripts are left for the cleaner to drop. A script alone becomes no link: an
 * inline one is a helper (Datawrapper's resize listener), and a lone external one
 * cannot be told apart from an advertisement. The script embeds a person would
 * miss arrive in a container that names them, and it is the container that is
 * rewritten.
 */
export function rewriteEmbeds(html: string): string {
  let out = replaceElements(html, SOCIAL_QUOTE, (open, inner) => {
    const attrs = attributes(open);
    const href = attrs['data-instgrm-permalink'] ?? attrs.cite ?? lastLink(inner) ?? undefined;
    return fallback(href);
  });
  out = replaceElements(out, FLOURISH, (open) => {
    const source = attributes(open)['data-src'] ?? '';
    return FLOURISH_SOURCE.test(source)
      ? frame(`https://flo.uri.sh/${source}/embed`, {})
      : fallback(undefined, 'flourish.studio');
  });
  return out.replace(IFRAME, (_match, open: string) => rewriteFrame(attributes(open)));
}

/**
 * The canonical attributes of an element `rewriteEmbeds` produced, or null for
 * any other element.
 *
 * For a cleaner that works on a tree: it keeps such an element with exactly these
 * attributes instead of applying its own allowlist, which would strip the class
 * and drop the empty link. The attributes are checked again rather than trusted,
 * because an article can contain an element that merely looks like one.
 */
export function embedElementAttributes(
  tag: string,
  attribs: Record<string, string>,
): Record<string, string> | null {
  const classes = (attribs.class ?? '').split(/\s+/);
  if (tag === 'iframe' && classes.includes(EMBED_FRAME_CLASS)) {
    const src = attribs.src ?? '';
    return isInlineEmbedUrl(src) ? frameAttributes(src, attribs) : null;
  }
  if (tag === 'a' && classes.includes(EMBED_FALLBACK_CLASS)) {
    const href = attribs.href;
    if (href !== undefined && safeHref(href) === undefined) return null;
    return pick(attribs, ['class', 'href', 'data-embed-host', 'data-embed-kind']);
  }
  return null;
}

/** The host a fallback names: the URL's, without a `www.`. */
export function embedHost(url: string): string | undefined {
  return parseUrl(url)?.hostname.replace(/^www\./, '') || undefined;
}

/**
 * The brand a short list of hosts is known by, keyed by the host `embedHost()`
 * would give (#273): a technical address like `youtube-nocookie.com` reads as
 * nothing to someone who does not run a video platform, where "YouTube" reads.
 * Brand names need no translation, so these are plain strings and not a
 * `coreMessage()` id, the same call `rendered-literals.test.ts` makes for a
 * wordmark.
 *
 * Whatever is not on this list keeps its address; a table that guessed at a
 * name for a host nobody vetted would be worse than the address it replaced.
 */
const EMBED_HOST_NAMES: Record<string, string> = {
  'youtube.com': 'YouTube',
  'youtube-nocookie.com': 'YouTube',
  'youtu.be': 'YouTube',
  'instagram.com': 'Instagram',
  'linkedin.com': 'LinkedIn',
  'x.com': 'X',
  'twitter.com': 'X',
  'facebook.com': 'Facebook',
  'tiktok.com': 'TikTok',
  'vimeo.com': 'Vimeo',
  'spotify.com': 'Spotify',
  'soundcloud.com': 'SoundCloud',
};

/**
 * The name a fallback link shows for `host`: a brand from `EMBED_HOST_NAMES` if
 * one covers it, else `host` itself. Matched by suffix, so a subdomain
 * `embedHost()` had no `www.` to strip from — `m.youtube.com`,
 * `open.spotify.com` — reaches the same name as the bare host, without a second
 * table entry for each one.
 */
export function embedHostName(host: string): string {
  for (const [known, name] of Object.entries(EMBED_HOST_NAMES)) {
    if (host === known || host.endsWith(`.${known}`)) return name;
  }
  return host;
}

/** `url` if it is an absolute http(s) address, else undefined. */
export function safeHref(url: string): string | undefined {
  // An empty one would resolve to the base, a link to somewhere nobody chose.
  const parsed = url.trim() ? parseUrl(url) : undefined;
  return parsed && (parsed.protocol === 'https:' || parsed.protocol === 'http:')
    ? parsed.toString()
    : undefined;
}

/** The words a fallback link says, already in the reader's language. */
export interface EmbedFallbackWords {
  /** For an embed that opens in the browser, named by its host. */
  openElsewhere: (host: string) => string;
  /** For a correctiv.org article embedded in another, which opens in the reader. */
  openArticle: string;
}

/** A fallback link as the reader document shows it. */
export interface EmbedFallbackLink {
  className: string;
  href: string;
  text: string;
}

/**
 * What a fallback marker becomes in the reader, from the marker's attributes.
 *
 * Built from nothing but what it needs, so what reaches the document is decided
 * here: an `href` that is not http(s) falls back to the article's own address, and
 * one that is neither is no link at all (null). `body-allowlist.ts` calls this
 * while it walks the tree and writes the result as a node, so the words are text
 * and the address an attribute value, both escaped by the serialiser. Nothing here
 * reads markup: the regex that used to find the markers in the gated body misread
 * a `>` inside a quoted attribute value, measured 2026-09-24.
 */
export function embedFallbackLink(
  attrs: Record<string, string>,
  words: EmbedFallbackWords,
  articleUrl: string,
): EmbedFallbackLink | null {
  const href = safeHref(attrs.href ?? '') ?? safeHref(articleUrl);
  if (!href) return null;
  const isArticle = attrs['data-embed-kind'] === EMBED_KIND_ARTICLE;
  const host = attrs['data-embed-host'] || embedHost(href) || '';
  return {
    className: isArticle
      ? `${EMBED_FALLBACK_CLASS} ${EMBED_FALLBACK_CLASS}--article`
      : EMBED_FALLBACK_CLASS,
    href,
    text: isArticle ? words.openArticle : words.openElsewhere(embedHostName(host)),
  };
}

// --- the rewriting ------------------------------------------------------------

/**
 * A frame's own height in px, where it states a plausible one. Kept because
 * Datawrapper sizes its frame by message to a script the reader does not run, and
 * the height the chart was published at is the nearest thing to the right one.
 */
const HEIGHT = /^\d{2,4}$/;

const IFRAME = /<iframe\b([^>]*)>(?:[\s\S]*?<\/iframe\s*>)?/gi;

/** Instagram, X and TikTok: a quote holding the permalink, and a script that styles it. */
const SOCIAL_QUOTE =
  /<blockquote\b[^>]*\bclass=["'][^"']*\b(?:instagram-media|twitter-tweet|tiktok-embed)\b[^>]*>/i;

/** Flourish's `<div class="flourish-embed" data-src="story/…">` and its loader script. */
const FLOURISH = /<div\b[^>]*\bclass=["'][^"']*\bflourish-embed\b[^>]*>/i;
const FLOURISH_SOURCE = /^(?:story|visualisation)\/\d+$/;

/**
 * WordPress's post embed, `…/slug/embed/#?secret=…`. On correctiv.org it is the
 * article itself, which the reader can open; the frame loads the site's analytics
 * and consent manager, which the reader will not.
 */
const WP_POST_EMBED = /\/embed\/?$/;

function rewriteFrame(attrs: Record<string, string>): string {
  const src = absolute(attrs.src ?? attrs['data-src'] ?? '');
  if (src && isInlineEmbedUrl(src)) return frame(src, attrs);
  const parsed = src ? parseUrl(src) : undefined;
  if (parsed?.hostname === 'correctiv.org' && WP_POST_EMBED.test(parsed.pathname)) {
    const article = `https://correctiv.org${parsed.pathname.replace(WP_POST_EMBED, '/')}`;
    return fallback(article, undefined, EMBED_KIND_ARTICLE);
  }
  return fallback(src);
}

/**
 * The frame the reader renders, with the attributes it needs and no others.
 *
 * `name` is kept because CORRECTIV's own apps read their language and starting
 * view out of it (`de#5.5/51.21/10.27` on the bathing-sites map). `sandbox`,
 * `allow` and `style` are not: the first because WordPress's `allow-scripts`
 * without `allow-same-origin` is its own oEmbed security measure, not the embed's
 * need, the others because they ask for permissions and layout the reader decides.
 */
function frame(src: string, attrs: Record<string, string>): string {
  const serialised = Object.entries(frameAttributes(src, attrs))
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join('');
  return `<iframe${serialised}></iframe>`;
}

/**
 * The attributes of the canonical frame, in the order they are written, for the
 * string path (`frame()`) and the tree path (`extract/dom.ts`) alike. The order
 * is the one `lib/html.ts` recognises a canonical frame by.
 */
function frameAttributes(src: string, attrs: Record<string, string>): Record<string, string> {
  const host = parseUrl(src)?.hostname ?? '';
  return {
    class: EMBED_FRAME_CLASS,
    src,
    ...(OPAQUE_EMBED_HOSTS.includes(host) ? { sandbox: EMBED_SANDBOX } : {}),
    ...(attrs.title ? { title: decodeEntities(attrs.title) } : {}),
    ...(attrs.name ? { name: attrs.name } : {}),
    ...(HEIGHT.test(attrs.height ?? '') ? { height: attrs.height } : {}),
    loading: 'lazy',
  };
}

/**
 * The link that stands in for an embed. Without a usable `href` it has none, and
 * the reader points it at the article, which is where the embed does render.
 */
function fallback(href: string | undefined, host?: string, kind?: string): string {
  const safe = href ? safeHref(absolute(href) ?? '') : undefined;
  const name = host ?? (safe ? embedHost(safe) : undefined);
  return (
    `<a class="${EMBED_FALLBACK_CLASS}"` +
    (safe ? ` href="${escapeHtml(safe)}"` : '') +
    (name ? ` data-embed-host="${escapeHtml(name)}"` : '') +
    (kind ? ` data-embed-kind="${kind}"` : '') +
    `></a>`
  );
}

// --- string plumbing ------------------------------------------------------------

const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** An opening tag's attributes, lower-cased names, entity-decoded values. */
function attributes(tag: string): Record<string, string> {
  const body = tag.replace(/^<\w+/, '').replace(/\/?>$/, '');
  const attrs: Record<string, string> = {};
  for (const [, name, dq, sq, bare] of body.matchAll(ATTRIBUTE)) {
    const key = name.toLowerCase();
    if (!(key in attrs)) attrs[key] = decodeEntities(dq ?? sq ?? bare ?? '');
  }
  return attrs;
}

function lastLink(html: string): string | undefined {
  const links = [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)];
  const last = links.at(-1)?.[1];
  return last ? decodeEntities(last) : undefined;
}

/**
 * Replace every element whose opening tag matches `start`, nesting counted, with
 * what `replace` makes of its opening tag and its inner HTML. An element that
 * never closes is left alone.
 */
function replaceElements(
  html: string,
  start: RegExp,
  replace: (open: string, inner: string) => string,
): string {
  let out = '';
  let rest = html;
  for (;;) {
    const m = start.exec(rest);
    if (!m) return out + rest;
    const tag = /^<(\w+)/.exec(m[0])![1];
    const end = closingIndex(rest, tag, m.index + m[0].length);
    if (end === null) return out + rest;
    out += rest.slice(0, m.index) + replace(m[0], rest.slice(m.index + m[0].length, end.inner));
    rest = rest.slice(end.outer);
  }
}

function closingIndex(
  html: string,
  tag: string,
  from: number,
): { inner: number; outer: number } | null {
  const open = new RegExp(`<${tag}[\\s>]`, 'gi');
  const close = new RegExp(`</${tag}\\s*>`, 'gi');
  let depth = 1;
  let pos = from;
  for (;;) {
    open.lastIndex = pos;
    close.lastIndex = pos;
    const o = open.exec(html);
    const c = close.exec(html);
    if (!c) return null;
    if (o && o.index < c.index) {
      depth += 1;
      pos = o.index + o[0].length;
    } else {
      depth -= 1;
      pos = c.index + c[0].length;
      if (depth === 0) return { inner: c.index, outer: pos };
    }
  }
}

function absolute(url: string): string | undefined {
  if (!url) return undefined;
  return parseUrl(url.startsWith('//') ? `https:${url}` : url)?.toString();
}

function parseUrl(url: string): URL | undefined {
  try {
    return new URL(url, BASE);
  } catch {
    return undefined;
  }
}

function pick(attribs: Record<string, string>, names: string[]): Record<string, string> {
  return Object.fromEntries(names.filter((n) => n in attribs).map((n) => [n, attribs[n]]));
}
