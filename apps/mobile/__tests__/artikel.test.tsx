import { act } from 'react-test-renderer';

/**
 * The reader screen, which had no test at all.
 *
 * ARCHITECTURE.md calls the article path "the one worth tracing, because it crosses
 * every layer", and this was the only major screen with zero render coverage. Its
 * pure rules already live elsewhere with suites of their own (`readerChrome` and
 * `readerNavigation` next door, the URL rules in the core); what is left here is the
 * part that only exists
 * while the screen is mounted — the three load states, the retry, and what the
 * bookmark actually writes.
 *
 * `ReaderView` is mocked rather than rendered: on native it is a
 * react-native-webview, which has no test environment, and `web-target.test.ts`
 * already forbids that import outside the platform pair. `readerHtml` goes with it,
 * because building the document inlines the embedded fonts.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@correctiv/app-core/articles/load', () => ({
  loadArticle: jest.fn(),
}));

jest.mock('@/components/reader/ReaderView', () => {
  const react = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const ReaderView = () => react.createElement(Text, null, 'reader:document');
  ReaderView.displayName = 'ReaderView';
  return { ReaderView };
});
jest.mock('@/lib/articles/reader', () => ({ readerHtml: () => '<html></html>' }));

import { useLocalSearchParams } from 'expo-router';

import { loadArticle } from '@correctiv/app-core/articles/load';
import type { Article } from '@correctiv/app-core/articles/types';
import { savedArticlesActions } from '@correctiv/app-core/stores/savedArticles';
import { resetStore } from '@correctiv/app-core/stores/store';

import { findPressable, isDisabled, press, render, renderedText } from './support/rendering';

import ArtikelScreen from '@/app/artikel';
import { openExternal } from '@/lib/openExternal';
import { coreStore } from '@/lib/store/core';

const loadArticleMock = loadArticle as jest.Mock;
const openExternalMock = openExternal as jest.Mock;
const paramsMock = useLocalSearchParams as unknown as jest.Mock;

const URL = 'https://correctiv.org/aktuelles/2026/08/04/eine-recherche/';

const ARTICLE = {
  url: URL,
  title: 'Eine Recherche',
  kicker: 'Recherche',
  rating: null,
  html: '<p>Text</p>',
} as unknown as Article;

/** Lets the load promise settle without leaving an update outside `act`. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  paramsMock.mockReturnValue({ url: URL, title: 'Eine Recherche' });
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

describe('the reader', () => {
  it('shows a spinner until the article arrives, then the document', async () => {
    let resolve!: (article: Article) => void;
    loadArticleMock.mockReturnValueOnce(
      new Promise<Article>((r) => {
        resolve = r;
      }),
    );

    const tree = render(<ArtikelScreen />);
    // Neither the document nor the error state, which is the state a reader sees
    // for as long as the network takes.
    expect(renderedText(tree)).not.toContain('reader:document');
    expect(renderedText(tree)).not.toContain('Artikel konnte nicht geladen werden');

    await act(async () => {
      resolve(ARTICLE);
    });
    expect(renderedText(tree)).toContain('reader:document');
  });

  it('offers both ways out when the load fails', async () => {
    loadArticleMock.mockRejectedValueOnce(new Error('offline'));

    const tree = render(<ArtikelScreen />);
    await settle();

    expect(renderedText(tree)).toContain('Artikel konnte nicht geladen werden');
    expect(findPressable(tree, 'Erneut versuchen')).toBeTruthy();
    expect(findPressable(tree, 'Im Browser öffnen')).toBeTruthy();
  });

  it('loads again on retry', async () => {
    loadArticleMock.mockRejectedValueOnce(new Error('offline'));
    const tree = render(<ArtikelScreen />);
    await settle();
    expect(loadArticleMock).toHaveBeenCalledTimes(1);

    loadArticleMock.mockResolvedValueOnce(ARTICLE);
    press(tree, 'Erneut versuchen');
    await settle();

    expect(loadArticleMock).toHaveBeenCalledTimes(2);
    expect(renderedText(tree)).toContain('reader:document');
  });

  it('leaves through openExternal, never a bare Linking call', async () => {
    // The rejection `Linking.openURL` produces when no handler is installed has no
    // useful recovery, and unhandled it is worse than the logged warning
    // `openExternal` gives. This screen used to call it directly, twice.
    loadArticleMock.mockRejectedValueOnce(new Error('offline'));
    const tree = render(<ArtikelScreen />);
    await settle();

    press(tree, 'Im Browser öffnen');
    expect(openExternalMock).toHaveBeenCalledWith(URL);
  });

  it('offers no bookmark until something carries a headline', async () => {
    // A deep link, a shared address or an internal link from another reader arrives
    // as a bare URL. Saving then wrote `title: ''`, and `/gespeichert` rendered a
    // blank line above its date that no restart cleared.
    paramsMock.mockReturnValue({ url: URL });
    let resolve!: (article: Article) => void;
    loadArticleMock.mockReturnValueOnce(
      new Promise<Article>((r) => {
        resolve = r;
      }),
    );

    const tree = render(<ArtikelScreen />);
    expect(isDisabled(tree, 'Artikel speichern')).toBe(true);

    await act(async () => {
      resolve(ARTICLE);
    });

    expect(isDisabled(tree, 'Artikel speichern')).toBe(false);
    press(tree, 'Artikel speichern');
    expect(coreStore.getState().savedArticles.items[0]).toMatchObject({
      url: URL,
      title: ARTICLE.title,
    });
  });

  it('takes the headline from the route params without waiting for the load', async () => {
    // The ordinary path: a feed row passes the title it already shows, so the
    // bookmark works while the article is still on its way.
    loadArticleMock.mockReturnValueOnce(new Promise<Article>(() => {}));

    const tree = render(<ArtikelScreen />);

    expect(isDisabled(tree, 'Artikel speichern')).toBe(false);
  });

  it('never blocks removing one, whatever the load did', async () => {
    // The mirror of the guard. Re-reading a saved article through a bare URL that
    // then fails to load must still let go of it, or the entry is unremovable from
    // the one screen that shows it.
    paramsMock.mockReturnValue({ url: URL });
    act(() => {
      coreStore.dispatch(
        savedArticlesActions.toggle({
          url: URL,
          title: 'Schon gespeichert',
          kicker: null,
          rating: null,
          savedAt: '2026-09-01T10:00:00.000Z',
        }),
      );
    });
    loadArticleMock.mockRejectedValueOnce(new Error('offline'));

    const tree = render(<ArtikelScreen />);
    await settle();

    expect(isDisabled(tree, 'Gespeichert, entfernen')).toBe(false);
    press(tree, 'Gespeichert, entfernen');
    expect(coreStore.getState().savedArticles.items).toEqual([]);
  });

  it('saves the kicker and the rating off the loaded article, not just the link', async () => {
    // The list of saved articles renders both, and the params carry neither — they
    // only exist once the article itself has been parsed.
    loadArticleMock.mockResolvedValueOnce({ ...ARTICLE, kicker: 'Faktencheck', rating: 'falsch' });
    const tree = render(<ArtikelScreen />);
    await settle();

    press(tree, 'Artikel speichern');

    const [saved] = coreStore.getState().savedArticles.items;
    expect(saved).toMatchObject({ url: URL, kicker: 'Faktencheck', rating: 'falsch' });
  });
});
