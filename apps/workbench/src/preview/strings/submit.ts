import docsModule from 'virtual:docs';

import { wbMessage, type WorkbenchMessage } from '../../i18n/messages';
import { issueAddress, issueFor } from '../submission';
import type { Draft } from './draft';

/**
 * What Submit texts opens: GitHub's new-issue page with the reworded German in it.
 *
 * [ADR 0062](../../../../../adr/0062-the-texts-submission-may-change-wordings-and-nothing-else.md),
 * the strings kind of [ADR 0061](../../../../../adr/0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md)
 * §3, and the same shape as the home tool's `home/write.ts`: the person clicks GitHub's own
 * "Create", and `.github/workflows/submission.yml` turns the issue into a pull request.
 * The workbench holds nothing to do that with (ADR 0058 §1).
 *
 * The payload is id to German, only for the wordings that differ and pass the validator,
 * which is what `publishable` already hands the frame. **One entry per line, in id
 * order**, rather than on one line as the home document travels (ADR 0061 §6): a wording
 * is what a reviewer reads in the issue before anything else, and a line per id costs a
 * dozen encoded characters each against a document whose indentation cost a third of the
 * address. ADR 0062 §6 has the measurement.
 *
 * `wbMessage()` rather than `defineMessages` for the reason `home/write.ts` gives.
 */
const COPY = {
  heading: wbMessage({
    id: 'tools.strings.issue.heading',
    defaultMessage: 'Changes to the app’s texts',
    description:
      'The title of the GitHub issue Submit texts opens, after a fixed tag in square brackets that is not translated. Read in the repository’s issue list.',
  }),
  lead: wbMessage({
    id: 'tools.strings.issue.lead',
    defaultMessage:
      'These changes to the app’s German texts come from the workbench. Click “Create” below. A pull request is then made automatically, and this issue will link to it. Please leave the block below as it is.',
    description:
      'The first paragraph of the GitHub issue Submit texts opens, above the changed wordings. “Create” is GitHub’s own button on that page, which GitHub labels in English, so it stays in English.',
  }),
  help: wbMessage({
    id: 'tools.strings.issue.help',
    defaultMessage:
      'The changes were too long for the link, so they are on your clipboard. Delete this text, paste the changes here (Ctrl+V, or Cmd+V on a Mac) and click “Create”.',
    description:
      'Stands in the body of the GitHub issue instead of the changes, when they are too long to go in the address. “Create” is GitHub’s own button and stays in English.',
  }),
};

/** Formats one of the descriptors above. The caller has an `intl`; this module does not. */
export type Format = (message: WorkbenchMessage, values?: Record<string, string>) => string;

export interface StringsSubmit {
  href: string;
  /** False when the body did not fit and `href` carries the help sentence instead. */
  fits: boolean;
  /** The whole issue body, for the clipboard when it did not fit. */
  body: string;
}

/** The payload for a set of wordings: an object in id order, one entry per line. */
export function stringsPayload(wordings: Draft): string {
  const sorted = Object.fromEntries(
    Object.keys(wordings)
      .sort()
      .map((id) => [id, wordings[id]!]),
  );
  return JSON.stringify(sorted, null, 2);
}

export function stringsSubmission(
  wordings: Draft,
  format: Format,
  repo: string = docsModule.repo,
): StringsSubmit {
  const issue = issueFor('strings', stringsPayload(wordings), {
    heading: format(COPY.heading),
    lead: format(COPY.lead),
  });
  const { href, fits } = issueAddress(repo, issue, format(COPY.help));
  return { href, fits, body: issue.body };
}
