import type { AudioStatus } from 'expo-audio';

import {
  registerExclusiveMedium,
  resetExclusiveMedia,
} from '@correctiv/app-core/media/exclusive-playback';

/**
 * The audio policy, not expo-audio's plumbing.
 *
 * Two things here are product rules that no typecheck can protect: only one medium
 * plays at a time, and a stream that never loads has to say so instead of spinning.
 *
 * The state machine under test lives in `@correctiv/app-core/stores/audio`, where
 * any host shares it. Only the translation from expo-audio's status ticks is local
 * (`lib/audio/backend.ts`), which is why the mock below is an expo player.
 */

/**
 * Records what the real AudioPlayer would have been told, and lets tests emit
 * status updates. The `mock` prefix is required: jest hoists `jest.mock` above the
 * imports, and its babel plugin only lets a factory reach out-of-scope variables
 * whose name starts with it.
 */
const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  /*
   * Android's native `replace` takes a non-null `AudioSource`, so `replace(null)` is
   * rejected with a synchronous throw, and inside a press handler that throw closes
   * the release build. The mock refuses it the same way; iOS and the web accept it,
   * which is how it shipped.
   */
  replace: jest.fn((source: unknown) => {
    if (source === null) {
      throw new Error(
        "Call to function 'AudioPlayer.replace' has been rejected. " +
          'The 2nd argument cannot be cast to type class expo.modules.audio.AudioSource (received null)',
      );
    }
  }),
  release: jest.fn(),
  seekTo: jest.fn(() => Promise.resolve()),
  setPlaybackRate: jest.fn(),
  setActiveForLockScreen: jest.fn(),
  clearLockScreenControls: jest.fn(),
  remove: jest.fn(),
  addListener: jest.fn((_event: string, listener: (status: AudioStatus) => void) => {
    emit = listener;
    return { remove: jest.fn() };
  }),
};
let emit: ((status: AudioStatus) => void) | null = null;

jest.mock('expo-audio', () => ({
  /*
   * A new object per player, sharing `mockPlayer`'s functions, so the assertions on
   * `mockPlayer` see every player and a stopped player is still a different object
   * from the one that replaced it, which is what the backend tells them apart by.
   */
  createAudioPlayer: jest.fn(() => ({ ...mockPlayer })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));

import { createAudioPlayer } from 'expo-audio';

import { configurePlatform, createMemoryPlatform } from '@correctiv/app-core';
import { isLive, resetAudioController } from '@correctiv/app-core/stores/audio';
import { resetStore } from '@correctiv/app-core/stores/store';

import { expoAudio, resetExpoAudio } from '@/lib/audio/backend';
import { coreStore } from '@/lib/store/core';
import { playEpisode, playRadio, setSpeed, stop } from '@/lib/audio/player';

/** A status update with only the fields under test spelled out. */
function status(partial: Partial<AudioStatus>): AudioStatus {
  return {
    id: 'p1',
    currentTime: 0,
    playbackState: '',
    timeControlStatus: '',
    reasonForWaitingToPlay: '',
    mute: false,
    duration: 0,
    playing: false,
    loop: false,
    didJustFinish: false,
    isBuffering: false,
    isLoaded: true,
    playbackRate: 1,
    shouldCorrectPitch: true,
    isLive: false,
    currentOffsetFromLive: null,
    error: null,
    ...partial,
  } as AudioStatus;
}

/**
 * The station's words, which `LiveBanner` formats out of `SALON5_RADIO_COPY` and
 * the core no longer holds. English here because nothing in this file goes through
 * a provider: what it proves is that what a caller passes reaches the lock screen.
 */
const RADIO = { title: 'Salon5 Radio', subtitle: '● LIVE · 24/7 from Bottrop' };

const EPISODE = {
  title: 'Bonusfolge',
  subtitle: 'Backstage · Club',
  url: 'https://salon5.correctiv.net/x.mp3',
  episodeId: 'bonus-1',
};

beforeEach(() => {
  jest.clearAllMocks();
  resetExclusiveMedia();
  emit = null;
  resetExpoAudio();
  resetAudioController();
  coreStore.dispatch(resetStore());
  // The store asks the platform for its audio backend on first use, so the
  // registration has to be in place before any action runs.
  configurePlatform({ ...createMemoryPlatform(), audio: expoAudio });
});

afterEach(() => {
  // Clears the loading watchdog too — a pending 12-second timer keeps the jest
  // worker alive past the run.
  resetAudioController();
  coreStore.dispatch(resetStore());
  jest.useRealTimers();
});

describe('starting playback', () => {
  it('loads the Icecast stream and marks it live', async () => {
    await playRadio(RADIO);

    expect(mockPlayer.replace).toHaveBeenCalledWith({
      uri: 'https://icecast.correctiv.net/salon5low',
    });
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(isLive(coreStore.getState().audio)).toBe(true);
    expect(coreStore.getState().audio.status).toBe('loading');
  });

  it('claims the lock screen with the track metadata', async () => {
    await playRadio(RADIO);

    // Without this the OS shows no controls at all — and it only works because
    // ensureAudioMode sets interruptionMode 'doNotMix'.
    expect(mockPlayer.setActiveForLockScreen).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ title: RADIO.title, artist: RADIO.subtitle }),
    );
  });

  it('follows the player status through to playing', async () => {
    await playRadio(RADIO);
    emit?.(status({ playing: true, currentTime: 3, isLive: true, duration: 0 }));

    expect(coreStore.getState().audio).toMatchObject({ status: 'playing', positionSec: 3 });
  });

  it('reports buffering as loading, not as paused', async () => {
    await playEpisode(EPISODE);
    emit?.(status({ playing: false, isBuffering: true, isLoaded: true }));

    expect(coreStore.getState().audio.status).toBe('loading');
  });

  it('resolves the bundled sample episode instead of treating it as a URL', async () => {
    // The core's sample data carries an app-relative path, not a URL.
    await playEpisode({ ...EPISODE, url: 'assets/audio/sample-episode.mp3' });

    const source = mockPlayer.replace.mock.calls.at(-1)?.[0];
    expect(typeof source).toBe('number'); // a Metro asset id, not { uri }
    expect(coreStore.getState().audio.status).toBe('loading');
  });
});

