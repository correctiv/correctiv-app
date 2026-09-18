import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ActivityIndicator, Animated, Pressable, View } from 'react-native';

import { ReaderView } from '@/components/reader/ReaderView';
import { Button, SafeAreaView, Typo } from '@/components/ui';
import { HEADER_COPY } from '@/components/ui/ScreenHeaderBar';
import { type HeaderState, nextHeaderState } from '@/lib/articles/readerChrome';
import { classifyReaderLink } from '@/lib/articles/readerNavigation';
import { loadArticle } from '@correctiv/app-core/articles/load';
import type { Article } from '@correctiv/app-core/articles/types';
import { readerHtml } from '@/lib/articles/reader';
import { goBack } from '@/lib/navigation/goBack';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';
import { openExternal } from '@/lib/openExternal';
import { shareArticle } from '@/lib/shareArticle';
import { useCoreActions, useIsSaved, useLocale, useTextScale } from '@/lib/store/core';
import { sizes, useColors, useIsDark } from '@/lib/theme';

/**
 * Everything the reader's own chrome says, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/article.ts` (ADR 0026 §6). The article itself is not in
 * here: it is CORRECTIV's journalism, rendered as it was published.
 *
 * The back control says `ui.back`, imported rather than declared, because it is
 * the same word the drawn bar and the platform's header use — this screen only
 * draws its own chevron because the chrome floats over the hero image.
 */
const COPY = defineMessages({
  screenTitle: {
    id: 'article.documentTitle',
    defaultMessage: 'Article',
    description:
      "The browser tab's title while an article is open on the web target. Never seen inside the app.",
  },
  loadFailed: { id: 'article.loadFailed', defaultMessage: 'The article could not be loaded' },
  retryHint: { id: 'article.retryHint', defaultMessage: 'A second attempt may help.' },
  retry: { id: 'article.retry', defaultMessage: 'Try again' },
  openInBrowser: { id: 'article.openInBrowser', defaultMessage: 'Open in the browser' },
  share: { id: 'article.share', defaultMessage: 'Share the article' },
  save: { id: 'article.save', defaultMessage: 'Save the article' },
  removeSaved: { id: 'article.removeSaved', defaultMessage: 'Saved, remove' },
});

/**
 * Article reader: full-page webview over cleaned-up article HTML (token CSS and
 * embedded fonts, so it works offline). Native overlay header for back and save.
 *
 * Links are intercepted: a correctiv.org article pushes another reader, anything
 * else goes to the system browser. The rule itself is `readerNavigation`, which
 * carries the cases and their history.
 *
 * **No `ErrorBoundary` of its own**, deliberately, although a route file may export
 * one. The root layout's covers this route like every other, and neither fault this
 * screen actually has is one a React boundary could improve on: the load is caught
 * below and answered in place, with a headline, a retry and a way into the browser,
 * and whatever goes wrong inside the WebView's own document never surfaces as a
 * React render error at all. A second boundary here would mean a third error
 * presentation on this screen, reached by nothing, and the one nobody sees is the
 * one that rots. Keeping the navigator alive through a screen fault is a different
 * job, and `unstable_settings.screenErrorBoundary` on the root layout is where it
 * would be done, for every screen at once rather than for this one.
 */
