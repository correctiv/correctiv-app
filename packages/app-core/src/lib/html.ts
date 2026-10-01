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

/**
 * A tag, its quoted attribute values included: a `>` inside quotes does not end it,
 * and a `<` outside them does, which is what keeps this linear. It was `<[^>]*>`
 * until 2026-09-24, which ran from every `<` to the next `>`, and on 120 KB of
 * `<p x` with no `>` in it that took over two seconds.
 */
const TAG = /<(?:[^<>"']|"[^"]*"|'[^']*')*>/g;

/** Markup out, text in, whitespace collapsed. */
export function stripTags(html: string): string {
  return decodeEntities(html.replace(TAG, ' ')).replace(/\s+/g, ' ').trim();
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
 * null when there is none, and on markup it cannot balance.
 */
export function balancedBlock(html: string, startRe: RegExp): string | null {
  const element = balancedElement(html, startRe);
  return element && !('unbalanced' in element)
    ? html.slice(element.innerStart, element.innerEnd)
    : null;
}

/** Where one element sits in a string of markup. */
export interface ElementSpan {
  /** Index of the `<` that opens it. */
  start: number;
  /** Just past the `>` of the opening tag. */
  innerStart: number;
  /** Index of the `<` of its closing tag. */
  innerEnd: number;
  /** Just past the closing tag. */
  end: number;
}

/**
 * An element whose opening tag was found and whose end was not. A result of its
 * own rather than `null`, because a caller walking a document has to tell "there
 * are no more" from "this one is broken, look past it".
 */
export interface UnbalancedElement {
  unbalanced: true;
  start: number;
  innerStart: number;
}

/**
 * `balancedBlock`, with the positions rather than the text. `startRe` is tested
 * against each opening tag `tags` finds, anchored at its `<`, so a match inside a
 * script, a comment or an attribute value is not one.
 */
export function balancedElement(
  html: string,
  startRe: RegExp,
): ElementSpan | UnbalancedElement | null {
  const anchored = new RegExp(`^(?:${startRe.source})`, startRe.flags.replace(/[gy]/g, ''));
  for (const tag of tags(html)) {
    if (tag.closing || !anchored.test(html.slice(tag.start, tag.end))) continue;
    return closeOf(html, tag);
  }
  return null;
}

/** The element `open` starts, balanced against the tags of its own name after it. */
export function closeOf(html: string, open: Tag): ElementSpan | UnbalancedElement {
  let depth = 1;
  for (const tag of tags(html, open.end)) {
    if (tag.name !== open.name) continue;
    depth += tag.closing ? -1 : 1;
    if (depth === 0) {
      return { start: open.start, innerStart: open.end, innerEnd: tag.start, end: tag.end };
    }
  }
  return { unbalanced: true, start: open.start, innerStart: open.end };
}

/**
 * Every tag in the markup, and for each opening tag the closing tag that ends its
 * element: `closeOf` for all of them at once, in one pass rather than one per
 * element. An opening tag with no entry in `close` is one whose end is not there.
 */
export function pairedTags(html: string): { list: Tag[]; close: Map<Tag, Tag> } {
  const list: Tag[] = [];
  const close = new Map<Tag, Tag>();
  const open = new Map<string, Tag[]>();
  for (const tag of tags(html)) {
    list.push(tag);
    const stack = open.get(tag.name) ?? [];
    if (!tag.closing) {
      stack.push(tag);
      open.set(tag.name, stack);
      continue;
    }
    const opener = stack.pop();
    if (opener) close.set(opener, tag);
  }
  return { list, close };
}

/** One tag as `tags` reads it. */
export interface Tag {
  /** Lower case. */
  name: string;
  closing: boolean;
  /** Index of its `<`. */
  start: number;
  /** Just past its `>`. */
  end: number;
  /** Names lower case, values as written, entities still encoded. */
  attrs: Record<string, string>;
}

/**
 * Every tag from `from` on, read the way a browser tokenises them, in one pass.
 *
 * Regular expressions over the markup could not say where a block ends. They
 * counted a `<div` inside a script, a style, a comment or a quoted attribute as a
 * tag and missed `</div >`, and a lookahead for a block's marker rescanned to the
 * next `>` from every `<`, which took 13.6 s on 120 KB of `<p x`. Found by a cold
 * review of the block rules on 2026-09-24. This reads attributes with their
 * quotes, skips comments and what is inside `<script>` and `<style>`, and looks at
 * each character once. Markup that ends inside a tag or a comment ends the walk.
 */
export function* tags(html: string, from = 0): Generator<Tag> {
  const n = html.length;
  let pos = from;
  while (pos < n) {
    const lt = html.indexOf('<', pos);
    if (lt < 0) return;
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end < 0) return;
      pos = end + 3;
      continue;
    }
    const closing = html[lt + 1] === '/';
    let i = lt + (closing ? 2 : 1);
    if (!/[A-Za-z]/.test(html[i] ?? '')) {
      // `<!DOCTYPE` and `<?xml` run to the next `>`; a bare `<` is text.
      if (html[lt + 1] === '!' || html[lt + 1] === '?') {
        const gt = html.indexOf('>', lt);
        if (gt < 0) return;
        pos = gt + 1;
      } else {
        pos = lt + 1;
      }
      continue;
    }
    const nameStart = i;
    while (i < n && !isSpace(html[i]) && html[i] !== '/' && html[i] !== '>') i++;
    const name = html.slice(nameStart, i).toLowerCase();
    const read = readAttributes(html, i);
    if (!read) return;
    yield { name, closing, start: lt, end: read.end, attrs: closing ? {} : read.attrs };
    pos = read.end;
    if (!closing && (name === 'script' || name === 'style')) {
      const close = new RegExp(`</${name}\\s*>`, 'gi');
      close.lastIndex = pos;
      const m = close.exec(html);
      if (!m) return;
      pos = m.index; // the closing tag is the next one read
    }
  }
}

function isSpace(c: string | undefined): boolean {
  return c === ' ' || c === '\n' || c === '\t' || c === '\r' || c === '\f';
}

/** A tag's attributes, from just past its name to just past its `>`. */
function readAttributes(
  html: string,
  from: number,
): { attrs: Record<string, string>; end: number } | null {
  const attrs: Record<string, string> = Object.create(null) as Record<string, string>;
  const n = html.length;
  let i = from;
  while (i < n) {
    const c = html[i];
    if (c === '>') return { attrs, end: i + 1 };
    if (isSpace(c) || c === '/') {
      i++;
      continue;
    }
    const nameStart = i;
    i++; // a name's first character may be anything else, `=` included
    while (i < n && !isSpace(html[i]) && html[i] !== '/' && html[i] !== '>' && html[i] !== '=') {
      i++;
    }
    const name = html.slice(nameStart, i).toLowerCase();
    let j = i;
    while (j < n && isSpace(html[j])) j++;
    if (html[j] !== '=') {
      attrs[name] ??= '';
      continue;
    }
    j++;
    while (j < n && isSpace(html[j])) j++;
    const quote = html[j];
    let value: string;
    if (quote === '"' || quote === "'") {
      const close = html.indexOf(quote, j + 1);
      if (close < 0) return null;
      value = html.slice(j + 1, close);
      i = close + 1;
    } else {
      const valueStart = j;
      while (j < n && !isSpace(html[j]) && html[j] !== '>') j++;
      value = html.slice(valueStart, j);
      i = j;
    }
    attrs[name] ??= value;
  }
  return null;
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
 *
 * **It is not the reader's security boundary**, and nothing should rely on it
 * being one. That is `gateReaderBody` in `articles/body-allowlist.ts`, which
 * `buildReaderHtml` runs over every body whatever produced it: an allowlist over
 * a parsed tree. This function was the boundary for a day, and a re-check on
 * 2026-09-24 found two bodies no denylist of this shape stops, a tag left open at
 * the end and an `<area>` nobody had listed (ADR 0065 §7). What it does is
 * cleaning: the bytes the cache and the offline bundle store are smaller and
 * nearer to what the reader shows, and the string extractor's output is readable
 * on its own.
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
  // A tag left open at the very end, which whatever is written after the body
  // would close. The gate parses it as text; dropping it here keeps it out of the
  // cache as well.
  out = out.replace(/<[a-z!/?][^>]*$/i, '');
  // Tracking pixels (1x1) and empty lazyload imgs without a src.
  out = out.replace(/<img[^>]+(facebook\.com\/tr|height="1")[^>]*>/gi, '');
  // Reduce <picture>/<source> variants to the <img> - the reader loads srcset itself.
  out = out.replace(/<source[^>]*>/gi, '');
  return out.trim();
}
