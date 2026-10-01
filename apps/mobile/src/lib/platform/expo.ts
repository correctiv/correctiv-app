import { createMMKV, type MMKV } from 'react-native-mmkv';

import type {
  BlobStore,
  ContentBundle,
  CorePlatform,
  ErrorReporter,
  KeyValueStore,
} from '@correctiv/app-core';
import type { Article } from '@correctiv/app-core/articles/types';

import { OFFLINE_ARTICLES, OFFLINE_FEEDS } from '@/lib/articles/offlineBundle.generated';
import { OFFLINE_COVERS } from '@/lib/articles/covers';
import { OFFLINE_PODCASTS } from '@/lib/podcasts/offlineBundle.generated';

/**
 * The Expo host's half of `@correctiv/app-core`'s platform ports — the only place
 * in this app that decides where persisted state physically lives. Works unchanged
 * on iOS, Android and web, because `react-native-mmkv` 4.3.2 ships a web build
 * backed by localStorage. One file, three platforms, no split.
 *
 * Both ports are asynchronous by contract, so both are a thin passthrough. That is
 * new: `KeyValueStore` used to be synchronous, which forced this file to keep an
 * in-memory mirror of those keys, hydrate it at startup and flush writes behind
 * the caller's back — and to warn, twice, that reading before hydration starts the
 * app on empty state and then overwrites the real state on the first write. The
 * port went async when the premise behind its sync-ness expired (see the note on
 * `KeyValueStore` in the core's ports), and the mirror, the hydration step and
 * that whole failure mode went with it.
 *
 * **MMKV's synchronous JSI API is deliberately not used, and that is the same
 * decision read from the other end.** MMKV can answer without a promise, so this
 * file could make the ports synchronous again — and would buy back exactly the
 * mirror and the data-loss trap that were just deleted, because a port is
 * synchronous for every host or for none, and the web build behind localStorage is
 * no more able to answer before the first frame than AsyncStorage was. A
 * synchronous backend under an asynchronous port simply resolves a value, which is
 * what the `async` keywords below cost.
 * [ADR 0026](../../../../../adr/0026-react-native-review-and-hardening.md) §4 records
 * the swap and the measurements behind it.
 *
 * What remains of the old arrangement, deliberately: `persist()` still debounces,
 * so a burst of writes still collapses into one — that throttle lives with the
 * caller that knows what changed, not here.
 */

/**
 * Two stores, because two stores cannot reach each other.
 *
 * `STATE_ID` holds what the reader chose: bookmarks, settings, the session.
 * `CACHE_ID` holds what the network answered, and the core's cache evicts from it
 * under a byte budget and an LRU order. Separate instances are what make "the
 * eviction policy can never reach a bookmark" a property of the storage layout
 * rather than a promise in a comment: they are two files on device and two key
 * prefixes in localStorage, so a cache key handed to the wrong port finds nothing
 * at all. The core's half of the same guarantee is that eviction speaks only to
 * `BlobStore` — see the port's own note.
 *
 * No prefix inside either store. That is what the old `kv:` / `blob:` prefixes
 * were for, back when one AsyncStorage namespace held both plus whatever else a
 * dependency put there; an instance of one's own does the same job without a
 * string to get wrong. The old keys are abandoned rather than migrated: the app is
 * unreleased, so a fallback read would be a second failure mode bought for
 * development data nobody needs.
 */
const STATE_ID = 'correctiv.state';
const CACHE_ID = 'correctiv.cache';

/**
 * Opening is tried once per store, and an unavailable backend is reported once,
 * rather than turning every call into a silent miss.
 *
 * **The probe is the load-bearing part.** Two things can make a store unusable,
 * and neither is a missing key: the native module is absent (a build without the
 * Nitro module linked), or there is no `window` to hold localStorage — which is
 * exactly what happens while `expo export --platform web` prerenders each route in
 * Node. MMKV's web build does not fail when the instance is created; it fails on
 * the first call that touches storage. So one call is made here, on purpose, and
 * the result decides for the rest of the process.
 *
 * The prerender case is benign and correct: a read there is a miss, so the static
 * HTML carries the app's empty state and the browser fills it in on hydration,
 * which is what a prerendered page should contain. What it must not be is quiet or
 * repeated — quiet hides a broken build, and repeated is one line per key per
 * route in the export log.
 *
 * **What the probe cannot see, and why there is a second check.** A browser with
 * site data switched off throws on `window.localStorage` itself, and MMKV's web
 * build catches that inside `getLocalStorage()` and hands back a module-global
 * `Map` instead. So the probe passes, every write resolves, every read in the same
 * session answers — and nothing survives a reload. That is the failure issue #96
 * asks to be surfaced, and it is the only one of the three that looks like success
 * from here, so the check below repeats MMKV's own question rather than trusting
 * the answer it never reports.
 */
