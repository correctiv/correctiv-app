/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { HomeLayout } from '@correctiv/app-core/lib/home-layout';

/**
 * A handful of made-up rows, not the generated table `virtual:strings` otherwise
 * reads off disk.
 *
 * `DraftMarker.tsx` reads that module to know the shipped German for the ids a
 * string draft might rework, the same way `StringsTool.tsx` does. The real table is
 * `apps/workbench/content/strings.generated.json`, written by `npm run strings` and
 * not committed — CI does not run that generator before this suite, so importing the
 * component for real would fail on a fresh checkout with "…strings.generated.json is
 * missing" (`plugin/index.ts`'s `load()`), which is a fact about a build artifact and
 * not about the marker. `test/strings.test.ts` takes the same way out for
 * `strings-model.ts`'s own pure functions, with fixtures instead of the real table;
 * this is the same fixture shape, mocked at the one seam that reads it, because the
 * component itself imports the module directly rather than taking rows as a
 * parameter.
 */
vi.mock('virtual:strings', () => ({
  default: {
    locales: ['de', 'en'],
    strings: [
      {
        id: 'home.viewAll',
        surface: 'app',
        namespace: 'home',
        english: 'See all',
        description: null,
        file: 'apps/mobile/src/lib/home/modules.tsx',
        line: 56,
        translations: { de: 'Alle ansehen', en: 'See all' },
      },
      {
        id: 'home.factChecks',
        surface: 'app',
        namespace: 'home',
        english: 'Fact checks',
        description: null,
        file: 'apps/mobile/src/lib/home/modules.tsx',
        line: 56,
        translations: { de: 'Faktenchecks', en: 'Fact checks' },
      },
    ],
  },
}));

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE } from '../../src/i18n/language';
import { SHIPPED } from '../../src/preview/home/document';
import type { ScenarioControl } from '../../src/preview/home/Scenario';
import type { Scenario } from '../../src/preview/scenarios';
import { getLayout, setLayout } from '../../src/preview/home/store';
import { publishDraft } from '../../src/preview/strings/draft';
import { PREVIEW_STRINGS_KEY } from '../../src/preview/strings/names';
import { DraftMarker } from '../../src/preview/ui/DraftMarker';

// React 19's `act` warns without this, in any environment it did not set up itself —
// jsdom here is vitest's doing, not React's. No other test in this suite renders a
// live tree and reacts to an event, so this is the first file that needs it.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * The cold review this marker answers (#259, #261): while `workbench:strings` or
 * `workbench:home-layout` holds a draft, nothing beside the frame said so, and a
 * screenshot of the frame could not be told from the shipped app. This is that
 * marker's own test, and it reads storage and `home/store.ts` the same way the
 * component does — through `publishDraft` and `setLayout`, never by poking the key
 * or the module state directly, so a test staying green proves the same thing the
 * component's own read does.
 */

/** Nobody has a scenario open in these tests; `close` is asserted on where it matters. */
function scenarioControl(overrides: Partial<ScenarioControl> = {}): ScenarioControl {
  return {
    open: null,
    asking: null,
    choose: () => {},
    replace: () => {},
    keep: () => {},
    close: () => {},
    ...overrides,
  };
}

let container: HTMLDivElement;
let root: Root;

function mount(scenario: ScenarioControl): void {
  container = document.body.appendChild(document.createElement('div'));
  act(() => {
    root = createRoot(container);
    root.render(
      <Localisation language={SOURCE_LANGUAGE}>
        <DraftMarker scenario={scenario} />
      </Localisation>,
    );
  });
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(label),
  );
  if (!found) throw new Error(`No button reading "${label}" among: ${container.textContent}`);
  return found;
}

function click(el: HTMLElement): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  window.localStorage.clear();
  setLayout(SHIPPED);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.localStorage.clear();
  setLayout(SHIPPED);
});

describe('while neither draft differs from what ships', () => {
  it('renders nothing at all', () => {
    mount(scenarioControl());
    expect(container.textContent).toBe('');
  });
});

describe('a string draft (§7 of ADR 0056)', () => {
  it('names how many texts are edited, singular for one', () => {
    mount(scenarioControl());
    act(() => publishDraft({ 'home.viewAll': 'Alle zeigen' }));

    expect(container.textContent).toContain('Draft active');
    expect(container.textContent).toContain('1 text changed');
  });

  it('counts more than one, plural', () => {
    mount(scenarioControl());
    act(() => publishDraft({ 'home.viewAll': 'Alle zeigen', 'home.factChecks': 'Fakten-Checks' }));

    expect(container.textContent).toContain('2 texts changed');
  });

  it('does not count a wording equal to the catalogue, which the tool never publishes', () => {
    mount(scenarioControl());
    // The shipped German for home.viewAll, unchanged: `publishDraft` would not send
    // this in practice (StringsTool.tsx filters it out), but the marker's own count
    // reads storage and must not be fooled by a leftover key that says nothing.
    act(() => publishDraft({ 'home.viewAll': 'Alle ansehen' }));

    expect(container.textContent).toBe('');
  });

  it('goes away once discarded, through the strings tool’s own action', () => {
    mount(scenarioControl());
    act(() => publishDraft({ 'home.viewAll': 'Alle zeigen' }));
    expect(container.textContent).toContain('Draft active');

    click(button('Discard texts'));

    expect(window.localStorage.getItem(PREVIEW_STRINGS_KEY)).toBeNull();
    expect(container.textContent).toBe('');
  });
});

describe('the home layout (ADR 0036 §4, ADR 0045)', () => {
  const edited: HomeLayout = { ...SHIPPED, sections: [] };

  it('says the home screen changed once the document differs from the shipped file', () => {
    mount(scenarioControl());
    act(() => setLayout(edited));

    expect(container.textContent).toContain('Draft active');
    expect(container.textContent).toContain('home screen changed');
  });

  it('goes away once discarded, through the home tool’s own action', () => {
    mount(scenarioControl());
    act(() => setLayout(edited));
    expect(container.textContent).toContain('home screen changed');

    click(button('Discard home screen'));

    expect(getLayout()).toBe(SHIPPED);
    expect(container.textContent).toBe('');
  });

  it('closes an open scenario the same way “Back to the file” does', () => {
    let closed = false;
    const open = { name: 'election-night' } as Scenario;
    mount(scenarioControl({ open, close: () => (closed = true) }));
    act(() => setLayout(edited));

    click(button('Discard home screen'));

    expect(closed).toBe(true);
  });
});

describe('both at once', () => {
  it('offers a discard for each, by its own name', () => {
    mount(scenarioControl());
    act(() => {
      publishDraft({ 'home.viewAll': 'Alle zeigen' });
      setLayout({ ...SHIPPED, sections: [] });
    });

    expect(container.textContent).toContain('1 text changed');
    expect(container.textContent).toContain('home screen changed');
    // Two distinct accessible names, not one button doing double duty.
    expect(() => button('Discard texts')).not.toThrow();
    expect(() => button('Discard home screen')).not.toThrow();
  });
});
