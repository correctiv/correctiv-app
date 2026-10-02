import type { HomeLayout } from '@correctiv/app-core/lib/home-layout';

import { differs } from './document';
import { CONFIGURABLE_SCREENS, shippedOf, type ConfigurableScreen } from './screens';
import { publish, restore } from './write';

/**
 * The edited document, held outside the component that renders it.
 *
 * `preview/store.ts` is the same arrangement one rung up, for a version of the same
 * reason: every write goes into `localStorage` as it happens (`setLayout` calls
 * `publish` before it tells React anything changed), so the framed app is never showing
 * a document this one has moved on from. The browser's own `storage` event cannot serve
 * as the subscription here: it is fired in every same-origin document EXCEPT the one
 * that wrote, which is exactly this one — `useSyncExternalStore` is what lets the panel
 * read a value that changes outside its own render.
 */
type Listener = () => void;

/**
 * The screen the editor has open, and every screen's document it has read.
 *
 * One store for all of them, because the editor is one tool with a picker and not a tool
 * per screen: `getLayout()` and `setLayout()` mean "the document on the screen being
 * edited", which is what the list, the track and the calendar already asked for when
 * there was one. A document is read from storage the first time its screen is asked for
 * and kept, so a draft on Entdecken survives a visit to Mediathek and back.
 */
let screen: ConfigurableScreen = 'home';
const layouts = new Map<ConfigurableScreen, HomeLayout>();
const listeners = new Set<Listener>();

/**
 * Lazy, and not module scope. `restore()` reads `localStorage`, and a module evaluated
 * while the bundle loads is one more thing that has to work before the site can draw.
 */
export function screenLayoutOf(of: ConfigurableScreen): HomeLayout {
  let held = layouts.get(of);
  if (!held) {
    held = restore(of);
    layouts.set(of, held);
  }
  return held;
}

/** The document of the screen being edited. */
export function getLayout(): HomeLayout {
  return screenLayoutOf(screen);
}

export function getScreen(): ConfigurableScreen {
  return screen;
}

/** Opens another screen's document. The documents are untouched. */
export function setScreen(next: ConfigurableScreen): void {
  if (next === screen) return;
  screen = next;
  for (const listener of listeners) listener();
}

export function subscribeLayout(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLayout(next: HomeLayout): void {
  layouts.set(screen, next);
  publish(next, screen);
  for (const listener of listeners) listener();
}

/**
 * The screens whose document differs from the file, as one comma-separated string so that
 * it is a snapshot `useSyncExternalStore` can compare. Empty for none.
 */
export function changedScreens(): string {
  return CONFIGURABLE_SCREENS.filter((of) => differs(screenLayoutOf(of), shippedOf(of))).join(',');
}

/** Puts every screen back to the file the app ships. */
export function discardScreens(): void {
  for (const of of CONFIGURABLE_SCREENS) {
    layouts.set(of, shippedOf(of));
    publish(shippedOf(of), of);
  }
  for (const listener of listeners) listener();
}

/**
 * Which edition's popover is open, by id, or null for none.
 *
 * Here and not in `Edition.tsx`'s own state, because the popover lives in the panel and the
 * thing that opens it most often does not: a band on the week under the frame, or a drag
 * across days that has just made an edition and wants a title for it (ADR 0059 §2). Either
 * sets the id and moves the playhead to where edits land on that edition; the panel's head
 * then shows it and reads the id as its `open`.
 */
let openEdition: string | null = null;
const editionListeners = new Set<Listener>();

export function getOpenEdition(): string | null {
  return openEdition;
}

export function subscribeOpenEdition(listener: Listener): () => void {
  editionListeners.add(listener);
  return () => editionListeners.delete(listener);
}

export function setOpenEdition(id: string | null): void {
  if (openEdition === id) return;
  openEdition = id;
  for (const listener of editionListeners) listener();
}
