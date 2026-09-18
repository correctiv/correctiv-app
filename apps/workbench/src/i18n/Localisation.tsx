import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  createIntl,
  createIntlCache,
  ReactIntlErrorCode,
  RawIntlProvider,
  type IntlConfig,
  type IntlShape,
} from 'react-intl';

import { de } from './catalogue/de';
import { DEFAULT_LANGUAGE, type Language } from './language';

/**
 * Every catalogue this site has, by language.
 *
 * English is not one of them, and that is what `defaultLocale` is for: the source
 * of every string here is its `defaultMessage`, so English is what renders when
 * there is no catalogue to consult. A second entry would be a copy of the source
 * kept in step with it by hand.
 */
const CATALOGUES: Partial<Record<Language, Record<string, string>>> = { de };

/**
 * What a formatting failure does, and it is the app's answer rather than a new one.
 *
 * A missing German entry renders the English `defaultMessage`: a page that works,
 * reads half-translated, and reports nothing. In development that throws, because
 * the hole is minutes old and the cost of finding it then is a reload. In the
 * published build it is silent and the English renders, because a developer tool
 * that replaced a page with a stack trace over one missing word would be worse than
 * one English word among German ones.
 *
 * `apps/mobile/src/i18n/Localisation.tsx` carries the long version of the argument.
 * The difference here is `import.meta.env.DEV` in place of `__DEV__`, because this
 * is Vite and that is Metro.
 */
const onError: NonNullable<IntlConfig['onError']> = (error) => {
  if (error.code === ReactIntlErrorCode.MISSING_TRANSLATION) {
    if (import.meta.env.DEV) throw error;
    return;
  }
  console.error(error);
};

/**
 * This site's own `intl`, on a context of this site's own — and the second half of
 * that sentence is the whole point.
 *
 * **`useIntl()` does not work in this application**, and the failure is silent. The
 * preview and the component pages draw the app's components through
 * `components/AppHost.tsx`, which mounts `AppEnvironment`, which mounts the APP's
 * `IntlProvider` with the app's catalogue. React resolves context by tree position,
 * so anything of ours rendered *inside* one of those — the home tool's insertion
 * mark, the palette's dialog, a block's placeholder row — would read the app's
 * catalogue, find no `home.*` id in it, and fall through to the English
 * `defaultMessage`.
 *
 * Measured on the dev server with the site set to German, one page load: the bar
 * above the frame read „Rahmen“ and the track „Der Tag“, while the palette inside
 * the panel read "Add a block" and a row read "Draws nothing here." No error, no
 * console line — `vite.app.mjs`'s `notADevApp()` defines `__DEV__` false for this
 * whole site, so the app's `onError` does not throw, and a half-German interface is
 * what a reader gets.
 *
 * A separate context cannot be shadowed by the app's provider, because it is a
 * different object. So the rule here is one line and a check holds it: **this site
 * uses `useWorkbenchIntl()` and never `useIntl()`**, and the nesting question stops
 * existing rather than being answered per component.
 */
const WorkbenchIntl = createContext<IntlShape | null>(null);

/**
 * One cache for the whole site. `createIntl` wants one so that two instances with
 * the same locale share their parsed messages rather than each parsing every ICU
 * pattern again.
 */
const cache = createIntlCache();

export function Localisation({ language, children }: { language: Language; children: ReactNode }) {
  const intl = useMemo(
    () =>
      createIntl(
        {
          locale: language,
          defaultLocale: DEFAULT_LANGUAGE,
          messages: CATALOGUES[language],
          onError,
        },
        cache,
      ),
    [language],
  );

  return (
    <WorkbenchIntl.Provider value={intl}>
      {/*
        Both, and each for a different reader. The context above is what this
        site's own components use and what the app's provider cannot shadow;
        `RawIntlProvider` puts the same instance on react-intl's own context, so
        that a component of ours which has NOT been moved over yet, or one borrowed
        from a library that calls `useIntl()`, still finds something rather than
        throwing. Nothing in `src/` may rely on the second — `test/i18n.test.ts`
        fails on a `useIntl` outside this directory.
      */}
      <RawIntlProvider value={intl}>{children}</RawIntlProvider>
    </WorkbenchIntl.Provider>
  );
}

/**
 * This site's formatter, whatever is mounted between here and the root.
 *
 * Throws rather than falling back, because a component of ours outside the provider
 * is a mounting mistake and the English it would otherwise render looks like a
 * missing translation.
 */
export function useWorkbenchIntl(): IntlShape {
  const intl = useContext(WorkbenchIntl);
  if (intl === null) {
    throw new Error(
      'useWorkbenchIntl() outside <Localisation>. Every view of this site is inside it; ' +
        'a component reaching this is mounted somewhere App.tsx does not put it.',
    );
  }
  return intl;
}
