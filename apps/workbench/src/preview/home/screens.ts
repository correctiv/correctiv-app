import { CirclePlay, Compass, House, User, Users, type LucideIcon } from 'lucide-react';

import {
  HOME_LAYOUT_VERSION,
  parseHomeLayout,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';
import {
  CONFIGURABLE_SCREENS,
  isCustomScreenId,
  isDeclaredScreen,
  type ConfigurableScreen,
  type ScreenId,
} from '@correctiv/app-core/lib/screen-layout';

import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';
import { DEMO_SCREENS } from '@correctiv/app-core/data/layouts/demo/bundle';
import { governs, SHIPPED } from './document';

/**
 * What the screen editor knows about each screen: its name, where the frame goes to show
 * it, and the document the app ships for it.
 *
 * The palette is not here. Which blocks a screen offers, and in which groups, is
 * `blocksByCategory()` in the core (ADR 0073 §2), read where the palette is drawn,
 * so this file holds no second list of blocks.
 */

export { CONFIGURABLE_SCREENS, type ConfigurableScreen, type ScreenId };

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

/**
 * The documents under the demo layout's `screens/` that no declared screen owns: the screens the
 * newsroom made and a pull request has merged (ADR 0075 §7).
 *
 * Read at build time with Vite's own glob, so this site knows the list without a server,
 * and in the published build as well as in development. A file whose name is not a valid
 * id is left out, which is the same rule the route and the check apply to a key.
 */
const FILES = import.meta.glob<unknown>(
  '../../../../../packages/app-core/src/data/layouts/demo/screens/*.json',
  { eager: true, import: 'default' },
);

const REPOSITORY_SCREENS: ReadonlyMap<string, unknown> = new Map(
  Object.entries(FILES).flatMap(([path, document]) => {
    const id = /([^/]+)\.json$/.exec(path)?.[1];
    return id !== undefined && !isDeclaredScreen(id) && isCustomScreenId(id)
      ? [[id, document]]
      : [];
  }),
);

/** The custom screens the repository carries, sorted so that the list does not move. */
export function repositoryScreenIds(): string[] {
  return [...REPOSITORY_SCREENS.keys()].sort();
}

/** Whether a merged file carries this id, which decides if deleting it is a submission. */
export function inRepository(screen: string): boolean {
  return REPOSITORY_SCREENS.has(screen);
}

/**
 * What a screen the repository does not have yet starts from: no sections and no name,
 * so that it differs from anything a person has typed and is always a change to submit.
 */
const BLANK: HomeLayout = {
  version: HOME_LAYOUT_VERSION,
  words: null,
  sections: [],
  moments: [],
  editions: [],
};

/** A new screen's first document: a name and nothing on it. */
export function blankScreen(title: string): HomeLayout {
  return { ...BLANK, words: { title: { de: title } } };
}

const shipped = new Map<string, HomeLayout>();

/**
 * The document the app ships for a screen, as the core reads it. Home's is `SHIPPED`.
 * A custom screen is shipped once a pull request has merged its file, and before that it is
 * `BLANK`, which no document equals.
 */
export function shippedOf(screen: ScreenId): HomeLayout {
  if (screen === 'home') return SHIPPED;
  let layout = shipped.get(screen);
  if (!layout) {
    const document = isDeclaredScreen(screen)
      ? DEMO_SCREENS[screen]
      : REPOSITORY_SCREENS.get(screen);
    if (document === undefined) return BLANK;
    const parsed = parseHomeLayout(document).layout;
    if (!parsed) throw new Error(`the bundled ${screen} document does not parse`);
    layout = parsed;
    shipped.set(screen, layout);
  }
  return layout;
}

/** The frame's route for any screen: a declared one's own, a custom one's `/s/<id>` (ADR 0075 §7). */
export function routeOf(screen: ScreenId): string {
  return isDeclaredScreen(screen) ? SCREEN_ROUTES[screen] : `/s/${screen}`;
}

/**
 * The screen a frame route shows, or `null` for a route that is none (the article
 * reader, settings…). The picker's way back: it takes the frame to a screen, this
 * takes the editor to the screen the frame is on, so a tap inside the app is followed.
 *
 * A custom screen's route is `/s/<id>`, and the id is returned whether or not the editor
 * holds that screen: the caller decides if it is one it knows (`isScreen`), so a tap on a
 * link to a screen the repository does not carry does not open an editor on nothing.
 */
export function screenOfRoute(route: string | undefined): ScreenId | null {
  const declared = CONFIGURABLE_SCREENS.find((of) => governs(route, SCREEN_ROUTES[of]));
  if (declared) return declared;
  if (route === undefined) return null;
  const id = /^\/s\/([^/]+)$/.exec(route.split(/[?#]/)[0]!.replace(/\/+$/, ''))?.[1];
  return id !== undefined && isCustomScreenId(id) ? id : null;
}

/**
 * Whether a name is one the editor can hold a document for: a declared screen, or a valid
 * custom id. Whether a custom screen exists is the store's question (`customScreenIds`):
 * a shared draft may bring a screen this browser has never seen, and it is held as one.
 */
export function isScreen(value: string | null): value is ScreenId {
  return value !== null && (isDeclaredScreen(value) || isCustomScreenId(value));
}
