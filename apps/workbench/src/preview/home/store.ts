import type { HomeLayout } from '@correctiv/app-core/lib/home-layout';
import {
  customScreenIdFault,
  type CustomScreenIdFault,
} from '@correctiv/app-core/lib/screen-layout';

import { formatNavigationDocument } from '../navigation/document';
import {
  getNavigation,
  publishNavigation,
  resetNavigation,
  restoreNavigation,
  setNavigation,
  subscribeNavigation,
} from '../navigation/store';
import { activeLayout, setActiveLayout } from './active';
import { differs, formatLayoutDocument } from './document';
import {
  blankScreen,
  fallbackTitle,
  inRepository,
  isLayout,
  repositoryScreenIds,
  shippedNavigationOf,
  shippedOf,
  type ScreenId,
} from './screens';
import { joinedLength } from './size';
import {
  draftedScreens,
  dropDraft,
  publishFrame,
  readDraft,
  restorable,
  restore,
  writeDeletion,
  writeDraft,
} from './write';

/**
 * The edited documents of the open layout, held outside the component that renders them.
 *
 * `preview/store.ts` is the same arrangement one rung up, for a version of the same
 * reason: every write goes into `localStorage` as it happens (`setLayout` keeps the draft
 * and tells the frame before it tells React anything changed), so the framed app is never
 * showing a document this one has moved on from. The browser's own `storage` event cannot
 * serve as the subscription here: it is fired in every same-origin document EXCEPT the one
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
 *
 * **Of one layout at a time** (ADR 0080): what is held here is the open layout's, and
 * `selectLayout` drops it. Nothing is lost by that, because every edit is a draft in
 * storage under its layout's own key before it is anything else.
 *
 * `screen` is the id of a screen the layout may not carry: a layout with no screen at all
 * has to have an answer to "which is open", and `screenExists` is how a panel finds out
 * that the answer is a placeholder.
 */
let screen: ScreenId = 'home';
const layouts = new Map<ScreenId, HomeLayout>();
const listeners = new Set<Listener>();

/**
 * The screens whose document is a shared draft nobody has written to yet, and what an
 * arrival said that was not about a document. Both are ADR 0076 §3's, both are cleared by
 * the next write, and both are read through the same `listeners` as the documents: a panel
 * that re-renders when its document does re-renders for these too, and a second
 * subscription for one word of news would be one more thing to keep in step.
 */
const incoming = new Set<ScreenId>();
type Notice = 'damaged' | null;
let notice: Notice = null;

/**
 * The screens this session knows beyond the repository's and the storage's: one that
 * arrived in a link and is held, not yet written anywhere. Their documents are in `layouts`.
 */
const session = new Set<string>();

function notify(): void {
  for (const listener of listeners) listener();
}

/**
 * Lazy, and not module scope. `restore()` reads `localStorage`, and a module evaluated
 * while the bundle loads is one more thing that has to work before the site can draw.
 */
export function screenLayoutOf(of: ScreenId): HomeLayout {
  let held = layouts.get(of);
  if (!held) {
    held = restore(of, activeLayout());
    layouts.set(of, held);
  }
  return held;
}

/**
 * The screens of the open layout, each once and in name order: the repository's, minus the
 * ones deleted as a draft, plus the ones this browser holds a draft of and the ones received
 * in a link this session. **Every screen alike** (ADR 0078 §4): there is no list of five.
 *
 * Read from `localStorage` because that is where the frame's layout is built from, so what
 * the frame can draw and what this lists are one answer. A key whose document the editor
 * would not open is left out, as `restore` leaves it out.
 */
export function screenIds(): string[] {
  const layout = activeLayout();
  const ids = new Set<string>([...repositoryScreenIds(layout), ...session]);
  for (const drafted of draftedScreens(layout)) {
    if (drafted.deleted) ids.delete(drafted.id);
    else ids.add(drafted.id);
  }
  return [...ids].sort();
}

/** `screenIds` as a string, which is a snapshot `useSyncExternalStore` can compare. */
export function screensSnapshot(): string {
  return screenIds().join('\n');
}

/**
 * The screens of the open layout the repository carries that the person deleted and has not
 * yet submitted: a draft like any other, kept in storage, so a reload leaves them deleted
 * for as long as the draft is kept and Discard takes them back (ADR 0080 §3).
 */
export function deletedScreenIds(): string[] {
  return draftedScreens(activeLayout())
    .filter((drafted) => drafted.deleted && inRepository(drafted.id))
    .map((drafted) => drafted.id)
    .sort();
}

