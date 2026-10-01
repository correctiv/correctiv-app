import { act } from 'react-test-renderer';

import { projectGroups } from '@correctiv/app-core/data/projects';
import { searchSamples } from '@correctiv/app-core/data/search-samples';
import type { FeedItem } from '@correctiv/app-core/types/models';

import { sampleTarget } from '@/components/discover/SampleHitRow';
import { projectTarget } from '@/lib/discover/target';

/**
 * The Entdecken tab, its search and its project pages.
 *
 * Two kinds of test here, on purpose:
 *
 *  - the pure routing decisions (`projectTarget`, `sampleTarget`) over the WHOLE
 *    catalogue, because a directory entry that opens nothing is a dead row the
 *    typechecker is happy with;
 *  - a render of each screen, because the directory is built by nested `map`s and
 *    dropping a group would look exactly like a shorter page.
 */

// expo-router is the only thing these screens do to the outside world.
// `Stack.Screen` because `ScreenHeader` configures the platform's header through
// it on native, and a screen with a header therefore reaches expo-router for more
// than `router` now (ADR 0030).
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));
/**
 * The cascade itself is the core's, and is tested there
 * (`packages/app-core/test/search-store.test.ts`). Mocked as a thunk rather than a
 * plain value because the screen dispatches it through the store binding, and a
 * mock that returns undefined would blow up inside redux-thunk rather than in a
 * readable assertion.
 *
 * ONE export is replaced and the rest of the module is real. `searchProjectHits`
 * lives beside the cascade since issue #107 and needs no network, so stubbing it
 * out with the module around it would leave "finds project content that is in no
 * feed" asserting a mock.
 */
jest.mock('@correctiv/app-core/stores/search', () => ({
  ...jest.requireActual('@correctiv/app-core/stores/search'),
  searchWithFallback: jest.fn(() => () => Promise.resolve([])),
}));
jest.mock('@/lib/feeds/useFeed', () => ({
  useFeed: jest.fn(() => ({ data: null, loading: false, error: null, reload: jest.fn() })),
}));

// Imported after the mocks so the screens pick them up.
import { router, useLocalSearchParams } from 'expo-router';

import { press, render, renderedText, typeInto } from './support/rendering';

import { searchWithFallback } from '@correctiv/app-core/stores/search';

import EntdeckenScreen from '@/app/(tabs)/entdecken';
import ProjektScreen from '@/app/projekt/[id]';
import SucheScreen from '@/app/suche';
import { useFeed } from '@/lib/feeds/useFeed';
import { openExternal } from '@/lib/openExternal';

const push = router.push as jest.Mock;
const params = useLocalSearchParams as jest.Mock;
const openExternalMock = openExternal as jest.Mock;
const searchMock = searchWithFallback as jest.Mock;
const useFeedMock = useFeed as jest.Mock;

const allProjects = projectGroups.flatMap((g) => g.projects);

beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({});
  useFeedMock.mockReturnValue({ data: null, loading: false, error: null, reload: jest.fn() });
});

describe('projectTarget', () => {
  it('gives every directory entry a target', () => {
    const kinds = new Set(allProjects.map((p) => projectTarget(p).kind));
    // All three kinds must occur, or one branch is dead code no test protects.
    expect([...kinds].sort()).toEqual(['external', 'project', 'tab']);
  });

  it('sends purely external projects to the browser', () => {
    expect(projectTarget(allProjects.find((p) => p.id === 'funfacts')!)).toEqual({
      kind: 'external',
      url: 'https://www.youtube.com/@funfacts',
    });
  });

  it('keeps a project that has both a feed and a url inside the app', () => {
    // Salon5: the url is an extra source, not a replacement for the project page.
    const salon5 = allProjects.find((p) => p.id === 'salon5')!;
    expect(salon5.url ?? null).toBeNull();
    expect(projectTarget({ ...salon5, url: 'https://correctiv.org/salon5/' })).toEqual({
      kind: 'project',
      id: 'salon5',
    });
  });

  it('cross-links the participate projects into their tab', () => {
    expect(projectTarget(allProjects.find((p) => p.id === 'crowdnewsroom')!)).toEqual({
      kind: 'tab',
      path: '/(tabs)/mitmachen',
    });
  });

  it('opens the teaser-only project as a page, not as a link', () => {
    // Europe has no feed and no url — without this branch it would be a dead row.
    expect(projectTarget(allProjects.find((p) => p.id === 'europe')!)).toEqual({
      kind: 'project',
      id: 'europe',
    });
  });
});

describe('sampleTarget', () => {
  it('routes each search-sample kind that has a home', () => {
    expect(sampleTarget('podcast')).toBe('/(tabs)/mediathek');
    expect(sampleTarget('callout')).toBe('/(tabs)/mitmachen');
    expect(sampleTarget('backstage')).toBe('/(tabs)/profil');
  });

  it('leaves the kinds without a screen inert', () => {
    // Books have no screen in the app; a tappable row that does nothing is worse.
    expect(sampleTarget('verlag')).toBeNull();
    expect(sampleTarget('projekt')).toBeNull();
  });
});

