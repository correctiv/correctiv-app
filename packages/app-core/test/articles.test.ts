import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { extractArticleFromDom } from '../src/articles/extract/dom';
import { extractArticleFromString } from '../src/articles/extract/string';
import { estimateReadingMinutes, extractPageMeta } from '../src/articles/page-meta';
import {
  FACTCHECK_RATINGS,
  ratingFromInterpretation,
  ratingFromPage,
  ratingFromText,
  RATING_LABELS,
  ratingTone,
} from '../src/articles/rating';
import { buildReaderHtml, type ReaderCopy } from '../src/articles/reader-html';
import type { Article, ArticleExtractor } from '../src/articles/types';
import { decodeEntities, stripTags } from '../src/lib/html';

const ARTICLE = readFileSync(
  fileURLToPath(new URL('./__fixtures__/articles/faktencheck-1.html', import.meta.url)),
  'utf8',
);

const BACKENDS: [string, ArticleExtractor][] = [
  ['string', extractArticleFromString],
  ['dom', extractArticleFromDom],
];

/**
 * Pinned against a real correctiv.org page. Both extractors walk the WordPress
 * theme's `detail__*` BEM classes, so a theme change breaks them silently in
 * production — these assertions are the early warning.
 */
describe.each(BACKENDS)('extract (%s backend)', (_name, extract) => {
  const article = extract(ARTICLE);

  it('pulls the editorial fields off the page', () => {
    expect(article.title).toBe(
      'Weshalb eine Deutschlandfahne die Bundestagspolizei auf den Plan rief',
    );
    expect(article.kicker).toBe('Politik');
    expect(article.authors).toEqual(['Steffen Kutzner']);
    expect(article.publishedAt).toBe('2026-06-12T15:20:06.000Z');
    expect(article.publishedText).toBe('12. Juni 2026');
    expect(article.excerpt?.length).toBeGreaterThan(20);
  });

  it('extracts a non-trivial body and keeps content markup', () => {
    expect(article.bodyHtml.length).toBeGreaterThan(1000);
    expect(article.bodyHtml).toContain('<p');
  });

  it('strips scripts, iframes and forms out of the body', () => {
    expect(article.bodyHtml).not.toMatch(/<script|<noscript|<iframe|<form|<style|<button/i);
  });

  it('resolves the social image', () => {
    expect(article.heroImageUrl).toMatch(/^https:\/\/correctiv\.org\/wp-content\/uploads\//);
  });

  it('leaves the verdict unset on a page without a rating plaque', () => {
    expect(article.rating).toBeUndefined();
  });

  it('gives a plausible reading time', () => {
    expect(article.readingMinutes).toBeGreaterThanOrEqual(1);
    expect(article.readingMinutes).toBeLessThan(60);
  });

  it('returns an empty article rather than throwing on a page it cannot understand', () => {
    const empty = extract('<html><body><p>nothing familiar</p></body></html>');
    expect(empty.title).toBe('');
    expect(empty.bodyHtml).toBe('');
    expect(empty.authors).toEqual([]);
    expect(empty.rating).toBeUndefined();
  });
});

/**
 * THE test that makes two extraction backends a choice rather than a fork.
 *
 * The core ships both because a host may not be able to carry an HTML parser (see
 * `articles/types.ts`). Every field they are supposed to agree on is asserted equal
 * here. The body markup is deliberately excluded, because tighter markup is the
 * entire reason the DOM backend exists.
 */
describe('the two backends agree', () => {
  const fromString = extractArticleFromString(ARTICLE);
  const fromDom = extractArticleFromDom(ARTICLE);

  it('on every field except the body markup', () => {
    const { bodyHtml: _s, ...s } = fromString;
    const { bodyHtml: _d, ...d } = fromDom;
    expect(s).toEqual(d);
  });

  it('on the plain text of the body, to within the wrappers one of them unwraps', () => {
    const words = (html: string) => stripTags(html).split(/\s+/).length;
    expect(words(fromDom.bodyHtml)).toBeGreaterThan(words(fromString.bodyHtml) * 0.9);
  });

  it('and only the DOM backend removes classes and inline styles', () => {
    expect(fromDom.bodyHtml).not.toMatch(/ class="| style="/i);
    // Not a defect in the string backend — a documented limit of regex cleanup.
    expect(fromString.bodyHtml).toMatch(/ class="/i);
  });
});

describe('fact-check vocabulary', () => {
  it('reads the verdict off the rating image path', () => {
    expect(ratingFromPage('<img src="/assets/rating/mostly-false.svg">')).toBe(
      'groesstenteils-falsch',
    );
    expect(ratingFromPage('<img src="/assets/rating/missing_context.svg">')).toBe(
      'fehlender-kontext',
    );
    expect(ratingFromPage('<p>no plaque here</p>')).toBeUndefined();
  });

  /**
   * Order matters: "größtenteils falsch" contains "falsch". Matching the bare
   * word first would collapse every qualified verdict into its absolute.
   */
  it('reads the verdict off German prose, longest match first', () => {
    expect(ratingFromText('Größtenteils falsch Über diese Bewertung')).toBe(
      'groesstenteils-falsch',
    );
    expect(ratingFromText('Falsch Über diese Bewertung')).toBe('falsch');
    expect(ratingFromText('Groesstenteils richtig')).toBe('groesstenteils-richtig');
    expect(ratingFromText('Fehlender Kontext')).toBe('fehlender-kontext');
  });

  it('maps every verdict to a label and one of three tones', () => {
    expect(RATING_LABELS['fehlender-kontext'].defaultMessage).toBe('Missing context');
    expect(ratingTone('falsch')).toBe('refuted');
    expect(ratingTone('unbelegt')).toBe('qualified');
    expect(ratingTone('richtig')).toBe('confirmed');
  });

  /**
   * The three slugs correctiv.org publishes that this vocabulary did not know,
   * measured 2026-09-01 over 200 fact checks: `partly_false` (5),
   * `faktenforum_false` (9), `faktenforum_misleading` (6).
   */
  it('knows the Faktenforum variants and the partly-false verdict', () => {
    expect(ratingFromPage('<img src="/x/rating/partly_false.svg">')).toBe('teilweise-falsch');
    expect(ratingFromPage('<img src="/x/rating/faktenforum_false.svg">')).toBe('falsch');
    expect(ratingFromPage('<img src="/x/rating/faktenforum_misleading.svg">')).toBe('irrefuehrend');
  });

  /**
   * The regression this was written for. "Teilweise falsch" contains "falsch",
   * so before `teilweise-falsch` existed the prose matcher printed the harder
   * verdict "Falsch" over an article CORRECTIV had rated more softly.
   */
  it('does not harden "Teilweise falsch" into "Falsch"', () => {
    expect(ratingFromText('Teilweise falsch Über diese Bewertung')).toBe('teilweise-falsch');
    expect(RATING_LABELS['teilweise-falsch'].defaultMessage).toBe('Partly false');
    expect(ratingTone('teilweise-falsch')).toBe('qualified');
  });

  /** The API states the verdict in the same tokens as the image path. */
  it('reads the verdict out of the REST field', () => {
    expect(ratingFromInterpretation('faktenforum_false')).toBe('falsch');
    expect(ratingFromInterpretation('partly_false')).toBe('teilweise-falsch');
    expect(ratingFromInterpretation('mostly_true')).toBe('groesstenteils-richtig');
    expect(ratingFromInterpretation('')).toBeUndefined();
    expect(ratingFromInterpretation(null)).toBeUndefined();
  });

  it('covers every verdict with a label and a tone', () => {
    for (const rating of FACTCHECK_RATINGS) {
      // Both halves of the descriptor, because an id with no default extracts to
      // an empty English entry and a default with no id cannot be translated.
      expect(RATING_LABELS[rating].id).toMatch(/^core\.rating\./);
      expect(RATING_LABELS[rating].defaultMessage).toBeTruthy();
      expect(['refuted', 'qualified', 'confirmed']).toContain(ratingTone(rating));
    }
  });
});

describe('page meta', () => {
  /**
   * correctiv.org publishes its own reading time as a twitter:label/data pair
   * whose index moves between article types, so it has to be found by value.
   */
  it("prefers the page's own reading time over an estimate", () => {
    const html = `<meta name="twitter:label2" content="Lesezeit"><meta name="twitter:data2" content="7 Minuten">`;
    expect(extractPageMeta(html).readingMinutes).toBe(7);
  });

  it('ignores a label pair that is not the reading time', () => {
    const html = `<meta name="twitter:label1" content="Verfasst von"><meta name="twitter:data1" content="Steffen Kutzner">`;
    expect(extractPageMeta(html).readingMinutes).toBeUndefined();
  });

  it('reads meta tags in either attribute order — WordPress emits both', () => {
    expect(
      extractPageMeta('<meta property="og:image" content="https://x/a.jpg">').heroImageUrl,
    ).toBe('https://x/a.jpg');
    expect(
      extractPageMeta('<meta content="https://x/b.jpg" property="og:image">').heroImageUrl,
    ).toBe('https://x/b.jpg');
  });

  it('never estimates zero minutes', () => {
    expect(estimateReadingMinutes('')).toBe(1);
  });
});

describe('reader html', () => {
  const article: Article = {
    url: 'https://correctiv.org/faktencheck/2026/06/12/x/',
    title: 'Ein <Titel> & ein "Zitat"',
    kicker: 'Politik',
    excerpt: 'Der Lead.',
    authors: ['A. Autorin', 'B. Autor'],
    publishedAt: '2026-06-12T15:20:06.000Z',
    publishedText: '12. Juni 2026',
    readingMinutes: 5,
    bodyHtml: '<p>Text</p>',
    heroImageUrl: 'https://correctiv.org/hero.jpg',
  };

  /**
   * The words a host arrives with, and they are ENGLISH here on purpose.
   *
   * The German that ships is in `packages/catalogue/src/de/core.ts` and
   * this file cannot see it. What these assertions are about is what the core
   * still decides once the words are somebody else's: the order of the meta line,
   * the separator between its parts, which of them are dropped when absent, and
   * that everything is escaped on the way in.
   */
  const copy: ReaderCopy = {
    factcheckBadge: 'Fact check',
    verdict: 'False',
    byline: 'by A. Autorin, B. Autor',
    readingTime: '5 min read',
    support: 'Made possible by supporters like you.',
  };

  it('escapes editorial text but passes the sanitised body through', () => {
    const html = buildReaderHtml(article, copy, { locale: 'de' });
    expect(html).toContain('Ein &lt;Titel&gt; &amp; ein &quot;Zitat&quot;');
    expect(html).toContain('<p>Text</p>');
  });

  /**
   * The date goes through the app's own formatter rather than being echoed from the
   * page, so the reader reads "12. Juni" like every list does — correctiv.org itself
   * prints a leading zero.
   */
  it('builds the meta line from authors, the app-formatted date and the reading time', () => {
    expect(
      buildReaderHtml({ ...article, publishedText: '12.06.2026' }, copy, { locale: 'de' }),
    ).toContain('by A. Autorin, B. Autor · 12. Juni 2026 · 5 min read');
  });

  it('falls back to the printed date only when no date was parsable, and drops it if neither is', () => {
    expect(
      buildReaderHtml({ ...article, publishedAt: '', publishedText: 'im Juni 2026' }, copy, {
        locale: 'de',
      }),
    ).toContain('by A. Autorin, B. Autor · im Juni 2026 · 5 min read');
    expect(
      buildReaderHtml({ ...article, publishedAt: '', publishedText: undefined }, copy, {
        locale: 'de',
      }),
    ).toContain('by A. Autorin, B. Autor · 5 min read');
  });

  /** An article with no named author prints no byline rather than an empty one. */
  it('drops the byline the host left out', () => {
    const html = buildReaderHtml(
      { ...article, authors: [] },
      { ...copy, byline: undefined },
      { locale: 'de' },
    );
    expect(html).toContain('12. Juni 2026 · 5 min read');
    expect(html).not.toContain('·  ·');
  });

  /**
   * The badge is SHOUTED by this function, and that is asserted here because
   * nothing else can assert it.
   *
   * `.badge{text-transform:uppercase}` in `READER_LAYOUT_CSS` renders the same
   * thing and proves nothing: `npm run check` never renders the document, the CSS
   * is optional, and the split this file's subject documents hands it to the host.
   * The word was `FAKTENCHECK` in the source until the lift, and if the case is
   * only a stylesheet's, the day a host styles the reader itself is the day the
   * badge quietly stops shouting.
   */
  it('shows the section as a badge, and the fact-check word when there is a verdict', () => {
    expect(buildReaderHtml(article, copy, { locale: 'de' })).toContain(
      '<p class="badge">POLITIK</p>',
    );
    const checked = buildReaderHtml({ ...article, rating: 'falsch' }, copy, { locale: 'de' });
    expect(checked).toContain('<p class="badge">FACT CHECK</p>');
    expect(checked).toContain('rating rating--refuted');
    expect(checked).toContain('<span class="rating__label">False</span>');
  });

  /**
   * A plaque needs both halves, and a host can supply one.
   *
   * `ReaderCopy.verdict` is optional because most articles have no rating, so the
   * type cannot stop a host that sets a rating and forgets the wording. What came
   * out was a red box with nothing in it — a verdict asserted and not named — and
   * it is the tone that makes it wrong: `rating--refuted` is the brand red.
   */
  it('prints no plaque at all when the host supplied no verdict for a rated article', () => {
    const html = buildReaderHtml(
      { ...article, rating: 'falsch' },
      { ...copy, verdict: undefined },
      { locale: 'de' },
    );
    expect(html).not.toContain('rating__label');
    expect(html).not.toContain('rating--refuted');
    // The badge still says what kind of article it is; only the wording is missing.
    expect(html).toContain('<p class="badge">FACT CHECK</p>');
  });

  /**
   * The support moment is a thank-you, and only that.
   *
   * It used to branch: an invitation with a `correctiv://join` button for a guest,
   * a thank-you for a member. Since the door (ADR 0016) every reader of this document
   * is a member, so the branch went with ADR 0018. The assertion that the join link
   * is gone stays, because a document that offers someone what they already pay for
   * is the failure this once shipped.
   */
  it('thanks the reader and never offers to join', () => {
    const html = buildReaderHtml(article, copy, { locale: 'de' });
    expect(html).toContain('Made possible by supporters like you.');
    expect(html).not.toContain('correctiv://join');
  });

  it('takes CSS as inline text or as a stylesheet href, so either host can style it', () => {
    expect(buildReaderHtml(article, copy, { locale: 'de', css: ['body{color:red}'] })).toContain(
      '<style>body{color:red}</style>',
    );
    expect(
      buildReaderHtml(article, copy, { locale: 'de', stylesheets: ['assets/reader/reader.css'] }),
    ).toContain('<link rel="stylesheet" href="assets/reader/reader.css">');
  });

  it('scales the root font size with the app text-size setting', () => {
    expect(buildReaderHtml(article, copy, { locale: 'de', textScale: 1 })).toContain(
      'font-size:16px',
    );
    expect(buildReaderHtml(article, copy, { locale: 'de', textScale: 1.25 })).toContain(
      'font-size:20px',
    );
  });
});

describe('decodeEntities', () => {
  it('decodes numeric entities', () => {
    expect(decodeEntities('&#8211;&#8230;&#x2014;')).toBe('–…—');
  });

  it('decodes the named entities the feeds actually use', () => {
    expect(decodeEntities('&amp;&lt;&gt;&quot;&nbsp;&ndash;&bdquo;X&ldquo;')).toBe('&<>" –„X“');
  });

  it('leaves unsupported named entities untouched — WordPress emits UTF-8, so this is by design', () => {
    // Documents a real limitation: the table is curated, not the full HTML5 set.
    // If a source ever starts emitting &uuml; this test is where it surfaces.
    expect(decodeEntities('M&uuml;nchen')).toBe('M&uuml;nchen');
  });
});

describe('stripTags', () => {
  it('removes markup and collapses whitespace', () => {
    expect(stripTags('<p>Hallo   <strong>Welt</strong></p>')).toBe('Hallo Welt');
  });
});

/**
 * The language the article document announces itself in.
 *
 * `<html lang>` is what a browser hyphenates by and what a screen reader picks a
 * voice from, so a German article announced as English is read out in an English
 * accent with no hyphenation. It was the literal `"de"` here until
 * [ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §4 gave the host a
 * locale to pass, and it had no test at all — which a cold review pointed out.
 *
 * There is no default, and that is the interesting half. `buildReaderHtml` had one
 * for a release and a cold review took it back out: a default is the constant under
 * another name, so a host that forgets the locale would silently claim German. The
 * app's own wrapper passes `useLocale()` and deliberately not `intl.locale`, which
 * `apps/mobile/src/lib/articles/reader.ts` argues where it takes the parameter.
 */
describe('the reader document names its language', () => {
  const article: Article = {
    url: 'https://correctiv.org/faktencheck/2026/06/12/x/',
    title: 'Ein Titel',
    excerpt: 'Der Lead.',
    authors: ['A. Autorin'],
    publishedAt: '2026-06-12T15:20:06.000Z',
    publishedText: '12. Juni 2026',
    readingMinutes: 5,
    bodyHtml: '<p>Text</p>',
  };
  const copy: ReaderCopy = {
    factcheckBadge: 'Fact check',
    byline: 'by A. Autorin',
    readingTime: '5 min read',
    support: 'Made possible by supporters like you.',
  };

  it('says German when the host says German', () => {
    expect(buildReaderHtml(article, copy, { locale: 'de' })).toContain('<html lang="de"');
  });

  it('says what the host asked for', () => {
    expect(buildReaderHtml(article, copy, { locale: 'en' })).toContain('<html lang="en"');
  });

  it('carries exactly one', () => {
    // A second `<html lang` would mean the shell was built twice, which is the
    // shape a careless template edit leaves behind.
    const html = buildReaderHtml(article, copy, { locale: 'en' });
    expect(html.match(/<html lang=/g) ?? []).toHaveLength(1);
  });
});
