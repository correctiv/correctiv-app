import {
  HOME_LAYOUT_VERSION,
  parseHomeLayout,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';

import { isScreenId, type ScreenId } from '@correctiv/app-core/lib/screen-layout';

import docsModule from 'virtual:docs';

import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';
import { issueAddress, issueFor, layoutPayload, type Via } from '../submission';
import { differs, formatLayoutDocument, HOME_LAYOUT_ENDPOINT } from './document';
import {
  DEMO_LAYOUT,
  HOME_LAYOUT_KEY,
  layoutDraftKey,
  LAYOUT_SET_KEY,
  NAVIGATION_KEY,
  navigationDraftKey,
} from './names';
import { inRepository, shippedOf } from './screens';

/**
 * The three ways a change leaves the page: into the running app, into a GitHub issue that
 * CI turns into a pull request, and on a dev server into the developer's own checkout.
 *
 * Split from `document.ts` because that file is imported by the dev server and this one
 * cannot be: `import.meta.env` is Vite's, `window` is the browser's, and either of them
 * evaluated while Vite loads its own config is a site that does not start. Everything
 * here touches one or the other.
 */

/**
 * What a draft key holds when the person deleted a screen the repository carries. The file
 * stays in `main` until a submission merges, so the deletion is a draft like any other: it
 * outlives a reload for as long as the draft does, and Discard takes it back.
 */
const DELETED = '{"deleted":true}';

/** What a layout's draft says about a screen: a document, a deletion, or nothing. */
export type Draft = HomeLayout | 'deleted' | null;

function isDeletion(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && (raw as { deleted?: unknown }).deleted === true;
}

/**
 * The draft this tool holds for one screen of one layout, read out of storage.
 *
 * Anything the core will not take cleanly is `null` rather than loaded for repair: the
 * editor's vocabulary cannot express a broken document, so opening on one would give a
 * person a list they can move around and never make valid.
 */
export function readDraft(layout: string, screen: ScreenId): Draft {
  ensureMigrated();
  try {
    const raw = window.localStorage.getItem(layoutDraftKey(layout, screen));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDeletion(parsed) ? 'deleted' : restorable(parsed);
  } catch {
    return null;
  }
}

/**
 * Keep a screen's document as this layout's draft, or drop the draft when the document is
 * what the repository carries: a draft that is written once and then matches for ever is a
 * state nobody can see and nobody clears.
 */
export function writeDraft(layout: string, screen: ScreenId, document: HomeLayout): void {
  try {
    if (inRepository(screen, layout) && !differs(document, shippedOf(screen, layout)))
      window.localStorage.removeItem(layoutDraftKey(layout, screen));
    else
      window.localStorage.setItem(layoutDraftKey(layout, screen), formatLayoutDocument(document));
  } catch {
    // Site data switched off. Nothing can be kept, and nothing may throw.
  }
}

/** Mark a screen deleted for this layout, or forget it altogether when no file carries it. */
export function writeDeletion(layout: string, screen: ScreenId): void {
  try {
    if (inRepository(screen, layout))
      window.localStorage.setItem(layoutDraftKey(layout, screen), DELETED);
    else window.localStorage.removeItem(layoutDraftKey(layout, screen));
  } catch {
    // Site data switched off.
  }
}

export function dropDraft(layout: string, screen: ScreenId): void {
  try {
    window.localStorage.removeItem(layoutDraftKey(layout, screen));
  } catch {
    // Site data switched off.
  }
}

/** Every screen this browser holds a draft or a deletion of, for one layout. */
export function draftedScreens(layout: string): { id: string; deleted: boolean }[] {
  ensureMigrated();
  const out: { id: string; deleted: boolean }[] = [];
  try {
    const prefix = layoutDraftKey(layout, '');
    for (let at = 0; at < window.localStorage.length; at += 1) {
      const key = window.localStorage.key(at);
      if (!key?.startsWith(prefix)) continue;
      const id = key.slice(prefix.length);
      if (!isScreenId(id)) continue;
      const draft = readDraft(layout, id);
      if (draft !== null) out.push({ id, deleted: draft === 'deleted' });
    }
  } catch {
    // No storage: the repository's screens are all there is.
  }
  return out;
}

/**
 * What the screen is for this layout: the draft this browser holds, else the file the
 * repository carries.
 */
export function restore(screen: ScreenId, layout: string): HomeLayout {
  const draft = readDraft(layout, screen);
  return draft === null || draft === 'deleted' ? shippedOf(screen, layout) : draft;
}

/**
 * Put a whole layout where the framed app will find it: the navigation and every screen,
 * under one key (ADR 0080 §2).
 *
 * The shell and the app are one origin, so `window.localStorage` here **is** the app's,
 * which is the whole mechanism `frame/seed.ts` already runs on. A write fires a `storage`
 * event in every other same-origin document, the frame is one, and the app redraws without
 * a reload. No dev handle, so this works against the published export too.
 *
 * **Always written, even for a layout nobody has edited.** The app draws the whole of what
 * is under this key and nothing else, which is how a screen of the layout that is not
 * chosen cannot show through; leaving the key out for an unedited layout would let the
 * app's own bundle answer for it.
 */
export function publishFrame(
  layout: string,
  navigation: unknown,
  screens: Readonly<Record<string, unknown>>,
): void {
  try {
    window.localStorage.setItem(LAYOUT_SET_KEY, JSON.stringify({ layout, navigation, screens }));
  } catch {
    // Site data switched off. Nothing can be previewed, and nothing may throw.
  }
}

let migrated = false;

/** Moves the older keys on the first read of any draft, and then never again in this page. */
export function ensureMigrated(): void {
  if (!migrated) migrateLegacy();
}

/** Lets a test put storage back as an older visit left it and have it read again. */
export function forgetMigration(): void {
  migrated = false;
}

/**
 * The tool's older keys, read once: before layouts, the draft of a screen lived at the
 * app's own per-screen key and the navigation's at `workbench:navigation`, and both were
 * `demo`'s, the only layout the tool could edit. They become `demo`'s drafts under the new
 * keys and are removed, so nothing is read from them or written to them again, and the
 * app's per-screen seam is not a place this tool leaves anything in.
 *
 * Never over a draft that is already there: a person who has been on the new keys has
 * moved on from what an old key says.
 */
export function migrateLegacy(): void {
  migrated = true;
  try {
    const legacy: string[] = [];
    for (let at = 0; at < window.localStorage.length; at += 1) {
      const key = window.localStorage.key(at);
      if (key === null) continue;
      const screen = key === HOME_LAYOUT_KEY ? 'home' : key.slice('workbench:layout:'.length);
      if (key === HOME_LAYOUT_KEY || (key.startsWith('workbench:layout:') && isScreenId(screen)))
        legacy.push(key);
    }
    for (const key of legacy) {
      const screen = key === HOME_LAYOUT_KEY ? 'home' : key.slice('workbench:layout:'.length);
      const target = layoutDraftKey(DEMO_LAYOUT, screen);
      if (window.localStorage.getItem(target) === null)
        window.localStorage.setItem(target, window.localStorage.getItem(key) ?? '');
      window.localStorage.removeItem(key);
    }
    const navigation = window.localStorage.getItem(NAVIGATION_KEY);
    if (navigation !== null) {
      if (window.localStorage.getItem(navigationDraftKey(DEMO_LAYOUT)) === null)
        window.localStorage.setItem(navigationDraftKey(DEMO_LAYOUT), navigation);
      window.localStorage.removeItem(NAVIGATION_KEY);
    }
  } catch {
    // Site data switched off.
  }
}

/**
 * A stored document the editor can open, or null.
 *
 * **An older version is opened, and renumbered.** A version 2 document is a version 3
 * document with no editions, so the only thing wrong with it is its number, which the
 * parser reports as `version-unknown`. Refusing it for that opened the editor on the shipped
 * file while the frame went on drawing the stored one, and the first edit then overwrote a
 * person's work with the shipped file plus that edit: found by a cold review of #247. Any
 * other problem still refuses, and so does a version from a later editor, whose document
 * this one may not be able to write back whole.
 */
export function restorable(document: unknown): HomeLayout | null {
  const { layout, problems } = parseHomeLayout(document);
  if (!layout) return null;
  const older = layout.version < HOME_LAYOUT_VERSION;
  const only = problems.every((problem) => older && problem.code === 'version-unknown');
  if (!only) return null;
  return older ? { ...layout, version: HOME_LAYOUT_VERSION } : layout;
}

/**
 * What a save says to the person, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/home.ts`.
 *
 * `wbMessage()` and not `defineMessages`, because this module may not import
 * React: `document.ts` beside it is read by the dev server, and this one holds the
 * half that touches `window` and `import.meta.env`. Adding `react-intl` here would
 * put React in the way of both. One descriptor per call, which
 * `src/i18n/messages.ts` explains.
 *
 * **The problem CODES stay as they are.** `LayoutProblemCode` is the vocabulary the
 * core refuses a document in, and a person looking at a refusal wants the code that
 * fired rather than a second gloss on it — in any language. The server's own
 * sentence and the browser's own error message are not ours either, so both are
 * shown as they arrive.
 */
const COPY = {
  written: wbMessage({
    id: 'home.save.written',
    defaultMessage: 'Written to {path}.',
    description:
      'Confirms that the dev server wrote the document. {path} is the repository path it wrote, or home.save.repository where the server named none.',
  }),
  repository: wbMessage({
    id: 'home.save.repository',
    defaultMessage: 'the repository',
    description:
      'Stands where a path would inside home.save.written, on the one answer that reports success without naming a file.',
  }),
  refusedWith: wbMessage({
    id: 'home.save.refusedWith',
    defaultMessage: '{said} ({codes})',
    description:
      'A refusal that came with codes. {said} is the dev server’s own sentence, which is not translated; {codes} is a comma-separated list of LayoutProblemCode, which is the core’s vocabulary and is never translated.',
  }),
  http: wbMessage({
    id: 'home.save.http',
    defaultMessage: 'HTTP {status}',
    description:
      'Stands in for a refusal the server sent no sentence with. {status} is the numeric response status.',
  }),
  issueHeadingScreen: wbMessage({
    id: 'home.issue.headingScreen',
    defaultMessage: 'Changes to the {screen} screen of the {layout} layout',
    description:
      'The title of the GitHub issue Submit changes opens, after a fixed tag in square brackets that is not translated. {screen} is the screen’s id, such as entdecken, and {layout} the layout’s, such as ship; neither is translated.',
  }),
  issueHeadingDelete: wbMessage({
    id: 'home.issue.headingDelete',
    defaultMessage: 'Delete the {screen} screen from the {layout} layout',
    description:
      'The title of the GitHub issue that asks for a screen the newsroom made to be deleted, after a fixed tag in square brackets that is not translated. {screen} is the screen’s id, such as kampagne, and {layout} the layout’s, such as demo; neither is translated.',
  }),
  issueLeadLayout: wbMessage({
    id: 'home.issue.leadLayout',
    defaultMessage:
      'This change to a screen comes from the workbench. Click “Create” below. A pull request is then made automatically, and this issue will link to it. Please leave the block below as it is.',
    description:
      'The first paragraph of the GitHub issue Submit changes opens for a screen other than Home, above the document. home.issue.lead is the same sentence for Home. “Create” is GitHub’s own button on that page, which GitHub labels in English, so it stays in English.',
  }),
  issueHelp: wbMessage({
    id: 'home.issue.help',
    defaultMessage:
      'The change was too long for the link, so it is on your clipboard. Delete this text, paste the change here (Ctrl+V, or Cmd+V on a Mac) and click “Create”.',
    description:
      'Stands in the body of the GitHub issue instead of the change, when the change is too long to go in the address. “Create” is GitHub’s own button and stays in English.',
  }),
};

/** Formats one of the descriptors above. The caller has an `intl`; this module may not. */
export type Format = (message: WorkbenchMessage, values?: Record<string, string>) => string;

export interface SaveResult {
  ok: boolean;
  /** What to show the person: the file that was written, or why it was not. */
  message: string;
}

/**
 * Whether Save is on offer at all.
 *
 * `import.meta.env.DEV` is the honest test and not a probe: `vite build` sets it false,
 * so the published site cannot reach a server that would answer, and the interface says
 * so beside the button rather than letting somebody find out by pressing it. That is the
 * shape the Tokens tool already has for a thing it cannot write — "Nothing is written to
 * the repository; Copy CSS is how a proposal leaves this page."
 */
export const canSave: boolean = import.meta.env.DEV;

/**
 * Write the document into the repository, which only the dev server can do.
 *
 * The body is already `formatLayoutDocument`'s output, and the endpoint prints it again
 * from its own parse rather than trusting it. Both are the same function; the second
 * call is what makes the file on disk formatted whatever reached the socket.
 *
 * `format` is handed in rather than reached for, which is what lets the message a
 * person reads follow the language setting without this module importing React.
 * `nav.ts` passes a formatter the same way and for the same reason.
 */
export async function save(
  layout: HomeLayout,
  format: Format,
  screen: ScreenId,
  layoutId: string,
): Promise<SaveResult> {
  try {
    const response = await fetch(`${HOME_LAYOUT_ENDPOINT}?layout=${layoutId}&screen=${screen}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: formatLayoutDocument(layout),
    });
    const body = (await response.json()) as {
      path?: string;
      error?: string;
      problems?: { code: string }[];
    };
    if (!response.ok) {
      // The codes, not only the sentence. `LayoutProblemCode` is the vocabulary the core
      // reports a fault in, and a person looking at a refusal wants the one that fired,
      // not a second English gloss on it.
      const codes = (body.problems ?? []).map((problem) => problem.code).join(', ');
      const said = body.error ?? format(COPY.http, { status: String(response.status) });
      return { ok: false, message: codes ? format(COPY.refusedWith, { said, codes }) : said };
    }
    return {
      ok: true,
      message: format(COPY.written, { path: body.path ?? format(COPY.repository) }),
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * What Submit changes opens: GitHub's new-issue page with the change already in it.
 *
 * [ADR 0061](../../../../../adr/0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md)
 * §1. The person clicks GitHub's own "Create", and `.github/workflows/submission.yml`
 * turns the issue into a pull request. The workbench holds nothing to do it with, which
 * is ADR 0058 §1: the person arrives on github.com signed in as themselves, and there is
 * no credential on `correctiv.github.io` for anything else there to read.
 *
 * The issue's words follow the page's language, because they are for the person on
 * GitHub. The payload is the document Save would write, on one line, and the prefix in
 * the title is `src/preview/submission.ts`'s and never translated, because the workflow
 * matches on it.
 *
 * `fits` is false when the whole issue would make the address too long. The link then
 * carries a sentence asking the person to paste, and `body` is what the click puts on the
 * clipboard (`copyNow`).
 */
export interface Submit {
  href: string;
  fits: boolean;
  body: string;
}

export function submission(
  layout: HomeLayout,
  format: Format,
  screen: ScreenId,
  layoutId: string,
  via?: Via,
): Submit {
  // Minified: the printed document spends most of its address on indentation, measured
  // at 2,112 against 1,320 encoded characters for the shipped day. CI prints it again
  // with `formatLayoutDocument`, so what reaches the repository is formatted either way,
  // and one line of JSON is still readable to a maintainer looking at the issue.
  const payload = JSON.stringify(JSON.parse(formatLayoutDocument(layout)));
  // Every screen goes in an envelope that names the layout and the screen, because the
  // payload is all the workflow reads (ADR 0061 §2, ADR 0078 §6). A screen is named by its
  // id in the issue's title: the id is the one name the core has checked, and the title is
  // the part of an issue the workflow matches on.
  const issue = issueFor('layout', layoutPayload(screen, payload, via, layoutId), {
    heading: format(COPY.issueHeadingScreen, { screen, layout: layoutId }),
    lead: format(COPY.issueLeadLayout),
  });
  const { href, fits } = issueAddress(docsModule.repo, issue, format(COPY.issueHelp));
  return { href, fits, body: issue.body };
}

/**
 * What deleting a screen the repository carries opens: the same issue as `submission`, with
 * a document of `null`, which the workflow reads as the file's deletion (ADR 0075 §7).
 *
 * Only for a screen that is in the repository. One that was only ever a draft has nothing to
 * delete there, and `deleteScreen` in `./store.ts` is the whole of it.
 */
export function deletion(screen: ScreenId, layoutId: string, format: Format): Submit {
  const issue = issueFor('layout', layoutPayload(screen, 'null', undefined, layoutId), {
    heading: format(COPY.issueHeadingDelete, { screen, layout: layoutId }),
    lead: format(COPY.issueLeadLayout),
  });
  const { href, fits } = issueAddress(docsModule.repo, issue, format(COPY.issueHelp));
  return { href, fits, body: issue.body };
}
