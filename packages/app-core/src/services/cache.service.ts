import { platform } from '../ports';
import { fetchText, type FetchTextOptions } from './http';

/**
 * The one cache in this codebase, in two layers: an in-memory session map on top
 * of the host's `BlobStore` port.
 *
 * There used to be two of these — the core's, behind a synchronous port, and the
 * Expo app's `cachedFetch`, straight onto AsyncStorage with its own policies and
 * headers. Same job, two TTLs, two sets of failure behaviour. This is both,
 * merged: `getCached`/`setCached` for typed objects (feeds, videos, articles) and
 * `fetchCachedText` for the raw bodies that produce them.
 *
 * Everything here is best-effort. A read that fails is a miss, a write that fails
 * is forgotten — a broken cache must never take a screen down with it.
 *
 * ## It is bounded, and that is not decoration
 *
 * The TTLs control freshness, not size: an expired entry is still served as the
 * offline fallback, so nothing here ever removed anything. Under AsyncStorage
 * that was a disk filling slowly. Under MMKV it is resident memory — the store is
 * mapped, so every kilobyte the cache ever wrote is a kilobyte the process holds,
 * and [ADR 0026](../../../../adr/0026-react-native-review-and-hardening.md) §4
 * measured 4 MiB of cache as 4.55 MiB of settled process PSS *on top of* the JS
 * objects it was already holding. A cache with a TTL and no ceiling is a leak on a
 * slow timer.
 *
 * So there are three limits and a least-recently-used order, below. They apply to
 * both layers at once: an eviction drops the session entry AND asks the host to
 * delete the persisted blob, because deleting only one of them means the other
 * one grows unwatched.
 */

// --- the bound ----------------------------------------------------------------

/*
 * The three limits below were measured against this app's own content on
 * 2026-09-14, not guessed. Every figure is the length of the `{ data, ts }`
 * payload this file actually writes, and every row says WHICH content it came
 * from, because two of these differ by 3.6× and the entry cap below was first
 * argued from the smaller of them with nothing on the page saying which it was:
 *
 *   - **bundle** — the offline snapshot under
 *     `apps/mobile/src/lib/{articles,podcasts}/`, which is what a screen shows
 *     with no network. Re-derivable from this repository at any time.
 *   - **live** — one round of that cascade against its real source, which is what
 *     the app writes when it has one.
 *   - **device** — read back off the persisted ledger on an Android 16 / API 36
 *     emulator, signed in and walked to the Mediathek, same day.
 *
 *   cached shape                        ns / key           from     units
 *   ----------------------------------  -----------------  -------  ----------------
 *   feed, page 1 (20 items), REST       feeds/<key>        live     13,743 - 14,301
 *   feed grown to 100 items             feeds/<key>        bundle   5,123 - 71,365, six of them, 229,134 together
 *   one FeedItem inside those           -                  bundle   428 - 1,183, mean 701
 *   one extracted article (15 of them)  articles/<url>     bundle   4,635 - 21,283, mean 9,715
 *   all seven podcast shows             podcasts/all       bundle   42,318
 *   all seven podcast shows             podcasts/all       device   151,804
 *   Spotlight, 12 issues                spotlight/all      device   5,112
 *   PeerTube, 12 videos                 peertube/funfacts  device   7,749
 *   YouTube, one rail                   youtube/gespraech  device   9,396
 *   one search, 20 hits                 search/<query>     live     14,127
 *   one article page's HTML             http/page:<url>    live     77,831 - 125,732, mean 109,437
 *
 * **The two podcast rows are one entry, and the gap between them is the whole
 * lesson.** The bundle holds 132 episodes across the seven shows because it was
 * generated while `podcast.service.ts` kept 20 of them per show; it keeps 100 now,
 * and the live feeds answered with 499. At the ~298 units an episode costs, that
 * accounts for all of the 3.6×. A limit argued from the bundle figure is a limit
 * argued against content this app stopped writing.
 *
 * The device's ledger held those six entries and nothing else, 202,317 units
 * together, three quarters of it the podcasts. The four feeds that walk did not
 * open and one search add at most 4 × 14,301 + 14,127, so the whole live surface
 * is about 274 KB — and about 417 KB once every feed is paginated out to the 100
 * items the bundle holds. Everything past that is what the reader opened.
 *
 * ## These are UTF-16 code units, not bytes
 *
 * `bytes` in the ledger is `payload.length`, and a JavaScript string's length
 * counts UTF-16 code units. German is not free here: an umlaut, an ß and a „ are
 * one unit and two UTF-8 bytes each, and `JSON.stringify` leaves them as
 * characters rather than escaping them, so what MMKV stores is larger than what is
 * counted. Measured over the bundles in this repository, which are the same German
 * prose the live sources answer with: the podcast payload is 42,318 units and
 * 42,493 UTF-8 bytes (+0.41 %), the six feed payloads 229,134 and 231,095
 * (+0.86 %).
 *
 * The budget is therefore short by about one per cent. It is kept anyway, for two
 * reasons. Counting bytes honestly means encoding every payload a second time on
 * every write — a full extra copy of a 150 KB string — for a correction an order of
 * magnitude smaller than the rounding in the limit it corrects. And code units are
 * the *better* measure for half of what is bounded: the session `Map` holds the
 * same entry parsed, and an engine that keeps a string as UTF-16 charges per unit,
 * not per UTF-8 byte.
 *
 * What would break the assumption is content that is mostly not Latin script, or
 * emoji, where the ratio is 2-3× rather than 1.01×. Neither is what correctiv.org
 * publishes, and a source that did would have to be measured again here.
 */

