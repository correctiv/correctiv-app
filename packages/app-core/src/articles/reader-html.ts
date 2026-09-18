import { escapeHtml } from '../lib/html';
import { formatDateDe } from '../lib/format';
import { coreMessage } from '../i18n/messages';
import { ratingTone } from './rating';
import type { Locale } from '../stores/settings';
import type { Article } from './types';

/**
 * The reader document — one builder, whatever the host.
 *
 * There were two, once: a `template.html` with `{{placeholders}}` and a template
 * literal in the app. Same article, same German copy, two sets of class names, two
 * rating vocabularies and two chances to get the support footer wrong.
 *
 * What is shared is the part a reader would notice: the structure, the class names,
 * the wording and which verdict gets which tone. What stays with the host is the
 * CSS — and that is a real split, not a leftover: how fonts reach a WebView is a
 * platform question (base64 in a `<style>` here, a bundled `.ttf` behind a `file://`
 * base url elsewhere), and the answer belongs next to the platform.
 *
 * The class vocabulary below is the contract, and `READER_LAYOUT_CSS` implements it
 * for a host that has no stylesheet of its own. Every colour in it comes from a
 * `--var-color-*` variable, which is what lets a host switch the whole document to
 * dark by redefining them.
 */

/**
 * Every word this document prints that is not the article's own, formatted.
 *
 * Handed IN rather than fetched here, and that is the whole difference between
 * this file and a screen. The document goes into a WebView as a string: there is
 * no React tree, no provider and no `useIntl()` to reach for, so the core names
 * the words it needs (`READER_COPY` below) and the host arrives with them already
 * turned into text.
 *
 * `verdict` is absent on an article with no rating, which is most of them, and
 * `byline` on one with no named author. Both are then simply not printed, exactly
 * as before.
 */
export interface ReaderCopy {
  /** The plaque a fact check wears instead of its section. */
  factcheckBadge: string;
  /**
   * The verdict, spelled out — `RATING_LABELS` is where the wording comes from.
   *
   * Optional because most articles have no rating, and a host that has one has to
   * supply it. It cannot be made required without making every unrated article
   * format a verdict it does not have, and it cannot be tied to `article.rating`
   * in the type, so the guarantee is made where it is enforceable: an empty one
   * prints NO plaque rather than an empty one. The closed-union argument
   * `AUDIO_ERROR_LABELS` makes does not reach here — that one fails to compile
   * because the Record must be total, and this is one field on a bag of words.
   * A red box with no word in it asserts a verdict and names none, which is worse
   * than an article that shows no verdict at all.
   */
  verdict?: string;
  /** The authors with their preposition, as one phrase. */
  byline?: string;
  /** How long the article takes to read. */
  readingTime: string;
  /** The line in the footer, which is the only thing the document says in its own voice. */
  support: string;
}

/**
 * What the host has to format, as message descriptors.
 *
 * These live in the core because the document does: a second host rendering the
 * same reader must not have to invent a support line, and two hosts inventing two
 * is the drift this file was written to end. `byline` and `readingTime` take a
 * value, which is why they are messages and not constants — "von X" and "7 Min.
 * Lesezeit" are one sentence each in German and two different shapes in English.
 */
export const READER_COPY = {
  factcheckBadge: coreMessage({
    id: 'core.reader.factcheckBadge',
    defaultMessage: 'Fact check',
    description:
      "The badge on a fact check inside the article document. Uppercased by the code that builds the document, so write it in normal case. home.factCheckBadge is the same word on the home screen's rail.",
  }),
  byline: coreMessage({
    id: 'core.reader.byline',
    defaultMessage: 'by {authors}',
    description:
      'The byline in the article document the reader renders. {authors} is the list of authors, already joined.',
  }),
  readingTime: coreMessage({
    id: 'core.reader.readingTime',
    defaultMessage: '{minutes} min read',
    description:
      'Part of the meta line in the article document, after the byline and the date and joined to them with ‘ · ’. {minutes} is a whole number of minutes. There is no plural here, unlike `article.readingTime` in the feed; say so if your language needs one.',
  }),
  support: coreMessage({
    id: 'core.reader.support',
    defaultMessage: 'Made possible by supporters like you. Thank you for being here.',
  }),
};

export interface ReaderHtmlOptions {
  /** Inline CSS, in order — token variables and `@font-face` first, layout last. */
  css?: string[];
  /** Stylesheet hrefs, resolved against the WebView's base url. */
  stylesheets?: string[];
  /** The app's text-size setting; scales the root font size. 1 = default. */
  textScale?: number;
  /**
   * What goes in `<html lang>`, which is not decoration.
   *
   * A browser hyphenates and a screen reader chooses a voice by this attribute, so
   * a German article announced as English is read out in an English accent with no
   * hyphenation. It was the literal `"de"` here until
   * [ADR 0049](../../../../adr/0049-the-catalogue-is-a-package.md) §4 gave the host
   * a locale to pass; the default keeps every caller that has not been told about
   * it rendering exactly what it rendered before.
   *
   * It is the LOCALE and not the article's own language, which this document does
   * not know: the words around the article are the app's, and the app is in one
   * language at a time. The day an English app shows a German article, that is a
   * `lang` on the body rather than a second argument here.
   */
  locale?: Locale;
}

