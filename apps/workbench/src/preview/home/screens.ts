import { CirclePlay, Compass, House, User, Users, type LucideIcon } from 'lucide-react';

import { parseHomeLayout, type HomeLayout } from '@correctiv/app-core/lib/home-layout';
import {
  CONFIGURABLE_SCREENS,
  SCREEN_DOCUMENTS,
  type ConfigurableScreen,
} from '@correctiv/app-core/lib/screen-layout';

import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';
import { governs, SHIPPED } from './document';

/**
 * What the screen editor knows about each screen: its name, where the frame goes to show
 * it, and the document the app ships for it.
 *
 * The palette is not here. Which blocks a screen offers, and in which groups, is
 * `blocksByCategory()` in the core (ADR 0073 §2), read where the palette is drawn,
 * so this file holds no second list of blocks.
 */

export { CONFIGURABLE_SCREENS, type ConfigurableScreen };

/**
 * A screen's name as the app's tab says it. Strings except Home, for the reason
 * `preview/routes.ts` gives: they are the screens' own names, and translating
 * `Entdecken` would rename a screen. Home is the one this site had to name itself.
 */
export const SCREEN_NAMES: Readonly<Record<ConfigurableScreen, string | WorkbenchMessage>> = {
  home: wbMessage({
    id: 'home.screen.home',
    defaultMessage: 'Home',
    description:
      'The app’s first screen, in the screen picker of the layout tool. The same word as frame.pages.home, which names it in the page picker.',
  }),
  entdecken: 'Entdecken',
  mediathek: 'Mediathek',
  mitmachen: 'Mitmachen',
  profil: 'Profil',
};

/** The frame's route for a screen, which is where the picker takes the frame. */
export const SCREEN_ROUTES: Readonly<Record<ConfigurableScreen, string>> = {
  home: '/',
  entdecken: '/entdecken',
  mediathek: '/mediathek',
  mitmachen: '/mitmachen',
  profil: '/profil',
};

/**
 * The mark each screen wears in the editor's screen switcher, and the app tab's
 * own name for the same mark beside it.
 *
 * **Not the core's `SCREEN_ICONS`**, which is the same word for a different thing: that
 * one is the keys a screen document may name and the six native names behind each
 * (ADR 0075 §4), it holds the app's own "Mehr" and a fallback this map has no row for,
 * and it carries no component. This one is what a screen looks like *here*. Two names,
 * two tables, and the test below reads the app's own declaration to hold them together.
 *
 * **The same icons as the app's tab bar, in the kit's own set.** `tabTargets.ts`
 * in the app declares three spellings of every tab icon — SF Symbols, Material
 * and Ionicons — because three platforms draw three, and it is the Ionicons name
 * that is recorded here beside the lucide one that gets drawn. The app is not
 * importable from this half of the repository and its icon components are React
 * Native's, so the pair is what can be held in step; `test/preview/screen-editor.test.ts`
 * reads the app's file as text and fails when a screen's name there is not the one
 * written here, which is the only way this can drift and the reason it is a map
 * with two entries per row rather than a comment.
 */
export const SCREEN_ICONS: Readonly<
  Record<ConfigurableScreen, { readonly ionicon: string; readonly Icon: LucideIcon }>
> = {
  home: { ionicon: 'home', Icon: House },
  entdecken: { ionicon: 'compass', Icon: Compass },
  mediathek: { ionicon: 'play-circle', Icon: CirclePlay },
  mitmachen: { ionicon: 'people', Icon: Users },
  profil: { ionicon: 'person', Icon: User },
};

const shipped = new Map<ConfigurableScreen, HomeLayout>();

/** The document the app ships for a screen, as the core reads it. Home's is `SHIPPED`. */
export function shippedOf(screen: ConfigurableScreen): HomeLayout {
  if (screen === 'home') return SHIPPED;
  let layout = shipped.get(screen);
  if (!layout) {
    const parsed = parseHomeLayout(SCREEN_DOCUMENTS[screen]).layout;
    if (!parsed) throw new Error(`the bundled ${screen} document does not parse`);
    layout = parsed;
    shipped.set(screen, layout);
  }
  return layout;
}

/**
 * The configurable screen a frame route shows, or `null` for a route that is none (the
 * article reader, settings…). The picker's way back: it takes the frame to a screen, this
 * takes the editor to the screen the frame is on, so a tap inside the app is followed.
 */
export function screenOfRoute(route: string | undefined): ConfigurableScreen | null {
  return CONFIGURABLE_SCREENS.find((of) => governs(route, SCREEN_ROUTES[of])) ?? null;
}

export function isScreen(value: string | null): value is ConfigurableScreen {
  return value !== null && (CONFIGURABLE_SCREENS as readonly string[]).includes(value);
}
