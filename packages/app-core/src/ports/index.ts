/**
 * Platform ports — everything the core needs from a host, in one file.
 *
 * `@correctiv/app-core` must never import a platform SDK. Whatever it cannot do
 * on its own is declared here as an interface and supplied at startup:
 *
 *   configurePlatform(expoPlatform)   // apps/mobile/src/lib/platform/expo.ts
 *
 * Each port has a session-only or empty default, so an unconfigured core (tests,
 * a script) degrades instead of throwing. Persistence is best-effort everywhere:
 * the blob cache is a nicety, and a lost write costs the last few hundred
 * milliseconds of settings, never correctness. `ErrorReporter` is the same rule
 * for a port that holds nothing: its default reports nowhere.
 *
 * Read `blobs` and `content` as the two halves of "where does content come
 * from": `blobs` is what the app cached from the network, `content` is what the
 * host shipped in its bundle. Neither is required.
 */

import type { FeedItem, FeedKey } from '../types/models';
import type { Article } from '../articles/types';
import type { PodcastSeries } from '../data/podcasts';

// --- storage ------------------------------------------------------------------

/**
 * Small string key/value store — the store persistences in `stores/persist.ts`.
 *
 * Asynchronous, like `BlobStore`. It was synchronous, on the grounds that
 * `persist()` read it while constructing a store, long before anything could
 * await — and a host whose storage is async then had to keep an in-memory mirror
 * and hydrate it before the first render. That cost a documented data-loss trap:
 * read before hydration and the app starts on empty state, then overwrites the
 * real state on the first write.
 *
 * The premise expired with the move to Redux. The store is built by
 * `createAppStore()` at module load; `persist()` is a separate, later call that
 * the host already awaits. So there is nothing left to be earlier than, and the
 * mirror — along with the trap — is gone.
 */
