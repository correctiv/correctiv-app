#!/usr/bin/env node
/*
 * Every source the app reads, measured against the live one, from Node.
 *
 *   node apps/workbench/scripts/measure-sources.mjs [--dry-run] [--only <substring>]
 *
 * WHY THIS IS A SCRIPT AND NOT A PAGE. The board at `/sources` printed figures
 * somebody had taken by hand, and said so, because a browser cannot re-take
 * them: the seven `/feed/` URLs and the Icecast status document send no
 * `Access-Control-Allow-Origin`, so the fetch fails before the response is
 * looked at. Node has no CORS. It also reaches the sources a page never could,
 * which is the difference between measuring the subset a browser can see and
 * measuring all of them.
 *
 * WHAT IT MEASURES, and why each one is here rather than typed into the
 * manifest: every figure below used to be a number in `content/sources.manifest.ts`
 * or in `SOURCES.md` with a date beside it, and every one of them had already
 * moved by the time this was written — 525 newsletter issues measured as 536,
 * 185 PeerTube videos as 198.
 *
 *   feed:<key>        the RSS document of each configured feed: how many items it
 *                     carries and the newest item's date. The item count is the
 *                     feed's PAGE SIZE (WordPress sends ten), not the archive.
 *   category:<key>    `wp/v2/categories`, which is where the archive size comes
 *                     from. `europe` is looked up by slug on purpose: the answer
 *                     being an empty list is the measurement.
 *   newsletter:issues `wp/v2/newspack_nl_cpt`, counted from the `X-WP-Total`
 *                     header rather than by paging the post type.
 *   search:results    `wp/v2/search`, the same way. The one live source a browser
 *                     could measure itself, measured here so the board has no row
 *                     that says "not probed" for a reason a reader cannot guess.
 *   mount:<name>      Icecast. One GET of `status-json.xsl` answers for all three
 *                     mounts, so three rows share one request and share its
 *                     failure. Never HEAD: Icecast answers HEAD with 400.
 *   castopod:instance how many shows the Salon5 Castopod carries, read off the
 *                     instance's own front page. HTML and not an API, because
 *                     this Castopod exposes none: /api/rest/v1/podcasts,
 *                     /index.json, /podcasts and /.well-known/nodeinfo all
 *                     answer 404 (checked 2026-09-16). It therefore fails as a
 *                     row when the markup changes, which is the point — a
 *                     reported failure beats a number nobody re-took.
 *   peertube:*        the instance's own API: total videos, total channels.
 *   youtube:<key>     each configured Atom feed, reachable and how recent.
 *
 * THE NUMBERS THIS RUN IS MADE OF, stated rather than left to a default:
 *
 *   TIMEOUT_MS = 10_000   Measured from a developer machine on 2026-09-16, every
 *                         correctiv.org endpoint answered between 190 ms and
 *                         270 ms. Ten seconds is roughly forty times that, so a
 *                         slow morning is not a failure, and twenty-two requests
 *                         still cannot hold a runner for longer than the retry
 *                         budget below.
 *   ATTEMPTS = 2          One retry. A dropped connection is worth a second look;
 *                         a source that is down is still down two seconds later,
 *                         and a third attempt would mostly re-measure the same
 *                         outage while tripling the worst case.
 *   RETRY_PAUSE_MS = 2000 Long enough that the retry is not part of the same
 *                         hiccup, short enough to stay inside the budget.
 *
 *   Worst case is therefore 22 requests x 2 attempts x 10 s plus 22 pauses, a
 *   little over seven minutes, and that is the number the workflow's timeout is
 *   set from.
 *
 * UNREACHABLE means, exactly: after both attempts, either no response at all
 * (DNS, TLS, connection, or the timeout), or a response whose status is not 2xx,
 * or a body that does not parse as the format the source is supposed to send.
 * All three are recorded as `ok: false` with the reason in the row's own words,
 * and none of them is an error the caller sees: this script exits 0 when a
 * source is down. It exits non-zero in exactly two places, and both are this
 * script being broken rather than anything about a source: the row-count guard at
 * the bottom, which is there because a check that can report "nothing to report"
 * and pass is not a check, and `format`, because a file oxfmt cannot parse is a
 * file nothing should commit.
 *
 * The targets are read out of `packages/app-core/src/data/feeds.config.ts`, the
 * app's own configuration, and never copied. A feed added there is measured here
 * without anybody editing this file, and `test/sources.test.ts` fails when the
 * committed run has not caught up.
 */