const opened = new Map<string, MMKV | null>();

/**
 * Whether what this host writes outlives the session.
 *
 * On native the store is a file and the answer is yes. In a browser it is the same
 * question MMKV's `getLocalStorage()` asks, in the same order: is there a DOM at
 * all, and does touching `localStorage` throw. The duplication is the point — the
 * one place that knows the answer keeps it.
 */
function storageOutlivesTheSession(): boolean {
  // `window` exists on native and `window.document` does not, which is how MMKV's
  // web build decides it is in a browser. In Node during a prerender there is no
  // `window` either, and that case is already reported by the probe's throw.
  if (typeof window === 'undefined' || window.document?.createElement == null) return true;
  try {
    return window.localStorage != null;
  } catch {
    return false;
  }
}

function store(id: string): MMKV | null {
  if (!opened.has(id)) {
    try {
      const instance = createMMKV({ id });
      instance.contains('storage-probe'); // reaches the backend; see above
      opened.set(id, instance);
      if (!storageOutlivesTheSession()) {
        // Not treated as unavailable: an in-memory store still carries the session,
        // and rejecting every write would turn a browser setting into an app that
        // cannot be used at all. It is said once per store, like the case below.
        console.warn(
          `[platform] storage '${id}' opened, but this browser refuses localStorage — MMKV is holding it in memory and nothing will survive a reload`,
        );
      }
    } catch (err) {
      opened.set(id, null);
      console.warn(`[platform] storage '${id}' is unavailable, nothing will persist:`, err);
    }
  }
  return opened.get(id) ?? null;
}

/**
 * The two stores, by id, opened if they are not already.
 *
 * One reader: the MMKV inspector in `lib/devtools/AgentTools.tsx`, which is
 * development-only and is selected away at module scope in a release build, so
 * nothing in the shipped app calls this. It is here rather than a second
 * `createMMKV({ id })` inside that file so that the inspector watches the very
 * handles `persist()` and the cache write through, and so that the two ids stay
 * one fact in one place.
 *
 * A store that failed to open is left out rather than reported as empty: a panel
 * listing a namespace with no keys says the app wrote nothing, which is a
 * different fault from the one `store()` already warned about.
 */
export function openStores(): Record<string, MMKV> {
  const open: Record<string, MMKV> = {};
  for (const id of [STATE_ID, CACHE_ID]) {
    const instance = store(id);
    if (instance) open[id] = instance;
  }
  return open;
}

/**
 * A read that fails and a key that is absent are the same thing to `persist()`:
 * it starts that slice from its initial state. Logged, because a broken storage
 * backend otherwise looks exactly like state that resets on its own.
 *
 * A write is deliberately NOT swallowed. `persist()` keeps its "last written"
 * pointer unchanged when a write rejects, so the next change to that slice tries
 * again; swallowing here would make that impossible and would hide the one failure
 * this app can actually hit in a browser, a full localStorage quota.
 */
const keyValue: KeyValueStore = {
  // `async` on a synchronous body, everywhere below, so that a backend that throws
  // produces a REJECTED promise rather than a synchronous throw out of a call the
  // port promised would be awaitable.
  async getString(key) {
    try {
      return store(STATE_ID)?.getString(key) ?? null;
    } catch (err) {
      console.warn(`[platform] reading ${key} failed:`, err);
      return null;
    }
  },
  async setString(key, value) {
    const state = store(STATE_ID);
    if (!state) throw new Error(`storage '${STATE_ID}' is unavailable`);
    state.set(key, value);
  },
  async remove(key) {
    store(STATE_ID)?.remove(key);
  },
};

