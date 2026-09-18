/**
 * The article model. One of them.
 *
 * There were two: the core's `ArticleDetail` (`topline`, `headline`, `dateText`,
 * `authors` as one string) and the Expo app's `Article` (`kicker`, `title`,
 * `publishedAt`, `authors` as an array). Same pages, same fields, cut
 * differently — which meant two extractors, two reader builders and two rating
 * vocabularies downstream of the difference.
 *
 * This is the merge. Where the two disagreed, the shape that survives is the one
 * that carries more information: an ISO date rather than a printed one (with the
 * printed one kept alongside, because it needs no locale), an author array rather
 * than a string, and a rating that is a closed union rather than any string.
 */

/**
 * A CORRECTIV fact-check verdict, in the vocabulary the site itself publishes.
 *
 * German slugs, not English ones, for two reasons: `data/claims.ts` already used
 * them, and the page exposes the verdict twice — as `/rating/<english-slug>.svg`
 * and as German prose — so one of the two has to be translated either way.
 * `rating.ts` does that translation in one place.
 */
export type FactcheckRating =
  | 'falsch'
  | 'groesstenteils-falsch'
  /**
   * "Teilweise falsch", weaker than `groesstenteils-falsch` and a verdict of its
   * own. It was missing here, and the gap was not cosmetic: the prose matcher
   * fell through to the bare /\bfalsch\b/ it contains, so the reader printed
   * "Falsch" over an article CORRECTIV had rated "Teilweise falsch" — an app
   * about fact checks overstating a verdict. Measured 2026-09-01: 5 of 200
   * sampled fact checks carry it. See `rating.ts`.
   */
  | 'teilweise-falsch'
  | 'fehlender-kontext'
  | 'unbelegt'
  | 'irrefuehrend'
  | 'manipuliert'
  | 'satire'
  | 'groesstenteils-richtig'
  | 'richtig';

/** A fully extracted article, ready for the reader. */
export interface Article {
  url: string;
  title: string;
  /** Section or kicker above the headline — "Klima", "Faktencheck". */
  kicker?: string;
  /** The lead paragraph. */
  excerpt?: string;
  authors: string[];
  /** ISO-8601. Empty when the page carried no parsable date. */
  publishedAt: string;
  /**
   * The date as the page printed it ("04. August 2026") — the fallback for a page
   * that carried no parsable date. Where `publishedAt` has one, screens format it
   * themselves with `formatDate`, so every date in the app reads the same.
   */
  publishedText?: string;
  readingMinutes: number;
  heroImageUrl?: string;
  /** Sanitised article HTML for the reader. */
  bodyHtml: string;
  rating?: FactcheckRating;
  /** true when this came from bundled offline content rather than the network. */
  offline?: boolean;
}

/**
 * What an extraction backend produces: everything in `Article` that the page
 * itself can answer. The url and any caller-supplied kicker are added by
 * `load.ts`, which is why they are absent here.
 */
export type ExtractedArticle = Omit<Article, 'url' | 'offline'>;

/**
 * An HTML-to-article extractor.
 *
 * Two implementations ship with the core and this type is what keeps them
 * interchangeable:
 *
 * - `extract/string.ts` — regular expressions over the raw markup. No
 *   dependencies, so it runs anywhere: a plain Node script, a bundler that trips
 *   over CommonJS-only parser packages, a runtime with no DOM. It is the default.
 * - `extract/dom.ts` — htmlparser2 + css-select. Sanitises the body with a tag
 *   allowlist rather than a denylist, which is measurably better markup for the
 *   reader, at the cost of four dependencies.
 *
 * A host picks one; `test/articles.test.ts` runs both over the same captured
 * pages and asserts they agree, so the choice cannot quietly become a
 * behavioural fork.
 */
export type ArticleExtractor = (html: string) => ExtractedArticle;
