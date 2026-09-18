/**
 * What the app reads, declared once so no page has to count it again.
 *
 * `SOURCES.md` is the prose version and stays the document of record: it carries
 * the argument, the editorial questions and the figures. This file carries the
 * part a machine can check, which is exactly the part that rots when a website
 * renders a hand-written table and nobody notices the code moved underneath it.
 *
 * The split is deliberate and is the honest one:
 *
 *   STATUS IS DERIVABLE. Whether a screen is fed by an endpoint or by a checked-in
 *   file is a fact about this repository, so `test/sources.test.ts` fails when a
 *   file appears in `packages/app-core/src/data/` with no entry here. The board
 *   cannot quietly disagree with the code.
 *
 *   MEASUREMENTS ARE NOT IN THIS FILE ANY MORE. They were, and they were taken
 *   by hand, because a browser cannot re-take them: the RSS feeds send no CORS
 *   header. Node has no CORS, so `scripts/measure-sources.mjs` takes them against
 *   the live sources and writes `sources.measured.ts`, which this file imports
 *   and joins onto the rows below. Hand-written here is the ARGUMENT — what a
 *   feed is for, why a stale one is stale, which editorial question a row is
 *   blocking. Generated there is every number that moves, and they do move: the
 *   newsletter archive was typed as 525 issues and measured as 536, PeerTube as
 *   185 videos and measured as 198.
 *
 *   THE MEASURING DAY IS NOW TYPED NOWHERE. `MEASURED_ON` below is read off the
 *   generated run rather than stated, which retires the pair AGENTS.md used to
 *   ask somebody to keep in step with `SOURCES.md` by hand. The site still works
 *   the age out in the reader's browser (`src/lib/measured.ts`): the date is the
 *   fact, the distance from today to it is the part that cannot be baked into a
 *   page that then sits at its address for months.
 */
import { MEASURED } from './sources.measured';

/** The last run, re-exported so a page reads the manifest and not the generator. */
export { MEASURED };

/**
 * What one probe of `scripts/measure-sources.mjs` found.
 *
 * The type lives here and not in the generated file on purpose: a generated file
 * that also declared the type would take the type with it the first time the
 * generator was rewritten, and nothing would notice until the import broke.
 *
 * `ok: false` is a finding, never an error. A source that is down, slow or has
 * moved reads as a row with a reason on it, and nothing in this repository turns
 * that red — see the script's header for what "unreachable" is defined as.
 */
export interface Probe {
  /** `feed:lokal`, `mount:salon5low`, … Stable, and what a row is joined by. */
  id: string;
  label: string;
  kind:
    | 'feed'
    | 'category'
    | 'newsletter'
    | 'search'
    | 'stream'
    | 'podcast'
    | 'peertube'
    | 'youtube';
  url: string;
  ok: boolean;
  /** Present exactly when `ok` is false, in the script's own words. */
  reason?: string;
  status?: number;
  /** Wall-clock for the request, retries included. */
  ms: number;
  /** Items in the document the source answered with — a page, not an archive. */
  items?: number;
  /** The newest item's day, ISO. */
  newest?: string;
  /** Posts in the archive behind it, which is a different question from `items`. */
  posts?: number;
  bitrateKbps?: number;
  listeners?: number;
  nowPlaying?: string | null;
  /** How many of a thing the source carries, and how many the app reads. */
  available?: number;
  used?: number;
  /** The names behind `available`, so a count can be checked rather than believed. */
  names?: string[];
}

export interface MeasuredRun {
  /** ISO instant. The one place the measuring day is written down. */
  measuredAt: string;
  /** Which machine took it: a geo-blocked source answers one and not the other. */
  where: string;
  timeoutMs: number;
  attempts: number;
  probes: Probe[];
}

/** Every probe of the last run, by id. */
export const PROBES: ReadonlyMap<string, Probe> = new Map(
  MEASURED.probes.map((probe) => [probe.id, probe]),
);

