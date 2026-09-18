import type { PropsWithChildren } from 'react';

import { settingsInitialState } from '@correctiv/app-core/stores/settings';

/**
 * The HTML shell of the web export, which Expo otherwise writes for us.
 *
 * **It exists for one attribute.** Without this file `expo export --platform web`
 * emits `<html lang="en">` while the app renders German, which is what the
 * published demo shipped: a browser hyphenating by English rules and a screen
 * reader announcing German prose in an English voice. Measured on the export on
 * 2026-09-18, before this file.
 *
 * `lang` is read off the settings slice's own initial value rather than typed here,
 * so this file cannot be the second place the app's language is written. The store
 * cannot be asked: this component renders once, statically, at export time, and
 * there is no store then — which is also why it is the INITIAL value and not the
 * host's. They agree today because `lib/store/core.ts` passes the same `'de'`, and
 * the day they do not, the attribute is a static document's best answer rather than
 * a lie: an app that switched language at runtime would set `document.documentElement.lang`
 * itself, the way the workbench does.
 *
 * Everything else here is Expo's own default shell. `ScrollViewStyleReset` is the
 * one piece that is not optional — react-native-web's root scroller needs it, and
 * leaving it out gives the page two scrollbars.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang={settingsInitialState.locale}>
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
