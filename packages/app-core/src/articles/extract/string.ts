import { balancedBlock, sanitizeArticleHtml, stripTags } from '../../lib/html';
import { adPrefixOf, applyBlockRules, articleBlockRules, headerPostOf } from '../blocks';
import { rewriteEmbeds } from '../embeds';
import { estimateReadingMinutes, extractPageMeta } from '../page-meta';
import { ratingFromPage, ratingFromText } from '../rating';
import type { ArticleExtractor, ExtractedArticle } from '../types';

/**
 * Article extraction with regular expressions — the backend for runtimes that
 * cannot carry an HTML parser.
 *
 * This is the core's **default**, because the core may not depend on a parser: a
 * host that has one registers `extract/dom.ts` instead, which is what the app does.
 * It walks the correctiv.org WordPress theme's `detail__*` BEM classes.
 *
 * The body is cleaned with a **denylist**: known-bad elements are cut out and
 * everything else survives, wrappers and classes included. `extract/dom.ts` uses
 * an allowlist instead and produces tighter markup — see `types.ts` for why both
 * exist and `test/articles.test.ts` for what holds them together.
 */

function blockText(html: string, className: string): string | undefined {
  const block = balancedBlock(html, new RegExp(`<\\w+[^>]*class="[^"]*${className}[^"]*"[^>]*>`));
  return block ? stripTags(block) || undefined : undefined;
}

export const extractArticleFromString: ArticleExtractor = (html: string): ExtractedArticle => {
  const meta = extractPageMeta(html);

  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  const title = (h1 ? stripTags(h1[1]) : '') || meta.title || '';

  const kicker = blockText(html, '\\btopline\\b');
  const excerpt = blockText(html, 'detail__excerpt') ?? meta.excerpt;

  // "von Max Bernhard" — the <time> element sits inside the same block but is
  // not part of the byline.
  const authorsBlock = balancedBlock(html, /<\w+[^>]*class="[^"]*detail__authors\b[^"]*"[^>]*>/);
  const authorLine = authorsBlock
    ? stripTags(authorsBlock.replace(/<time[\s\S]*?<\/time>/gi, '')).replace(/^von\s+/i, '')
    : '';
  // A page opening with `cvui/header-post` has no `detail__authors`; the block's
  // byline is the only one (`articles/blocks.ts`).
  const headerPost = headerPostOf(html);
  const authors =
    headerPost.authors.length > 0 ? headerPost.authors : authorLine ? splitAuthors(authorLine) : [];

  // The first `<time datetime>` on the page, which is what the DOM backend's
  // `time.detail__date, time[datetime]` selects. This asked for the class on the
  // `<time>` itself until 2026-09-24, and two of three measured pages put it on a
  // wrapping `<div>` or leave it off, so this backend returned no date where the
  // other returned one.
  const dateMatch = /<time\b[^>]*\bdatetime="([^"]+)"[^>]*>([\s\S]*?)<\/time>/.exec(html);
  const publishedAt = dateMatch ? toIso(dateMatch[1]) : '';
  const publishedText = dateMatch ? stripTags(dateMatch[2]) || undefined : undefined;

  // The verdict, from the rating image path first (a closed set) and from the
  // prose next to it second.
  const rating = ratingFromPage(html) ?? ratingFromText(blockText(html, 'detail__rating-text'));

  const bodyBlock = balancedBlock(html, /<div[^>]*class="[^"]*detail__content[^"]*"[^>]*>/);
  // The blocks first, while the buttons an accordion keeps its titles in are still
  // there for them to read; see `articles/blocks.ts`. Then the embeds, before the
  // cleaner would drop their frames (`articles/embeds.ts`).
  const bodyHtml = bodyBlock
    ? sanitizeArticleHtml(
        rewriteEmbeds(applyBlockRules(bodyBlock, articleBlockRules(adPrefixOf(html)))),
      )
    : '';

  return {
    title,
    kicker,
    excerpt,
    authors,
    publishedAt,
    publishedText,
    readingMinutes: meta.readingMinutes ?? estimateReadingMinutes(stripTags(bodyHtml)),
    heroImageUrl: meta.heroImageUrl,
    heroVideoUrl: headerPost.videoUrl,
    bodyHtml,
    rating,
  };
};

/** "Max Bernhard und Anna Meier", "Max Bernhard, Anna Meier" → two names. */
function splitAuthors(line: string): string[] {
  return line
    .split(/\s*(?:,|\bund\b|&)\s*/i)
    .map((name) => name.trim())
    .filter(Boolean);
}

function toIso(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
