import { useCallback, useEffect, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';

import { readerClickAction, resolveReaderLink } from '@/lib/articles/readerNavigation';

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

  /*
   * Every click on a link or an image-map area inside the article is routed or
   * cancelled, never followed by the frame (`readerClickAction`, ADR 0065 §7). A
   * click elsewhere, on a `<summary>` for instance, is left alone. An SVG link
   * carries its address as `xlink:href`, which is read too; the core's gate keeps
   * no SVG, and this is the second line behind it.
   *
   * `'let-through'` is `mailto:`/`tel:`: the frame's sandbox has neither
   * `allow-popups` nor `allow-top-navigation`, so its own attempt at either is
   * silently discarded (`readerNavigation.ts` has the console line Chrome logs for
   * it, measured 2026-09-24, issue #274). This `window` is the PARENT's, which
   * carries no sandbox, so setting its address opens the mail or dial handler
   * without the frame going anywhere — the same outcome `onNavigate` gives an
   * `https:` link one branch up, in `artikel.tsx`'s `openExternal`.
   */
  const handleClick = useCallback(
    (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest?.('a, area');
      if (!link) return;
      const href =
        link.getAttribute('href') ?? link.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      const action = readerClickAction(href, READER_BASE_URL, onNavigate);
      if (action === 'prevent') {
        event.preventDefault();
        return;
      }
      if (href) {
        event.preventDefault();
        window.location.href = resolveReaderLink(href, READER_BASE_URL);
      }
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
       * - allow-same-origin is required: the click interception and the scroll
       *   listener above read frame.contentDocument, which a frame with an opaque
       *   origin would deny, and the alternative is a script in the document
       *   posting to the parent, which the document's policy rules out.
       * - allow-scripts is for the embeds, not for the document (ADR 0065 §5). A
       *   sandbox is inherited by every frame inside this one, so without it a
       *   Datawrapper chart the core let through renders as an empty box.
       * - Together the two let a document IN this frame that runs script lift the
       *   sandbox, which is why ADR 0004 ruled the pair out, and that is still
       *   true. What keeps such a document out is two things built by the core,
       *   and both are needed: the policy (READER_CSP, `script-src 'none'`), so
       *   the reader document runs nothing, and the body gate in buildReaderHtml,
       *   so nothing in the body can navigate the frame to a document that does.
       *   allow-scripts also lifts the sandbox's block on a `<meta>` refresh, and a
       *   refresh to a page on this origin was exactly that document (ADR 0065 §7).
       *   Adding allow-scripts without both would be the old mistake.
       * - allow-scripts also turns scripting on for the document as far as the
       *   HTML video rules are concerned, so the hero video autoplays here as it
       *   does on the phone, without the controls a frame with scripting off
       *   forces on (measured 2026-09-24; `heroHtml` in the core's reader-html.ts).
       * - No allow-top-navigation is wanted either: every real link is routed by
       *   onNavigate, so the article must not be able to navigate the app away,
       *   and an embed inherits the same refusal.
       * - Without allow-popups or an allow-top-navigation-* flag, this frame's own
       *   attempt at a `mailto:` or `tel:` link is silently discarded (issue #274).
       *   Chrome's console names allow-top-navigation-to-custom-protocols for
       *   exactly this case, and it is still not wanted: a sandbox flag is
       *   inherited by every frame nested in this one, so granting it here would
       *   also hand it to an embed — the same reach `allowsFrameLoad` exists to
       *   refuse an embed on native, where iOS reports its every load. allow-popups
       *   is broader again, a standing grant to open a window at all. `handleClick`
       *   below opens the two schemes from the PARENT window instead, which is not
       *   sandboxed and needs no flag here to do it.
       */
      // The rule's warning is the ADR 0004 argument above; ADR 0065 §5 and §7 answer it.
      // oxlint-disable-next-line react/iframe-missing-sandbox
      sandbox="allow-same-origin allow-scripts"
      // The native WebView fills its parent; match that so the overlay header
      // sits in the same place on both platforms.
      style={{ flex: 1, width: '100%', height: '100%', border: 'none' }}
    />
  );
}
