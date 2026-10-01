// The article reader, on the desktop.
//
// One of three routes that differ from the phone, and the reason it differs changed
// again on 2026-09-05 — to a smaller one. Everything else here is
// `apps/mobile/src/app/artikel.tsx` verbatim, kept line-for-line so a `diff` between
// the two is short enough to read in a review.
//
// ## The fade is back, and this file no longer varies for it
//
// The history is worth three sentences because it is the same claim narrowing twice.
// `Animated` was a refusing export at tier P3, so this file rendered the header without
// the 160 ms fade. @gjsify/react-native 0.46 implemented the three names this app uses,
// so the variant was deleted — and came back, because an `Animated.View` child did not
// make its parent a `Gtk.Overlay` the way a `View` child does, and the phone's overlay
// header is `<Animated.View className="absolute …">`. Both features worked alone and
// did not compose; filed as gjsify #1451.
//
// 0.48 fixed it as a class rather than a case (#1537 — a wrapper is transparent to the
// facts a parent reads), and `Animated.View` renders through the `View` primitive,
// which declares `overlayOnAbsoluteChild`. MEASURED here: the phone's header markup
// renders with no `PrimitiveError`, and the fade is the phone's again.
//
// ## What is left, and it is a platform idiom rather than a refusal
//
// On Windows the web view is a child window the OS composites on top of the
// application, so nothing can be drawn over the document at all — `platform/webview.ts`
// carries the measurement and gjsify ADR 0035 stage 1 the mechanism. Where the view
// can be overlaid, the header floats and fades exactly as the phone's does; where it
// cannot, it is a strip ABOVE the document, and it does not hide on scroll — the same
// state machine would jump the article by the strip's own height on every change of
// direction.
//
// That is cause 2 in [ADR 0071](../../../adr/0071-re-exported-screens-and-a-variant-where-the-host-refuses.md),
// a platform idiom an ADR already argues for, not cause 3, an import the support table
// refuses. Cause 3 is struck through there.
//
// `nextHeaderState()` in `lib/articles/readerChrome.ts` is unchanged and shared: the
// header still gets out of the text's way when the article scrolls down, which is the
// fault it exists to fix (a headline reading "zeniert" because the back chevron sat on
// "insz").

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
import { openExternal } from '@/lib/openExternal';
import { shareArticle } from '@/lib/shareArticle';
import { useAppTextScale, useCoreActions, useIsSaved, useLocale } from '@/lib/store/core';
import { sizes, useColors, useIsDark } from '@/lib/theme';

import { webViewIsOsOverlay } from '../platform/webview.js';

/**
 * This screen's own chrome, in ENGLISH, with the German in `packages/catalogue`.
 *
 * Imported from the phone's file rather than re-declared would be better, and it is
 * not possible: `app/artikel.tsx` holds these inside its module and exports only the
 * screen. Re-declaring them means the SAME IDS, which is what makes the duplication
 * harmless — both files resolve to the one catalogue entry, so there is one German
 * sentence and `localisation-seam.test.ts` still sees one id. A divergent id here
 * would be a missing translation, which throws in development.
 *
 * `screenTitle` is absent: it names the browser tab on the web target, through
 * `useDocumentTitle`, and this host has no tab to name.
 */
const COPY = defineMessages({
  loadFailed: { id: 'article.loadFailed', defaultMessage: 'The article could not be loaded' },
  retryHint: { id: 'article.retryHint', defaultMessage: 'A second attempt may help.' },
  retry: { id: 'article.retry', defaultMessage: 'Try again' },
  openInBrowser: { id: 'article.openInBrowser', defaultMessage: 'Open in the browser' },
  share: { id: 'article.share', defaultMessage: 'Share the article' },
  save: { id: 'article.save', defaultMessage: 'Save the article' },
  removeSaved: { id: 'article.removeSaved', defaultMessage: 'Saved, remove' },
});

/**
 * Article reader: full-page WebKitGTK view over cleaned-up article HTML (token CSS and
 * embedded fonts, so it works offline). Overlay header for back, share and save.
 *
 * Links are intercepted: a correctiv.org article pushes another reader, anything else
 * goes to the system browser. There used to be a third case, `correctiv://join`, for a
 * button in the reader's second footer; ADR 0018 removed the footer, and a test in the
 * core now asserts the scheme never reaches a document again.
 */
