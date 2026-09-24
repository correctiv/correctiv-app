import { WebView, type WebViewNavigation } from 'react-native-webview';

import { READER_BASE_URL, type ReaderViewProps } from './types';

/**
 * Article renderer for iOS and Android: a full-bleed WebView fed the prepared
 * article document. Metro picks this file on native and ReaderView.web.tsx on
 * web, because react-native-webview has no web implementation — it renders the
 * text "React Native WebView does not support this platform." instead.
 */
export function ReaderView({ html, onNavigate, onScroll }: ReaderViewProps) {
  return (
    <WebView
      originWhitelist={['*']}
      source={{ html, baseUrl: READER_BASE_URL }}
      onShouldStartLoadWithRequest={(request: WebViewNavigation) => onNavigate(request.url)}
      showsVerticalScrollIndicator={false}
      // Let the content start underneath the transparent overlay header.
      contentInsetAdjustmentBehavior="never"
      // The document already carries the app's whole text scale in its root font
      // size, the system's included when that is what the app follows (ADR 0033).
      // Android's WebView would otherwise apply the system font setting a second
      // time, which is how the article used to be multiplied twice. Android only;
      // WKWebView does not scale a page by the system's text size.
      textZoom={100}
      // A hero video plays on its own, muted, looping and inline, as the site's own
      // header block plays it (the core's `heroHtml` in articles/reader-html.ts).
      // Both WebViews refuse that by default: Android and iOS wait for a tap before
      // any media starts, and iOS opens a playing video fullscreen unless inline
      // playback is allowed here AND the element says `playsinline`.
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      // The WebView's own scroll event, so nothing has to be injected into the
      // article to know where it is.
      onScroll={(event) => onScroll(event.nativeEvent.contentOffset.y)}
    />
  );
}
