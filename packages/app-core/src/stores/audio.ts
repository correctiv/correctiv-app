import {
  createAction,
  createListenerMiddleware,
  createSlice,
  isAnyOf,
  type PayloadAction,
} from '@reduxjs/toolkit';

import { RADIO_STREAM_URL } from '../data/feeds.config';
import { coreMessage, type CoreMessage } from '../i18n/messages';
import { stopOtherMedia } from '../media/exclusive-playback';
import { platform, type AudioBackend, type PlaybackStatus } from '../ports';
import type { AudioTrack } from '../types/models';
import type { AppDispatch, AppThunk, RootState } from './store';

/**
 * The player's state machine.
 *
 * Everything platform-specific sits behind `AudioBackend` (`ports/index.ts`),
 * which each host implements over its own SDK.
 *
 * The slice below is the state; the listener middleware after it is the
 * imperative half — the backend's status listener, the loading watchdog and the
 * one command that has to follow a state change. A listener effect runs AFTER
 * the reducer, which is what turns "state first, command second" from a rule
 * somebody has to remember into a property of where the code sits.
 *
 * There is no length limit on club content: bonus episodes play in full for
 * everyone. Both apps used to stop a non-member at 60 seconds and offer the club —
 * dropped on 2026-08-06, which also puts audio in line with "closeness, not a
 * paywall". The `CLUB` badge stays as a label; it no longer withholds anything.
 *
 * An error state is sticky until the next start. Without that, the following
 * status tick — no error, not loaded yet — maps straight back to "loading", which
 * is exactly the endless spinner the watchdog exists to prevent.
 */

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/**
 * Both SDKs report playback errors — and on both, a network failure sometimes
 * never arrives at all. An endless spinner is the worst available answer, so a
 * timer decides when to stop believing in the stream.
 */
const LOADING_TIMEOUT_MS = 12000;

/**
 * What went wrong, as a value rather than as a sentence.
 *
 * The state used to carry the finished German — `Wiedergabe unterbrochen. Prüfen
 * Sie Ihre Internetverbindung…` — which made the store the last place a
 * translation could reach and the first place a host had to agree with. A code is
 * the smallest thing that is TRUE here: the player knows what failed, not what to
 * say about it, and a screen, a log and a crash report each want a different
 * rendering of the same fact.
 *
 * Three codes out of four dispatch sites, because two of them were never
 * distinguishable to anybody listening. The watchdog fires when the source has not
 * loaded in `LOADING_TIMEOUT_MS`, `load()` rejecting fires when it said no sooner;
 * both mean "this never started, your connection is the thing to check", and they
 * said so in two different sentences. The distinction that is real is a
 * DIAGNOSTIC one, and it lives in the two `console.warn`s below, where it is
 * useful to a developer rather than confusing to a listener.
 *
 * `interrupted` stays its own code because the user heard sound and then did not,
 * which no "could not start" sentence can say.
 */
export type AudioError = 'unsupported-platform' | 'start-failed' | 'interrupted';

/**
 * A sentence per code, in the core because the taxonomy is the core's.
 *
 * Next to the union rather than in a host: a fourth code added below fails to
 * compile until somebody writes what it says, and the mini bar and the full
 * player cannot disagree about the wording because neither of them owns it.
 *
 * Each message is one whole sentence, including the hint two of them share. The
 * hint used to be a constant interpolated in — cheaper in the source and
 * untranslatable, because a fragment has no word order of its own. The repetition
 * moves into the catalogue, which is where repetition is data.
 */
export const AUDIO_ERROR_LABELS: Record<AudioError, CoreMessage> = {
  'unsupported-platform': coreMessage({
    id: 'core.audio.unsupportedPlatform',
    defaultMessage: 'Playback is not available on this platform.',
  }),
  'start-failed': coreMessage({
    id: 'core.audio.startFailed',
    defaultMessage: 'Playback could not be started. Check your connection and try again.',
  }),
  interrupted: coreMessage({
    id: 'core.audio.interrupted',
    defaultMessage: 'Playback was interrupted. Check your connection and try again.',
  }),
};

