// The core's audio store, seen as an MPRIS source.
//
// ## Why the store and not `audio/backend.ts`
//
// The backend is closer to the pipeline and would be the shorter wire, and it is the
// wrong end. `AudioBackend`'s own docblock records what happens when the two sides of
// that port disagree: the core keeps its own intent beside the backend's reported
// state, and a `Pause` arriving straight at GStreamer would leave the store believing
// it was still playing — the same class of desync that once cost a
// `RangeError: Maximum call stack size exceeded` a minute into an episode.
//
// So a shell's button dispatches the same thunk the app's own play button dispatches,
// and the store stays the single record of what the user asked for. The metadata comes
// from the same place, which is also where `nowPlaying` was going all along.
//
// ## The tick is the store's, not another timer
//
// `coreStore.subscribe` fires on every dispatch, and the audio store already receives
// a status tick every 500 ms from the backend. MPRIS therefore needs no timer of its
// own: `changed()` diffs against the last published snapshot and emits nothing when
// nothing moved, which is what keeps a 2 Hz tick from becoming 2 Hz of bus traffic.
// `Position` is deliberately outside that diff — the spec keeps it out of
// `PropertiesChanged` and a shell reads it when it wants it.

// Aliased, because the source below has a `stop` and a `seekTo` of its own and the
// two names meeting in one file is how a dispatch turns into a recursion.
import {
  isLive,
  seekTo as seekCoreTo,
  stop as stopCore,
  togglePlay as toggleCorePlay,
} from '@correctiv/app-core/stores/audio';
import type { AudioState } from '@correctiv/app-core/stores/audio';
import { coreStore } from '@/lib/store/core';

import type { MprisHandle, MprisSource, MprisStatus, MprisTrack } from './mpris.js';

const US_PER_SEC = 1_000_000;

/**
 * The store's five states onto MPRIS's three.
 *
 * `loading` REPORTS AS PAUSED, and the choice is about the button rather than the
 * label. A shell showing "Paused" offers Play, and pressing it dispatches `togglePlay`,
 * which from `loading` reaches `audio.play()` — a harmless no-op on something already
 * opening. Reported as "Playing" the shell would offer Pause, and `togglePlay` from
 * `loading` does NOT pause, so that press would do nothing at all. Both are brief;
 * only one of them has a button that means what it says.
 *
 * `error` is `Stopped` rather than something more specific because MPRIS has no error
 * state, and leaving it at `Paused` would offer a Play button for a stream that has
 * already failed.
 */
function statusOf(state: AudioState): MprisStatus {
  switch (state.status) {
    case 'playing':
      return 'Playing';
    case 'paused':
    case 'loading':
      return 'Paused';
    default:
      return 'Stopped';
  }
}

function trackOf(state: AudioState): MprisTrack | null {
  const track = state.track;
  if (track === null) return null;
  return {
    // The url, because it is what identifies a track across a re-render and is stable
    // for as long as this one is loaded. The service turns it into an object path.
    id: track.url,
    title: track.title,
    // `subtitle` is this app's artist line: a channel for an episode, and for the radio
    // the live marker the store writes.
    artist: track.subtitle,
    artworkUrl: track.artworkUrl,
    // A live stream has no length and the store says so with 0, which is exactly what
    // `MprisTrack.lengthUs` documents.
    lengthUs: Math.max(0, Math.round(state.durationSec * US_PER_SEC)),
  };
}

/**
 * Bind the audio store to `handle`, and answer the unsubscribe.
 *
 * Claims the bus name whenever a track is loaded and it was not before, and releases it
 * when the store goes back to having none — so the shell's entry appears with the first
 * episode and goes away with `stop`, rather than sitting there empty from launch.
 */
export function installAudioMpris(handle: MprisHandle): () => void {
  const read = (): AudioState => coreStore.getState().audio;

  const source: MprisSource = {
    get status() {
      return statusOf(read());
    },
    get track() {
      return trackOf(read());
    },
    get positionUs() {
      return Math.max(0, Math.round(read().positionSec * US_PER_SEC));
    },
    get canSeek() {
      const state = read();
      // Live has nothing to seek in, and a length of 0 would draw a bar with no scale.
      return state.track !== null && !isLive(state) && state.durationSec > 0;
    },
    get canPause() {
      return read().track !== null;
    },
    play(): void {
      // `togglePlay` and not a `play` action, because the core has no separate one: the
      // thunk reads the store and pauses only from `playing`, so this is a play
      // everywhere else and a no-op when it is already playing.
      if (read().status === 'playing') return;
      void coreStore.dispatch(toggleCorePlay());
    },
    pause(): void {
      if (read().status !== 'playing') return;
      void coreStore.dispatch(toggleCorePlay());
    },
    stop(): void {
      void coreStore.dispatch(stopCore());
    },
    seekBy(offsetUs: number): void {
      const state = read();
      if (state.track === null || isLive(state)) return;
      const target = state.positionSec + offsetUs / US_PER_SEC;
      // Clamped at both ends: the spec says a seek past the end is a "next track", and
      // with no track list the honest reading is the end of this one.
      const clamped = Math.min(Math.max(0, target), state.durationSec);
      void coreStore.dispatch(seekCoreTo(clamped));
    },
    seekTo(positionUs: number): void {
      const state = read();
      if (state.track === null || isLive(state)) return;
      const seconds = Math.min(Math.max(0, positionUs / US_PER_SEC), state.durationSec);
      void coreStore.dispatch(seekCoreTo(seconds));
    },
  };

  let held = false;
  const sync = (): void => {
    const loaded = read().track !== null;
    if (loaded && !held) {
      held = true;
      handle.claim(source);
      return;
    }
    if (!loaded && held) {
      held = false;
      handle.release(source);
      return;
    }
    if (held) handle.changed(source);
  };

  sync();
  return coreStore.subscribe(sync);
}