/*
 * eslint-disable no-await-in-loop -- The requests are serial on purpose, and
 * `Promise.all` is the wrong shape here twice over. Twenty-two requests fired at
 * once is a burst at somebody else's newsroom from a machine that is only asking
 * how their feeds are doing; and the whole run finishes in about two seconds
 * serially, so parallelism buys nothing while making the console output arrive in
 * whichever order the network decides, which is the evidence this script exists
 * to print.
 */
/* eslint-disable no-await-in-loop */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBENCH = join(HERE, '..');
const ROOT = join(WORKBENCH, '..', '..');
const OUT = join(WORKBENCH, 'content/sources.measured.ts');

const CONFIG = join(ROOT, 'packages/app-core/src/data/feeds.config.ts');
const {
  FEEDS,
  PODCAST_CHANNELS,
  PODCAST_HOST,
  PEERTUBE_CHANNELS,
  RADIO_MOUNTS,
  RADIO_STREAM_URL,
  YOUTUBE_FEEDS,
} = await import(CONFIG);

const TIMEOUT_MS = 10_000;
const ATTEMPTS = 2;
const RETRY_PAUSE_MS = 2000;

/** The WordPress REST root the two article probes share. */
const WP = 'https://correctiv.org/wp-json/wp/v2';
const PEERTUBE = 'https://tube.funfacts.de/api/v1';

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1]
  : undefined;
/*
 * `--only` never writes, and finding that out cost a bad file: a run narrowed to
 * one source wrote a two-row file over a twenty-four-row one, which every
 * consumer would have read as "the other twenty-two no longer exist". Narrowing
 * is for looking at one source while working on its probe, so it is a dry run by
 * construction rather than by remembering to pass the flag.
 */
const dryRun = process.argv.includes('--dry-run') || only !== undefined;

/* -------------------------------------------------------------------------- */
/* Fetching                                                                   */
/* -------------------------------------------------------------------------- */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * One source, fetched, with the retry and the timeout the header describes.
 *
 * Always resolves. A rejection here would be a second way for a source being
 * down to reach the caller, and the caller has exactly one: `ok: false`.
 */
async function get(url, { accept } = {}) {
  const started = Date.now();
  let reason = 'never attempted';

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(RETRY_PAUSE_MS);
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: 'follow',
        headers: {
          // Named, so a 403 from a bot filter is a fact about this script rather
          // than a mystery. correctiv.org serves the feeds to anything today.
          'user-agent':
            'correctiv-app-sources-measure/1 (+https://github.com/correctiv/correctiv-app)',
          ...(accept ? { accept } : {}),
        },
      });
      if (!response.ok) {
        reason = `HTTP ${response.status} ${response.statusText}`.trim();
        // A 4xx is an answer, not a hiccup, and retrying it wastes the budget on
        // a result that will not change. 5xx and 429 are worth the second look.
        if (response.status < 500 && response.status !== 429) {
          return { ok: false, reason, status: response.status, ms: Date.now() - started };
        }
        continue;
      }
      const body = await response.text();
      return { ok: true, status: response.status, body, ms: Date.now() - started };
    } catch (thrown) {
      reason =
        thrown?.name === 'TimeoutError'
          ? `no answer within ${TIMEOUT_MS} ms`
          : `${thrown?.name ?? 'Error'}: ${thrown?.message ?? String(thrown)}`;
    }
  }

  return {
    ok: false,
    reason: `${reason} (${ATTEMPTS} attempts)`,
    ms: Date.now() - started,
  };
}

/* -------------------------------------------------------------------------- */
/* Reading what came back                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The newest date in a feed document, as an ISO day.
 *
 * The maximum and not the first entry: RSS convention puts the newest first and
 * conventions are not guarantees, and a feed that has been re-sorted would
 * otherwise be reported as fifteen months old the day it is fixed.
 */
function newestDate(xml, tags) {
  const stamps = [];
  for (const tag of tags) {
    for (const match of xml.matchAll(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'g'))) {
      const parsed = Date.parse(match[1].trim());
      if (!Number.isNaN(parsed)) stamps.push(parsed);
    }
  }
  if (stamps.length === 0) return undefined;
  return new Date(Math.max(...stamps)).toISOString().slice(0, 10);
}

