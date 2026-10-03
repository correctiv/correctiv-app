import { GitPullRequest, Link, MoreHorizontal, RotateCcw, Save, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { useActiveActions } from '../shell/actions';
import { Button } from './kit/button';
import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from './kit/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from './kit/tooltip';
import { useHeaderDensity } from './header-row';

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
      'Opens GitHub with your change filled in. One click on “Create” submits it; it needs a GitHub account, and no token is kept here.',
    description:
      'The tooltip on the submit button, and its accessible description: what happens after the click, what it needs and what this site keeps. The one explanation of a submission on this site, for every tool — a panel that carried its own said the same thing once per tool, which is the copy this replaced. Two sentences, and it has to stay two: at 22rem this was seven lines of tooltip over a 32-pixel bar.',
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
  fromLink: {
    id: 'actions.fromLink',
    defaultMessage: 'From a link',
    description:
      'Beside the change status, for a draft that arrived in a link and is not on this machine (ADR 0076 §3). Three words where there used to be a paragraph: what it is, and the tooltip says the half nobody can see, which is that nothing was written here.',
  },
  more: {
    id: 'actions.more',
    defaultMessage: 'The other actions for this tool',
    description:
      'The accessible name of the ⋯ that stands in for the actions the header had no room for. Named after what it holds rather than after the icon, because an icon named "more" is not a name a screen reader can use.',
  },
  shareWarningSubmit: {
    id: 'actions.shareWarningSubmit',
    defaultMessage: 'Submit it instead',
    description:
      'The link inside the popover at the Share button, for a draft too long to travel in a link. The same address the Submit button beside it opens, put here because the warning above it says to submit rather than to share.',
  },
  shareWarningClose: {
    id: 'actions.shareWarningClose',
    defaultMessage: 'Fold this away',
    description:
      'The button that closes the popover at the Share button without touching the draft. One press, and it stays folded while the warning is the same one.',
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
 *
 * **What the bar gives up when it runs out of room** is `ui/header-row.tsx`'s
 * decision, read here rather than made here: from tier 2 the three labels beside
 * the icons go and the tooltip carries them, and at tier 3 the two rarely pressed
 * actions go behind one `⋯`. Submit keeps its label at every tier, because it is
 * the button the bar exists for and an icon alone is a guess.
 */
export function ToolActions() {
  const intl = useWorkbenchIntl();
  const actions = useActiveActions();
  /** Above the early return below, because a hook may not follow one. */
  const submitNoteId = useId();
  /** The same for the sentence behind "From a link", which is drawn beside it. */
  const originNoteId = useId();
  /** The warning the reader has folded away, by its own text. */
  const [read, setRead] = useState<string | null>(null);
  /**
   * Whether the reader asked for the too-long notice by pressing the Share button.
   *
   * **A warning is a state, and a popover wants an act.** `shell/actions.tsx` carries
   * the notice as a field beside the button, so a tool with any other reason to publish
   * one — a limit that moved, a second editor, a restored session — would have the panel
   * open under a header nobody pressed, which is the banner #337's before-picture is.
   * So the panel opens on `asked` AND on there being something to say, and `asked` is
   * set in the button's own `onClick`: a click, and Enter or Space because the button
   * is a `<button>` and both of those are clicks.
   *
   * Measured rather than argued, and the measurement is the other half of the claim:
   * at 1280, 1600 and 2000 pixels a plain load of a draft too long to share opens
   * nothing, and the panel opens on a real press of the button every time. What #337's
   * picture shows is this panel with the state forced, which is what a panel that opens
   * on a field rather than on a press looks like.
   */
  const [asked, setAsked] = useState(false);
  /** Above the early return below with the other two, because a hook may not follow one. */
  const density = useHeaderDensity();
  if (actions === null) return null;

  const { dirty, count, blocked, origin, submit, share, save, discard } = actions;
  const live = dirty && blocked === undefined;
  /** Icon and no label from tier 2 on: the tooltip beside it says what it is. */
  const compact = density >= 2;
  /** Save and Discard behind the `⋯` at the tightest tier. */
  const folded = density >= 3;
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
  /** A draft too long to travel in a link, until the reader folds it away. */
  const warning =
    share?.warning !== undefined && share.warning.text !== read ? share.warning : null;

  return (
    <div
      role="toolbar"
      aria-label={intl.formatMessage(COPY.group)}
      data-testid="tool-actions"
      /*
        `flex-nowrap` for the same reason the header above it has it, and `min-w-0`
        so this group is the one that gives up its width: a bar of controls that
        wraps moves every control after the wrap, and the button that moved is a
        button a hand misses.
      */
      className="flex min-w-0 shrink-0 flex-nowrap items-center gap-xs"
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

      {/*
        Where this draft came from, and it is three words because the panel's
        paragraph about it is what #323 took away: a permanent sentence above a
        block list is read once and then ignored, and it pushes the work down.
        Beside the change status, which is the only other thing here that is about
        the draft rather than about the way out of it.

        **The sentence is read out rather than hovered for**, on the same grounds
        as Submit's beside it and by the same shape: a status nobody can be told
        the half of that matters is a status that reads as decoration. A `<span>`
        with no `tabIndex`, because there is nothing here to press and
        `jsx-a11y` is right that a non-interactive element in the tab order is a
        stop nobody asked for — the sentence is in the tree either way.
      */}
      {origin !== undefined && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="text-s text-on-canvas-muted"
              data-testid="tool-actions-origin"
              aria-describedby={originNoteId}
            >
              {intl.formatMessage(COPY.fromLink)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">{origin}</TooltipContent>
          <span id={originNoteId} className="sr-only">
            {origin}
          </span>
        </Tooltip>
      )}

      {discard && !folded && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size={compact ? 'icon' : 'sm'}
              disabled={!dirty}
              onClick={discard}
              aria-label={intl.formatMessage(COPY.discard)}
              data-testid="action-discard"
              className={compact ? 'size-[2rem]' : undefined}
            >
              <RotateCcw aria-hidden="true" />
              {!compact && intl.formatMessage(COPY.discard)}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {compact ? intl.formatMessage(COPY.discard) : intl.formatMessage(COPY.discardTip)}
          </TooltipContent>
        </Tooltip>
      )}

      {share !== undefined && (
        <Popover
          /*
           * `asked &&` and not the warning alone, for the reason `asked` gives. A second
           * half is that this is the only panel on this bar not opened by its own trigger:
           * the tooltip trigger is the same span, so Radix's Popover would take the space
           * bar on the wrapper and open a panel nobody asked about. What opens this one is
           * the button's press.
           */
          open={asked && warning !== null}
          /*
           * Escape and a click outside have to fold it as well as close it. `open` is
           * this file's own, so closing without setting `read` would open the very next
           * thing it was asked to draw. `asked` goes down with it, so the next press is
           * the next question.
           */
          onOpenChange={(open) => {
            if (open) return;
            setAsked(false);
            setRead(warning?.text ?? null);
          }}
        >
          <Tooltip>
            {/*
              One button, two triggers. The popover is anchored at the button that
              was pressed and the tooltip says what the button does, so the element
              both of them hang off is a span around it rather than the button: a
              `disabled` one takes no pointer events, and a trigger that cannot be
              pointed at opens for nobody.
            */}
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <span className="inline-flex" data-testid="share-anchor">
                  <Button
                    variant="outline"
                    size={compact ? 'icon' : 'sm'}
                    disabled={!live}
                    /*
                     * The press, and not the Popover trigger around it: the panel is told
                     * what the reader asked for here, so a tool's news cannot open a panel
                     * under a header nobody pressed. `share.run` still runs on every press,
                     * whatever comes back — the address is on the clipboard long before a
                     * notice is drawn.
                     */
                    onClick={() => {
                      setAsked(true);
                      share.run();
                    }}
                    aria-label={intl.formatMessage(COPY.share)}
                    data-testid="action-share"
                    className={compact ? 'size-[2rem]' : undefined}
                  >
                    <Link aria-hidden="true" />
                    {!compact && intl.formatMessage(COPY.share)}
                  </Button>
                </span>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {compact ? intl.formatMessage(COPY.share) : intl.formatMessage(COPY.shareTip)}
            </TooltipContent>
          </Tooltip>
          {/*
            What the last share click came to, when it came to nothing. It opens
            here rather than standing in the panel, because the thing it reports is
            about this button and it is over as soon as the reader has acted on it.
            Dismissed and folded by the reader and by nothing else — a new warning
            opens it again, and one that is already folded stays folded while the
            text is the same, because that is a fact about the bar and not about the
            tool: a tool that cleared its own news would clear it on every render.
          */}
          {/*
            **The pointer and the width are what make this a popover.** #337's
            before-picture is this sentence as a full-width strip under the header with
            nothing pointing at the button, and the two words that would have said which
            control it was about are the two that were given up to keep the bar in one row.
            `w-[20rem]` keeps the panel to the width of a tooltip over a control, and the
            arrow is Radix's own, in the panel's fill and its border, so it costs no
            measurement — it sits at the trigger's centre by arithmetic.
          */}
          {warning && (
            <PopoverContent
              side="bottom"
              align="end"
              sideOffset={6}
              className="w-[20rem] max-w-[min(20rem,calc(100vw-1.5rem))]"
            >
              <ShareNotice
                text={warning.text}
                submit={warning.submit}
                onFold={() => {
                  setAsked(false);
                  setRead(warning.text);
                }}
              />
              <PopoverArrow className="fill-canvas stroke-stroke" />
            </PopoverContent>
          )}
        </Popover>
      )}

      {save && !folded && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size={compact ? 'icon' : 'sm'}
              disabled={!live || save.busy}
              onClick={save.run}
              aria-label={intl.formatMessage(COPY.save)}
              data-testid="action-save"
              className={compact ? 'size-[2rem]' : undefined}
            >
              <Save aria-hidden="true" />
              {!compact && intl.formatMessage(COPY.save)}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {compact ? intl.formatMessage(COPY.save) : intl.formatMessage(COPY.saveTip)}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Whatever tier 3 could not keep on the bar, and no more than that. */}
      {folded && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={intl.formatMessage(COPY.more)}
              data-testid="action-more"
              className="size-[2rem]"
            >
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end">
            <OverflowActions discard={discard} save={save} live={live} />
          </PopoverContent>
        </Popover>
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
            `max-w-[26rem]` and `leading-relaxed`, because this is the one tooltip on
            this site that has to carry two sentences: what the click does, and what
            it needs. The kit's tooltip has no width of its own, so the sentence ran
            the length of a 1600-pixel window and off its right edge, and at 22rem
            the same two sentences were four lines high over a 32-pixel bar.
          */}
          <TooltipContent side="bottom" className="max-w-[26rem] leading-relaxed">
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

/**
 * What the `⋯` holds: the two actions the bar had no room for.
 *
 * **A component of its own, and the reason is the test.** A `Popover` is a Radix
 * primitive on `@floating-ui`, and rendering one in this repository's jsdom costs
 * seconds per open and taxes every test after it — measured, not guessed: an empty
 * `Popover` with `open` took 1.2 s and the next test 4 s. What has to be checked is
 * that the menu holds both actions, with their names and their buttons wired, and
 * none of that is Radix's. So the list is here, the `⋯` and the popover around it
 * are one line above it, and `test/shell/actions.test.tsx` renders this.
 */
export function OverflowActions({
  discard,
  save,
  live,
}: {
  discard?: () => void;
  save?: { run: () => void; busy?: boolean };
  /** Whether the tool holds a change that may be saved, which is the bar's own word. */
  live: boolean;
}) {
  const intl = useWorkbenchIntl();
  return (
    <div className="flex flex-col gap-2xs">
      {discard && (
        <MenuAction
          label={intl.formatMessage(COPY.discard)}
          tip={intl.formatMessage(COPY.discardTip)}
          testId="action-discard"
          onClick={discard}
        >
          <RotateCcw aria-hidden="true" />
        </MenuAction>
      )}
      {save && (
        <MenuAction
          label={intl.formatMessage(COPY.save)}
          tip={intl.formatMessage(COPY.saveTip)}
          testId="action-save"
          onClick={save.run}
          disabled={!live || save.busy}
        >
          <Save aria-hidden="true" />
        </MenuAction>
      )}
    </div>
  );
}

/**
 * What a draft too long for the address is told, where it is told it: at the Share
 * button, over the panel it used to stand in.
 *
 * **A component of its own for the reason `OverflowActions` gives** — Radix's
 * `Popover` around it, and this is the part of it that is ours. The sentence is the
 * tool's own, because it is the only one that knows how many characters there were;
 * the way out is the address Submit already opens, and it is here because the
 * sentence tells the reader to submit rather than to share.
 *
 * `onFold` and not `PopoverClose`, because the popover's `open` is decided by whether
 * a warning is unread: closing it without saying so would open the next thing it was
 * asked to draw.
 */
export function ShareNotice({
  text,
  submit,
  onFold,
}: {
  /** The tool's sentence, in the reader's language. */
  text: string;
  /** Where to submit instead, while there is anywhere to submit to. */
  submit?: { href: string };
  onFold: () => void;
}) {
  const intl = useWorkbenchIntl();
  return (
    <div className="flex flex-col gap-xs">
      {/*
        The sentence, and at most two lines of it: it is about a button 32 pixels high, so
        five lines of it over that button is a paragraph in the header. `line-clamp-2` is
        the measure that says so, and the sentence in `preview/home/HomeDocument.tsx` was
        shortened to fit it — the count and the limit are its numbers and it still says
        what they are.
      */}
      <p className="line-clamp-2 text-s leading-relaxed text-on-canvas">{text}</p>
      <div className="flex items-center gap-xs">
        {submit && (
          <Button asChild variant="outline" size="sm">
            <a
              href={submit.href}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="share-warning-submit"
            >
              <GitPullRequest aria-hidden="true" />
              {intl.formatMessage(COPY.shareWarningSubmit)}
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={intl.formatMessage(COPY.shareWarningClose)}
          data-testid="share-warning-close"
          className="size-[1.75rem]"
          onClick={onFold}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

/**
 * One action inside the `⋯`, with the same words the button it replaces had.
 *
 * The tooltip is not lost with the button, because a menu item that says only
 * "Verwerfen" is a menu item whose second half — that it puts every change back to
 * what ships — was on the button and has now nowhere else to be. So the row carries
 * the name and the tooltip carries what the button's tooltip carried.
 */
function MenuAction({
  label,
  tip,
  onClick,
  disabled,
  testId,
  children,
}: {
  label: string;
  tip: string;
  onClick: () => void;
  disabled?: boolean;
  testId: string;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onClick}
          data-testid={testId}
          className="justify-start"
        >
          {children}
          {label}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tip}</TooltipContent>
    </Tooltip>
  );
}
