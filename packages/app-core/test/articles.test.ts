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
import { buildReaderHtml, READER_LAYOUT_CSS, type ReaderCopy } from '../src/articles/reader-html';
import type { Article, ArticleExtractor } from '../src/articles/types';
import { decodeEntities, stripTags } from '../src/lib/html';
import { toArticle } from '../src/services/wp.service';
import { heroVideoOf } from '../src/articles/blocks';

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`./__fixtures__/articles/${name}`, import.meta.url)),
    'utf8',
  );
}

const ARTICLE = fixture('faktencheck-1.html');

/**
 * Two pages cut down from correctiv.org on 2026-09-24, every kept line byte for
 * byte; the `.url` beside each says where from. `ad-placements.html` is post 290866
 * with four Advanced Ads placements in its body. `header-post.html` is post 287636,
 * the one of 300 recent posts that opens with a `cvui/header-post` block, and it
 * also carries an infobox, an interactive list and two placements.
 */
const AD_PAGE = fixture('ad-placements.html');
const HEADER_POST_PAGE = fixture('header-post.html');

/**
 * The same blocks as the REST API delivers them, from `wp/v2/posts` the same day:
 * post 281149 (the one of 300 whose `content.rendered` carries a placement),
 * 287636 (header-post and infobox) and 285784 (an interactive list).
 */
const REST_POSTS = JSON.parse(fixture('rest-blocks.json')) as (Parameters<typeof toArticle>[0] & {
  id: number;
})[];

function restArticle(id: number) {
  const post = REST_POSTS.find((p) => p.id === id);
  if (!post) throw new Error(`no post ${id} in rest-blocks.json`);
  return toArticle(post);
}

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
 *
 * Over every captured page, not the first one alone. The second and third found a
 * disagreement the first could not: on a page that prints its date as
 * `<div class="detail__date"><time datetime>` rather than as `<time
 * class="detail__date">`, the DOM backend read the date and the string backend
 * returned none.
 */
describe.each([
  ['faktencheck-1', ARTICLE],
  ['ad-placements', AD_PAGE],
  ['header-post', HEADER_POST_PAGE],
])('the two backends agree (%s)', (_page, html) => {
  const fromString = extractArticleFromString(html);
  const fromDom = extractArticleFromDom(html);

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
    // Bar the two an embed leaves behind, which are the reader's own (ADR 0065,
    // asserted in `embeds.test.ts`).
    expect(fromDom.bodyHtml).not.toMatch(/ class="(?!embed-fallback"|reader-embed")| style="/i);
    // Not a defect in the string backend — a documented limit of regex cleanup.
    expect(fromString.bodyHtml).toMatch(/ class="/i);
  });

  /**
   * The body markup is excluded above, but which blocks each of them RECOGNISED is
   * not a question of tighter markup: an accordion one backend turns into
   * `<details>` and the other leaves as an empty heading is a title one reader
   * sees and the other does not.
   */
  it('on the accordions they turned into details, title for title', () => {
    const summaries = (body: string) =>
      [...body.matchAll(/<summary>([\s\S]*?)<\/summary>/g)].map((m) => stripTags(m[1]));
    expect(summaries(fromString.bodyHtml)).toEqual(summaries(fromDom.bodyHtml));
  });

  /**
   * Word for word, not to within a tenth. A block one backend dropped and the
   * other kept is text a reader of one host reads and a reader of the other does
   * not, and a ratio over a long page cannot see a paragraph.
   */
  it('on the text a person reads, word for word', () => {
    expect(plain(fromString.bodyHtml)).toBe(plain(fromDom.bodyHtml));
  });
});

/** What a person reads of a body: its text, entities decoded. */
const plain = (html: string) => stripTags(html);

/**
 * Blocks in a correctiv.org body that are not the article, and what the reader
 * does with each: an ad is dropped, the theme's own header is dropped and its
 * video carried out, an accordion becomes `<details>`, an infobox is shown whole.
 * Each case below was measured on the live site on 2026-09-24 and failed on the
 * code before `articles/blocks.ts`.
 */
