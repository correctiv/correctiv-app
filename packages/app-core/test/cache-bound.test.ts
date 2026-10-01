import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { PODCAST_CHANNELS } from '../src/data/feeds.config';
import { configurePlatform, createMemoryPlatform, type CorePlatform } from '../src/ports';
import {
  CACHE_LIMITS,
  clearMemoryCache,
  fileKey,
  getCached,
  getStale,
  MEASURED_PAYLOADS,
  setCached,
} from '../src/services/cache.service';
import { MAX_EPISODES } from '../src/services/podcast.service';

/**
 * The cache's ceiling, which is the half of this cache that can go wrong quietly.
 *
 * A TTL only says when an entry stops being fresh; it never said when one stops
 * existing, so before this the cache grew for as long as the app ran and kept
 * growing across restarts. Under MMKV that store is mapped into the process, so
 * these limits are a memory bound and not a disk one — ADR 0026 §4 measured 4 MiB
 * of cache as 4.55 MiB of settled PSS.
 *
 * Every test here writes through the real `setCached` against a memory host and
 * then asks the HOST what is left, not the session map: an eviction that forgets
 * the entry in memory and leaves the blob behind is the failure that matters, and
 * it is invisible from the core's own map.
 */

/**
 * Sized so that ten of these sit inside the budget and the eleventh pushes it
 * over — a tenth exactly would not, because each entry also carries its
 * `{"data":…,"ts":…}` envelope.
 */
const BIG = Math.floor(CACHE_LIMITS.maxTotalBytes / 10.4);
const START = new Date('2026-09-14T09:00:00Z').getTime();

let host: CorePlatform;
let clock = START;
/** Silenced by default, asserted where a warning is the behaviour under test. */
let warn: MockInstance<typeof console.warn>;

/** One write, at its own instant, so the least-recently-used order is unambiguous. */
async function writeAt(ns: string, key: string, data: unknown): Promise<void> {
  clock += 1000;
  vi.setSystemTime(clock);
  await setCached(ns, key, data);
}

/** What the HOST holds under that key, which is what an eviction has to remove. */
function persisted(ns: string, key: string): Promise<string | null> {
  return host.blobs.read(ns, `${fileKey(key)}.json`);
}

const body = (bytes: number) => 'x'.repeat(bytes);

beforeEach(() => {
  host = createMemoryPlatform();
  configurePlatform(host);
  clearMemoryCache();
  clock = START;
  vi.useFakeTimers();
  vi.setSystemTime(clock);
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  vi.useRealTimers();
});

describe('maximum entry size', () => {
  it('refuses an entry larger than the cap, in both layers', async () => {
    await writeAt('http', 'huge', body(CACHE_LIMITS.maxEntryBytes + 1));

    expect(await getStale('http', 'huge')).toBeNull();
    expect(await persisted('http', 'huge')).toBeNull();
  });

  it('accepts one that just fits', async () => {
    // The payload is `{"data":"…","ts":…}`, so leave room for the envelope.
    const text = body(CACHE_LIMITS.maxEntryBytes - 64);
    await writeAt('http', 'large', text);

    expect(await getStale('http', 'large')).toBe(text);
    expect(await persisted('http', 'large')).not.toBeNull();
  });

  it('accepts a payload of exactly the cap, and refuses one unit more', async () => {
    // The two tests above use `+1` and `-64`, and both of them survive turning the
    // `>` at the size check into `>=`. Only the boundary itself catches that, and
    // an off-by-one there is a cap nobody would notice was 1 unit tighter than the
    // arithmetic under `MAX_ENTRY_BYTES` assumes.
    const envelope = JSON.stringify({ data: '', ts: clock + 1000 }).length;
    const exact = body(CACHE_LIMITS.maxEntryBytes - envelope);
    expect(JSON.stringify({ data: exact, ts: clock + 1000 })).toHaveLength(
      CACHE_LIMITS.maxEntryBytes,
    );

    await writeAt('http', 'exactly', exact);
    expect(await persisted('http', 'exactly')).not.toBeNull();

    await writeAt('http', 'one-over', `${exact}x`);
    expect(await persisted('http', 'one-over')).toBeNull();
  });

  it('says so when it refuses one, because the screen will not', async () => {
    // A refused entry leaves the Mediathek looking right — the offline bundle
    // still fills it, and only the caching stopped. Silence here is a fault that
    // ships and is never found; see the trap under `MAX_ENTRY_BYTES`.
    await writeAt('podcasts', 'all', body(CACHE_LIMITS.maxEntryBytes + 1));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('podcasts/all');
  });

  it('leaves the older answer under that key in place', async () => {
    // Refusing to store the new one is not a reason to throw the old one away:
    // an older cached answer is what this cache is for, and its TTL still governs.
    await writeAt('http', 'page', 'the older answer');
    await writeAt('http', 'page', body(CACHE_LIMITS.maxEntryBytes + 1));

    expect(await getStale('http', 'page')).toBe('the older answer');
  });
});

