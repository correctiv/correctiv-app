import type { PropsWithChildren } from 'react';

import { SHIPPED_LOCALE } from '@/lib/locale';
import { OWN_DOCUMENT_MARK } from '@/lib/ownDocument';

/**
 * The HTML shell of the web export, which Expo otherwise writes for us.
 *
 * **It exists for one attribute.** Without this file `expo export --platform web`
 * emits `<html lang="en">` while the app renders German, which is what the
 * published demo shipped: a browser hyphenating by English rules and a screen
 * reader announcing German prose in an English voice. Measured on the export on
 * 2026-09-18, before this file.
 *
 * `lang` comes from `lib/locale.ts`, the one place this app names the language it
 * ships, so this file is not a second place it is written. The store cannot be
 * asked: this component renders once, statically, at export time, and there is no
 * store then.
 *
 * It read the settings slice's own default first, and a cold review showed what that
 * costs: with the host passing `'en'` the export still said `lang="de"`, because
 * the shell had read the CORE's answer rather than this host's.
 * `i18n/Localisation.tsx` corrects the attribute on the first render either way,
 * which is what an app that switches language at runtime would need anyway — and
 * it is the only thing that can follow `workbench:locale`, the preview's override
 * (`lib/locale.ts`), because this file has already been written by the time a
 * browser has a key at all. A framed page therefore arrives saying `lang="de"` and
 * is corrected to what the store was built with — the frame is this export in an
 * iframe, so it is the app's own document and carries the mark below, which is
 * what lets the correction run there and nowhere else.
 *
 * **`OWN_DOCUMENT_MARK` is the other half of that correction.** The effect that
 * writes `<html lang>` runs wherever the app's provider is mounted, and the
 * provider is mountable inside somebody else's page, whose root element is not
 * the app's to touch. This file renders the only `<html>` the app owns, so
 * marking it here is how the app tells its own document from a borrowed one
 * without knowing anything about who borrowed it. `lib/ownDocument.ts` carries
 * the argument and the measurement.
 *
 * Everything else here is Expo's own default shell. `ScrollViewStyleReset` is the
 * one piece that is not optional — react-native-web's root scroller needs it, and
 * leaving it out gives the page two scrollbars.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang={SHIPPED_LOCALE} {...OWN_DOCUMENT_MARK}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

/**
 * Copied from `expo-router/html`'s own export rather than imported, because that
 * subpath pulls the router's server half into the export's module graph. Three
 * lines of CSS, and the comment upstream gives for them is the one that matters:
 * react-native-web renders the root `ScrollView` as a `div` whose overflow it
 * manages, and the document's own scroller then fights it.
 */
function ScrollViewStyleReset() {
  return (
    <style
      id="expo-reset"
      dangerouslySetInnerHTML={{
        __html: `#root,body,html{height:100%}body{overflow:hidden}#root{display:flex}`,
      }}
    />
  );
}