describe.each(BACKENDS)('blocks that are not the article (%s backend)', (_name, extract) => {
  describe('an Advanced Ads placement', () => {
    const article = extract(AD_PAGE);

    it('is removed with everything inside it', () => {
      const text = plain(article.bodyHtml);
      // The four placements on this page: a petition, a related-articles box, a
      // book and the fundraiser. Their text came through as article paragraphs.
      expect(text).not.toContain('Bitte nehmen Sie sich einen Moment Zeit');
      expect(text).not.toContain('Mehr von CORRECTIV');
      expect(text).not.toContain('Europas Brandstifter');
      expect(text).not.toContain('Mutmeter');
      expect(article.bodyHtml).not.toContain('corre-');
    });

    it('and the article around it stays', () => {
      const text = plain(article.bodyHtml);
      expect(text).toContain('Die Zukunft der Ukraine entscheidet sich nicht mehr an der Front.');
      expect(text).toContain('Das Ziel: Die Menschen zu zermürben');
      expect(text).toContain('Redigatur und Faktencheck: Michael Billig');
    });

    /**
     * `corre-` is this site's setting in Advanced Ads, not the plugin's: it prints
     * the prefix as a body class, and the markers are read off that, so a changed
     * setting moves the markers with it instead of letting every ad back in.
     */
    it('is recognised by the prefix the page itself declares', () => {
      const renamed = extract(AD_PAGE.replaceAll('corre-', 'xyz9-'));
      expect(plain(renamed.bodyHtml)).not.toContain('Bitte nehmen Sie sich einen Moment Zeit');
      expect(plain(renamed.bodyHtml)).not.toContain('Mutmeter');
    });
  });

  describe('cvui/header-post inside the body', () => {
    const article = extract(HEADER_POST_PAGE);

    it('is not printed a second time under the reader’s own header', () => {
      const text = plain(article.bodyHtml);
      expect(text).not.toContain('Putins Enklave in Berlin');
      expect(text).not.toContain('Die Bundesregierung hat Russland für den Drohnen-Angriff');
      expect(article.bodyHtml).not.toMatch(/<video|<h1/i);
      expect(text.startsWith('Das Russische Haus hat Ermittler')).toBe(true);
    });

    it('hands its video out as the hero', () => {
      expect(article.heroVideoUrl).toBe(
        'https://correctiv.org/wp-content/uploads/2026/09/russisches-haus-berlin.mp4',
      );
    });
  });

  describe('cvui/interactive-list', () => {
    const article = extract(HEADER_POST_PAGE);

    it('becomes details with the item title as its summary', () => {
      expect(article.bodyHtml).toMatch(
        /<details>\s*<summary>Der Fall Sedelmayer<\/summary>[\s\S]*Der Unternehmer Franz Sedelmayer[\s\S]*<\/details>/,
      );
    });

    it('leaves no empty heading where the title was', () => {
      expect(article.bodyHtml).not.toMatch(/<h3[^>]*>\s*<\/h3>/);
    });
  });

  describe('cvui/infobox', () => {
    const article = extract(HEADER_POST_PAGE);

    it('is shown whole, first line to last, without its toggle', () => {
      const text = plain(article.bodyHtml);
      expect(text).toContain('Im Sommer 2014 präsentierte Jürgen Elsässer');
      expect(text).toContain('groß angelegten Betrugsschema Juicy Fields');
      expect(text).not.toContain('Mehr anzeigen');
      // The panel's inline style clips it to 100 px, which the theme's script lifts.
      expect(article.bodyHtml).not.toContain('max-height');
    });
  });
});

describe('blocks that are not the article (REST API)', () => {
  it('drops the placement in the one post whose content.rendered carries one', () => {
    const article = restArticle(281149);
    expect(article.bodyHtml).not.toMatch(/corre-|ad-container/);
    expect(plain(article.bodyHtml)).toContain('Update, 4. August 2026');
  });

  it('drops cvui/header-post and hands its video out as the hero', () => {
    const article = restArticle(287636);
    expect(article.bodyHtml).not.toMatch(/<video|<h1|<header/i);
    expect(plain(article.bodyHtml)).not.toContain('Die Bundesregierung hat Russland');
    expect(plain(article.bodyHtml)).toContain('Das Russische Haus hat Ermittler');
    expect(article.heroVideoUrl).toBe(
      'https://correctiv.org/wp-content/uploads/2026/09/russisches-haus-berlin.mp4',
    );
  });

  it('shows the infobox whole, without its toggle or the style that clips it', () => {
    const article = restArticle(287636);
    expect(plain(article.bodyHtml)).toContain('groß angelegten Betrugsschema Juicy Fields');
    expect(plain(article.bodyHtml)).not.toContain('Mehr anzeigen');
    expect(article.bodyHtml).not.toContain('max-height');
  });

  it('turns an interactive list into details with the title as summary', () => {
    const article = restArticle(285784);
    expect(article.bodyHtml).toMatch(
      /<details>\s*<summary>Was ist Niedrigwasser\?<\/summary>[\s\S]*Von Niedrigwasser spricht man[\s\S]*<\/details>/,
    );
    expect(article.bodyHtml).not.toMatch(/<h3[^>]*>\s*<\/h3>/);
  });

  it('carries no hero video on a post without a header-post block', () => {
    expect(restArticle(285784).heroVideoUrl).toBeUndefined();
  });
});

/**
 * One body through all three paths: the REST API's, and a page around it for each
 * extractor. What comes out is the text a person reads.
 */
