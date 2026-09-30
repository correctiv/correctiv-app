import type { FeedEnd } from '@correctiv/app-core/stores/feeds';
import type { FeedItem } from '@correctiv/app-core/types/models';

import { render, renderedText } from './support/rendering';

import { useFeed } from '@/lib/feeds/useFeed';

import ProjektScreen from '@/app/projekt/[id]';

/**
 * Rendered, not inspected: the store can hold an honest `end: 'unknown'` and the
 * screen still print the end-of-list sentence over it, and no core test sees that.
 */

// expo-router is the only thing this screen does to the outside world, and
// `ScreenHeader` configures the platform's header through it on native (ADR 0030).
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({ id: 'klima' })),
  Stack: { Screen: () => null },
}));

/**
 * The feed hook, driven per test. The cascade is the core's and is tested there;
 * what is under test is what the screen does with the answer, so no store runs.
 *
 * ONE export is replaced and the rest of the module is real, which is what
 * `discover.test.tsx` does for the same reason.
 */
jest.mock('@/lib/feeds/useFeed', () => ({ useFeed: jest.fn() }));

jest.mock('@/lib/openArticle', () => ({ openArticle: jest.fn() }));
jest.mock('@/lib/openExternal', () => ({ openExternal: jest.fn() }));

const feedMock = jest.mocked(useFeed);

function item(id: string): FeedItem {
  return {
    id,
    feed: 'klima',
    title: `Beitrag ${id}`,
    url: `https://correctiv.org/${id}/`,
    teaser: '…',
    publishedAt: '2026-06-12T10:00:00.000Z',
    categories: [],
    imageUrl: null,
  };
}

function feed(end: FeedEnd) {
  feedMock.mockReturnValue({
    data: [item('a'), item('b')],
    loading: false,
    error: null,
    offline: false,
    reload: jest.fn(),
    end,
    loadingMore: false,
    loadMore: jest.fn(),
  });
  return renderedText(render(<ProjektScreen />));
}

describe('the foot of a project feed', () => {
  it('says nothing when nobody has asked whether more exists', () => {
    const text = feed('unknown');
    expect(text).toContain('Beitrag a');
    expect(text).not.toContain('Das ist alles');
    expect(text).not.toContain('Mehr laden');
  });

  it('says the list is complete once the store has said it is', () => {
    const text = feed('end');
    expect(text).toContain('Das ist alles, was bisher erschienen ist.');
    expect(text).not.toContain('Mehr laden');
  });

  it('offers the button when there is another page, and not the sentence', () => {
    const text = feed('more');
    expect(text).toContain('Mehr laden');
    expect(text).not.toContain('Das ist alles');
  });
});