describe('Entdecken', () => {
  it('renders every group and every project of the catalogue', () => {
    const text = renderedText(render(<EntdeckenScreen />));
    const missing = [
      ...projectGroups.map((g) => g.title.toUpperCase()),
      ...allProjects.map((p) => p.name),
    ].filter((label) => !text.includes(label));
    expect(missing).toEqual([]);
  });

  it('offers the search entry', () => {
    const tree = render(<EntdeckenScreen />);
    press(tree, 'Suche öffnen');
    expect(push).toHaveBeenCalledWith('/suche');
  });

  it('opens an external project in the browser instead of navigating', () => {
    const tree = render(<EntdeckenScreen />);
    press(tree, 'FunFacts');
    expect(openExternalMock).toHaveBeenCalledWith('https://www.youtube.com/@funfacts');
    expect(push).not.toHaveBeenCalled();
  });

  it('opens a project with a feed as a page', () => {
    const tree = render(<EntdeckenScreen />);
    press(tree, 'Recherchen');
    expect(push).toHaveBeenCalledWith({ pathname: '/projekt/[id]', params: { id: 'recherchen' } });
  });
});

describe('Projektseite', () => {
  it('shows name, description and the project action', () => {
    params.mockReturnValue({ id: 'faktencheck' });
    const text = renderedText(render(<ProjektScreen />));
    expect(text).toContain('CORRECTIV.Faktencheck');
    expect(text).toContain('Desinformation aufdecken');
    expect(text).toContain('Tipp per WhatsApp schicken');
  });

  it('shows the teaser instead of an empty list where the feed is empty', () => {
    params.mockReturnValue({ id: 'europe' });
    const text = renderedText(render(<ProjektScreen />));
    expect(text).toContain('Bald verfügbar');
    // No feed key means the feed section must not even be asked for.
    expect(useFeedMock).not.toHaveBeenCalled();
  });

  it('builds a topic page for a chip that has no project of its own', () => {
    params.mockReturnValue({ id: 'jugend' });
    const text = renderedText(render(<ProjektScreen />));
    expect(text).toContain('Jugend & Salon5');
    expect(useFeedMock).toHaveBeenCalledWith('salon5');
  });

  it('says so when the feed cannot be loaded, rather than spinning forever', () => {
    // This was the web target's normal state until ADR 0015. It is now the state of
    // a reader with no network, which is what the assertion is really about.
    params.mockReturnValue({ id: 'klima' });
    useFeedMock.mockReturnValue({
      data: null,
      loading: false,
      error: new Error('Network request failed'),
      reload: jest.fn(),
    });
    expect(renderedText(render(<ProjektScreen />))).toContain(
      'Beiträge konnten nicht geladen werden',
    );
  });

  it('does not pretend an unknown id is a project', () => {
    params.mockReturnValue({ id: 'gibt-es-nicht' });
    expect(renderedText(render(<ProjektScreen />))).toContain('Dieses Projekt gibt es nicht');
  });
});

describe('Suche', () => {
  const hit = (id: string, title: string): FeedItem => ({
    id,
    feed: 'recherchen',
    title,
    url: `https://correctiv.org/${id}/`,
    teaser: 'Teaser',
    publishedAt: '2026-06-12T10:00:00.000Z',
    categories: [],
    imageUrl: null,
  });

  /** What the core's search answers this query with. */
  const answers = (items: FeedItem[]) => searchMock.mockReturnValue(() => Promise.resolve(items));

  beforeEach(() => {
    jest.useFakeTimers();
    answers([]);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  /** Lets the debounce elapse and the search promises settle. */
  async function settle(): Promise<void> {
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
  }

  it('asks nothing before the query is long enough', async () => {
    const tree = render(<SucheScreen />);
    typeInto(tree, 'Suchbegriff', 'k');
    await settle();
    expect(searchMock).not.toHaveBeenCalled();
    expect(renderedText(tree)).toContain('Suchen Sie über Recherchen');
  });

  it('searches once per settled query, not per keystroke', async () => {
    const tree = render(<SucheScreen />);
    for (const q of ['kl', 'kli', 'klim', 'klima']) typeInto(tree, 'Suchbegriff', q);
    await settle();
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith('klima');
  });

  it('shows the hits it gets back', async () => {
    // Which of the two sources answered is the core's business, not the screen's:
    // `packages/app-core/test/search-store.test.ts` drives that cascade.
    answers([hit('a', 'Die Klimakrise vor Gericht')]);
    const tree = render(<SucheScreen />);
    typeInto(tree, 'Suchbegriff', 'klima');
    await settle();
    expect(renderedText(tree)).toContain('Die Klimakrise vor Gericht');
  });

  it('finds project content that is in no feed', async () => {
    const sample = searchSamples.find((s) => s.kind === 'podcast')!;
    const tree = render(<SucheScreen />);
    typeInto(tree, 'Suchbegriff', sample.title.slice(0, 8));
    await settle();
    expect(renderedText(tree)).toContain(sample.title);
  });

  it('reports an empty result instead of staying blank', async () => {
    const tree = render(<SucheScreen />);
    typeInto(tree, 'Suchbegriff', 'zzzzzz');
    await settle();
    // Two assertions rather than one: the interpolated query is its own text
    // node, so the rendered string has a line break where the JSX has none.
    const text = renderedText(tree);
    expect(text).toContain('Keine Treffer für');
    expect(text).toContain('zzzzzz');
  });
});