/** Whether a thing on screen is fed by a real source, by a file, or by nothing yet. */
export type Status = 'live' | 'sample' | 'no-source';

/** For a live source, whether it is actually delivering. */
export type Health = 'healthy' | 'stale' | 'broken';

export type Kind =
  | 'articles'
  | 'newsletter'
  | 'search'
  | 'audio'
  | 'video'
  | 'club'
  | 'community'
  | 'directory';

export interface SourceEntry {
  id: string;
  label: string;
  kind: Kind;
  status: Status;
  health?: Health;
  /** The endpoint, for a live source. */
  endpoint?: string;
  /** The module in the core, repository-relative. Checked by the test. */
  module?: string;
  /** For sample data, the API it is shaped like and waiting for. */
  standsIn?: string;
  /** Whether the requirements mark the missing thing as MVP. */
  mvp?: boolean;
  note: string;
  /** Numbers into `QUESTIONS` below, so a row shows what it is blocking. */
  questions?: number[];
  /**
   * The probe in the run that speaks for this entry, where one does.
   *
   * A row with one prints what the last run found beside what it is for; a row
   * without is sample data or a wanted feature, and there is nothing to measure.
   */
  probe?: string;
}

/**
 * The day the figures on this page were taken — read, never typed.
 *
 * It used to be a literal here and the same literal in `SOURCES.md`'s opening
 * paragraph, with a test holding the two together. That is the shape AGENTS.md
 * calls a fact in two places, and the reason it needed a test was that nothing
 * else could notice them parting. Now there is one place: the run.
 */
export const MEASURED_ON = MEASURED.measuredAt.slice(0, 10);

export interface Feed {
  /** Joins to `feed:<key>` and `category:<key>` in the run. The core's own key. */
  key: string;
  label: string;
  category: string;
  health: Health;
  note?: string;
}

/**
 * The article feeds, configured in `packages/app-core/src/data/feeds.config.ts`.
 *
 * No counts and no dates here. `key` joins each row to `feed:<key>` and
 * `category:<key>` in the run, and `feedFigures` below reads them off it. What is
 * typed is the judgement and the sentence behind it, which is the half a machine
 * cannot take.
 */
export const FEEDS: Feed[] = [
  {
    key: 'recherchen',
    label: 'Recherchen',
    category: 'the site-wide feed, no category',
    health: 'healthy',
  },
  { key: 'faktencheck', label: 'Faktencheck', category: 'faktencheck (5)', health: 'healthy' },
  { key: 'klima', label: 'Klima', category: 'klimawandel (94)', health: 'healthy' },
  { key: 'schweiz', label: 'CORRECTIV.Schweiz', category: 'schweiz (2568)', health: 'healthy' },
  {
    key: 'lokal',
    label: 'CORRECTIV.Lokal',
    category: 'lokal (1017)',
    health: 'stale',
    note: 'The project works; the category does not — it has published nothing since May 2025. The app presents it as a content source. `test/sources.test.ts` holds this judgement against the run and fails when the feed starts moving again, because question 3 would then have answered itself.',
  },
  {
    key: 'salon5',
    label: 'Salon5',
    category: 'salon5 (1241)',
    health: 'stale',
    note: 'Correctly so, and stale since December 2025: Salon5 publishes audio, which is connected separately.',
  },
  {
    key: 'europe',
    label: 'CORRECTIV.Europe',
    category: 'no such category',
    health: 'broken',
    note: '`wp/v2/categories?slug=europe` returns an empty list, which is what the run measures and what `available: 0` on its row means. `europa` (177) and `europa-aktuelles` (1319) exist — both were read off the CMS on 2026-09-01 and neither is configured, so nothing probes them; whether either is this project’s output is not a question the API can answer. The app shows the project as a teaser and loads nothing.',
  },
];