function countTags(xml, tag) {
  return [...xml.matchAll(new RegExp(`<${tag}[\\s>]`, 'g'))].length;
}

/**
 * A feed document, read as one.
 *
 * Zero items is an ANSWER and not a failure, and the distinction cost a rewrite:
 * `/category/europe/feed/` returns 965 bytes of valid RSS with an empty channel,
 * which is the exact fact the app's configuration claims about that category.
 * Reporting it as unreachable would have filed a measurement as an outage. What
 * is a failure is a body that is not a feed at all — a landing page, an error
 * page, a login wall — and that is what the envelope test below is for.
 */
function readFeed(body, itemTag, dateTags) {
  if (!/<(rss|feed|channel)[\s>]/.test(body)) {
    return { ok: false, reason: 'the answer is not a feed document' };
  }
  return { ok: true, items: countTags(body, itemTag), newest: newestDate(body, dateTags) };
}

function readJson(body) {
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch (thrown) {
    return { ok: false, reason: `the answer is not JSON: ${thrown.message}` };
  }
}

/* -------------------------------------------------------------------------- */
/* The probes                                                                 */
/* -------------------------------------------------------------------------- */

/** Every row this run produces, in the order they are measured. */
const probes = [];

function record(row) {
  probes.push(row);
  const head = row.ok ? 'ok    ' : 'FAILED';
  const found = row.ok ? describe(row) : row.reason;
  console.log(`${head}  ${row.id.padEnd(26)}  ${String(row.ms).padStart(5)} ms  ${found}`);
}

/** What a row found, as one line, so the console run is the evidence too. */
function describe(row) {
  const parts = [];
  if (row.posts !== undefined) parts.push(`${row.posts} posts`);
  if (row.items !== undefined) parts.push(`${row.items} items`);
  if (row.newest !== undefined) parts.push(`newest ${row.newest}`);
  if (row.available !== undefined) {
    parts.push(
      row.used === undefined ? `${row.available} found` : `${row.used} of ${row.available} used`,
    );
  }
  if (row.bitrateKbps !== undefined) parts.push(`${row.bitrateKbps} kbit/s`);
  if (row.listeners !== undefined) parts.push(`${row.listeners} listeners`);
  if (row.nowPlaying) parts.push(`playing "${row.nowPlaying}"`);
  return parts.join(', ') || 'reachable';
}

const wanted = (id) => only === undefined || id.includes(only);

/** The seven RSS documents, which is the half of the app's article path that has no CORS. */
async function measureFeeds() {
  for (const [key, feed] of Object.entries(FEEDS)) {
    const id = `feed:${key}`;
    if (!wanted(id)) continue;
    const answer = await get(feed.url, { accept: 'application/rss+xml, application/xml' });
    const base = { id, label: feed.label, kind: 'feed', url: feed.url, ms: answer.ms };
    if (!answer.ok) {
      record({ ...base, ok: false, reason: answer.reason, status: answer.status });
      continue;
    }
    const read = readFeed(answer.body, 'item', ['pubDate', 'dc:date']);
    record(
      read.ok
        ? { ...base, ok: true, status: answer.status, items: read.items, newest: read.newest }
        : { ...base, ok: false, status: answer.status, reason: read.reason },
    );
  }
}

/**
 * The category behind each feed, which is where a post count comes from.
 *
 * `recherchen` has none — it is every post — and is the one feed with no row
 * here. `europe` has no id either, and is looked up by slug precisely because
 * the app's configuration claims the category does not exist: an empty list is
 * the evidence for that claim and `available: 0` is how the run states it.
 */
