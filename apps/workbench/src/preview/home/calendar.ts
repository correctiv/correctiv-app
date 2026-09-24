import {
  addDays,
  berlinInstant,
  berlinWallClock,
  type BerlinDate,
  type Instant,
} from '@correctiv/app-core/lib/berlin-time';
import {
  MINUTES_IN_DAY,
  type HomeEdition,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';

/**
 * The week and the month under the frame, as arithmetic.
 *
 * [ADR 0059](../../../../../adr/0059-the-day-gets-a-date-and-the-newsroom-plans-in-editions.md)
 * §2: a day, a week and a month are three zooms of one axis, with one playhead. This file is
 * what the two outer zooms need that the day did not: which days are on screen, where an
 * edition's band lies across them and in which lane, and how the keyboard walks and widens a
 * choice of days. Pure, so `test/preview/calendar.test.ts` can hold all of it without a page.
 */

/** How far out the track is: `zm=` in the address, and absent for the day. */
export type Span = 'day' | 'week' | 'month';

export const SPANS: readonly Span[] = ['day', 'week', 'month'];

export function isSpan(value: unknown): value is Span {
  return typeof value === 'string' && (SPANS as readonly string[]).includes(value);
}

/** A Berlin date's parts. The date is always one `berlin-time.ts` made or checked. */
function parts(date: BerlinDate): [number, number, number] {
  const [year, month, day] = date.split('-').map(Number);
  return [year!, month!, day!];
}

/** The same calendar day at noon UTC, which is that day in every zone a browser can be in. */
export function noonOf(date: BerlinDate): number {
  const [year, month, day] = parts(date);
  return Date.UTC(year, month - 1, day, 12);
}

/** The day of the week, Monday first: 0 is Monday and 6 is Sunday, as a German week runs. */
export function weekdayOf(date: BerlinDate): number {
  return (new Date(noonOf(date)).getUTCDay() + 6) % 7;
}

export function isWeekend(date: BerlinDate): boolean {
  return weekdayOf(date) >= 5;
}

/** The ISO week number, which is the one a German calendar prints as "KW". */
export function weekNumberOf(date: BerlinDate): number {
  const thursday = addDays(date, 3 - weekdayOf(date));
  const [year] = parts(thursday);
  const first = Date.UTC(year, 0, 1, 12);
  return Math.floor((noonOf(thursday) - first) / (7 * 24 * 60 * 60 * 1000)) + 1;
}

/** The days a zoom shows around a date: its week from Monday, or its month from the first. */
export function daysOf(span: Exclude<Span, 'day'>, date: BerlinDate): readonly BerlinDate[] {
  if (span === 'week') {
    const monday = addDays(date, -weekdayOf(date));
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  }
  const first = `${date.slice(0, 8)}01`;
  const days: BerlinDate[] = [];
  for (let day = first; day.slice(0, 7) === first.slice(0, 7); day = addDays(day, 1)) {
    days.push(day);
  }
  return days;
}

/**
 * The date the stepper's arrows go to: a day, a week or a month along.
 *
 * A month keeps the day of the month where it can and takes the last day where it cannot,
 * so the 31st of January steps to the end of February rather than into March.
 */
export function stepped(span: Span, date: BerlinDate, by: number): BerlinDate {
  if (span === 'day') return addDays(date, by);
  if (span === 'week') return addDays(date, 7 * by);
  const [year, month, day] = parts(date);
  const target = new Date(Date.UTC(year, month - 1 + by, 1, 12));
  const length = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  const y = target.getUTCFullYear();
  const m = String(target.getUTCMonth() + 1).padStart(2, '0');
  const d = String(Math.min(day, length)).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * One edition drawn across the days on screen.
 *
 * `from` and `to` are where it really starts and ends, as shares of the strip's width, 0 to 1,
 * read through the wall clock the way the day's track is: a day is a column whatever its
 * length, and 18:00 is three quarters of the way across it on the two days a year that have
 * 23 or 25 hours as well. `left` and `right` are where the band is DRAWN, which is the same
 * span widened to the minimum a band may be (see `BandSizes`), so an election night of eight
 * hours is something the eye finds in a month. `label` says where its title goes: inside the
 * band where it fits, otherwise beside it, to the right, or to the left where the right is
 * the edge of the strip; `labelLeft` and `labelRight` are the room it is given there.
 *
 * `before` and `after` say the edition runs on past the edge of what is shown, which the
 * band draws. `firstDay` and `lastDay` are the days it touches at all, unclipped, for its
 * name: an end at exactly midnight belongs to the day before, because `until` is exclusive.
 */
export interface Band {
  readonly edition: HomeEdition;
  readonly lane: number;
  readonly from: number;
  readonly to: number;
  readonly left: number;
  readonly right: number;
  readonly label: 'inside' | 'right' | 'left';
  readonly labelLeft: number;
  readonly labelRight: number;
  readonly before: boolean;
  readonly after: boolean;
  readonly firstDay: BerlinDate;
  readonly lastDay: BerlinDate;
}

/**
 * How wide a band is drawn at least, and how much room its title needs, both in days.
 *
 * In days because a day column is the one unit both zooms have, and its width in pixels is
 * whatever the window gives; `Calendar.tsx` picks the two numbers per zoom and says why.
 */
export interface BandSizes {
  readonly min: number;
  readonly title: number;
}

/** No widening and no room for a title: the band exactly as long as the edition. */
const EXACT: BandSizes = { min: 0, title: 0 };

/** The last day an edition is on for at least a minute, which is not always `until`'s date. */
export function lastDayOf(edition: HomeEdition): BerlinDate {
  const end = berlinWallClock(edition.end);
  return end.minute === 0 ? addDays(end.date, -1) : end.date;
}

/**
 * The editions on any of these days, as bands, each in a lane of its own where it would
 * otherwise overlap another.
 *
 * What may not overlap is what is DRAWN: the band at its minimum width and its title beside
 * it where the title does not fit inside, so a label never runs into another band. Laid out
 * greedily, left to right: by where that drawn extent starts, the longer first where two start
 * together, then the document's order; each goes into the lowest lane whose last extent has
 * ended by the time it begins. Touching is not overlapping, so an edition that ends at
 * midnight and one that starts at that midnight share a lane. The lane is a drawing and says
 * nothing about precedence, which is the fold's question (ADR 0059 §4).
 */
export function bandsIn(
  layout: HomeLayout,
  days: readonly BerlinDate[],
  sizes: BandSizes = EXACT,
): { bands: readonly Band[]; lanes: number } {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return { bands: [], lanes: 0 };
  const opens = berlinInstant(first, 0)!;
  const closes = berlinInstant(addDays(last, 1), 0)!;
  const index = new Map(days.map((day, at) => [day, at]));
  const min = Math.min(1, sizes.min / days.length);
  const title = Math.min(1, sizes.title / days.length);

  const share = (instant: Instant): number => {
    if (instant <= opens) return 0;
    if (instant >= closes) return 1;
    const clock = berlinWallClock(instant);
    return (index.get(clock.date)! + clock.minute / MINUTES_IN_DAY) / days.length;
  };

  const placed = layout.editions
    .map((edition, order) => ({ edition, order }))
    .filter(({ edition }) => edition.start < closes && edition.end > opens)
    .map(({ edition, order }) => {
      const from = share(edition.start);
      const to = share(edition.end);
      // Widened to the right, from where it really starts; pushed back from the edge.
      const right = Math.min(1, Math.max(to, from + min));
      const left = Math.min(from, right - min);
      const inside = right - left >= title;
      const label: Band['label'] = inside ? 'inside' : right + title <= 1 ? 'right' : 'left';
      const labelLeft =
        label === 'right' ? right : label === 'left' ? Math.max(0, left - title) : left;
      const labelRight = label === 'right' ? right + title : label === 'left' ? left : right;
      return {
        edition,
        order,
        from,
        to,
        left,
        right,
        label,
        labelLeft,
        labelRight,
        start: Math.min(left, labelLeft),
        end: Math.max(right, labelRight),
      };
    })
    .sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.order - b.order);

  const ends: number[] = [];
  const bands = placed.map(({ edition, order: _order, start, end, ...drawn }) => {
    let lane = ends.findIndex((taken) => taken <= start);
    if (lane === -1) lane = ends.length;
    ends[lane] = end;
    return {
      edition,
      lane,
      ...drawn,
      before: edition.start < opens,
      after: edition.end > closes,
      firstDay: berlinWallClock(edition.start).date,
      lastDay: lastDayOf(edition),
    };
  });
  return { bands, lanes: ends.length };
}

/**
 * A choice of days on the strip: where it began and where it has been widened to.
 *
 * `anchor` is always the playhead's day, so a single chosen day is the day the frame shows.
 */
export interface DayChoice {
  readonly anchor: BerlinDate;
  readonly focus: BerlinDate;
}

/**
 * What a key does to the choice, the keyboard's route to the drag (ADR 0047 §2).
 *
 * An arrow moves from the day last reached to the one beside, or up and down by a week, and
 * drops any widening; the playhead goes with it, so `move` is true, and it may walk off the
 * edge into the next week or month, which the strip then shows. With Shift it widens the choice instead and leaves the
 * playhead where it is, and it stops at the edge, because the strip is drawn around the
 * playhead's day and a choice it cannot show is one nobody can check. Home and End go to
 * either end of what is shown. Null for a key that does nothing here, so the caller can let
 * the browser have it.
 */
export function chooseByKey(
  choice: DayChoice,
  key: string,
  shift: boolean,
  days: readonly BerlinDate[],
): { choice: DayChoice; move: boolean } | null {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const by: Record<string, number | undefined> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  };
  let to: BerlinDate;
  if (key === 'Home') to = first;
  else if (key === 'End') to = last;
  else if (by[key] !== undefined) to = addDays(choice.focus, by[key]!);
  else return null;

  if (!shift) return { choice: { anchor: to, focus: to }, move: to !== choice.anchor };
  const clamped = to < first ? first : to > last ? last : to;
  return { choice: { anchor: choice.anchor, focus: clamped }, move: false };
}

/** The chosen days in calendar order, as `withEditionAcross` wants them. */
export function chosenDays(choice: DayChoice): [BerlinDate, BerlinDate] {
  return choice.anchor <= choice.focus
    ? [choice.anchor, choice.focus]
    : [choice.focus, choice.anchor];
}