describe('failures', () => {
  it('surfaces a playback error as its own code, and stops', async () => {
    await playEpisode(EPISODE);
    emit?.(status({ error: 'Source unavailable' }));

    expect(mockPlayer.pause).toHaveBeenCalled();
    expect(coreStore.getState().audio.status).toBe('error');
    expect(coreStore.getState().audio.error).toBe('interrupted');
  });

  it('keeps the error visible when the next status tick looks merely unloaded', async () => {
    await playRadio(RADIO);
    emit?.(status({ error: 'Source error' }));
    expect(coreStore.getState().audio.status).toBe('error');

    // What the player really sends after a failed source: no error field any more,
    // still not loaded. Seen on a device — the mini bar fell back to "Lädt …" and
    // sat there, which is the endless spinner the watchdog exists to prevent.
    emit?.(status({ error: null, isLoaded: false, playing: false }));

    expect(coreStore.getState().audio.status).toBe('error');
    expect(coreStore.getState().audio.error).toBe('interrupted');
  });

  it('clears the error when a new track starts', async () => {
    await playRadio(RADIO);
    emit?.(status({ error: 'Source error' }));
    expect(coreStore.getState().audio.status).toBe('error');

    await playEpisode(EPISODE);

    expect(coreStore.getState().audio).toMatchObject({ status: 'loading', error: null });
  });

  it('gives up on a stream that never loads', async () => {
    // The watchdog says so in the log, which is where the distinction between
    // "never answered" and "said no" survives; silenced so it is not mistaken for
    // a failure in the run, and ASSERTED below rather than only silenced — a spy
    // that swallows the one surviving half of the distinction and checks nothing
    // is how the distinction stops surviving.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.useFakeTimers();
    await playRadio(RADIO);
    expect(coreStore.getState().audio.status).toBe('loading');

    jest.advanceTimersByTime(12000);

    // expo-audio does report errors, but the lesson from an earlier backend was
    // that network errors sometimes never arrive at all.
    expect(coreStore.getState().audio.status).toBe('error');
    // The same code a rejected load() sets — see the core's own suite for why
    // "never answered" and "said no" stopped being two sentences. What tells the
    // two apart is this warning, so it is the assertion rather than the noise.
    expect(coreStore.getState().audio.error).toBe('start-failed');
    expect(warn).toHaveBeenCalledWith(
      '[audio] stream did not load within',
      expect.any(Number),
      'ms',
    );
    warn.mockRestore();
  });

  it('does not fire the watchdog once the source is loaded', async () => {
    jest.useFakeTimers();
    await playRadio(RADIO);
    emit?.(status({ playing: true, isLoaded: true, isLive: true }));

    jest.advanceTimersByTime(12000);

    expect(coreStore.getState().audio.status).toBe('playing');
  });
});

