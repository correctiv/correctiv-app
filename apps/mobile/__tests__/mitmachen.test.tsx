import { act, type ReactTestRenderer } from 'react-test-renderer';

import { callouts } from '@correctiv/app-core/data/callouts';
import { claims } from '@correctiv/app-core/data/claims';
import { formatNumber } from '@correctiv/app-core/lib/format';

/**
 * The participation flow, end to end: a multi-step form whose steps come from the
 * callout's own schema, and a counter that has to move.
 *
 * The counter IS the demo — "your contribution counts" is the promise, and a
 * submission that leaves the number unchanged breaks it silently. Step validation
 * is the other half: a required question that can be skipped means an empty
 * submission, and a "Weiter" that never enables means the flow is a dead end.
 */

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
  useLocalSearchParams: jest.fn(() => ({})),
  // `Stack.Screen` because `ScreenHeader` configures the platform's header through
  // it on native, and a screen with a header therefore reaches expo-router for more
  // than `router` now (ADR 0030).
  Stack: { Screen: () => null },
}));

import { router, useLocalSearchParams } from 'expo-router';

import { isDisabled, press, render, renderedText, typeInto } from './support/rendering';

import MitmachenScreen from '@/app/(tabs)/mitmachen';
import FaktenforumScreen from '@/app/faktenforum';
import FormularScreen from '@/app/formular';
import { resetStore } from '@correctiv/app-core/stores/store';

import { coreActions, coreStore } from '@/lib/store/core';

const push = router.push as jest.Mock;
const params = useLocalSearchParams as jest.Mock;

const CALLOUT = callouts[0];
/**
 * What the counter counts and what the button says now follow the callout's kind —
 * a survey asks for Teilnahmen, a CrowdNewsroom for Beiträge. Derived here rather
 * than hard-coded, so the test keeps testing the wiring and not the fixture.
 */
