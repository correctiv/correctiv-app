/**
 * @jest-environment jsdom
 */
import { act, create } from 'react-test-renderer';
import { useIntl } from 'react-intl';
import { Provider } from 'react-redux';

import { createAppStore } from '@correctiv/app-core/stores/store';
import type { Locale } from '@correctiv/app-core/stores/settings';
import { Localisation } from '@/i18n/Localisation';

/**
 * What tag the provider is given, which is not what this app calls a language.
 *
 * `lib/format.ts` maps a `Locale` onto a region through `intlLocale()`, because `'en'`
 * resolves to American date order inside `Intl` and `'en-GB'` does not. The provider has
 * to be handed the SAME tag, or an ICU `{x, date}` in a catalogue and a `formatDate`
 * call beside it print one day two ways.
 *
 * Nothing said so until this file. A cold review put `locale={locale}` back and ran the
 * whole app suite: 372 of 372 green, which is the definition of a binding nothing holds.
 *
 * `defaultLocale` is asserted for the same reason and one more. react-intl formats a
 * fallback `defaultMessage` with `defaultLocale` rather than with `locale`, and in this
 * repository every string is a `defaultMessage` first, so leaving that one bare would
 * have kept half the seam open. Two tags that disagree also raise `MISSING_TRANSLATION`
 * on a language whose fallback is already the right words, and `Localisation.tsx`'s
 * `onError` throws on that under `__DEV__`.
 *
 * A store per case rather than the singleton, because the locale is construction state:
 * `stores/settings.ts` has no action for it on purpose ([ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §4).
 */
function Tags({ report }: { report: (tags: { locale: string; default: string }) => void }) {
  const intl = useIntl();
  report({ locale: intl.locale, default: intl.defaultLocale });
  return null;
}

function tagsFor(locale: Locale): { locale: string; default: string } {
  const store = createAppStore({ locale });
  let seen = { locale: '', default: '' };
  act(() => {
    create(
      <Provider store={store}>
        <Localisation>
          <Tags report={(tags) => (seen = tags)} />
        </Localisation>
      </Provider>,
    );
  });
  return seen;
}

describe('the tag the provider is given', () => {
  it('is the region, for the language that ships', () => {
    expect(tagsFor('de').locale).toBe('de-DE');
  });

  it('is the region for English too', () => {
    expect(tagsFor('en').locale).toBe('en-GB');
  });

  it('is the same kind of tag on the fallback, which is what formats a defaultMessage', () => {
    expect(tagsFor('de').default).toBe('en-GB');
    expect(tagsFor('en').default).toBe('en-GB');
  });

  it('gives English the same tag twice, so a present fallback is not a missing translation', () => {
    const tags = tagsFor('en');
    expect(tags.locale).toBe(tags.default);
  });
});
