# ADR 0065 — Embeds render inline from a short list, and the rest become a link

Status: accepted, 2026-09-24, **built in the same pull request**, and §4, §5 and §7
revised in it the same day after a cold security review found that a `<meta>` refresh in a
body turned the web reader into any page, on the app's own origin included. §7's gate was
revised a second time the same day, from a denylist to an allowlist over a parsed tree,
after a re-check found two bodies the first revision let through. The host list in §1 is a
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

"On the list" means **everybody who publishes on that platform**, not CORRECTIV: anybody
can make a Datawrapper chart, a Flourish story or a 23degrees map, and a frame from
the host is theirs to fill. That is accepted because what they fill it with is
cross-origin to the reader and has no way out of the frame on its own: a load inside a
frame stays inside it and is held to web schemes on iOS (§4), every navigation of the
reader itself goes through the link rule, and what the frame could still reach through a
frame nested in it is §7's. What it does not give them is a way to put something in an
article; a CORRECTIV editor still has to embed it.

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
now allowed without asking, **if its scheme is `https`, `about`, `data` or `blob`**
(`allowsFrameLoad` in the app), and refused otherwise. The embeds publish anybody's
content (§1), and a frame nested in one must not be able to hand the phone a `tel:`, an
`itms-apps:`, `correctiv://` or any other scheme the system acts on without a tap. Which
frames the document may have at all is its Content Security Policy (§5), built from the
list in §1, and what an allowed embed frames inside itself (a Flourish story frames its
visualisations) is part of allowing it. The top frame still goes through the same rule
as before. Android does not report a frame's first load,
and marks what it reports as top-frame, so nothing changes there.

### 5. The document runs no script, by policy, and so the web frame may carry `allow-scripts`

