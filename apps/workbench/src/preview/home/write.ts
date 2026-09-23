import {
  HOME_LAYOUT_VERSION,
  parseHomeLayout,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';

import docsModule from 'virtual:docs';

import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';
import {
  differs,
  formatLayoutDocument,
  HOME_LAYOUT_ENDPOINT,
  HOME_LAYOUT_FILE,
  HOME_LAYOUT_KEY,
  SHIPPED,
} from './document';

/**
 * The three ways a change leaves the page: into the running app, into GitHub's editor, and
 * on a dev server into the developer's own checkout.
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
 * GitHub's editor, open on the document, on the branch the published site is built from.
 *
 * ADR 0058 §2. **Submit changes** is the one way a change leaves the published site, and
 * it holds nothing to do it with: the person arrives on github.com signed in as
 * themselves, pastes, and commits to a new branch with a pull request, or is offered a
 * fork by GitHub if they may not write here. The workbench never sees a credential, so
 * there is none for anything else on `correctiv.github.io` to read.
 *
 * `main` because that is what `.github/workflows/pages.yml` publishes from, and so what
 * the document the editor opened on was. A change that reached `main` after this page was
 * built shows in the pull request's diff, which is where a reviewer catches it.
 *
 * The document goes by the clipboard and not by `?value=` in the address: the file
 * exists, so this is `/edit/` and not `/new/`, whether `/edit/` honours a prefill is not
 * measured, and an address has a ceiling the document would one day grow into (measured
 * on 2026-09-23: accepted to 6000 characters, `414` from 10000).
 */
export const SUBMIT_URL = `${docsModule.repo}/edit/main/${HOME_LAYOUT_FILE}`;

/**
 * Put the document on the clipboard, and say whether that worked.
 *
 * Never throws and never rejects: a browser that refuses the clipboard — no secure
 * context, a permission denied, an old engine without `navigator.clipboard` — is answered
 * with `false`, and the panel then offers the document in a field to copy by hand. The
 * person still gets to GitHub either way.
 */
export async function copyForSubmit(layout: HomeLayout): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(formatLayoutDocument(layout));
    return true;
  } catch {
    return false;
  }
}
