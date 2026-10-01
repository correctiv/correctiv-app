import { CONTENT_FEEDS, FEEDS, PODCAST_CHANNELS } from '@correctiv/app-core/data/feeds.config';
import type { CorePlatform } from '@correctiv/app-core';
import type { FeedKey } from '@correctiv/app-core/types/models';

import { OFFLINE_COVERS } from '../src/lib/articles/covers';
import { expoPlatform } from '../src/lib/platform/expo';

/**
 * Both storage ports are asynchronous by contract, so this adapter is a thin
 * passthrough over MMKV and these tests pin what a passthrough can still get
 * wrong: which store each port writes to, and what a storage fault turns into.
 *
 * It used to be more than that. `KeyValueStore` was synchronous, which forced an
 * in-memory mirror hydrated once at startup — and the tests here existed mostly to
 * pin the two ways that bridge could fail: a read before hydration (which started
 * the app on empty state and then overwrote the real state on the first write) and
 * a write that never reached storage. The port went async, the mirror went with
 * it, and so did the first of those failure modes.
 *
 * The double is MMKV's own shape rather than the package's test mock, because the
 * thing worth asserting is invisible from a single instance: the reader's own data
 * and the evictable cache go into two DIFFERENT stores, which is what makes "the
 * cache cannot evict a bookmark" a fact about the storage layout.
 */
interface MmkvDouble {
  id: string;
  contains: jest.Mock<boolean, [string]>;
  getString: jest.Mock<string | undefined, [string]>;
  set: jest.Mock<void, [string, string]>;
  remove: jest.Mock<boolean, [string]>;
}

interface MmkvModule {
  __stores: Map<string, { data: Map<string, string>; instance: MmkvDouble }>;
  __control: { failOnProbe: boolean };
  createMMKV: jest.Mock<MmkvDouble, [{ id: string }]>;
}

jest.mock('react-native-mmkv', () => {
  const stores = new Map<string, { data: Map<string, string>; instance: unknown }>();
  const control = { failOnProbe: false };
  return {
    __stores: stores,
    __control: control,
    createMMKV: jest.fn(({ id }: { id: string }) => {
      const data = stores.get(id)?.data ?? new Map<string, string>();
      const instance = {
        id,
        // The adapter probes with this on the way in. MMKV's web build fails here
        // rather than at creation, so the double has to be able to as well.
        contains: jest.fn((key: string) => {
          if (control.failOnProbe) throw new Error('no window to hold localStorage');
          return data.has(key);
        }),
        getString: jest.fn((key: string) => data.get(key)),
        set: jest.fn((key: string, value: string) => {
          data.set(key, String(value));
        }),
        remove: jest.fn((key: string) => data.delete(key)),
      };
      stores.set(id, { data, instance });
      return instance;
    }),
  };
});

const mmkv = jest.requireMock<MmkvModule>('react-native-mmkv');

/** The store behind `KeyValueStore`: bookmarks, settings, the session. */
const stateStore = () => mmkv.__stores.get('correctiv.state');
/** The store behind `BlobStore`: everything the cache may evict. */
const cacheStore = () => mmkv.__stores.get('correctiv.cache');

beforeEach(() => {
  for (const store of mmkv.__stores.values()) store.data.clear();
  // The two `jest.isolateModules` suites below each open a store under their own
  // conditions, and this flag reaches them: without the reset, whichever runs
  // second inherits the first one's backend.
  mmkv.__control.failOnProbe = false;
  jest.clearAllMocks();
});

