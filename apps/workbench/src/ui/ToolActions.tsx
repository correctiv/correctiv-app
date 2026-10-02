import { GitPullRequest, Link, RotateCcw, Save } from 'lucide-react';
import { useId } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { useActiveActions } from '../shell/actions';
import { Button } from './kit/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './kit/tooltip';

/**
 * Everything the actions say, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/actions.ts`. One vocabulary for every tool: share, save,
 * discard, submit.
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
      'Opens GitHub with your change filled in, or copies it to your clipboard when it is too long for a link. One click on “Create” submits it, and a pull request is made from it automatically. You need a GitHub account, and this page stores no password and no token.',
    description:
      'The tooltip on the submit button, and its accessible description: what happens after the click, and that a GitHub account is what it needs. The one explanation of a submission on this site, for every tool — a panel that carried its own said the same thing once per tool, which is the copy this replaced.',
  },
  submitOff: {
    id: 'actions.submitOff',
    defaultMessage: 'Nothing to submit yet. Change something in this tool first.',
    description:
      'The tooltip on the submit button while the tool holds no changes, which is why it is switched off. Said in place of actions.submitTip rather than after it, because a reader who has just been told a button does nothing is not asking what it would do.',
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
  share: {
    id: 'actions.share',
    defaultMessage: 'Share link',
    description:
      'Puts the open draft into a link, so a colleague can look at it before anybody submits anything (ADR 0076). The same word for every tool.',
  },
  shareTip: {
    id: 'actions.shareTip',
    defaultMessage:
      'Copies a link that opens this draft on somebody else’s machine. A draft is not a secret: everything it carries goes into a public GitHub issue the moment somebody submits it.',
    description:
      'The tooltip on the share button. The second sentence is the whole argument for putting the draft in the link rather than hiding it: the submission path is public, so a link is not a smaller disclosure than submitting is.',
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
  previewTip: {
    id: 'actions.previewTip',
    defaultMessage: 'The preview shows this draft, not the published app.',
    description:
      'The tooltip on the change status while the open tool holds changes: says the device frame draws the unpublished edit.',
  },
  unchanged: {
    id: 'actions.unchanged',
    defaultMessage: 'Unchanged',
    description: 'Beside the buttons, while the open tool holds no changes.',
  },
});

/**
 * The open tool's share, save, submit and discard, at the right end of the header and
 * nowhere else.
 *
 * **Disabled rather than hidden** when there is nothing to do: a button that appears
 * with the first keystroke moves every control beside it, and one that is always
 * there is where a hand already is. A tool that registered no actions (the console,
 * Measure) draws nothing, because for it there is no position to keep.
 *
 * **The tooltip on a disabled button says why, and that is what the per-panel ⓘ was.**
 * Every tool carried its own paragraph explaining this button — what happens on
 * GitHub, that a GitHub account is what it needs — in its own words, once per tool,
 * next to a control that is not the one it describes. It is the button's own
 * explanation, so it belongs on the button, and the reason it is off belongs there
 * too: `blocked` is what the tool hands over, and a disabled control that cannot say
 * why is a dead end. The wrapper `<span>` is what makes it reachable at all: the
 * button has `disabled:pointer-events-none`, so a tooltip on it alone would open for
 * nobody. `test/shell/actions.test.tsx` holds both halves.
 */
export function ToolActions() {
  const intl = useWorkbenchIntl();
  const actions = useActiveActions();
  /** Above the early return below, because a hook may not follow one. */
  const submitNoteId = useId();
  if (actions === null) return null;

  const { dirty, count, blocked, submit, share, save, discard } = actions;
  const live = dirty && blocked === undefined;
  /**
   * What a switched-off Submit says, ready for the tooltip and for the description a
   * screen reader reads: the tool's own reason, or the one this file has for a clean
   * tool. The reason is already formatted by the tool, which is what let `blocked`
   * carry a problem code, so it is used as it stands rather than run back through
   * `intl`.
   */
  const offReason = blocked ?? intl.formatMessage(COPY.submitOff);
  /** The one sentence this button says, in the tooltip and to a screen reader. */
  const submitNote = live ? intl.formatMessage(COPY.submitTip) : offReason;

  return (
    <div
      role="toolbar"
      aria-label={intl.formatMessage(COPY.group)}
      data-testid="tool-actions"
      className="flex shrink-0 items-center gap-xs"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="text-s text-on-canvas-muted"
            data-testid="tool-actions-status"
            data-draft={dirty ? 'true' : undefined}
          >
            {count !== undefined
              ? intl.formatMessage(COPY.count, { count })
              : intl.formatMessage(dirty ? COPY.changed : COPY.unchanged)}
          </span>
        </TooltipTrigger>
        {dirty && (
          <TooltipContent side="bottom">{intl.formatMessage(COPY.previewTip)}</TooltipContent>
        )}
      </Tooltip>

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

      {share !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!live}
              onClick={share.run}
              data-testid="action-share"
            >
              <Link aria-hidden="true" />
              {intl.formatMessage(COPY.share)}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{intl.formatMessage(COPY.shareTip)}</TooltipContent>
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
          {/*
            A span around both arms, because a disabled button has
            `pointer-events: none` and a trigger that cannot be pointed at opens for
            nobody — which is the whole reason the reason has to live here.
          */}
          <TooltipTrigger asChild>
            <span className="inline-flex">
              {live && submit ? (
                // A link, because the click leaves for GitHub in a new tab and a link is what a
                // browser opens a tab for without a popup blocker in the way (ADR 0061 §1).
                <Button asChild size="sm" data-testid="action-submit">
                  <a
                    href={submit.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={submit.onClick}
                    aria-describedby={submitNoteId}
                  >
                    <GitPullRequest aria-hidden="true" />
                    {intl.formatMessage(COPY.submit)}
                  </a>
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled
                  data-testid="action-submit"
                  aria-describedby={submitNoteId}
                >
                  <GitPullRequest aria-hidden="true" />
                  {intl.formatMessage(COPY.submit)}
                </Button>
              )}
            </span>
          </TooltipTrigger>
          {/*
            `max-w-[22rem]`, because this is the one tooltip on this site that has
            to say two things at once — what the click does and that a GitHub account
            is what it needs — and the kit's tooltip has no width of its own, so four
            sentences ran the length of a 1600-pixel window and off its right edge.
          */}
          <TooltipContent side="bottom" className="max-w-[22rem] leading-relaxed">
            {submitNote}
          </TooltipContent>
          {/*
            The same sentence once more, for a screen reader, because a tooltip is a
            description a reader has to go looking for and this one has to answer a
            question a reader may not know they are asking. `aria-describedby` and
            not `aria-description`, which `jsx-a11y` refuses on a link and which
            fewer screen readers implement; the trigger is the span above, so Radix's
            own `aria-describedby` lands on the span and the two do not collide.
          */}
          <span id={submitNoteId} className="sr-only">
            {submitNote}
          </span>
        </Tooltip>
      )}
    </div>
  );
}