describe('the byte budget', () => {
  it('evicts until the total is back under the budget', async () => {
    for (let i = 0; i < 11; i++) await writeAt('http', `page-${i}`, body(BIG));

    // Eleven of these are 10 % over; the oldest goes and the rest stay.
    expect(await persisted('http', 'page-0')).toBeNull();
    expect(await persisted('http', 'page-1')).not.toBeNull();
    expect(await persisted('http', 'page-10')).not.toBeNull();
  });

  it('evicts from the session map as well as the store', async () => {
    for (let i = 0; i < 11; i++) await writeAt('http', `page-${i}`, body(BIG));

    // Without this the entry is gone from disk and still resident, which is the
    // exact leak the bound exists to prevent.
    expect(await getStale('http', 'page-0')).toBeNull();
  });

  it('asks the persisted store to delete, by name', async () => {
    const remove = vi.spyOn(host.blobs, 'delete');

    for (let i = 0; i < 11; i++) await writeAt('http', `page-${i}`, body(BIG));

    expect(remove).toHaveBeenCalledWith('http', `${fileKey('page-0')}.json`);
  });

  it('never evicts the entry the current write just stored', async () => {
    // One entry can be most of the budget on its own. Evicting the newest would
    // make a large write a no-op that also emptied the cache.
    for (let i = 0; i < 12; i++) await writeAt('http', `page-${i}`, body(BIG));

    expect(await getStale('http', 'page-11')).toBe(body(BIG));
  });
});

describe('the entry count', () => {
  it('evicts the oldest once there are more entries than the limit', async () => {
    const over = CACHE_LIMITS.maxEntries + 2;
    for (let i = 0; i < over; i++) await writeAt('feeds', `k-${i}`, i);

    // Tiny entries never reach the byte budget, which is why the count exists.
    expect(await persisted('feeds', 'k-0')).toBeNull();
    expect(await persisted('feeds', 'k-1')).toBeNull();
    expect(await persisted('feeds', 'k-2')).not.toBeNull();
    expect(await persisted('feeds', `k-${over - 1}`)).not.toBeNull();
  });
});

describe('least-recently-used order', () => {
  it('spares the entry that was read most recently', async () => {
    for (let i = 0; i < 10; i++) await writeAt('http', `page-${i}`, body(BIG));

    clock += 1000;
    vi.setSystemTime(clock);
    expect(await getCached('http', 'page-0', 60 * 60 * 1000)).toBe(body(BIG));

    await writeAt('http', 'page-10', body(BIG));

    // page-0 was written first and read last, so page-1 is now the oldest use.
    expect(await persisted('http', 'page-0')).not.toBeNull();
    expect(await persisted('http', 'page-1')).toBeNull();
  });

  it('counts a stale read too — an offline fallback is still a use', async () => {
    for (let i = 0; i < 10; i++) await writeAt('http', `page-${i}`, body(BIG));

    clock += 1000;
    vi.setSystemTime(clock);
    await getStale('http', 'page-0');

    await writeAt('http', 'page-10', body(BIG));

    expect(await persisted('http', 'page-0')).not.toBeNull();
    expect(await persisted('http', 'page-1')).toBeNull();
  });

  it('counts a stale read that came off the persisted store after a restart', async () => {
    for (let i = 0; i < 10; i++) await writeAt('http', `page-${i}`, body(BIG));

    // A new process. The two tests above never leave the session map, so both of
    // them survive deleting the `touch` on `getStale`'s persisted path — and that
    // path is the one the ledger is persisted FOR. An entry the ledger knows and
    // the session does not is also the only case where adoption cannot stand in:
    // `readEntry` records a use only for an entry it has never seen before.
    clearMemoryCache();
    clock += 1000;
    vi.setSystemTime(clock);
    expect(await getStale('http', 'page-0')).toBe(body(BIG));

    await writeAt('http', 'page-10', body(BIG));

    expect(await persisted('http', 'page-0')).not.toBeNull();
    expect(await persisted('http', 'page-1')).toBeNull();
  });
});