async function measureCategories() {
  for (const [key, feed] of Object.entries(FEEDS)) {
    if (feed.categoryId === undefined && feed.slug === undefined && !feed.empty) continue;
    const id = `category:${key}`;
    if (!wanted(id)) continue;

    const bySlug = feed.categoryId === undefined;
    // `categorySlug` and not `slug`: `test/slug.test.ts` forbids a second thing
    // called `slug` anywhere under this package, because the one that matters is
    // the heading slugifier and a second implementation of it produced dead
    // anchors. This is a WordPress category slug and unrelated, so it says so.
    const categorySlug = feed.slug ?? new URL(feed.url).pathname.split('/').filter(Boolean)[1];
    const url = bySlug
      ? `${WP}/categories?slug=${categorySlug}`
      : `${WP}/categories/${feed.categoryId}`;
    const answer = await get(url, { accept: 'application/json' });
    const base = { id, label: feed.label, kind: 'category', url, ms: answer.ms };
    if (!answer.ok) {
      record({ ...base, ok: false, reason: answer.reason, status: answer.status });
      continue;
    }
    const json = readJson(answer.body);
    if (!json.ok) {
      record({ ...base, ok: false, status: answer.status, reason: json.reason });
      continue;
    }
    if (bySlug) {
      const list = Array.isArray(json.value) ? json.value : [];
      record({
        ...base,
        ok: true,
        status: answer.status,
        available: list.length,
        posts: list.reduce((sum, category) => sum + (category.count ?? 0), 0),
        names: list.map((category) => category.slug),
      });
      continue;
    }
    record({
      ...base,
      ok: true,
      status: answer.status,
      posts: json.value.count ?? 0,
      names: [json.value.slug],
    });
  }
}

/**
 * How many rows a WordPress collection holds, from `X-WP-Total`.
 *
 * `per_page=1` and the header, rather than paging the collection: the archive is
 * over five hundred issues and the count is the only thing wanted. It needs its
 * own fetch because `get` above hands back a body and not the response, and the
 * number here is in neither the body nor the status.
 */
async function measureWpTotal({ id, label, kind, url }) {
  if (!wanted(id)) return;
  const started = Date.now();
  let total;
  let reason;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
    if (!response.ok) reason = `HTTP ${response.status}`;
    else {
      const header = response.headers.get('x-wp-total');
      if (header === null) reason = 'the answer carries no X-WP-Total header';
      else total = Number.parseInt(header, 10);
    }
  } catch (thrown) {
    reason =
      thrown?.name === 'TimeoutError'
        ? `no answer within ${TIMEOUT_MS} ms`
        : `${thrown?.name}: ${thrown?.message}`;
  }
  const base = { id, label, kind, url, ms: Date.now() - started };
  record(
    total === undefined || Number.isNaN(total)
      ? { ...base, ok: false, reason: reason ?? 'X-WP-Total was not a number' }
      : { ...base, ok: true, posts: total },
  );
}

/**
 * The three Icecast mounts, from one status document.
 *
 * They share a request and therefore share its failure, which is stated in each
 * row rather than hidden: reporting three separate outages for one unreachable
 * server would read as three problems.
 */
async function measureRadio() {
  const mounts = Object.values(RADIO_MOUNTS);
  const ids = mounts.map((mount) => `mount:${mount.name}`);
  if (!ids.some(wanted)) return;

  const url = 'https://icecast.correctiv.net/status-json.xsl';
  const answer = await get(url, { accept: 'application/json' });
  const played = new Set([RADIO_STREAM_URL]);

  if (!answer.ok) {
    for (const mount of mounts) {
      record({
        id: `mount:${mount.name}`,
        label: mount.name,
        kind: 'stream',
        url,
        ok: false,
        reason: `the server's status document is unreachable: ${answer.reason}`,
        status: answer.status,
        ms: answer.ms,
      });
    }
    return;
  }

  const json = readJson(answer.body);
  const raw = json.ok ? (json.value.icestats?.source ?? []) : [];
  // Icecast serialises one mount as an object and several as an array.
  const sources = Array.isArray(raw) ? raw : [raw];
  const byName = new Map(
    sources.map((source) => {
      const listen = source.listenurl ?? '';
      return [listen.slice(listen.lastIndexOf('/') + 1), source];
    }),
  );

  for (const mount of mounts) {
    const id = `mount:${mount.name}`;
    if (!wanted(id)) continue;
    const base = { id, label: mount.name, kind: 'stream', url, ms: answer.ms };
    if (!json.ok) {
      record({ ...base, ok: false, status: answer.status, reason: json.reason });
      continue;
    }
    const source = byName.get(mount.name);
    if (source === undefined) {
      record({
        ...base,
        ok: false,
        status: answer.status,
        // Not the same as "the server is down", and the board draws them apart.
        reason: `the server answered and carries no mount named ${mount.name}`,
        available: byName.size,
        names: [...byName.keys()].sort(),
      });
      continue;
    }
    record({
      ...base,
      ok: true,
      status: answer.status,
      bitrateKbps: source.bitrate ?? undefined,
      listeners: source.listeners ?? 0,
      // Icecast joins artist and title with " - " and keeps the separator when
      // one half is empty, so the raw value arrives as " - Something".
      nowPlaying: (source.title ?? '').replace(/^[\s\-–—]+|[\s\-–—]+$/g, '').trim() || null,
      available: byName.size,
      used: played.size,
      names: [...byName.keys()].sort(),
    });
  }
}

