import { act } from 'react-test-renderer';

import { diaries, earlyAccess } from '@correctiv/app-core/data/backstage';

/**
 * Onboarding and Backstage, the two places a screen once addressed someone who had
 * not paid. Onboarding decides whether it asks again; Backstage opens everything to
 * whoever is inside.
 *
 * Onboarding is also where a dark pattern would be easiest to introduce, so the tests
 * assert the one escape hatch that is left: skipping still counts as done. "Erstmal
 * umsehen" went with ADR 0018, and the join flow this file used to cover with ADR 0020.
 */

// `Stack.Screen` because `ScreenHeader` configures the platform's header through
// it on native, and a screen with a header therefore reaches expo-router for more
// than `router` now (ADR 0030).
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => false) },
  useLocalSearchParams: jest.fn(() => ({})),
  Stack: { Screen: () => null },
}));
jest.mock('@/lib/openArticle', () => ({ openArticle: jest.fn() }));

import { router } from 'expo-router';
import { BackHandler, type HardwareBackPressEvent } from 'react-native';

import { press, render, renderedText } from './support/rendering';

import BackstageScreen from '@/app/backstage';
import OnboardingScreen from '@/app/onboarding';
import { resetStore } from '@correctiv/app-core/stores/store';

import { coreStore } from '@/lib/store/core';

const push = router.push as jest.Mock;
const replace = router.replace as jest.Mock;
const canGoBack = router.canGoBack as jest.Mock;

/**
 * Android's back, as `useSystemBack` receives it: the listeners registered on
 * `BackHandler`, last registered first, until one of them returns true. Whether the
 * navigator would then pop or the app would close is outside a render, so a result
 * of `false` is what "the navigator answers" means here.
 */
let backListeners: ((event: HardwareBackPressEvent) => boolean | null | undefined)[] = [];
function systemBack(): boolean {
  let handled = false;
  act(() => {
    const event = { type: 'hardwareBackPress', timeStamp: Date.now() };
    handled = backListeners.toReversed().some((listener) => listener(event) === true);
  });
  return handled;
}

beforeEach(() => {
  jest.clearAllMocks();
  backListeners = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, listener) => {
    backListeners.push(listener);
    return { remove: () => (backListeners = backListeners.filter((l) => l !== listener)) };
  });
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

describe('onboarding', () => {
  it('opens on the mission screen with no skip', () => {
    const text = renderedText(render(<OnboardingScreen />));
    expect(text).toContain('Recherchen für die Gesellschaft');
    expect(text).not.toContain('Überspringen');
    // "Ohne Paywall: Journalismus für alle" stood here until ADR 0018.
    expect(text).not.toContain('Paywall');
  });

  it('records interests', () => {
    const tree = render(<OnboardingScreen />);
    press(tree, 'Los geht’s');

    press(tree, 'Klima');
    press(tree, 'Lokal');

    expect(coreStore.getState().interests.selected).toEqual(['klima', 'lokal']);
  });

  it('counts a skip as done, so it never asks twice', () => {
    const tree = render(<OnboardingScreen />);
    press(tree, 'Los geht’s');
    press(tree, 'Überspringen');

    expect(coreStore.getState().settings.onboardingDone).toBe(true);
    expect(replace).toHaveBeenCalledWith('/(tabs)');
    expect(push).not.toHaveBeenCalled();
  });

  /**
   * The last step used to be the club pitch, with "Unterstützer:in werden" beside
   * "Erstmal umsehen". Behind the door (ADR 0016) both address someone who is not
   * here, so the step went with ADR 0018 and the walk ends one screen earlier.
   */
  it('ends after the participate step, with nothing left to buy', () => {
    const tree = render(<OnboardingScreen />);
    press(tree, 'Los geht’s');
    press(tree, 'Weiter');

    const text = renderedText(tree);
    expect(text).not.toContain('Unterstützer:in werden');
    expect(text).not.toContain('Erstmal umsehen');

    press(tree, 'Fertig');
    expect(coreStore.getState().settings.onboardingDone).toBe(true);
  });
});

/**
 * Issue #120. The three pages are one screen, so the navigator cannot step through
 * them: before this, back from the second page dropped the whole flow, and on a first
 * launch, where the onboarding was reached with `replace` and nothing is under it,
 * back from any page closed the app.
 */
describe('onboarding and Android back', () => {
  it('steps back a page instead of leaving the flow', () => {
    const tree = render(<OnboardingScreen />);
    press(tree, 'Los geht’s');
    press(tree, 'Weiter');
    expect(renderedText(tree)).toContain('Fertig');

    expect(systemBack()).toBe(true);
    expect(renderedText(tree)).toContain('Weiter');
    expect(systemBack()).toBe(true);
    expect(renderedText(tree)).toContain('Recherchen für die Gesellschaft');
    expect(replace).not.toHaveBeenCalled();
  });

  it('on a first launch, backs out of the first page the way the skip does', () => {
    canGoBack.mockReturnValue(false);
    render(<OnboardingScreen />);

    expect(systemBack()).toBe(true);
    expect(coreStore.getState().settings.onboardingDone).toBe(true);
    expect(replace).toHaveBeenCalledWith('/(tabs)');
  });

  /*
   * `useSystemBack` removes its listener on unmount. Without that, an onboarding
   * that has gone would still answer back from under Home, and a second one would
   * register beside the first: two answers to one press.
   */
  it('stops answering back once it has unmounted, and a remount answers once', () => {
    canGoBack.mockReturnValue(false);
    const first = render(<OnboardingScreen />);
    act(() => first.unmount());
    expect(backListeners).toHaveLength(0);
    expect(systemBack()).toBe(false);
    expect(replace).not.toHaveBeenCalled();

    const second = render(<OnboardingScreen />);
    press(second, 'Los geht’s');
    expect(backListeners).toHaveLength(1);
    expect(systemBack()).toBe(true);
    expect(renderedText(second)).toContain('Recherchen für die Gesellschaft');
  });

  it('opened over the app, leaves the first page to the navigator', () => {
    canGoBack.mockReturnValue(true);
    render(<OnboardingScreen />);

    expect(systemBack()).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('Backstage', () => {
  /**
   * Nothing here is locked, and that has not changed. What went with ADR 0018 is the
   * guest's copy: the teaser line and the "Mit dem Club jetzt lesen" button that
   * routed to the join flow instead of the article.
   */
  it('shows everything and opens the article directly', () => {
    const tree = render(<BackstageScreen />);
    const text = renderedText(tree);
    expect(text).toContain(earlyAccess.title);
    expect(text).toContain(diaries[0].title);
    expect(text).not.toContain('Mit dem Club jetzt lesen');
    expect(text).not.toContain('es ist eine Einladung');

    press(tree, 'Jetzt lesen');
    expect(push).not.toHaveBeenCalled(); // openArticle is mocked, not a route push
  });

  it('opens a diary entry', () => {
    press(render(<BackstageScreen />), diaries[0].title);
    expect(push).toHaveBeenCalledWith({
      pathname: '/tagebuch/[id]',
      params: { id: diaries[0].id },
    });
  });
});