const ROOT_FONT_PX = 16;

export function buildReaderHtml(
  article: Article,
  copy: ReaderCopy,
  options: ReaderHtmlOptions = {},
): string {
  const { css = [], stylesheets = [], textScale = 1, locale = 'de' } = options;

  const rootStyle = `font-size:${ROOT_FONT_PX * textScale}px`;
  const links = stylesheets
    .map((href) => `<link rel="stylesheet" href="${escapeHtml(href)}">`)
    .join('');
  const styles = css.length > 0 ? `<style>${css.join('\n')}</style>` : '';

  const hero = article.heroImageUrl
    ? `<figure class="hero"><img src="${escapeHtml(article.heroImageUrl)}" alt=""></figure>`
    : '';

  /**
   * A fact check announces itself; everything else shows its section.
   *
   * Uppercased HERE, and that is the correctness of the string rather than of the
   * stylesheet. `.badge{text-transform:uppercase}` in `READER_LAYOUT_CSS` says the
   * same thing and is not the guarantee: `css` is optional and the split this file
   * documents is that the CSS belongs to the HOST, so a host with a stylesheet of
   * its own — or one that appends ours anywhere but last — renders "Faktencheck"
   * in title case with nothing failing anywhere. The kicker was already uppercased
   * in JavaScript on the same line, so the one branch that read differently was
   * the one only a rendered document could show. The CSS rule stays, because it is
   * what makes a host's OWN badge text agree with this one.
   */
  const badgeText = (article.rating ? copy.factcheckBadge : (article.kicker ?? '')).toUpperCase();
  const badge = badgeText ? `<p class="badge">${escapeHtml(badgeText)}</p>` : '';

  // Both halves, or neither: a plaque with no word in it is a coloured box
  // asserting a verdict it does not name. See `ReaderCopy.verdict`.
  const rating =
    article.rating && copy.verdict
      ? `<div class="rating rating--${ratingTone(article.rating)}">` +
        `<span class="rating__label">${escapeHtml(copy.verdict)}</span></div>`
      : '';

  // The app's own date format wins over the publisher's wording: correctiv.org prints
  // "04. August 2026" where every list in the app reads "4. August 2026", and the
  // reader is the one screen a date row appears in twice. `publishedText` stays as the
  // fallback for a page with no parsable date — `formatDateDe` returns '' for one.
  const metaLine = [
    article.authors.length > 0 ? copy.byline : '',
    formatDateDe(article.publishedAt) || article.publishedText,
    copy.readingTime,
  ]
    .filter(Boolean)
    .join(' · ');

  const excerpt = article.excerpt ? `<p class="excerpt">${escapeHtml(article.excerpt)}</p>` : '';

  /**
   * One footer, not two.
   *
   * There used to be a second one for a non-member, with a `correctiv://join` button.
   * Since the door (ADR 0016) every reader of this document has a membership that
   * includes the app, so that branch addressed nobody and the button offered them
   * what they already had. Removed with ADR 0018.
   */
  const footer = `<p class="support-line">${escapeHtml(copy.support)}</p>`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}" style="${rootStyle}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
${links}${styles}
</head>
<body>
<article>
${hero}
<header class="reader-header">
${badge}
<h1>${escapeHtml(article.title)}</h1>
${rating}
<p class="meta">${escapeHtml(metaLine)}</p>
</header>
${excerpt}
<div class="reader-body">${article.bodyHtml}</div>
<footer class="reader-footer">
${footer}
</footer>
</article>
</body>
</html>`;
}

/**
 * The reader's layout, written against the generated `--var-*` design tokens.
 *
 * For hosts that ship no reader stylesheet of their own. Every value comes from a
 * token rather than a transcribed number. The hand-written stylesheet this
 * replaced was derived from the same tokens once, then drifted from them one
 * rounded rem at a time.
 *
 * There are no colour literals left here. There used to be three `#fff`s — on the
 * badge and on two of the `.rating--*` tones — on the grounds that the tokens carried
 * no semantic colour for a "verdict", and the tiers ended that. All three were a label
 * on the brand red, which is the primitive `white`; the label on club yellow is
 * `neutral-700`. Both say "does not follow the scheme" in the token itself, which is
 * what a literal was standing in for.
 * (ADR 0022. The `.rating` background is the one colour still on a v1 alias, because
 * `grey-300` as a FILL has no successor.)
 */
