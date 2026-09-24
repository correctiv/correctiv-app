# ADR 0065 — Embeds render inline from a short list, and the rest become a link

Status: accepted, 2026-09-24, **built in the same pull request**. The host list in §1 is a
proposal: the newsroom and data protection may change it, and changing it is one edit to
`INLINE_EMBED_HOSTS` in `packages/app-core/src/articles/embeds.ts`. Verified in the web
export in a browser; **iOS and Android unrun**.

## Context

An article body reaches the reader through one of three cleaners: `sanitizeArticleHtml`
for the REST API's `content.rendered`, and on the page-scrape fallback
`extract/dom.ts` (an allowlist) or `extract/string.ts` (the same denylist). All three
removed `<iframe>` and `<script>` with their contents, and none of them left anything in
their place. A chart, a map, a document or a video vanished without a trace, and the
sentence before it ("Schauen Sie in unserer Grafik nach …") pointed at nothing.
[ADR 0017](0017-native-rendering-as-the-rule-a-webview-for-the-exception.md) named the
dropped iframe as one of the two signals that should send an article to a webview; this
record handles it in the native path instead, for the embeds that can be handled there.

What the articles actually embed, measured on 2026-09-24 over 300 recent posts from the
REST API: Datawrapper charts, most of them (as a `core/html` iframe with Datawrapper's
resize script after it, or as a WordPress embed block); CORRECTIV's own apps on
`cdn.correctiv.org` (maps, a scrollytelling piece); DocumentCloud documents; a 23degrees
map; YouTube on both of its hosts; a LinkedIn post; Flourish and Instagram, which embed
by script rather than by frame; and one correctiv.org article embedded in another.

### What each embed does when it loads, 2026-09-24

A fresh headless Chrome context per embed, loaded to network idle plus two seconds,
recording the hosts it requested, the cookies it set and what it wrote to storage.