export interface AudioState {
  track: AudioTrack | null;
  status: PlayerStatus;
  positionSec: number;
  /** 0 for live streams — Icecast has no length. */
  durationSec: number;
  /** Playback rate; in state because the full player shows it. */
  speed: number;
  /** Why playback stopped; `AUDIO_ERROR_LABELS` is what a host renders it with. */
  error: AudioError | null;
}

const IDLE: AudioState = {
  track: null,
  status: 'idle',
  positionSec: 0,
  durationSec: 0,
  speed: 1,
  error: null,
};

/** Pure selectors — live playback has neither a length nor a position. */
export function isLive(state: Pick<AudioState, 'track'>): boolean {
  return state.track?.kind === 'radio';
}
export function isActive(state: Pick<AudioState, 'track'>): boolean {
  return state.track !== null;
}

const slice = createSlice({
  name: 'audio',
  initialState: IDLE,
  reducers: {
    started(state, action: PayloadAction<AudioTrack>) {
      Object.assign(state, IDLE, { track: action.payload, status: 'loading' });
    },
    failed(state, action: PayloadAction<AudioError>) {
      state.status = 'error';
      state.error = action.payload;
    },
    tick(
      state,
      action: PayloadAction<{ status: PlayerStatus; positionSec: number; durationSec: number }>,
    ) {
      state.status = action.payload.status;
      state.positionSec = action.payload.positionSec;
      state.durationSec = action.payload.durationSec;
    },
    finished(state) {
      state.status = 'paused';
      state.positionSec = 0;
    },
    paused(state) {
      state.status = 'paused';
    },
    positionSet(state, action: PayloadAction<number>) {
      state.positionSec = action.payload;
    },
    speedSet(state, action: PayloadAction<number>) {
      state.speed = action.payload;
    },
    stopped() {
      return IDLE;
    },
  },
});

export const audioReducer = slice.reducer;
export const { started, failed, tick, finished, paused, positionSet, speedSet, stopped } =
  slice.actions;

// --- the imperative half: one listener middleware -----------------------------

/**
 * The backend's raw tick, as an action.
 *
 * No reducer handles it: it reports what the player is DOING, and the listener
 * below decides what that means for the state. Routing it through `dispatch`
 * buys two things. The handler gets `getState` and `dispatch` from the listener
 * API instead of having them passed in by whoever happens to hold them. And
 * `loaded` — the one fact the watchdog is waiting for — lands on the action
 * stream, where the watchdog can see it without either of them reaching into the
 * other.
 */
const statusReported = createAction<PlaybackStatus>('audio/statusReported');

const audioListener = createListenerMiddleware();

/** Pre-typed, so an effect's `getState()` is `RootState` and not `unknown`. */
const startListening = audioListener.startListening.withTypes<RootState, AppDispatch>();

/**
 * Installed by `createAppStore()`, which is the only place a middleware can go.
 *
 * This is the whole imperative surface of the audio store. The store file needs
 * nothing from audio but this value — no types, no ports.
 */
export const audioMiddleware = audioListener.middleware;

/**
 * The pending watchdog timer, and the one piece of module state left here.
 *
 * It cannot move into the effect that arms it, because `resetAudioController()`
 * has to cancel it from module scope: a live 12-second timer keeps a jest worker
 * alive past the run, which is what the `afterEach` in
 * `apps/mobile/__tests__/audio-player.test.ts` is there for. A plain
 * `setTimeout` rather than `listenerApi.delay()` for the same reason, plus one
 * more — this fires synchronously, so a test that advances fake timers sees the
 * error state on the next line rather than one microtask later.
 */
let watchdog: ReturnType<typeof setTimeout> | null = null;

/** The backend the status listener is attached to, so it is attached exactly once. */
let listening: AudioBackend | null = null;

function clearWatchdog(): void {
  if (watchdog) {
    clearTimeout(watchdog);
    watchdog = null;
  }
}

