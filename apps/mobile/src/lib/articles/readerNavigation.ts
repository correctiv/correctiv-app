import { isInternalArticleUrl } from '@correctiv/app-core/articles/url';

/**
 * What the reader should do with a target the document tried to open.
 *
 * `allow` lets the webview navigate itself, `internal` pushes another reader,
 * `external` leaves the app.
 */
export type ReaderLinkAction = 'allow' | 'internal' | 'external';

/**
 * The reader intercepts every navigation the document starts, which is not the
 * same set as "links the reader tapped".
 *
 * `about:blank` is the document loading itself, and `data:` and `file:` are the
 * inlined images and the embedded fonts. Blocking those blocks the article, so
 * they are checked first and by scheme rather than by URL shape.
 *
 * What is left splits on `isInternalArticleUrl`, whose own rules and their history
 * are worth reading before changing anything here. That rule is the core's, because
 * it is a fact about correctiv.org; this dispatch is the host's, because the set of
 * navigations it sorts is a WebView's and an iframe's rather than the domain's.
 *
 * The final `allow` is for a scheme that is neither: `mailto:`, `tel:`, or an app
 * link. Handing those to the webview is what the reader has always done, and it is
 * the conservative branch — the app does not decide what it does not recognise.
 * There used to be a fourth case, `correctiv://join`, for a button in the reader's
 * second footer; ADR 0018 removed the footer and a test in the core now asserts
 * that scheme never reaches a document again.
 */
export function classifyReaderLink(target: string): ReaderLinkAction {
  if (target === 'about:blank' || target.startsWith('data:') || target.startsWith('file:')) {
    return 'allow';
  }
  if (isInternalArticleUrl(target)) return 'internal';
  if (/^https?:/.test(target)) return 'external';
  return 'allow';
}

/**
 * Whether a frame inside the article may load `target` without the reader being
 * asked, which is how iOS reports every load an embed makes (ADR 0065 §4).
 *
 * Web schemes only. The embeds on the core's list publish what anybody on their
 * platform wrote, so a frame nested in one is not CORRECTIV's content; it may draw
 * itself, and it may not hand the phone a `tel:`, an `itms-apps:`, `correctiv://`
 * or any other scheme the system would act on. A frame's first load of anything
 * else is refused rather than sent through `classifyReaderLink`, because nobody
 * tapped it. Plain `http:` is refused too: every listed host serves https, and the
 * document's policy only frames https.
 */
export function allowsFrameLoad(target: string): boolean {
  return /^(?:https|about|data|blob):/i.test(target);
}

/**
 * Whether the native WebView may perform a top-frame load of `target`, the answer
 * `onShouldStartLoadWithRequest` wants. `handOff` receives the address when the
 * system should have it instead.
 *
 * Every target goes through `onNavigate` first, as on the web. When it answers
 * "let the webview do it", `mailto:` and `tel:` are still not the WebView's to
 * load: Android's WebView cannot, and replaced the article with its own
 * "net::ERR_UNKNOWN_URL_SCHEME" page (measured on the API 36 emulator, 2026-09-24,
 * issue #271). They go to `handOff` and the WebView stays on the article, which is
 * the outcome `readerClickAction` gives the same two schemes on the web. Any other
 * scheme `onNavigate` lets through loads as before.
 */
export function shouldStartReaderLoad(
  target: string,
  onNavigate: (url: string) => boolean,
  handOff: (url: string) => void,
): boolean {
  if (!onNavigate(target)) return false;
  if (!/^(?:mailto|tel):/i.test(target)) return true;
  handOff(target);
  return false;
}

/**
 * What the web reader does with a click on a link inside the article: route it,
 * or cancel it. Never let the frame follow it, bar the two schemes the system
 * takes over without the frame going anywhere.
 *
 * On the web the reader is a frame on the app's own origin, so a page the frame
 * navigated to there would have the app's storage (ADR 0065 §7). Every link is
 * therefore resolved against the reader's base, as the native WebView's baseUrl
 * resolves it, and handed to `onNavigate`; a link whose address cannot be read is
 * cancelled rather than left to the browser, which is what the old handler did
 * with an SVG link (`xlink:href`, no `href`) and never saw an `<area>` at all.
 * When `onNavigate` answers "let the system have it", which it does for a scheme
 * it does not recognise, only `mailto:` and `tel:` go through as `'let-through'`.
 * The frame cannot open either itself: without `allow-popups` or
 * `allow-top-navigation` its own attempt is silently discarded by the sandbox
 * ("Navigation to external protocol blocked by sandbox", measured in Chrome on
 * 2026-09-24, issue #274). `ReaderView.web.tsx` cancels the click and opens the
 * resolved address from the PARENT window instead, which carries no sandbox at
 * all — the frame still goes nowhere. The phone needs none of this, because there
 * the WebView reports every top-frame load to `onShouldStartLoadWithRequest`, taps
 * included, and a load is the only way to leave the document.
 */
export function readerClickAction(
  href: string | null,
  base: string,
  onNavigate: (url: string) => boolean,
): 'prevent' | 'let-through' {
  if (!href) return 'prevent';
  let absolute: string;
  try {
    absolute = new URL(href, base).toString();
  } catch {
    return 'prevent';
  }
  if (!onNavigate(absolute)) return 'prevent';
  return /^(?:mailto|tel):/i.test(absolute) ? 'let-through' : 'prevent';
}

/**
 * The address `ReaderView.web.tsx` opens from the parent window for a
 * `readerClickAction` result of `'let-through'`.
 *
 * Repeats the resolution `readerClickAction` already did internally rather than
 * have the host trust the raw `href` attribute a second time — a browser trims
 * surrounding whitespace and resolves an entity on the way, which is why the two
 * call sites must agree byte for byte on how a link becomes an address. `mailto:`
 * and `tel:` carry no path to resolve against `base`, so in practice this returns
 * `href` verbatim; it takes `base` anyway so a caller need not know that.
 */
export function resolveReaderLink(href: string, base: string): string {
  return new URL(href, base).toString();
}
