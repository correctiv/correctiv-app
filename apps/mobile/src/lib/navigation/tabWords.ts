import { useIntl } from 'react-intl';

import { resolveText } from '@correctiv/app-core/lib/home-settings';
import { MORE_TAB, type TabBar } from '@correctiv/app-core/lib/navigation';
import {
  screenTabLabelOf,
  SCREEN_ICON_FALLBACK,
  type ScreenWords,
} from '@correctiv/app-core/lib/screen-layout';
import type { Locale } from '@correctiv/app-core/stores/settings';

import { SCREEN_ICONS, type ScreenIcon } from '@/lib/screenIcons';
import { useLocale } from '@/lib/store/core';
import { MORE_LABEL } from '@/lib/tabTargets';

import { startDecision, useTabBarDecision, type TabBarDecision } from './tabBar';

/**
 * What the three bars draw for one route: a word in the language the app is in, and an
 * icon in the three vocabularies a platform draws it from
 * ([ADR 0075](../../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §5).
 *
 * The native bar, the web bar and the rail share this file and nothing else, which is
 * the arrangement the labels had when they were messages: three bars, one answer, so a
 * tab cannot be called one thing on a phone and another on a tablet.
 */
export interface TabWord {
  readonly label: string;
  readonly icon: ScreenIcon;
}

/**
 * The icon "Mehr" is drawn with.
 *
 * It is the one row of the bar the app owns rather than the newsroom (ADR 0071 §5), so
 * the app names its icon here as it names its word in `tabTargets.ts` — there is no
 * document to read it out of, and inventing one for a screen nobody arranges would be
 * a document whose only purpose is to be unchangeable.
 */
const MORE_ICON = 'more';

/**
 * The icon a key names, or the fallback.
 *
 * **The app's table and not the core's `screenIconOf`**, which answers the same
 * question with plain strings: the names a phone draws have to be the platforms' own
 * types or a name that does not exist on one of them is a blank tab rather than a
 * compile error (`lib/screenIcons.ts`). `Object.hasOwn` for the reason the core gives
 * at the same lookup — this takes words somebody may have built by hand, and
 * `constructor` is not an icon.
 */
export function iconOf(key: string | undefined): ScreenIcon {
  if (key !== undefined && Object.hasOwn(SCREEN_ICONS, key)) return SCREEN_ICONS[key]!;
  return SCREEN_ICONS[SCREEN_ICON_FALLBACK]!;
}

/**
 * One route's word and icon, out of the words its screen's document carries.
 *
 * **The language is resolved here and nowhere above it.** `resolveText` asks for the
 * locale and falls back to German, never to the empty string and never to the key (ADR
 * 0075 §2), so a screen whose document carries no English still says something in an
 * English build.
 *
 * `words` absent is the route the app names itself; `words` null would be a screen
 * whose document was refused, which `tabBar.ts` already falls back out of — the bundled
 * documents all parse and a test holds them to it, so the route id in that last branch
 * is a tab nothing can produce rather than a name anybody will read.
 */
export function tabWordOf(
  route: string,
  words: ScreenWords | null | undefined,
  locale: Locale,
  more: string,
): TabWord {
  if (route === MORE_TAB) return { label: more, icon: iconOf(MORE_ICON) };
  const text = screenTabLabelOf(words ?? null);
  return {
    label: text === null ? route : resolveText(text, locale),
    icon: iconOf(words?.icon),
  };
}

/** What the bars and "Mehr" draw: the arrangement and each screen's word, in the app's language. */
export interface Tabs {
  readonly bar: TabBar;
  /** The screens the layout carries and the navigation does not list, which "Mehr" holds too. */
  readonly unlisted: readonly string[];
  /** Every tab, every screen behind "Mehr" and "Mehr" itself. */
  readonly words: Readonly<Record<string, TabWord>>;
}

/**
 * The bar and what everything on it is called and drawn with, in the app's language.
 *
 * The arrangement is re-read when a document changes (`useTabBarDecision`), and the
 * language is the store's, which is construction state the host names once
 * (`lib/locale.ts`). So this re-renders with the app and cannot disagree with the entries
 * beside it.
 */
export function useTabs(): Tabs {
  return useTabsOf(useTabBarDecision());
}

/**
 * The same, for the bar this process started with, which does not change until the next
 * start ([ADR 0081](../../../../../adr/0081-the-system-tab-bar-returns-and-is-decided-at-start.md)).
 * The system's tab bar reads this one. The words are the start's too and the language is
 * live, so a changed setting renames a trigger without rebuilding the bar.
 */
export function useStartTabs(): Tabs {
  return useTabsOf(startDecision());
}

function useTabsOf({ bar, unlisted, words }: TabBarDecision): Tabs {
  const intl = useIntl();
  const locale = useLocale();
  const more = intl.formatMessage(MORE_LABEL);
  const ids = [...Object.keys(words), MORE_TAB];
  return {
    bar,
    unlisted,
    words: Object.fromEntries(ids.map((id) => [id, tabWordOf(id, words[id], locale, more)])),
  };
}
