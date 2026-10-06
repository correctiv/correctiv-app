import { act } from 'react-test-renderer';

/**
 * `/s/<id>`, the one route behind every screen
 * ([ADR 0075](../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §7, [ADR 0079](../../../adr/0079-the-app-draws-its-tabs-from-the-layout.md)): it draws the
 * document the joined copy carries under that id, and an id it does not carry is the app's
 * `+not-found`. The setup file's bundle is `demo`, so `home` and its four neighbours are
 * screens the bundle carries, and a screen the copy took away is still there.
 */

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { builtAt: '2026-09-23T06:00:00.000Z' } } },
}));

jest.mock('@/lib/feeds/useFeed', () => ({
  useFeed: () => ({
    data: undefined,
    loading: false,
    offline: false,
    reload: jest.fn(),
  }),
}));

import { useLocalSearchParams } from 'expo-router';

import { homeLayoutActions } from '@correctiv/app-core/stores/homeLayout';
import { resetStore } from '@correctiv/app-core/stores/store';

import { render, renderedText } from './support/rendering';

import MehrScreen from '@/app/(tabs)/mehr';
import CustomScreen from '@/app/(tabs)/s/[id].web';
import { BUILT_AT } from '@/lib/home/layout';
import { resetStartDecision } from '@/lib/navigation/tabBar';
import { coreStore } from '@/lib/store/core';

const params = useLocalSearchParams as jest.Mock;

beforeEach(() => {
  resetStartDecision();
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

function hold(screens: Record<string, unknown>) {
  act(() => {
    coreStore.dispatch(
      homeLayoutActions.received({
        text: JSON.stringify({ version: 1, screens }),
        publishedAt: BUILT_AT + 60_000,
      }),
    );
  });
}

describe('/s/<id>', () => {
  it('draws the title and the blocks of the screen the document carries', () => {
    hold({
      klima: {
        version: 4,
        title: { de: 'Klimakrise', en: 'Climate' },
        sections: [{ id: 'head', module: 'screen-header' }],
      },
    });
    params.mockReturnValue({ id: 'klima' });
    const text = renderedText(render(<CustomScreen />));
    expect(text).toContain('Klimakrise');
    expect(text).not.toContain('Page not found');
  });

  it('is the not-found page for a screen the document does not carry', () => {
    hold({});
    params.mockReturnValue({ id: 'klima' });
    expect(renderedText(render(<CustomScreen />))).toContain('Diese Seite gibt es nicht');
  });

  it('is the not-found page for an id that cannot name a screen', () => {
    hold({ 'Bad-Id': { version: 4, title: { de: 'X' }, sections: [] } });
    params.mockReturnValue({ id: 'Bad-Id' });
    expect(renderedText(render(<CustomScreen />))).toContain('Diese Seite gibt es nicht');
  });
});

describe('a screen the bundle has always carried', () => {
  it('is drawn by this route like any other, under the id it always had', () => {
    params.mockReturnValue({ id: 'mitmachen' });
    expect(renderedText(render(<CustomScreen />))).not.toContain('Diese Seite gibt es nicht');
  });

  it('is the fetched document when the copy carries it, whatever it holds', () => {
    hold({ home: { version: 4, title: { de: 'Neuer Start' }, sections: [] } });
    params.mockReturnValue({ id: 'home' });
    const text = renderedText(render(<CustomScreen />));
    expect(text).not.toContain('Diese Seite gibt es nicht');
  });

  it('is not-found for an id nothing carries, and for the one the navigation answers to', () => {
    hold({});
    for (const id of ['gibt-es-nicht', 'navigation', 'mehr']) {
      params.mockReturnValue({ id });
      expect(renderedText(render(<CustomScreen />))).toContain('Diese Seite gibt es nicht');
    }
  });
});

describe('"Mehr"', () => {
  it('is not-found while the bar has no use for it', () => {
    hold({});
    expect(renderedText(render(<MehrScreen />))).toContain('Diese Seite gibt es nicht');
  });

  it('lists the screens the document carries, and no row for one it does not', () => {
    hold({
      klima: { version: 4, title: { de: 'Klimakrise' }, sections: [] },
      'Bad Id': { version: 4, title: { de: 'Unsichtbar' }, sections: [] },
    });
    const text = renderedText(render(<MehrScreen />));
    expect(text).toContain('Klimakrise');
    expect(text).not.toContain('Unsichtbar');
  });
});

const layout = (screen: string) => ({
  version: 4,
  title: { de: 'Start' },
  sections: [{ id: 'go', module: 'screen-link', settings: { screen } }],
});

describe('the link block', () => {
  const target = {
    version: 4,
    title: { de: 'Klimakrise' },
    tabLabel: { de: 'Klima' },
    sections: [],
  };

  it('is named by the tab label of the screen it points at', () => {
    hold({ start: layout('klima'), klima: target });
    params.mockReturnValue({ id: 'start' });
    expect(renderedText(render(<CustomScreen />))).toContain('Klima');
  });

  it('is left out when the document does not carry its screen (ADR 0039 §6)', () => {
    hold({ start: layout('gone') });
    params.mockReturnValue({ id: 'start' });
    const text = renderedText(render(<CustomScreen />));
    expect(text).not.toContain('gone');
    expect(text).not.toContain('Klima');
  });

  it('does not draw a link the parser refused, and takes only its own place with it', () => {
    hold({
      start: {
        version: 4,
        title: { de: 'Start' },
        sections: [
          {
            id: 'bad',
            module: 'screen-link',
            settings: { screen: 'Not An Id' },
          },
          { id: 'head', module: 'screen-header' },
        ],
      },
    });
    params.mockReturnValue({ id: 'start' });
    expect(renderedText(render(<CustomScreen />))).toContain('Start');
  });
});