/** `deletedScreenIds` as a string, for `useSyncExternalStore`. */
export function deletedSnapshot(): string {
  return deletedScreenIds().join('\n');
}

/** Whether the screen being edited is one the layout carries. False for the placeholder of an empty layout. */
export function screenExists(of: ScreenId = screen): boolean {
  return screenIds().includes(of);
}

/** The id and the name of a screen, in its own title when it has one. */
export function screenTitle(of: ScreenId): string {
  return screenLayoutOf(of).words?.title.de ?? fallbackTitle(of);
}

/** The core's faults and one of this tool's: a name in use. */
export type NewScreenFault = CustomScreenIdFault | 'taken';

/**
 * Why a new screen cannot be called `id`, or null when it can: the core's own rule, and a
 * second reason of this tool's, that the name is taken. Nothing else is held back, the five
 * names of the demo included (ADR 0078 §4).
 */
export function newScreenFault(id: string): NewScreenFault | null {
  const fault = customScreenIdFault(id);
  if (fault !== null) return fault;
  return screenIds().includes(id) ? 'taken' : null;
}

/**
 * The open screen is one the layout carries, or the first it does: what is open after a
 * deletion or a change of layout. The id of the placeholder is `home`, for no better
 * reason than that a layout with nothing in it has to be asked about something.
 */
function chooseScreen(): void {
  const ids = screenIds();
  if (!ids.includes(screen)) screen = ids[0] ?? 'home';
}

/**
 * Tells the frame what the open layout is: its navigation and every screen, as the tool
 * holds them (ADR 0080 §2). A document that arrived in a link is **not** in it, for the
 * reason `holdIncoming` gives: the frame keeps drawing what this machine holds.
 */
export function publishLayout(): void {
  const layout = activeLayout();
  const screens: Record<string, unknown> = {};
  for (const id of screenIds()) {
    const held = incoming.has(id);
    // A screen that is only held from a link, with nothing kept and nothing in the
    // repository, has no document to draw.
    if (held && readDraft(layout, id) === null && !inRepository(id, layout)) continue;
    const document = held ? restore(id, layout) : screenLayoutOf(id);
    screens[id] = JSON.parse(formatLayoutDocument(document));
  }
  publishFrame(layout, JSON.parse(formatNavigationDocument(getNavigation())), screens);
}

// The navigation is the other half of the layout: the frame follows it too.
subscribeNavigation(publishLayout);

/**
 * Drops every draft that has come to equal the repository's file, which is the state each
 * successful save leaves behind (the file changes, Vite reloads the page, and the draft is
 * then a copy of it). A draft nobody can tell from the file is a key nobody can see and
 * nobody clears.
 */
function settleDrafts(): void {
  const layout = activeLayout();
  // The stored drafts, and never what is held: a document that arrived in a link is not
  // this machine's to write (`holdIncoming`).
  for (const drafted of draftedScreens(layout)) {
    const draft = readDraft(layout, drafted.id);
    if (draft !== null && draft !== 'deleted') writeDraft(layout, drafted.id, draft);
  }
  publishNavigation(restoreNavigation());
}

/** The layout the tool is on. */
export function getLayoutId(): string {
  return activeLayout();
}

/**
 * Opens another layout: the documents held are dropped (each is a draft in storage already),
 * the open screen is the first the new layout carries, and the frame is told the new layout
 * whole. An id that is no folder is no layout, and the tool stays where it is.
 */
export function selectLayout(next: string): boolean {
  if (!isLayout(next)) return false;
  if (next !== activeLayout()) {
    setActiveLayout(next);
    layouts.clear();
    incoming.clear();
    session.clear();
    notice = null;
    resetNavigation();
  }
  settleDrafts();
  chooseScreen();
  publishLayout();
  notify();
  return true;
}

/**
 * Makes a screen the newsroom thinks of, with its German title and nothing on it, and opens
 * it. Returns why not instead when the id cannot name one (ADR 0075 §7).
 */
export function createScreen(id: string, title: string): NewScreenFault | null {
  const fault = newScreenFault(id);
  if (fault !== null) return fault;
  const hadScreens = screenIds().length > 0;
  const layout = blankScreen(title.trim());
  layouts.set(id, layout);
  writeDraft(activeLayout(), id, layout);
  listFirstScreen(id, hadScreens);
  screen = id;
  incoming.delete(id);
  notice = null;
  publishLayout();
  notify();
  return null;
}

