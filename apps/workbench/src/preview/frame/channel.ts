import { CHANNEL_KEY } from '../home/names';

/**
 * Which channel the framed app is built for, as a way of looking at it.
 *
 * `null` is the build's own (`preview` on the web), `release` is what a store build
 * shows. Only `release` is ever written: `apps/mobile/src/lib/channel.ts` lowers its
 * channel with it and never raises it, so this key cannot grant a reader anything
 * (ADR 0072 §2). `null` removes the key instead of writing `preview`, for the reason
 * `frame/locale.ts` gives of the language: a key that agrees with the default is a
 * state nobody can see and nobody clears.
 */
export type FrameChannel = 'release';

export function isFrameChannel(value: string | null): value is FrameChannel {
  return value === 'release';
}

export function apply(channel: FrameChannel | null): void {
  try {
    if (channel === null) window.localStorage.removeItem(CHANNEL_KEY);
    else window.localStorage.setItem(CHANNEL_KEY, channel);
  } catch {
    // Site data switched off. Nothing can be previewed, and nothing may throw.
  }
}
