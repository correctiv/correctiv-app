import { GitPullRequest, RotateCcw, Save } from 'lucide-react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { useActiveActions } from '../shell/actions';
import { Button } from './kit/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './kit/tooltip';

/**
 * Everything the actions say, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/actions.ts`. One vocabulary for every tool: submit, save,
 * discard.
 */
const COPY = defineMessages({
  group: {
    id: 'actions.group',
    defaultMessage: 'Changes of the open tool',
    description: 'The accessible name of the group of buttons at the right end of the header.',
  },
  submit: {
    id: 'actions.submit',
    defaultMessage: 'Submit',
    description:
      'Opens a prefilled GitHub issue in a new tab, which a workflow turns into a pull request (ADR 0061). The same word for every tool.',
  },
  submitTip: {
    id: 'actions.submitTip',
    defaultMessage:
      'Opens a new issue on GitHub with your change in it. A pull request is made from it automatically. This page stores no password and no token.',
    description: 'The tooltip on the submit button: what happens after the click.',
  },
  save: {
    id: 'actions.save',
    defaultMessage: 'Save',
    description:
      'On a dev server only: writes the change into your own checkout. The same word for every tool.',
  },
  saveTip: {
    id: 'actions.saveTip',
    defaultMessage:
      'On a dev server, writes the change into your own checkout. A shortcut for developers; the way to a pull request is Submit.',
    description: 'The tooltip on the save button.',
  },
  discard: {
    id: 'actions.discard',
    defaultMessage: 'Discard',
    description:
      'Puts everything the open tool changed back to what ships. The same word for every tool; there is no separate undo.',
  },
  discardTip: {
    id: 'actions.discardTip',
    defaultMessage: 'Puts every change of this tool back to what ships.',
    description: 'The tooltip on the discard button.',
  },
  count: {
    id: 'actions.count',
    defaultMessage: '{count, plural, =0 {No changes} one {# change} other {# changes}}',
    description: 'Beside the buttons, for a tool that counts its changes. {count} is that number.',
  },
  changed: {
    id: 'actions.changed',
    defaultMessage: 'Changed',
    description: 'Beside the buttons, for a tool that does not count and holds changes.',
  },
  unchanged: {
    id: 'actions.unchanged',
    defaultMessage: 'Unchanged',
    description: 'Beside the buttons, while the open tool holds no changes.',
  },
});

/**
 * The open tool's save, submit and discard, at the right end of the header and
 * nowhere else.
 *
 * **Disabled rather than hidden** when there is nothing to do: a button that appears
 * with the first keystroke moves every control beside it, and one that is always
 * there is where a hand already is. A tool that registered no actions (the console,
 * Measure) draws nothing, because for it there is no position to keep.
 */
export function ToolActions() {
  const intl = useWorkbenchIntl();
  const actions = useActiveActions();
  if (actions === null) return null;

  const { dirty, count, blocked, submit, save, discard } = actions;
  const live = dirty && !blocked;

  return (
    <div
      role="toolbar"
      aria-label={intl.formatMessage(COPY.group)}
      data-testid="tool-actions"
      className="flex shrink-0 items-center gap-xs"
    >
      <span className="text-s text-on-canvas-muted" data-testid="tool-actions-status">
        {count !== undefined
          ? intl.formatMessage(COPY.count, { count })
          : intl.formatMessage(dirty ? COPY.changed : COPY.unchanged)}
      </span>

      {discard && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!dirty}
              onClick={discard}
              data-testid="action-discard"
            >
              <RotateCcw aria-hidden="true" />
              {intl.formatMessage(COPY.discard)}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{intl.formatMessage(COPY.discardTip)}</TooltipContent>
        </Tooltip>
      )}

      {save && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!live || save.busy}
              onClick={save.run}
              data-testid="action-save"
            >
              <Save aria-hidden="true" />
              {intl.formatMessage(COPY.save)}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{intl.formatMessage(COPY.saveTip)}</TooltipContent>
        </Tooltip>
      )}

      {submit !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            {live && submit ? (
              // A link, because the click leaves for GitHub in a new tab and a link is what a
              // browser opens a tab for without a popup blocker in the way (ADR 0061 §1).
              <Button asChild size="sm" data-testid="action-submit">
                <a
                  href={submit.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={submit.onClick}
                >
                  <GitPullRequest aria-hidden="true" />
                  {intl.formatMessage(COPY.submit)}
                </a>
              </Button>
            ) : (
              <Button size="sm" disabled data-testid="action-submit">
                <GitPullRequest aria-hidden="true" />
                {intl.formatMessage(COPY.submit)}
              </Button>
            )}
          </TooltipTrigger>
          <TooltipContent side="bottom">{intl.formatMessage(COPY.submitTip)}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
