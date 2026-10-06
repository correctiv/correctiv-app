import {
  HOME_LAYOUT_VERSION,
  parseHomeLayout,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';
import {
  NAVIGATION_VERSION,
  parseNavigation,
  type Navigation,
} from '@correctiv/app-core/lib/navigation';
import { isLayoutId, isScreenId, type ScreenId } from '@correctiv/app-core/lib/screen-layout';

import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';
import { activeLayout } from './active';
import { DEMO_LAYOUT, SHIP_LAYOUT } from './names';

/**
 * What the screen editor knows about the layouts the repository carries: which there are,
 * which screens each holds, and the documents it ships (ADR 0078 §1).
 *
 * The palette is not here. Which blocks a screen offers, and in which groups, is
 * `blocksByCategory()` in the core (ADR 0073 §2), read where the palette is drawn,
 * so this file holds no second list of blocks.
 */

export type { ScreenId };

/**
 * A layout's name as the layout picker says it. `ship` and `demo` have words; any other
 * folder is named by its id, which is the one name the core has checked (ADR 0078 §1).
 */
export const LAYOUT_NAMES: Readonly<Record<string, WorkbenchMessage>> = {
  [SHIP_LAYOUT]: wbMessage({
    id: 'home.layout.ship',
    defaultMessage: 'Shipped',
    description:
      'The name of the layout the app ships with, in the layout picker of the preview toolbar. It is the one readers get, and it is empty until it has been agreed what goes onto the app.',
  }),
  [DEMO_LAYOUT]: wbMessage({
    id: 'home.layout.demo',
    defaultMessage: 'Demo',
    description:
      'The name of the example layout, in the layout picker of the preview toolbar. It holds five screens that show what the blocks can do, and no app bundles it.',
  }),
};

/**
 * Every document under `data/layouts/`, read at build time with Vite's own glob, so that
 * this site knows the list without a server, in development and in the published build. A
 * file whose name is not a valid id is left out, which is the rule the route and the check
 * apply to a key.
 */
const SCREEN_FILES = import.meta.glob<unknown>(
  '../../../../../packages/app-core/src/data/layouts/*/screens/*.json',
  { eager: true, import: 'default' },
);

const NAVIGATION_FILES = import.meta.glob<unknown>(
  '../../../../../packages/app-core/src/data/layouts/*/navigation.json',
  { eager: true, import: 'default' },
);

/** Layout id to screen id to document, as written. */
const REPOSITORY: ReadonlyMap<string, ReadonlyMap<string, unknown>> = (() => {
  const layouts = new Map<string, Map<string, unknown>>();
  for (const path of Object.keys(NAVIGATION_FILES)) {
    const layout = /layouts\/([^/]+)\/navigation\.json$/.exec(path)?.[1];
    if (layout !== undefined && isLayoutId(layout)) layouts.set(layout, new Map());
  }
  for (const [path, document] of Object.entries(SCREEN_FILES)) {
    const found = /layouts\/([^/]+)\/screens\/([^/]+)\.json$/.exec(path);
    const screens = found?.[1] === undefined ? undefined : layouts.get(found[1]);
    if (screens !== undefined && found?.[2] !== undefined && isScreenId(found[2]))
      screens.set(found[2], document);
  }
  return layouts;
})();

/**
 * The layouts there are, `ship` first, then `demo`, then the rest by name: the picker's
 * order, so that the one readers get is the one at the top. A folder somebody adds is listed
 * without a line here.
 */
export function layoutIds(): string[] {
  return [...REPOSITORY.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function rank(id: string): number {
  return id === SHIP_LAYOUT ? 0 : id === DEMO_LAYOUT ? 1 : 2;
}

/** Whether a folder of this name exists, which decides if a link or an address may name it. */
export function isLayout(value: string | null): value is string {
  return value !== null && REPOSITORY.has(value);
}

/** The screens a layout's folder carries, sorted so that the list does not move. */
export function repositoryScreenIds(layout: string = activeLayout()): string[] {
  return [...(REPOSITORY.get(layout)?.keys() ?? [])].sort();
}

/** Whether the folder carries this screen, which decides if deleting it is a submission. */
export function inRepository(screen: string, layout: string = activeLayout()): boolean {
  return REPOSITORY.get(layout)?.has(screen) ?? false;
}

const shippedNavigations = new Map<string, Navigation>();

/**
 * The navigation a layout's folder carries, as the core reads it. A folder without one (or
 * with one the core refuses, which the check keeps from `main`) has no entry, which is the
 * navigation of a layout with nothing in it.
 */
export function shippedNavigationOf(layout: string = activeLayout()): Navigation {
  let held = shippedNavigations.get(layout);
  if (!held) {
    const document = Object.entries(NAVIGATION_FILES).find(([path]) =>
      path.endsWith(`/layouts/${layout}/navigation.json`),
    )?.[1];
    held = (document === undefined ? null : parseNavigation(document).navigation) ?? {
      version: NAVIGATION_VERSION,
      maxTabs: 5,
      tabs: [],
    };
    shippedNavigations.set(layout, held);
  }
  return held;
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

/**
 * The name the screens of the demo layout have always been listed by when their document
 * carries no title of its own, which theirs do not: the app takes those words from its own
 * tab declarations. Display only, a string and not a message for the reason the names it
 * replaces were not (`Entdecken` is what the tab says); a screen with a title uses that.
 */
const FALLBACK_TITLES: Readonly<Record<string, string>> = {
  home: 'Home',
  entdecken: 'Entdecken',
  mediathek: 'Mediathek',
  mitmachen: 'Mitmachen',
  profil: 'Profil',
};

/** What a screen is listed as when its document names none: the demo's own word, or the id. */
export function fallbackTitle(screen: ScreenId): string {
  return FALLBACK_TITLES[screen] ?? screen;
}

const shipped = new Map<string, HomeLayout>();

/**
 * The document the repository carries for a screen of a layout, as the core reads it. A
 * screen that no merged file carries is `BLANK`, which no document equals, so a screen made
 * here is always a change to submit.
 */
export function shippedOf(screen: ScreenId, layout: string = activeLayout()): HomeLayout {
  const key = `${layout}/${screen}`;
  let held = shipped.get(key);
  if (!held) {
    const document = REPOSITORY.get(layout)?.get(screen);
    if (document === undefined) return BLANK;
    const parsed = parseHomeLayout(document).layout;
    if (!parsed) throw new Error(`the bundled ${key} document does not parse`);
    held = parsed;
    shipped.set(key, held);
  }
  return held;
}

/** The frame's route for any screen: `/s/<id>` (ADR 0075 §7, ADR 0079). */
export function routeOf(screen: ScreenId): string {
  return `/s/${screen}`;
}

/**
 * The screen a frame route shows, or `null` for a route that is none (the article
 * reader, settings, the start…). The picker's way back: it takes the frame to a screen, this
 * takes the editor to the screen the frame is on, so a tap inside the app is followed.
 *
 * The id is returned whether or not the editor holds that screen: the caller decides if it
 * is one it knows, so a tap on a link to a screen the layout does not carry does not open an
 * editor on nothing. **`/` is no screen's address** (ADR 0079 §1): it is whatever the
 * navigation starts on, which the editor cannot tell from the route.
 */
export function screenOfRoute(route: string | undefined): ScreenId | null {
  if (route === undefined) return null;
  const path = route.split(/[?#]/)[0]!.replace(/\/+$/, '');
  const id = /^\/s\/([^/]+)$/.exec(path)?.[1];
  return id !== undefined && isScreenId(id) ? id : null;
}

/** Whether a name is one the editor can hold a document for: any valid screen id. */
export function isScreen(value: string | null): value is ScreenId {
  return value !== null && isScreenId(value);
}
