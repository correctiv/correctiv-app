import { opened, resolved } from '@correctiv/app-core/stores/video';
import type { Video } from '@correctiv/app-core/types/models';
import { resetStore } from '@correctiv/app-core/stores/store';

import { coreStore } from '@/lib/store/core';
import { render } from './support/rendering';

/**
 * Does the system's own media UI learn anything about a video?
 *
 * The podcast player has told it since day one — `lib/audio/backend.ts` calls
 * `setActiveForLockScreen` with a title, an artist and artwork, so a track appears on
 * the lock screen and in Control Center. A video told it NOTHING, and for two reasons
 * that are invisible from inside the app:
 *
 *   - `showNowPlayingNotification` is documented `@default false`, so the entry was
 *     never created at all;
 *   - the source was a bare url string, and `metadata` is what populates that entry —
 *     "when undefined the player will display information contained in the video
 *     metadata", which for a PeerTube HLS playlist is nothing worth showing.
 *
 * Neither is checkable by looking at the screen: the difference is on the lock screen
 * of a real phone. So this intercepts `useVideoPlayer` and asserts on what the screen
 * actually hands the player.
 *
 * WHAT THIS DOES NOT PROVE, said rather than implied: that the entry appears. That is
 * the OS's half, it needs a device, and on Android it additionally needs the config
 * plugin's `supportsBackgroundPlayback` — which `app-config.test.ts` gates, because
 * that half only fails on one platform long after every check is green.
 */

/** What the screen handed `useVideoPlayer`, captured per render. */
const calls: { source: unknown; player: Record<string, unknown> }[] = [];

jest.mock('expo-video', () => ({
  useVideoPlayer: (source: unknown, setup?: (player: Record<string, unknown>) => void) => {
    // Enough of a player for the setup callback to write to, and no more: the real one
    // is a native shared object, and this test is about what the screen asks of it.
    const player: Record<string, unknown> = { play: jest.fn() };
    setup?.(player);
    calls.push({ source, player });
    return player;
  },
  VideoView: () => null,
}));

// The YouTube path, which this screen also imports: `react-native-webview` reaches for
// a TurboModule that is not in a test binary, and none of this is about that stage.
jest.mock('@/components/media/VideoFrame', () => ({ VideoFrame: () => null }));

// The `@/components/ui` barrel reaches expo-router through ScreenHeader, the way every
// other screen test here has to answer for.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  // `Stack.Screen` because `ScreenHeader` configures the platform's header through
  // it on native, and a screen with a header therefore reaches expo-router for more
  // than `router` now (ADR 0030).
  Stack: { Screen: () => null },
}));

const VIDEO: Video = {
  id: 'v1',
  title: 'Wie Friedrich Merz für die AfD abgeliefert hat',
  url: 'https://tube.funfacts.de/w/v1',
  thumbnailUrl: 'https://tube.funfacts.de/thumb/v1.jpg',
  publishedAt: '2026-07-23T10:00:00.000Z',
  source: 'peertube',
  hlsMasterUrl: 'https://tube.funfacts.de/hls/v1/master.m3u8',
  durationSec: 850,
};

describe('the video screen and the system media controls', () => {
  beforeEach(() => {
    calls.length = 0;
    coreStore.dispatch(resetStore());
  });

  const mount = (): void => {
    coreStore.dispatch(opened(VIDEO));
    coreStore.dispatch(resolved(VIDEO.hlsMasterUrl as string));
    // Required after the dispatches: the screen reads the store on its first render.
    const VideoScreen = require('@/app/video').default as () => React.ReactElement;
    render(<VideoScreen />);
  };

  it('hands the player the title, the channel and the artwork', () => {
    mount();
    const source = calls.at(-1)?.source as
      | { uri?: string; metadata?: Record<string, unknown> }
      | null
      | undefined;

    expect(source?.uri).toBe(VIDEO.hlsMasterUrl);
    // AN OBJECT, not the bare url it used to be — that is the whole change, and a
    // string here would carry no metadata for the OS to display.
    expect(source?.metadata).toStrictEqual({
      title: VIDEO.title,
      artist: 'FunFacts',
      artwork: VIDEO.thumbnailUrl,
    });
  });

  it('switches the now playing notification on, because it is off by default', () => {
    mount();
    expect(calls.at(-1)?.player.showNowPlayingNotification).toBe(true);
  });
});