/**
 * The loading watchdog, armed and stood down in one entry so the two halves
 * cannot drift apart. See `LOADING_TIMEOUT_MS` for why it exists at all.
 *
 * It stands down the moment the source reports itself LOADED — not when the
 * player reports playing, because a loaded source that is merely buffering has
 * already answered the question the timer is asking. A failure or a stop stands
 * it down too: nothing is waiting on the stream any more.
 *
 * Armed by the start itself, which is a small widening: it used to be armed after
 * `load()` resolved, so a `load()` that never settled left no watchdog at all.
 * The promise is now the one the user can see — the player is never in `loading`
 * for longer than this.
 */
startListening({
  matcher: isAnyOf(started, failed, stopped, statusReported),
  effect: (action, { dispatch, getState }) => {
    // A tick from a source that is still opening says nothing yet — keep waiting.
    if (statusReported.match(action) && !action.payload.loaded) return;

    clearWatchdog();
    if (!started.match(action)) return;

    watchdog = setTimeout(() => {
      watchdog = null;
      // Something may have answered after this timer was armed and before it ran.
      if (getState().audio.status !== 'loading') return;
      // The half of `start-failed` that carries no exception with it: nothing
      // rejected, the stream simply never answered. Said here rather than in the
      // state, because it is the developer's distinction and not the listener's.
      console.warn('[audio] stream did not load within', LOADING_TIMEOUT_MS, 'ms');
      dispatch(failed('start-failed'));
    }, LOADING_TIMEOUT_MS);
  },
});

/**
 * State first, command second — and now by construction rather than by care.
 *
 * The reducer has already run when this effect fires, so the store says `error`
 * before `pause()` goes out. That is what makes the error path safe against a
 * backend that emits a status tick from inside `pause()`: the tick comes back in
 * through `statusReported`, finds the error state, and the sticky-error guard
 * below turns it around. While these were two adjacent lines in one function,
 * their order was the only thing between this and `RangeError: Maximum call
 * stack size exceeded` on a device — see the note on `AudioBackend` in
 * `ports/index.ts`.
 */
startListening({
  actionCreator: failed,
  effect: () => {
    platform().audio?.pause();
  },
});

/**
 * The backend's status listener, attached on the first start and exactly once.
 *
 * Lazily, because the host may register its platform after this module is
 * imported. Exactly once, because `AudioBackend.onStatus` takes the ONE listener
 * the core installs — attaching again would leave it to the adapter whether the
 * second registration replaces the first or doubles every tick. A backend that
 * is not there yet leaves the memo empty, so a host that registers later still
 * gets attached on its next start.
 *
 * `dispatch` is the store's own, so the closure stays valid for the store's life.
 */
startListening({
  actionCreator: started,
  effect: (_action, { dispatch }) => {
    const audio = platform().audio;
    if (!audio || audio === listening) return;
    listening = audio;
    audio.onStatus((status) => dispatch(statusReported(status)));
  },
});

/** What a tick means: the one place the player's status becomes state. */
startListening({
  actionCreator: statusReported,
  effect: ({ payload: status }, { dispatch, getState }) => {
    const state = getState().audio;
    if (!state.track) return; // stopped — ignore trailing updates

    /**
     * An error stays until the next start clears it, and this guard comes FIRST.
     *
     * Two reasons, both learned the hard way. A tick that merely looks unloaded
     * would otherwise map back to "loading" — the endless spinner the watchdog
     * exists to prevent. And the listener above answers `failed` with
     * `AudioBackend.pause()`: a backend that reports back from inside that call
     * arrives here with the same error still attached, so anything after the
     * `status.error` branch is too late to stop the recursion. That was a real
     * crash on a device, and keeping this line first is what makes it
     * structurally impossible rather than merely unlikely.
     */
    if (state.status === 'error') return;

    if (status.error) {
      console.warn('[audio] playback error:', status.error);
      dispatch(failed('interrupted'));
      return;
    }

    if (status.finished) {
      dispatch(finished());
      return;
    }

    dispatch(
      tick({
        status: status.playing
          ? 'playing'
          : !status.loaded || status.buffering
            ? 'loading'
            : 'paused',
        positionSec: status.positionSec,
        durationSec: status.live ? 0 : status.durationSec,
      }),
    );
  },
});

