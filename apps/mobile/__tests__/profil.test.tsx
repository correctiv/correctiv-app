import { act } from 'react-test-renderer';

import { quarterlyReport } from '@correctiv/app-core/data/quartalsbericht';

/**
 * The profile used to render two versions of itself, one for a member and one for a
 * guest, and these tests pinned both. Since the door (ADR 0016) there is no guest to
 * render for, so the guest cases became assertions that its copy is gone (ADR 0018).
 * The membership sections are now unconditional, which is what the remaining cases
 * check. The contribution flow behind them went with ADR 0020: the app offers no
 * payment functions, so the card reads the entitlement and links out.
 */

// `Stack.Screen` because `ScreenHeader` configures the platform's header through
// it on native, and a screen with a header therefore reaches expo-router for more
// than `router` now (ADR 0030).
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));

/**
 * The impact card reads the `recherchen` feed through the store rather than the
 * generated bundle, so this file supplies the items. No network here for the same
 * reason as `home-timed.test.tsx`: a thunk landing after the test body is an update
 * outside `act`, and that noise is where a real warning hides.
 *
 * What the mock replaces is the lazy load and the store subscription; the SELECTOR
 * is the real one. "A fact check is not an investigation" is the core's rule now
 * (`stores/feeds.ts`, with its own suite), and the card below still has to be seen
 * obeying it — through the same code the app runs, not a second filter written
 * here.
 *
 * ONE export is replaced and the rest of the module is real, for the reason
 * `discover.test.tsx` spreads `requireActual` too: a factory that returns one
 * function makes `useFeed` undefined for every other component in this render, and
 * the failure is "useFeed is not a function" in a child nobody was testing.
 */
let mockFeedItems: FeedItem[] = [];
jest.mock('@/lib/feeds/useFeed', () => {
  const { investigations } = jest.requireActual('@correctiv/app-core/stores/feeds');
  return {
    ...jest.requireActual('@/lib/feeds/useFeed'),
    useInvestigations: (limit: number) =>
      investigations({ byKey: { recherchen: { items: mockFeedItems } } }, limit),
  };
});

import { router } from 'expo-router';
import { openExternal } from '@/lib/openExternal';

import { findAllPressable, press, render, renderedText } from './support/rendering';

import EinstellungenScreen from '@/app/einstellungen';
import GespeichertScreen from '@/app/gespeichert';
import ProfilScreen from '@/app/(tabs)/profil';
import { sessionActions } from '@correctiv/app-core/stores/session';
import { resetStore } from '@correctiv/app-core/stores/store';
import type { Entitlement, FeedItem, MembershipTier } from '@correctiv/app-core/types/models';

import { coreActions, coreStore } from '@/lib/store/core';

const push = router.push as jest.Mock;

const ARTICLE = {
  url: 'https://correctiv.org/x/2026/06/12/eine-recherche/',
  title: 'Eine Recherche',
  kicker: 'Recherche',
  rating: null,
  savedAt: '2026-06-12T10:00:00.000Z',
};

/** A card as the `recherchen` stream delivers it: every item stamped with that feed. */
function item(url: string, title: string): FeedItem {
  return {
    id: url,
    feed: 'recherchen',
    title,
    url,
    teaser: '',
    publishedAt: '2026-08-11T08:00:00.000Z',
    categories: [],
  };
}

const INVESTIGATION = item(
  'https://correctiv.org/russland/2026/08/11/russisches-haus/',
  'Russisches Haus',
);
const FACT_CHECK = item(
  'https://correctiv.org/faktencheck/2026/08/11/keine-ki-foto-ist-echt/',
  'Keine KI: Foto ist echt',
);

