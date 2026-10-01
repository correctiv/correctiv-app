import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetExclusiveMedia } from '../src/media/exclusive-playback';
import {
  configurePlatform,
  createMemoryPlatform,
  type AudioBackend,
  type PlaybackStatus,
} from '../src/ports';
import {
  isLive,
  playEpisode,
  playRadio,
  resetAudioController,
  seekTo,
  setSpeed,
  stop,
} from '../src/stores/audio';
import { createAppStore, type AppStore } from '../src/stores/store';

/**
 * The audio state machine, driven through the port rather than through a real SDK.
 *
 * `apps/mobile/__tests__/audio-player.test.ts` already covers this via expo-audio.
 * What that cannot cover is a backend whose commands call the status listener
 * straight back, and that difference cost this project a crash on a device. So the
 * fake here is deliberately the awkward shape.
 */
interface Fake extends AudioBackend {
  /** Feed a tick in, as the host's timer or callback would. */
  tick(partial: Partial<PlaybackStatus>): void;
  calls: string[];
  /** Emit from inside pause(), the way a badly behaved backend does. */
  reentrant: boolean;
  /**
   * How often the core registered a status listener. Counted separately from
   * `calls`, which is the command log and is asserted on exactly.
   */
  attachments: number;
}

function createFakeBackend(): Fake {
  let listener: ((status: PlaybackStatus) => void) | null = null;
  let last: PlaybackStatus = {
    playing: false,
    loaded: true,
    buffering: false,
    positionSec: 0,
    durationSec: 100,
    finished: false,
    live: false,
    error: null,
  };

  const fake: Fake = {
    calls: [],
    reentrant: false,
    attachments: 0,
    tick(partial) {
      last = { ...last, ...partial };
      listener?.(last);
    },
    load(url) {
      fake.calls.push(`load:${url}`);
      return Promise.resolve();
    },
    play() {
      fake.calls.push('play');
    },
    pause() {
      fake.calls.push('pause');
      // The shape that used to recurse: a command reporting back synchronously.
      if (fake.reentrant) listener?.({ ...last, playing: false });
    },
    seekTo(seconds) {
      fake.calls.push(`seek:${seconds}`);
      return Promise.resolve();
    },
    setRate(rate) {
      fake.calls.push(`rate:${rate}`);
    },
    release() {
      fake.calls.push('release');
    },
    onStatus(next) {
      fake.attachments += 1;
      listener = next;
    },
  };
  return fake;
}

let backend: Fake;
let store: AppStore;

/**
 * The station's words, which a host formats and this thunk no longer holds. In
 * ENGLISH here for the reason the reader document's fixture is: what the core
 * still decides is that the stream is live and which URL it loads, not what it is
 * called.
 */
const RADIO = { title: 'Salon5 Radio', subtitle: '● LIVE · 24/7 from Bottrop' };

const EPISODE = {
  title: 'Bonusfolge',
  subtitle: 'Backstage · Club',
  url: 'https://salon5.correctiv.net/x.mp3',
  episodeId: 'bonus-1',
};

beforeEach(() => {
  resetExclusiveMedia();
  // The controller's watchdog and backend listener are module state; the slice's
  // state comes back with a fresh store.
  resetAudioController();
  store = createAppStore();
  backend = createFakeBackend();
  configurePlatform({ ...createMemoryPlatform(), audio: backend });
});

describe('starting playback', () => {
  it('loads the track and marks the radio live', async () => {
    await store.dispatch(playRadio(RADIO));
    expect(backend.calls).toEqual(['load:https://icecast.correctiv.net/salon5low', 'play']);
    expect(isLive(store.getState().audio)).toBe(true);
    expect(store.getState().audio.status).toBe('loading');
    // The URL is the core's and the words are the caller's — the track is where
    // the two meet, and where the finished German used to be typed.
    expect(store.getState().audio.track).toMatchObject(RADIO);
  });

  it('follows the ticks through to playing', async () => {
    await store.dispatch(playEpisode(EPISODE));
    backend.tick({ playing: true, positionSec: 3 });
    expect(store.getState().audio).toMatchObject({ status: 'playing', positionSec: 3 });
  });

  it('reports buffering as loading, not as paused', async () => {
    await store.dispatch(playEpisode(EPISODE));
    backend.tick({ playing: false, buffering: true, loaded: true });
    expect(store.getState().audio.status).toBe('loading');
  });

  /**
   * `AudioBackend.onStatus` takes the ONE listener the core installs, and the
   * core has to attach it on first use because the host may register its platform
   * after this module was imported. Attaching again per start would leave it to
   * the adapter whether the second registration replaces the first or doubles
   * every tick — which is a decision no adapter has been asked to make.
   */
  it('attaches the backend status listener exactly once, however often it starts', async () => {
    await store.dispatch(playRadio(RADIO));
    await store.dispatch(playEpisode(EPISODE));
    expect(backend.attachments).toBe(1);
  });

  it('says so when the host has no audio backend at all (the web target)', async () => {
    configurePlatform(createMemoryPlatform());
    resetAudioController();
    store = createAppStore();
    await store.dispatch(playRadio(RADIO));
    expect(store.getState().audio.status).toBe('error');
    expect(store.getState().audio.error).toBe('unsupported-platform');
  });
});

