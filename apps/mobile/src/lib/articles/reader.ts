import type { IntlShape } from 'react-intl';

import { RATING_LABELS } from '@correctiv/app-core/articles/rating';
import {
  buildReaderHtml,
  READER_COPY,
  READER_LAYOUT_CSS,
  type ReaderCopy,
  type ReaderHtmlOptions,
} from '@correctiv/app-core/articles/reader-html';
import type { Article } from '@correctiv/app-core/articles/types';
import { READER_DARK_CSS, THEME_CSS } from '@correctiv/design-tokens/reader.generated';

import { READER_FONTS_CSS } from '@/lib/theme/readerFonts.generated';

/**
 * The reader document, styled the Expo way.
 *
 * The document itself, meaning structure, class names, which words it prints and
 * the verdict plaque, comes from the core, so any host renders the same one. What
 * this file adds is the CSS, which arrives **inline** with the fonts
 * base64-embedded. This app has no app folder a WebView could resolve a `file://`
 * stylesheet against, and the same string has to work inside an `<iframe srcDoc>`
 * on the web target.
 *
 * Order matters: token variables and `@font-face` first, layout last, so the
 * layout can reference the variables.
 *
 * Dark mode costs one appended variable block, because the core's layout CSS takes
 * every colour from `--var-color-*`. The alternative — a second stylesheet for the
 * dark reader — would be a second place to forget. The WebView is not asked what
 * the device thinks: the app's appearance setting decides, exactly as it does for
 * the screens around it, so a light app never opens a dark article.
 *
 * The words are the other half this file supplies, for the reason the core's
 * `ReaderCopy` gives: the document is a string handed to a WebView, so nothing
 * inside it can reach a provider. `intl` is a parameter rather than a hook because
 * this is not a component, and `app/artikel.tsx` already holds one.
 *
 * **`locale` travels beside the words rather than being read off `intl`.** It fills
 * the document's `<html lang>`, which a browser hyphenates by and a screen reader
 * picks a voice from, so it must be the language the words are actually in.
 * `intl.locale` is typed `string` by react-intl and would have to be cast; the
 * caller has `useLocale()`, which is the same value already typed `Locale`, so the
 * caller passes it and nothing is asserted away. Which is also why `options` has no
 * default any more: an empty one would have to invent a locale, and the core refuses
 * to invent one for the same reason.
 */
export function readerHtml(
  article: Article,
  intl: IntlShape,
  options: Pick<ReaderHtmlOptions, 'textScale' | 'locale'> & { isDark?: boolean },
): string {
  const { isDark, ...rest } = options;
  return buildReaderHtml(article, readerCopy(article, intl), {
    ...rest,
    css: [READER_FONTS_CSS, THEME_CSS, ...(isDark ? [READER_DARK_CSS] : []), READER_LAYOUT_CSS],
  });
}

/** Every word the document prints that the article did not supply, formatted. */
function readerCopy(article: Article, intl: IntlShape): ReaderCopy {
  return {
    factcheckBadge: intl.formatMessage(READER_COPY.factcheckBadge),
    verdict: article.rating ? intl.formatMessage(RATING_LABELS[article.rating]) : undefined,
    byline:
      article.authors.length > 0
        ? intl.formatMessage(READER_COPY.byline, { authors: article.authors.join(', ') })
        : undefined,
    readingTime: intl.formatMessage(READER_COPY.readingTime, { minutes: article.readingMinutes }),
    support: intl.formatMessage(READER_COPY.support),
    embedFallback: (host) => intl.formatMessage(READER_COPY.embedFallback, { host }),
    embedArticle: intl.formatMessage(READER_COPY.embedArticle),
  };
}