/**
 * The cache's store. `namespace/name` is one flat key, which is all the core asks
 * for — the names it passes are already hashed and file-safe.
 *
 * A failed read is a miss, because to every caller in the core a broken cache and
 * an empty one mean the same thing. A failed WRITE is not silent: on web that is
 * the localStorage quota, and a quota that is full is a fact about the device the
 * developer opening the console should be able to see. The core still treats it as
 * best-effort and carries on.
 */
const blobs: BlobStore = {
  async read(namespace, name) {
    try {
      return store(CACHE_ID)?.getString(`${namespace}/${name}`) ?? null;
    } catch {
      return null; // a cache miss and a broken cache are the same thing to a caller
    }
  },
  async write(namespace, name, contents) {
    try {
      store(CACHE_ID)?.set(`${namespace}/${name}`, contents);
    } catch (err) {
      console.warn('[platform] caching a blob failed:', err);
    }
  },
  async delete(namespace, name) {
    try {
      store(CACHE_ID)?.remove(`${namespace}/${name}`);
    } catch (err) {
      console.warn('[platform] evicting a blob failed:', err);
    }
  },
};

/**
 * What this app ships in its bundle: the feed snapshots, pre-extracted articles and
 * inlined covers from `npm run offline-articles`, plus the podcast snapshots from
 * `npm run offline-podcasts`.
 *
 * On native these are what the first round of this port was for — the demo must not
 * depend on Wi-Fi. On **web** they used to be the only way content ever appeared;
 * since [ADR 0015](../../../../../adr/0015-reading-correctiv-org-through-its-rest-api.md)
 * articles come live from correctiv.org's REST API, which reflects the Origin. The
 * Castopod instance still sends no `Access-Control-Allow-Origin`, so the podcast
 * snapshot is what a browser gets, and every bundle here remains the floor when a
 * request fails.
 *
 * `image` answers with an inlined data URI rather than the remote URL it used to
 * echo back. Echoing it was a no-op: `adoptBundledImages` in the core swaps a feed
 * item's image for the bundled one precisely because the remote URL cannot load
 * when there is no network, and handing back the same URL left the offline lists
 * grey. It is the one entry that stays empty on web — `covers.web.ts` says why.
 */
const content: ContentBundle = {
  feed: (key) => OFFLINE_FEEDS[key] ?? null,
  article: (url) => (OFFLINE_ARTICLES[url] as Article | undefined) ?? null,
  image: (url) => OFFLINE_COVERS[url] ?? null,
  podcastSeries: (id) => OFFLINE_PODCASTS[id] ?? null,
};

/**
 * Where a fault goes, and the one file issue #95 changes.
 *
 * This is the whole of what a report does today: a line in the log, which is
 * exactly what the error boundary already did before the port existed. What is
 * new is that it is now an implementation of a port rather than a placeholder, so
 * the core can report too and choosing a provider is a change to this function
 * ([ADR 0032](../../../../../adr/0032-a-port-for-the-error-report-before-a-provider-for-it.md)).
 *
 * `console.error` for every report, with no severity in the port to grade it by.
 * That is deliberate rather than unfinished: a severity is policy about a service
 * nobody has chosen, and a report that is not worth a developer's attention is a
 * report that should not have been made.
 *
 * **A release build has no console, so this is not a quieter report — it is no
 * report.** `Localisation.tsx` made the same call in the other direction and said
 * so; the reasoning is to be re-made here rather than inherited, once a report has
 * somewhere to go. Until then the honest description of this app's reporting is
 * "development only", and that is the gap #95 closes.
 *
 * Nothing is awaited and nothing throws, which is the port's contract: a report
 * must not change what the caller does next.
 */
const errors: ErrorReporter = {
  report({ domain, code, context, cause }) {
    // The code first, because it is the part that is searchable and stable. The
    // cause goes through as the object it arrived as, so a devtools console can
    // still expand its stack.
    console.error(`[${domain}] ${code}`, context ?? {}, cause);
  },
};

/**
 * Storage, bundled content and reporting. The audio backend is the one port added
 * at the boot site (`app/_layout.tsx`) rather than here, so that reasoning about
 * where state is stored does not drag in an audio SDK — and so these ports stay
 * testable without one.
 */
export const expoPlatform: CorePlatform = { keyValue, blobs, content, errors };