describe('the bound survives a restart', () => {
  it('evicts entries this session never wrote or read', async () => {
    for (let i = 0; i < 10; i++) await writeAt('http', `page-${i}`, body(BIG));

    // A new process: the session map is empty, the host's store is not. A policy
    // that could only see the session map would let the store grow for ever, one
    // launch at a time — which with MMKV is resident memory, not idle disk.
    clearMemoryCache();

    await writeAt('http', 'page-10', body(BIG));

    expect(await persisted('http', 'page-0')).toBeNull();
    expect(await persisted('http', 'page-1')).not.toBeNull();
  });

  it('says so when the ledger itself cannot be persisted', async () => {
    // The one write in this file whose loss does not heal: the entries it forgot
    // are orphans, and eviction can only walk the ledger, so a host that keeps
    // failing this write keeps every session's entries for ever. The core cannot
    // stop that without a `list` on `BlobStore` — it can refuse to be quiet about it.
    vi.spyOn(host.blobs, 'write').mockImplementation((ns) =>
      ns === 'cache-ledger' ? Promise.reject(new Error('quota exceeded')) : Promise.resolve(),
    );

    await writeAt('http', 'page', 'a body');

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('ledger');
  });

  it('adopts a blob nobody recorded, so a seeded fixture is evictable too', async () => {
    // The preview writes feed blobs straight into storage, and a lost ledger
    // leaves the same shape behind. Reading one is what puts it back on the books.
    const seeded = JSON.stringify({ data: ['seeded'], ts: START });
    await host.blobs.write('feeds', `${fileKey('recherchen')}.json`, seeded);

    expect(await getStale('feeds', 'recherchen')).toEqual(['seeded']);

    for (let i = 0; i < 11; i++) await writeAt('http', `page-${i}`, body(BIG));

    expect(await persisted('feeds', 'recherchen')).toBeNull();
  });
});

describe('a session that only reads', () => {
  it('holds the bound while adopting orphans, not only on the next write', async () => {
    // Opening the app without a network, over saved articles, is reads and nothing
    // else. Adoption used to be exempt from the limits on the grounds that it grows
    // the ledger and not the store — but `getCached` parses the entry into the
    // session map on its way past, and under MMKV the persisted half is mapped
    // pages, so a read grows exactly the thing this bound is about.
    const ORPHANS = 300;
    const text = body(20_000);
    const payload = JSON.stringify({ data: text, ts: START });
    for (let i = 0; i < ORPHANS; i++) {
      await host.blobs.write('articles', `${fileKey(`a-${i}`)}.json`, payload);
    }

    for (let i = 0; i < ORPHANS; i++) {
      clock += 1000;
      vi.setSystemTime(clock);
      await getCached('articles', `a-${i}`, 24 * 60 * 60 * 1000);
    }

    let left = 0;
    for (let i = 0; i < ORPHANS; i++) if (await persisted('articles', `a-${i}`)) left++;

    expect(left).toBeLessThanOrEqual(CACHE_LIMITS.maxEntries);
    expect(left * payload.length).toBeLessThanOrEqual(CACHE_LIMITS.maxTotalBytes);
    // And it is the least recently read that went, not the most.
    expect(await persisted('articles', 'a-0')).toBeNull();
    expect(await persisted('articles', `a-${ORPHANS - 1}`)).not.toBeNull();
  });
});

describe('what eviction cannot reach', () => {
  it('never touches the key/value store, whatever it evicts', async () => {
    // Bookmarks, settings and the session live there. The cache module imports no
    // name from that port, and this is the test that says so out loud: if eviction
    // ever grows a second destination, it fails here rather than on a device.
    const removed = vi.spyOn(host.keyValue, 'remove');
    const written = vi.spyOn(host.keyValue, 'setString');

    for (let i = 0; i < CACHE_LIMITS.maxEntries + 20; i++) {
      await writeAt('articles', `https://correctiv.org/a/${i}/`, { body: body(2000) });
    }

    expect(removed).not.toHaveBeenCalled();
    expect(written).not.toHaveBeenCalled();
  });

  it('deletes only inside the namespace it was given', async () => {
    const remove = vi.spyOn(host.blobs, 'delete');

    for (let i = 0; i < 11; i++) await writeAt('http', `page-${i}`, body(BIG));

    for (const call of remove.mock.calls) expect(call[0]).toBe('http');
  });
});

