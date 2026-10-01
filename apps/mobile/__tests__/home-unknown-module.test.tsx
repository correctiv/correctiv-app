/**
 * A home document that names something this app cannot draw.
 *
 * It is the case ADR 0036 §7 is entirely about, and it is not hypothetical: the document
 * is fetched, the app on a phone is the slower of the two, so every time anything new
 * ships there is a version of this app reading a document that is ahead of it. What has
 * to survive that is the screen, and what has to come out of it is a report — a module
 * nobody recognises means a reader is looking at a place the newsroom believes it filled.
 *
 * A file of its own because the document is mocked for the whole module registry, and
 * `home-layout.test.tsx` next door is about the real one.
 */

/** Two places this app holds a renderer for, and one it has never heard of. */
jest.mock('@correctiv/app-core/data/home.layout.json', () => ({
  version: 4,
  sections: [
    { id: 'header', module: 'home-header' },
    { id: 'quiz', module: 'quiz-of-the-day' },
    { id: 'impact', module: 'impact-footer' },
  ],
  moments: [{ at: '11:00', changes: [{ id: 'quiz', hidden: true }] }],
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('@/lib/feeds/useFeed', () => ({
  useFeed: () => ({ data: null, loading: false, offline: false, reload: jest.fn() }),
}));

import {
  configurePlatform,
  createMemoryPlatform,
  resetPlatform,
  type ErrorReport,
} from '@correctiv/app-core';

import { render, walkHostNodes } from './support/rendering';

import HomeScreen from '@/app/(tabs)/index';
import { placeTestID } from '@/lib/home/modules';

const reports: ErrorReport[] = [];

beforeAll(() => {
  // Before the first render, which is where the document is read: a report made against
  // the core's default reporter goes nowhere, which is indistinguishable from silence.
  configurePlatform({
    ...createMemoryPlatform(),
    errors: { report: (report) => reports.push(report) },
  });
});

afterAll(() => {
  resetPlatform();
});

const PLACE_PREFIX = placeTestID('');

function places(tree: ReturnType<typeof render>): string[] {
  const ids: string[] = [];
  walkHostNodes(tree, {
    onEnter: (node) => {
      const testID = node.props.testID;
      if (typeof testID === 'string' && testID.startsWith(PLACE_PREFIX)) {
        ids.push(testID.slice(PLACE_PREFIX.length));
      }
    },
  });
  return ids;
}

describe('a module the app does not know', () => {
  it('is drawn past, and the places around it are still there', () => {
    expect(places(render(<HomeScreen />))).toEqual(['header', 'impact']);
  });

  /**
   * Once per document, not once per render. Home re-renders on every feed that lands, on
   * a pull to refresh and on a theme change; a report per render is a log nobody can
   * read and, once #95 puts a provider behind the port, a quota spent on one typo. Three
   * renders here, and the third is the one that would fail if the document were parsed in
   * the render path.
   */
  it('is reported exactly once, however often Home renders', () => {
    render(<HomeScreen />);
    render(<HomeScreen />);

    /*
     * Two problems from one document, and the second is the point of the moment above:
     * a change about a section the parser has already dropped changes nothing, and
     * changing nothing silently is how an edit is lost. So the unrecognised module is
     * reported, and so is the instruction that was about it.
     */
    expect(reports).toEqual([
      {
        domain: 'layout',
        code: 'module-unrecognised',
        context: { id: 'quiz', module: 'quiz-of-the-day' },
      },
      {
        domain: 'layout',
        code: 'change-id-unknown',
        context: { at: '11:00', id: 'quiz' },
      },
    ]);
  });
});
