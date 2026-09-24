import serialize from 'dom-serializer';
import { Element, Text, type AnyNode, type Document } from 'domhandler';
import { getAttributeValue, textContent } from 'domutils';
import { selectAll, selectOne } from 'css-select';
import { parseDocument } from 'htmlparser2';

import {
  adPrefixOf,
  articleBlockRules,
  carries as tagCarries,
  headerPostOf,
  type BlockMarker,
  type BlockRule,
} from '../blocks';
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
  // What `articles/blocks.ts` makes of an accordion.
  'details',
  'summary',
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

function carries(node: Element, marker: BlockMarker): boolean {
  return tagCarries(node.attribs ?? {}, marker);
}

/** The first element under `nodes`, depth first, that carries the marker. */
function findMarked(nodes: AnyNode[], marker: BlockMarker): Element | null {
  for (const node of nodes) {
    if (!isElement(node)) continue;
    if (carries(node, marker)) return node;
    const inside = findMarked(node.children ?? [], marker);
    if (inside) return inside;
  }
  return null;
}

/**
 * The table in `articles/blocks.ts`, over the parsed tree: the same outcome the
 * string interpreter there reaches, and it runs before the allowlist for the same
 * reason — an accordion's title is inside a `<button>`, which the allowlist drops.
 * The first rule an element matches decides, and an ancestor is decided before
 * its descendants, which for the rules in that table is the order it lists them in.
 */
function applyBlockRules(children: AnyNode[], rules: readonly BlockRule[]): AnyNode[] {
  const out: AnyNode[] = [];
  for (const node of children) {
    if (!isElement(node)) {
      out.push(node);
      continue;
    }
    const rule = rules.find((r) => carries(node, r.marker));
    if (rule?.action === 'drop') continue;
    if (rule?.action === 'unwrap') {
      out.push(...applyBlockRules(node.children ?? [], rules));
      continue;
    }
    if (rule?.action === 'details') {
      const summary = findMarked(node.children ?? [], rule.summary);
      const panel = findMarked(node.children ?? [], rule.panel);
      if (summary && panel) {
        const title = textContent(summary).replace(/\s+/g, ' ').trim();
        out.push(
          new Element('details', {}, [
            new Element('summary', {}, [new Text(title)]),
            ...applyBlockRules(panel.children ?? [], rules),
          ]),
        );
        continue;
      }
    }
    node.children = applyBlockRules(node.children ?? [], rules);
    out.push(node);
  }
  return out;
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
      tag === 'img' || tag === 'br' || tag === 'hr' || selectOne('img', node) != null;
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

  // A page opening with `cvui/header-post` has no `detail__authors`; the block's
  // byline is the only one (`articles/blocks.ts`).
  const headerPost = headerPostOf(html);
  const bylined = all('.detail__authors a, .detail__authors-link', doc)
    .map((a) => textContent(a).trim())
    .filter(Boolean);
  const authors = headerPost.authors.length > 0 ? headerPost.authors : bylined;

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
    const blocks = applyBlockRules(contentEl.children, articleBlockRules(adPrefixOf(html)));
    contentEl.children = sanitizeChildren(blocks);
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
    heroVideoUrl: headerPost.videoUrl,
    bodyHtml,
    rating,
  };
};

function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
