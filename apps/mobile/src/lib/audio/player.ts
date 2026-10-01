import type { RadioCopy } from '@correctiv/app-core/stores/audio';
import type { AudioTrack } from '@correctiv/app-core/types/models';

import { coreActions } from '@/lib/store/core';

/**
 * The app's audio actions.
 *
 * All of the logic — the state machine, the watchdog, the failure codes — is in
 * `@correctiv/app-core/stores/audio`. expo-audio sits behind `AudioBackend` in
 * `./backend.ts`.
 *
 * This file is the seam that keeps the call sites plain: `playRadio()` reads
 * better in a component than `coreActions.audio.playRadio()`, and the actions'
 * identities are stable, so calling them outside React costs no render.
 */

export type { AudioState, PlayerStatus } from '@correctiv/app-core/stores/audio';

/**
 * The Salon5 live stream (Icecast), named by the caller.
 *
 * The station's words are the host's — `salon5RadioCopy(intl)` in `./tracks.ts`
 * formats them — because the core carries the stream's URL and not its strapline.
 */
export const playRadio = (copy: RadioCopy): Promise<void> => coreActions.audio.playRadio(copy);

/** A podcast episode or bonus audio, in full. */
export const playEpisode = (track: Omit<AudioTrack, 'kind'>): Promise<void> =>
  coreActions.audio.playEpisode(track);

export const togglePlay = (): void => coreActions.audio.togglePlay();
export const seekTo = (seconds: number): Promise<void> => coreActions.audio.seekTo(seconds);
export const setSpeed = (rate: number): void => coreActions.audio.setSpeed(rate);
export const stop = (): void => coreActions.audio.stop();