/**
 * The largest single entry, and the limit in this file that goes stale fastest.
 *
 * It was 256 KiB, argued as "twice the largest payload measured" against 125,732
 * — an offline-bundle figure. The largest entry the app actually writes is the
 * podcast list at 151,804, which is 58 % of that: the headroom was 1.7×, not 2×.
 * More to the point, a rule of the form "twice the largest thing we have seen"
 * expires every time the content grows, quietly, and this one had.
 *
 * So the rule is now the other way round: **above everything this app's own code
 * can produce, and below anything that could only be a mistake.**
 *
 * The ceiling is the podcast list, and it is arithmetic rather than a measurement.
 * `podcast.service.ts` keeps at most `MAX_EPISODES` = 100 episodes per show, an
 * episode costs ~298 units and a show's metadata ~425, so one show is at most
 * ~30,225 and the list is `shows × 30,225`: 211,575 at the seven shows
 * `PODCAST_CHANNELS` lists, 544,050 at eighteen. 768 KiB is 1.45× that ceiling and
 * 5.2× the largest entry measured today, and it still refuses a page that answers
 * with a megabyte of error document or a feed that stopped paginating, which is
 * what a per-entry cap is for. It is also under half `MAX_TOTAL_BYTES`, so no
 * single entry can be most of the cache.
 *
 * ## The trap, which is scheduled
 *
 * Eighteen is not a hypothetical. [SOURCES.md](../../../../SOURCES.md) records that
 * CORRECTIV's Castopod carries **18 shows** against the 7 the app lists, and that
 * which of the eighteen belong in the app is an open editorial question with a
 * decision due at the end of September. Adding them is a one-line change to
 * `data/feeds.config.ts`, and `podcasts/all` is the one entry in this app whose
 * size is set by an editorial decision rather than by a page.
 *
 * If it ever does cross this cap, `setCached` refuses it and **says so**. That
 * warning is the point: a refused entry leaves the screen looking right, because
 * the offline bundle still fills the Mediathek and only the caching stopped, so
 * without it the failure is one nobody would find. The answer at that point is not
 * a larger cap but one entry per show — `stores/podcasts.ts` writes all seven as a
 * single `podcasts/all` blob, and eighteen entries of ~30,000 each sit under every
 * limit here with room to spare. That is a change to a screen's cascade rather
 * than to this file, which is why it is written down here rather than done here.
 */
const MAX_ENTRY_BYTES = 768 * 1024;

