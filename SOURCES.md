# Sources

What the app reads, what the requirements want it to read, and where the second list
has no answer in the first.

This exists for one deliverable: "Entscheidung: wie/welche Inhalt von welchen Quellen
in der App", due end of September. It is a statement of the current position, not a
proposal.

**The figures are not in this file.** They were, with the day they were taken beside
them, because a browser cannot re-take them: the RSS feeds and the Icecast status
document send no `Access-Control-Allow-Origin`, so the published board could only
print what somebody had typed. Node has no CORS.
[`apps/workbench/scripts/measure-sources.mjs`](apps/workbench/scripts/measure-sources.mjs)
now hits every one of them with a plain `GET`, writes
[`apps/workbench/content/sources.measured.ts`](apps/workbench/content/sources.measured.ts),
and the board renders that beside the day of the run and how long ago it was.
[`.github/workflows/sources.yml`](.github/workflows/sources.yml) re-takes it weekly. A
source that is down, slow or has moved shows up there as a row with a reason on it and
fails nothing.

So what is below is the argument: what each source is for, what it costs, and which
question it is blocking. Where a number is load-bearing for an argument it is stated
with its own date and a test holds it against the run. Everything else is on the board.

## What the app reads today

### Articles, from correctiv.org

WordPress REST (`wp/v2/posts` by category id), with the RSS feed of the same category
as the fallback path. Ids and not slugs, because a slug is editable in wp-admin.
Configured in [`packages/app-core/src/data/feeds.config.ts`](packages/app-core/src/data/feeds.config.ts).

| Feed | Category | State |
| --- | --- | --- |
| Recherchen | none, the site-wide feed | healthy |
| Faktencheck | `faktencheck` (5) | healthy |
| Klima | `klimawandel` (94) | healthy |
| CORRECTIV.Schweiz | `schweiz` (2568) | healthy |
| CORRECTIV.Lokal | `lokal` (1017) | **stale** |
| Salon5 | `salon5` (1241) | **stale** |
| CORRECTIV.Europe | **no such category** | **broken** |

Post counts and newest-post dates per feed are on the board, taken by the run.

Rows that need an editorial answer rather than a code change:

- **`europe` does not exist.** `wp/v2/categories?slug=europe` returns an empty list.
  There are `europa` (177) and `europa-aktuelles` (1319). Whether
  either is CORRECTIV.Europe's output is not a question the API can answer. The app
  currently shows the project as a teaser and loads nothing.
- **`lokal` has published nothing since 2025-05-28.** The project works; the category
  does not. The app presents it as a content source. That date is the argument behind
  question 3, so `apps/workbench/test/sources.test.ts` holds the manifest's "stale"
  against the run and fails if the feed starts moving again — at which point the
  question has answered itself and this paragraph is wrong.
- **`salon5` as a category is nearly empty**, which is correct: Salon5 publishes audio.
  The audio is connected separately, below.

### Newsletter archive

`wp/v2/newspack_nl_cpt`, a public post type: every issue carries title, date, teaser,
link and full text, and the run counts them off the archive's own `X-WP-Total`. The
app reads the newest twelve for Home's briefing and the archive screen. An issue links out to correctiv.org rather than into the reader,
because `content.rendered` is the sent email, table layout and all.

### Search

`wp/v2/search` over correctiv.org, with the already-loaded feeds as an offline
fallback. This path has always sent a CORS header, so it works on the web target too,
and it is the one live source the board could have measured for itself. It is measured
in the run with the rest, so that no live row on the board has to say why it was left
out.

### Audio

- **Podcasts**: CORRECTIV's own Castopod at `salon5.correctiv.net`, standard podcast
  RSS per show at `/@<handle>/feed.xml`, real MP3 enclosures. The app lists
  `pausenbrot`, `klima`, `salon5_erklart`, `politik`, `europa_was_geht`, `sport` and
  `pyjama_party`; the run lists every handle the instance carries, and the ones the app
  does not read include **local shows**: `bottrop`, `chemnitz`, `dortmund`,
  `greifswald`, `hamburg`. Which of them belong in the app is an editorial question and
  is deliberately not answered in code. The instance publishes no listing API, so the
  run reads the handles off its front page and says so loudly when that stops working.
