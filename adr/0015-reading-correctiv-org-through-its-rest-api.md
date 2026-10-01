# ADR 0015 — Reading correctiv.org through its REST API

Status: accepted, 2026-09-01. Every number below was measured against the live
endpoints on that day, without authentication, the mapping was exercised against them
end to end, and the web export was then opened in a browser, which found one more
defect. See "What the browser found".

## Context

The app read correctiv.org through its RSS feeds, and three complaints about that had
been treated as facts about CORRECTIV rather than facts about RSS.

1. **No `Access-Control-Allow-Origin`,** so a browser blocks every feed request and
   the web build has never shown a live article. [ADR 0006](0006-one-core-two-hosts.md)
   lists this as its last open item, waiting on CORRECTIV ops.
2. **No images.** An RSS item carries no picture, so the app fetched the entire
   article page per card and read its `og:image`. One page is about 115 KB, so a list
   of twenty cost roughly 2.3 MB of HTML to obtain twenty URLs.
3. **No pagination, and an arbitrary ceiling.** `correctiv.org/feed/` answers with
   100 items, `/category/lokal/feed/` with 10, `/category/salon5/feed/` with 7. There
   is no way to ask for the next page, so "mehr laden" could not exist.

A fourth thing was believed and turned out to be wrong, which is what moved this from
a wish to a decision. The fact-check verdict was thought to be unavailable except in
the article page's markup, and exposing it was written up as a request to CORRECTIV's
CMS team. It is already public. It sits in `acf["post::interpretation"]`, because this
WordPress serialises Advanced Custom Fields onto every post — not in WordPress's own
`meta`, which is where the first search looked and found nothing.

Measured against `wp/v2/posts`, one request answers with everything the app had been
assembling from three sources:

| What the app needs | Where it came from | Where it is |
| --- | --- | --- |
| title, teaser, date, link | the feed | the post |
| byline | `<dc:creator>` | `yoast_head_json.author` |
| lead image | the article page's `og:image` | `cvui_featured_image`, four named sizes |
| reading time | estimated over the body | `yoast_head_json.twitter_misc`, as printed |
| kicker | the theme's `.topline` element | `acf["post::topline"]` |
| **fact-check verdict** | `/rating/<slug>.svg` in the markup | `acf["post::interpretation"]` |
| section | guessed from the URL path | `cvui_categories`, with names and ids |
| body | fetched, then extracted | `content.rendered` |

Twenty cards with all of that are 43 KB, against the 2.3 MB the image path alone used
to cost. And CORS is not a correctiv.org property at all: the REST API reflects
whatever `Origin` it is given — `localhost:8081`, `localhost:8099`,
`faktenforum.github.io`, an arbitrary third-party host, even `null` — and answers the
`OPTIONS` preflight. The RSS feeds still send no header. It was the format, not the
server.

## 1. Decision

**The REST API is the network path. RSS is the round behind it.**

`services/wp.service.ts` is the client. `FEEDS` in `data/feeds.config.ts` gains a
`categoryId` next to the RSS `url` of every feed that has a category — `recherchen`
is the site-wide stream and `europe` has no category upstream, so neither does — and the store's network rung
(`readFromNetwork` in `stores/feeds.ts`) tries REST, then RSS, before the cascade
falls through to the bundled snapshot as it always did. The article cascade in
`articles/load.ts` gains the same shape: bundle, cache, REST, scrape, stale.

**Category ids, not slugs.** A slug is editable in wp-admin and an id is not, so an id
survives a rename that would silently empty a feed.

**RSS stays, and not out of sentiment.** These are not two halves of one outage. The
REST API is a WordPress feature that a security plugin can disable per endpoint, and
one on correctiv.org already does exactly that: `wp/v2/users` answers 401, "DRA: Only
authenticated users can access the REST API". If `wp/v2/posts` ever joins it, the app
falls back to a path that has served it for months rather than to a snapshot.

**HTML extraction stays too**, for the same reason and one more: it is the only path
that works on a URL the API does not know. Every project and campaign page in the app
is not a post.

## Consequences

**The web build can be live.** This is the point. The published demo has shown a
snapshot since it existed, and said so on screen; the same code now has a network path
a browser will follow. `npm run offline-articles` keeps its other job, which is the
reader who opens the app in a tunnel.

**Two defects were fixed on the way, and neither was caused by RSS.**