`buildReaderHtml` puts a Content Security Policy first in the document's `<head>`:
`script-src 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, and
`frame-src` listing the hosts of §1. The document never had a script of its own; now a
script a cleaner missed meets the browser rather than the app, and a frame the cleaners
should not have let through is refused by the browser as well. `frame-src` also holds when
an embed navigates ITSELF: an embed sending itself to a page on the app's origin was
refused, measured 2026-09-24. A policy in a `<meta>` can be tightened by a later one and
never loosened, so a body that carries its own changes nothing.

What the policy does not cover is markup that acts **without** a script, and a `<meta>`
refresh is the one that mattered: the sandbox used to block it as an automatic feature,
`allow-scripts` lifts that block, and the policy says nothing about it. §7 is the answer.

On the web, the reader is an `<iframe srcDoc>` and its sandbox is inherited by every frame
inside it. It carried `allow-same-origin` alone, which would render every inline embed of
§1 as an empty box. It carries `allow-same-origin allow-scripts` now. The two together
were ruled out in [ADR 0004](0004-react-native-pivot.md) because a same-origin frame that
runs script can lift its own sandbox, and that is still true. What is claimed here is
narrower: the reader document itself runs no script, because of the policy above, and it
cannot be made to BECOME a document that runs one, because §7 takes out what would
navigate it. A page on the app's origin inside the reader frame would have the app's
origin and a sandbox it can lift, and the review showed a refresh putting one there; that
is the case this decision rests on keeping out, and why §7 is not optional.

`allow-same-origin` stays, and it was weighed rather than kept by habit. Without it the
frame's document has an opaque origin, which is the stronger position, but the parent
reads `contentDocument` for two things that have no other way: every click on a link, so
that a link goes through `onNavigate` like on the phone, and the scroll offset that moves
the header. Both would need a script in the document posting to the parent, which the
policy above rules out, and the reader keeping no script is worth more than the flag.

### 6. The link's words are written when the document is built

The cleaned body is cached, offline bundle included, and it is cached without a locale.
So the cleaners write a marker with no prose, `<a class="embed-fallback" href
data-embed-host>`, and `buildReaderHtml` rebuilds each one with the words the host
formatted through `ReaderCopy` (`core.reader.embedFallback` with `{host}`,
`core.reader.embedArticle`). Rebuilt rather than filled in: the address is re-checked as
http(s), everything is escaped, and whatever else the marker carried is gone.

### 7. The body is gated for what acts without a script, and an embed that can do without an origin gets none

Measured by the cold review on the web export, 2026-09-24: a body carrying
`<meta http-equiv="refresh" content="1;url=https://example.com/">` turned the reader frame
into example.com inside the app's chrome, and with `url=/some-page.html` on the app's own
origin that page ran script and read `parent.document` and `parent.localStorage`. The app
is published on `correctiv.github.io`, shared with CORRECTIV's other Pages sites, so a page
on the same origin is not hypothetical. On the phone the same refresh was already a
navigation the reader handed to the system browser without a tap.

- **The last gate is `buildReaderHtml`.** A body comes out of a cleaner, but also out of the
  article cache and the offline bundle, written by whatever cleaner was current when it was
  stored. ~~So the document builder takes out, whatever the cleaners did, every `<meta>`,
  `<base>`, `<link>`, `<portal>`, `<object>`, `<embed>`, `<applet>`, `<param>`, `<frame>`
  and `<frameset>`, in any casing, and rebuilds every frame as the canonical one from a
  listed host or removes it, so a `srcdoc` or an `onload` does not survive. To a fixpoint,
  because a removal can put a tag back together: `<me<meta>ta …>` is a refresh once the inner
  tag is gone.~~ Wrong on the day it was written, measured 2026-09-24 by the re-check of the
  pull request: a denylist of regular expressions let two bodies through, below.
- **The gate is an allowlist over a parsed tree** (`gateReaderBody` in
  `articles/body-allowlist.ts`). The body is parsed with htmlparser2, and what is written into
  the document is the serialisation of a tree the gate built: tags from one table, each with
  the attributes the table gives it, an address only as absolute `https`, `http` or `mailto`
  with a relative one resolved against correctiv.org, a frame only as the canonical one from
  a listed host, and every attribute value quoted and every `<` in text escaped. Everything
  else is unwrapped and keeps its words, or, for a script, a style, a form, an SVG, a player
  and the like, dropped with what it holds. A browser re-parsing that output can rearrange the
  allowed tags and cannot find one that is not there. The table is the one the DOM extractor
  already cleaned with, moved into the same module, so the extractor and the gate cannot
  disagree; it gained `details` and `summary` for the accordions and the table elements, of
  which two of the 300 posts carried one.
- **Why the denylist was abandoned rather than extended.** The re-check reproduced two
  bodies in Chrome against the reader's sandbox. A `<meta http-equiv=refresh …` left
  unterminated at the very end of the body had no `>` for the pattern to find, and the
  builder's own `</div>` after it closed the tag: the frame went to the app's origin and read
  `parent.localStorage` without a tap. And `<img usemap><map><area href="/x">` was on nobody's
  list: one tap on the picture navigated the frame to the app's origin, and an SVG link
  (`xlink:href`) did the same. Both were a missing entry, and a list of what is forbidden is
  finished only when nobody finds the next one. An allowlist over a tree is finished when it is
  written: an unterminated tag is text to a parser, and a `<map>` is not in the table.
- **What it costs is the parser.** The core kept htmlparser2 inside the DOM extractor so that
  a host without one would not need it (`test/boundary.test.ts`). The gate is the second file
  allowed to import it, so a host that builds the reader document now carries the parser. The
  one host does already; a script that only extracts, with the string backend, still does not.
- **The web reader routes every tap on a link or an area**, and cancels one it cannot route
  (`readerClickAction`): no tap navigates the frame itself, bar `mailto:` and `tel:`, which the
  system takes over while the frame stays. The phone needs no such rule, because the WebView
  reports every top-frame load to `onShouldStartLoadWithRequest`, a tap included.
- ~~**`sanitizeArticleHtml` drops the same set**~~ (the gate holds a table now, so there is no
  set to share; wrong on the day it was written, measured 2026-09-24)
  **`sanitizeArticleHtml` drops the set the denylist gate dropped**, and runs its removals to a
  fixpoint as well,
  with the frames last and only the exact form `rewriteEmbeds` writes let through, because
  `<ifr<script></script>ame class="reader-embed" srcdoc="…">` was a frame with the reader's
  own class once the script was gone. It also drops a tag left open at the very end. **It is
  not the boundary**, and says so: what it does is keep what the cache stores small and
  near to what the reader shows.
- **A frame nested inside an embed** is the route left after both, and it was measured in the
  same browser: a frame inside a cross-origin embed that loads a page on the app's origin
  gets that origin and the reader's inherited sandbox, and read `top.localStorage`. So the
  listed hosts whose embeds draw the same without an origin of their own get a `sandbox`
  without `allow-same-origin`, and everything under them is opaque; the same probe read
  `top blocked` then. That is Datawrapper and Flourish, `OPAQUE_EMBED_HOSTS`. CORRECTIV's
  own map apps and 23degrees read their own storage and draw nothing in that sandbox
  ("no interactivity?"), and DocumentCloud answered 403 behind Cloudflare's bot check in
  both modes, so those three keep their origin and this route stays open under them. What
  it needs is a page on the app's origin that somebody other than CORRECTIV controls; a
  page like that could read the app's storage without the reader, by being visited.

## What this does not decide

- **A WebView per embed.** Not needed yet: the reader is one WebView already, and an inline
  frame inside it is the cheapest way to show an embed. It becomes the question once the
  article is drawn natively rather than as a document, which is not planned.
- **A reader document without the parser.** A host that cannot carry htmlparser2 cannot
  build the reader document any more (§7). None exists; the day one does, the answer is a
  gate of its own over the same table, not the denylist back.
- **A sandbox for the three hosts that keep their origin** (§7). For `cdn.correctiv.org` it
  is CORRECTIV's own code, which could stop reading storage; for 23degrees and DocumentCloud
  it is somebody else's decision.
- **Consent.** The app asks nobody about anything here, because nothing it loads inline set
  a cookie in the measurement. A host that starts to is a change to §1's list, and
  somebody has to notice it; nothing re-measures the table.
- **The resize listener** of §3, and the scrollytelling piece's own scripts, which scroll the
  map in step with the text on correctiv.org. The map renders; the steps do not drive it.
- **Whether the app should say how many embeds an article held.** ADR 0017 §2's second
  signal is still a proposal; the fallback links make an incomplete article visible to its
  reader, not to anybody counting.

## What it retires

- [ADR 0004](0004-react-native-pivot.md), two statements about the web reader's sandbox:
  that it carries `allow-same-origin` and nothing else because the reader needs no script,
  and that the two flags must never be set together. Struck where they stand, by §5. The
  reason ADR 0004 gave for the second, that the frame could then remove its own sandbox,
  is still true and is left standing; ADR 0065 §5 and ADR 0065 §7 are what this record does
  about it.
- [ADR 0017](0017-native-rendering-as-the-rule-a-webview-for-the-exception.md) §2, that
  `sanitizeArticleHtml` discards a frame. Struck where it stands, by §2. The table row in
  its Context ("iframes are dropped") was true when measured and is left.
