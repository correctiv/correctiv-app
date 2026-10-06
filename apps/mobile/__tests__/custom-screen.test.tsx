import { act } from 'react-test-renderer';

/**
 * `/s/<id>`, the one route behind every screen the newsroom makes
 * ([ADR 0075](../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §7): it draws the document the joined copy carries under that id, and an id it does not
 * carry is the app's `+not-found`.
 */

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { builtAt: '2026-09-23T06:00:00.000Z' } } },
}));

jest.mock('@/lib/feeds/useFeed', () => ({
  useFeed: () => ({ data: undefined, loading: false, offline: false, reload: jest.fn() }),
}));

import { useLocalSearchParams } from 'expo-router';

import { homeLayoutActions } from '@correctiv/app-core/stores/homeLayout';
import { resetStore } from '@correctiv/app-core/stores/store';

import { render, renderedText } from './support/rendering';

import MehrScreen from '@/app/(tabs)/mehr';
import CustomScreen from '@/app/s/[id]';
import { BUILT_AT } from '@/lib/home/layout';
import { coreStore } from '@/lib/store/core';

const params = useLocalSearchParams as jest.Mock;

beforeEach(() => {
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

describe('"Mehr"', () => {
  it('lists the custom screens the document carries, and no row for one it does not', () => {
    hold({
      klima: { version: 4, title: { de: 'Klimakrise' }, sections: [] },
      'Bad Id': { version: 4, title: { de: 'Unsichtbar' }, sections: [] },
    });
    const text = renderedText(render(<MehrScreen />));
    expect(text).toContain('Klimakrise');
    expect(text).not.toContain('Unsichtbar');
  });
});