/**
 * Half of the 4 MiB whose resident cost ADR 0026 §4 measured.
 *
 * **What that measurement says, exactly.** Persisting 4 MiB that was *already*
 * held in the JS cache added 4.55 MiB of settled process PSS, and the native
 * representation is additional to the JS objects rather than instead of them. So
 * the worst case here is about 2.3 MiB of native pages **plus** whatever up to 128
 * parsed entries weigh on the JS heap, because the session `Map` holds the same
 * entries a second time. And halving one measurement is an extrapolation too,
 * however conservative the direction — what it is not is a number chosen without
 * one.
 *
 * It holds the ~417 KB paginated live surface four times over: the remaining
 * ~1.6 MiB is about 170 articles at the 9,715-unit mean, or about 15 page bodies
 * at 109,437.
 *
 * The web target is the other half of the argument. There the store is
 * `localStorage`, the per-origin quota is about 5 MiB, and since
 * [ADR 0024](../../../../adr/0024-the-handbook-owns-the-root.md) the workbench
 * shares that origin with the app — so a budget near the quota would be an app
 * that evicts the site it is published inside.
 */
const MAX_TOTAL_BYTES = 2 * 1024 * 1024;

/**
 * The article-count limit. The live surface is about eleven entries; the rest of
 * this is what the reader opened inside the article TTL's 24 hours. 128 entries at
 * the 9,715-unit article mean is 1.19 MiB, inside the budget above — which is the
 * point of having both: the count binds on many small entries, the budget binds on
 * a few large ones, and neither alone catches the other's case.
 */
const MAX_ENTRIES = 128;

// --- the two layers, and the ledger that spans them ---------------------------

interface CacheEntry {
  data: unknown;
  ts: number;
}

/** What the ledger knows about one entry. Never the entry's data. */
interface LedgerEntry {
  ns: string;
  key: string;
  /** Length of the persisted `{ data, ts }` payload. */
  bytes: number;
  /** Written or read, whichever was last — the least-recently-used order. */
  usedAt: number;
}

const memory = new Map<string, CacheEntry>();

/**
 * Every entry the cache holds, in either layer, and nothing else.
 *
 * **This is what makes the bound real rather than per-session.** The session map
 * is empty at every launch, so a policy that could only see it would let the
 * persisted store grow forever across restarts — and with MMKV that store is
 * mapped into the process, so it would be the leak this bound exists to prevent.
 * The ledger is therefore persisted too, as one small blob.
 *
 * It is bookkeeping, not truth: a ledger that cannot be read is an empty one, and
 * the entries it forgot become orphans that no eviction reaches. **One** lost
 * ledger costs at most one previous budget of dead weight, and an orphan is
 * re-adopted the moment anything reads it (`readEntry`), so that much is bounded
 * and self-healing.
 *
 * **Repeated loss is not.** A host that keeps failing this one write leaves every
 * session's entries behind and nothing ever takes them back: measured against a
 * host that fails only ledger writes, eight sessions of five 200 KB writes left 40
 * entries and 8,001,200 units persisted against a 2,097,152 budget, none of it
 * reclaimable, because eviction can only walk this ledger and `BlobStore` has no
 * `list`. The ceiling in that state is "every entry ever written", which is the
 * unbounded cache this whole section exists to remove.
 *
 * So this is the one blob write in this file whose failure does not heal, and
 * `saveLedger` reports it rather than swallowing it. It still does not throw: a
 * cache write must not take down the screen whose network request has just
 * succeeded. Nor is the core the first place that could have shouted — the Expo
 * host warns and resolves on every failed blob write
 * (`apps/mobile/src/lib/platform/expo.ts`), so the `catch` below is a second line
 * and not the first. Neither host produces the shape that actually bites, either:
 * on web a full origin refuses the entry write first, because it comes first and
 * is the larger of the two, which leaves nothing persisted rather than something
 * unreclaimable. What would end this rather than report it is `list` on
 * `BlobStore`, which would make eviction independent of this ledger altogether.
 * That is not in this change.
 *
 * **The reader's own data is not in here and cannot be.** Bookmarks, settings and
 * the session are `KeyValueStore`, a port this file never names; eviction walks
 * this ledger and speaks only to `blobs.delete`. There is no key in the ledger
 * that the cache did not put there itself.
 */
