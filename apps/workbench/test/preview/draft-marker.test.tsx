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
import { setLayout } from '../../src/preview/home/store';
import { publishDraft } from '../../src/preview/strings/draft';
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

let container: HTMLDivElement;
let root: Root;

function mount(): void {
  container = document.body.appendChild(document.createElement('div'));
  act(() => {
    root = createRoot(container);
    root.render(
      <Localisation language={SOURCE_LANGUAGE}>
        <DraftMarker />
      </Localisation>,
    );
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
    mount();
    expect(container.textContent).toBe('');
  });
});

describe('a string draft (§7 of ADR 0056)', () => {
  it('names how many texts are edited, singular for one', () => {
    mount();
    act(() => publishDraft({ 'home.viewAll': 'Alle zeigen' }));

    expect(container.textContent).toContain('Draft active');
    expect(container.textContent).toContain('1 text changed');
  });

  it('counts more than one, plural', () => {
    mount();
    act(() => publishDraft({ 'home.viewAll': 'Alle zeigen', 'home.factChecks': 'Fakten-Checks' }));

    expect(container.textContent).toContain('2 texts changed');
  });

  it('does not count a wording equal to the catalogue, which the tool never publishes', () => {
    mount();
    // The shipped German for home.viewAll, unchanged: `publishDraft` would not send
    // this in practice (StringsTool.tsx filters it out), but the marker's own count
    // reads storage and must not be fooled by a leftover key that says nothing.
    act(() => publishDraft({ 'home.viewAll': 'Alle ansehen' }));

    expect(container.textContent).toBe('');
  });
});

describe('the home layout (ADR 0036 §4, ADR 0045)', () => {
  const edited: HomeLayout = { ...SHIPPED, sections: [] };

  it('says the screen layout changed once the document differs from the shipped file', () => {
    mount();
    act(() => setLayout(edited));

    expect(container.textContent).toContain('Draft active');
    expect(container.textContent).toContain('screen layout changed');
  });
});

describe('both at once', () => {
  it('names each draft', () => {
    mount();
    act(() => {
      publishDraft({ 'home.viewAll': 'Alle zeigen' });
      setLayout({ ...SHIPPED, sections: [] });
    });

    expect(container.textContent).toContain('1 text changed');
    expect(container.textContent).toContain('screen layout changed');
  });
});