/**
 * What the last run found for one feed, as the two answers a row prints.
 *
 * A selector and not a field, because the figures belong to the run and the row
 * belongs to this file. `unknown` is a real answer and is drawn as one: it means
 * the source did not answer, which is different from a feed with no posts.
 *
 * **It hands out the finding and not the sentence**, which it did not always do.
 * It used to return two ready strings, and one of them was
 * `posts.toLocaleString('en-GB')`: a locale pinned in a ledger, which is the
 * page's job done in the wrong place.
 *
 * It became visible while `/sources` was being translated, not before. The page
 * migrated first and put its own figures through the formatter, so for one
 * commit the German board grouped `7.822` its own way and `2.956` the English
 * way, from two lines a few files apart. A first version of this paragraph told
 * that as a fact about `main`, where both figures went through the same pinned
 * locale and the page had no German at all; a cold review measured it and there
 * was no such page to see it on. The bug was real, the story was not.
 *
 * This file is the ledger [ADR 0052](../../../adr/0052-the-sites-own-words-follow-the-setting.md) §4
 * fences off, and that fence is around its WORDS. A number grouped for one
 * language is not a word it wrote, it is the page's job done in the wrong place,
 * so the shape moved here and the wording moved to `pages/Sources.tsx`.
 */
export type FeedCount =
  | { kind: 'everyPost' }
  | { kind: 'none' }
  | { kind: 'unknown' }
  | { kind: 'count'; posts: number };

export type FeedNewest = { kind: 'none' } | { kind: 'unknown' } | { kind: 'day'; day: string };

export function feedFigures(feed: Feed): {
  posts: FeedCount;
  newest: FeedNewest;
  measured: boolean;
} {
  const document = PROBES.get(`feed:${feed.key}`);
  const archive = PROBES.get(`category:${feed.key}`);

  const posts: FeedCount =
    archive === undefined
      ? // Only `recherchen` has no category, because it is every post.
        { kind: 'everyPost' }
      : archive.ok && archive.posts !== undefined
        ? // `available: 0` is the slug lookup coming back empty, which is the
          // category not existing. The row already says so in its own column, so
          // this one states the consequence and does not repeat the sentence.
          archive.available === 0
          ? { kind: 'none' }
          : { kind: 'count', posts: archive.posts }
        : { kind: 'unknown' };

  /*
   * Three answers, and the middle one is the one worth having. A feed that
   * answered with an empty channel has no newest post and that is a fact;
   * `unknown` is reserved for a feed that did not answer at all, so the page
   * never dresses an outage up as an empty category.
   */
  const newest: FeedNewest =
    document?.ok === true
      ? document.newest !== undefined
        ? { kind: 'day', day: document.newest }
        : document.items === 0
          ? { kind: 'none' }
          : { kind: 'unknown' }
      : { kind: 'unknown' };

  return { posts, newest, measured: document?.ok === true || archive?.ok === true };
}

/**
 * Connected, and only partly used. Its own kind of finding.
 *
 * `available` is read off the run where there is a probe for it, so the three
 * measurable rows carry no number here. YouTube's does, and it is not a
 * measurement at all: three feeds are configured in the core and one is shown, a
 * fact about this repository that no request could answer and that therefore
 * needs no date.
 */
export interface Gap {
  label: string;
  /** How many the app reads. A fact about the configuration. */
  used: number;
  /** The probe that counts what exists, or a typed number when nothing can. */
  probe?: string;
  available?: number;
  note: string;
}

export const UNUSED: Gap[] = [
  {
    label: 'Castopod shows',
    used: 7,
    probe: 'castopod:instance',
    note: 'The unlisted ones include five local shows: Bottrop, Chemnitz, Dortmund, Greifswald, Hamburg. The instance publishes no listing API, so the count is read off its front page and fails loudly when that markup changes.',
  },
  {
    label: 'PeerTube channels',
    used: 1,
    probe: 'peertube:channels',
    note: 'CORRECTIV’s own instance. The app reads `funfacts.de` only; `peertube:videos` counts what is on the rest.',
  },
  {
    label: 'YouTube feeds',
    used: 1,
    available: 3,
    note: 'Configured in the core and counted from it, not measured. The main channel feed is configured and shown nowhere; one is legacy since FunFacts moved to PeerTube. Each feed’s own `youtube:<key>` row says whether it still answers.',
  },
  {
    label: 'Icecast mounts',
    used: 1,
    probe: 'mount:salon5low',
    note: 'The app plays the 64 kbit/s mount; Radio Sakharov is an outbound link only. One status document answers for all three, so the three rows share a request and share its failure.',
  },
];

