import serialize from 'dom-serializer';
import type { AnyNode, Document, Element } from 'domhandler';
import { getAttributeValue, textContent } from 'domutils';
import { selectAll, selectOne } from 'css-select';
import { parseDocument } from 'htmlparser2';

import {
  EMBED_FALLBACK_CLASS,
  EMBED_FRAME_CLASS,
  embedElementAttributes,
  rewriteEmbeds,
} from '../embeds';
import { estimateReadingMinutes, extractPageMeta } from '../page-meta';
import { ratingFromPage, ratingFromText } from '../rating';
import type { ArticleExtractor, ExtractedArticle } from '../types';

/**
 * Article extraction with a real HTML parser — the backend for hosts that can
 * carry one (today: the Expo app).
 *
 * The difference that earns its four dependencies is the body cleanup: this
 * sanitises with a tag **allowlist**, unwrapping every unknown wrapper and
 * dropping every attribute that is not on the list. `extract/string.ts` can only
 * cut out known-bad elements, so the reader gets `<div class="wp-block-…">`
 * scaffolding it has no styles for. Everything else about the two is the same by
 * construction — the page meta, the rating vocabulary and the reading time come
 * from shared modules, and `test/articles.test.ts` asserts the rest.
 */

/** Tags that survive into the reader. */
const KEEP = new Set([
  'p',
  'h2',
  'h3',
  'h4',
  'h5',
  'ul',
  'ol',
  'li',
  'blockquote',
  'figure',
  'figcaption',
  'img',
  'a',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'br',
  'hr',
]);

/** Tags removed together with their contents. */
const DROP = new Set([
  'script',
  'style',
  'noscript',
  'iframe',
  'form',
  'button',
  'input',
  'svg',
  'video',
  'audio',
  'ins',
  'aside',
  'nav',
  'header',
  'footer',
]);

/** Attributes allowed per tag. Everything else — class, style, data-* — goes. */
const ATTRS: Record<string, string[]> = { a: ['href'], img: ['src', 'alt'] };

/** What `embeds.ts` leaves behind: media, as far as an empty paragraph is concerned. */
const EMBEDS = `iframe.${EMBED_FRAME_CLASS}, a.${EMBED_FALLBACK_CLASS}`;

function isElement(node: AnyNode): node is Element {
  return node.type === 'tag' || node.type === 'script' || node.type === 'style';
}

// Typed wrappers: css-select infers the element type imprecisely from a Document.
function one(query: string, doc: Document | Element): Element | null {
  return selectOne(query, doc) as Element | null;
}
function all(query: string, doc: Document | Element): Element[] {
  return selectAll(query, doc) as unknown as Element[];
}

/** Recursively: drop, unwrap, or keep with allowlisted attributes. */
function sanitizeChildren(children: AnyNode[]): AnyNode[] {
  const out: AnyNode[] = [];
  for (const node of children) {
    if (node.type === 'text') {
      out.push(node);
      continue;
    }
    if (!isElement(node)) continue; // comments, CDATA and friends
    const tag = node.name.toLowerCase();
    const embed = embedElementAttributes(tag, node.attribs ?? {});
    if (embed) {
      node.attribs = embed;
      node.children = [];
      out.push(node);
      continue;
    }
    if (DROP.has(tag)) continue;

    const cleaned = sanitizeChildren(node.children ?? []);
    if (!KEEP.has(tag)) {
      // Unknown wrapper (span, div, section …): pull its children up.
      out.push(...cleaned);
      continue;
    }

    node.children = cleaned;
    node.attribs = Object.fromEntries(
      Object.entries(node.attribs ?? {}).filter(([k]) => (ATTRS[tag] ?? []).includes(k)),
    );
    // Empty paragraphs and headings with neither text nor media are layout noise.
    const hasText = textContent(node).trim().length > 0;
    const hasMedia =
      tag === 'img' || tag === 'br' || tag === 'hr' || selectOne(`img, ${EMBEDS}`, node) != null;
    if (hasText || hasMedia) out.push(node);
  }
  return out;
}

export const extractArticleFromDom: ArticleExtractor = (html: string): ExtractedArticle => {
  const doc = parseDocument(html);
  const meta = extractPageMeta(html);

  const h1 = one('h1', doc);
  const title = (h1 ? textContent(h1).trim() : '') || meta.title || '';

  const toplineEl = one('.topline', doc);
  const kicker = (toplineEl ? textContent(toplineEl).trim() : '') || undefined;

  const excerptEl = one('.detail__excerpt', doc);
  const excerpt = (excerptEl ? textContent(excerptEl).trim() : '') || meta.excerpt;

  const authors = all('.detail__authors a, .detail__authors-link', doc)
    .map((a) => textContent(a).trim())
    .filter(Boolean);

  const timeEl = one('time.detail__date, time[datetime]', doc);
  const datetime = timeEl ? getAttributeValue(timeEl, 'datetime') : undefined;
  const publishedAt = datetime ? toIso(datetime) : '';
  const publishedText = timeEl ? textContent(timeEl).trim() || undefined : undefined;

  const ratingEl = one('.detail__rating-text', doc);
  const rating =
    ratingFromPage(html) ?? ratingFromText(ratingEl ? textContent(ratingEl) : undefined);

  const contentEl = one('.detail__content', doc);
  let bodyHtml = '';
  let bodyText = '';
  if (contentEl) {
    // Embeds are rewritten as markup, the way the string backend does it, so the
    // policy in `embeds.ts` is one function rather than one per backend.
    contentEl.children = sanitizeChildren(
      parseDocument(rewriteEmbeds(serialize(contentEl.children))).children,
    );
    bodyHtml = serialize(contentEl.children).trim();
    bodyText = textContent(contentEl);
  }

  return {
    title,
    kicker,
    excerpt,
    authors,
    publishedAt,
    publishedText,
    readingMinutes: meta.readingMinutes ?? estimateReadingMinutes(bodyText),
    heroImageUrl: meta.heroImageUrl,
    bodyHtml,
    rating,
  };
};

function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
