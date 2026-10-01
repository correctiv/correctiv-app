import {
  createAudioPlayer,
  type AudioPlayer as ExpoAudioPlayer,
  type AudioStatus,
} from 'expo-audio';

import type { AudioBackend, NowPlaying, PlaybackStatus } from '@correctiv/app-core';

import { ensureAudioMode } from './setup';
import { toAudioSource } from './sources';

/**
 * The Expo audio backend: expo-audio translated into the core's `AudioBackend`
 * port. The state machine on the other side of that port lives in
 * `@correctiv/app-core/stores/audio`, where any host can share it.
 *
 * Deliberately `createAudioPlayer` and NOT the `useAudioPlayer` hook: the hook
 * ties the player instance to a component's lifetime and releases it on unmount.
 * That is exactly what must not happen — playback has to survive navigation, tab
 * changes and the background. So the instance lives in this module and React only
 * ever subscribes to the store.
 */

let player: ExpoAudioPlayer | null = null;
let listener: ((status: PlaybackStatus) => void) | null = null;

function instance(): ExpoAudioPlayer {
  if (!player) {
    const created = createAudioPlayer(null, { updateInterval: 500 });
    player = created;
    created.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      /*
       * Only the current player speaks for the track. A released player's teardown
       * runs later on Android (`sharedObjectDidRelease` launches it on the main
       * thread), so its last status can arrive after the next track has built a new
       * player; forwarded, a stale "finished" would stop that track.
       */
      if (player !== created) return;
      listener?.({
        playing: status.playing,
        loaded: status.isLoaded,
        buffering: status.isBuffering,
        positionSec: status.currentTime,
        durationSec: status.duration,
        finished: status.didJustFinish,
        live: status.isLive,
        error: status.error,
      });
    });
  }
  return player;
}

export const expoAudio: AudioBackend = {
  async load(url, nowPlaying: NowPlaying) {
    await ensureAudioMode();
    const active = instance();
    active.replace(toAudioSource(url));
    // Lock screen / notification. Needs `interruptionMode: 'doNotMix'`, which
    // ensureAudioMode sets — without it the OS does not attach the controls to us.
    active.setActiveForLockScreen(true, {
      title: nowPlaying.title,
      artist: nowPlaying.artist,
      artworkUrl: nowPlaying.artworkUrl,
    });
  },

  play() {
    instance().play();
  },

  pause() {
    player?.pause();
  },

  async seekTo(seconds) {
    await instance().seekTo(seconds);
  },

  setRate(rate) {
    player?.setPlaybackRate(rate);
  },

  /**
   * Frees the player, and the next `load` builds a fresh one.
   *
   * A paused live stream keeps buffering, so pausing is not enough. This used to
   * drop the source with `replace(null)`, which iOS and the web accept and Android
   * does not: its native `replace` takes a non-null `AudioSource`, and the call was
   * rejected with a synchronous throw from inside the press handler. "Wiedergabe
   * beenden" on the mini player closed the release build, measured on an Android 16
   * emulator on 2026-09-24. There is no call on Android that empties a player, so it
   * is released instead.
   *
   * `remove()` before `release()`, and both. `remove()` alone only takes the player
   * out of expo-audio's registry on Android and leaves the native player to the
   * garbage collector, buffering until then; `release()` alone frees it and leaves
   * the registry holding a freed player, which the module still walks when the audio
   * mode or the focus changes. On the web `release()` is `remove()` again, which is
   * harmless.
   */
  release() {
    if (!player) return;
    const released = player;
    player = null;
    released.pause();
    released.clearLockScreenControls();
    released.remove();
    released.release();
  },

  onStatus(next) {
    listener = next;
  },
};

/** Tests only: throws away the instance so the next load builds a fresh one. */
export function resetExpoAudio(): void {
  player?.remove();
  player = null;
  listener = null;
}