function throughEveryPath(body: string): [string, string][] {
  const page = `<html><body class="single aa-prefix-corre-"><div class="entry-content detail__content">${body}</div></body></html>`;
  return [
    ['rest', toArticle({ content: { rendered: body } }).bodyHtml],
    ['string', extractArticleFromString(page).bodyHtml],
    ['dom', extractArticleFromDom(page).bodyHtml],
  ];
}

/**
 * Markup the balancing has to read as a browser would. Found by a cold review of
 * this branch on 2026-09-24; every case here failed on its first version.
 */
describe('finding where a block ends', () => {
  /**
   * A `<div` that is not a tag: inside a script, a style, a comment or a quoted
   * attribute value. Counted as one, it held the placement open past its end and
   * the REST path cut the paragraph after the ad along with it.
   */
  it('does not count a div inside a script, a style, a comment or an attribute', () => {
    const body =
      '<div class="wp-block-group"><p>A1</p><div class="corre-entity-placement">' +
      `<script>var s='<div>'</script><style>.x::before{content:"<div>"}</style>` +
      '<!-- <div> --><span title="<div>">AD</span></div><p>KEPT</p></div><p>A3</p>';
    for (const [path, html] of throughEveryPath(body)) {
      expect([path, plain(html)]).toEqual([path, 'A1 KEPT A3']);
    }
  });

  it('closes an element on </div > as well as on </div>', () => {
    const body = '<p>A1</p><div class="corre-entity-placement"><p>AD</p></div ><p>A2</p>';
    for (const [path, html] of throughEveryPath(body)) {
      expect([path, plain(html)]).toEqual([path, 'A1 A2']);
    }
  });

  it('does not take <divider> for a <div>', () => {
    const body =
      '<p>A1</p><div class="corre-entity-placement"><divider></divider><p>AD</p></div><p>A2</p>';
    expect(plain(throughEveryPath(body)[0][1])).toBe('A1 A2');
  });

  /**
   * One placement whose end cannot be found must not let the next one through.
   * It used to end the search: `null` meant both "no more" and "cannot balance".
   */
  it('goes on past a placement it cannot balance', () => {
    const body =
      '<p>A1</p><div class="corre-entity-placement"><p>AD1</p>' +
      '<div class="corre-entity-placement"><p>AD2</p></div><p>A3</p>';
    const [, rest] = throughEveryPath(body)[0];
    expect(plain(rest)).not.toContain('AD2');
    expect(plain(rest)).toContain('A3');
  });

  /** The cheap divergences between a regex and a parser, closed. */
  it('recognises an unquoted class and a quoted > before it', () => {
    const body =
      '<p>A1</p><div class=corre-entity-placement><p>AD1</p></div>' +
      '<div data-x="a>b" class="corre-entity-placement"><p>AD2</p></div><p>A2</p>';
    for (const [path, html] of throughEveryPath(body)) {
      expect([path, plain(html)]).toEqual([path, 'A1 A2']);
    }
  });

  /**
   * Linear, not quadratic. The marker was a lookahead that rescanned to the next
   * `>` from every `<`: 13.6 s for the first of these and 26.5 s for the second on
   * the reviewer's machine. The bound is generous on purpose; what it catches is
   * seconds.
   */
  it('reads hostile markup in linear time', () => {
    for (const body of ['<p x'.repeat(30000), '<a class="x '.repeat(20000)]) {
      const started = performance.now();
      toArticle({ content: { rendered: body } });
      heroVideoOf(body);
      expect(performance.now() - started).toBeLessThan(1000);
    }
  });
});

describe('the fallback rules', () => {
  /**
   * An accordion item without a panel is not rebuilt, and its toggle is unwrapped
   * so the title stays the heading's text instead of leaving an empty `<h3>`.
   */
  it('keeps a toggle’s title as heading text when its item has no panel', () => {
    const body =
      '<div data-cvui-interactive-list-item><h3><button data-cvui-interactive-list-toggle>' +
      '<span>Methodik</span><svg><path d="M0"></path></svg></button></h3></div><p>A1</p>';
    for (const [path, html] of throughEveryPath(body)) {
      expect([path, html]).toEqual([path, expect.stringMatching(/<h3>\s*(<span>)?Methodik/)]);
    }
  });
});

describe('the hero video address', () => {
  const header = (src: string) =>
    `<header class="wp-block-cvui-header-post"><video autoplay muted src="${src}"></video></header><p>A1</p>`;

  it('is refused unless it is http or https', () => {
    expect(heroVideoOf(header('javascript:alert(1)'))).toBeUndefined();
    expect(heroVideoOf(header('&#106;avascript:alert(1)'))).toBeUndefined();
    expect(heroVideoOf(header('data:video/mp4;base64,AAAA'))).toBeUndefined();
  });

  it('is resolved against correctiv.org when it is relative', () => {
    expect(heroVideoOf(header('/wp-content/uploads/a.mp4'))).toBe(
      'https://correctiv.org/wp-content/uploads/a.mp4',
    );
  });
});

