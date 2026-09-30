import type { FeedItem } from '@correctiv/app-core/types/models';

import { render, renderedText } from './support/rendering';

import { useFeed } from '@/lib/feeds/useFeed';

import ProjektScreen from '@/app/projekt/[id]';

/**
 * The foot of a project feed, and the sentence it must not say too early.
 *
 * **The store's `hasMore` and the screen's claim about the newsroom are different
 * things, and only this file stands between them.** A warm cache and the bundled
 * snapshot both render a list without ever asking whether more exists, so `hasMore`
 * is `false` in both — not because the list ended, but because nobody filled the
 * field in. A screen that reads that boolean as an answer prints "Das ist alles, was
 * bisher erschienen ist." over page one and is wrong about CORRECTIV's own archive.
 *
 * The store side is tested in `packages/app-core/test/feeds-store.test.ts`, and it
 * passes whether or not the screen guards anything: the store holding an honest
 * `paged: false` and the screen ignoring it is the actual defect, and no assertion
 * in the core can see a screen. Found by a reviewer reading the store, and measured
 * the same day on `Medium_Phone_API_36` (ADR 0066 §3).
 *
 * So: rendered, not inspected. The four states below differ by one boolean in the
 * slice, and the last by which of the two booleans is set.
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

/** The four shapes the slice can be in, named by what the store actually knows. */
function feed(paged: boolean, hasMore: boolean) {
  feedMock.mockReturnValue({
    data: [item('a'), item('b')],
    loading: false,
    error: null,
    offline: false,
    reload: jest.fn(),
    hasMore,
    paged,
    loadingMore: false,
    loadMore: jest.fn(),
  });
  return renderedText(render(<ProjektScreen />));
}

describe('the foot of a project feed', () => {
  it('says nothing when nobody has asked whether more exists', () => {
    // A warm start, or a reader with no network: rows, and no answer.
    const text = feed(false, false);
    expect(text).toContain('Beitrag a');
    expect(text).not.toContain('Das ist alles');
    expect(text).not.toContain('Mehr laden');
  });

  it('says the list is complete once the store has said it is', () => {
    const text = feed(true, false);
    expect(text).toContain('Das ist alles, was bisher erschienen ist.');
    expect(text).not.toContain('Mehr laden');
  });

  it('offers the button when there is another page, and not the sentence', () => {
    const text = feed(true, true);
    expect(text).toContain('Mehr laden');
    expect(text).not.toContain('Das ist alles');
  });

  it('answers an unanswered feed with neither sentence nor button', () => {
    // The combination that could not happen before, and is the reason the two
    // booleans are separate: a page one nobody has paged yet is not a full archive,
    // and it is not a feed that can be paged either.
    const text = feed(false, true);
    expect(text).not.toContain('Das ist alles');
    expect(text).not.toContain('Mehr laden');
  });
});
