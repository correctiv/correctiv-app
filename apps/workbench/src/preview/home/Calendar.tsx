import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { defineMessages } from 'react-intl';

import {
  berlinWallClock,
  formatBerlinDateTime,
  type BerlinDate,
} from '@correctiv/app-core/lib/berlin-time';
import { MINUTES_IN_DAY, type HomeLayout } from '@correctiv/app-core/lib/home-layout';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import {
  bandsIn,
  chooseByKey,
  chosenDays,
  daysOf,
  isWeekend,
  noonOf,
  weekdayOf,
  type Band,
  type BandSizes,
  type DayChoice,
} from './calendar';
import { editableFrom, withEditionAcross } from './document';
import { inkOf, nameOf } from './Edition';
import type { Playhead } from './minutes';
import { getLayout, setLayout, setOpenEdition } from './store';

/**
 * What the week and the month say, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/home.ts` for `home.calendar.*` and `edition.ts` for `edition.*`.
 */
const COPY = defineMessages({
  today: {
    id: 'home.calendar.today',
    defaultMessage: '{day}, today',
    description:
      'The accessible name of the column for today in the week or month under the frame. {day} is the date already spelled by the browser, as “Monday, 28 September”.',
  },
  chosen: {
    id: 'home.calendar.chosen',
    defaultMessage: '{from} to {to} chosen',
    description:
      'Read out when several days have been chosen with Shift and an arrow key, or by dragging. {from} and {to} are the first and last day, as “28 September”.',
  },
  refused: {
    id: 'home.calendar.refused',
    defaultMessage:
      'Editions that take precedence already cover all of these days. Edit one of those instead.',
    description:
      'Shown under the week or month when a drag across days made no edition: every minute of those days already belongs to a narrower edition, or one runs over exactly those days, so a new one would never be the one an edit lands on.',
  },
});

/**
 * How wide a band is drawn at least, and how much room its title is given, in days.
 *
 * An edition of a few hours is exactly what somebody looks for in the overview, an election
 * night or a live event, and drawn to scale it is a sliver. So a band is never narrower than a
 * third of a day in the week, where a column is wide, and a whole day in the month, where it
 * is a finger's width: enough to see and to hit, and still starting at its real minute. The
 * title needs about a hundred pixels, which is roughly one week column and four month
 * columns at the width the stage has beside an open panel; where the band is narrower than
 * that, the title goes beside it, and a narrower window truncates it with an ellipsis.
 */
const SIZES: Record<'week' | 'month', BandSizes> = {
  week: { min: 1 / 3, title: 1 },
  month: { min: 1, title: 4 },
};

/** The words for an edition's band, which are the edition's vocabulary. */
const BAND_COPY = defineMessages({
  days: {
    id: 'edition.days',
    defaultMessage:
      '{sameMonth, select, yes {{edition}, {month} {fromDay} to {toDay}} other {{edition}, {from} to {to}}}',
    description:
      'The accessible name of an edition’s band in the week or month under the frame. {edition} is its title as the newsroom wrote it, or its id. {sameMonth} is yes when its first and last day are in one month, and then {month} is that month’s name and {fromDay} and {toDay} the two days’ numbers; otherwise {from} and {to} are the two days in full, as “September 27”.',
  },
  day: {
    id: 'edition.oneDay',
    defaultMessage: '{edition}, {day}',
    description:
      'The accessible name of an edition’s band in the week or month under the frame, for an edition on one day only. {edition} is its title, or its id; {day} is the day, as “27 September”.',
  },
});

/** A day as the browser spells it in the reader's language, from a noon that is that day everywhere. */
function useSpell() {
  const intl = useWorkbenchIntl();
  return (date: BerlinDate, options: Intl.DateTimeFormatOptions): string =>
    intl.formatDate(noonOf(date), { ...options, timeZone: 'UTC' });
}

/**
 * The week or the month, drawn under the frame where the day's track is at day zoom.
 *
 * [ADR 0059](../../../../../adr/0059-the-day-gets-a-date-and-the-newsroom-plans-in-editions.md)
 * §2: the same axis further out. A column per day, the playhead's day highlighted and the
 * playhead itself a line inside it at its minute, today marked, the weekend tinted; the
 * editions as bands across the days they span, a lane each where they overlap
 * (`calendar.ts` lays them out). There is still one playhead: a day pressed here is the
 * same minute on that day, and the day zoom shows it.
 *
 * ## Two routes to one edition, as ADR 0047 has it
 *
 * A pointer presses on a day and drags to another; letting go makes an edition from the
 * first day's midnight to the midnight after the last. The keyboard's route is its own
 * control and not a mode: the days are buttons with one tab stop between them, an arrow
 * moves the playhead a day, Shift and an arrow widen the choice from the playhead's day,
 * and Enter makes the edition of what is chosen. Both call `withEditionAcross`, so the
 * document cannot tell which one it was, and both open the new edition's popover for its
 * title. Making is a write, so it is only offered while the home tool is open (ADR 0042
 * §3); with it shut, a drag scrubs the playhead across the days instead, as the day's track
 * does across the hours.
 *
 * Moving an edition's ends by dragging them is not here; the popover's two fields do that.
 */
