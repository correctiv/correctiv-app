import { ChevronLeft, ChevronRight, Layers, Plus } from 'lucide-react';
import { useRef, useSyncExternalStore } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';

import { addDays, berlinInstant, berlinWallClock } from '@correctiv/app-core/lib/berlin-time';
import {
  MINUTES_IN_DAY,
  type HomeEdition,
  type MinuteOfDay,
} from '@correctiv/app-core/lib/home-layout';

import { cn } from '../../lib/cn';
import { Button } from '../../ui/kit/button';
import type { PreviewState } from '../state';
import {
  editionsOn,
  formatTimeOfDay,
  momentAt,
  movedMoment,
  pointAt,
  targetAt,
  withEdition,
  withEditionMoment,
  withMoment,
} from './document';
import { inkOf, nameOf } from './Edition';
import {
  openedAt,
  parseMinute,
  percent,
  playheadFrom,
  snap,
  STEP,
  timeAt,
  timeOn,
} from './minutes';
import { getLayout, setLayout, subscribeLayout } from './store';

/**
 * Everything the day says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/home.ts`.
 *
 * `home.*`, because the track is the home document's clock even though it hangs under
 * the frame rather than in the tool; `frame.*` beside it is the bar's own vocabulary.
 * The row shows three words and hides the rest: most of what is here is read aloud or
 * appears on a tooltip, which is what ADR 0042 §4 buys by letting the labels go.
 */
const COPY = defineMessages({
  heading: {
    id: 'home.timeline.heading',
    defaultMessage: 'The day',
    description: 'The heading of the track under the frame. Read aloud and never seen.',
  },
  timeField: {
    id: 'home.timeline.time',
    defaultMessage: 'The time the frame is showing',
    description: 'The label of the time field beside the track. Read aloud and never seen.',
  },
  live: {
    id: 'home.timeline.live',
    defaultMessage: 'Live',
    description:
      'The button that gives the app its own clock back, drawn beside the track. A term of art, and a different state from a simulated time that happens to be now.',
  },
  addPoint: {
    id: 'home.timeline.addPoint',
    defaultMessage: 'Add a moment at this minute',
    description:
      'The accessible name of the button that names the playhead’s minute as a moment of the day. home.timeline.addPointShort is the same button’s visible word, which goes below 640px.',
  },
  addPointShort: {
    id: 'home.timeline.addPointShort',
    defaultMessage: 'Moment',
    description:
      'The visible word on the button whose accessible name is home.timeline.addPoint. It has an icon beside it and a whole sentence would not fit.',
  },
  momentDrag: {
    id: 'home.timeline.momentDrag',
    defaultMessage: 'The moment at {time}, drag to move it',
    description:
      'The accessible name of one stop on the track while the home tool is open and the stop can be moved. {time} is the moment’s time of day, as 18:30.',
  },
  momentGo: {
    id: 'home.timeline.momentGo',
    defaultMessage: 'Go to the moment at {time}',
    description:
      'The accessible name of one stop on the track while the home tool is shut, when pressing it only moves the playhead. {time} is the moment’s time of day, as 18:30.',
  },
  date: {
    id: 'home.timeline.date',
    defaultMessage: '{date}',
    description:
      'The day the track is showing, beside the arrows that step it, as the weekday and the date: “Sat 27/09” in English, “Sa., 27.09.” in German. {date} is that day, already formatted for the language by the browser; the message exists so that a language can put words around it.',
  },
  dayBefore: {
    id: 'home.timeline.dayBefore',
    defaultMessage: 'The day before',
    description:
      'The accessible name of the arrow left of the date beside the track. It moves the playhead to the same minute one day earlier. home.timeline.dayAfter is its twin.',
  },
  dayAfter: {
    id: 'home.timeline.dayAfter',
    defaultMessage: 'The day after',
    description:
      'The accessible name of the arrow right of the date beside the track. It moves the playhead to the same minute one day later. home.timeline.dayBefore is its twin.',
  },
  editionHere: {
    id: 'edition.here',
    defaultMessage: 'New edition',
    description:
      'The visible word on the button beside the track that starts an edition at the playhead. An edition is a named layer over the ordinary day, a campaign or an election night, active for a span of dates. edition.hereLong is the same button’s accessible name.',
  },
  editionHereLong: {
    id: 'edition.hereLong',
    defaultMessage: 'Start a one-day edition at this minute',
    description:
      'The accessible name of the button whose visible word is edition.here. The new edition starts at the playhead and ends at the same minute the next day; its popover in the panel changes both.',
  },
  editionTaken: {
    id: 'edition.taken',
    defaultMessage: 'An edition already starts at exactly this minute. Edit that one instead.',
    description:
      'The tooltip on edition.here when it is switched off: a new edition here could not be narrower than the one already running, so it would never be the one an edit lands on.',
  },
  editionBand: {
    id: 'edition.band',
    defaultMessage: '{edition}, on this day from {from} to {to}',
    description:
      'Read out for the coloured band an edition draws along the track. {edition} is the edition’s own title as the newsroom wrote it, or its id where it has none; {from} and {to} are times of day, as 18:00, and {to} is 24:00 where the edition runs on past midnight.',
  },
  editionMomentGo: {
    id: 'edition.momentGo',
    defaultMessage: 'Go to {time} in {edition}',
    description:
      'The accessible name of a stop an edition draws on the track, for one of its own moments. {time} is a time of day, as 23:00; {edition} is the edition’s title, or its id where it has none.',
  },
});

