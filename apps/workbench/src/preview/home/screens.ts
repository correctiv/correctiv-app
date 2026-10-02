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
 * The palette is not here. Which blocks a screen offers is `blocksFor(screen)` in the
 * app (`apps/mobile/src/lib/home/screens.ts`, ADR 0054 §2), read where the palette is
 * drawn, so this file holds no second list of blocks.
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

const shipped = new Map<ConfigurableScreen, HomeLayout>();

/** The document the app ships for a screen, as the core reads it. Home's is `SHIPPED`. */
export function shippedOf(screen: ConfigurableScreen): HomeLayout {
  if (screen === 'home') return SHIPPED;
  let layout = shipped.get(screen);
  if (!layout) {
    const parsed = parseHomeLayout(SCREEN_DOCUMENTS[screen], undefined, screen).layout;
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
