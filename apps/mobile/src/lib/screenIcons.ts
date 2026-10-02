import type { Ionicons } from '@expo/vector-icons';
import type { NativeTabs } from 'expo-router/unstable-native-tabs';
import type { ComponentProps } from 'react';

/**
 * The icons a screen may be given, one key to the three native names it is drawn with.
 *
 * **Why this is a file of its own and not a table in `tabTargets.ts`.** The table travels
 * into the core through `scripts/generate-home-settings.mjs`, which reads its declarations
 * by importing them under Node's type stripping. A declaration file may therefore carry
 * `import type` and nothing else: one ordinary import is a specifier Node has to resolve
 * at a path it has no resolver for, and the generator is then dead while every check
 * stays green (`src/lib/home/settings.ts` says this in its own head, and this is the same
 * rule for the same reason). `tabTargets.ts` imports `react-intl` and calls
 * `defineMessages` at module scope, so it cannot be that file — hence this one, which
 * `tabTargets.ts` reads the icons out of and which the generator reads them out of.
 *
 * **Why a fixed set at all** (ADR 0075 §4): every choice has to exist natively on both
 * platforms. A free string renders on Android, is blank on iOS, and the newsroom finds
 * out from a reader. So a key answers to an SF Symbol pair, a Material pair and an Ionicon
 * pair, and the document names the key and nothing else.
 *
 * **What is in it.** The five screens the newsroom arranges, the app's own "Mehr", and
 * `default`, the icon a screen draws when its document names no icon or names one this
 * build does not know — the smallest possible loss, ADR 0075 §4. The core's
 * `SCREEN_ICON_FALLBACK` is that last key, and the two are held to each other by
 * `__tests__/home-settings.test.ts`, because a fallback that is not in the set would be an
 * icon nothing can draw.
 *
 * Not words: the name a person reads for an icon in the workbench's picker is that tool's
 * own (ADR 0054 §3, ADR 0075 §1's table), and a key is an address, in every language.
 */

type IoniconName = ComponentProps<typeof Ionicons>['name'];
type IconProps = ComponentProps<typeof NativeTabs.Trigger.Icon>;
type Sf = Extract<NonNullable<Extract<IconProps, { sf?: unknown }>['sf']>, { selected: unknown }>;
type Md = Extract<NonNullable<Extract<IconProps, { md?: unknown }>['md']>, { selected: unknown }>;

/**
 * One icon in the three vocabularies the app draws it in.
 *
 * The types are the platforms', not this file's, so a name that does not exist on one of
 * them is a compile error here rather than a blank tab on a phone. The core holds the
 * same three pairs as plain strings (`ScreenIcon` in `app-core`), because the core knows
 * no platform (ADR 0006).
 *
 * `Required` on the two SF and Material pairs, and not an own interface for them: both
 * platforms call the unselected name optional, because a tab bar that draws one icon for
 * both states is allowed to say so. This table says otherwise — every key is six names,
 * because the set falls back to a whole icon rather than to half of one — and the types
 * have to agree, or a key could be written here that the core would then read as missing
 * a name.
 */
export interface ScreenIcon {
  readonly sf: Required<Sf>;
  readonly md: Required<Md>;
  readonly ionicon: { readonly active: IoniconName; readonly inactive: IoniconName };
}

/**
 * Key to icon, in the order the picker will offer them: the screens first, then the
 * app's own tab, then the fallback nobody chooses.
 */
export const SCREEN_ICONS: Readonly<Record<string, ScreenIcon>> = {
  home: {
    sf: { default: 'house', selected: 'house.fill' },
    md: { default: 'home', selected: 'home' },
    ionicon: { active: 'home', inactive: 'home-outline' },
  },
  compass: {
    sf: { default: 'safari', selected: 'safari.fill' },
    md: { default: 'explore', selected: 'explore' },
    ionicon: { active: 'compass', inactive: 'compass-outline' },
  },
  play: {
    sf: { default: 'play.circle', selected: 'play.circle.fill' },
    md: { default: 'play_circle', selected: 'play_circle' },
    ionicon: { active: 'play-circle', inactive: 'play-circle-outline' },
  },
  people: {
    sf: { default: 'person.2', selected: 'person.2.fill' },
    md: { default: 'groups', selected: 'groups' },
    ionicon: { active: 'people', inactive: 'people-outline' },
  },
  person: {
    sf: { default: 'person.crop.circle', selected: 'person.crop.circle.fill' },
    md: { default: 'account_circle', selected: 'account_circle' },
    ionicon: { active: 'person', inactive: 'person-outline' },
  },
  more: {
    sf: { default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' },
    md: { default: 'more_horiz', selected: 'more_horiz' },
    ionicon: {
      active: 'ellipsis-horizontal-circle',
      inactive: 'ellipsis-horizontal-circle-outline',
    },
  },
  /**
   * What a screen draws when its document says no icon, or says one this build does not
   * know (ADR 0075 §4). Neutral on purpose: it is the icon a reader sees for a screen
   * nobody has named an icon for, and it should not claim to be one of them.
   */
  default: {
    sf: { default: 'square.grid.2x2', selected: 'square.grid.2x2.fill' },
    md: { default: 'apps', selected: 'apps' },
    ionicon: { active: 'apps', inactive: 'apps-outline' },
  },
};
