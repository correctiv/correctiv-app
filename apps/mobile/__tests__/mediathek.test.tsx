import { act } from 'react-test-renderer';

import { bonusMedia } from '@correctiv/app-core/data/backstage';
import { PODCAST_CHANNELS } from '@correctiv/app-core/data/feeds.config';
import type { PodcastSeries } from '@correctiv/app-core/data/podcasts';

/**
 * The Mediathek's audio, and who hears it.
 *
 * Club bonus audio plays in full. It branched on membership twice over: a
 * 60-second preview until 2026-08-06, then a note saying it was open to all until
 * ADR 0018. Both are gone, and what is left to pin is that the tap reaches the
 * whole episode and that nothing on the row suggests otherwise. Neither shows up
 * in a typecheck.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('@/lib/audio/player', () => ({
  playEpisode: jest.fn(() => Promise.resolve()),
  playRadio: jest.fn(() => Promise.resolve()),
  togglePlay: jest.fn(),
  stop: jest.fn(),
}));
jest.mock('@/lib/audio/useAudio', () => ({
  useAudio: () => ({
    track: null,
    status: 'idle',
    positionSec: 0,
    durationSec: 0,
    speed: 1,
    error: null,
  }),
  useEpisodeStatus: () => 'off',
  useRadioState: () => 'off',
}));

import { router } from 'expo-router';

import { press, render, renderedText } from './support/rendering';

import MediathekScreen from '@/app/(tabs)/mediathek';
import { playEpisode } from '@/lib/audio/player';
import { loaded } from '@correctiv/app-core/stores/podcasts';
import {
  loaded as radioLoaded,
  statusChanged as radioStatusChanged,
} from '@correctiv/app-core/stores/radio';
import { patch as mediaPatch } from '@correctiv/app-core/stores/media';
import { resetStore } from '@correctiv/app-core/stores/store';

import { coreStore } from '@/lib/store/core';

const push = router.push as jest.Mock;
const playEpisodeMock = playEpisode as jest.Mock;

const BONUS = bonusMedia[0];

/** How many times the screen marks something as club content. */
const clubMarks = (tree: Parameters<typeof renderedText>[0]): number =>
  renderedText(tree).match(/\bClub\b/g)?.length ?? 0;

/**
 * What Icecast reports for the mount the app plays. Seeded like the other slices
 * so the banner's lazy loader does not reach the network, and asserted below,
 * because the live line is the one part of this screen that is new.
 */
const STATION = {
  online: true,
  listeners: 5,
  listenerPeak: 86,
  bitrateKbps: 64,
  nowPlaying: 'Salon5 Mitschnitt 2024 04 05, 17 Uhr 02',
  stationName: 'Salon5 low',
};

const SERIES: PodcastSeries = {
  id: PODCAST_CHANNELS[0],
  title: 'Pausenbrot',
  publisher: 'Salon5',
  description: 'Der Nachrichten-Snack.',
  imageUrl: null,
  episodes: [
    {
      id: 'ep-1',
      title: 'Erste Folge',
      date: '2026-06-11T06:00:00.000Z',
      durationLabel: '9 Min.',
      audio: 'https://salon5.correctiv.net/pausenbrot/1.mp3',
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  act(() => {
    coreStore.dispatch(resetStore());
    // Everything starts 'ready', or the screen's lazy loaders fire real network
    // requests on mount — slow, and a source of stray console noise from the
    // slice's error path.
    for (const key of ['gespraech', 'funfacts', 'hauptkanal'] as const) {
      coreStore.dispatch(mediaPatch(key, { videos: [], status: 'ready' }));
    }
    coreStore.dispatch(loaded({ series: [SERIES], status: 'ready' }));
    coreStore.dispatch(radioLoaded(STATION));
  });
});

describe('Mediathek', () => {
  it('offers radio, podcasts and the club bonus', () => {
    const text = renderedText(render(<MediathekScreen />));
    expect(text).toContain('Salon5 Radio');
    expect(text).toContain('Pausenbrot');
    expect(text).toContain(BONUS.title);
  });

  it('opens a series page rather than playing the whole show', () => {
    press(render(<MediathekScreen />), 'Pausenbrot');
    expect(push).toHaveBeenCalledWith({
      pathname: '/serie/[id]',
      params: { id: PODCAST_CHANNELS[0] },
    });
  });

  it('says so when a video channel cannot be reached', () => {
    act(() => {
      coreStore.dispatch(mediaPatch('gespraech', { videos: [], status: 'error' }));
    });
    expect(renderedText(render(<MediathekScreen />))).toContain('Videos derzeit nicht erreichbar');
  });
});

/**
 * Club bonus content plays in full for everyone — the 60-second preview was dropped
 * on 2026-08-06. The `CLUB` badge is a label now; it withholds nothing.
 *
 * There used to be two cases here, a guest and a member, asserting they get the same
 * call and differ only in a "Für alle hörbar" note. Since the door (ADR 0016) there is
 * no guest, and the note addressed one, so both the note and the second case went with
 * ADR 0018. What is worth pinning is what is left: the episode plays in full, and
 * nothing on the row hints at a distinction that no longer exists.
 */
describe('the club bonus', () => {
  it('plays the full episode, with no note about who may hear it', () => {
    const tree = render(<MediathekScreen />);
    expect(renderedText(tree)).not.toContain('Für alle hörbar');

    press(tree, `${BONUS.title} abspielen`);

    expect(playEpisodeMock).toHaveBeenCalledTimes(1);
    expect(playEpisodeMock.mock.calls[0][0]).toMatchObject({
      episodeId: BONUS.id,
      url: BONUS.source,
    });
  });

  it('marks the club exactly once', () => {
    // The badge is a label, not a lock.
    //
    // Counted, not merely present: the section used to carry a coral "Club" overline
    // above rows that already had the yellow badge, so the mark appeared twice and in
    // the colour that means journalism rather than club. And this assertion used to
    // read 'CLUB', which only ever matched that overline — `Badge` uppercases through
    // a style, so the tree carries "Club". It would have stayed green with the badge
    // itself deleted.
    //
    // It used to count again after a join, to show the badge stays for a member. No
    // render path reads the membership any more (ADR 0018), so the second count was
    // the same render twice.
    expect(clubMarks(render(<MediathekScreen />))).toBe(1);
  });
});

/**
 * The banner used to print a fixed "24/7 aus Bottrop" whatever was on air. It
 * now says what Icecast reports, and falls back to that copy only when the
 * status could not be read — which on the web target is every time, because
 * icecast.correctiv.net sends no CORS header.
 */
describe('the live banner', () => {
  it('prints the title on air and the listener count', () => {
    const tree = render(<MediathekScreen />);
    const text = renderedText(tree);

    expect(text).toContain('Salon5 Mitschnitt 2024 04 05, 17 Uhr 02');
    expect(text).toContain('5 Hörer:innen');
    expect(text).not.toContain('24/7 aus Bottrop');
  });

  it('keeps its own subtitle when the station status is unknown', () => {
    act(() => {
      coreStore.dispatch(resetStore());
      coreStore.dispatch(loaded({ series: [SERIES], status: 'ready' }));
      for (const key of ['gespraech', 'funfacts', 'hauptkanal'] as const) {
        coreStore.dispatch(mediaPatch(key, { videos: [], status: 'ready' }));
      }
      coreStore.dispatch(radioStatusChanged('unknown'));
    });

    const text = renderedText(render(<MediathekScreen />));
    expect(text).toContain('24/7 aus Bottrop');
    expect(text).not.toContain('Hörer:innen');
  });
});
