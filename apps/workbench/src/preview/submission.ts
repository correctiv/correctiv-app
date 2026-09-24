/**
 * How a change leaves the workbench: as a GitHub issue that a workflow turns into a pull
 * request ([ADR 0061](../../../../adr/0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md)).
 *
 * This is the half both ends read. The workbench writes an issue with it, and
 * `scripts/submission.ts` reads the same issue back in `.github/workflows/submission.yml`.
 * One file, so the two cannot spell the format differently: a title that starts with the
 * kind's prefix, and a body with exactly one fenced `json` block holding the payload.
 * Everything else in the body is prose for the person looking at the issue, and the
 * reader ignores it.
 *
 * Pure on purpose. No `window`, no `import.meta.env`, no `virtual:` module: the workflow
 * loads this file with `tsx` in Node, and so do the tests.
 */

import { HOME_LAYOUT_FILE } from './home/names';
import { GERMAN_CATALOGUE_DIR } from './strings/names';

/**
 * Every kind of submission there is or is about to be.
 *
 * **The prefix is the kind**, in square brackets at the front of the title, lower case,
 * one German word. German because the newsroom reads the issue list, and a tag there
 * should say what the issue is about in their words. One per kind rather than one
 * shared tag with the kind somewhere else, because the workflow's `if:` can then skip
 * every other issue before a runner starts, and a person scanning the list sees
 * `[startseite]` and knows. The body does not repeat the kind: a second place to say it
 * would be a second place to disagree.
 *
 * `built` is false for a kind that has a name and a prefix and no way through yet. The
 * workflow does not start for it; `test/submission.test.ts` holds the workflow's `if:` to
 * exactly the built prefixes, so building a kind is one flag here and one line there, and
 * forgetting the second is a red test.
 *
 * What a kind may write is named here too, as a `file` or a `dir`, and it is the whole of
 * what the workflow lets it commit: `scripts/submission-verify.ts` holds every path the run
 * changed to it before anything is committed (ADR 0062 §2).
 */
export const SUBMISSION_KINDS = {
  /** The home screen's document, one file. ADR 0061 §2. */
  home: {
    prefix: '[startseite]',
    file: HOME_LAYOUT_FILE,
    built: true,
  },
  /**
   * The German catalogue, one file per id namespace in the directory, and only the
   * wordings of ids it already carries. ADR 0061 §3, built by ADR 0062: the payload is an
   * object of id to German, and the workflow replaces each id's string literal in the
   * catalogue's TypeScript through the compiler API, the way ADR 0056 §8 writes one.
   */
  strings: {
    prefix: '[texte]',
    dir: GERMAN_CATALOGUE_DIR,
    built: true,
  },
} as const;

export type SubmissionKind = keyof typeof SUBMISSION_KINDS;

/** The fence's info string. `json` so that GitHub highlights the block. */
export const SUBMISSION_FENCE = 'json';

/**
 * The longest issue address the workbench will open. Longer, and the body goes by the
 * clipboard instead.
 *
 * Measured on 2026-09-23, signed out, which is the case a person from the newsroom may
 * well be in: github.com answers an `issues/new` address with a redirect to `/login`
 * that carries the whole address again, encoded a second time. That login address fails
 * with `500` from about 7000 characters, which a JSON body reaches at an issue address of
 * about 4650. The issue address itself is taken up to 7000 and fails from 7500. So 4000:
 * under the signed-out edge, with room for a longer title. ADR 0061 §6.
 */
export const SUBMISSION_ADDRESS_LIMIT = 4000;

export interface Issue {
  title: string;
  body: string;
}

/**
 * The issue for one submission.
 *
 * `heading` and `lead` are already formatted, in whatever language the page is in: they
 * are for the person on GitHub and nothing reads them back. The prefix is not
 * translated, because the workflow matches on it.
 */
export function issueFor(
  kind: SubmissionKind,
  payload: string,
  words: { heading: string; lead: string },
): Issue {
  const block = payload.endsWith('\n') ? payload : `${payload}\n`;
  return {
    title: `${SUBMISSION_KINDS[kind].prefix} ${words.heading}`,
    body: `${words.lead}\n\n\`\`\`${SUBMISSION_FENCE}\n${block}\`\`\`\n`,
  };
}

export interface IssueAddress {
  /** Where the button goes. */
  href: string;
  /**
   * False when the body did not fit and `href` carries `help` in its place. The caller
   * then puts `issue.body` on the clipboard, and says so beside the button.
   */
  fits: boolean;
}

/**
 * GitHub's new-issue page, prefilled.
 *
 * `help` is what stands in the body when the whole body would make the address too long:
 * a sentence telling the person to paste over it. The title always fits, so the
 * workflow still recognises the issue after the paste.
 */
export function issueAddress(repo: string, issue: Issue, help: string): IssueAddress {
  const base = `${repo}/issues/new?title=${encodeURIComponent(issue.title)}&body=`;
  const full = base + encodeURIComponent(issue.body);
  if (full.length <= SUBMISSION_ADDRESS_LIMIT) return { href: full, fits: true };
  return { href: base + encodeURIComponent(help), fits: false };
}

/**
 * Which kind a title names, by its prefix, or null.
 *
 * Case is forgiven and leading space is not, which is exactly what the workflow's `if:`
 * does: GitHub's `startsWith` ignores case and trims nothing. A reader more forgiving than
 * the gate would accept titles the gate never lets through, and the two would disagree
 * about which issues are submissions.
 */
export function kindOfTitle(title: string): SubmissionKind | null {
  const head = title.toLowerCase();
  for (const kind of Object.keys(SUBMISSION_KINDS) as SubmissionKind[]) {
    if (head.startsWith(SUBMISSION_KINDS[kind].prefix)) return kind;
  }
  return null;
}