describe('keyValue port', () => {
  it('round-trips through the state store, under the key it was given', async () => {
    await expoPlatform.keyValue.setString('store.membership', '{"isMember":true}');

    // No prefix of its own: a store of its own is what keeps these keys out of
    // everybody else's, and the cache is a different store entirely.
    expect(stateStore()?.data.get('store.membership')).toBe('{"isMember":true}');
    expect(await expoPlatform.keyValue.getString('store.membership')).toBe('{"isMember":true}');
  });

  it('answers null for a key it never wrote', async () => {
    expect(await expoPlatform.keyValue.getString('store.nothing')).toBeNull();
  });

  it('removes from storage', async () => {
    stateStore()?.data.set('gone', 'x');

    await expoPlatform.keyValue.remove('gone');

    expect(stateStore()?.data.has('gone')).toBe(false);
    expect(await expoPlatform.keyValue.getString('gone')).toBeNull();
  });

  it('treats a failed read as an absent key, and says so', async () => {
    stateStore()?.instance.getString.mockImplementationOnce(() => {
      throw new Error('disk gone');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // A read that fails and a key that is absent mean the same thing to persist():
    // start that slice from its initial state. Never silent, though — a broken
    // backend otherwise looks exactly like state resetting on its own.
    expect(await expoPlatform.keyValue.getString('store.settings')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('lets a failed write reject, so the caller can retry it', async () => {
    stateStore()?.instance.set.mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });

    // Deliberately not swallowed here: persist() keeps its "last written" pointer
    // unchanged when a write rejects, so the next change to that slice tries
    // again. Swallowing it at this level would make that impossible — and on web
    // this is the localStorage quota, which is the one a demo can actually hit.
    await expect(expoPlatform.keyValue.setString('k', 'v')).rejects.toThrow('quota exceeded');
  });
});

/** The blob port: the same passthrough, for the feed and page cache. */
describe('blobs port', () => {
  it('namespaces blobs so two feeds cannot collide', async () => {
    await expoPlatform.blobs.write('rss', 'faktencheck', 'A');
    await expoPlatform.blobs.write('peertube', 'faktencheck', 'B');

    expect(await expoPlatform.blobs.read('rss', 'faktencheck')).toBe('A');
    expect(await expoPlatform.blobs.read('peertube', 'faktencheck')).toBe('B');
    expect(cacheStore()?.data.get('rss/faktencheck')).toBe('A');
  });

  it('returns null for an unknown blob', async () => {
    expect(await expoPlatform.blobs.read('rss', 'nope')).toBeNull();
  });

  it('reads what an earlier session cached', async () => {
    cacheStore()?.data.set('rss/klima', 'cached xml');
    expect(await expoPlatform.blobs.read('rss', 'klima')).toBe('cached xml');
  });

  it('deletes, which is what makes the cache evictable at all', async () => {
    await expoPlatform.blobs.write('feeds', 'klima.json', 'cached');

    await expoPlatform.blobs.delete('feeds', 'klima.json');

    expect(cacheStore()?.data.has('feeds/klima.json')).toBe(false);
    expect(await expoPlatform.blobs.read('feeds', 'klima.json')).toBeNull();
  });

  it('shrugs at deleting what is not there', async () => {
    await expect(expoPlatform.blobs.delete('feeds', 'never-written')).resolves.toBeUndefined();
  });

  it('treats a storage fault as a cache miss rather than an error', async () => {
    cacheStore()?.instance.getString.mockImplementationOnce(() => {
      throw new Error('disk gone');
    });
    expect(await expoPlatform.blobs.read('rss', 'klima')).toBeNull();
  });

  it('warns about a failed write but does not reject — the cache is best-effort', async () => {
    cacheStore()?.instance.set.mockImplementationOnce(() => {
      throw new Error('quota exceeded');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(expoPlatform.blobs.write('feeds', 'klima.json', 'x')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

/**
 * The structural half of "never evict what the reader chose". The core's half is
 * that its cache imports no name from `KeyValueStore`; this is the half that holds
 * even if that ever stopped being true.
 */
describe('the two stores are two stores', () => {
  it('writes the reader state and the cache to different MMKV instances', async () => {
    await expoPlatform.keyValue.setString('store.savedArticles', '{"items":[1]}');
    await expoPlatform.blobs.write('feeds', 'klima.json', 'cached');

    expect([...(stateStore()?.data.keys() ?? [])]).toEqual(['store.savedArticles']);
    expect([...(cacheStore()?.data.keys() ?? [])]).toEqual(['feeds/klima.json']);
    // Two stores and no third: a new one appearing here is a new place state can
    // hide, and the point of this adapter is that there is exactly one of each.
    expect([...mmkv.__stores.keys()].sort()).toEqual(['correctiv.cache', 'correctiv.state']);
  });

  it('cannot reach a settings key through the blob port', async () => {
    await expoPlatform.keyValue.setString('store.savedArticles', '{"items":[1]}');

    // The same string, handed to the other port. It finds nothing and deletes
    // nothing, because the two ports do not share a store.
    expect(await expoPlatform.blobs.read('store', 'savedArticles')).toBeNull();
    await expoPlatform.blobs.delete('store', 'savedArticles');

    expect(await expoPlatform.keyValue.getString('store.savedArticles')).toBe('{"items":[1]}');
  });
});

/**
 * The prerender case, and the missing-native-module case, are the same case here:
 * MMKV answers the first call with a throw instead of a value. `expo export
 * --platform web` renders every route in Node, where there is no `window` to hold
 * localStorage, so this path runs on every build of the published demo.
 */
describe('a storage backend that is not there at all', () => {
  it('says so once, then degrades to misses and rejected writes', async () => {
    let isolated!: CorePlatform;
    jest.isolateModules(() => {
      jest.requireMock<MmkvModule>('react-native-mmkv').__control.failOnProbe = true;
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      isolated = (require('../src/lib/platform/expo') as { expoPlatform: CorePlatform })
        .expoPlatform;
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    expect(await isolated.keyValue.getString('store.settings')).toBeNull();
    expect(await isolated.blobs.read('feeds', 'klima.json')).toBeNull();
    await expect(isolated.keyValue.setString('store.settings', '{}')).rejects.toThrow(
      'unavailable',
    );

    // Once per store, not once per key: the export prerenders every route, and a
    // line per read per route buries the build log it is meant to warn in.
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

/**
 * The third failure, and the only one that looks like success.
 *
 * A browser with site data switched off throws on `window.localStorage`, and MMKV's
 * web build catches that itself and falls back to a module-global `Map`. The probe
 * above therefore passes, writes resolve, reads in the same session answer, and
 * nothing survives a reload. Issue #96 asks for unavailable storage to be surfaced,
 * and this is the half of it no throw ever reaches.
 */
describe('a browser that refuses localStorage', () => {
  const realWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

  afterEach(() => {
    if (realWindow) Object.defineProperty(globalThis, 'window', realWindow);
  });

  it('says the store will not outlive the session, once per store', async () => {
    // jest-expo points `window` at `global` and gives it no document, which is the
    // native shape. A browser is a document plus an accessor that throws.
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        document: { createElement: () => ({}) },
        get localStorage(): unknown {
          throw new Error('The operation is insecure.');
        },
      },
    });

    let isolated!: CorePlatform;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      isolated = (require('../src/lib/platform/expo') as { expoPlatform: CorePlatform })
        .expoPlatform;
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // The session still works, deliberately: an in-memory store carries it, and
    // rejecting every write would turn a browser setting into an unusable app.
    await expoPlatformWrite(isolated);

    expect(warn).toHaveBeenCalledTimes(2);
    expect(String(warn.mock.calls[0]?.[0])).toContain('survive a reload');
    warn.mockRestore();
  });
});

/**
 * The fifth port, and the one file issue #95 changes.
 *
 * Asserted here rather than left to the boundary's own suite, because what that
 * suite can show is that the boundary reports; what this one shows is that the
 * port this app registers is not the core's no-op. Those are different claims and
 * the second is the one that makes reporting real: the core reports through
 * `platform().errors`, and until this adapter answers it, every report the core
 * makes goes nowhere and looks exactly as it does today.
 */
describe('the error reporter', () => {
  it('logs the domain, the code, the context and the cause itself', () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    const cause = new Error('HTTP 502');

    expoPlatform.errors.report({
      domain: 'podcasts',
      code: 'series-unreachable',
      context: { handle: 'klima', replacedBy: 'nothing' },
      cause,
    });

    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]?.[0]).toBe('[podcasts] series-unreachable');
    expect(logged.mock.calls[0]?.[1]).toEqual({ handle: 'klima', replacedBy: 'nothing' });
    // The thrown object, not a string of it. A sink wants the stack, and this file
    // is not the place that decides how an Error is serialised.
    expect(logged.mock.calls[0]?.[2]).toBe(cause);
    logged.mockRestore();
  });

  it('reports one line per report, with no queue in front of it', () => {
    // Retry, batching and offline queueing are policy about a service nobody has
    // chosen (ADR 0032), so the absence of them is the behaviour, not an omission.
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});

    expoPlatform.errors.report({ domain: 'render', code: 'render-failed' });
    expoPlatform.errors.report({ domain: 'render', code: 'render-failed' });

    expect(logged).toHaveBeenCalledTimes(2);
    logged.mockRestore();
  });
});

/** One write through each port, which is what opens both stores. */
async function expoPlatformWrite(host: CorePlatform): Promise<void> {
  await host.keyValue.setString('store.settings', '{}');
  await host.blobs.write('feeds', 'klima.json', 'x');
}

/**
 * The bundle is this host's offline promise: the reader has to open without a
 * network, which is the whole reason `npm run offline-articles` exists. It was more
 * than a promise on the web target until ADR 0015, when the app moved to an API that
 * a browser can reach; the snapshots are the floor there now, not the ceiling.
 */
describe('content bundle', () => {
  it('serves a bundled article by its url, and null for anything else', () => {
    const [url] = Object.keys(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('../src/lib/articles/offlineBundle.generated').OFFLINE_ARTICLES,
    );
    expect(expoPlatform.content.article(url)?.bodyHtml.length).toBeGreaterThan(200);
    expect(expoPlatform.content.article('https://correctiv.org/nope/')).toBeNull();
  });

  it('serves a bundled snapshot for every content feed', () => {
    for (const key of CONTENT_FEEDS) {
      expect(expoPlatform.content.feed(key)?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('answers null for a feed it holds no snapshot of', () => {
    // A feed the catalogue marks `empty` is never snapshotted, so it is the honest
    // case for "the host has nothing" — the port's null, not an empty array.
    const notSnapshotted = (Object.keys(FEEDS) as FeedKey[]).find(
      (key) => !CONTENT_FEEDS.includes(key),
    );
    expect(notSnapshotted).toBeDefined();
    expect(expoPlatform.content.feed(notSnapshotted!)).toBeNull();
  });

  it('serves a bundled snapshot for every curated podcast show', () => {
    // The Mediathek's cascade falls through to the four-show sample seed in the
    // core when a show is missing here, and nothing on screen says which one you
    // are looking at beyond a single line. A gap in this bundle is therefore a
    // demo that quietly shows made-up episodes.
    for (const handle of PODCAST_CHANNELS) {
      expect(expoPlatform.content.podcastSeries(handle)?.episodes.length ?? 0).toBeGreaterThan(0);
    }
    expect(expoPlatform.content.podcastSeries('gibt-es-nicht')).toBeNull();
  });

  it('serves bundled covers as data URIs, not as the remote URL', () => {
    // Echoing the remote URL back is what this port used to do, and it made
    // `adoptBundledImages` in the core a no-op: offline, the URL it replaced was
    // just as unreachable as the one it replaced it with.
    const covers = Object.values(OFFLINE_COVERS);
    expect(covers.length).toBeGreaterThan(0);
    for (const cover of covers) expect(cover.startsWith('data:image/')).toBe(true);

    const [withCover] = Object.keys(OFFLINE_COVERS);
    expect(expoPlatform.content.image(withCover)).toBe(OFFLINE_COVERS[withCover]);
    expect(expoPlatform.content.image('https://correctiv.org/nope/')).toBeNull();
  });
});