- **Live radio**: Icecast at `icecast.correctiv.net`, several mounts — `salon5low`
  (64 kbit/s), `salon5` (128), `sacharow` (Radio Sakharov, 128). One status document
  answers for all of them, so the board carries a row each with its bitrate, its
  listeners and what was playing. The app plays the 64 kbit/s mount and lists Sakharov
  as an outbound link only.

### Video

- **YouTube**, Atom feeds: `CORRECTIV im Gespräch` (playlist) is shown; the main
  channel feed is configured and **shown nowhere**; the FunFacts channel feed is
  legacy, since FunFacts moved to PeerTube.
- **PeerTube**, CORRECTIV's own instance `tube.funfacts.de`. The app reads **one**
  channel, `funfacts.de`. The others are `marc_uwe_kling`, `tommy_krappweis`,
  `lennart_funfacts`, `pia_kanal`, `daniels_kanal`, `robins_kanal`, `support`,
  `root_channel`; the run counts the videos across all of them.

## What the requirements want, with no source

Every item here is in the feature scope. None of them has anything to read.

| Wanted | Marked MVP | Status |
| --- | --- | --- |
| Daily podcasts | yes | "Was zählt" has run since 2026-06-22, weekday evenings. It is **not** on the Salon5 Castopod, so its feed URL is unknown. A "Morgen-Podcast" is named with the note "(in konzeption)". |
| Time-based modules: morning podcast, evening Spotlight + "Was zählt" | yes | The mechanism exists: a section of `packages/app-core/src/data/home.layout.json` restricts itself to a daypart, and `packages/app-core/src/lib/daypart.ts` is the clock under it. Both MVP slots have no section at all because of the row above. |
| Vertical video | yes | No source named. CORRECTIV's PeerTube is running and the player exists. |
| All events | yes | Nothing in the repo and no source named. One sample event sits in the Backstage screen. |
| Local newsletter posts for subscribers | yes | The entitlement carries `localAreas`; the profile prints them, and nothing selects content by them. The five local Castopod shows are one candidate, the local Spotlight newsletters another; the requirements themselves ask "differences between local Spotlights and Lokal Redaktion?" |
| Topic and series directory on the new taxonomy | yes | A directory exists on today's ordering. The new taxonomy is "tbd". |
| Sections by Ressort or Beat, weighted ordering | yes | "tbd, either Ressorts or Beats". |
| Audio versions of articles, summaries, quizzes | no | Named as the app's exclusive formats. None exists. correctiv.org announced a Spotlight podcast with an AI voice on 2025-06-30; whether it still runs, and whether it is the "Morgen-Podcast", is a question for the newsroom. |

## Sample data standing in for a source

These files are typed in the shape of the API that will replace them, so that
connecting the real one is a data-layer swap. They are listed because on screen they
are indistinguishable from live content.

| File | Stands in for |
| --- | --- |
| `data/callouts.ts` | beabee CrowdNewsroom callouts, in beabee's own `CalloutDto` schema |
| `data/claims.ts` | the Faktenforum GraphQL backend, in its response shape |
| `data/backstage.ts` | club content: early access, diaries, bonus audio, **events**. No API exists |
| `data/abriss-atlas.ts` | abriss-atlas.de, which has no public API |
| `data/quartalsbericht.ts` | the transparency report, built from real published figures |
| `data/search-samples.ts` | search hits for content not in the feeds. Real titles |
| `data/podcasts.ts` | offline seed only. **It invents a "CORRECTIV Podcast" series** that has no source |
| `data/spotlight.ts` | offline seed: four real issues from the end of August 2026 |
| `data/projects.ts` | the Entdecken directory, ordered per the concept |

## The questions this document exists to get answered

1. Ressorts or Beats, and in what order, for Home.
2. `europe`: `europa`, `europa-aktuelles`, both, or neither.
3. `lokal`: keep presenting a category that has published nothing since May 2025?
4. Which of the Castopod instance's shows belong in the app, and whether the five local
   ones fill the local section.
5. Where the "Was zählt" feed lives.
6. Whether the "Morgen-Podcast" exists, or is the 2025 AI-voiced Spotlight podcast.
7. "Evening Spotlight": the newsletter, or the podcast that is "in konzeption"? The app
   currently treats Spotlight as a morning newsletter.
8. Which platform holds vertical video.
9. Where events come from.
10. Whether the unused YouTube main channel should be shown.