beforeEach(() => {
  jest.clearAllMocks();
  mockFeedItems = [];
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

/**
 * Through the door. The screen takes the reader's name and tier from the session,
 * so a test that does not sign in exercises the fallbacks instead of the real path.
 */
function signIn(tier: MembershipTier = 'paid'): void {
  act(() => {
    coreStore.dispatch(
      sessionActions.succeeded({
        account: { email: 'alex@example.org', name: 'Alex Beispiel' },
        entitlement: {
          tier,
          appAccess: true,
          source: 'paid',
          validUntil: null,
          localAreas: [],
          memberSince: '2026-03-04T09:12:00.000Z',
        },
      }),
    );
  });
}

describe('Profil before the session has answered', () => {
  it('has no guest copy left anywhere', () => {
    const text = renderedText(render(<ProfilScreen />));
    expect(text).not.toContain('Sie sind als Gast unterwegs');
    expect(text).not.toContain('Alles Wichtige bleibt frei zugänglich');
    expect(text).not.toContain('Unterstützer:in werden');
  });

  it('renders its sections with no entitlement to read yet', () => {
    const tree = render(<ProfilScreen />);
    const text = renderedText(tree);
    // The overline renders uppercase.
    expect(text).toContain('IHRE MITGLIEDSCHAFT');
    expect(text).toContain(quarterlyReport.quarter);
    expect(text).toContain('Ihr Backstage');
    // It is still marked as the club's. Asserted on the row's accessibility label
    // rather than on the badge text, because "Club" also occurs in the subtitle —
    // and this way a screen reader is covered too.
    expect(findAllPressable(tree, 'Ihr Backstage, Club')).toHaveLength(1);
  });
});

describe('Profil as a member', () => {
  it('takes the name from the session and the tier from the entitlement', () => {
    signIn();
    const text = renderedText(render(<ProfilScreen />));
    expect(text).toContain('CORRECTIV CLUB');
    expect(text).toContain('Alex Beispiel');
    expect(text).toContain('Mitgliedschaft mit Beitrag');
    expect(text).toContain('seit');
  });

  /** The card names what the membership system answered, not a fixed word. */
  it('names a Soli membership as such', () => {
    signIn('soli');
    expect(renderedText(render(<ProfilScreen />))).toContain('Soli-Mitgliedschaft');
  });

  /**
   * The card reads the answer and sets nothing. ADR 0020: the app offers no payment
   * functions, so an amount, an interval and a pause switch have no place here.
   */
  it('reads the entitlement and offers no way to set a contribution', () => {
    signIn();
    const text = renderedText(render(<ProfilScreen />));

    expect(text).toContain('Mitgliedschaft mit Beitrag');
    expect(text).toContain('Zugang über');
    expect(text).toContain('Ihren Beitrag');
    expect(text).toContain(quarterlyReport.quarter);

    expect(text).not.toContain('Beitrag festlegen');
    expect(text).not.toContain('Beitrag ändern');
    expect(text).not.toContain('Pausieren');
    expect(text).not.toContain('€ / Monat');
  });

  /** The one outbound link, and the label the store rules allow it to carry. */
  it('sends account management outside, and never names a price', () => {
    signIn();
    const tree = render(<ProfilScreen />);

    press(tree, 'Konto verwalten');

    expect(openExternal).toHaveBeenCalledWith('https://correctiv.org/unterstuetzen/');
    expect(push).not.toHaveBeenCalled();
  });

  /** A trial is the case where the app has an end date to print. */
  it('prints the end date of a trial', () => {
    act(() => {
      coreStore.dispatch(
        sessionActions.succeeded({
          account: { email: 'test@example.org', name: 'Test' },
          entitlement: {
            tier: 'paid',
            appAccess: true,
            source: 'trial',
            // Noon, so the local date is the same in every timezone a test runs in.
            validUntil: '2026-10-02T12:00:00.000Z',
            localAreas: [],
            memberSince: '2026-03-04T09:12:00.000Z',
          },
        }),
      );
    });

    const text = renderedText(render(<ProfilScreen />));
    expect(text).toContain('Ihre Testphase');
    expect(text).toContain('Läuft bis');
    expect(text).toContain('2. Oktober');
  });

  /**
   * An entitlement stored by a build before `memberSince` existed hydrates without
   * it, and `refreshEntitlement` keeps the held answer, so this state is on devices
   * and in browsers that saw the demo before the field. The card degrades to the tier
   * alone rather than to "seit undefined".
   */
  it('prints the tier without a date for an entitlement stored before the field existed', () => {
    const stored = {
      tier: 'paid',
      appAccess: true,
      source: 'paid',
      validUntil: null,
      localAreas: [],
    } as unknown as Entitlement;
    act(() => {
      coreStore.dispatch(
        sessionActions.hydrate({
          account: { email: 'alex@example.org', name: 'Alex Beispiel' },
          entitlement: stored,
        }),
      );
    });

    const text = renderedText(render(<ProfilScreen />));
    expect(text).toContain('Mitgliedschaft mit Beitrag');
    expect(text).not.toContain('· seit');
    expect(text).not.toContain('undefined');
    expect(text).toContain('Ihr Beitrag ermöglicht diese Recherchen');
  });

  it('opens the report, the saved list and the settings', () => {
    signIn();
    const tree = render(<ProfilScreen />);

    press(tree, `${quarterlyReport.quarter}, Club`);
    press(tree, 'Gespeicherte Artikel');
    press(tree, 'App-Einstellungen');

    expect(push.mock.calls.map((c) => c[0])).toEqual([
      '/bericht',
      '/gespeichert',
      '/einstellungen',
    ]);
  });
});

/**
 * The impact card used to read `offlineBundle.generated` at module scope, which put
 * the whole snapshot module in this route's import graph, went around the
 * `ContentBundle` port, and fixed the list at build time. It reads the feed slice
 * now; `web-target.test.ts` guards the import that is gone.
 */
describe('the impact card', () => {
  it('names investigations from the feed and leaves the fact checks out', () => {
    mockFeedItems = [
      INVESTIGATION,
      FACT_CHECK,
      item('https://correctiv.org/aktuelles/wirtschaft/2026/08/10/vw/', 'VW unter Druck'),
      item('https://correctiv.org/klima/2026/08/09/hitze/', 'Hitze in der Stadt'),
      item('https://correctiv.org/afd/2026/08/08/parteitag/', 'Der vierte Artikel'),
    ];
    const text = renderedText(render(<ProfilScreen />));

    expect(text).toContain('Russisches Haus');
    expect(text).toContain('VW unter Druck');
    expect(text).toContain('Hitze in der Stadt');
    // Fact checks are not impact investigations, and only three are named.
    expect(text).not.toContain('Keine KI: Foto ist echt');
    expect(text).not.toContain('Der vierte Artikel');
  });

  it('opens one in the reader', () => {
    mockFeedItems = [INVESTIGATION];
    const tree = render(<ProfilScreen />);
    // FOUND BY ITS ACCESSIBLE NAME, which is also the assertion: the title is a
    // `Typo` inside a `Pressable` that carries the press, the name and the role, so
    // the text and the name sit on different nodes and a search for "a node whose
    // children are the title AND that has an onPress" finds nothing.
    const line = tree.root.find(
      (node) => node.props?.accessibilityLabel === INVESTIGATION.title && !!node.props?.onPress,
    );
    // A LINK, not a paragraph that happens to be tappable. Measured before this
    // wrap existed: the node carried `accessibilityRole` undefined and no
    // `accessibilityLabel`, so a screen reader read the title out with nothing to
    // say it opens anything.
    expect(line.props.accessibilityRole).toBe('link');
    // The SPACING moved onto the wrapper with the press, and a wrap that dropped it
    // would collapse the three titles against each other with every test still green.
    expect(line.props.className).toContain('mt-s');
    act(() => {
      line.props.onPress();
    });

    expect(push).toHaveBeenCalledWith({
      pathname: '/artikel',
      params: { url: INVESTIGATION.url, title: INVESTIGATION.title },
    });
  });

  /** Nothing loaded yet is a real state now that the list is not bundled. */
  it('does not introduce a list it has nothing to put in', () => {
    signIn();
    const text = renderedText(render(<ProfilScreen />));

    expect(text).toContain('Sie unterstützen CORRECTIV');
    expect(text).not.toContain('Unter anderem');
  });
});

describe('newsletters and saved articles', () => {
  it('subscribes a newsletter through the store', () => {
    const tree = render(<ProfilScreen />);
    const row = tree.root.find(
      (n) => n.props?.accessibilityLabel === 'Spotlight' && !!n.props?.onValueChange,
    );
    act(() => {
      row.props.onValueChange(true);
    });

    // Persisted (PERSISTED_KEYS covers `newsletter`), so it survives a restart.
    expect(coreStore.getState().settings.newsletter.spotlight).toBe(true);
  });

  it('counts saved articles in singular and plural', () => {
    expect(renderedText(render(<ProfilScreen />))).toContain('Noch nichts gespeichert');

    act(() => {
      coreActions.savedArticles.toggle(ARTICLE);
    });
    expect(renderedText(render(<ProfilScreen />))).toContain('1 Artikel');

    act(() => {
      coreActions.savedArticles.toggle({ ...ARTICLE, url: `${ARTICLE.url}2` });
    });
    expect(renderedText(render(<ProfilScreen />))).toContain('2 Artikel');
  });

  it('removes an article from the saved list', () => {
    act(() => {
      coreActions.savedArticles.toggle(ARTICLE);
    });
    const tree = render(<GespeichertScreen />);
    expect(renderedText(tree)).toContain(ARTICLE.title);

    press(tree, `${ARTICLE.title} entfernen`);

    expect(coreStore.getState().savedArticles.items).toEqual([]);
  });
});

describe('settings', () => {
  it('switches theme between system, light and dark', () => {
    const tree = render(<EinstellungenScreen />);
    const toggle = (label: string, value: boolean) => {
      // The first match: the text-size row below carries the same words (ADR 0033).
      const [row] = tree.root.findAll(
        (n) => n.props?.accessibilityLabel === label && !!n.props?.onValueChange,
      );
      act(() => {
        row.props.onValueChange(value);
      });
    };

    toggle('An Systemeinstellung orientieren', false);
    expect(coreStore.getState().settings.theme).toBe('light');
    // The dark switch only exists once the system option is off.
    toggle('Dunkelmodus', true);
    expect(coreStore.getState().settings.theme).toBe('dark');
  });

  it('follows the system text size until a size is chosen, and then replaces it', () => {
    const tree = render(<EinstellungenScreen />);
    const switches = () =>
      tree.root.findAll(
        (n) =>
          n.props?.accessibilityLabel === 'An Systemeinstellung orientieren' &&
          !!n.props?.onValueChange,
      );
    // Two rows with the appearance row's words, one per setting (ADR 0033).
    expect(switches()).toHaveLength(2);
    expect(coreStore.getState().settings.textSize).toBe('system');
    expect(renderedText(tree)).toContain('auch in Artikeln');
    // The steps only exist once the system option is off, as the dark switch does.
    expect(tree.root.findAll((n) => n.props?.accessibilityLabel === 'Textgröße A++')).toEqual([]);

    act(() => {
      switches()[1].props.onValueChange(false);
    });
    // React Native's jest preset reports a font scale of 2, so the choice starts at
    // the step nearest it, which is the largest, rather than at the default.
    expect(coreStore.getState().settings.textSize).toBe(1.15);

    press(tree, 'Textgröße A');
    expect(coreStore.getState().settings.textSize).toBe(0.9);
    expect(coreStore.getState().settings.theme).toBe('system');

    act(() => {
      switches()[1].props.onValueChange(true);
    });
    expect(coreStore.getState().settings.textSize).toBe('system');
  });

  it('resets the demo state across the stores that hold it', () => {
    act(() => {
      coreActions.interests.toggle('klima');
      coreActions.settings.completeOnboarding();
      coreActions.settings.setPushOptIn(true);
    });

    const tree = render(<EinstellungenScreen />);
    press(tree, 'Demo-Zustand zurücksetzen');

    expect(coreStore.getState().interests.selected).toEqual([]);
    expect(coreStore.getState().settings).toMatchObject({
      onboardingDone: false,
      pushOptIn: false,
      textSize: 'system',
    });
    expect(renderedText(tree)).toContain('✓ Zurückgesetzt');
  });
});
