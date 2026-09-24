import serialize from 'dom-serializer';
import type { Document, Element } from 'domhandler';
import { getAttributeValue, textContent } from 'domutils';
import { selectAll, selectOne } from 'css-select';
import { parseDocument } from 'htmlparser2';

import { allowlistNodes } from '../body-allowlist';
import { rewriteEmbeds } from '../embeds';
import { estimateReadingMinutes, extractPageMeta } from '../page-meta';
import { ratingFromPage, ratingFromText } from '../rating';
import type { ArticleExtractor, ExtractedArticle } from '../types';

/**
 * Article extraction with a real HTML parser — the backend for hosts that can
 * carry one (today: the Expo app).
 *
 * The difference that earns its four dependencies is the body cleanup: this
 * sanitises with a tag **allowlist**, unwrapping every unknown wrapper and
 * dropping every attribute that is not on the list. The table is
 * `articles/body-allowlist.ts`, which `buildReaderHtml` holds every body to as
 * well, so the extractor and the reader's last gate cannot disagree. `extract/string.ts` can only
 * cut out known-bad elements, so the reader gets `<div class="wp-block-…">`
 * scaffolding it has no styles for. Everything else about the two is the same by
 * construction — the page meta, the rating vocabulary and the reading time come
 * from shared modules, and `test/articles.test.ts` asserts the rest.
 */

// Typed wrappers: css-select infers the element type imprecisely from a Document.
function one(query: string, doc: Document | Element): Element | null {
  return selectOne(query, doc) as Element | null;
}
function all(query: string, doc: Document | Element): Element[] {
  return selectAll(query, doc) as unknown as Element[];
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
    contentEl.children = allowlistNodes(
      parseDocument(rewriteEmbeds(serialize(contentEl.children))).children,
      { dropEmpty: true },
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
