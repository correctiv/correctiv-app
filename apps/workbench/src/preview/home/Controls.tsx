import { ChevronDown, Clock, LocateFixed, Trash2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { defineMessages, type MessageDescriptor } from 'react-intl';

import {
  MINUTES_IN_DAY,
  type HomeLayout,
  type MinuteOfDay,
} from '@correctiv/app-core/lib/home-layout';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { say } from '../../i18n/messages';
import { cn } from '../../lib/cn';
import { Button } from '../../ui/kit/button';
import { InfoTip } from '../../ui/kit/info-tip';
import { Segmented } from '../../ui/kit/segmented';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/kit/tooltip';
import { formatTimeOfDay, type Point } from './document';
import { parseMinute, STEP } from './minutes';
import { ScenarioBar, type ScenarioControl } from './Scenario';
import {
  CONFIGURABLE_SCREENS,
  isScreen,
  SCREEN_ICONS,
  SCREEN_NAMES,
  type ConfigurableScreen,
} from './screens';

/**
 * Everything above the block list, in one row and one chip.
 *
 * **A file of its own because it is a component that can be drawn without the app.**
 * The list below it draws the app's own blocks through `AppHost`, which mounts
 * `expo-router` and `react-native` — neither of which loads outside a browser, so
 * `HomeDocument.tsx` cannot be rendered by a test at all: importing it raises
 * `SyntaxError` before a single assertion runs. The controls do not need any of
 * that, they take their state as arguments, and putting them here is what lets
 * `test/preview/editor-controls.test.tsx` press the toggle, choose a screen and open
 * the chip in a real DOM. The alternative was a check that read the source for a
 * `data-testid`, which is the shape of check this repository has been bitten by.
 *
 * **Why the row exists at all.** This was a labelled drop-down, a second labelled
 * drop-down, a paragraph about GitHub, a checkbox with a sentence beside it and a
 * card about the point being edited. Measured on a 2000×1228 window with the editor
 * open on Home, that took **268 pixels** above the first block; a block draws at the
 * phone's own 393, so the controls were nearly as tall as two of the things they
 * were for, and the panel was a third of the window wide. It is **91 pixels** now,
 * in two rows, and the panel's own default width is the phone plus the gutter
 * (`shell/views.ts`, `test/shell/panel-width.test.ts`).
 *
 * **Nothing is hidden behind a gesture.** Every control keeps a name, a tooltip and
 * a focus ring: the five screens are radios named by the screen they switch to and
 * not five anonymous glyphs, the GitHub paragraph waits behind an ⓘ that names the
 * button it describes, the checkbox is a pressed button that says what it does, and
 * the chip says which way round it is.
 */

/** The card's ground is `surface`, so a card inside the dock steps back to `canvas`. */
const CARD = 'rounded-md border border-stroke bg-canvas';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
/** `Edition.tsx` declares the same field against the same dock; one per file, as there. */
const FIELD =
  'rounded-s border border-stroke bg-canvas px-3xs py-4xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/**
 * The controls' own words.
 *
 * **Exported under this name rather than as `COPY`**, because `HomeDocument.tsx`
 * has a `COPY` of its own for the blocks and for the clipboard outcome, and because
 * the panel chooses which of the three messages about submitting the ⓘ opens on —
 * a question about the document rather than about the bar. `Edition.tsx`'s
 * `EDITION_COPY` and the drawings' `ARTICLE_PATH_COPY` are the same arrangement.
 */
export const CONTROLS_COPY = defineMessages({
  screen: {
    id: 'home.document.screen',
    defaultMessage: 'Screen',
    description:
      'The legend of the icon switcher at the top of the layout tool, which chooses which of the app’s screens is being edited. Read aloud rather than drawn, because each of the five segments is named by the screen it switches to.',
  },
  screenLocked: {
    id: 'home.document.screenLocked',
    defaultMessage: 'A scenario is a Home document, so the screen stays on Home while one is open.',
    description:
      'Under the screen switcher while it is switched off because a scenario is open or the document still holds one. Scenarios are examples of Home’s day and do not exist for the other screens.',
  },
  follow: {
    id: 'home.document.follow',
    defaultMessage: 'Scroll the frame to the block you point at',
    description:
      'The tooltip, and the accessible name, of the button in the editor’s bar that switches following the pointer on and off. It was a checkbox with this sentence beside it, which took a row of the panel that the block list wanted.',
  },
  submitAbout: {
    id: 'home.document.submitAbout',
    defaultMessage: 'Submitting the change',
    description:
      'Names the ⓘ in the editor’s bar, which is what this ⓘ explains: what the Submit button in the header does with the change. The tooltip names the topic, as every ⓘ on this site does.',
  },
  submitHint: {
    id: 'home.document.submitHint',
    defaultMessage:
      'GitHub opens with your change filled in. One click on “Create” submits it. You need a GitHub account.',
    description:
      'Inside the ⓘ beside Submit, which is what the Submit button in the header does. “Create” is GitHub’s own button on the page that opens, which GitHub labels in English, so it stays in English.',
  },
  submitHintLong: {
    id: 'home.document.submitHintLong',
    defaultMessage:
      'This change is too long for a link. The click copies it to your clipboard, and you paste it in on GitHub. You need a GitHub account.',
    description:
      'Stands in for home.document.submitHint inside the ⓘ when the change is too long to travel in the address, so it has to go by the clipboard.',
  },
  scenarioGuard: {
    id: 'home.document.scenarioGuard',
    defaultMessage: 'Scenarios are examples. They are not submitted.',
    description:
      'Inside the ⓘ beside Submit while a scenario is open or the document still holds one, which is why the switched-off Submit and the switched-off Save in the header are off. Submitting or saving it would publish the example on every phone.',
  },

  midnight: {
    id: 'home.point.midnight',
    defaultMessage: 'midnight',
    description:
      'Stands where a time of day would, for the end of the last stretch of the day. Reads inside home.point.startLead and home.point.span.',
  },
  pointStart: {
    id: 'home.point.start',
    defaultMessage: 'The day’s start',
    description:
      'Names the point being edited when it is the document itself rather than one of its moments. On the chip, and in the expanded card under it.',
  },
  pointStartLead: {
    id: 'home.point.startLead',
    defaultMessage: 'from midnight until {until}',
    description:
      'Beside the day’s start in the card under the chip, and nothing else: the chip says the same thing in home.point.startUntil, which drops the half the chip’s own label already carries. {until} is the time the first moment takes over, as 18:30, or the word for midnight where there is none. That every moment builds on it is behind the ⓘ in the card, home.document.rule.',
  },
  pointStartUntil: {
    id: 'home.point.startUntil',
    defaultMessage: 'bis {until}',
    description:
      'Beside “The day’s start” on the chip, the way home.point.span stands beside a moment: when the first moment takes over. The full sentence is home.point.startLead, which the card under the chip shows. {until} is that time as 11:00, or the word for midnight where the day has none.',
  },
  pointTime: {
    id: 'home.point.time',
    defaultMessage: 'The time of this moment',
    description:
      'The name of the chip that opens the expanded card, read out when it carries an icon rather than the time as its own words.',
  },
  pointSpan: {
    id: 'home.point.span',
    defaultMessage:
      'until {until} · {changes, plural, =0 {nothing changes here yet} other {# changed here}}',
    description:
      'Beside the time on the chip, and nowhere else: how long this moment lasts and how much it changes. The card under the chip says neither, because the chip is thirty pixels above it and says both. {until} is when the next point takes over, as 18:30, or the word for midnight; {changes} is how many blocks this moment differs on.',
  },
  pointOpen: {
    id: 'home.point.open',
    defaultMessage:
      'The point being edited: {point}. Show its time, its rule and what can be done to it.',
    description:
      'The accessible name of the chip that opens the card under it, on the closed chip. {point} is the time of day as 14:00, or home.point.start for the day itself. The same chip says home.point.close while it is open, because a control whose name does not change with its state is a control that does not say which state it is in.',
  },
  pointClose: {
    id: 'home.point.close',
    defaultMessage:
      'The point being edited: {point}. Hide its time, its rule and what can be done to it.',
    description:
      'The accessible name of that chip while the card is expanded. {point} is the time of day as 14:00, or home.point.start for the day itself.',
  },
  pointRemove: {
    id: 'home.point.remove',
    defaultMessage: 'Remove the moment at {time}',
    description:
      'The accessible name of the button that deletes the moment being edited. {time} is its time of day, as 18:30.',
  },
  noMoments: {
    id: 'home.point.noMoments',
    defaultMessage: 'This day has no moments. The home screen looks the same all day.',
    description:
      'Inside the expanded card while the day being edited has no moments at all, which is what the card has to say rather than an empty time field.',
  },
  rule: {
    id: 'home.document.rule',
    defaultMessage:
      'A moment holds only what changes at that time. Everything else carries on as before.',
    description:
      'Behind the ⓘ in the card under the chip, and the one rule that makes the rest legible: a moment holds the difference from the point before it rather than the whole state.',
  },
});

/** The ⓘ that says the one rule nothing on screen states. */
function RuleTip({ about }: { about: string }) {
  const intl = useWorkbenchIntl();
  return (
    <InfoTip about={about} align="end">
      <p>{intl.formatMessage(CONTROLS_COPY.rule)}</p>
    </InfoTip>
  );
}

/**
 * One row of controls, and whatever the current state has to add under it.
 *
 * **Still `sticky`, and still the only sticky thing in the panel's scroller**, so
 * the warning in `ui/Lookup.tsx` about a second sticky row inside something already
 * fixed does not apply. The negative margins take back the panel's padding, so the
 * bar spans the panel and its border meets both edges.
 */
export function EditorBar({
  screen,
  guarded,
  onScreen,
  scenario,
  follow,
  onFollow,
  submitHint,
  outcome,
}: {
  screen: ConfigurableScreen;
  /** A scenario is open or the document holds one, so the screen and the submit are off. */
  guarded: boolean;
  onScreen: (next: ConfigurableScreen) => void;
  scenario: ScenarioControl;
  follow: boolean;
  onFollow: (next: boolean) => void;
  /**
   * Which of the three messages about submitting goes in the ⓘ, chosen by the
   * caller because it is the caller that knows whether a scenario is open and how
   * long the change is.
   */
  submitHint: MessageDescriptor;
  /** What the last submit click did, drawn under the row. Nothing while there is none. */
  outcome?: ReactNode;
}) {
  const intl = useWorkbenchIntl();

  return (
    <div className="sticky top-0 z-10 -mx-s -mt-s flex flex-col gap-xs border-b border-stroke bg-canvas px-s py-2xs">
      <div className="flex items-center gap-2xs">
        {/*
          The five screens as icons, in the app's tab order and with the app's tab
          icons. A drop-down said the same thing in two rows of a narrow panel, and
          the icons are what somebody who has the app open on the device beside them
          is already looking for. Radios in labels, so this is one tab stop with the
          arrow keys moving inside it, which is what `ui/kit/segmented.tsx` argues
          for and the reason this is a `Segmented` rather than five buttons.
        */}
        <Segmented
          name="home-screen"
          legend={intl.formatMessage(CONTROLS_COPY.screen)}
          className="min-w-0 shrink-0"
          value={screen}
          disabled={guarded}
          options={CONFIGURABLE_SCREENS.map((of) => {
            const Icon = SCREEN_ICONS[of].Icon;
            return {
              value: of,
              label: <Icon aria-hidden="true" className="size-[1rem]" />,
              icon: { name: say(intl, SCREEN_NAMES[of]) },
            };
          })}
          onChange={(value) => {
            if (isScreen(value)) onScreen(value);
          }}
        />
        {/*
          A scenario is a Home document, so the select only exists on Home. It has
          room for a chip rather than a row of its own, and what it has to say about
          a scenario stays behind its ⓘ — `Scenario.tsx` says the rest.
        */}
        {screen === 'home' && <ScenarioBar control={scenario} />}
        {/*
          What Submit in the header does, which was a permanent paragraph. It is
          about a button that is not here, so the ⓘ names that button rather than the
          editor — the same shape as the ⓘ beside the tokens tool's Copy CSS.
        */}
        <InfoTip
          about={intl.formatMessage(CONTROLS_COPY.submitAbout)}
          align="end"
          className="ml-auto"
        >
          <p data-testid="submit-hint">{intl.formatMessage(submitHint)}</p>
        </InfoTip>
        {/*
          Whether the frame follows the pointer, as the pressed state of a button
          rather than as a checked box with a sentence beside it. The variant carries
          the pressed state as well as `aria-pressed`, because an outline button
          tinted with `surface` would be tinted the dock's own ground and so would
          look exactly like the off state — the measure tool's outline button is the
          same argument.
        */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={follow ? 'default' : 'outline'}
              size="icon"
              className="size-[1.75rem]"
              aria-pressed={follow}
              aria-label={intl.formatMessage(CONTROLS_COPY.follow)}
              onClick={() => onFollow(!follow)}
              data-testid="follow-toggle"
            >
              <LocateFixed aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{intl.formatMessage(CONTROLS_COPY.follow)}</TooltipContent>
        </Tooltip>
      </div>

      {/*
        The states that need a row of their own, which are the states rather than the
        controls: why the screen switcher is off, and what the clipboard did after a
        submit click. Each was inside the same box before and each is the only thing
        on its own line now, which is what a row of controls plus a stack of state is.
      */}
      {guarded && <p className={NOTE}>{intl.formatMessage(CONTROLS_COPY.screenLocked)}</p>}
      {outcome}
    </div>
  );
}

/**
 * Which point is being edited, and the card that comes open underneath it.
 *
 * **A chip, not a card.** This was a card standing above the list with the time
 * field, the span, a delete and two sentences on it, and the two sentences were the
 * problem rather than the card: which layer an edit lands on does not change while
 * you work, and "this day has no moments" is only true for a day with no moments.
 * Both are wanted once and never again, so both are in the card, which is what the
 * chip opens. The chip carries the time and the change count, which is the part
 * somebody reads to know where they are.
 *
 * **Shut to begin with.** The card is what somebody opens rather than what they read
 * past, and the chip carries the one thing that has to be read without opening
 * anything: where in the day you are. It opens on click and stays open while you
 * work, because that is this component's own state and the panel is mounted whether
 * or not the tool is on screen (ADR 0038 §1).
 *
 * **The day's start is not a moment and the chip says so** rather than dressing it up
 * as one: it cannot be moved, because there is nothing before midnight for it to
 * inherit from, and it cannot be removed, because it is the document.
 *
 * `aria-expanded` rather than `aria-pressed`, because what changes is whether
 * something is shown and not whether this is on; and the accessible name says which
 * way round it is, which is what `home.point.open` and `home.point.close` are for.
 */
export function PointChip({
  layout,
  point,
  span,
  changes,
  landsOn,
  onMove,
  onRemove,
}: {
  layout: HomeLayout;
  point: Point;
  span: { from: number; to: number };
  changes: number;
  /** Which layer an edit writes to while no edition runs: `EDITION_COPY.landsOnDay`. */
  landsOn: MessageDescriptor;
  onMove: (to: MinuteOfDay) => void;
  onRemove: () => void;
}) {
  const intl = useWorkbenchIntl();
  const [open, setOpen] = useState(false);
  const cardId = useId();
  const until =
    span.to === MINUTES_IN_DAY
      ? intl.formatMessage(CONTROLS_COPY.midnight)
      : formatTimeOfDay(span.to);
  const name =
    point === null ? intl.formatMessage(CONTROLS_COPY.pointStart) : formatTimeOfDay(point);

  return (
    <div className="flex flex-col gap-2xs">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={cardId}
        aria-label={intl.formatMessage(open ? CONTROLS_COPY.pointClose : CONTROLS_COPY.pointOpen, {
          point: name,
        })}
        onClick={() => setOpen(!open)}
        data-testid="point-chip"
        className={cn(
          CARD,
          'flex min-w-0 items-center gap-xs px-2xs py-4xs text-left transition-colors',
          'hover:border-stroke-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      >
        <Clock aria-hidden="true" className="size-[1rem] shrink-0 text-on-canvas-muted" />
        <span
          className={cn(
            'shrink-0 font-mono text-m font-semibold tabular-nums',
            point === null && 'font-sans',
          )}
        >
          {point === null ? intl.formatMessage(CONTROLS_COPY.pointStart) : formatTimeOfDay(point)}
        </span>
        {/*
          The two facts a person needs to know where they are before clicking
          anything: how long this point lasts and, for a moment, how much it differs
          from the one before it. Both are worded rather than counted, because the
          same sentence stands in the card underneath.
        */}
        <span className="min-w-0 flex-1 truncate text-s text-on-canvas-muted">
          {intl.formatMessage(
            point === null ? CONTROLS_COPY.pointStartUntil : CONTROLS_COPY.pointSpan,
            point === null ? { until } : { until, changes },
          )}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'ml-auto size-[1rem] shrink-0 text-on-canvas-muted transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div id={cardId} className={cn(CARD, 'flex flex-wrap items-center gap-xs p-xs')}>
          {point === null ? (
            <span className={NOTE}>
              {intl.formatMessage(CONTROLS_COPY.pointStartLead, { until })}{' '}
              <RuleTip about={intl.formatMessage(CONTROLS_COPY.pointStart)} />
            </span>
          ) : (
            <>
              <label className="flex items-center gap-2xs">
                <span className="sr-only">{intl.formatMessage(CONTROLS_COPY.pointTime)}</span>
                <input
                  type="time"
                  step={STEP * 60}
                  value={formatTimeOfDay(point)}
                  onChange={(event) => {
                    const next = parseMinute(event.target.value);
                    if (next !== null) onMove(next);
                  }}
                  className={cn(FIELD, 'font-mono text-m font-semibold')}
                  data-testid="point-time"
                />
              </label>
              {/*
                The rule, and not the span. The span is on the chip thirty pixels
                above this card and says the same words, so saying it twice in one
                glance is the kind of repetition a reader notices and cannot act on.
              */}
              <RuleTip about={intl.formatMessage(CONTROLS_COPY.pointTime)} />
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto size-[2rem]"
                aria-label={intl.formatMessage(CONTROLS_COPY.pointRemove, {
                  time: formatTimeOfDay(point),
                })}
                onClick={onRemove}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </>
          )}
          {point === null && layout.moments.length === 0 && (
            <span className={cn(NOTE, 'w-full')}>
              {intl.formatMessage(CONTROLS_COPY.noMoments)}
            </span>
          )}
          {/*
            Which layer an edit lands on, said every time and not only when it is an
            edition: a line that appears only sometimes is a line nobody learns to
            look for (ADR 0059 §2). `Edition.tsx` says the other half of it.
          */}
          <span className="w-full text-s font-medium text-on-canvas">
            {intl.formatMessage(landsOn)}
          </span>
        </div>
      )}
    </div>
  );
}
