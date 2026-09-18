// Before anything else in this module graph, because a polyfill that arrives
// after the first `formatMessage` arrives too late. Module bodies run in import
// order, and this one installs `Intl.PluralRules` on Hermes.
import './polyfills';

import { useEffect, type ReactNode } from 'react';
import { IntlProvider, ReactIntlErrorCode, type IntlConfig } from 'react-intl';

import { CATALOGUES } from '@correctiv/catalogue';
import { intlLocale } from '@correctiv/app-core/lib/format';
import type { Locale } from '@correctiv/app-core/stores/settings';
import { isOwnDocument } from '@/lib/ownDocument';
import { useLocale } from '@/lib/store/core';

/**
 * The language every user-facing string is rendered in.
 *
 * **The provider is the host's**, which is why it sits here and not in the core:
 * `packages/app-core` imports no React (`test/boundary.test.ts`). The descriptors
 * themselves are plain objects and live wherever the string lives — a screen in
 * the app, and one day a vocabulary in the core.
 *
 * `defaultLocale` is **English**, and that is not a typo. A descriptor's
 * `defaultMessage` is English so that the source reads in one language
 * ([AGENTS.md](../../../../AGENTS.md#language)); German is data, and it is not in
 * this app at all — `@correctiv/catalogue` holds every locale's, so the core's own
 * vocabulary is not kept inside one of its hosts
 * ([ADR 0049](../../../../adr/0049-the-catalogue-is-a-package.md)). So a missing German entry does not blank the screen, it prints
 * the English — which is a defect that looks like a feature, and is why
 * `__tests__/localisation-seam.test.ts` fails on one at build time and `onError`
 * below throws on one at run time, instead of either being left to a reader to
 * notice.
 *
 * Mounted inside `lib/env/AppEnvironment.tsx`, below the Redux Provider because
 * it reads the locale from the store, and there rather than in `app/_layout.tsx`
 * because the workbench draws the app's components through that same environment
 * ([ADR 0028](../../../../adr/0028-one-shell-and-a-route-that-declares-its-context.md)).
 * A component that formats a message would throw in the workbench otherwise.
 */
/**
 * What a formatting failure does, and the one that matters is
 * `MISSING_TRANSLATION`.
 *
 * It is the failure mode the English fallback buys: an id with no German entry
 * renders the English `defaultMessage` on a German phone, which is a screen that
 * works, reads wrong, and reports nothing. react-intl's own `onError` logs it and
 * carries on — and a console line is precisely what happened during issue #99,
 * unseen on the device while `__tests__/localisation-seam.test.ts` reported 295
 * ids against 295. That test cannot see this: it compares a generated `en.json`
 * with a hand-written catalogue, both of them files, and the miss was in the
 * bundle the phone was actually running.
 *
 * **In development it throws.** That is the whole point: the screen is replaced by
 * the recovery screen and the message is unmissable, in the dev client, in the
 * preview and under jest, where `__DEV__` is true as well. A missing entry is a
 * defect somebody introduced minutes ago, and the cost of finding it then is a
 * reload.
 *
 * **In production it is silent, and the English renders.** Two reasons, and
 * neither is "it does not matter". A release build has nowhere to log TO: there is
 * no console on a shipped phone and no error sink yet (that is #95), so a
 * `console.error` there is not a quieter report, it is no report, and it costs the
 * next reader of this file a minute working out who would ever read it. And
 * against a reader, one English word is a blemish, where a throw would take a
 * working article away and hand them the recovery screen instead. So the place
 * this is caught is the check and the dev run, both of which happen before anyone
 * ships — and by the time the choice is between an English word and a crash, the
 * English word has already won.
 *
 * Every other `IntlError` — a malformed ICU pattern, a formatter the runtime does
 * not have — keeps react-intl's own behaviour and is logged, because those are
 * bugs in a message rather than a hole in the catalogue.
 */
const onError: NonNullable<IntlConfig['onError']> = (error) => {
  if (error.code === ReactIntlErrorCode.MISSING_TRANSLATION) {
    if (__DEV__) throw error;
    return;
  }
  console.error(error);
};

/**
 * Keeps `<html lang>` on the language the app is actually rendering in.
 *
 * `app/+html.tsx` writes that attribute into the static export, and it can only
 * write the settings slice's own default: it renders once, at export time, with no
 * store anywhere. So the shell is a first guess, and this is the correction — it
 * runs on the first render and whenever the language changes.
 *
 * **It was measured disagreeing.** With the host passing `'en'` the export still
 * said `lang="de"`, because the shell had read the default. A browser hyphenates and
 * a screen reader picks a voice by that attribute, so a wrong one is not cosmetic.
 *
 * **Only a document the app wrote.** This provider is mountable inside a page the
 * app did not produce, and the root element of such a page is not the app's to
 * write: measured on 2026-09-18, a page served in English got `lang="de"` from
 * here, which is this same correction doing the exact harm it was written to undo.
 * `lib/ownDocument.ts` is the whole of the answer — the shell marks the one
 * document that is the app's, and an unmarked root is left alone. The app
 * therefore states what it owns rather than naming who else might be hosting it.
 *
 * A no-op off the web as well. `document` does not exist on a device, `isOwnDocument()`
 * answers that too, and a `.web.tsx` sibling for four lines would be a second file
 * to keep in step.
 */
function useDocumentLanguage(locale: Locale): void {
  useEffect(() => {
    if (!isOwnDocument()) return;
    document.documentElement.lang = locale;
  }, [locale]);
}

export function Localisation({ children }: { children: ReactNode }) {
  const locale = useLocale();
  useDocumentLanguage(locale);
  return (
    <IntlProvider
      /*
        The region on BOTH, and the same one `lib/format.ts` formats a date with.
        `'en'` resolves to American order inside `Intl` and `'en-GB'` does not, so a
        provider given `'en'` beside a `formatDate` given `'en-GB'` would print one
        day two ways. Nothing in the catalogue carries an ICU `{x, date}` today; this
        is what keeps the first one that does from finding it.

        `defaultLocale` has to go through the same function and not stay `'en'`, which
        a cold review measured: react-intl formats a FALLBACK `defaultMessage` with
        `defaultLocale` rather than with `locale`, so half the seam would have stayed
        open on the branch every string in this repository takes when its catalogue
        has no entry. It also keeps the two tags equal for English — the missing
        translation guard compares them case-insensitively, and `'en-gb'` against
        `'en'` would raise `MISSING_TRANSLATION` for every English string whose
        `defaultMessage` IS the right answer, which `onError` below throws on in
        development.
      */
      locale={intlLocale(locale)}
      defaultLocale={intlLocale('en')}
      messages={CATALOGUES[locale]}
      onError={onError}
    >
      {children}
    </IntlProvider>
  );
}
