import type { Ionicons } from '@expo/vector-icons';
import type { NativeTabs } from 'expo-router/unstable-native-tabs';
import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { ComponentProps } from 'react';

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

const HOME: TabTarget = {
  route: 'index',
  label: COPY.home,
  sf: { default: 'house', selected: 'house.fill' },
  md: { default: 'home', selected: 'home' },
  ionicon: { active: 'home', inactive: 'home-outline' },
};

const MORE: TabTarget = {
  route: 'mehr',
  label: COPY.more,
  sf: { default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' },
  md: { default: 'more_horiz', selected: 'more_horiz' },
  ionicon: { active: 'ellipsis-horizontal-circle', inactive: 'ellipsis-horizontal-circle-outline' },
};

/** What the navigation document may name, after Home. */
export const DESTINATIONS: Readonly<Record<string, TabTarget>> = {
  entdecken: {
    route: 'entdecken',
    label: COPY.discover,
    sf: { default: 'safari', selected: 'safari.fill' },
    md: { default: 'explore', selected: 'explore' },
    ionicon: { active: 'compass', inactive: 'compass-outline' },
  },
  mediathek: {
    route: 'mediathek',
    label: COPY.mediathek,
    sf: { default: 'play.circle', selected: 'play.circle.fill' },
    md: { default: 'play_circle', selected: 'play_circle' },
    ionicon: { active: 'play-circle', inactive: 'play-circle-outline' },
  },
  mitmachen: {
    route: 'mitmachen',
    label: COPY.participate,
    sf: { default: 'person.2', selected: 'person.2.fill' },
    md: { default: 'groups', selected: 'groups' },
    ionicon: { active: 'people', inactive: 'people-outline' },
  },
  profil: {
    route: 'profil',
    label: COPY.profile,
    sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' },
    md: { default: 'account_circle', selected: 'account_circle' },
    ionicon: { active: 'person', inactive: 'person-outline' },
  },
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