export function Calendar({
  layout,
  span,
  playhead,
  today,
  simulated,
  editing,
  labelled,
  onTime,
}: {
  layout: HomeLayout;
  span: 'week' | 'month';
  playhead: Playhead;
  /** The machine's own Berlin date, which is marked. */
  today: BerlinDate;
  simulated: boolean;
  editing: boolean;
  /**
   * Whether the day heads carry their weekday, which is what ADR 0042 §4 gives up below 1024.
   * The bands carry their titles at every width: a title is what somebody looks for here.
   */
  labelled: boolean;
  /** Moves the playhead, in `tm=`'s dated spelling. */
  onTime: (time: string) => void;
}) {
  const intl = useWorkbenchIntl();
  const spell = useSpell();
  const strip = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<BerlinDate, HTMLButtonElement>());
  /** The day a pointer pressed on, while it is held. */
  const pressed = useRef<BerlinDate | null>(null);
  /** Whether a key moved the choice, so the next render puts the focus on it. */
  const keyed = useRef(false);
  /** Where the choice has been widened to, or null while it is the playhead's day alone. */
  const [extent, setExtent] = useState<BerlinDate | null>(null);
  const [refused, setRefused] = useState(false);

  const days = daysOf(span, playhead.date);
  const { bands, lanes } = bandsIn(layout, days, SIZES[span]);
  const choice: DayChoice = { anchor: playhead.date, focus: extent ?? playhead.date };
  const [first, last] = chosenDays(choice);
  const focusDay = days.includes(choice.focus) ? choice.focus : days[0]!;

  /* A widening belongs to the day it was made from, and goes when the playhead moves off it. */
  useEffect(() => setExtent(null), [playhead.date, span]);

  /* Keyed on the day and not on every render: the playhead arrives a render after the key. */
  useEffect(() => {
    if (!keyed.current) return;
    keyed.current = false;
    buttons.current.get(focusDay)?.focus();
  }, [focusDay]);

  const timeOn = (date: BerlinDate) => formatBerlinDateTime({ date, minute: playhead.minute });

  const dayAt = (event: { clientX: number }): BerlinDate => {
    const box = strip.current?.getBoundingClientRect();
    if (!box || box.width === 0) return playhead.date;
    const share = (event.clientX - box.left) / box.width;
    return days[Math.max(0, Math.min(days.length - 1, Math.floor(share * days.length)))]!;
  };

  /* The one write here, and like every write on the track it refuses itself while the tool is shut. */
  const make = (one: BerlinDate, other: BerlinDate) => {
    if (!editing) return;
    const made = withEditionAcross(getLayout(), one, other);
    setExtent(null);
    if (made.id === null || made.at === null) {
      setRefused(true);
      return;
    }
    setLayout(made.layout);
    setOpenEdition(made.id);
    onTime(formatBerlinDateTime(berlinWallClock(made.at)));
  };

  /* A band chosen: the playhead to where edits land on its edition, and its popover open. */
  const choose = (band: Band) => {
    const at = editableFrom(layout, band.edition.id) ?? band.edition.start;
    if (editing) setOpenEdition(band.edition.id);
    onTime(formatBerlinDateTime(berlinWallClock(at)));
  };

  /* The keyboard's route, on every day's button: `chooseByKey` says what each key does. */
  const onDayKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter') {
      if (!editing) return;
      event.preventDefault();
      setRefused(false);
      make(first, last);
      return;
    }
    if (event.key === 'Escape' && extent !== null) {
      event.preventDefault();
      setExtent(null);
      return;
    }
    const next = chooseByKey(choice, event.key, event.shiftKey, days);
    if (!next) return;
    event.preventDefault();
    setRefused(false);
    keyed.current = next.choice.focus !== choice.focus;
    if (next.move) onTime(timeOn(next.choice.anchor));
    setExtent(next.choice.focus === next.choice.anchor ? null : next.choice.focus);
  };

  const dateName = (date: BerlinDate) =>
    spell(date, { weekday: 'long', day: 'numeric', month: 'long' });
  const shortName = (date: BerlinDate) => spell(date, { day: 'numeric', month: 'long' });

  const bandName = (band: Band): string => {
    const edition = nameOf(band.edition);
    if (band.firstDay === band.lastDay) {
      return intl.formatMessage(BAND_COPY.day, { edition, day: shortName(band.firstDay) });
    }
    return intl.formatMessage(BAND_COPY.days, {
      edition,
      from: shortName(band.firstDay),
      to: shortName(band.lastDay),
      month: spell(band.firstDay, { month: 'long' }),
      fromDay: spell(band.firstDay, { day: 'numeric' }),
      toDay: spell(band.lastDay, { day: 'numeric' }),
      sameMonth: band.firstDay.slice(0, 7) === band.lastDay.slice(0, 7) ? 'yes' : 'no',
    });
  };

  /* Heights in rem, so the bands and the columns agree on where a lane is. */
  const head = span === 'month' && labelled ? 1.75 : labelled ? 1.125 : 0.875;
  // Every band carries its title now, at every width, so a lane is tall enough for a line.
  const lane = 1;
  const gap = 0.125;
  const height = head + Math.max(lanes, 1) * (lane + gap) + 0.25;

  const n = days.length;
  const playheadAt = days.indexOf(playhead.date);
  const widened = first !== last;

  return (
    <div className="flex w-full min-w-0 flex-col gap-4xs">
      <div
        ref={strip}
        className={cn(
          '@container relative w-full min-w-0 select-none overflow-hidden rounded-md border border-stroke bg-canvas',
          editing ? 'cursor-crosshair' : 'cursor-pointer',
        )}
        style={{ height: `${height}rem` }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setRefused(false);
          const day = dayAt(event);
          pressed.current = day;
          setExtent(null);
          if (day !== playhead.date) onTime(timeOn(day));
        }}
        onPointerMove={(event) => {
          if (event.buttons === 0 || pressed.current === null) return;
          const day = dayAt(event);
          if (editing) setExtent(day === pressed.current ? null : day);
          else if (day !== playhead.date) onTime(timeOn(day));
        }}
        onPointerUp={(event) => {
          const from = pressed.current;
          pressed.current = null;
          if (from === null || !editing) return;
          const to = dayAt(event);
          if (to !== from) make(from, to);
        }}
        onPointerCancel={() => {
          pressed.current = null;
          setExtent(null);
        }}
      >
        {/* The days: a column each, and the buttons the keyboard walks. */}
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
        >
          {days.map((day, index) => {
            const monday = weekdayOf(day) === 0;
            const isToday = day === today;
            const isPlayhead = day === playhead.date;
            const name = dateName(day);
            return (
              <button
                key={day}
                ref={(node) => {
                  if (node) buttons.current.set(day, node);
                  else buttons.current.delete(day);
                }}
                type="button"
                tabIndex={day === focusDay ? 0 : -1}
                aria-label={isToday ? intl.formatMessage(COPY.today, { day: name }) : name}
                aria-pressed={isPlayhead}
                className={cn(
                  'relative flex min-w-0 flex-col items-center overflow-hidden pt-4xs leading-none',
                  'focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                  index > 0 &&
                    (span === 'month' && monday
                      ? 'border-l border-stroke-strong'
                      : 'border-l border-stroke'),
                  isWeekend(day) && 'bg-surface',
                  isPlayhead && 'bg-accent/10',
                )}
                onKeyDown={onDayKey}
                onClick={(event) => {
                  // A pointer has already moved the playhead on pressing; this is the
                  // click a screen reader or Space sends, which has no pointer before it.
                  if (event.detail === 0 && day !== playhead.date) onTime(timeOn(day));
                }}
              >
                <DayLabel
                  day={day}
                  span={span}
                  labelled={labelled}
                  today={isToday}
                  playhead={isPlayhead}
                />
              </button>
            );
          })}
        </div>

        {/* What a drag or Shift and the arrows have chosen, until it is made. */}
        {widened && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 rounded-s bg-accent/20 ring-2 ring-inset ring-accent"
            style={{
              left: `${(days.indexOf(first) / n) * 100}%`,
              width: `${((days.indexOf(last) - days.indexOf(first) + 1) / n) * 100}%`,
            }}
          />
        )}

        {/*
          The editions. One button per band, as wide as what it draws: the band at its
          drawn width and, where the title did not fit inside, the title beside it, so a
          click on the title chooses the edition as a click on the band does.
        */}
        {bands.map((band) => {
          const start = Math.min(band.left, band.labelLeft);
          const width = Math.max(band.right, band.labelRight) - start;
          const at = (share: number) => `${((share - start) / width) * 100}%`;
          const name = nameOf(band.edition);
          return (
            <button
              key={band.edition.id}
              type="button"
              data-band=""
              aria-label={bandName(band)}
              className={cn(
                'edition-ink absolute rounded-full',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-canvas',
              )}
              style={{
                ...inkOf(band.edition.id),
                top: `${head + band.lane * (lane + gap)}rem`,
                height: `${lane}rem`,
                left: `${start * 100}%`,
                width: `${width * 100}%`,
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => choose(band)}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-y-0 flex items-center gap-4xs overflow-hidden bg-(--edition) px-3xs text-canvas',
                  band.before ? 'rounded-l-none' : 'rounded-l-full',
                  band.after ? 'rounded-r-none' : 'rounded-r-full',
                )}
                style={{ left: at(band.left), width: at(start + band.right - band.left) }}
              >
                {band.before && <ChevronLeft className="-ml-4xs size-[0.75rem] shrink-0" />}
                {band.label === 'inside' && (
                  <span className="min-w-0 flex-1 truncate text-center text-[0.625rem] font-semibold leading-none">
                    {name}
                  </span>
                )}
                {band.after && <ChevronRight className="-mr-4xs ml-auto size-[0.75rem] shrink-0" />}
              </span>
              {band.label !== 'inside' && (
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-y-0 truncate px-3xs text-[0.625rem] font-semibold leading-[1rem] text-(--edition)',
                    band.label === 'left' ? 'text-right' : 'text-left',
                  )}
                  style={{
                    left: at(band.labelLeft),
                    width: at(start + band.labelRight - band.labelLeft),
                  }}
                >
                  {name}
                </span>
              )}
            </button>
          );
        })}

        {/* The playhead, a line inside its day at its minute: the day's track, seen from further out. */}
        {playheadAt !== -1 && (
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-y-0 w-[2px]',
              simulated ? 'bg-accent' : 'bg-on-canvas',
            )}
            style={{
              left: `${((playheadAt + playhead.minute / MINUTES_IN_DAY) / n) * 100}%`,
              transform: 'translateX(-1px)',
            }}
          />
        )}
      </div>

      <output className="sr-only">
        {widened
          ? intl.formatMessage(COPY.chosen, { from: shortName(first), to: shortName(last) })
          : ''}
      </output>
      {refused && (
        <output className="text-s text-on-canvas">{intl.formatMessage(COPY.refused)}</output>
      )}
    </div>
  );
}

