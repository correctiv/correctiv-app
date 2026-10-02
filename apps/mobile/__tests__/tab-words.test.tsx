/**
 * What the three bars call a tab, and where that word comes from.
 *
 * [ADR 0075](../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §5 moved the label and the icon out of the app and into the screen's own document,
 * and put one condition on the move: the words come from **the same copy of the
 * document the entries come from**. The native tab components take their triggers
 * before the navigator mounts, so a bar that read its words a second time could draw a
 * tab the last fetch added under the name the one before it had.
 *
 * So this file asks two things that are easy to get separately right: that a document's
 * word reaches the bar at all, and that it reaches it out of the copy `tabBar()` froze.
 *
 * `expo-constants` is mocked for the reason `home-layout-source.test.tsx` mocks it: a
 * fetched copy is only offered when the build can say when it was made, and under jest
 * nothing stamps one.
 */

/** The module map behind `layout.ts` imports the router; nothing here navigates. */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

/** The build time `app.config.js` stamps, as `expo-constants` would hand it over. */
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { builtAt: '2026-09-23T06:00:00.000Z' } } },
}));

import { act } from 'react-test-renderer';

import { homeLayoutActions } from '@correctiv/app-core/stores/homeLayout';
import { resetStore } from '@correctiv/app-core/stores/store';
import { SCREEN_ICON_FALLBACK, type ScreenWords } from '@correctiv/app-core/lib/screen-layout';

import { NavRail } from '@/components/ui/NavRail';
import { BUILT_AT } from '@/lib/home/layout';
import { resetTabBar, tabBar, tabScreenWords } from '@/lib/navigation/tabBar';
import { tabWordOf } from '@/lib/navigation/tabWords';
import { SCREEN_ICONS } from '@/lib/screenIcons';
import { coreStore } from '@/lib/store/core';

import { render } from './support/rendering';

const NO_INSETS = { top: 0, bottom: 0, left: 0, right: 0 };

/** A screen's document, as a newsroom publishes it: its words and one place to draw. */
function screenDocument(words: Record<string, unknown>) {
  return { version: 4, ...words, sections: [{ id: 'tip', module: 'tip-card' }] };
}

/** The merged document the deploy publishes (ADR 0071 §1), with or without a navigation. */
function merged(screens: Record<string, unknown>, navigation?: unknown): string {
  return JSON.stringify({
    version: 1,
    screens,
    ...(navigation === undefined ? {} : { navigation }),
  });
}

function holdFetched(text: string, publishedAt = BUILT_AT + 60_000) {
  act(() => {
    coreStore.dispatch(homeLayoutActions.received({ text, publishedAt }));
  });
}

/** The rail, which draws the same words as the phone bar and is the one of the three a test can render. */
function railLabels(): string[] {
  const tree = render(<NavRail active="index" onSelect={() => {}} insets={NO_INSETS} />);
  return tree.root
    .findAll(
      (node) =>
        node.props?.accessibilityRole === 'tab' && typeof node.props?.onPress === 'function',
    )
    .map((tab) => tab.props.accessibilityLabel as string);
}

beforeEach(() => {
  act(() => {
    coreStore.dispatch(resetStore());
  });
  resetTabBar();
});

afterAll(() => {
  resetTabBar();
});