/**
 * The limits against the content they were chosen from.
 *
 * Every test above derives its inputs from `CACHE_LIMITS`, which is what makes them
 * survive a changed limit: turn `MAX_ENTRIES` into 129 and they all still pass,
 * because they ask the module what the limit is and then cross it. Nothing held the
 * numbers themselves, so the whole measured argument in `cache.service.ts` was a
 * comment, and a comment cannot fail.
 *
 * This is the other half, and it is AGENTS.md's "add the check with the fact": the
 * measurements are exported beside the limits, and these assertions are the
 * relationships the comments claim. Moving a limit means arguing with the content;
 * growing the content past a limit fails here rather than on a device.
 */
describe('the limits against the measurements behind them', () => {
  it('is the three numbers the comments argue for', () => {
    expect(CACHE_LIMITS.maxEntryBytes).toBe(768 * 1024);
    expect(CACHE_LIMITS.maxTotalBytes).toBe(2 * 1024 * 1024);
    expect(CACHE_LIMITS.maxEntries).toBe(128);
  });

  it('holds the largest entry the app writes today, with the room the cap claims', () => {
    // 151,804 units, the live podcast list, measured on a device. The offline
    // bundle's 42,318 is the same entry and 3.6× smaller, and arguing the cap from
    // that one is what put it at 256 KiB.
    expect(MEASURED_PAYLOADS.podcastsLive).toBeGreaterThan(MEASURED_PAYLOADS.pageHtmlMax);
    expect(MEASURED_PAYLOADS.podcastsBundle).toBeLessThan(MEASURED_PAYLOADS.podcastsLive / 3);
    expect(CACHE_LIMITS.maxEntryBytes / MEASURED_PAYLOADS.podcastsLive).toBeGreaterThan(5);
  });

  it('holds the podcast list at every show the Castopod carries', () => {
    // The scheduled trap, as a check. `podcasts/all` is the one entry whose size an
    // editorial decision sets rather than a page: SOURCES.md question 4 is which of
    // the eighteen shows belong in the app, and adding them is one line in
    // `data/feeds.config.ts`. Both factors are read out of the code they live in,
    // so raising `MAX_EPISODES` fails here too.
    const perShow = MAX_EPISODES * MEASURED_PAYLOADS.perEpisode + MEASURED_PAYLOADS.perShowMetadata;

    expect(PODCAST_CHANNELS.length * perShow).toBeLessThan(CACHE_LIMITS.maxEntryBytes);
    expect(MEASURED_PAYLOADS.podcastShowsOnCastopod * perShow).toBeLessThan(
      CACHE_LIMITS.maxEntryBytes,
    );
    expect(PODCAST_CHANNELS.length).toBeLessThanOrEqual(MEASURED_PAYLOADS.podcastShowsOnCastopod);
  });

  it('never lets one entry be most of the cache', () => {
    // The per-entry cap is a sanity guard, not the memory bound — that is the
    // budget. A cap at half the budget or more would stop being either.
    expect(CACHE_LIMITS.maxEntryBytes * 2).toBeLessThanOrEqual(CACHE_LIMITS.maxTotalBytes);
  });

  it('keeps a full count of articles inside the byte budget', () => {
    // Why there are two limits and not one: the count binds on many small entries,
    // the budget on a few large ones. A count whose own worst case broke the budget
    // would make the budget the only real limit.
    expect(CACHE_LIMITS.maxEntries * MEASURED_PAYLOADS.articleMean).toBeLessThan(
      CACHE_LIMITS.maxTotalBytes,
    );
  });

  it('holds the whole live surface several times over', () => {
    // 417,322 units is every cascade once, with every feed paginated out to the 100
    // items the offline bundle holds. A budget that only just fitted it would evict
    // the home screen to show an article.
    expect(MEASURED_PAYLOADS.liveSurfacePaginated * 4).toBeLessThan(CACHE_LIMITS.maxTotalBytes);
  });
});
