import { coreMessage, type CoreMessage } from '../i18n/messages';
import type { FactcheckRating } from './types';

/**
 * The fact-check vocabulary — one label set, one colour logic, two ways in.
 *
 * A correctiv.org fact check states its verdict twice: as an image path
 * (`/rating/mostly-false.svg`) and as German prose next to it ("Größtenteils
 * falsch · Über diese Bewertung"). Two earlier readers each took one of them and
 * built their own vocabulary around it, English slugs against German slugs, so the
 * same article could be styled by one and unstyled by the other.
 *
 * Both readings now land on the same union.
 */

/**
 * How each verdict is spoken, as descriptors rather than as German.
 *
 * The keys are the slugs CORRECTIV publishes and stay German, because they are
 * identifiers and not words — `groesstenteils-falsch` is what the API says. The
 * ids are English for the same reason the `defaultMessage` is: an id is read by
 * whoever fills a catalogue, and a German id in an English file is a spelling
 * nobody can guess.
 *
 * `ratingLabel()` used to return the German straight out of here, which is what
 * put a rendered verdict inside `buildReaderHtml` and inside `data/claims.ts`.
 * Both take the formatted label from their host now.
 */
export const RATING_LABELS: Record<FactcheckRating, CoreMessage> = {
  falsch: coreMessage({ id: 'core.rating.false', defaultMessage: 'False' }),
  'groesstenteils-falsch': coreMessage({
    id: 'core.rating.mostlyFalse',
    defaultMessage: 'Mostly false',
  }),
  'teilweise-falsch': coreMessage({
    id: 'core.rating.partlyFalse',
    defaultMessage: 'Partly false',
  }),
  'fehlender-kontext': coreMessage({
    id: 'core.rating.missingContext',
    defaultMessage: 'Missing context',
  }),
  unbelegt: coreMessage({ id: 'core.rating.unproven', defaultMessage: 'Unproven' }),
  irrefuehrend: coreMessage({ id: 'core.rating.misleading', defaultMessage: 'Misleading' }),
  manipuliert: coreMessage({ id: 'core.rating.manipulated', defaultMessage: 'Manipulated' }),
  satire: coreMessage({ id: 'core.rating.satire', defaultMessage: 'Satire' }),
  'groesstenteils-richtig': coreMessage({
    id: 'core.rating.mostlyTrue',
    defaultMessage: 'Mostly true',
  }),
  richtig: coreMessage({ id: 'core.rating.true', defaultMessage: 'True' }),
};

/**
 * How a verdict reads at a glance. Three tones rather than nine colours, because
 * a plaque has to be legible before it is read: refuted, qualified, confirmed.
 */
export type RatingTone = 'refuted' | 'qualified' | 'confirmed';

const TONES: Record<FactcheckRating, RatingTone> = {
  falsch: 'refuted',
  'groesstenteils-falsch': 'refuted',
  manipuliert: 'refuted',
  // Qualified, not refuted: "teilweise falsch" says part of the claim holds.
  'teilweise-falsch': 'qualified',
  'fehlender-kontext': 'qualified',
  unbelegt: 'qualified',
  irrefuehrend: 'qualified',
  satire: 'qualified',
  'groesstenteils-richtig': 'confirmed',
  richtig: 'confirmed',
};

/**
 * The slugs CORRECTIV publishes a verdict under.
 *
 * One map, two readers. The theme names the rating image
 * `/rating/<slug>.svg`, and the REST API carries the same token in
 * `acf["post::interpretation"].value`. Verified equal on every sampled article,
 * which is why `ratingFromInterpretation` is a rename and not a second table.
 *
 * Three of these were missing until 2026-09-01, and each one cost a plaque or,
 * worse, printed the wrong one:
 * - `partly-false` (5 of 200 sampled fact checks) fell through to the prose
 *   matcher and came out as "Falsch", a harder verdict than the one published.
 * - `faktenforum-false` (9) and `faktenforum-misleading` (6) are the
 *   Faktenforum-branded variants of two existing verdicts. They matched nothing
 *   and the plaque was simply absent.
 *
 * Twenty of two hundred between them, a tenth.
 */