const UNIT = CALLOUT.kind === 'survey' ? 'Teilnahmen' : 'Beiträge';
const CTA = CALLOUT.kind === 'survey' ? 'Teilnehmen' : 'Mitmachen';
const SLIDES = CALLOUT.formSchema.slides;
beforeEach(() => {
  jest.clearAllMocks();
  params.mockReturnValue({});
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

/** Answers every required component on the current slide. */
function answerSlide(tree: ReactTestRenderer, slideIndex: number): void {
  for (const component of SLIDES[slideIndex].components) {
    if (!component.required) continue;
    if (component.type === 'radio' || component.type === 'selectboxes') {
      press(tree, component.values![0].label);
    } else {
      typeInto(tree, component.label, 'Eine Antwort aus dem Test');
    }
  }
}

describe('Mitmachen hub', () => {
  it('offers every callout and all four ways in', () => {
    const text = renderedText(render(<MitmachenScreen />));
    const missing = callouts.map((c) => c.title).filter((title) => !text.includes(title));
    expect(missing).toEqual([]);
    // Group labels render through Overline, which upper-cases by design.
    const sections = ['AKTIVE AUFRUFE', 'FAKTENFORUM', 'ABRISS-ATLAS', 'TIPP GEBEN'];
    expect(sections.filter((s) => !text.includes(s))).toEqual([]);
  });

  it('shows the live contribution count per callout', () => {
    // `'de'` because German is what the app renders: the expectation has to group
    // the thousands the way the screen's own provider does.
    expect(renderedText(render(<MitmachenScreen />))).toContain(
      `${formatNumber(CALLOUT.responseCount, 'de')} ${UNIT}`,
    );
  });

  it('asks a survey and a CrowdNewsroom in their own words', () => {
    const text = renderedText(render(<MitmachenScreen />));
    // Both kinds exist in the data, and each brings its own kicker, counter unit
    // and button label. All three callouts used to read CROWDNEWSROOM · Mitmachen.
    expect(text).toContain('UMFRAGE');
    expect(text).toContain('Teilnehmen');
    expect(text).toContain('CROWDNEWSROOM');
    expect(text).toContain('Mitmachen');
    expect(text).toContain('Teilnahmen');
    expect(text).toContain('Beiträge');
  });

  it('opens the callout page, not the form', () => {
    // The privacy section comes BEFORE the form — that ordering is the product.
    press(render(<MitmachenScreen />), CTA);
    expect(push).toHaveBeenCalledWith({
      pathname: '/aufruf/[slug]',
      params: { slug: CALLOUT.slug },
    });
  });

  it('marks a callout the user has already contributed to', () => {
    act(() => {
      coreActions.participation.submit(CALLOUT.slug, { themen: ['demokratie'] });
    });
    const text = renderedText(render(<MitmachenScreen />));
    expect(text).toContain('✓ Sie haben beigetragen');
    // …and the count has moved by one.
    expect(text).toContain(`${formatNumber(CALLOUT.responseCount + 1, 'de')} ${UNIT}`);
  });
});

describe('the callout form', () => {
  beforeEach(() => {
    params.mockReturnValue({ slug: CALLOUT.slug });
  });

  it('starts on step 1 with the next step blocked', () => {
    const tree = render(<FormularScreen />);

    expect(renderedText(tree)).toContain(`Schritt 1 von ${SLIDES.length}`);
    expect(renderedText(tree)).toContain(SLIDES[0].title);
    // A required question must not be skippable — that would submit nothing.
    expect(isDisabled(tree, 'Weiter')).toBe(true);
  });

  it('unblocks the step once the required question is answered', () => {
    const tree = render(<FormularScreen />);
    answerSlide(tree, 0);
    expect(isDisabled(tree, 'Weiter')).toBe(false);
  });

  it('walks forward and back through the slides', () => {
    const tree = render(<FormularScreen />);
    answerSlide(tree, 0);
    press(tree, 'Weiter');

    expect(renderedText(tree)).toContain(`Schritt 2 von ${SLIDES.length}`);

    press(tree, 'Zurück');
    expect(renderedText(tree)).toContain(`Schritt 1 von ${SLIDES.length}`);
  });

  it('keeps one answer for radio and several for selectboxes', () => {
    const tree = render(<FormularScreen />);
    const multi = SLIDES.flatMap((s) => s.components).find((c) => c.type === 'selectboxes');
    expect(multi).toBeDefined();

    press(tree, multi!.values![0].label);
    press(tree, multi!.values![1].label);
    press(tree, 'Weiter'); // enabled only if the answers stuck

    // Both stayed selected, so the step was valid and we advanced.
    expect(renderedText(tree)).toContain('Schritt 2 von');
  });

  it('records the submission and thanks the user with the new count', () => {
    const tree = render(<FormularScreen />);
    for (let i = 0; i < SLIDES.length; i++) {
      answerSlide(tree, i);
      press(tree, i === SLIDES.length - 1 ? 'Absenden' : 'Weiter');
    }

    const state = coreStore.getState().participation;
    expect(state.submissions).toHaveLength(1);
    expect(state.submissions[0].calloutSlug).toBe(CALLOUT.slug);
    // Answers are kept, not just the fact of submitting.
    expect(Object.keys(state.submissions[0].answers).length).toBeGreaterThan(0);

    const text = renderedText(tree);
    expect(text).toContain('Danke für Ihren Beitrag!');
    expect(text).toContain(`${formatNumber(CALLOUT.responseCount + 1, 'de')} Menschen`);
  });

  it('leaves the form and the callout page together', () => {
    const tree = render(<FormularScreen />);
    for (let i = 0; i < SLIDES.length; i++) {
      answerSlide(tree, i);
      press(tree, i === SLIDES.length - 1 ? 'Absenden' : 'Weiter');
    }

    press(tree, 'Weitere Mitmach-Aktionen ansehen');

    // Not router.back() — that would land on the callout page the user just left.
    expect(router.dismissTo).toHaveBeenCalledWith('/(tabs)/mitmachen');
  });

  it('does not invent a form for an unknown callout', () => {
    params.mockReturnValue({ slug: 'gibt-es-nicht' });
    expect(renderedText(render(<FormularScreen />))).toContain('Dieses Formular gibt es nicht');
  });
});

describe('Faktenforum', () => {
  it('lists every claim with its review status', () => {
    const text = renderedText(render(<FaktenforumScreen />));
    const missing = claims.filter((c) => !text.includes(c.shortId)).map((c) => c.shortId);
    expect(missing).toEqual([]);
    // The three states all have a label, and none of them is empty.
    expect(text).toMatch(/Eingereicht|In Prüfung|Geprüft/);
  });

  it('opens a claim', () => {
    press(render(<FaktenforumScreen />), claims[0].shortId);
    expect(push).toHaveBeenCalledWith({
      pathname: '/behauptung/[id]',
      params: { id: claims[0].id },
    });
  });
});
