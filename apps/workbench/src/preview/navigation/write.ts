import type { Navigation } from '@correctiv/app-core/lib/navigation';

import docsModule from 'virtual:docs';

import { wbMessage } from '../../i18n/messages';
import { NAVIGATION_ENDPOINT, NAVIGATION_FILE } from '../home/names';
import { type Format, type SaveResult } from '../home/write';
import { issueAddress, issueFor, layoutPayload } from '../submission';
import { formatNavigationDocument } from './document';

/**
 * How a navigation leaves the page: written into the checkout by the dev server, or
 * submitted as a GitHub issue of the `layout` kind (ADR 0061). The same two exits as a
 * screen's, `preview/home/write.ts`, with the navigation's own words.
 */
const COPY = {
  written: wbMessage({
    id: 'navigation.save.written',
    defaultMessage: 'Written to {path}.',
    description:
      'Confirms that the dev server wrote the navigation. {path} is the repository path it wrote.',
  }),
  refused: wbMessage({
    id: 'navigation.save.refused',
    defaultMessage: '{said} ({codes})',
    description:
      'A refusal that came with codes. {said} is the dev server’s own sentence, which is not translated; {codes} is a comma-separated list of the core’s problem codes, which are never translated.',
  }),
  http: wbMessage({
    id: 'navigation.save.http',
    defaultMessage: 'HTTP {status}',
    description:
      'Stands in for a refusal the server sent no sentence with. {status} is the numeric status.',
  }),
  issueHeading: wbMessage({
    id: 'navigation.issue.heading',
    defaultMessage: 'Changes to the navigation',
    description:
      'The title of the GitHub issue Submit changes opens for the tab bar, after a fixed tag in square brackets that is not translated. Read in the repository’s issue list.',
  }),
  issueLead: wbMessage({
    id: 'navigation.issue.lead',
    defaultMessage:
      'This change to the navigation comes from the workbench. Click “Create” below. A pull request is then made automatically, and this issue will link to it. Please leave the block below as it is.',
    description:
      'The first paragraph of the GitHub issue, above the document. “Create” is GitHub’s own button on that page, which GitHub labels in English, so it stays in English.',
  }),
  issueHelp: wbMessage({
    id: 'navigation.issue.help',
    defaultMessage:
      'The change was too long for the link, so it is on your clipboard. Delete this text, paste the change here (Ctrl+V, or Cmd+V on a Mac) and click “Create”.',
    description:
      'Stands in the body of the GitHub issue instead of the change, when it is too long to go in the address. “Create” is GitHub’s own button and stays in English.',
  }),
};

export async function saveNavigation(navigation: Navigation, format: Format): Promise<SaveResult> {
  try {
    const response = await fetch(NAVIGATION_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: formatNavigationDocument(navigation),
    });
    const body = (await response.json()) as {
      path?: string;
      error?: string;
      problems?: { code: string }[];
    };
    if (!response.ok) {
      const codes = (body.problems ?? []).map((problem) => problem.code).join(', ');
      const said = body.error ?? format(COPY.http, { status: String(response.status) });
      return { ok: false, message: codes ? format(COPY.refused, { said, codes }) : said };
    }
    return { ok: true, message: format(COPY.written, { path: body.path ?? NAVIGATION_FILE }) };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function submitNavigation(navigation: Navigation, format: Format) {
  const payload = JSON.stringify(JSON.parse(formatNavigationDocument(navigation)));
  const issue = issueFor('layout', layoutPayload('navigation', payload), {
    heading: format(COPY.issueHeading),
    lead: format(COPY.issueLead),
  });
  const { href, fits } = issueAddress(docsModule.repo, issue, format(COPY.issueHelp));
  return { href, fits, body: issue.body };
}