| Embed | Hosts contacted | Cookies, storage | Here |
| --- | --- | --- | --- |
| `datawrapper.dwcdn.net` | `datawrapper.dwcdn.net`, `static.dwcdn.net`, `pt.dwcdn.net` (Datawrapper's own view counter) | none | inline |
| `cdn.correctiv.org`, three apps | `cdn.correctiv.org`, `correctiv.org`, `api.maptiler.com`; one app (`CE_2026_bathing_sites`) also `fonts.googleapis.com` and `fonts.gstatic.com` | none | inline |
| `app.23degrees.io` | 23degrees' own hosts only (`g-cdn`, tiles, `geo-*`, pmtiles) | no cookies; `localStorage` `favoritesStore` and `userStore`, the app's own state | inline |
| Flourish, as `flo.uri.sh/<story or visualisation>/embed` | `flo.uri.sh`, `public.flourish.studio` | none | inline, by turning its script embed into this frame |
| `embed.documentcloud.org` | plus `static.cloudflareinsights.com` (Cloudflare Web Analytics, cookieless) | `cf_clearance` (Cloudflare bot protection) | inline, **the borderline case** |
| `youtube-nocookie.com` | `www.google.com`, `jnn-pa.googleapis.com` | no cookies; `localStorage` `ytidb` | link |
| `youtube.com/embed` | `googleads.g.doubleclick.net`, `static.doubleclick.net` | `VISITOR_INFO1_LIVE`, `YSC`, `__Secure-YNID` and more | link |
| `linkedin.com` embed | incl. a third-party tracker (`protechts.net`, PerimeterX) | eleven, incl. `bcookie`, `lidc` | link |
| Instagram (`blockquote.instagram-media` plus `embed.js`) | Meta | not in the measurement; it is Meta's embed script | link |
| A correctiv.org post (`…/embed/#?secret=…`) | `matomo.correctiv.org`, `cdn.consentmanager.net`, social widgets | | the article, in the reader |

The Google Fonts request from the bathing-sites map is the one thing on an inline row a
person's browser would not otherwise have sent. It is CORRECTIV's own app, so it is the
newsroom's to fix on their side rather than a reason for the app to refuse its own
publisher's map.

## Decision

### 1. A frame renders inline when its host is on one short list

`INLINE_EMBED_HOSTS` holds `datawrapper.dwcdn.net`, `cdn.correctiv.org`,
`app.23degrees.io`, `embed.documentcloud.org` and `flo.uri.sh`: the rows of the table
above that set no cookie a person would have to be asked about. A frame on it renders in
the reader over https, with its own `title`, its `name` (CORRECTIV's apps read their
language and starting view out of it) and its height (§3). Every other attribute it
arrived with, `sandbox`, `allow`, `style`, is dropped, because those ask for permissions
and layout the reader decides.

DocumentCloud is on the list and is the case to argue about. Its analytics are cookieless,
but `cf_clearance` is a cookie, set by Cloudflare's bot protection on the documents'
host; whether that needs consent is a question for data protection, not for this record.
Taking it off is the one-line edit the status line names.

This list is a **proposal** from a measurement, not a policy anyone at CORRECTIV has
signed. It lives in one place so that it can be changed there: the three cleaners, the
reader's Content Security Policy (§5) and the tests all read it.

### 2. Every other embed is a visible link, and never nothing

An embed that does not render becomes a link to it: "Inhalt von youtube.com im Browser
öffnen", pointing at the frame's own address, or for a script embed at the permalink its
container carries (Instagram's `data-instgrm-permalink`). Tapped, it goes where every
external link in the reader goes, to the system browser. A frame with no usable address
points at the article on correctiv.org, where the embed does render.

YouTube, LinkedIn and Instagram are deliberately not loaded, `youtube-nocookie.com`
included: the table shows each of them contacting an ad or tracking host, or writing to
storage, the moment it loads, before anybody pressed play. correctiv.org embeds them
behind its consent manager; the app has no consent manager and should not grow one for
this, because a tap that opens the browser costs little and asks nothing. The app's own
video screen does load YouTube, and that is consistent with this: there a person chose a
video to watch.

A correctiv.org post embedded in another is not an external embed at all. It becomes a
link to the article, without the `/embed/` suffix and the secret, which the reader
routes like every correctiv.org link: into another reader, not a browser. Its words say
so ("Eingebetteten Artikel lesen"). WordPress puts a quote with the article's title in
front of that frame, and the quote stays.

Flourish is the one script embed that renders: its `div.flourish-embed` becomes the
`flo.uri.sh` frame its own script would have made, once `data-src` matches
`story/<n>` or `visualisation/<n>`. Instagram, X and TikTok arrive as a quote the script
would have styled, and the quote becomes the link.

A script on its own becomes nothing, as before. An inline one is a helper (Datawrapper's
resize listener), and a lone external one cannot be told apart from an advertisement, so
turning it into "Inhalt von … öffnen" would offer a reader the ad server.

### 3. A frame is as tall as it says, or most of a screen

A Datawrapper chart states the height it was published at (`height="505"`) and then
corrects it by `postMessage` to a script on the host page, which the reader does not
run (§5). The reader keeps the stated height and takes the full column width; where a
frame states none, as CORRECTIV's map apps do, it is 75 % of the viewport high.

Chosen over an aspect-ratio box because the embeds that state a height state the right
one for a desktop column, and a chart at 360 px wide is taller than at 600, not shorter;
a box scaled down from 600 × 505 would cut more of it off. What this costs is that a
chart whose mobile layout is taller than its stated height shows the rest by scrolling
inside the frame. The fix for that is the resize listener, which needs script in the
reader document, which §5 rules out; it is left, not refused.

The frame is filled white in both appearances. An embed draws itself for a light page and
leaves its own background transparent, so on the dark canvas the first Datawrapper chart
tried printed black text on near-black. A white card in a dark article is the honest
picture of what it is: somebody else's page, drawn for a light one.

### 4. On iOS, a frame's own load is not a link

`react-native-webview`'s `onShouldStartLoadWithRequest` fires on iOS for every frame's
loads, not only for the document's. The reader handed all of them to its link rule, which
sends any https address that is not an article to the system browser, so an inline chart
would have opened Safari as the article appeared. A load that is not the top frame's is
now allowed without asking. Which frames the document may have at all is its Content
Security Policy (§5), built from the list in §1, and what an allowed embed frames inside
itself (a Flourish story frames its visualisations) is part of allowing it. The top frame
still goes through the same rule as before. Android does not report a frame's first load,
and marks what it reports as top-frame, so nothing changes there.

### 5. The document runs no script, by policy, and so the web frame may carry `allow-scripts`

`buildReaderHtml` puts a Content Security Policy first in the document's `<head>`:
`script-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, and
`frame-src` listing the hosts of §1. The document never had a script of its own; now a
hole in a cleaner meets the browser rather than the app, and a frame the cleaners should
not have let through is refused by the browser as well. A policy in a `<meta>` can be
tightened by a later one and never loosened, so a body that carries its own changes
nothing.

On the web, the reader is an `<iframe srcDoc>` and its sandbox is inherited by every frame
inside it. It carried `allow-same-origin` alone, which would render every inline embed of
§1 as an empty box. It carries `allow-same-origin allow-scripts` now. The two together
were ruled out in [ADR 0004](0004-react-native-pivot.md) because a same-origin frame that
runs script can lift its own sandbox; what stops the reader document running script is now
the policy above rather than the missing flag. The embeds are cross-origin, so they reach
nothing of the app's either way.

### 6. The link's words are written when the document is built

The cleaned body is cached, offline bundle included, and it is cached without a locale.
So the cleaners write a marker with no prose, `<a class="embed-fallback" href
data-embed-host>`, and `buildReaderHtml` rebuilds each one with the words the host
formatted through `ReaderCopy` (`core.reader.embedFallback` with `{host}`,
`core.reader.embedArticle`). Rebuilt rather than filled in: the address is re-checked as
http(s), everything is escaped, and whatever else the marker carried is gone.

## What this does not decide

- **A WebView per embed.** Not needed yet: the reader is one WebView already, and an inline
  frame inside it is the cheapest way to show an embed. It becomes the question once the
  article is drawn natively rather than as a document, which is not planned.
- **Consent.** The app asks nobody about anything here, because nothing it loads inline set
  a cookie in the measurement. A host that starts to is a change to §1's list, and
  somebody has to notice it; nothing re-measures the table.
- **The resize listener** of §3, and the scrollytelling piece's own scripts, which scroll the
  map in step with the text on correctiv.org. The map renders; the steps do not drive it.
- **Whether the app should say how many embeds an article held.** ADR 0017 §2's second
  signal is still a proposal; the fallback links make an incomplete article visible to its
  reader, not to anybody counting.

## What it retires

- [ADR 0004](0004-react-native-pivot.md), two sentences about the web reader's sandbox:
  that it carries `allow-same-origin` and nothing else because the reader needs no script,
  and that the two flags must never be set together. Struck where they stand, by §5.
- [ADR 0017](0017-native-rendering-as-the-rule-a-webview-for-the-exception.md) §2, that
  `sanitizeArticleHtml` discards a frame. Struck where it stands, by §2. The table row in
  its Context ("iframes are dropped") was true when measured and is left.
