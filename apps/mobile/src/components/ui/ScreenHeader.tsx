import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { useIntl } from 'react-intl';

import { HEADER_COPY, ScreenHeaderBar } from './ScreenHeaderBar';
import type { ScreenHeaderProps } from './screenHeaderTypes';
import { useColors } from '@/lib/theme';

/**
 * This screen's header, on iOS and Android: the platform's own stack header,
 * configured, rather than a bar this app draws.
 *
 * ~~Deliberately NOT a native stack header — the app sets `headerShown: false`
 * throughout and builds its own bars, so that iOS, Android and web show the same
 * brand.~~ That half is voided by
 * [ADR 0030](../../../../../adr/0030-the-platforms-header-and-ours-on-web.md),
 * which puts the platform's header on iOS and Android for the reason
 * [ADR 0013](../../../../../adr/0013-native-tabs-and-a-web-tab-bar-of-its-own.md)
 * gives one level down: the parts a user has already learned elsewhere are worth
 * more as the platform's than as ours. **A native header looks different on every
 * platform, and on web it does not appear at all** — that half stands, was
 * re-measured for 0030, and is why `ScreenHeader.web.tsx` keeps the drawn bar.
 *
 * What is configured here and not inherited: the colours, because they come from
 * `useColors()` and a palette cannot reach a native header through a class; the
 * back label, because iOS falls back to the previous route's title and no route
 * in this app had one until now; and the absence of a title, which is the next
 * paragraph.
 *
 * **The header draws no title.** Every screen that takes this header already
 * prints its own name in larger type immediately below it, so a header title is a
 * second copy of a word that is on screen either way; an emulator pass saw the
 * duplicate on six routes. What the platform's header is here for is the back
 * control, the gesture and the animation, and it keeps all three without a title.
 * The route's `title` stays — it is route metadata, and on web it is the browser
 * tab — and `headerTitle: ''` is what keeps it out of the bar. The idiomatic
 * answer is the large-title pattern, where the screen's own heading collapses
 * into the header as it scrolls, and that is a design change to thirteen screens
 * rather than a line here (ADR 0030).
 */
export function ScreenHeader({ title, drawnBar, backLabel, children }: ScreenHeaderProps) {
  const intl = useIntl();
  const colors = useColors();

  // Keyed on the values rather than rebuilt per render: `Stack.Screen` calls
  // `navigation.setOptions` whenever this object's identity changes, and the
  // search screen re-renders on every keystroke.
  const options = useMemo(
    () =>
      drawnBar
        ? {
            title,
            // Stated rather than left to the root layout's `screenOptions`. This
            // branch is the exception to this whole file, and an exception that
            // depends on a default set two files away is one nobody can read.
            headerShown: false,
          }
        : {
            title,
            headerShown: true,
            // Empty, and not absent: `getHeaderTitle` falls back to `title` and
            // then to the route's name, so leaving it out puts the duplicate
            // back. See the paragraph above for why there is no title at all.
            headerTitle: '',
            // Our own back label, not the platform's default. On iOS that
            // default is the previous route's title, and the tab routes have
            // none, so the back control would read whatever the router calls
            // them. `ui.back` is declared once, in `ScreenHeaderBar`, because
            // the drawn bar says the same word — a native header takes a string
            // and not JSX, so it is formatted here rather than rendered.
            headerBackTitle: intl.formatMessage(HEADER_COPY.back),
            headerStyle: { backgroundColor: colors.canvas },
            // Colours the back chevron and its label. There is no `headerTitleStyle`
            // here because there is no title to style.
            headerTintColor: colors['on-canvas'],
          },
    [colors, drawnBar, intl, title],
  );

  return (
    <>
      <Stack.Screen options={options} />
      {/* The two named exceptions keep the bar here as well as on web; the props
          type is what makes a call site say so. */}
      {drawnBar ? <ScreenHeaderBar backLabel={backLabel}>{children}</ScreenHeaderBar> : null}
    </>
  );
}
