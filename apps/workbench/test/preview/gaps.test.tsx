/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';

import type { HomeLayout } from '@correctiv/app-core/lib/home-layout';
import type { LocalisedText } from '@correctiv/app-core/lib/home-settings';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE, type Language } from '../../src/i18n/language';
import { GapsNote } from '../../src/preview/home/DocumentNotes';
import { SHIPPED } from '../../src/preview/home/document';
import { gapsOf } from '../../src/preview/home/gaps';
import { blankScreen, shippedOf } from '../../src/preview/home/screens';
import { de } from '../../src/i18n/catalogue/de';

/**
 * A missing translation, counted over the screen (ADR 0075 §2).
 *
 * The field marks its own gap while its block is open; this is what makes a gap in a block
 * nobody has opened visible from the screen. What is held: only a word the document
 * carries is counted, a custom screen's own title is, and a shipped screen's is not.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const withIntro = (words: LocalisedText): HomeLayout => {
  const layout = shippedOf('mitmachen');
  const section = layout.sections.find((one) => 'intro' in (one.settings ?? {}));
  if (!section) throw new Error('fixture: mitmachen has no section with an intro');
  return {
    ...layout,
    sections: layout.sections.map((one) =>
      one === section ? { ...one, settings: { ...one.settings, intro: words } } : one,
    ),
  };
};

function drawn(gaps: ReturnType<typeof gapsOf>, language: Language = SOURCE_LANGUAGE): string {
  const container = document.body.appendChild(document.createElement('div'));
  act(() => {
    createRoot(container).render(
      <Localisation language={language}>
        <GapsNote gaps={gaps} />
      </Localisation>,
    );
  });
  return container.textContent ?? '';
}

describe('gapsOf', () => {
  it('finds nothing in a document that says no words of its own', () => {
    expect(gapsOf(SHIPPED, false)).toEqual([]);
  });

  it('counts a word that lacks a language, and one that holds both is whole', () => {
    expect(gapsOf(withIntro({ de: 'Hallo' }), false)).toEqual([{ language: 'en', texts: 1 }]);
    expect(gapsOf(withIntro({ de: 'Hallo', en: 'Hello' }), false)).toEqual([]);
  });

  it('treats a blank word as missing, as the app does', () => {
    expect(gapsOf(withIntro({ de: 'Hallo', en: '   ' }), false)).toEqual([
      { language: 'en', texts: 1 },
    ]);
  });

  it('counts the title of a custom screen and not that of a shipped one', () => {
    const custom = blankScreen('Kampagne');
    expect(gapsOf(custom, true)).toEqual([{ language: 'en', texts: 1 }]);
    expect(gapsOf(custom, false)).toEqual([]);
  });
});

describe('the mark', () => {
  it('draws nothing for a whole screen', () => {
    expect(drawn([])).toBe('');
  });

  it('names the language and how many texts lack it', () => {
    expect(drawn([{ language: 'en', texts: 2 }])).toBe(
      'English is missing in 2 texts on this screen.',
    );
    expect(drawn([{ language: 'en', texts: 1 }])).toContain('in 1 text on');
  });

  it('is German in German', () => {
    expect(de['home.document.gap']).toContain('{language} fehlt');
    expect(drawn([{ language: 'en', texts: 3 }], 'de')).toContain('fehlt in 3 Texten');
  });
});