/** How many of a partly-used source exist, measured where anything can measure it. */
export function gapAvailable(gap: Gap): number | undefined {
  if (gap.probe === undefined) return gap.available;
  const probe = PROBES.get(gap.probe);
  return probe?.ok === true ? probe.available : undefined;
}

export const SOURCES: SourceEntry[] = [
  {
    id: 'articles',
    label: 'Articles',
    kind: 'articles',
    status: 'live',
    health: 'healthy',
    endpoint: 'wp/v2/posts, by category id',
    module: 'packages/app-core/src/data/feeds.config.ts',
    note: 'WordPress REST, with the RSS feed of the same category as the fallback path. Ids and not slugs, because a slug is editable in wp-admin. Seven feeds, three of which need an editorial answer rather than a code change.',
    questions: [2, 3],
  },
  {
    id: 'newsletter',
    label: 'Newsletter archive',
    kind: 'newsletter',
    status: 'live',
    health: 'healthy',
    endpoint: 'wp/v2/newspack_nl_cpt',
    probe: 'newsletter:issues',
    note: 'A public post type: every issue carries title, date, teaser, link and full text, and the run counts them off the archive’s own `X-WP-Total`. The app reads the newest twelve for Home’s briefing. An issue links out to correctiv.org rather than into the reader, because the stored content is the sent email, table layout and all.',
    questions: [7],
  },
  {
    id: 'search',
    label: 'Search',
    kind: 'search',
    status: 'live',
    health: 'healthy',
    endpoint: 'wp/v2/search',
    module: 'packages/app-core/src/services/search.service.ts',
    probe: 'search:results',
    note: 'Over correctiv.org, with the already-loaded feeds as an offline fallback. This path has always sent a CORS header, so it works on the web target too.',
  },
  {
    id: 'podcasts',
    label: 'Podcasts',
    kind: 'audio',
    status: 'live',
    health: 'healthy',
    endpoint: 'salon5.correctiv.net, podcast RSS per show',
    module: 'packages/app-core/src/services/podcast.service.ts',
    probe: 'castopod:instance',
    note: 'CORRECTIV’s own Castopod, real MP3 enclosures. Which of the instance’s shows belong in the app is an editorial question and is deliberately not answered in code; the gap above counts them.',
    questions: [4],
  },
  {
    id: 'radio',
    label: 'Live radio',
    kind: 'audio',
    status: 'live',
    health: 'healthy',
    endpoint: 'icecast.correctiv.net, three mounts',
    module: 'packages/app-core/src/services/radio.service.ts',
    probe: 'mount:salon5low',
    note: 'Three mounts on one server, each with its own row in the run: bitrate, listeners and what was playing. The app plays the 64 kbit/s mount; Radio Sakharov is an outbound link only.',
  },
  {
    id: 'youtube',
    label: 'Video, YouTube',
    kind: 'video',
    status: 'live',
    health: 'healthy',
    endpoint: 'YouTube Atom feeds',
    probe: 'youtube:gespraech',
    note: '"CORRECTIV im Gespräch" is shown. The main channel feed is configured and shown nowhere; the FunFacts feed is legacy, since FunFacts moved to PeerTube. All three are probed, so a feed that stops answering shows up even though nothing reads it.',
    questions: [10],
  },
  {
    id: 'peertube',
    label: 'Video, PeerTube',
    kind: 'video',
    status: 'live',
    health: 'healthy',
    endpoint: 'tube.funfacts.de',
    module: 'packages/app-core/src/services/peertube.service.ts',
    probe: 'peertube:videos',
    note: 'CORRECTIV’s own instance. The app reads one channel, `funfacts.de`; `peertube:videos` and `peertube:channels` say how much is on the rest.',
    questions: [8],
  },

  {
    id: 'callouts',
    label: 'Callouts',
    kind: 'community',
    status: 'sample',
    module: 'packages/app-core/src/data/callouts.ts',
    standsIn: 'beabee CrowdNewsroom callouts, in beabee’s own CalloutDto schema',
    note: 'Typed in the shape of the API that will replace it, so connecting the real one is a data-layer swap.',
  },
  {
    id: 'claims',
    label: 'Claims',
    kind: 'community',
    status: 'sample',
    module: 'packages/app-core/src/data/claims.ts',
    standsIn: 'the Faktenforum GraphQL backend, in its response shape',
    note: 'Typed in the shape of the API that will replace it.',
  },
  {
    id: 'backstage',
    label: 'Backstage',
    kind: 'club',
    status: 'sample',
    module: 'packages/app-core/src/data/backstage.ts',
    standsIn: 'club content: early access, diaries, bonus audio, and events',
    note: 'No API exists. One sample event sits here, which is the whole of the app’s event support.',
    questions: [9],
  },
  {
    id: 'abriss-atlas',
    label: 'Abriss-Atlas',
    kind: 'community',
    status: 'sample',
    module: 'packages/app-core/src/data/abriss-atlas.ts',
    standsIn: 'abriss-atlas.de',
    note: 'The site has no public API.',
  },
  {
    id: 'quartalsbericht',
    label: 'Transparency report',
    kind: 'club',
    status: 'sample',
    module: 'packages/app-core/src/data/quartalsbericht.ts',
    standsIn: 'the transparency report',
    note: 'Built from real published figures.',
  },
  {
    id: 'search-samples',
    label: 'Search samples',
    kind: 'search',
    status: 'sample',
    module: 'packages/app-core/src/data/search-samples.ts',
    standsIn: 'search hits for content not in the feeds',
    note: 'Real titles.',
  },
  {
    id: 'podcast-seed',
    label: 'Podcast seed',
    kind: 'audio',
    status: 'sample',
    module: 'packages/app-core/src/data/podcasts.ts',
    standsIn: 'an offline seed only',
    note: 'It invents a "CORRECTIV Podcast" series that has no source, which is the one place a sample is not merely standing in for something real.',
  },
  {
    id: 'spotlight-seed',
    label: 'Spotlight seed',
    kind: 'newsletter',
    status: 'sample',
    module: 'packages/app-core/src/data/spotlight.ts',
    standsIn: 'an offline seed',
    note: 'Four real issues from the end of August 2026.',
  },
  {
    id: 'projects',
    label: 'The Entdecken directory',
    kind: 'directory',
    status: 'sample',
    module: 'packages/app-core/src/data/projects.ts',
    standsIn: 'the project directory',
    note: 'Ordered per the concept.',
    questions: [1],
  },
  {
    id: 'home-pins',
    label: 'What a home block can be pinned to',
    kind: 'articles',
    status: 'sample',
    module: 'packages/app-core/src/data/home-pins.ts',
    standsIn:
      'the WordPress query behind what may lead the app today, in the shape wp/v2/posts answers in',
    note: 'The home document lets a place be pinned to one article (ADR 0039 §4), so an editor picking one has to pick it from something. This is that something: six real articles out of the bundled snapshot, typed as FeedItem, which is what wp.service.ts maps a post into. The editor reads this row to mark the picker, so the marking goes when the query exists.',
    questions: [1],
  },

  {
    id: 'daily-podcast',
    label: 'Daily podcasts',
    kind: 'audio',
    status: 'no-source',
    mvp: true,
    note: '"Was zählt" has run since 2026-06-22 on weekday evenings. It is not on the Salon5 Castopod, so its feed URL is unknown. A "Morgen-Podcast" is named with the note "in konzeption".',
    questions: [5, 6],
  },
  {
    id: 'timed-modules',
    label: 'Time-based modules',
    kind: 'audio',
    status: 'no-source',
    mvp: true,
    module: 'packages/app-core/src/lib/home-layout.ts',
    note: 'The mechanism exists and grew: the home document is a day, a list of moments each carrying what changes at it, and this file folds it up to a minute (ADR 0036, ADR 0039). Both MVP slots, the morning podcast and the evening Spotlight, still have no section at all because of the row above.',
    questions: [6, 7],
  },
  {
    id: 'vertical-video',
    label: 'Vertical video',
    kind: 'video',
    status: 'no-source',
    mvp: true,
    note: 'No source named. CORRECTIV’s PeerTube is running and the player exists.',
    questions: [8],
  },
  {
    id: 'events',
    label: 'All events',
    kind: 'club',
    status: 'no-source',
    mvp: true,
    note: 'Nothing in the repository and no source named. One sample event sits in the Backstage screen.',
    questions: [9],
  },
  {
    id: 'local-newsletter',
    label: 'Local newsletter posts',
    kind: 'newsletter',
    status: 'no-source',
    mvp: true,
    note: 'The entitlement carries `localAreas` and the profile prints them; nothing selects content by them. The five local Castopod shows are one candidate, the local Spotlight newsletters another.',
    questions: [4],
  },
  {
    id: 'taxonomy',
    label: 'Topic and series directory, new taxonomy',
    kind: 'directory',
    status: 'no-source',
    mvp: true,
    note: 'A directory exists on today’s ordering. The new taxonomy is "tbd".',
    questions: [1],
  },
  {
    id: 'ressorts',
    label: 'Sections by Ressort or Beat',
    kind: 'directory',
    status: 'no-source',
    mvp: true,
    note: 'Weighted ordering, and "tbd, either Ressorts or Beats".',
    questions: [1],
  },
  {
    id: 'exclusive-formats',
    label: 'Audio versions, summaries, quizzes',
    kind: 'articles',
    status: 'no-source',
    mvp: false,
    note: 'Named as the app’s exclusive formats. None exists. correctiv.org announced a Spotlight podcast with an AI voice on 2025-06-30; whether it still runs is a question for the newsroom.',
    questions: [6],
  },
];