export default function ArtikelScreen() {
  const intl = useIntl();
  // The reader draws its own floating chrome rather than a `ScreenHeader`, so the
  // browser tab is named here. A fixed word and not the headline: the tab would
  // otherwise read the screen it was opened from, which is the defect, and the
  // article's own title is a separate change (ADR 0030).
  useDocumentTitle(intl.formatMessage(COPY.screenTitle));
  const colors = useColors();
  const actions = useCoreActions();
  const { url, title, badge } = useLocalSearchParams<{
    url?: string;
    title?: string;
    badge?: string;
  }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState(false);
  /** Bumped to retry: the effect depends on it, so a tap re-runs the load. */
  const [attempt, setAttempt] = useState(0);
  // Subscribes to just this one article's saved flag, so bookmarking another
  // article does not re-render the reader.
  const saved = useIsSaved(url ?? '');
  /**
   * A bookmark needs a headline, and until the article lands there may be none.
   *
   * Opened from a feed row the title arrives as a route param, so saving works
   * immediately. Opened by URL alone — a deep link, a shared address, an internal
   * link from another reader — there is nothing to write until `loadArticle`
   * answers, and saving early wrote `title: ''`. That row renders in
   * `/gespeichert` as a blank line above its date, with no way to tell which
   * article it was, and it survives a restart. Found on the emulator by
   * bookmarking a URL that 404s.
   *
   * Removing is never blocked: a saved article that is being re-read through a
   * bare URL still has to be removable.
   */
  const canSave = Boolean(title ?? article?.title);
  // Both are read per render, never snapshotted: the appearance has to reach the
  // reader's colour block, and the text-size setting its root font size.
  const textScale = useTextScale();
  const locale = useLocale();
  const isDark = useIsDark();

  /**
   * The overlay header gets out of the way when the reader scrolls down, and comes
   * back on the way up.
   *
   * It floats over the article rather than pushing it down, which is deliberate and
   * right for the hero image. Past the hero it was covering the text instead: a
   * headline read "zeniert" because the back chevron sat on "insz", in both colour
   * schemes and at every scroll position, which is the reading state rather than an
   * edge case.
   */
  const [header, setHeader] = useState<HeaderState>('floating');
  const headerHidden = header === 'hidden';
  const lastOffset = useRef(0);
  const headerOpacity = useRef(new Animated.Value(1)).current;

  const onReaderScroll = useCallback((offsetY: number) => {
    const previous = lastOffset.current;
    lastOffset.current = offsetY;
    setHeader((current) => nextHeaderState(current, previous, offsetY));
  }, []);

  // A new article starts at the top, so the header starts visible.
  useEffect(() => {
    lastOffset.current = 0;
    setHeader('floating');
  }, [url, attempt]);

  useEffect(() => {
    Animated.timing(headerOpacity, {
      toValue: headerHidden ? 0 : 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [headerHidden, headerOpacity]);

  useEffect(() => {
    if (!url) return;
    let active = true;
    const load = async () => {
      setArticle(null);
      setError(false);
      try {
        const a = await loadArticle(url, { kicker: badge });
        if (active) setArticle(a);
      } catch {
        if (active) setError(true);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [url, badge, attempt]);

  return (
    <View className="flex-1 bg-canvas">
      {article ? (
        <ReaderView
          html={readerHtml(article, intl, { textScale, isDark, locale })}
          onNavigate={onNavigate}
          onScroll={onReaderScroll}
        />
      ) : (
        <View className="flex-1 items-center justify-center px-m">
          {error ? (
            <>
              <Typo variant="headline-s" className="text-center">
                {intl.formatMessage(COPY.loadFailed)}
              </Typo>
              <Typo variant="text-m" color="on-canvas-muted" className="mt-2xs text-center">
                {title ?? intl.formatMessage(COPY.retryHint)}
              </Typo>
              <View className="mt-m flex-row gap-s">
                <Button
                  title={intl.formatMessage(COPY.retry)}
                  onPress={() => setAttempt((n) => n + 1)}
                />
                {url ? (
                  <Button
                    title={intl.formatMessage(COPY.openInBrowser)}
                    variant="outline"
                    onPress={() => openExternal(url)}
                  />
                ) : null}
              </View>
            </>
          ) : (
            <ActivityIndicator color={colors.accent} />
          )}
        </View>
      )}

      {/* Overlay header: it floats over the hero image rather than pushing it down.
          Past the hero it would sit on the text instead, so two things happen there.
          It fades out on the way down and back in on the way up, and while it is on
          text it carries the page surface instead of floating on it. `pointerEvents`
          follows the fade, or an invisible header would still swallow taps meant for
          the article. */}
      <Animated.View
        style={{ opacity: headerOpacity }}
        pointerEvents={headerHidden ? 'none' : 'box-none'}
        className="absolute left-0 right-0 top-0"
      >
        <SafeAreaView
          edges={['top']}
          className={header === 'onSurface' ? 'bg-canvas border-b border-stroke' : ''}
        >
          <View className="flex-row items-center justify-between px-s py-2xs">
            <HeaderButton
              icon="chevron-back"
              label={intl.formatMessage(HEADER_COPY.back)}
              onPress={goBack}
            />
            {url ? (
              <View className="flex-row gap-2xs">
                {/* Sharing a piece of journalism is the point of publishing it — the
                  one action here that works on the article rather than on the app. */}
                <HeaderButton
                  icon="share-outline"
                  label={intl.formatMessage(COPY.share)}
                  onPress={() => shareArticle(url, title ?? article?.title)}
                />
                <HeaderButton
                  icon={saved ? 'bookmark' : 'bookmark-outline'}
                  label={intl.formatMessage(saved ? COPY.removeSaved : COPY.save)}
                  disabled={!saved && !canSave}
                  onPress={() =>
                    actions.savedArticles.toggle({
                      url,
                      title: title ?? article?.title ?? '',
                      kicker: article?.kicker ?? null,
                      rating: article?.rating ?? null,
                      savedAt: new Date().toISOString(),
                    })
                  }
                />
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

/**
 * Every navigation the document starts comes through here. The rule itself lives in
 * `readerNavigation`, where it can be tested; what is left is which of the three
 * outcomes the app performs, and whether the webview is allowed to proceed.
 *
 * Module scope, not a callback in the component: it captures nothing.
 */
function onNavigate(target: string): boolean {
  switch (classifyReaderLink(target)) {
    case 'internal': {
      router.push({ pathname: '/artikel', params: { url: target } });
      return false;
    }
    case 'external': {
      openExternal(target);
      return false;
    }
    default: {
      return true;
    }
  }
}

/**
 * Opaque with a hairline, not translucent.
 *
 * This was `opacity: 0.92` and no border, which is invisible against the article's
 * white background — the surface vanished and the icon stayed, so once the hero had
 * scrolled past, the chevron sat inside a word ("CSD-Anschlag" read as a chevron
 * plus "D-Anschlag"). Only visible below the fold, which is why every emulator
 * screenshot of the reader missed it. Opaque, the control covers what passes under
 * it instead of mixing with it, and the border keeps it readable as a control on a
 * white page too.
 */
function HeaderButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** Spoken name — the button has no text, so without it a screen reader says nothing. */
  label: string;
  onPress: () => void;
  /**
   * Dimmed and inert, not absent. The header is a fixed row of controls over a
   * hero image; one appearing when the article lands would shift the other two
   * under the reader's thumb.
   */
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      // Spoken as well as shown: a dimmed circle says nothing to a screen reader.
      accessibilityState={{ disabled }}
      className={`items-center justify-center rounded-full border border-stroke bg-canvas ${
        disabled ? 'opacity-40' : 'active:opacity-70'
      }`}
      /*
       * 44 drawn, where this was 40 with `hitSlop={8}` — and here the slop was the
       * second thing #102 asks to be checked at every one of the twelve sites, not
       * just the first. Share and bookmark sit in a `gap-2xs` row, 6 dp apart, so
       * their slop rectangles overlapped by 10 dp and a tap in that strip went to
       * whichever won: an invisible ambiguity between "share this article" and
       * "save it", on the one screen where both are one-tap actions.
       */
      style={{ width: sizes.iconButton, height: sizes.iconButton }}
    >
      <Ionicons name={icon} size={22} color={colors['on-canvas']} />
    </Pressable>
  );
}
