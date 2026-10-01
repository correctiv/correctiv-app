# ADR 0017 — Native rendering as the rule, a webview for the exception

Status: accepted, 2026-09-02. The direction is decided; one question can still turn it
and is named at the end. Everything measured here was measured against the live site on
that day. Four arguments that had been made for this decision were checked first, and
two of them were wrong — they are recorded below rather than quietly dropped, because
the wrong ones were the loud ones.

## Context

The July feature scope describes the app as "basically a wrapped version of the web
view (no fancy designs, no custom formatting)", with articles pushed into the app
carrying the website's own formatting and hierarchy. The reasoning is sound: content
parity that needs no maintenance, and one place where an article is styled.

This repo does the opposite. `buildReaderHtml` owns the document — structure, class
vocabulary, German copy, the fact-check plaque, the byline, the support footer — and
the host supplies the CSS as token variables plus base64 fonts. Since
[ADR 0015](0015-reading-correctiv-org-through-its-rest-api.md) the body itself comes
from `content.rendered`, which is the same HTML the website renders, so parity at the
body level already exists.

Choosing between the two was argued in a planning pass with four arguments against the
webview. They were checked against the code and the live site before this decision was
taken.

| Argument | Verdict |
| --- | --- |
| "20 cards cost 43 KB through the API against 2.3 MB through the page" | Real, and irrelevant here. ADR 0015 measured twenty *page fetches for twenty list images*. An article webview loads one page per opened article, and the list still comes from the API. |
| "The web target cannot embed correctiv.org: X-Frame-Options and CSP block it" | **False.** Measured on `/faktencheck/` and on a post from 2026-09-01: the server sends neither header, and the page carries no CSP meta tag. The claim came from a code comment that had never been measured. |
| "The sanitiser strips classes and styles" | **False for classes.** `DROP_TAGS` removes `script`, `noscript`, `iframe`, `form`, `style`, `svg` and `button` with their content; wrappers and classes survive. What is true is narrower and matters more: iframes are dropped, so CrowdNewsroom embeds, data visualisations and video embeds do not reach the reader at all. |
| "A webview-first move would break the web demo with nothing to catch it" | **Defused.** `apps/mobile/__tests__/web-target.test.ts` fails as soon as `react-native-webview` reaches the web bundle outside the platform pairs. |

Two of four did not survive. The decision below rests on what is left, which is a
narrower case than the one that was originally made.

## Decision

### 1. Native rendering stays the rule, and the webview is the exception

It is built early rather than kept as a fallback.

### Why native stays the rule

- **Offline reading needs a document the app owns.** The scope wants a saved article to
  download. A built document is one string plus its images; a webview would mean
  caching a page and its assets, which is a different order of problem.
- **Dark mode and text size are properties of that document.** Dark mode costs one
  appended variable block because every colour in `READER_LAYOUT_CSS` comes from a
  token, and the text scale is an inline root font size. In a webview both belong to
  the website.
- **One session instead of two.** The app will authenticate against the API with a
  token — it has none yet, the sign-in is simulated
  ([ADR 0016](0016-a-door-at-the-root-and-an-entitlement-not-an-amount.md)) — while a
  webview onto a logged-in correctiv.org needs the WordPress cookie. That is a second
  sign-in
  or a token exchange, and on the web target it runs into third-party cookies rather
  than into frame headers.

### Why the webview is built early anyway

The exceptions exist from day one, and each of them is a case native rendering cannot
answer, not a case where it is merely worse:

- pages the REST API does not know — `fetchWpArticle` answers `null` for anything that
  is not a post, and the cascade already falls through to the page rung for them;
- CrowdNewsroom embeds, data visualisations and video embeds, all of them iframes;
- the login-wall pages, which the scope wants the CMS to author and edit;
- newsletter issues, whose `content.rendered` is the sent email, table layout and all;
- the hidden WordPress pages the scope wants for curating the remaining tabs.

The seam is already there: on native the reader *is* a WebView, given
`source={{ html }}`. A second mode with `source={{ uri }}`, the cookie, and the
header-hiding query parameter the scope describes is the same component in a new state,
not a new renderer.

### 2. The exception is detected, not judged

"Where native does not work" grows silently if it is decided per article, and nobody
finds out how often it was decided. Both conditions are already visible in the code and
only need reporting:

1. **The API does not know this URL.** `fetchWpArticle` returns `null` and
   `articles/load.ts` falls to the page rung. That signal exists and is already acted
   on; it only has to reach the screen.
2. **The extraction dropped an iframe.** ~~`sanitizeArticleHtml` knows this and discards
   it.~~ No cleaner discards a frame any more: each one is rendered or replaced by a visible
   link to it, voided by [ADR 0065](0065-embeds-inline-from-a-short-list-and-a-link-for-the-rest.md) §2.
   Make it report what it removed, and an article can say for itself that it was
   rendered incomplete.

With both reported, the renderer follows from the article rather than from a judgement,
and the share of articles falling to the webview becomes a number. That number is the
monitor for the one real weakness of the native path, and it is the scope's strongest
argument: parity has to be maintained, because when the website changes its blocks the
extractor does not follow on its own. A rising exception rate is what that looks like
before anyone notices it by reading.

## What can still turn this

**Does the REST API serve the body fields of gated posts to an authenticated client?**
If it does not, the webview becomes the only path to gated content and native rendering
turns into the special case for free posts. Nothing about the reasoning above would have
been wrong; the input would have changed. The question belongs in the same round of
questions to CORRECTIV as the authenticated read path, because it is the same endpoint.

Two further inputs are decisions rather than measurements, and both are CORRECTIV's:
whether offline reading is in the MVP, and whether the login wall is authored in the CMS
or drawn by the app.

## What this retires

- The parenthetical in `apps/mobile/src/components/reader/ReaderView.web.tsx`, which
  said that embedding remote correctiv.org pages would be blocked by X-Frame-Options and
  CSP. It is corrected in the file by this ADR. The rest of that comment stands: `srcDoc`
  is used because the document is built locally, and that reason never depended on frame
  headers.
- Nothing in an earlier ADR. [ADR 0015](0015-reading-correctiv-org-through-its-rest-api.md)'s
  115 KB and 2.3 MB remain correct for what they measured, which is fetching article
  pages to obtain list images. They are cited here only to record that they do not bear
  on this question.
