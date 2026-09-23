import type { UnknownAction } from '@reduxjs/toolkit';

import { platform } from '../ports';
import type { AppStore, RootState } from './store';

/**
 * Minimal persistence: hydrates slices through the KeyValueStore port at startup
 * and writes the declared keys back, debounced.
 *
 * Deliberately not `redux-persist`: this core already declares exactly what it
 * needs from a host as a port, so going through the port keeps one storage seam
 * instead of two — the Expo host maps it to MMKV, and tests to memory. It also
 * keeps the storage layout, `store.<id>` holding only the declared keys, which is
 * what lets an installed app keep its state across this migration.
 *
 * Each slice owns its own storage key, so one corrupt payload cannot take the
 * others down with it.
 */
export interface PersistedSlice {
  /**
   * The slice's key in the root reducer AND its storage key.
   *
   * Typed against `RootState` rather than left as a string: the writer looks the
   * slice up by this name, so a typo would hydrate correctly and then never write
   * again — `undefined === undefined` reads as "unchanged" forever. No throw, no
   * log, just settings that quietly stop surviving a restart.
   */
  id: keyof RootState & string;
  keys: string[];
  hydrate: (partial: Record<string, unknown>) => UnknownAction;
}

/**
 * Declares one slice as persisted, tying its id to its own key list and hydrate
 * action. The generic is what makes `keys` check against the slice's real state —
 * a typo there would otherwise persist nothing and say nothing.
 */
export function persisted<S extends object>(
  id: keyof RootState & string,
  keys: Array<keyof S & string>,
  hydrate: (partial: Partial<S>) => UnknownAction,
): PersistedSlice {
  return { id, keys, hydrate: hydrate as PersistedSlice['hydrate'] };
}

const DEBOUNCE_MS = 250;

/** Any one slice of the tree, as `state[slice.id]` hands it over. */
type SliceState = RootState[keyof RootState];

function pick(source: SliceState, keys: string[]): Record<string, unknown> {
  // Spread rather than cast: a slice state is an interface, so TypeScript grants
  // it no string index signature and a plain `string` cannot index it. `keys` is
  // a string list by the time it arrives here — the declaration is where
  // `persisted<S>()` checks it against the slice's real fields. One shallow copy
  // of a settings-sized object, at most once per 250 ms, is what it costs to
  // leave the widening here instead of on `getState()`.
  const fields: Record<string, unknown> = { ...source };
  const slice: Record<string, unknown> = {};
  for (const key of keys) slice[key] = fields[key];
  return slice;
}

/**
 * Hydrates every declared slice, then subscribes.
 *
 * Awaited by the host before the first render — the store must carry the persisted
 * state before a screen can read it, or the app paints its defaults and the
 * onboarding gate fires on state that is about to be replaced.
 */
export async function persist(store: AppStore, slices: PersistedSlice[]): Promise<void> {
  const kv = platform().keyValue;
  const state = () => store.getState();

  for (const slice of slices) {
    const storageKey = `store.${slice.id}`;
    // Sequential on purpose: five small reads, and a failure should discard only
    // its own key rather than abandon the batch.
    // eslint-disable-next-line no-await-in-loop
    const raw = await kv.getString(storageKey);
    if (!raw) continue;
    try {
      const saved = JSON.parse(raw) as Record<string, unknown>;
      // Only the declared keys, so a stale payload cannot inject unknown state
      // or clobber a field with data from an older app version.
      const restored: Record<string, unknown> = {};
      for (const key of slice.keys) {
        if (key in saved) restored[key] = saved[key];
      }
      store.dispatch(slice.hydrate(restored));
    } catch {
      // discard corrupt persistence instead of crashing at startup
      // eslint-disable-next-line no-await-in-loop
      await kv.remove(storageKey);
    }
  }

  /**
   * One subscription for all of them, with two guards before any timer is armed.
   *
   * Redux hands every subscriber every action, so both guards earn their keep:
   *
   * - **Nothing persisted changed → do nothing.** Immer gives a slice a new
   *   identity only when it actually changed, so the comparison is exact and
   *   costs one pointer per slice. Without it, an audio position tick — twice a
   *   second — would re-serialise the saved articles and the session.
   *
   *   And a slice that changed only in a key it does not persist is unchanged
   *   here too, compared key by key once the pointer has moved. The home layout's
   *   slice is why: it stamps every fetch attempt beside a document of up to a
   *   quarter of a megabyte, and rewriting the document into `localStorage` on
   *   each stamp would spend the quota's write budget on a field nobody reads back.
   *
   * - **An armed timer is never postponed.** This is a trailing-edge throttle,
   *   not a debounce, and the difference is the whole point: a debounce resets on
   *   every dispatch, so a burst of unrelated traffic (a pull-to-refresh patches
   *   six feeds, then media, then podcasts) would hold a bookmark the user just
   *   tapped out of storage until the burst ended. Arming on the FIRST change
   *   instead means the write lands 250 ms later no matter what else the app is
   *   doing.
   */
  const written = new Map<keyof RootState, SliceState>();
  for (const slice of slices) written.set(slice.id, state()[slice.id]);
  let timer: ReturnType<typeof setTimeout> | null = null;

  /** Whether a declared key of `slice` differs from what was last written. */
  const changed = (slice: PersistedSlice, current: RootState) => {
    const now = current[slice.id];
    const before = written.get(slice.id);
    if (now === before) return false;
    if (before === undefined) return true;
    const a = pick(now, slice.keys);
    const b = pick(before, slice.keys);
    if (slice.keys.some((key) => a[key] !== b[key])) return true;
    // The same persisted keys under a new pointer: remember the pointer, so the next
    // dispatch is back to one comparison instead of two shallow copies.
    written.set(slice.id, now);
    return false;
  };

  const dirty = (current: RootState) => slices.some((slice) => changed(slice, current));

  store.subscribe(() => {
    if (timer || !dirty(state())) return;
    timer = setTimeout(() => {
      timer = null;
      const current = state();
      const pending = slices
        .filter((slice) => changed(slice, current))
        .map(async (slice) => {
          const value = current[slice.id];
          await kv.setString(`store.${slice.id}`, JSON.stringify(pick(value, slice.keys)));
          // Only after the write resolves. A failed write leaves the old pointer,
          // so the next change to that slice tries again instead of assuming the
          // value is safely on disk.
          written.set(slice.id, value);
        });

      // Not awaited: the timer fires the write, it does not wait for it. Nothing
      // reads storage again while the app is running, and a rejected write must
      // not become an unhandled rejection.
      void Promise.all(pending).catch((err: unknown) => {
        console.warn('[persist] write failed, will retry on the next change:', err);
      });
    }, DEBOUNCE_MS);
  });
}