const ledger = new Map<string, LedgerEntry>();

/**
 * Where the ledger itself lives.
 *
 * Its own namespace, and a name that is not a hash, so no `setCached` call can
 * collide with it: every entry this file writes is stored under `<djb2>.json`,
 * and `ledger.json` is not a djb2 hash of anything.
 *
 * It is outside the budget it enforces, and small enough for that to be fair: a
 * full 128 entries of article URLs is about 20 KB, under one per cent of it.
 */
const LEDGER_NS = 'cache-ledger';
const LEDGER_NAME = 'ledger.json';
const LEDGER_VERSION = 1;

/** Set once the persisted ledger has been read (or has failed to read) this session. */
let ledgerLoaded: Promise<void> | null = null;

const memKey = (ns: string, key: string) => `${ns}:${key}`;

/**
 * Exported because it is not an internal detail: the preview shell has to name the
 * very same blob to seed a feed's cache, and re-implements this from the outside
 * (`apps/workbench/src/preview/frame/seed.ts`).
 * `apps/workbench/test/preview/seed.test.ts` holds the two versions together —
 * without it a changed hash makes every fixture silently do nothing.
 */
export function fileKey(key: string): string {
  // djb2 — stable, and short enough to be a file name on every host
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

const blobName = (key: string) => `${fileKey(key)}.json`;

function loadLedger(): Promise<void> {
  ledgerLoaded ??= (async () => {
    try {
      const raw = await platform().blobs.read(LEDGER_NS, LEDGER_NAME);
      if (raw === null) return;
      const parsed = JSON.parse(raw) as { v?: number; entries?: LedgerEntry[] };
      if (parsed.v !== LEDGER_VERSION || !Array.isArray(parsed.entries)) return;
      for (const entry of parsed.entries) {
        if (typeof entry?.ns !== 'string' || typeof entry?.key !== 'string') continue;
        ledger.set(memKey(entry.ns, entry.key), {
          ns: entry.ns,
          key: entry.key,
          bytes: Number(entry.bytes) || 0,
          usedAt: Number(entry.usedAt) || 0,
        });
      }
    } catch {
      // An unreadable ledger is an empty one. See the note on `ledger` for what
      // that costs and why it heals.
    }
  })();
  return ledgerLoaded;
}

async function saveLedger(): Promise<void> {
  try {
    const payload = JSON.stringify({ v: LEDGER_VERSION, entries: [...ledger.values()] });
    await platform().blobs.write(LEDGER_NS, LEDGER_NAME, payload);
  } catch (err) {
    // Not swallowed, and not rethrown either. See the note on `ledger`: this is
    // the one write here whose loss compounds instead of healing, and a cache that
    // has quietly stopped being bounded looks exactly like one that is.
    console.warn('[cache] the ledger was not persisted; entries may outlive their bound:', err);
  }
}

function totalBytes(): number {
  let sum = 0;
  for (const entry of ledger.values()) sum += entry.bytes;
  return sum;
}

/** Drops one entry from BOTH layers. The only place in this file that deletes. */
async function drop(id: string, entry: LedgerEntry): Promise<void> {
  memory.delete(id);
  ledger.delete(id);
  try {
    await platform().blobs.delete(entry.ns, blobName(entry.key));
  } catch {
    // A delete that fails leaves a blob the ledger no longer names — an orphan,
    // which the next read re-adopts. Never worth failing a cache write over.
  }
}

/**
 * Least-recently-used eviction, down to both limits.
 *
 * `keep` is the entry the current write just stored: a single `setCached` must
 * never be allowed to evict itself, which is what would happen the moment one
 * entry alone crossed a limit.
 *
 * Linear scan per eviction, over at most `MAX_ENTRIES` + 1 entries, and only when
 * a limit is actually crossed. A heap would be faster and would be a second
 * structure to keep in step with the ledger.
 *
 * Returns how many entries it dropped, because both callers want to know whether
 * anything changed before paying for a ledger write.
 */
async function evictToBudget(keep: string): Promise<number> {
  let dropped = 0;
  while (ledger.size > MAX_ENTRIES || totalBytes() > MAX_TOTAL_BYTES) {
    let victimId: string | null = null;
    let victim: LedgerEntry | null = null;
    for (const [id, entry] of ledger) {
      if (id === keep) continue;
      if (!victim || entry.usedAt < victim.usedAt) {
        victimId = id;
        victim = entry;
      }
    }
    if (!victimId || !victim) return dropped; // only `keep` is left, and it stays
    // eslint-disable-next-line no-await-in-loop
    await drop(victimId, victim);
    dropped += 1;
  }
  return dropped;
}

/** Records a read against the LRU order. Session-only; the next write persists it. */
function touch(id: string): void {
  const known = ledger.get(id);
  if (known) known.usedAt = Date.now();
}

async function readEntry<T>(ns: string, key: string): Promise<{ data: T; ts: number } | null> {
  try {
    const raw = await platform().blobs.read(ns, blobName(key));
    if (raw === null) return null;
    const entry = JSON.parse(raw) as { data: T; ts: number };
    const id = memKey(ns, key);
    if (!ledger.has(id)) {
      // An entry the ledger does not know: a previous session's, whose ledger was
      // lost, or one a fixture wrote straight into the store. Adopting it here is
      // what keeps "everything persisted is evictable" true without a port that
      // can list.
      //
      // And adoption is a growth path in its own right, so it evicts too. Reads
      // used to be exempt, on the grounds that adoption grows the ledger and not
      // the store — true of the store, false of the thing being bounded. `getCached`
      // puts the parsed entry in the session map on its way past, and the persisted
      // half is mapped pages under MMKV. A read-mostly session is a real shape (the
      // app opened without a network, over saved articles), and 300 such reads left
      // 300 entries resident until some later write happened to come along.
      ledger.set(id, { ns, key, bytes: raw.length, usedAt: Date.now() });
      if ((await evictToBudget(id)) > 0) await saveLedger();
    }
    return entry;
  } catch {
    return null;
  }
}

/** A cached value, but only while it is younger than `ttlMs`. */
export async function getCached<T>(ns: string, key: string, ttlMs: number): Promise<T | null> {
  await loadLedger();
  const id = memKey(ns, key);
  const now = Date.now();
  const mem = memory.get(id);
  if (mem) {
    touch(id);
    return now - mem.ts < ttlMs ? (mem.data as T) : null;
  }

  const entry = await readEntry<T>(ns, key);
  if (!entry) return null;
  memory.set(id, entry);
  touch(id);
  return now - entry.ts < ttlMs ? entry.data : null;
}

/** Also returns expired entries — for stale-while-revalidate and offline fallback. */
export async function getStale<T>(ns: string, key: string): Promise<T | null> {
  await loadLedger();
  const id = memKey(ns, key);
  const mem = memory.get(id);
  if (mem) {
    touch(id);
    return mem.data as T;
  }
  const entry = await readEntry<T>(ns, key);
  if (!entry) return null;
  touch(id);
  return entry.data;
}

/**
 * Stores one entry, then brings the cache back inside its limits.
 *
 * An oversized payload is refused outright rather than stored in memory and left
 * off the disk: the session map is half the thing being bounded. Whatever was
 * under that key stays where it is — it is older, but a cache serving a slightly
 * older answer is a cache doing its job, and its TTL still governs it.
 *
 * The refusal is not silent, and that is the half that matters. See the trap under
 * `MAX_ENTRY_BYTES`: the screen an oversized entry belongs to keeps looking right,
 * because the offline bundle still fills it and only the caching stopped.
 */
export async function setCached(ns: string, key: string, data: unknown): Promise<void> {
  const entry: CacheEntry = { data, ts: Date.now() };
  const payload = JSON.stringify(entry);
  if (payload.length > MAX_ENTRY_BYTES) {
    console.warn(
      `[cache] ${ns}/${key} is ${payload.length} units, over the ${MAX_ENTRY_BYTES} entry cap — not cached`,
    );
    return;
  }

  await loadLedger();
  const id = memKey(ns, key);
  memory.set(id, entry);
  ledger.set(id, { ns, key, bytes: payload.length, usedAt: entry.ts });
  try {
    await platform().blobs.write(ns, blobName(key), payload);
  } catch {
    // the blob cache is a nicety, not a must — and the entry still occupies the
    // session map, so it stays in the ledger and stays evictable
  }
  await evictToBudget(id);
  await saveLedger();
}

/**
 * Which of network and cache gets asked first.
 *
 * - `network-first` — feeds. Keeps the home screen current (that is the demo's
 *   first impression) and falls back to the cache when the request fails.
 * - `cache-first` — article pages and other rarely changing resources. A fresh
 *   entry answers without touching the network at all.
 *
 * Both end at the same place: stale beats nothing. Deliberately not a query
 * library — the offline order has to be explicit and identical on both hosts.
 */
export type CachePolicy = 'network-first' | 'cache-first';

export interface FetchCachedOptions extends FetchTextOptions {
  policy?: CachePolicy;
  /** Freshness window for `cache-first` (ms). Default 10 minutes. */
  ttlMs?: number;
}

const TEXT_NS = 'http';
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/** A text resource, cached under `key`. See `CachePolicy` for the two orders. */
export async function fetchCachedText(
  key: string,
  url: string,
  options: FetchCachedOptions = {},
): Promise<string> {
  const { policy = 'network-first', ttlMs = DEFAULT_TTL_MS, ...fetchOptions } = options;

  if (policy === 'cache-first') {
    const fresh = await getCached<string>(TEXT_NS, key, ttlMs);
    if (fresh !== null) return fresh;
    try {
      const body = await fetchText(url, fetchOptions);
      await setCached(TEXT_NS, key, body);
      return body;
    } catch (err) {
      const stale = await getStale<string>(TEXT_NS, key);
      if (stale !== null) return stale;
      throw err;
    }
  }

  try {
    const body = await fetchText(url, fetchOptions);
    await setCached(TEXT_NS, key, body);
    return body;
  } catch (err) {
    const stale = await getStale<string>(TEXT_NS, key);
    if (stale !== null) return stale;
    throw err;
  }
}

/**
 * Test helper — forgets this session: the entries in memory and the ledger's copy
 * of what is persisted. The `BlobStore` is owned by the host and is untouched, so
 * the next call reloads the ledger from it and the persisted entries still answer.
 */
export function clearMemoryCache(): void {
  memory.clear();
  ledger.clear();
  ledgerLoaded = null;
}

/** The limits, for the tests that pin them. Not a runtime knob. */
export const CACHE_LIMITS = {
  maxEntryBytes: MAX_ENTRY_BYTES,
  maxTotalBytes: MAX_TOTAL_BYTES,
  maxEntries: MAX_ENTRIES,
} as const;

/**
 * The measurements the limits above are argued from, exported so that a test can
 * hold the two together.
 *
 * A limit is a number somebody can change in a second; the measurement behind it is
 * what makes the number right, and it lives in a comment where nothing can fail.
 * These are the same figures as the table at the top of this file, and
 * `test/cache-bound.test.ts` asserts the relationships between them and
 * `CACHE_LIMITS` — so moving a limit means arguing with the content, and growing
 * the content past a limit fails in CI rather than on a device.
 */
export const MEASURED_PAYLOADS = {
  /** `podcasts/all` with the seven curated shows, live, off a device's ledger. */
  podcastsLive: 151_804,
  /** The same entry out of the offline bundle: 132 episodes rather than 499. */
  podcastsBundle: 42_318,
  /** One parsed episode inside it, and one show's metadata without its episodes. */
  perEpisode: 298,
  perShowMetadata: 425,
  /** What `SOURCES.md` measured on CORRECTIV's Castopod, against the seven listed. */
  podcastShowsOnCastopod: 18,
  /** One extracted article, mean of the fifteen bundled. */
  articleMean: 9_715,
  /** The largest article page's HTML, which used to be what the entry cap was set by. */
  pageHtmlMax: 125_732,
  /** One round of every cascade, with every feed paginated to the bundle's 100 items. */
  liveSurfacePaginated: 417_322,
} as const;
