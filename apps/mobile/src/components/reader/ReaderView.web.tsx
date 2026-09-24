import { useCallback, useEffect, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';

import { READER_BASE_URL, type ReaderViewProps } from './types';

/**
 * The frame's name, in ENGLISH; the German ships in
 * `packages/catalogue/src/de/article.ts` (ADR 0026 §6). An iframe's `title` is the
 * whole document's name to a screen reader, so it is read aloud and belongs in
 * the catalogue like any other word a person receives.
 */
const COPY = defineMessages({
  frameTitle: {
    id: 'article.frameTitle',
    defaultMessage: 'Article',
    description:
      'The accessible name of the frame the article document is rendered in, read aloud and never seen. Same word as article.documentTitle, which is the browser TAB.',
  },
});

/**
 * Article renderer for the web demo.
 *
 * react-native-webview has no web implementation, so on web it renders the words
 * "React Native WebView does not support this platform." in red — the route
 * static-renders and exports without error, which makes the failure easy to miss.
 * An iframe is the honest equivalent here: the reader HTML is built locally by
 * buildReaderHtml(), so it goes in via `srcDoc` and no remote framing is
 * involved. (This used to add that framing remote correctiv.org pages would be
 * blocked by X-Frame-Options and CSP. Measured on 2026-09-02, the server sends
 * neither header and the page carries no CSP meta tag, so that was never true.
 * What does stand in the way of a remote frame here is third-party cookies once
 * the page needs a session — see ADR 0017.)
 *
 * A srcDoc iframe stays same-origin with its parent, so link clicks inside it
 * can be intercepted and routed through the same onNavigate the native WebView
 * uses. That is what keeps the two platforms behaving identically.
 */
export function ReaderView({ html, onNavigate, onScroll }: ReaderViewProps) {
  const intl = useIntl();
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  const handleClick = useCallback(
    (event: MouseEvent) => {
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a');
      const href = anchor?.getAttribute('href');
      if (!href) return;

      // Resolve relative hrefs the same way the native WebView's baseUrl does,
      // so onNavigate sees an absolute URL on both platforms.
      let absolute: string;
      try {
        absolute = new URL(href, READER_BASE_URL).toString();
      } catch {
        return; // Not a URL we can reason about — let the iframe deal with it.
      }

      if (!onNavigate(absolute)) event.preventDefault();
    },
    [onNavigate],
  );

  // Kept in a ref so the effect below does not re-attach on every scroll.
  const scrollRef = useRef(onScroll);
  scrollRef.current = onScroll;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let detach: (() => void) | undefined;

    const attach = () => {
      const doc = frame.contentDocument;
      const win = frame.contentWindow;
      if (!doc || !win) return;
      const handleScroll = () => scrollRef.current(win.scrollY);
      doc.addEventListener('click', handleClick);
      win.addEventListener('scroll', handleScroll);
      detach = () => {
        doc.removeEventListener('click', handleClick);
        win.removeEventListener('scroll', handleScroll);
      };
    };

    // srcDoc may already have finished parsing before this effect runs, so try
    // immediately as well as on load — otherwise the listener is never attached
    // for cached content and every link falls through to the iframe.
    frame.addEventListener('load', attach);
    attach();

    return () => {
      frame.removeEventListener('load', attach);
      detach?.();
    };
  }, [handleClick, html]);

  return (
    <iframe
      ref={frameRef}
      srcDoc={html}
      title={intl.formatMessage(COPY.frameTitle)}
      /*
       * allow-same-origin and allow-scripts, and NOTHING else:
       *
       * - allow-same-origin is required: the click interception above reads
       *   frame.contentDocument, which a fully sandboxed frame would deny.
       * - allow-scripts is for the embeds, not for the document (ADR 0065 §5). A
       *   sandbox is inherited by every frame inside this one, so without it a
       *   Datawrapper chart the core let through renders as an empty box.
       * - The document itself still runs no script. This used to be guaranteed by
       *   leaving allow-scripts out, which is also why the two flags together were
       *   ruled out here: a frame that runs script and shares the app's origin can
       *   lift its own sandbox. It is guaranteed now by the document's Content
       *   Security Policy, `script-src 'none'`, first in its <head> and built by
       *   the core (READER_CSP); a hole in a cleaner meets that rather than the
       *   app. Adding allow-scripts without that policy would be the old mistake.
       * - No allow-top-navigation is wanted either: every real link is routed by
       *   onNavigate, so the article must not be able to navigate the app away,
       *   and an embed inherits the same refusal.
       */
      // The rule's warning is the ADR 0004 argument above, answered by READER_CSP.
      // oxlint-disable-next-line react/iframe-missing-sandbox
      sandbox="allow-same-origin allow-scripts"
      // The native WebView fills its parent; match that so the overlay header
      // sits in the same place on both platforms.
      style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
    />
  );
}