export interface KeyValueStore {
  getString(key: string): Promise<string | null>;
  setString(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * Namespaced text-blob store — the HTTP and feed cache. `namespace` groups
 * entries (one per feed kind), `name` is an opaque file-safe key.
 *
 * Asynchronous, as `KeyValueStore` also became: what separates the two ports is
 * what they hold, not when they answer. A blob here is a megabyte of cached feeds,
 * not a settings string, and every caller already sits inside an async action. The
 * port was sync while a synchronous file API was the only implementation, and that
 * shape forced this host to hydrate its entire cache into memory before the first
 * frame just to answer a read.
 *
 * ## Why this port can delete and `KeyValueStore` cannot be reached from the cache
 *
 * `services/cache.service.ts` evicts, and eviction needs a way to say "drop this".
 * The port was `read` and `write` until then, which made an unbounded cache not
 * merely unbounded but impossible to bound.
 *
 * `delete` is the whole of the cache's destructive reach, and it points here.
 * Bookmarks, settings and session state are `KeyValueStore`, a different port, and
 * the cache module imports no name from it — so no key the reader chose is
 * addressable by the policy that evicts. The host doubles that: this store and the
 * key/value store are two separate backends, so even a name passed to the wrong
 * port would find nothing.
 */
export interface BlobStore {
  read(namespace: string, name: string): Promise<string | null>;
  write(namespace: string, name: string, contents: string): Promise<void>;
  /** Drop one entry. Deleting what is not there is not an error. */
  delete(namespace: string, name: string): Promise<void>;
}

// --- bundled content ----------------------------------------------------------

/**
 * What the host ships inside its own bundle, for when the network is not there.
 *
 * The demo must never depend on Wi-Fi, and a host may ship that safety net in any
 * form it likes. This one imports a generated TypeScript module; an earlier one
 * read JSON files out of its app folder. Both answer these four questions, so the
 * cascades in the core's stores can ask them without knowing which host they are
 * running in.
 *
 * Every method may return null: a host that bundles nothing implements nothing.
 */
export interface ContentBundle {
  /** A bundled snapshot of one feed. */
  feed(key: FeedKey): FeedItem[] | null;
  /** A bundled, pre-extracted article. */
  article(url: string): Article | null;
  /** A host-resolvable cover image for an article the host bundled. */
  image(url: string): string | null;
  /** A bundled snapshot of one podcast series. */
  podcastSeries(id: string): PodcastSeries | null;
}

// --- audio --------------------------------------------------------------------

/**
 * One playback tick as the core's audio store wants to hear it.
 *
 * Modelled on what expo-audio reports, which was the richer of the two backends
 * this was designed against: it knows about buffering, completion and live
 * streams. A poorer backend synthesises the same fields from a polling timer, and
 * that translation is its own job, Android's millisecond positions and its habit
 * of jumping to 0 instead of firing a completion callback included. Keeping it
 * there is the point. The state machine below stays one implementation, and each
 * platform's quirks stay next to the SDK that has them.
 */
export interface PlaybackStatus {
  /** Actually producing sound right now. */
  playing: boolean;
  /** The source is ready; false while still opening. */
  loaded: boolean;
  buffering: boolean;
  positionSec: number;
  /** 0 for live streams — Icecast has no length. */
  durationSec: number;
  /** The source reached its end on this tick. */
  finished: boolean;
  live: boolean;
  /** Non-null turns the player into its error state. */
  error?: string | null;
}

/** Lock-screen / notification metadata for the current track. */
export interface NowPlaying {
  title: string;
  artist?: string;
  artworkUrl?: string;
}

/**
 * A host's audio player, seen from the core.
 *
 * `load` takes the track's url verbatim — an https stream, or a bundled path
 * like `assets/audio/sample-episode.mp3` that only the host can resolve.
 *
 * ## A command must never call the status listener synchronously
 *
 * `onStatus` reports what the player is DOING; the commands below are what the
 * core TELLS it to do, and the core sets its own state around them. A backend
 * that emits from inside `pause()` re-enters the store's handler mid-decision —
 * and the store may answer by calling `pause()` again.
 *
 * That is not hypothetical. A backend once did exactly this and killed the app
 * with `RangeError: Maximum call stack size exceeded` at the moment the 60-second
 * club preview ran out. The gate called `pause()`, `pause()` emitted, the gate saw
 * an unchanged position and called `pause()` again. Nothing caught it, because
 * expo-audio does not re-enter, so the tests stayed green and the crash only
 * appeared on a device one minute into an episode.
 *
 * Emit from the player's own callbacks and from a polling timer. Never from a
 * command.
 */
export interface AudioBackend {
  load(url: string, nowPlaying: NowPlaying): Promise<void>;
  play(): void;
  pause(): void;
  seekTo(seconds: number): Promise<void>;
  setRate(rate: number): void;
  /** Release the source. A paused live stream keeps buffering otherwise. */
  release(): void;
  /** Register the one listener the core's audio store installs at startup. */
  onStatus(listener: (status: PlaybackStatus) => void): void;
}

// --- error reporting ----------------------------------------------------------

/**
 * Which part of the app a report came from.
 *
 * A closed union, and the reason it is closed is not type safety. Reporting is
 * allowed from two places and from nowhere else
 * ([ADR 0032](../../../../adr/0032-a-port-for-the-error-report-before-a-provider-for-it.md)):
 * the host's error boundary, which is the only thing that sees a render fault,
 * and the core, for the faults no host can see. A screen is deliberately not
 * among them — a screen that catches something and reports it has decided the
 * fault is worth a stranger's attention, and that habit grows quietly. Adding a
 * third member is one line here and an argument in the pull request, which is the
 * ratio this union exists to set.
 *
 * Codes are unique WITHIN a domain, never across it. That is what lets each union
 * of codes live beside the code that dispatches it, the way `AudioError` does,
 * instead of in one central list here that nobody owns and everybody appends to.
 *
 * `layout` is the second member from the core and the argument ADR 0036 §7 made for
 * it: the home screen's document is fetched, so a section the app cannot read is a
 * fault nobody but the core can see, and it means a reader is looking at a screen
 * the newsroom believes it filled. `lib/home-layout.ts` dispatches it.
 */
export type ErrorDomain = 'render' | 'podcasts' | 'layout';

/**
 * One fault, in the shape a machine wants it rather than a reader.
 *
 * **A code, not a sentence**, for the reasons `AudioError` carries a code: it is
 * the smallest thing that is true, the caller knows what failed and not what to
 * say about it, and it survives translation because it is not language. What is
 * different here is who reads it, so there is no `Record<Code, …>` of wording
 * beside it and there should not be one.
 *
 * `code` is `string` at the port and closed at the call site. The unions belong
 * next to what dispatches them, and this file cannot import them anyway without
 * making `ports` depend on `stores` — the cycle the port exists to prevent. A
 * `const code: PodcastsErrorCode` at the call site is what makes a typo fail to
 * compile; see `stores/podcasts.ts`.
 *
 * `context` is what the caller ALREADY HELD, as values: a handle, a feed key, an
 * HTTP status, a count. That is the line "without inventing it" draws. Prose
 * composed for the occasion is not context, and neither is a rendering of the
 * fault. Primitives only, so the one thing that cannot be done here is paste in a
 * response body and call it detail.
 *
 * `cause` is the thrown thing, passed on unchanged. Not `String(err)`: every sink
 * worth choosing takes an `Error` and knows more about serialising one than this
 * file does, and stringifying here throws the stack away before anybody can ask
 * for it — which would be inventing a rendering after all.
 */
export interface ErrorReport {
  domain: ErrorDomain;
  code: string;
  context?: Record<string, string | number | boolean | null>;
  cause?: unknown;
}

/**
 * Where a fault goes when the screen it happened on is not going to mention it.
 *
 * **Returns `void`, and that is a contract rather than a convenience.** A report
 * must not change what the caller does next: the podcast library still falls back
 * to its bundle, the boundary still shows the recovery screen. A promise here
 * would invite an `await` in front of exactly those lines — and a promise nobody
 * awaits becomes an unhandled rejection the first time a provider's endpoint is
 * down, which turns a reporting outage into a crash. A host that sends something
 * over a network does it behind this call and keeps its own failures.
 *
 * Never throws, for the same reason: a reporter that throws takes down the code
 * path that was already having a bad day.
 *
 * What a host does with a report is the host's, and today it is one log line.
 * Choosing a provider is a change to that one implementation
 * (`apps/mobile/src/lib/platform/expo.ts`) and to nothing else, which is the
 * whole point of declaring this before anybody has chosen one.
 */
export interface ErrorReporter {
  report(report: ErrorReport): void;
}

// --- the platform -------------------------------------------------------------

export interface CorePlatform {
  keyValue: KeyValueStore;
  blobs: BlobStore;
  content: ContentBundle;
  /** Absent on a host without audio — the audio store then stays idle. */
  audio?: AudioBackend;
  /** Required, because the default already answers: it reports nowhere. */
  errors: ErrorReporter;
}

/** Bundles nothing. The default, and what a browser host without a snapshot has. */
export function createEmptyContentBundle(): ContentBundle {
  return {
    feed: () => null,
    article: () => null,
    image: () => null,
    podcastSeries: () => null,
  };
}

/**
 * Reports nowhere. The default, and what tests and scripts want: a suite that
 * shipped its failures to a crash reporter would be reporting the failures it was
 * written to cause.
 *
 * It is the `createEmptyContentBundle()` move for a port with no data in it — the
 * unconfigured core degrades rather than throws — and it is the one default in
 * this file whose correctness cannot be seen by reading it, because silence is
 * also what a broken implementation looks like. `test/ports.test.ts` asserts that
 * it stays silent and `test/podcasts-store.test.ts` asserts that a configured one
 * is reached, and neither passes without the other meaning something.
 */
export function createNoOpErrorReporter(): ErrorReporter {
  return { report: () => {} };
}

/** Session-only storage. Used by tests and by any host that has not registered yet. */
export function createMemoryPlatform(): CorePlatform {
  const kv = new Map<string, string>();
  const blobs = new Map<string, string>();
  return {
    keyValue: {
      getString: (key) => Promise.resolve(kv.get(key) ?? null),
      setString: (key, value) => {
        kv.set(key, value);
        return Promise.resolve();
      },
      remove: (key) => {
        kv.delete(key);
        return Promise.resolve();
      },
    },
    blobs: {
      read: (namespace, name) => Promise.resolve(blobs.get(`${namespace}/${name}`) ?? null),
      write: (namespace, name, contents) => {
        blobs.set(`${namespace}/${name}`, contents);
        return Promise.resolve();
      },
      delete: (namespace, name) => {
        blobs.delete(`${namespace}/${name}`);
        return Promise.resolve();
      },
    },
    content: createEmptyContentBundle(),
    errors: createNoOpErrorReporter(),
  };
}

let current: CorePlatform = createMemoryPlatform();

/** Called once by the host before any store or service is used. */
export function configurePlatform(next: CorePlatform): void {
  current = next;
}

export function platform(): CorePlatform {
  return current;
}

/** Test helper — drops any host registration and returns to session-only storage. */
export function resetPlatform(): void {
  current = createMemoryPlatform();
}