describe('the words a bar draws', () => {
  it('are the bundled documents’ own titles when nothing was fetched', () => {
    expect(railLabels()).toEqual(['Home', 'Entdecken', 'Mediathek', 'Mitmachen', 'Profil']);
  });

  it('follow a renamed tab label in the fetched document', () => {
    // The point of the whole step: the newsroom renames a tab in a `[layout]`
    // submission and the bar says the new word, with no release and no catalogue id.
    holdFetched(
      merged({
        mitmachen: screenDocument({
          title: { de: 'Mitmachen' },
          tabLabel: { de: 'Machen Sie mit' },
          icon: 'people',
        }),
      }),
    );
    expect(railLabels()).toEqual(['Home', 'Entdecken', 'Mediathek', 'Machen Sie mit', 'Profil']);
  });

  it('fall back to the title when the document names no tab label', () => {
    // ADR 0075 §3's default, which is why nobody has to type the word twice.
    holdFetched(
      merged({ entdecken: screenDocument({ title: { de: 'Themen' }, icon: 'compass' }) }),
    );
    expect(railLabels()).toEqual(['Home', 'Themen', 'Mediathek', 'Mitmachen', 'Profil']);
  });

  it('fall back to the bundled document when the fetched one has no title at all', () => {
    // A title is the one word a document may not leave out (ADR 0075 §2). The screen
    // keeps the name this build bundles rather than losing it, which is a smaller loss
    // than a blank tab and the only one available: a bar with an unnamed button is a
    // button nobody can report.
    holdFetched(merged({ profil: screenDocument({ icon: 'person' }) }));
    expect(railLabels()).toEqual(['Home', 'Entdecken', 'Mediathek', 'Mitmachen', 'Profil']);
  });

  it('come out of the same copy of the document as the entries', () => {
    // One fetched body carrying both halves: the navigation puts Profil second and the
    // screen documents rename two tabs. Both arrive, because both are read out of it.
    holdFetched(
      merged(
        {
          profil: screenDocument({ title: { de: 'Mein Bereich' }, icon: 'person' }),
          entdecken: screenDocument({ title: { de: 'Themen' }, icon: 'compass' }),
        },
        { version: 1, tabs: ['profil', 'entdecken'], maxTabs: 5 },
      ),
    );
    expect(tabBar().bar.tabs).toEqual(['index', 'profil', 'entdecken']);
    expect(railLabels()).toEqual(['Home', 'Mein Bereich', 'Themen']);
  });

  it('are frozen with the entries, so a fetch that lands later applies at the next start', () => {
    // The measurement behind ADR 0071 §6 and ADR 0075 §5: changing the triggers
    // remounts the navigator and loses the state of every tab, so neither half of the
    // bar may move while the app is running. The next start is `resetTabBar()` here and
    // a relaunch on a phone.
    expect(railLabels()[3]).toBe('Mitmachen');
    holdFetched(
      merged({ mitmachen: screenDocument({ title: { de: 'Beteiligen' }, icon: 'people' }) }),
    );
    expect(railLabels()[3]).toBe('Mitmachen');
    resetTabBar();
    expect(railLabels()[3]).toBe('Beteiligen');
  });

  it('report an icon this build does not know by drawing the fallback', () => {
    // ADR 0075 §4: the smallest possible loss. The key is dropped by the parser and the
    // screen draws the icon the app declares for "no icon", rather than the document
    // being refused and the way into the app with it.
    holdFetched(
      merged({ mediathek: screenDocument({ title: { de: 'Mediathek' }, icon: 'hologram' }) }),
    );
    expect(tabScreenWords()['mediathek']?.icon).toBeUndefined();
    const word = tabWordOf('mediathek', tabScreenWords()['mediathek'], 'de', 'Mehr');
    expect(word.icon).toBe(SCREEN_ICONS[SCREEN_ICON_FALLBACK]);
  });
});

/** One screen's words, built by hand: what a document would have left after parsing. */
const words = (overrides: Partial<ScreenWords>): ScreenWords => ({
  title: { de: 'Mitmachen', en: 'Take part' },
  ...overrides,
});

describe('one route’s word, out of its screen’s', () => {
  it('is resolved in the app’s language and falls back to German', () => {
    // `resolveText`'s rule (ADR 0075 §2), seen from the bar: never the empty string and
    // never the key, so a document that carries no English still says something in an
    // English build.
    expect(tabWordOf('mitmachen', words({}), 'en', 'More').label).toBe('Take part');
    expect(tabWordOf('mitmachen', words({}), 'de', 'Mehr').label).toBe('Mitmachen');
    expect(tabWordOf('mitmachen', words({ title: { de: 'Mitmachen' } }), 'en', 'More').label).toBe(
      'Mitmachen',
    );
  });

  it('prefers the tab label over the title, in whichever language', () => {
    const named = words({ tabLabel: { de: 'Mitmachen', en: 'Join in' } });
    expect(tabWordOf('mitmachen', named, 'en', 'More').label).toBe('Join in');
    expect(tabWordOf('mitmachen', named, 'de', 'Mehr').label).toBe('Mitmachen');
  });

  it('draws the fallback icon for a key the app does not declare', () => {
    // `tabScreenWords()` cannot produce one — the parser drops an unknown key — but
    // this is public and takes words somebody may have built by hand, which is the
    // reason the core guards the same lookup the same way.
    expect(tabWordOf('mitmachen', words({ icon: 'hologram' }), 'de', 'Mehr').icon).toBe(
      SCREEN_ICONS[SCREEN_ICON_FALLBACK],
    );
    expect(tabWordOf('mitmachen', words({ icon: 'people' }), 'de', 'Mehr').icon).toBe(
      SCREEN_ICONS['people'],
    );
  });

  it('gives "Mehr" the app’s own word and icon, because no document carries them', () => {
    // ADR 0071 §5: "Mehr" is the screen the app draws when the bar overflows, and the
    // one label the catalogue still holds.
    const word = tabWordOf('mehr', undefined, 'de', 'Mehr');
    expect(word.label).toBe('Mehr');
    expect(word.icon).toBe(SCREEN_ICONS['more']);
  });
});
