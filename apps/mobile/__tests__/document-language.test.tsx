/**
 * @jest-environment jsdom
 */
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';

import { createAppStore } from '@correctiv/app-core/stores/store';
import type { Locale } from '@correctiv/app-core/stores/settings';

import { Localisation } from '@/i18n/Localisation';
import { isOwnDocument, OWN_DOCUMENT_MARK } from '@/lib/ownDocument';

/**
 * Which `<html lang>` the provider is allowed to write, which is only its own.
 *
 * `app/+html.tsx` writes the attribute at export time and `i18n/Localisation.tsx`
 * corrects it at runtime, because the shell renders before there is a store to
 * ask. The correction is an effect inside the provider, so it runs wherever the
 * provider is mounted — and the provider is mountable inside a page the app did
 * not produce, sharing that page's one document. Measured on 2026-09-18: a page
 * served in English, with the app's tree mounted inside it, read `lang="de"` a
 * render later, so a screen reader announced English prose in a German voice and
 * the browser hyphenated by German rules.
 *
 * Both halves are asserted here and the second is the one that was missing. The
 * first is not decoration: a guard is equally wrong when it never opens, and an
 * export whose language is never corrected is the defect that shipped once
 * already.
 *
 * jsdom explicitly, because the subject is a document and this app's suite runs
 * without one. A store per case rather than the singleton, because the locale is
 * construction state — `stores/settings.ts` has no action for it (ADR 0049 §4).
 */
function mountIn(locale: Locale): void {
  const store = createAppStore({ locale });
  act(() => {
    create(
      <Provider store={store}>
        <Localisation>{null}</Localisation>
      </Provider>,
    );
  });
}

/** A root element carrying whatever the shell spreads onto its `<html>`. */
function markDocument(): void {
  for (const [name, value] of Object.entries(OWN_DOCUMENT_MARK)) {
    document.documentElement.setAttribute(name, value);
  }
}

beforeEach(() => {
  for (const name of document.documentElement.getAttributeNames()) {
    document.documentElement.removeAttribute(name);
  }
});

describe('the language the app writes onto a document', () => {
  it('is written when the document is the one the app’s own shell wrote', () => {
    markDocument();
    mountIn('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('follows the language the store was built with', () => {
    markDocument();
    mountIn('de');
    expect(document.documentElement.lang).toBe('de');
  });

  it('is not written onto a document the app did not write', () => {
    // No mark, and a root element that already says what it is. The provider
    // renders, the app inside it is German, and this page stays English.
    document.documentElement.lang = 'en';
    mountIn('de');
    expect(document.documentElement.lang).toBe('en');
  });

  it('leaves an unmarked document entirely alone, rather than blanking it', () => {
    // The failure that would pass the case above by accident: writing `''`
    // instead of the locale is also "not German", and it is still a document
    // whose language has been taken away.
    document.documentElement.lang = 'fr';
    mountIn('de');
    expect(document.documentElement.getAttribute('lang')).toBe('fr');
  });

  it('recognises exactly the mark the shell spreads', () => {
    // Where the two halves meet. `__tests__/export-language.test.ts` asserts that
    // `+html.tsx` spreads `OWN_DOCUMENT_MARK`; this asserts that a document
    // carrying it is the one `isOwnDocument()` says yes to. Neither half means
    // anything without the other.
    expect(isOwnDocument()).toBe(false);
    markDocument();
    expect(isOwnDocument()).toBe(true);
  });
});
