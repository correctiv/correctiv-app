/**
 * Shared contract for the two ReaderView implementations. It exists as its own
 * module so the native and web files cannot drift apart: both import this type,
 * so a change to one signature breaks the other at compile time.
 */
export interface ReaderViewProps {
  /** Complete, self-contained article document (token CSS + embedded fonts). */
  html: string;
  /**
   * Called before the embedded document navigates. Return `false` to block it —
   * the caller then handles the URL itself (in-app route or system browser).
   *
   * Both platforms funnel through this one function so link behaviour cannot
   * diverge between the app and the web demo.
   */
  onNavigate: (url: string) => boolean;
  /**
   * The article's vertical scroll offset in px, as it scrolls.
   *
   * The screen uses it to move the overlay header out of the text's way. It is
   * here rather than inside each implementation so the two cannot disagree about
   * when the header hides.
   *
   * Neither platform injects script into the article to produce it: native takes
   * the WebView's own scroll event, web listens on the `srcDoc` document from the
   * parent. That is what lets the document's policy be `script-src 'none'`: the
   * `allow-scripts` the web frame carries is for the embeds inside it (ADR 0065 §5),
   * and the article itself runs nothing.
   */
  onScroll: (offsetY: number) => void;
}

/** Base URL that relative links inside the article HTML resolve against. */
export const READER_BASE_URL = 'https://correctiv.org/';