/**
 * A day's head: its number, and its weekday where there is room.
 *
 * The room is the strip's own width, asked with a container query, so a narrow window loses
 * the weekday first and then, in the month, every number but the Mondays', and nothing
 * forces the page to scroll sideways. The accessible name is on the button and always whole.
 */
function DayLabel({
  day,
  span,
  labelled,
  today,
  playhead,
}: {
  day: BerlinDate;
  span: 'week' | 'month';
  labelled: boolean;
  today: boolean;
  playhead: boolean;
}) {
  const spell = useSpell();
  const number = spell(day, { day: 'numeric' });
  const monday = weekdayOf(day) === 0;
  const tone = cn(
    'text-[0.6875rem] tabular-nums',
    playhead ? 'font-semibold text-on-canvas' : 'text-on-canvas-muted',
    today && 'font-semibold text-accent underline decoration-2 underline-offset-2',
  );

  if (span === 'week') {
    return (
      <span aria-hidden="true" className={cn(tone, 'inline-flex gap-3xs whitespace-nowrap')}>
        <span className="hidden @min-[22rem]:inline">{spell(day, { weekday: 'short' })}</span>
        <span>{number}</span>
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="flex flex-col items-center gap-4xs">
      {labelled && (
        <span className="hidden text-[0.5625rem] text-on-canvas-muted @min-[36rem]:inline">
          {/*
            Two letters, not the browser's narrow form: "S" is both Saturday and Sunday in
            German and in English. The short form cut to two is Mo Di Mi Do Fr Sa So, and
            Mo Tu We Th Fr Sa Su; narrower than that the weekday goes and the Monday marks
            and the weekend tint say which day is which.
          */}
          {spell(day, { weekday: 'short' }).slice(0, 2)}
        </span>
      )}
      <span className={cn(tone, !monday && !today && 'hidden @min-[26rem]:inline')}>{number}</span>
    </span>
  );
}