export const READER_LAYOUT_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{background:var(--var-color-canvas);color:var(--var-color-on-canvas);
  font-family:'Merriweather',Georgia,serif}
article{max-width:38.75rem;margin:0 auto;padding-bottom:var(--var-spacing-3xl)}
.hero{display:block;margin:0 0 var(--var-spacing-m)}
.hero img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;
  background:var(--var-color-surface)}
.reader-header{padding:0 var(--var-spacing-m)}
.badge{display:inline-block;font-family:'SourceSans3',sans-serif;font-weight:700;font-size:11px;
  letter-spacing:.4px;text-transform:uppercase;color:var(--var-color-white);
  background:var(--var-color-accent);
  padding:3px 8px;border-radius:var(--var-radius-s);margin-bottom:var(--var-spacing-xs)}
h1{font-family:'Merriweather',Georgia,serif;font-weight:700;font-size:var(--var-font-size-headline-xl);
  line-height:var(--var-leading-tight);letter-spacing:var(--var-letter-spacing-tighter);
  margin-bottom:var(--var-spacing-s)}
.rating{display:inline-block;font-family:'SourceSans3',sans-serif;font-weight:700;font-size:13px;
  letter-spacing:.3px;text-transform:uppercase;padding:6px 12px;border-radius:var(--var-radius-md);
  margin-bottom:var(--var-spacing-s);background:var(--var-color-grey-300);
  color:var(--var-color-on-canvas)}
.rating--refuted{background:var(--var-color-accent);color:var(--var-color-white)}
.rating--qualified{background:var(--var-color-accent-alternative);
  color:var(--var-color-neutral-700)}
/* A foreground token as a FILL, deliberately: the plaque is a foreground element on
   the canvas, which is what the -on- prefix names. Same shape as bg-on-surface on the
   callout bar in the app. Values are unchanged from grey-600; the white-on-#a8a8a8
   contrast in dark mode is 2.38:1 and predates the tiers, so it is a design question
   and not a migration one. */
.rating--confirmed{background:var(--var-color-on-canvas-muted);color:var(--var-color-white)}
.meta{font-family:'SourceSans3',sans-serif;font-size:var(--var-font-size-text-s);
  color:var(--var-color-on-canvas-muted);margin-bottom:var(--var-spacing-m);
  padding-bottom:var(--var-spacing-m);border-bottom:1px solid var(--var-color-stroke)}
.excerpt{font-family:'Merriweather',Georgia,serif;font-style:italic;
  color:var(--var-color-on-canvas-muted);
  font-size:var(--var-font-size-text-l);line-height:var(--var-leading-relaxed);
  padding:0 var(--var-spacing-m) var(--var-spacing-m)}
.reader-body{padding:0 var(--var-spacing-m);font-size:var(--var-font-size-text-article);
  line-height:var(--var-leading-looser);letter-spacing:var(--var-letter-spacing-wider)}
.reader-body p{margin-bottom:var(--var-spacing-m)}
.reader-body h2{font-family:'SourceSans3',sans-serif;font-weight:700;
  font-size:var(--var-font-size-headline-m);line-height:var(--var-leading-snug);letter-spacing:0;
  margin:var(--var-spacing-l) 0 var(--var-spacing-xs)}
.reader-body h3{font-family:'SourceSans3',sans-serif;font-weight:700;
  font-size:var(--var-font-size-headline-s);margin:var(--var-spacing-m) 0 var(--var-spacing-2xs)}
.reader-body a{color:var(--var-color-on-canvas-accent);text-decoration:none}
.reader-body img{max-width:100%;height:auto;border-radius:var(--var-radius-md);
  margin:var(--var-spacing-xs) 0}
.reader-body figure{margin:var(--var-spacing-m) 0}
.reader-body figcaption{font-family:'SourceSans3',sans-serif;
  font-size:var(--var-font-size-text-s);color:var(--var-color-on-canvas-muted);
  margin-top:var(--var-spacing-2xs)}
.reader-body ul,.reader-body ol{margin:0 0 var(--var-spacing-m) var(--var-spacing-m)}
.reader-body li{margin-bottom:var(--var-spacing-2xs)}
.reader-body blockquote{border-left:3px solid var(--var-color-accent);
  padding-left:var(--var-spacing-s);margin:var(--var-spacing-m) 0;
  color:var(--var-color-on-canvas-muted)}
.reader-footer{margin:var(--var-spacing-xl) var(--var-spacing-m) 0;
  background:var(--var-color-surface);border-radius:var(--var-radius-md);
  padding:var(--var-spacing-l);text-align:center}
.support-line{font-family:'Merriweather',Georgia,serif;color:var(--var-color-on-canvas);
  font-size:var(--var-font-size-text-m);line-height:var(--var-leading-loose);
  margin-bottom:var(--var-spacing-s)}
`;