/**
 * Takes a screen away from the editor, the frame and the navigation, and opens the next.
 *
 * **A draft until it is submitted.** The file stays in the repository until a submission
 * merges (`deletion` in `./write.ts` opens that), so a screen the repository carries is
 * marked deleted in storage: a reload leaves it deleted for as long as the draft is kept,
 * and Discard brings it back. A screen that was only ever a draft is gone for good. The
 * navigation drops the tab, because the check refuses a tab that names no screen.
 */
export function deleteScreen(of: ScreenId): void {
  layouts.delete(of);
  session.delete(of);
  incoming.delete(of);
  writeDeletion(activeLayout(), of);
  const navigation = getNavigation();
  if (navigation.tabs.includes(of)) {
    setNavigation({ ...navigation, tabs: navigation.tabs.filter((tab) => tab !== of) });
  }
  chooseScreen();
  publishLayout();
  notify();
}

/** Takes a deletion back: the screen is the repository's again, as it was before the draft. */
export function restoreScreen(of: ScreenId): void {
  dropDraft(activeLayout(), of);
  layouts.delete(of);
  // And its tab, where the repository's navigation had it: deleting the screen took it off.
  const navigation = getNavigation();
  const at = shippedNavigationOf().tabs.indexOf(of);
  if (at !== -1 && !navigation.tabs.includes(of)) {
    const tabs = [...navigation.tabs];
    tabs.splice(Math.min(at, tabs.length), 0, of);
    setNavigation({ ...navigation, tabs });
  }
  screen = of;
  publishLayout();
  notify();
}

/** The document of the screen being edited. */
export function getLayout(): HomeLayout {
  return screenLayoutOf(screen);
}

export function getScreen(): ScreenId {
  return screen;
}

/** Opens another screen's document. The documents are untouched. */
export function setScreen(next: ScreenId): void {
  if (next === screen) return;
  screen = next;
  for (const listener of listeners) listener();
}

export function subscribeLayout(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Puts the first screen a layout gets on its navigation. An empty navigation draws the empty
 * state however many screens the layout carries, so a screen that nothing lists would stay
 * invisible to the frame (and to the app, once submitted) until somebody opened it by its
 * address. Only the first: the tabs of a layout that already has screens are the person's.
 */
function listFirstScreen(of: ScreenId, hadScreens: boolean): void {
  if (hadScreens) return;
  const navigation = getNavigation();
  if (navigation.tabs.includes(of)) return;
  setNavigation({ ...navigation, tabs: [...navigation.tabs, of] });
}

export function setLayout(next: HomeLayout): void {
  const hadScreens = screenIds().length > 0;
  layouts.set(screen, next);
  writeDraft(activeLayout(), screen, next);
  listFirstScreen(screen, hadScreens);
  incoming.delete(screen);
  notice = null;
  publishLayout();
  notify();
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
export function holdIncoming(of: ScreenId, document: string): boolean {
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
  session.add(of);
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
export function incomingOf(of: ScreenId): boolean {
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
 * The screens whose document differs from the repository's, or that were deleted, as one
 * comma-separated string so that it is a snapshot `useSyncExternalStore` can compare.
 * Empty for none.
 */
export function changedScreens(): string {
  const layout = activeLayout();
  return [
    ...screenIds().filter((of) => differs(screenLayoutOf(of), shippedOf(of, layout))),
    ...deletedScreenIds(),
  ].join(',');
}

/**
 * Puts every screen of the open layout back to the file the repository carries: the drafts
 * and the deletions go, and a screen that was only ever a draft goes with them. So does the
 * navigation's draft, which a deletion edits.
 */
export function discardScreens(): void {
  const layout = activeLayout();
  for (const drafted of draftedScreens(layout)) dropDraft(layout, drafted.id);
  setNavigation(shippedNavigationOf());
  layouts.clear();
  incoming.clear();
  session.clear();
  notice = null;
  chooseScreen();
  publishLayout();
  notify();
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

/**
 * The length of the document the deploy would publish from what is held now: every screen
 * as the editor has it, and the navigation beside them (ADR 0075 §7). A number, so that it
 * is a snapshot `useSyncExternalStore` can compare.
 */
export function joinedDocumentLength(): number {
  const screens: Record<string, string> = {};
  for (const of of screenIds()) {
    screens[of] = formatLayoutDocument(screenLayoutOf(of));
  }
  return joinedLength(screens, formatNavigationDocument(getNavigation()));
}

/** Subscribes to everything `joinedDocumentLength` reads: the screens and the navigation. */
export function subscribeJoined(listener: Listener): () => void {
  const stops = [subscribeLayout(listener), subscribeNavigation(listener)];
  return () => {
    for (const stop of stops) stop();
  };
}