- `partly_false` was not in the app's verdict vocabulary, so "Teilweise falsch" fell
  through the prose matcher to the bare `/\bfalsch\b/` it contains and the reader
  printed **"Falsch"** over an article CORRECTIV had rated more softly. Two further
  slugs, `faktenforum_false` and `faktenforum_misleading`, matched nothing and showed
  no plaque at all. Together 20 of 200 sampled fact checks, a tenth of them. The
  vocabulary now has `teilweise-falsch` and both aliases.
- A feed does not arrive in date order. Position 1 of `correctiv.org/feed/` was a post
  from 1 August while positions 2 to 6 descended from 31 August, and Home reads
  position 1 as its lead — so the front page led with a four-week-old staff notice.
  Sorting moved into the slice, where every rung of the cascade passes through it.

**One trap avoided that would only have appeared in a browser.** `http.ts` sends a
browser `User-Agent`, because WordPress answered a plain script agent with a bot
challenge. A page cannot override that header, and if a browser ever honoured the
attempt it would turn a simple request into a preflighted one — which correctiv.org
would reject, since its `Access-Control-Allow-Headers` does not list `User-Agent`. So
`fetchJson` sends no user agent, verified unnecessary: all four JSON endpoints answer
200 without it. The HTML and RSS paths keep it.

**Deletions this makes possible, and does not yet make.** With the body, the verdict
and the kicker all in the API, `articles/extract/` and its four parser packages are
reachable only through the fallback rung. Removing them would also remove the Metro
resolution special case they are the reason for. That is a separate decision, because
it trades a fallback for a smaller dependency tree, and this ADR deliberately keeps
the fallback.

**What got smaller instead:** `search.service.ts` lost its own copy of the field list,
its own mapper and `feedKeyFromUrl`, which read an article's section out of its URL
path and could see neither a second category nor a permalink that was not
category-shaped. `data/products.ts` went: dead sample data with invented prices that
nothing imported.

## What the browser found

The export was served at `localhost:8099` and opened. **Home renders live**: the lead
is yesterday's article with the byline "Sara Pichireddu · 31. August · 4 Min.
Lesezeit", Spotlight lists three real issues by date, and the line "Ohne Verbindung.
Sie sehen gespeicherte Artikel." does not appear. The reader shows the fact check that
used to be mislabelled with a yellow **"TEILWEISE FALSCH"** plaque, and that route
logs no console error at all.

**And it found a defect that nothing else could have.** The first load made four live
requests and one that failed: `net::ERR_FAILED` on the *article page*, blocked by
CORS. `ArticleHero` was still fetching the whole page — about 115 KB — for one number,
the reading time, because `FeedItem` had no field for it. Its own doc comment said so
and had been true when it was written. So on the web target the lead item silently
lost its reading time and logged a CORS error, and on a device it paid 115 KB per
render of Home for a field the REST response was already carrying and discarding. →
`FeedItem.readingMinutes`, filled by `toFeedItem`, and `useArticleMeta` asks for
nothing when the item is complete. Verified by reloading: four requests, no failure.

**CORS is per host, and only two of five send a header.** The browser is the only
place this is visible as a set:

| Host | `Access-Control-Allow-Origin` | What the app does |
| --- | --- | --- |
| `correctiv.org/wp-json` | reflects the origin | articles and Spotlight are live |
| `tube.funfacts.de` | `*` | FunFacts videos and HLS are live |
| `correctiv.org/…/feed/` | none | the RSS fallback cannot run in a browser |
| `salon5.correctiv.net` | none | all seven podcast feeds fail; the bundled snapshot answers |
| `icecast.correctiv.net` | none | the station status fails; the banner keeps its fixed subtitle |
| `youtube.com/feeds` | none | "Videos derzeit nicht erreichbar." |

Every one of those degrades the way it was built to, which is the part worth having
checked. Two of them are CORRECTIV's own hosts and a header on either would make
podcasts and the live radio title work in a browser as well; that is now a specific
ops request rather than the vague one this ADR retired.

## What the emulator found

An Android release build was installed on `Medium_Phone_API_36` and walked. It starts
with nothing in logcat but `Running "main"`, Home loads live, the reader shows the
corrected plaque in a WebView as it does in an iframe, and the Mediathek does three
things a browser cannot: the banner prints the title Icecast reports, the podcasts come
from Castopod rather than the snapshot, and the YouTube rails fill.