/**
 * The byline the block carries is the whole one. REST's `yoast_head_json.author`
 * names one author, and the reader printed "von Silvia Stöber" over an article by
 * two people.
 */
describe('the authors cvui/header-post names', () => {
  it('are preferred over the single name the REST API gives', () => {
    const post = REST_POSTS.find((p) => p.id === 287636);
    const article = toArticle({ ...post, yoast_head_json: { author: 'Silvia Stöber' } });
    expect(article.authors).toEqual(['Alexej Hock', 'Silvia Stöber']);
  });

  it.each(BACKENDS)('are the byline on the page, for the %s backend', (_name, extract) => {
    expect(extract(HEADER_POST_PAGE).authors).toEqual(['Alexej Hock', 'Silvia Stöber']);
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
    embedFallback: (host) => `Open content from ${host} in the browser`,
    embedArticle: 'Read the embedded article',
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

  it('sets the root font size from the app text scale, the one every screen takes', () => {
    expect(buildReaderHtml(article, copy, { locale: 'de', textScale: 1 })).toContain(
      'font-size:16px',
    );
    expect(buildReaderHtml(article, copy, { locale: 'de', textScale: 1.25 })).toContain(
      'font-size:20px',
    );
  });

  describe('a hero video', () => {
    const video = 'https://correctiv.org/wp-content/uploads/2026/09/haus.mp4';
    const html = buildReaderHtml({ ...article, heroVideoUrl: video }, copy, { locale: 'de' });
    const tag = /<video\b[^>]*>/.exec(html)?.[0] ?? '';

    /**
     * What correctiv.org's own block does with the same file: a picture that
     * moves, with no sound and nothing to press. Every one of these attributes is
     * load-bearing on a phone — WebKit plays nothing inline that is not both
     * `muted` and `playsinline`.
     */
    it('plays muted, looping and inline, on its own, with no controls', () => {
      expect(tag).toMatch(/\bautoplay\b/);
      expect(tag).toMatch(/\bmuted\b/);
      expect(tag).toMatch(/\bloop\b/);
      expect(tag).toMatch(/\bplaysinline\b/);
      expect(tag).not.toMatch(/\bcontrols\b/);
      expect(html).toContain(`src="${video}"`);
    });

    /**
     * Leaving out `controls` is not enough everywhere. A document that may not run
     * scripts gets them anyway, and the web target's frame is one (see `heroHtml`).
     */
    it('hides the controls a scriptless frame forces on it', () => {
      expect(READER_LAYOUT_CSS).toContain(
        '.hero video::-webkit-media-controls{display:none!important}',
      );
    });

    it('shows the hero image until it plays', () => {
      expect(tag).toContain('poster="https://correctiv.org/hero.jpg"');
    });

    /**
     * The still image instead of the loop when the reader asked the system for
     * less motion. CSS rather than a script, because the reader document carries
     * none and the web target's frame could not run one.
     */
    it('gives way to the still image under reduced motion', () => {
      expect(html).toContain('<img src="https://correctiv.org/hero.jpg" alt="">');
      expect(READER_LAYOUT_CSS).toMatch(
        /@media \(prefers-reduced-motion: ?reduce\)\{[^{}]*\.hero--video video\{display:none\}/,
      );
      expect(READER_LAYOUT_CSS).toMatch(/\.hero--video img\{display:none\}/);
    });

    it('fills the hero the way the image does', () => {
      expect(READER_LAYOUT_CSS).toMatch(/\.hero img,\s*\.hero video\{[^}]*object-fit:cover/);
    });

    it('and an accordion out of the body is styled as one', () => {
      expect(READER_LAYOUT_CSS).toMatch(/\.reader-body details\{/);
      expect(READER_LAYOUT_CSS).toMatch(/\.reader-body summary\{/);
    });

    it('is left out on an article without one', () => {
      expect(buildReaderHtml(article, copy, { locale: 'de' })).not.toContain('<video');
    });

    it('escapes its address like every other value it prints', () => {
      const hostile = buildReaderHtml(
        { ...article, heroVideoUrl: 'https://x/a.mp4"><script>' },
        copy,
        { locale: 'de' },
      );
      expect(hostile).not.toContain('<script>');
    });
  });

  it('sets no text in the layout in px, so all of it follows that root', () => {
    // The host pins Android's WebView to a text zoom of 100 (ADR 0033), so a size in
    // px would stay put while the rest of the article grew. The badge and the verdict
    // were 11px and 13px until a review caught it.
    expect(READER_LAYOUT_CSS.match(/font-size:\s*[\d.]+px/g) ?? []).toEqual([]);
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
    embedFallback: (host) => `Open content from ${host} in the browser`,
    embedArticle: 'Read the embedded article',
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
