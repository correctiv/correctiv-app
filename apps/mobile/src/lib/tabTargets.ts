import type { Ionicons } from '@expo/vector-icons';
import type { NativeTabs } from 'expo-router/unstable-native-tabs';
import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { ComponentProps } from 'react';

import { SCREEN_ICONS, type ScreenIcon } from './screenIcons';

export { SCREEN_ICONS } from './screenIcons';

/**
 * What a tab can be, declared where the app is
 * ([ADR 0071](../../../../adr/0071-screens-become-documents-and-the-tab-bar-becomes-one-too.md)
 * §4): the route, its label as a message, its icon in each platform's vocabulary. The
 * navigation document in the core only chooses among these ids and orders them.
 *
 * The feature a destination belongs to is `TAB_FEATURES` in `features.ts`, which is
 * where `feature-gating.test.ts` holds it against `features.json`; it is not repeated
 * here, so there is one place to be wrong.
 *
 * The three bars (native, web, rail) draw the same labels and share nothing but this
 * file, which is why the labels live here and not in each of them.
 *
 * **The icons are `SCREEN_ICONS`, spread in rather than written out here** (ADR 0075 §4).
 * The same key answers for a tab target and for a screen document, so the pairs live in
 * one table, and the generator reads that table into the core so the parser knows which
 * keys exist — a screen document naming an icon this build has would then be reported
 * rather than drawn blank. The tab bar still reads them from here; it reads them from
 * the screen's own document in ADR 0075 §5, which is what this spread is then replaced
 * by.
 */

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type IconProps = ComponentProps<typeof NativeTabs.Trigger.Icon>;
type Sf = Extract<NonNullable<Extract<IconProps, { sf?: unknown }>['sf']>, { selected: unknown }>;
type Md = Extract<NonNullable<Extract<IconProps, { md?: unknown }>['md']>, { selected: unknown }>;

export interface TabTarget {
  /** The route file under `app/(tabs)/`, which is also the id the document names. */
  readonly route: string;
  readonly label: MessageDescriptor;
  readonly sf: Sf;
  readonly md: Md;
  readonly ionicon: { readonly active: IoniconName; readonly inactive: IoniconName };
}

/** One screen's icon out of the set, and the refusal of a key the set does not hold. */
function iconOf(key: string): ScreenIcon {
  const icon = SCREEN_ICONS[key];
  if (!icon) throw new Error(`no screen icon is declared under \`${key}\``);
  return icon;
}

/** The tab labels, in ENGLISH; the German ships in `packages/catalogue/src/de/ui.ts` (ADR 0026 §6). */
const COPY = defineMessages({
  home: { id: 'ui.tabHome', defaultMessage: 'Home' },
  discover: {
    id: 'ui.tabDiscover',
    defaultMessage: 'Discover',
    description:
      'A tab on the tab bar, where there is room for one short word. discover.title is the same word as the heading of the screen it opens.',
  },
  mediathek: { id: 'ui.tabMediathek', defaultMessage: 'Mediathek' },
  participate: {
    id: 'ui.tabParticipate',
    defaultMessage: 'Take part',
    description:
      'A tab on the tab bar, where there is room for one short word. participate.title is the same word as the heading of the screen it opens.',
  },
  profile: {
    id: 'ui.tabProfile',
    defaultMessage: 'Profile',
    description:
      'A tab on the tab bar, where there is room for one short word. profile.title is the same word as the heading of the screen it opens.',
  },
  more: {
    id: 'ui.tabMore',
    defaultMessage: 'More',
    description:
      'The last tab when the bar has more destinations than it can show, and the heading of the screen that lists the rest. One short word.',
  },
});

const HOME: TabTarget = { route: 'index', label: COPY.home, ...iconOf('home') };

const MORE: TabTarget = { route: 'mehr', label: COPY.more, ...iconOf('more') };

/** What the navigation document may name, after Home. */
export const DESTINATIONS: Readonly<Record<string, TabTarget>> = {
  entdecken: { route: 'entdecken', label: COPY.discover, ...iconOf('compass') },
  mediathek: { route: 'mediathek', label: COPY.mediathek, ...iconOf('play') },
  mitmachen: { route: 'mitmachen', label: COPY.participate, ...iconOf('people') },
  profil: { route: 'profil', label: COPY.profile, ...iconOf('person') },
};

/** The ids a navigation document may name: the parser's `known` set (ADR 0071 §6). */
export const KNOWN_DESTINATIONS: ReadonlySet<string> = new Set(Object.keys(DESTINATIONS));

/** Every route file under `app/(tabs)/` and how it is drawn as a tab. */
export const TAB_TARGETS: Readonly<Record<string, TabTarget>> = {
  index: HOME,
  ...DESTINATIONS,
  mehr: MORE,
};

/** Every tab route, in the order the files are declared to the navigator when nothing overflows. */
export const TAB_ROUTES: readonly string[] = Object.keys(TAB_TARGETS);