const FROM_SVG_SLUG: Record<string, FactcheckRating> = {
  false: 'falsch',
  'faktenforum-false': 'falsch',
  'mostly-false': 'groesstenteils-falsch',
  'partly-false': 'teilweise-falsch',
  'missing-context': 'fehlender-kontext',
  unproven: 'unbelegt',
  misleading: 'irrefuehrend',
  'faktenforum-misleading': 'irrefuehrend',
  manipulated: 'manipuliert',
  satire: 'satire',
  'mostly-true': 'groesstenteils-richtig',
  true: 'richtig',
};

/**
 * German prose → verdict. Order matters: "größtenteils falsch" has to be tested
 * before the bare "falsch" it contains, or every qualified verdict collapses into
 * its absolute.
 */
const FROM_TEXT: { test: RegExp; value: FactcheckRating }[] = [
  { test: /gr(ö|oe)(ß|ss)tenteils falsch/i, value: 'groesstenteils-falsch' },
  { test: /gr(ö|oe)(ß|ss)tenteils richtig/i, value: 'groesstenteils-richtig' },
  // The case the ordering rule above was written for, and the one it missed.
  { test: /teilweise falsch/i, value: 'teilweise-falsch' },
  { test: /fehlender kontext/i, value: 'fehlender-kontext' },
  { test: /irref(ü|ue)hrend/i, value: 'irrefuehrend' },
  { test: /manipuliert/i, value: 'manipuliert' },
  { test: /unbelegt|unbewiesen/i, value: 'unbelegt' },
  { test: /\bsatire\b/i, value: 'satire' },
  { test: /\bfalsch\b/i, value: 'falsch' },
  { test: /\brichtig\b/i, value: 'richtig' },
];

/** `…/rating/mostly-false.svg` → `groesstenteils-falsch`. Underscores tolerated. */
export function ratingFromSvgSlug(slug: string | null | undefined): FactcheckRating | undefined {
  if (!slug) return undefined;
  return FROM_SVG_SLUG[slug.toLowerCase().replace(/_/g, '-')];
}

/**
 * The verdict as the REST API states it, from `acf["post::interpretation"]`.
 *
 * Reads the same closed set as the image path, so an article fetched through the
 * API and the same article scraped from HTML cannot disagree about its verdict.
 * The field is already public on correctiv.org — no CMS change was needed, which
 * took a measurement to find out: it is in `acf`, not in WordPress's `meta`.
 */
export function ratingFromInterpretation(
  value: string | null | undefined,
): FactcheckRating | undefined {
  return ratingFromSvgSlug(value);
}

const SVG_PATH = /\/rating\/([a-z0-9_-]+)\.svg/i;

/**
 * The verdict as the page's rating image states it.
 *
 * The primary signal for both extraction backends, and the reason they agree:
 * the image path is a closed set, whereas the prose beside it is editorial text
 * that has to be pattern-matched. Both read the raw markup here, so neither can
 * end up with a verdict the other misses.
 */
export function ratingFromPage(html: string): FactcheckRating | undefined {
  return ratingFromSvgSlug(SVG_PATH.exec(html)?.[1]);
}

/** "Größtenteils falsch · Über diese Bewertung" → `groesstenteils-falsch`. */
export function ratingFromText(text: string | null | undefined): FactcheckRating | undefined {
  if (!text) return undefined;
  return FROM_TEXT.find((r) => r.test.test(text))?.value;
}

export function ratingTone(rating: FactcheckRating): RatingTone {
  return TONES[rating];
}

/** Every known verdict — for tests and for rendering a legend. */
export const FACTCHECK_RATINGS = Object.keys(RATING_LABELS) as FactcheckRating[];
