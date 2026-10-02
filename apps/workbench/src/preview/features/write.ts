import type { FeatureOverride } from '@correctiv/app-core/features/features';

import docsModule from 'virtual:docs';

import { wbMessage } from '../../i18n/messages';
import { type Format } from '../home/write';
import { issueAddress, issueFor } from '../submission';
import { formatReleasePayload, SHIPPED_FEATURES } from './document';

/**
 * How a release decision leaves the page: as a GitHub issue of the `features` kind, which
 * a workflow turns into a pull request (ADR 0061, ADR 0072 §6). There is no dev-server save
 * for it: the release file is a commit, and a reviewer sees it as one.
 */
const COPY = {
  issueHeading: wbMessage({
    id: 'features.issue.heading',
    defaultMessage: 'Release decision for features',
    description:
      'The title of the GitHub issue Submit release opens for the feature states, after a fixed tag in square brackets that is not translated. Read in the repository’s issue list.',
  }),
  issueLead: wbMessage({
    id: 'features.issue.lead',
    defaultMessage:
      'This release decision comes from the workbench. Click “Create” below. A pull request is then made automatically, and this issue will link to it. Please leave the block below as it is.',
    description:
      'The first paragraph of the GitHub issue, above the states. “Create” is GitHub’s own button on that page, which GitHub labels in English, so it stays in English.',
  }),
  issueHelp: wbMessage({
    id: 'features.issue.help',
    defaultMessage:
      'The change was too long for the link, so it is on your clipboard. Delete this text, paste the change here (Ctrl+V, or Cmd+V on a Mac) and click “Create”.',
    description:
      'Stands in the body of the GitHub issue instead of the release decision, when the states are too long to go in the address. “Create” is GitHub’s own button and stays in English.',
  }),
};

export function submitFeatures(draft: FeatureOverride, format: Format) {
  const issue = issueFor('features', formatReleasePayload(SHIPPED_FEATURES, draft), {
    heading: format(COPY.issueHeading),
    lead: format(COPY.issueLead),
  });
  const { href, fits } = issueAddress(docsModule.repo, issue, format(COPY.issueHelp));
  return { href, fits, body: issue.body };
}