describe('failures', () => {
  /**
   * The regression this fake's awkward shape exists for.
   *
   * The store calls `AudioBackend.pause()` when it gives up on a track. A backend
   * once emitted a status tick from inside `pause()`, so the store re-entered its own
   * handler mid-decision and called `pause()` again. On a device that was
   * `RangeError: Maximum call stack size exceeded`. expo-audio does not re-enter, so
   * the suite over the real SDK could not see it.
   *
   * Two things stop it now and this asserts both: the store sets state BEFORE
   * issuing a command, and the sticky-error guard turns the re-entrant tick around.
   */
  it('survives a backend that reports back from inside pause()', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    backend.reentrant = true;
    await store.dispatch(playEpisode(EPISODE));

    expect(() => backend.tick({ error: 'Source unavailable' })).not.toThrow();

    // Once, not once per stack frame.
    expect(backend.calls.filter((c) => c === 'pause')).toHaveLength(1);
    expect(store.getState().audio.status).toBe('error');
    warn.mockRestore();
  });

  it('surfaces a playback error as its own code, and stops', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await store.dispatch(playEpisode(EPISODE));
    backend.tick({ error: 'Source unavailable' });

    expect(backend.calls).toContain('pause');
    expect(store.getState().audio.status).toBe('error');
    // Its own code, and the only one of the three that says playback had begun.
    expect(store.getState().audio.error).toBe('interrupted');
    warn.mockRestore();
  });

  it('keeps the error visible when the next tick looks merely unloaded', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await store.dispatch(playRadio(RADIO));
    backend.tick({ error: 'Source error' });
    expect(store.getState().audio.status).toBe('error');

    // What a player really sends after a failed source: no error field any more,
    // still not loaded. Seen on a device — the mini bar fell back to "Lädt …" and
    // sat there, which is the endless spinner the watchdog exists to prevent.
    backend.tick({ error: null, loaded: false, playing: false });

    expect(store.getState().audio.status).toBe('error');
    warn.mockRestore();
  });

  it('gives up on a stream that never loads', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      await store.dispatch(playRadio(RADIO));
      expect(store.getState().audio.status).toBe('loading');
      vi.advanceTimersByTime(12000);
      expect(store.getState().audio.status).toBe('error');
      // The same code a rejected `load()` sets: to a listener, neither started.
      // What tells the two apart is the warning, not the state.
      expect(store.getState().audio.error).toBe('start-failed');
      expect(warn).toHaveBeenCalledWith(
        '[audio] stream did not load within',
        expect.any(Number),
        'ms',
      );
    } finally {
      vi.useRealTimers();
      warn.mockRestore();
    }
  });

  it('does not fire the watchdog once the source is loaded', async () => {
    vi.useFakeTimers();
    try {
      await store.dispatch(playRadio(RADIO));
      backend.tick({ playing: true, loaded: true, live: true });
      vi.advanceTimersByTime(12000);
      expect(store.getState().audio.status).toBe('playing');
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * The same behaviour where it is not visible in the state: the watchdog asks
   * whether the SOURCE is there, not whether it is already producing sound. A
   * loaded stream that is still buffering reads as 'loading' — and must not be
   * declared unreachable twelve seconds later, which is what a watchdog watching
   * the status alone would do.
   */
  it('stands down once the source has loaded, even while it is still buffering', async () => {
    vi.useFakeTimers();
    try {
      await store.dispatch(playRadio(RADIO));
      backend.tick({ loaded: true, buffering: true, playing: false });
      expect(store.getState().audio.status).toBe('loading');

      vi.advanceTimersByTime(12000);

      expect(store.getState().audio.status).toBe('loading');
      expect(store.getState().audio.error).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('stopping and coordinating', () => {
  it('releases the source and the state', async () => {
    await store.dispatch(playRadio(RADIO));
    store.dispatch(stop());

    expect(backend.calls).toContain('release');
    expect(store.getState().audio).toMatchObject({ track: null, status: 'idle', speed: 1 });
  });

  it('ignores ticks that arrive after stopping', async () => {
    await store.dispatch(playEpisode(EPISODE));
    store.dispatch(stop());

    backend.tick({ playing: true, positionSec: 42 });

    expect(store.getState().audio).toMatchObject({ track: null, positionSec: 0 });
  });

  it('keeps the speed in state so the player can show it', async () => {
    await store.dispatch(playEpisode(EPISODE));
    store.dispatch(setSpeed(1.5));

    expect(backend.calls).toContain('rate:1.5');
    expect(store.getState().audio.speed).toBe(1.5);
  });

  it('does not seek a live stream', async () => {
    await store.dispatch(playRadio(RADIO));
    await store.dispatch(seekTo(30));
    expect(backend.calls.some((c) => c.startsWith('seek:'))).toBe(false);
  });
});