const start =
  (track: AudioTrack): AppThunk<Promise<void>> =>
  async (dispatch) => {
    // Coordinate: only one medium plays at a time.
    stopOtherMedia('audio');
    // Attaches the status listener and arms the watchdog — see the entries above.
    dispatch(started(track));

    const audio = platform().audio;
    if (!audio) {
      dispatch(failed('unsupported-platform'));
      return;
    }

    try {
      await audio.load(track.url, {
        title: track.title,
        artist: track.subtitle ?? 'CORRECTIV',
        artworkUrl: track.artworkUrl,
      });
      audio.play();
    } catch (err) {
      console.warn('[audio] start failed:', err);
      dispatch(failed('start-failed'));
    }
  };

/**
 * How the live stream names itself, formatted by the host.
 *
 * Handed IN for the reason `ReaderCopy` gives in `articles/reader-html.ts`: the
 * station's name and its strapline are words a listener reads, on the mini bar and
 * on the lock screen, and this thunk held the finished German for both. Which
 * stream it is stays here — `RADIO_STREAM_URL` is a fact about CORRECTIV's Icecast
 * server and not a word — so a host passes the copy and nothing else.
 *
 * No descriptor beside it, unlike `AUDIO_ERROR_LABELS`, and that is deliberate:
 * the app already declares these two in `apps/mobile/src/lib/audio/tracks.ts`
 * under `player.*`, where the live banner prints the same words without starting
 * anything. A second pair of ids in the core would be one string with two
 * catalogue entries, which is the drift the lift exists to end.
 */
export interface RadioCopy {
  /** The station, as the players and the lock screen name it. */
  title: string;
  /** The line under it. Absent leaves the lock screen its 'CORRECTIV' fallback. */
  subtitle?: string;
}

export const playRadio = (copy: RadioCopy): AppThunk<Promise<void>> =>
  start({ ...copy, kind: 'radio', url: RADIO_STREAM_URL });

export const playEpisode = (track: Omit<AudioTrack, 'kind'>): AppThunk<Promise<void>> =>
  start({ ...track, kind: 'episode' });

export const togglePlay = (): AppThunk => (dispatch, getState) => {
  const state = getState().audio;
  const audio = platform().audio;
  if (!state.track || !audio) return;

  if (state.status === 'playing') {
    // State first, command second, for the reason the `failed` listener records.
    dispatch(paused());
    audio.pause();
    return;
  }
  audio.play();
};

export const seekTo =
  (seconds: number): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const state = getState().audio;
    const audio = platform().audio;
    if (!audio || !state.track || isLive(state)) return;
    await audio.seekTo(Math.max(0, seconds));
    dispatch(positionSet(seconds));
  };

export const setSpeed =
  (rate: number): AppThunk =>
  (dispatch) => {
    platform().audio?.setRate(rate);
    dispatch(speedSet(rate));
  };

export const stop = (): AppThunk => (dispatch) => {
  platform().audio?.release();
  dispatch(stopped()); // stands the watchdog down — see the entry above
};

/**
 * Test helper — cancels the watchdog and drops the listener registration.
 *
 * Both halves are still load-bearing, and both are about a test suite this
 * module cannot see:
 *
 * - a pending 12-second timer keeps a jest worker alive past the run, which is
 *   what `apps/mobile/__tests__/audio-player.test.ts` says in its `afterEach`;
 * - that suite resets its expo backend between cases, which drops the listener
 *   the core installed while keeping the backend's identity — so without
 *   clearing the memo above, no tick would ever arrive again.
 *
 * The state itself is reset by dispatching `stopped()`, which a test does against
 * whichever store it built.
 */
export function resetAudioController(): void {
  clearWatchdog();
  listening = null;
}
