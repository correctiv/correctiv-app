import type { HomeLayout } from '@correctiv/app-core/lib/home-layout';

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

let layout: HomeLayout | null = null;
const listeners = new Set<Listener>();

/**
 * Lazy, and not module scope. `restore()` reads `localStorage`, and a module evaluated
 * while the bundle loads is one more thing that has to work before the site can draw.
 */
export function getLayout(): HomeLayout {
  layout ??= restore();
  return layout;
}

export function subscribeLayout(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setLayout(next: HomeLayout): void {
  layout = next;
  publish(next);
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