export default function ArtikelScreen() {
  const intl = useIntl();
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
  const saved = useIsSaved(url ?? '');
  // The app's text scale, not one of the article's own (ADR 0033), and the locale the
  // document's own words are written in. Both read per render, as the phone reads them.
  const textScale = useAppTextScale();
  const locale = useLocale();
  const isDark = useIsDark();

  /**
   * The overlay header gets out of the way when the reader scrolls down, and comes
   * back on the way up. It floats over the article rather than pushing it down, which
   * is right for the hero image and wrong past it — hence the third state, where it
   * carries the page surface instead of floating on it.
   */
  const [header, setHeader] = useState<HeaderState>('floating');
  const headerHidden = header === 'hidden';
  // Can anything be drawn OVER the reader on this platform? On Windows the web view is
  // a child window the OS composites on top of the application, so no. See
  // `platform/webview.ts` for the measurement and the trigger that removes this.
  const overlayHeader = !webViewIsOsOverlay();
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

  // The three cases, and the rule behind them is `lib/articles/readerNavigation.ts` —
  // shared with the phone, where this screen used to carry its own copy of the same
  // four tests. Nothing about them is platform-specific, so following the move deletes
  // a divergence rather than creating one.
  const onNavigate = (target: string): boolean => {
    switch (classifyReaderLink(target)) {
      case 'internal': {
        router.push({ pathname: '/artikel', params: { url: target } });
        return false;
      }
      case 'external': {
        openExternal(target);
        return false;
      }
      default:
        return true;
    }
  };

  // Ordered rather than positioned, because on one platform the web view cannot be
  // overlaid at all — see `platform/webview.ts`. Where it can, the header floats over
  // the article the way the phone's does; where it cannot, it is a strip ABOVE the
  // document, which is the shape gjsify's own guide names as the one that works.
  //
  // And where it is a strip it stays PUT. Hiding it on scroll is what makes an overlay
  // header pleasant and what would make a strip jump the article by its own height on
  // every scroll direction change — the same state machine, opposite effect.
  const headerStrip = (
    <Animated.View
      style={overlayHeader ? { opacity: headerOpacity } : undefined}
      // Follows the fade, as the phone's does: a header at opacity 0 is still a widget,
      // and without this it swallows the clicks meant for the article under it.
      //
      // `auto` where the phone writes `box-none`, and that is this host's answer rather
      // than a compromise made here. GTK's `can-target` is ONE boolean for a widget and
      // its whole subtree, so the two cannot be split; the shim answers `box-none` as
      // `auto` for every call site and types the prop as the two values GTK has. It is
      // the accurate answer for this wrapper, which is a `Gtk.Box` with no click
      // handler of its own to steal one.
      //
      // Overlay case only: the Windows strip sits above the document rather than over
      // it, and never hides.
      pointerEvents={overlayHeader && headerHidden ? 'none' : 'auto'}
      className={overlayHeader ? 'absolute left-0 right-0 top-0' : ''}
    >
      <SafeAreaView
        edges={['top']}
        className={
          // Floating, the header only carries the page surface once it has left the
          // hero image behind — that is what `onSurface` means. As a strip it is
          // always on the surface, because it always has the document under it.
          !overlayHeader || header === 'onSurface' ? 'bg-canvas border-b border-stroke' : ''
        }
      >
        <View className="flex-row items-center justify-between px-s py-2xs">
          <HeaderButton
            icon="chevron-back"
            label={intl.formatMessage(HEADER_COPY.back)}
            onPress={goBack}
          />
          {url ? (
            <View className="flex-row gap-2xs">
              <HeaderButton
                icon="share-outline"
                label={intl.formatMessage(COPY.share)}
                onPress={() => shareArticle(url, title ?? article?.title)}
              />
              <HeaderButton
                icon={saved ? 'bookmark' : 'bookmark-outline'}
                label={intl.formatMessage(saved ? COPY.removeSaved : COPY.save)}
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
  );

  return (
    <View className="flex-1 bg-canvas">
      {overlayHeader ? null : headerStrip}
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
      {/*
        The FLOATING header, and only where one is possible — the strip case rendered
        above, before the document, and stays put.

        The phone wraps this in an `<Animated.View style={{ opacity: headerOpacity }}>`
        that fades over 160 ms. Here it is a plain `<View>` that is simply not rendered
        while the header is hidden, so the transition cuts. See the file header.

        Not rendered at all, rather than rendered with `opacity-0`: an invisible header
        would still be in the layout and still take the taps, and `pointerEvents` is
        the prop that used to prevent that. Removing it from the tree answers both at
        once and is the honest spelling of "it is not there".
      */}
      {overlayHeader && !headerHidden ? headerStrip : null}
    </View>
  );
}

/**
 * Opaque with a hairline, not translucent — the phone's comment explains why (a
 * translucent control vanished against the article's white background and left the
 * chevron sitting inside a word).
 *
 * ONE DIFFERENCE ON THIS HOST, and it is invisible: `hitSlop={8}` is dropped by
 * `src/shims/react-native.tsx`, because GTK hit-tests a widget's allocation and cannot
 * grow it. An 8 px touch-target concession has nothing to buy on a platform whose
 * pointer is a mouse, and the button's own `sizes.iconButton` box is the real target.
 */
function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** Spoken name — the button has no text, so without it a screen reader says nothing. */
  label: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center rounded-full border border-stroke bg-canvas active:opacity-70"
      style={{ width: sizes.iconButton, height: sizes.iconButton }}
    >
      <Ionicons name={icon} size={22} color={colors['on-canvas']} />
    </Pressable>
  );
}