/**
 * How many shows the Salon5 Castopod carries, off its own front page.
 *
 * Scraped, and the header says why: this instance publishes no listing API. The
 * page links every show as `/@handle`, which is Castopod's own permalink shape,
 * so the set of handles is the set of shows.
 */
async function measurePodcasts() {
  const id = 'castopod:instance';
  if (!wanted(id)) return;
  const answer = await get(`${PODCAST_HOST}/`, { accept: 'text/html' });
  const base = {
    id,
    label: 'Castopod shows',
    kind: 'podcast',
    url: `${PODCAST_HOST}/`,
    ms: answer.ms,
  };
  if (!answer.ok) {
    record({ ...base, ok: false, reason: answer.reason, status: answer.status });
    return;
  }
  const handles = [
    ...new Set([...answer.body.matchAll(/\/@([A-Za-z0-9_]+)/g)].map((match) => match[1])),
  ].sort();
  if (handles.length === 0) {
    record({
      ...base,
      ok: false,
      status: answer.status,
      reason:
        'the front page linked no /@handle — Castopod’s markup has changed and this probe has to be rewritten',
    });
    return;
  }
  record({
    ...base,
    ok: true,
    status: answer.status,
    available: handles.length,
    used: PODCAST_CHANNELS.length,
    names: handles,
  });
}

/** CORRECTIV's own PeerTube: how much is on it, and how much the app reads. */
async function measurePeertube() {
  const read = Object.values(PEERTUBE_CHANNELS).flat();

  for (const [what, path] of [
    ['videos', 'videos?count=0'],
    ['channels', 'video-channels?count=100'],
  ]) {
    const id = `peertube:${what}`;
    if (!wanted(id)) continue;
    const url = `${PEERTUBE}/${path}`;
    const answer = await get(url, { accept: 'application/json' });
    const base = { id, label: `PeerTube ${what}`, kind: 'peertube', url, ms: answer.ms };
    if (!answer.ok) {
      record({ ...base, ok: false, reason: answer.reason, status: answer.status });
      continue;
    }
    const json = readJson(answer.body);
    if (!json.ok || typeof json.value.total !== 'number') {
      record({
        ...base,
        ok: false,
        status: answer.status,
        reason: json.ok ? 'the answer carries no numeric `total`' : json.reason,
      });
      continue;
    }
    record({
      ...base,
      ok: true,
      status: answer.status,
      available: json.value.total,
      ...(what === 'channels'
        ? {
            used: read.length,
            names: (json.value.data ?? []).map((channel) => channel.name).sort(),
          }
        : {}),
    });
  }
}