/** The hours that carry a number. Every three, because every one of them did not fit. */
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

/**
 * The day, under the framed app.
 *
 * [ADR 0042](../../../../../adr/0042-the-timeline-belongs-to-the-stage.md) §1: this is
 * not a tool. The controls above the frame say what you are looking at — which device,
 * which way up, which route — and the hour is that kind of fact, not an inspection of
 * what is on the stage. So it sits with them, below the frame rather than behind the
 * rail, and somebody showing another person the home screen in the evening does not have
 * to find a tool first.
 *
 * ## Looking and writing, and where the line falls
 *
 * §3: looking never changes anything. With the home tool shut, the track moves the
 * playhead and jumps between the moments the document already names, and that is all —
 * which is enough for the demo, the screenshot and the argument about whether the evening
 * reads well. It is also exactly what `apps/mobile/src/lib/home/clock.ts` already says
 * about its own key: the simulated hour selects between states the document describes and
 * cannot introduce one.
 *
 * With the tool open, `editing` is true and two things are added: a stop can be dragged,
 * and the playhead's minute can be made a moment. Both are writes, and both are here
 * rather than in the panel because a track is where they are done — you cannot drag a
 * stop that is on another screen. Removing a moment stays in the panel, because removing
 * names *which* point, and naming the point is what the panel's head is for.
 *
 * A moment is never created as a side effect of a drag. ADR 0039 §10 decided that while
 * the track was still in the panel, and putting the track where everybody will touch it
 * makes that argument stronger rather than weaker.
 *
 * ## One minute, two drawings
 *
 * The playhead's minute is `state.time`, which is the address (`tm=18:30`), and the
 * panel's head reads the same value out of the same place. ADR 0042's "What it costs"
 * names this as the thing that must not become two pieces of state, because two of them
 * would disagree in front of somebody. The document is read the same way, straight out of
 * `./store.ts` rather than handed down from the page, because the page does not have it.
 */
