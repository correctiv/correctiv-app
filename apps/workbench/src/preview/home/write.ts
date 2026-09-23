import {
  HOME_LAYOUT_VERSION,
  parseHomeLayout,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';

import docsModule from 'virtual:docs';

import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';
import { issueAddress, issueFor } from '../submission';
import {
  differs,
  formatLayoutDocument,
  HOME_LAYOUT_ENDPOINT,
  HOME_LAYOUT_KEY,
  SHIPPED,
} from './document';

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
 * Put the edited document where the framed app will find it, or take it away again.
 *
 * The shell and the app are one origin, so `window.localStorage` here **is** the app's,
 * which is the whole mechanism `frame/seed.ts` already runs on. What is new is that the
 * app redraws without a reload: a write to `localStorage` fires a `storage` event in
 * every other same-origin document, the frame is one, and the app subscribes. No dev
 * handle, so this works against the published export too.
 *
 * A layout equal to the shipped one **removes** the key rather than writing a copy of
 * it. `/preview` with nothing edited must leave the app exactly as it ships, and a key
 * that is written once and then matches for ever is a state nobody can see and nobody
 * clears.
 */
export function publish(layout: HomeLayout): void {
  try {
    if (!differs(layout)) window.localStorage.removeItem(HOME_LAYOUT_KEY);
    else window.localStorage.setItem(HOME_LAYOUT_KEY, formatLayoutDocument(layout));
  } catch {
    // Site data switched off. Nothing can be previewed, and nothing may throw.
  }
}

/**
 * What was left in storage by an earlier visit, so the tool opens on what the app draws.
 *
 * Anything the core will not take cleanly is discarded rather than loaded for repair:
 * the editor's vocabulary cannot express a broken document, so opening on one would give
 * a person a list they can move around and never make valid.
 */
export function restore(): HomeLayout {
  try {
    const raw = window.localStorage.getItem(HOME_LAYOUT_KEY);
    if (raw === null) return SHIPPED;
    return restorable(JSON.parse(raw)) ?? SHIPPED;
  } catch {
    return SHIPPED;
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
  issueHeading: wbMessage({
    id: 'home.issue.heading',
    defaultMessage: 'Changes to the home screen',
    description:
      'The title of the GitHub issue Submit changes opens, after a fixed tag in square brackets that is not translated. Read in the repository’s issue list.',
  }),
  issueLead: wbMessage({
    id: 'home.issue.lead',
    defaultMessage:
      'This change to the home screen comes from the workbench. Click “Create” below. A pull request is then made from it by itself, and this issue says where. Please leave the block below as it is.',
    description:
      'The first paragraph of the GitHub issue Submit changes opens, above the document. “Create” is GitHub’s own button on that page, which GitHub labels in English, so it stays in English.',
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
export async function save(layout: HomeLayout, format: Format): Promise<SaveResult> {
  try {
    const response = await fetch(HOME_LAYOUT_ENDPOINT, {
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

export function submission(layout: HomeLayout, format: Format): Submit {
  // Minified: the printed document spends most of its address on indentation, measured
  // at 2,112 against 1,320 encoded characters for the shipped day. CI prints it again
  // with `formatLayoutDocument`, so what reaches the repository is formatted either way,
  // and one line of JSON is still readable to a maintainer looking at the issue.
  const payload = JSON.stringify(JSON.parse(formatLayoutDocument(layout)));
  const issue = issueFor('home', payload, {
    heading: format(COPY.issueHeading),
    lead: format(COPY.issueLead),
  });
  const { href, fits } = issueAddress(docsModule.repo, issue, format(COPY.issueHelp));
  return { href, fits, body: issue.body };
}

/**
 * Put text on the clipboard inside the click that opens the new tab, and say whether that
 * worked.
 *
 * Synchronous on purpose, and that is why it is the old `copy` command and not
 * `navigator.clipboard`: the link opens GitHub in a new tab as part of the same click,
 * the new tab takes the focus, and the asynchronous clipboard refuses a document that is
 * not focused by the time it gets round to writing. A `copy` event answered with the text
 * is written before the click's default action runs. `navigator.clipboard` stays as the
 * second attempt for a browser without the command.
 *
 * Never throws: a refusal is `false`, and the panel then offers the text in a field to
 * copy by hand.
 */
export function copyNow(text: string): boolean {
  try {
    if (typeof document === 'undefined') return false;
    const put = (event: ClipboardEvent) => {
      event.clipboardData?.setData('text/plain', text);
      event.preventDefault();
    };
    document.addEventListener('copy', put);
    let done = false;
    try {
      done = document.execCommand('copy');
    } finally {
      document.removeEventListener('copy', put);
    }
    if (!done && typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => undefined);
    }
    return done;
  } catch {
    return false;
  }
}
