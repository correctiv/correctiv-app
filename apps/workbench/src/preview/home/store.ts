import type { HomeLayout } from '@correctiv/app-core/lib/home-layout';

import { differs } from './document';
import { CONFIGURABLE_SCREENS, shippedOf, type ConfigurableScreen } from './screens';
import { publish, restore, restorable } from './write';

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
 * The screens whose document is a shared draft nobody has written to yet, and what an
 * arrival said that was not about a document. Both are ADR 0076 §3's, both are cleared by
 * the next write, and both are read through the same `listeners` as the documents: a panel
 * that re-renders when its document does re-renders for these too, and a second
 * subscription for one word of news would be one more thing to keep in step.
 */
const incoming = new Set<ConfigurableScreen>();
type Notice = 'damaged' | null;
let notice: Notice = null;

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
  incoming.delete(screen);
  notice = null;
  for (const listener of listeners) listener();
}

/**
 * A document that arrived in a shared link, held rather than published.
 *
 * **Held and not published, and that is the whole argument for the function existing.**
 * Publishing is how the framed app is told to draw a document, and the framed app reads it
 * out of `localStorage` — the only channel the two halves share ([ADR 0014](../../../../../adr/0014-the-preview-shell-as-a-package.md)).
 * So a draft that came in a link would land in the storage of whoever opened it, over a
 * draft of their own that they may not have submitted yet. The failure `restore()` records
 * in its own header is the same one arriving from the other end: the editor on a document
 * nobody meant to replace, and the first edit writing the wrong file.
 *
 * So the incoming draft is the document this tool shows and nothing else. The frame keeps
 * drawing what this machine holds, the panel says where its document came from
 * (`incomingOf`), and a reload brings the local one back. Submitting it stays on offer — a
 * reviewer who has read it and agrees is exactly who the submission path is for
 * (ADR 0061 §1).
 *
 * Returns whether it took it: a document the core refuses is a link that cannot be opened,
 * and the caller says so in the one sentence it has (ADR 0076 §3).
 */
export function holdIncoming(of: ConfigurableScreen, document: string): boolean {
  let parsed: HomeLayout | null;
  try {
    parsed = restorable(JSON.parse(document));
  } catch {
    parsed = null;
  }
  if (parsed === null) {
    notice = 'damaged';
    for (const listener of listeners) listener();
    return false;
  }
  layouts.set(of, parsed);
  incoming.add(of);
  notice = null;
  for (const listener of listeners) listener();
  return true;
}

/**
 * Whether the document of this screen is one a link brought in and nothing has been
 * written to since.
 *
 * **A flag beside the document rather than in the address**, because the address cannot
 * hold it: the draft is written out of the address on arrival (ADR 0076 §3), so a link
 * that carried one and were rewritten would name a document the tool has moved on from.
 * The first edit clears it, and that is the moment the draft becomes the editor's own —
 * from there it is published like any other.
 */
export function incomingOf(of: ConfigurableScreen): boolean {
  return incoming.has(of);
}

/**
 * What an arrival said that is not about a document: `'damaged'` where a link carried
 * something this editor will not open. Null for a clean arrival and after the next edit.
 *
 * It has no screen, because there was no document to put it on — that is what makes it
 * different from `incomingOf`, and why two pieces of state answer one arrival.
 */
export function noticeOf(): Notice {
  return notice;
}

/**
 * That a link arrived carrying nothing this editor can open.
 *
 * Separate from `holdIncoming`'s own refusal because this one has no document to put it on:
 * the bytes would not decode, or the envelope named a screen that does not exist. The panel
 * says one sentence about it and carries on with the document it had.
 */
export function noteDamaged(): void {
  if (notice === 'damaged') return;
  notice = 'damaged';
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
  incoming.clear();
  notice = null;
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