/** The three configured Atom feeds. Reachability and recency; the rest is a repo fact. */
async function measureYoutube() {
  for (const [key, url] of Object.entries(YOUTUBE_FEEDS)) {
    const id = `youtube:${key}`;
    if (!wanted(id)) continue;
    const answer = await get(url, { accept: 'application/atom+xml' });
    const base = { id, label: `YouTube ${key}`, kind: 'youtube', url, ms: answer.ms };
    if (!answer.ok) {
      record({ ...base, ok: false, reason: answer.reason, status: answer.status });
      continue;
    }
    const read = readFeed(answer.body, 'entry', ['published', 'updated']);
    record(
      read.ok
        ? { ...base, ok: true, status: answer.status, items: read.items, newest: read.newest }
        : { ...base, ok: false, status: answer.status, reason: read.reason },
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Writing it down                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The run, as a TypeScript module.
 *
 * TypeScript and not JSON, because `apps/workbench/tsconfig.json` does not set
 * `resolveJsonModule` and the manifest beside this file has to import it. The
 * types come from the manifest, which is hand-written and stays put: a generated
 * file that also declared the type nothing else could would take the type with
 * it the first time the generator was rewritten.
 *
 * Keys are emitted in a fixed order and the file ends with a newline, so a run
 * that measured the same thing twice produces the same bytes and the diff of a
 * scheduled run is only what actually moved.
 */
const ORDER = [
  'id',
  'label',
  'kind',
  'url',
  'ok',
  'reason',
  'status',
  'ms',
  'items',
  'newest',
  'posts',
  'bitrateKbps',
  'listeners',
  'nowPlaying',
  'available',
  'used',
  'names',
];

/**
 * One value, spelled the way oxfmt spells it.
 *
 * Single quotes unless the string carries one and no double quote, which is
 * oxfmt's own rule. Emitting JSON's double quotes instead worked and then lost:
 * `oxfmt --check` runs in `npm run check`, so the first scheduled run would have
 * committed a file that fails the repository's own format gate, and the workflow
 * that must not turn a pull request red would have turned every pull request red.
 * `emit` runs the formatter over its output afterwards as the belt to this brace.
 */
function literal(value) {
  if (value === null) return 'null';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  const text = String(value);
  const quote = text.includes("'") && !text.includes('"') ? '"' : "'";
  const escaped = text
    .replaceAll('\\', '\\\\')
    .replaceAll(quote, `\\${quote}`)
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r');
  return `${quote}${escaped}${quote}`;
}

/**
 * Timings, rounded to 50 ms before they are committed.
 *
 * The exact figure is in the console and in the step summary, where somebody is
 * reading this run. In the FILE it would be twenty-three lines of diff every
 * week, because 27 ms and 33 ms are the same answer and neither is news, and a
 * weekly pull request whose every line is noise is one nobody reads. Rounded,
 * jitter produces no diff at all and a source that went from 200 ms to three
 * seconds still shows up as one — which is the "slow" the issue asks to be
 * visible.
 */
function emitted(key, value) {
  return key === 'ms' ? Math.round(value / 50) * 50 : value;
}

function emit(run) {
  const rows = run.probes.map((probe) => {
    const fields = ORDER.filter((key) => probe[key] !== undefined).map(
      (key) => `    ${key}: ${literal(emitted(key, probe[key]))},`,
    );
    return `  {\n${fields.join('\n')}\n  },`;
  });

  return [
    '/*',
    ' * GENERATED by apps/workbench/scripts/measure-sources.mjs. Do not edit.',
    ' *',
    ' * One run against the live sources. Re-take it with',
    ' * `node apps/workbench/scripts/measure-sources.mjs`; `.github/workflows/sources.yml`',
    ' * takes it weekly and opens a pull request when a figure has moved.',
    ' *',
    ' * A row with `ok: false` is a source that did not answer, which is a finding',
    ' * and not a failure: nothing in this repository turns one red.',
    ' */',
    "import type { MeasuredRun } from './sources.manifest';",
    '',
    'export const MEASURED: MeasuredRun = {',
    `  measuredAt: ${literal(run.measuredAt)},`,
    `  where: ${literal(run.where)},`,
    `  timeoutMs: ${run.timeoutMs},`,
    `  attempts: ${run.attempts},`,
    '  probes: [',
    ...rows.map((row) => row.replaceAll('\n', '\n  ').replace(/^/, '  ')),
    '  ],',
    '};',
    '',
  ].join('\n');
}

/**
 * The repository's own formatter, over this script's output.
 *
 * `oxfmt --check` is part of `npm run check`, so a generated file it disagrees
 * with would fail the gate on every pull request after the first scheduled run —
 * the workflow that must not turn a pull request red, turning every one of them
 * red. The emitter above already spells quotes and trailing commas the way oxfmt
 * does; what it cannot do by hand is oxfmt's line wrapping, which splits the
 * eighteen Castopod handles over eighteen lines. So the formatter itself has the
 * last word, and the emitter only has to be close.
 *
 * A NON-ZERO EXIT IS FATAL, and that is most of what this function is for. oxfmt
 * exits non-zero when it cannot parse what it was handed, so a non-zero exit here
 * says the emitter produced something that is not TypeScript. It used to be
 * logged, the caller ignored the result, and the run carried on and wrote the file
 * anyway — so the workflow would have committed it, pushed it and opened a pull
 * request, and the first sign of trouble would have been every LATER pull request
 * going red on `oxfmt --check`. That is precisely the failure the emitter's
 * quoting rules were written to prevent, reached by the other road.
 *
 * A missing binary is reported and not fatal: it means somebody is running this
 * from a tree with no install, and an unformatted measurement beats no
 * measurement. The workflow runs `npm ci` first, so that case cannot arise there,
 * and the `npm run check` it now runs over the result would catch it if it did.
 */
function format(file) {
  const bin = join(ROOT, 'node_modules/.bin/oxfmt');
  if (!existsSync(bin)) {
    console.log(`\nNo ${relative(ROOT, bin)}; the file is written unformatted.`);
    return;
  }
  const run = spawnSync(bin, [file], { encoding: 'utf8' });
  if (run.status !== 0) {
    console.error(
      `\noxfmt exited ${run.status} over ${relative(ROOT, file)}: ${(run.stderr ?? '').trim()}\n` +
        'What was emitted is not TypeScript, so none of it is worth committing.',
    );
    process.exit(1);
  }
}

/**
 * What a run FOUND, with everything momentary blanked out, so two runs can be
 * compared on whether anything moved.
 *
 * This exists because of a guard in `.github/workflows/sources.yml` that could
 * never be false. `measuredAt` is stamped from the clock on every run, so the
 * emitted file differed from the committed one every Monday whether or not a
 * single figure had moved; `git diff --quiet` always reported a change, the
 * workflow's `changed=false` branch was dead code, and a pull request was
 * force-pushed every week to move a timestamp. That is the outcome the schedule's
 * own comment gives as the reason daily runs were rejected, and it threw away what
 * rounding timings to 50 ms was for.
 *
 * FOUR FIELDS ARE BLANKED and the reason is the same for all four: none of them is
 * a finding about a source, and three of them change faster than the schedule.
 * Measured back to back, nine seconds apart, a run differs from the one before it
 * in `nowPlaying` (Icecast is a radio station; the track changes every three
 * minutes), in `listeners` (four people, then five), and in `ms` on four rows at
 * once — 200 against 250, 400 against 50 — because rounding to 50 ms still has a
 * boundary and the jitter sits on it. Leaving any of them in the comparison is the
 * same as leaving the clock in: the guard says "something moved" every week and
 * means "the run ran".
 *
 * They are still WRITTEN, and the run's own summary table carries the exact
 * figures. What they do not do is decide whether there is a pull request. The cost
 * is that a source which only got slower produces no diff until something else
 * moves, and that is the right way round: a weekly pull request whose entire diff
 * is a track title and four timings is one nobody opens, and it is the one that
 * would be carrying the newsletter archive's real +11 the week it arrives.
 */
const MOMENTARY = ['measuredAt', 'ms', 'listeners', 'nowPlaying'];

function findings(file) {
  return MOMENTARY.reduce(
    (text, field) => text.replace(new RegExp(`^(\\s*${field}: ).*$`, 'gm'), '$1…'),
    file,
  );
}

/* -------------------------------------------------------------------------- */
/* The run                                                                    */
/* -------------------------------------------------------------------------- */

const started = Date.now();
console.log(
  `Measuring with a ${TIMEOUT_MS} ms timeout, ${ATTEMPTS} attempts, ${RETRY_PAUSE_MS} ms apart.\n`,
);

await measureFeeds();
await measureCategories();
await measureWpTotal({
  id: 'newsletter:issues',
  label: 'Newsletter archive',
  kind: 'newsletter',
  url: `${WP}/newspack_nl_cpt?per_page=1`,
});
/*
 * Search is the one live source a browser could have measured for itself, because
 * `wp/v2/search` has always sent a CORS header. It is measured here anyway: the
 * board would otherwise carry one live row that says "not probed" beside twelve
 * that say what they found, and a reader would have to know which of the two
 * reasons that is. The term is a word that will always match something.
 */
await measureWpTotal({
  id: 'search:results',
  label: 'Search',
  kind: 'search',
  url: `${WP}/search?search=correctiv&per_page=1`,
});
await measureRadio();
await measurePodcasts();
await measurePeertube();
await measureYoutube();

/*
 * The guard, and the reason this script cannot report "nothing to report".
 *
 * `grep` over a directory that is not there exits 2, an `if` around it is false,
 * and the step prints success — that shape has already bitten this repository
 * and it is the shape every check here is written against. The equivalent here
 * is a run that probed nothing: the config failed to import and yielded no
 * feeds, or a rename emptied one of the loops. That run would write a file with
 * an empty list, every consumer would read "no findings", and the workflow would
 * be green.
 *
 * So the floor is asserted against the configuration rather than against a typed
 * number: seven feeds, three mounts and the six fixed rows. Exiting non-zero
 * here is the one failure this script has, and it is a failure of the script,
 * never of a source.
 */
const EXPECTED =
  Object.keys(FEEDS).length + // one RSS document each
  Object.values(FEEDS).filter((feed) => feed.categoryId !== undefined || feed.empty).length +
  Object.keys(RADIO_MOUNTS).length +
  Object.keys(YOUTUBE_FEEDS).length +
  5; // newsletter, search, castopod, and PeerTube's two

if (only === undefined && probes.length < EXPECTED) {
  console.error(
    `\nThe run produced ${probes.length} rows and the configuration asks for ${EXPECTED}. ` +
      'Something is wrong with this script, not with the sources.',
  );
  process.exit(1);
}

const failed = probes.filter((probe) => !probe.ok);
const run = {
  measuredAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  // Which machine took it. A figure from a developer's desk and one from a
  // runner are not the same evidence: a source behind a geo-block or a firewall
  // answers one and not the other.
  where: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'a developer machine',
  timeoutMs: TIMEOUT_MS,
  attempts: ATTEMPTS,
  probes,
};

console.log(
  `\n${probes.length - failed.length} of ${probes.length} sources answered, in ${
    Math.round((Date.now() - started) / 100) / 10
  } s.`,
);
for (const probe of failed) console.log(`  ${probe.id}: ${probe.reason}`);

if (dryRun) {
  console.log(
    `\nNothing written (${only === undefined ? '--dry-run' : '--only narrows the run'}).`,
  );
} else {
  const before = (() => {
    try {
      return readFileSync(OUT, 'utf8');
    } catch {
      return '';
    }
  })();
  writeFileSync(OUT, emit(run));
  format(OUT);
  const after = readFileSync(OUT, 'utf8');

  /*
   * Nothing was found that the committed run did not already say, so that run is
   * left exactly as it is, down to the byte.
   *
   * The cost is stated rather than hidden: the board then says the figures were
   * taken in September when a run in December confirmed them, which understates
   * how fresh they are. That is the safe direction of the two — it never claims a
   * figure is newer than it is — and the run's own page still carries the whole
   * table for the week it ran. The alternative is a weekly pull request whose
   * entire diff is a timestamp, four timings and whatever the radio was playing,
   * and a weekly diff nobody reads is the same as no diff at all.
   */
  const nothingMoved = before !== '' && findings(before) === findings(after);
  if (nothingMoved) writeFileSync(OUT, before);

  console.log(
    `\n${
      before === ''
        ? 'Written'
        : nothingMoved
          ? `Unchanged; left as measured ${/measuredAt: '([^']*)'/.exec(before)?.[1] ?? 'before'}`
          : 'Updated'
    }: ${relative(ROOT, OUT)}`,
  );
}

/*
 * A step summary, when there is one to write. The workflow is scheduled and
 * nobody reads a scheduled run's log, so the table has to be on the run's own
 * page — and it has to list what answered as well as what did not, because a
 * summary that only prints failures says the same thing when every source is up
 * and when the script probed nothing.
 */
if (process.env.GITHUB_STEP_SUMMARY) {
  const cell = (probe) => (probe.ok ? describe(probe) : `**${probe.reason}**`);
  const lines = [
    `## Sources measured ${run.measuredAt}`,
    '',
    `${probes.length - failed.length} of ${probes.length} answered. Timeout ${TIMEOUT_MS} ms, ${ATTEMPTS} attempts.`,
    '',
    '| | Source | Found | ms |',
    '| --- | --- | --- | --- |',
    ...probes.map(
      (probe) => `| ${probe.ok ? '✓' : '✗'} | \`${probe.id}\` | ${cell(probe)} | ${probe.ms} |`,
    ),
    '',
  ];
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`, { flag: 'a' });
}