**That last one is how a claim in this branch was caught.** The rails showed videos
from July while the change's own notes said "CORRECTIV im Gespräch" had been silent
since March 2023. The notes were wrong, by the same mistake this ADR records for the
WordPress feed: a shell command had read the `<published>` of the *feed element* — the
channel's creation date — instead of the first entry's. All three YouTube channels are
current: im Gespräch 2026-07-23, the main channel 2026-08-19, FunFacts 2026-08-31, the
same day as its PeerTube copy. Nothing in the code said otherwise, so nothing in the
code changed; the argument for PeerTube is its properties, not the other one being
dead.

**Appearance, all four combinations**, which AGENTS.md singles out because the default
has shipped broken before: light, dark, system-on-light and system-on-dark, checked in
the browser for the two rebuilt surfaces and again on the device with the system set to
dark. `screens/web/` is re-shot from this build.

## What this has not verified

**iOS.** Not built, as it was not before this branch. The reader there is a WebView
like Android's, but nothing else about the platform has been exercised.

**The lead article is still a question, not a decision.** Sorting fixed the bug; it
did not answer whether Home's lead should be the newest post or an editorial pick. The
category "Top Recherchen" (`top-stories`, 63 posts) exists and would be the obvious
mechanism. That belongs to the newsroom.

**One difference in the reader is unjudged.** `content.rendered` ends with the theme's
"Mehr von CORRECTIV" block, three related articles with images, which the old
extraction did not carry into the reader. It renders correctly and looks deliberate.
Whether it belongs at the end of an article in the app is an editorial call nobody has
made.

## What this retires

One claim, in eighteen places. Every one of them says the app cannot reach
correctiv.org from a browser, and every one was true of the RSS feeds and never of
the REST API. The first version of this list named seven and claimed to be complete;
a review found the other eleven, all of them in `apps/`, `.github/` or the tests,
because the first sweep only searched the top-level documents.

**Struck through in place**, because they are records:

- [ADR 0006](0006-one-core-two-hosts.md), "What is still open", the CORS item: "no
  feed is ever live in a browser" and "until CORRECTIV ops send one".
- [ADR 0007](0007-removing-the-nativescript-host.md): "CORS on the web target is
  unchanged and still open."
- [ADR 0012](0012-a-list-virtualizer-for-the-unbounded-lists.md), its table: the
  `spotlight` row's reason, "sample data in the core". Its conclusion is untouched —
  the list is still bounded and still not worth virtualizing.

**Rewritten**, because they are living documents and AGENTS.md scopes the
never-rewrite rule to `adr/`:

- `ARCHITECTURE.md`: "No feed is ever live", "as current as the last
  `npm run offline-articles`", the four-rung article cascade, the slice count, and the
  services list.
- `TROUBLESHOOTING.md`, "The web target" and "Data sources". The second is the Icecast
  entry: "availability cannot be probed" is true of HEAD, and `status-json.xsl` is a
  public GET that reports every mount. An earlier draft of this branch struck words
  out of that sentence that it had itself inserted, which is worse than either
  leaving it or rewriting it; it is a plain correction now.
- `README.md`, `RELEASE.md`, `screens/README.md`, `adr/README.md`.
- `.github/workflows/pages.yml`, `apps/mobile/README.md`,
  `apps/mobile/src/lib/platform/expo.ts`, `lib/feeds/useFeed.ts`,
  `lib/feeds/corpus.ts`, `lib/articles/covers.web.ts`, `app/projekt/[id].tsx`,
  `app/serie/[id].tsx`, `app/suche.tsx`, and the comments in
  `__tests__/platform.test.ts` and `__tests__/discover.test.tsx`.
- `data/spotlight.ts`, the file header: "the newsletter archive is not public". It is
  `wp/v2/newspack_nl_cpt`, and it held 523 issues.

One of those was never true rather than newly false. `app/suche.tsx` said a browser
is blocked and the local fallback is the normal case there; this search has always
run on `wp/v2`, which has always sent the header. Nobody checked.

Two things in [ADR 0012](0012-a-list-virtualizer-for-the-unbounded-lists.md) are
**not** retired, and that is deliberate. Its table calls the project page's feed
bounded by `data?.slice(0, 12)` and virtualizing it busywork. Both still hold, because
no screen calls the new `loadMore`: wiring a "mehr laden" button there is what would
make that list unbounded, and the cost of doing it properly is a `FlatList` conversion
plus an amendment to that ADR. The capability sits in the store, tested, unused.
