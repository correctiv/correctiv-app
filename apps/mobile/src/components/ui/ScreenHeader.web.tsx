import { ScreenHeaderBar } from './ScreenHeaderBar';
import type { ScreenHeaderProps } from './screenHeaderTypes';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';

/**
 * This screen's header, on web: the app's own drawn bar, unchanged, plus the
 * browser tab's title.
 *
 * **Web keeps the bar because nothing else draws one.** In
 * `react-native-screens`, `lib/module/components/ScreenStackHeaderConfig.web.js`
 * makes that component and every subview of it a bare `View`, and
 * `SearchBar.web.js` is `const SearchBar = View`. So the split is not a
 * preference between two good options here: it is the only half that draws
 * anything ([ADR 0030](../../../../../adr/0030-the-platforms-header-and-ours-on-web.md)).
 *
 * **And the title has to be written by hand, because the option does not carry
 * it.** react-navigation's own bridge from `options.title` to `document.title` is
 * switched off: `expo-router/build/ExpoRoot.js` hands its `NavigationContainer` a
 * hard-coded `documentTitle: { enabled: false }`. `expo-router/head` is the other
 * path and it works — the app does mount its `HelmetProvider`, by way of
 * `expo-router/entry` — but it is a second declaration of a name this component
 * already takes as a prop, and it does not reach the static export either: the
 * root shell renders `null` until the fonts and the store are ready, so
 * `expo export` renders no screen at all and every page ships
 * `<title data-rh="true"></title>`. Both re-measured on 2026-09-15; ADR 0030 has
 * the detail, and `TROUBLESHOOTING.md` has the trap.
 *
 * The write itself lives in `lib/navigation/documentTitle`, because getting it
 * right is a question about all the mounted screens at once rather than about
 * this one.
 */
export function ScreenHeader({ title, backLabel, children }: ScreenHeaderProps) {
  useDocumentTitle(title);

  return <ScreenHeaderBar backLabel={backLabel}>{children}</ScreenHeaderBar>;
}
