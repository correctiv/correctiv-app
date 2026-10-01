/**
 * The one thing on screen saying a draft is showing, and the two keys it watches.
 *
 * A cold review of #259 and #261 found nothing on screen while `workbench:strings`
 * or `workbench:home-layout` held an edit, indistinguishable from the shipped app to
 * a screenshot or to `/app` opened raw. `lib/draftMarker.tsx` is the answer, and this
 * is its test: it installs a `localStorage` on `window` the way
 * `preview-strings.test.tsx` and `home-layout-source.test.tsx` do and for their
 * reason — the React Native test environment has none, and both keys are read from
 * one — and asks the same three questions of each key: silent while the key is
 * absent or equal to what ships, present and saying so once it is not, and silent
 * again once the key is gone.
 */

/** `lib/home/layout.ts` pulls in `lib/home/modules.tsx`, which imports the router. */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

import { act } from 'react-test-renderer';

import { CATALOGUES } from '@correctiv/catalogue';
import { resetStore } from '@correctiv/app-core/stores/store';

import { DraftMarker } from '@/lib/draftMarker';
import { HOME_LAYOUT_OVERRIDE_KEY } from '@/lib/home/layout';
import { PREVIEW_STRINGS_KEY } from '@/lib/strings';
import { coreStore } from '@/lib/store/core';

import { render, renderedText } from './support/rendering';

const DE = CATALOGUES.de;
const key = (value: unknown) => JSON.stringify(value);

const storage = new Map<string, string>();

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (name: string) => storage.get(name) ?? null,
      setItem: (name: string, value: string) => void storage.set(name, value),
      removeItem: (name: string) => void storage.delete(name),
    },
  });
});

afterAll(() => {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: undefined });
});

beforeEach(() => {
  storage.clear();
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

// The German, because `coreStore` ships at `SHIPPED_LOCALE` ('de') and none of these
// tests overrides it — the same reason `preview-strings.test.tsx` reads `CATALOGUES.de`.
const MARK = DE['ui.previewDraft'];

describe('while neither key holds anything the reader would not otherwise see', () => {
  it('renders nothing with no key at all', () => {
    const tree = render(<DraftMarker />);
    expect(renderedText(tree)).not.toContain(MARK);
  });

  it('renders nothing for a string draft equal to the catalogue', () => {
    storage.set(PREVIEW_STRINGS_KEY, key({ de: { 'home.viewAll': DE['home.viewAll'] } }));
    const tree = render(<DraftMarker />);
    expect(renderedText(tree)).not.toContain(MARK);
  });

  it('renders nothing for junk in either key', () => {
    storage.set(PREVIEW_STRINGS_KEY, 'not json');
    storage.set(HOME_LAYOUT_OVERRIDE_KEY, 'not json either');
    const tree = render(<DraftMarker />);
    expect(renderedText(tree)).not.toContain(MARK);
  });
});

describe('a reworded string (ADR 0056 §7)', () => {
  it('shows the marker once the key rewords an id away from the catalogue', () => {
    storage.set(PREVIEW_STRINGS_KEY, key({ de: { 'home.viewAll': 'Alle zeigen' } }));
    const tree = render(<DraftMarker />);
    expect(renderedText(tree)).toContain(MARK);
  });
});

describe('an edited home document (ADR 0036 §4, ADR 0045)', () => {
  it('shows the marker while the workbench holds a document of its own', () => {
    storage.set(
      HOME_LAYOUT_OVERRIDE_KEY,
      JSON.stringify({ version: 3, sections: [], moments: [], editions: [] }),
    );
    const tree = render(<DraftMarker />);
    expect(renderedText(tree)).toContain(MARK);
  });
});

describe('discarding either draft', () => {
  it('takes the marker away once the string draft is gone', () => {
    storage.set(PREVIEW_STRINGS_KEY, key({ de: { 'home.viewAll': 'Alle zeigen' } }));
    const tree = render(<DraftMarker />);
    expect(renderedText(tree)).toContain(MARK);

    // The workbench's own discard: `write.ts`/`draft.ts` remove the key rather than
    // leave an equal copy, which is what a person pressing "Alle verwerfen" produces.
    storage.delete(PREVIEW_STRINGS_KEY);
    const after = render(<DraftMarker />);
    expect(renderedText(after)).not.toContain(MARK);
  });

  it('takes the marker away once the layout draft is gone', () => {
    storage.set(
      HOME_LAYOUT_OVERRIDE_KEY,
      JSON.stringify({ version: 3, sections: [], moments: [], editions: [] }),
    );
    const tree = render(<DraftMarker />);
    expect(renderedText(tree)).toContain(MARK);

    storage.delete(HOME_LAYOUT_OVERRIDE_KEY);
    const after = render(<DraftMarker />);
    expect(renderedText(after)).not.toContain(MARK);
  });
});
