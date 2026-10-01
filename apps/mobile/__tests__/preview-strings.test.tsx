import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useIntl } from 'react-intl';
import { Provider } from 'react-redux';

import { CATALOGUES } from '@correctiv/catalogue';
import { createAppStore } from '@correctiv/app-core/stores/store';

import { Localisation } from '@/i18n/Localisation';
import { PREVIEW_STRINGS_KEY, withPreviewStrings } from '@/lib/strings';

/**
 * The one key that can change what the app says, and the limit on it.
 *
 * [ADR 0056](../../../adr/0056-a-string-is-picked-where-it-renders.md) §7: the
 * workbench may reword a string the catalogue already carries and may not extend the
 * vocabulary. That limit is the app's to hold, because the writer is a page on a
 * public URL and `localStorage` is anybody's to type into, so every refusal is asserted
 * here rather than in the workbench.
 *
 * The second half renders the real provider over a stubbed storage and dispatches the
 * `storage` event by hand, the way `home-simulated-clock.test.tsx` does for the clock:
 * the React Native environment has a `window` with neither a storage nor an event
 * target on it, and the subscription is guarded, so a test without these stubs would
 * silently be testing the no-op.
 */

const DE = CATALOGUES.de;
const key = (value: unknown) => JSON.stringify(value);

describe('the wordings the workbench may put on screen', () => {
  it('is spelled under the prefix that says who changed the screen', () => {
    expect(PREVIEW_STRINGS_KEY).toBe('workbench:strings');
  });

  it('rewords an id the shipped catalogue carries', () => {
    const merged = withPreviewStrings(key({ de: { 'home.viewAll': 'Alle zeigen' } }), 'de', DE);
    expect(merged['home.viewAll']).toBe('Alle zeigen');
    expect(merged['home.factChecks']).toBe(DE['home.factChecks']);
  });

  it('ignores an id the catalogue does not carry, so no new string can appear', () => {
    const merged = withPreviewStrings(key({ de: { 'home.invented': 'Neu' } }), 'de', DE);
    expect(merged).toBe(DE);
    expect('home.invented' in merged).toBe(false);
  });

  it('ignores an inherited name, which is not an id the catalogue carries', () => {
    const merged = withPreviewStrings(key({ de: { toString: 'x', constructor: 'y' } }), 'de', DE);
    expect(merged).toBe(DE);
  });

  it('ignores anything that is not a string', () => {
    const text = key({ de: { 'home.viewAll': 3, 'home.factChecks': null, 'home.allIssues': {} } });
    expect(withPreviewStrings(text, 'de', DE)).toBe(DE);
  });

  it('applies only the wordings for the language being rendered', () => {
    const text = key({ de: { 'home.viewAll': 'Alle zeigen' } });
    expect(withPreviewStrings(text, 'en', CATALOGUES.en)).toBe(CATALOGUES.en);
  });

  it('reads junk as nobody asking', () => {
    for (const junk of [null, '', 'not json', '[]', '"de"', key({ de: [] }), key({ de: 'x' })]) {
      expect(withPreviewStrings(junk, 'de', DE)).toBe(DE);
    }
  });

  it('hands back the shipped object when nothing differs, so the provider re-renders nothing', () => {
    const same = withPreviewStrings(key({ de: { 'home.viewAll': DE['home.viewAll'] } }), 'de', DE);
    expect(same).toBe(DE);
  });

  it('never writes into the shipped catalogue', () => {
    const before = DE['home.viewAll'];
    withPreviewStrings(key({ de: { 'home.viewAll': 'Alle zeigen' } }), 'de', DE);
    expect(DE['home.viewAll']).toBe(before);
  });
});

describe('the provider, reading the key and following it', () => {
  const store = new Map<string, string>();
  const listeners = new Set<(event: { key: string | null }) => void>();

  beforeAll(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (name: string) => store.get(name) ?? null,
        setItem: (name: string, value: string) => void store.set(name, value),
        removeItem: (name: string) => void store.delete(name),
      },
    });
    Object.defineProperty(window, 'addEventListener', {
      configurable: true,
      value: (type: string, listener: (event: { key: string | null }) => void) => {
        if (type === 'storage') listeners.add(listener);
      },
    });
    Object.defineProperty(window, 'removeEventListener', {
      configurable: true,
      value: (type: string, listener: (event: { key: string | null }) => void) => {
        if (type === 'storage') listeners.delete(listener);
      },
    });
  });

  afterAll(() => {
    for (const name of ['localStorage', 'addEventListener', 'removeEventListener']) {
      Object.defineProperty(window, name, { configurable: true, value: undefined });
    }
  });

  beforeEach(() => {
    store.clear();
    listeners.clear();
  });

  /** What the app renders for `home.viewAll`, through the real provider. */
  function mount(): { said: () => string; tree: ReactTestRenderer } {
    let said = '';
    function Says() {
      said = useIntl().formatMessage({ id: 'home.viewAll', defaultMessage: 'View all' });
      return null;
    }
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <Provider store={createAppStore({ locale: 'de' })}>
          <Localisation>
            <Says />
          </Localisation>
        </Provider>,
      );
    });
    return { said: () => said, tree };
  }

  /** What a write from another same-origin document looks like to this one. */
  function write(name: string, value: string): void {
    store.set(name, value);
    act(() => {
      for (const listener of listeners) listener({ key: name });
    });
  }

  it('renders the wording the key already holds when the app mounts', () => {
    store.set(PREVIEW_STRINGS_KEY, key({ de: { 'home.viewAll': 'Alle zeigen' } }));
    const { said, tree } = mount();
    expect(said()).toBe('Alle zeigen');
    act(() => tree.unmount());
  });

  it('redraws when the workbench writes the key, with no reload', () => {
    const { said, tree } = mount();
    expect(said()).toBe(DE['home.viewAll']);
    write(PREVIEW_STRINGS_KEY, key({ de: { 'home.viewAll': 'Alle zeigen' } }));
    expect(said()).toBe('Alle zeigen');
    act(() => tree.unmount());
  });

  it('reads its own key and no other', () => {
    const { said, tree } = mount();
    write('workbench:other', key({ de: { 'home.viewAll': 'Falsch' } }));
    expect(said()).toBe(DE['home.viewAll']);
    act(() => tree.unmount());
  });

  it('stops listening when the app goes away', () => {
    const { tree } = mount();
    expect(listeners.size).toBeGreaterThan(0);
    act(() => tree.unmount());
    expect(listeners.size).toBe(0);
  });
});