export function Timeline({
  state,
  onChange,
  editing,
  compact,
}: {
  state: PreviewState;
  onChange: (patch: Partial<PreviewState>) => void;
  /** Whether the home tool is open, which is what §3 makes the writes conditional on. */
  editing: boolean;
  /**
   * §4, and it is only ever about the labels.
   *
   * "The labels are what does not fit; the track itself is one-dimensional and fits
   * anywhere" — so below 1024 the hours lose their numbers, the stops lose their times,
   * the track loses the height it was carrying them in, and **nothing else goes**. The
   * time is named in §4's own list of what the folded row still has, and Live is how a
   * simulated hour is given back; a row that dropped either would be one a narrow window
   * cannot get out of.
   *
   * A prop rather than an `lg:` variant, because the same judgement decides the track's
   * height, the hour numbers and the stop labels, and three spellings of it is three
   * places for it to part company with itself. The page decides, out of the same `WIDE`
   * the chrome already uses.
   */
  compact: boolean;
}) {
  const intl = useWorkbenchIntl();
  const layout = useSyncExternalStore(subscribeLayout, getLayout, getLayout);

  /*
   * The machine's own clock, so the track can mark it and the app can be put back on it.
   * `openedAt()` and not a `useState` of its own: the panel folds the document at the
   * same instant, and `./minutes.ts` says what two reads of the clock would cost.
   */
  const opened = openedAt();
  const real = berlinWallClock(opened);

  const simulated = state.time !== null;
  const playhead = playheadFrom(state.time, opened);
  const minute = playhead.minute;
  const point = pointAt(layout, minute);
  /*
   * The layer an edit would land on, which decides what "Point here" makes: a moment of
   * the day, or a moment of the edition running at the playhead (ADR 0059 §2).
   */
  const target = targetAt(layout, playhead.instant);
  /* The editions on at some point of the playhead's day, which is what the track draws. */
  const bands = editionsOn(layout, playhead.date);

  const goTo = (next: MinuteOfDay) => onChange({ time: timeAt(playhead, next) });
  /*
   * A day earlier or later at the same minute, which always names the day in the address:
   * "Saturday at 18:00" is the link this whole row exists to produce.
   */
  const stepDay = (days: number) =>
    onChange({ time: timeOn(addDays(playhead.date, days), minute) });

  /*
   * The two writes §3 allows, each refusing itself while the tool is shut.
   *
   * The markup below already withholds the button, and the track below already withholds
   * the drag, so these guards look redundant and are not: a cold review measured what the
   * check on them was worth, and a rendered condition is the thing somebody edits. The
   * guard is in the write, where the rule is, and the markup decides only what is offered.
   *
   * `getLayout()` rather than the `layout` above, because a drag writes many times
   * between two renders: the closed-over document would be the one the drag started on,
   * so every step after the first would move the moment back from where the last put it.
   */
  const moveMoment = (from: MinuteOfDay, to: MinuteOfDay) => {
    if (!editing) return;
    setLayout(movedMoment(getLayout(), from, to));
  };

  const addPoint = () => {
    if (!editing) return;
    const current = getLayout();
    const edition = targetAt(current, playhead.instant).edition;
    setLayout(
      edition === null
        ? withMoment(current, snap(minute))
        : withEditionMoment(current, edition.id, snap(minute)),
    );
    goTo(snap(minute));
  };

  /*
   * ADR 0059 §8's "Edition here": a one-day edition from the playhead's minute, snapped
   * the way a new moment is. The playhead then names its day, because an edition is about a
   * date and a link to it that said only "18:00" would open on some other day.
   */
  const addEdition = () => {
    if (!editing) return;
    setLayout(withEdition(getLayout(), playhead.date, snap(minute)).layout);
    onChange({ time: timeOn(playhead.date, snap(minute)) });
  };
  /*
   * Whether "Edition here" would make nothing: only where an edition already runs from
   * exactly this minute to exactly where a new one could end (`withEdition` says why).
   */
  const editionTaken = withEdition(layout, playhead.date, snap(minute)).id === null;

  /* Whether "Point here" would make nothing, on whichever layer it would write. */
  const pointTaken =
    target.edition === null
      ? momentAt(layout, snap(minute)) !== null
      : target.edition.moments.some((moment) => moment.minute === snap(minute));

  /*
   * The day as the reader's language writes it, from a noon that is the same calendar day
   * in every zone: the date is Berlin's, and the browser is only asked to spell it.
   */
  const [year, month, day] = playhead.date.split('-').map(Number);
  const spelled = intl.formatDate(Date.UTC(year!, month! - 1, day!, 12), {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-xs border-t border-stroke bg-surface',
        compact ? 'px-xs py-3xs' : 'px-s py-2xs',
      )}
    >
      <h2 className="sr-only">{intl.formatMessage(COPY.heading)}</h2>

      {/*
        The day the track is on, and a step either way. ADR 0059 §2: the playhead is an
        instant now, so the track is one day of it and these are how the day changes; the
        same minute a day along, which is how "Saturday at 18:00" is reached from a
        Wednesday.
      */}
      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-[1.75rem]"
          aria-label={intl.formatMessage(COPY.dayBefore)}
          onClick={() => stepDay(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <span className="min-w-[6.5ch] text-center font-mono text-s tabular-nums text-on-canvas">
          {intl.formatMessage(COPY.date, { date: spelled })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-[1.75rem]"
          aria-label={intl.formatMessage(COPY.dayAfter)}
          onClick={() => stepDay(1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      {/*
        The editions on this day ride above the track rather than on it, in a strip of the
        same width, so the hours and the day's own stops keep the room ADR 0042 §1 moved
        the track here to get. Only while there is an edition on the day.
      */}
      <div className="flex min-w-0 flex-1 flex-col gap-4xs">
        {bands.length > 0 && (
          <Bands bands={bands} date={playhead.date} labelled={!compact} onGoTo={goTo} />
        )}
        <Track
          moments={layout.moments}
          minute={minute}
          realMinute={real.date === playhead.date ? real.minute : null}
          simulated={simulated}
          point={point}
          labelled={!compact}
          editing={editing}
          onGoTo={goTo}
          onMoveMoment={moveMoment}
        />
      </div>

      <label className="flex shrink-0 items-center gap-2xs">
        <span className="sr-only">{intl.formatMessage(COPY.timeField)}</span>
        <input
          type="time"
          step={STEP * 60}
          value={formatTimeOfDay(minute)}
          onChange={(event) => {
            const next = parseMinute(event.target.value);
            if (next !== null) goTo(next);
          }}
          className="rounded-s border border-stroke bg-canvas px-3xs py-4xs font-mono text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      {/*
        "Live" is the app's own clock, and it is a different state from "the simulated
        time happens to be now": the first has no `tm` in the address and writes no key,
        the second does both. Saying so with one button that is either pressed or not is
        what keeps this row from claiming a thing the frame is not doing.

        Filled while it has something to do and quiet while it does not, which is the way
        round a disabled control has to be drawn: a filled button that cannot be pressed
        reads as a refusal, and the state it is in — already live — is the unremarkable
        one.
      */}
      <Button
        variant={simulated ? 'default' : 'outline'}
        size="sm"
        aria-pressed={!simulated}
        className="shrink-0"
        disabled={!simulated}
        onClick={() => onChange({ time: null })}
      >
        {intl.formatMessage(COPY.live)}
      </Button>

      {/*
        The writing half of §3, and it is on screen only while the tool is open. Both the
        test and the write are against the SNAPPED minute, because that is where the point
        would land: against the raw one, a playhead typed to 11:02 offers a button that
        then makes nothing, since 11:00 already has a moment.

        The word goes below `sm` and the icon stays, which is what the toolbar above does
        with its own four controls and for the same reason — nothing is deleted on a
        narrow window, it is shown with less of itself. `aria-label` carries the word
        either way, so the button reads the same to a screen reader at every width.
      */}
      {editing && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          aria-label={intl.formatMessage(COPY.addPoint)}
          disabled={pointTaken}
          onClick={addPoint}
        >
          <Plus aria-hidden="true" />
          <span aria-hidden="true" className="max-sm:hidden">
            {intl.formatMessage(COPY.addPointShort)}
          </span>
        </Button>
      )}

      {/*
        The same kind of write, one level up, and on screen on the same terms: only while
        the tool is open, because an edition is the document (ADR 0042 §3). It is never
        disabled but in one case: a new edition is made to end where the one running here
        ends, so that it is the narrower and edits land on it, and where that one runs from
        exactly this minute there is nothing narrower to make.
      */}
      {editing && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          aria-label={intl.formatMessage(COPY.editionHereLong)}
          title={editionTaken ? intl.formatMessage(COPY.editionTaken) : undefined}
          disabled={editionTaken}
          onClick={addEdition}
        >
          <Layers aria-hidden="true" />
          <span aria-hidden="true" className="max-sm:hidden">
            {intl.formatMessage(COPY.editionHere)}
          </span>
        </Button>
      )}
    </div>
  );
}

/**
 * The track itself: the hours, the moments on it, the machine's clock, the playhead.
 *
 * A pointer anywhere on it moves the playhead, including a drag, because that is the
 * gesture the whole thing is for — you pull along the day and watch the app change. A
 * pointer on a stop moves the stop instead and stops there, so the two gestures share the
 * surface without either having a mode. With `editing` false a stop only jumps the
 * playhead to itself, which is ADR 0042 §3.
 *
 * It is not the accessible control and does not pretend to be one. The time field beside
 * it is, the stops are buttons that move the playhead by being pressed, and the panel's
 * head has a field of its own for moving a moment — so everything the track does can be
 * done by typing or by tabbing. Giving the `<div>` a slider role and arrow keys as well
 * would have been a third way to say the same thing, and the one nobody tests.
 */
function Track({
  moments,
  minute,
  realMinute,
  simulated,
  point,
  labelled,
  editing,
  onGoTo,
  onMoveMoment,
}: {
  moments: readonly { minute: MinuteOfDay; at: string }[];
  minute: MinuteOfDay;
  /** The machine's clock, or null when the track is showing another day than today. */
  realMinute: MinuteOfDay | null;
  simulated: boolean;
  point: MinuteOfDay | null;
  /** Whether the hours and the moments carry their times, which is what §4 gives up. */
  labelled: boolean;
  editing: boolean;
  onGoTo: (minute: MinuteOfDay) => void;
  onMoveMoment: (from: MinuteOfDay, to: MinuteOfDay) => void;
}) {
  const intl = useWorkbenchIntl();
  const track = useRef<HTMLDivElement>(null);
  /** Which moment a drag is carrying, by the minute it was at when the drag began. */
  const dragging = useRef<MinuteOfDay | null>(null);

  const at = (event: { clientX: number }): MinuteOfDay => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return minute;
    const share = (event.clientX - box.left) / box.width;
    return snap(Math.max(0, Math.min(1, share)) * MINUTES_IN_DAY);
  };

  return (
    <div
      ref={track}
      className={cn(
        'relative w-full min-w-0 cursor-pointer select-none rounded-md border border-stroke bg-canvas',
        labelled ? 'h-[3.25rem]' : 'h-[1.5rem]',
      )}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        if (dragging.current === null) onGoTo(at(event));
      }}
      onPointerMove={(event) => {
        if (event.buttons === 0) return;
        const to = at(event);
        const held = dragging.current;
        if (held === null) {
          onGoTo(to);
          return;
        }
        if (to !== held) {
          onMoveMoment(held, to);
          dragging.current = to;
          onGoTo(to);
        }
      }}
      onPointerUp={() => {
        dragging.current = null;
      }}
      onPointerCancel={() => {
        dragging.current = null;
      }}
    >
      {/* The hours, as the only fixed thing on the track. */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          aria-hidden="true"
          className="absolute top-0 flex h-full flex-col justify-end"
          style={{ left: percent(hour * 60), transform: 'translateX(-50%)' }}
        >
          {/*
            Full height where a number anchors it, a short mark where none does. Drawn
            the full height in the folded row, eight equal boxes read as a segmented
            control rather than as a ruler — the ticks stop being marks ON a track and
            become the edges BETWEEN parts of one.
          */}
          <span
            className={cn(
              'absolute left-1/2 w-px bg-stroke',
              labelled ? 'inset-y-0' : 'bottom-0 h-1/3',
            )}
          />
          {labelled && (
            <span className="relative bg-canvas px-4xs text-[0.6875rem] text-on-canvas-muted">
              {String(hour).padStart(2, '0')}
            </span>
          )}
        </div>
      ))}

      {/*
        The machine's clock, drawn even while a simulated time is set, because "what the
        app would be showing if you pressed Live" is the thing a person needs to see next
        to what it is showing now.
      */}
      {realMinute !== null && (
        <div
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-on-canvas-muted/50"
          style={{ left: percent(realMinute) }}
        />
      )}

      {/*
        The moments. A filled stop is the one in effect at the playhead, and at full width
        it carries its time — which is the room ADR 0042 §1 moved the track here to get.
      */}
      {moments.map((held) => (
        <div
          key={held.minute}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: percent(held.minute), transform: 'translateX(-50%)' }}
        >
          <button
            type="button"
            aria-label={intl.formatMessage(editing ? COPY.momentDrag : COPY.momentGo, {
              time: held.at,
            })}
            className={cn(
              'mt-2xs size-[0.875rem] shrink-0 rounded-full border-2 border-accent',
              editing ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
              held.minute === point ? 'bg-accent' : 'bg-canvas',
              labelled ? '' : 'mt-[0.125rem] size-[0.75rem]',
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (editing) {
                dragging.current = held.minute;
                track.current?.setPointerCapture(event.pointerId);
              }
              onGoTo(held.minute);
            }}
          />
          {labelled && (
            <span
              aria-hidden="true"
              className={cn(
                'mt-4xs rounded-s bg-canvas px-4xs font-mono text-[0.6875rem] leading-none',
                held.minute === point ? 'text-on-canvas' : 'text-on-canvas-muted',
              )}
            >
              {held.at}
            </span>
          )}
        </div>
      ))}

      {/* The playhead, last so it is over everything it points at. */}
      <div
        aria-hidden="true"
        className={cn('absolute inset-y-0 w-[2px]', simulated ? 'bg-accent' : 'bg-on-canvas')}
        style={{ left: percent(minute), transform: 'translateX(-1px)' }}
      >
        <span
          className={cn(
            'absolute -top-4xs left-1/2 size-2xs -translate-x-1/2 rotate-45',
            simulated ? 'bg-accent' : 'bg-on-canvas',
          )}
        />
      </div>
    </div>
  );
}