describe('stopping and coordinating', () => {
  it('releases the player, the lock screen and the state', async () => {
    await playRadio(RADIO);
    jest.clearAllMocks();
    // This threw on Android: "Wiedergabe beenden" on the mini player closed the app.
    expect(() => stop()).not.toThrow();

    // A paused live stream keeps buffering, so the player is released rather than
    // paused: taken out of expo-audio's registry first, then freed. The order is
    // read off the calls `stop()` made and nothing before it, because `beforeEach`
    // removes the previous test's player too. After `release()` a native call on
    // the object throws, so `remove()` after it would be the same crash again.
    expect(mockPlayer.replace).not.toHaveBeenCalledWith(null);
    expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
    expect(mockPlayer.release).toHaveBeenCalledTimes(1);
    expect(mockPlayer.remove.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mockPlayer.release.mock.invocationCallOrder.at(-1)!,
    );
    expect(mockPlayer.clearLockScreenControls).toHaveBeenCalled();
    expect(coreStore.getState().audio).toMatchObject({ track: null, status: 'idle', speed: 1 });
  });

  it('builds a fresh player for the next track after a stop', async () => {
    await playRadio(RADIO);
    stop();
    const created = (createAudioPlayer as jest.Mock).mock.calls.length;

    await playEpisode(EPISODE);
    expect((createAudioPlayer as jest.Mock).mock.calls.length).toBe(created + 1);
    expect(mockPlayer.play).toHaveBeenCalled();
  });

  it('ignores status updates that arrive after stopping', async () => {
    await playEpisode(EPISODE);
    stop();

    emit?.(status({ playing: true, currentTime: 42 }));

    expect(coreStore.getState().audio).toMatchObject({ track: null, positionSec: 0 });
  });

  /*
   * Android tears a released player down on a later main-thread turn
   * (`BaseAudioPlayer.sharedObjectDidRelease` launches `releasePlayer()`), so its
   * last status can arrive after the next track has started. It must not reach
   * that track: a stale "finished" or "not loaded" would stop or stall it.
   */
  it('drops a status from a released player once the next track has started', async () => {
    await playRadio(RADIO);
    const released = emit;
    stop();
    await playEpisode(EPISODE);
    emit?.(status({ playing: true, isLoaded: true, currentTime: 5, duration: 600 }));
    expect(coreStore.getState().audio).toMatchObject({ status: 'playing', positionSec: 5 });

    released?.(status({ playing: false, isLoaded: false, didJustFinish: true, currentTime: 99 }));

    expect(coreStore.getState().audio).toMatchObject({ status: 'playing', positionSec: 5 });
    expect(coreStore.getState().audio.track?.url).toBe(EPISODE.url);
  });

  it('stops the video when audio starts', async () => {
    const stopVideo = jest.fn();
    registerExclusiveMedium('video', stopVideo);

    await playRadio(RADIO);

    expect(stopVideo).toHaveBeenCalledTimes(1);
  });

  it('does not stop itself', async () => {
    const stopAudio = jest.fn();
    registerExclusiveMedium('audio', stopAudio);

    await playRadio(RADIO);

    expect(stopAudio).not.toHaveBeenCalled();
  });

  it('keeps the speed in state so the player can show it', async () => {
    await playEpisode(EPISODE);
    setSpeed(1.5);

    expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(1.5);
    expect(coreStore.getState().audio.speed).toBe(1.5);
  });
});