/** The questions this page exists to get answered. Rows point at them by number. */
export const QUESTIONS: string[] = [
  'Ressorts or Beats, and in what order, for Home.',
  '`europe`: `europa`, `europa-aktuelles`, both, or neither.',
  '`lokal`: keep presenting a category that has published nothing since May 2025?',
  'Which of the Castopod instance’s shows belong in the app, and whether the five local ones fill the local section.',
  'Where the "Was zählt" feed lives.',
  'Whether the "Morgen-Podcast" exists, or is the 2025 AI-voiced Spotlight podcast.',
  '"Evening Spotlight": the newsletter, or the podcast that is "in konzeption"? The app currently treats Spotlight as a morning newsletter.',
  'Which platform holds vertical video.',
  'Where events come from.',
  'Whether the unused YouTube main channel should be shown.',
];

/**
 * Files in `packages/app-core/src/data/` that are not content and need no entry.
 *
 * Kept short on purpose. Every addition here is a file the board stops watching,
 * so it should be obvious from the name why it is not a source.
 */
export const NOT_CONTENT = ['feeds.config.ts', 'interests.ts'];

export const COUNTS = {
  live: SOURCES.filter((s) => s.status === 'live').length,
  sample: SOURCES.filter((s) => s.status === 'sample').length,
  noSource: SOURCES.filter((s) => s.status === 'no-source').length,
  stale: FEEDS.filter((f) => f.health === 'stale').length,
  broken: FEEDS.filter((f) => f.health === 'broken').length,
  questions: QUESTIONS.length,
};