/**
 * The editions on the track's day, one row each, above the track and as wide as it.
 *
 * ADR 0059 §2: each edition in its own colour, derived from its id, and each of its moments
 * that falls on this day as a stop in that colour. One row per edition rather than one row
 * for all, so that a one-off inside a campaign is two bands and not one mixed colour; the
 * order is the document's. The label is the newsroom's title, which is data; the sentence a
 * screen reader hears around it is this site's.
 *
 * A stop here only moves the playhead, while the tool is open as well as while it is shut.
 * Moving an edition's moment is the panel's time field, because §8 builds no drag for it.
 */
function Bands({
  bands,
  date,
  labelled,
  onGoTo,
}: {
  bands: readonly { edition: HomeEdition; from: MinuteOfDay; to: MinuteOfDay }[];
  /** The Berlin day of the track, which says which of an edition's moments fall on it. */
  date: string;
  labelled: boolean;
  onGoTo: (minute: MinuteOfDay) => void;
}) {
  const intl = useWorkbenchIntl();

  return (
    <div className="flex w-full flex-col gap-4xs">
      {bands.map(({ edition, from, to }) => {
        const name = nameOf(edition);
        return (
          <div
            key={edition.id}
            className={cn('edition-ink relative w-full', labelled ? 'h-[0.875rem]' : 'h-[0.5rem]')}
            style={inkOf(edition.id)}
          >
            <div
              className="absolute inset-y-0 flex items-center overflow-hidden rounded-full bg-(--edition) px-3xs"
              style={{ left: percent(from), width: `calc(${percent(to)} - ${percent(from)})` }}
            >
              <span className="sr-only">
                {intl.formatMessage(COPY.editionBand, {
                  edition: name,
                  from: formatTimeOfDay(from),
                  to: to === MINUTES_IN_DAY ? '24:00' : formatTimeOfDay(to),
                })}
              </span>
              {labelled && (
                <span
                  aria-hidden="true"
                  className="truncate text-[0.625rem] font-semibold leading-none text-canvas"
                >
                  {name}
                </span>
              )}
            </div>
            {edition.moments
              .filter((moment) => {
                const at = berlinInstant(date, moment.minute)!;
                return at >= edition.start && at < edition.end;
              })
              .map((moment) => (
                <button
                  key={moment.minute}
                  type="button"
                  aria-label={intl.formatMessage(COPY.editionMomentGo, {
                    time: moment.at,
                    edition: name,
                  })}
                  className={cn(
                    'absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-pointer border-2 border-(--edition) bg-canvas',
                    labelled ? 'size-[0.625rem]' : 'size-[0.5rem]',
                  )}
                  style={{ left: percent(moment.minute) }}
                  onClick={() => onGoTo(moment.minute)}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
