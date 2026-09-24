/**
 * Berlin's wall clock, worked out by hand, for the home document and nothing else.
 *
 * [ADR 0059](../../../../adr/0059-the-day-gets-a-date-and-the-newsroom-plans-in-editions.md)
 * §6: every time the home document writes, `at`, `from` and `until`, is wall-clock time in
 * `Europe/Berlin`, and the fold converts an instant to that clock once. The record left one
 * thing to be measured before that could be relied on, which is whether Hermes on Android
 * gives a Berlin wall clock through `Intl`. This file is the answer that does not need the
 * measurement: **it does not ask `Intl` at all.** One zone, one rule, a few lines, and the
 * same answer on every engine the app runs on, including a Hermes built without ICU data.
 *
 * ## The rule
 *
 * Central European Time is UTC+1. Summer time is UTC+2, from the last Sunday of March at
 * 01:00 UTC to the last Sunday of October at 01:00 UTC, which is the EU's rule since 1996
 * and the one Germany follows. Both changes happen at the same instant everywhere in the
 * EU, so they are written here as instants rather than as local times, and that is what
 * keeps the arithmetic free of the question "01:00 in which clock".
 *
 * `test/berlin-time.test.ts` holds this against Node's ICU for every hour of six years,
 * which is where the rule is checked against somebody else's reading of it rather than
 * against this paragraph.
 *
 * ## The two awkward days
 *
 * On the spring day the wall clock jumps from 02:00 to 03:00, so `02:30` names no instant.
 * On the autumn day it runs from 03:00 back to 02:00, so `02:30` names two. §6 argues why
 * neither matters to the fold, which only ever asks "at or before", and this file makes
 * the one choice left: a time that does not exist is the instant the clock jumps (it is
 * passed, and applied at the next minute there is), and a time that exists twice is the
 * first of its two instants.
 *
 * No `Date` method that reads the device's zone is used anywhere here — only `Date.UTC`
 * and the `getUTC*` family — so the answer does not depend on where the phone, the CI
 * runner or the reviewer happens to be.
 */

/** Milliseconds since the epoch. What a clock reads, and what the fold is handed. */
export type Instant = number;

/** `YYYY-MM-DD`, a calendar day in Berlin. */
export type BerlinDate = string;

/** Where an instant falls on Berlin's wall clock. */
export interface WallClock {
  readonly date: BerlinDate;
  /** Minutes since Berlin midnight on `date`, 0 to 1439. */
  readonly minute: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The last Sunday of a month, at 01:00 UTC, which is when the EU changes its clocks. */
function lastSundayAtOne(year: number, month: number): Instant {
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(year, month + 1, 0));
  const day = last.getUTCDate() - last.getUTCDay();
  return Date.UTC(year, month, day, 1);
}

/** Whether Berlin keeps summer time at this instant. */
function isSummer(instant: Instant): boolean {
  const year = new Date(instant).getUTCFullYear();
  return instant >= lastSundayAtOne(year, 2) && instant < lastSundayAtOne(year, 9);
}

/** How far Berlin is ahead of UTC at this instant, in milliseconds. */
function offset(instant: Instant): number {
  return isSummer(instant) ? 2 * HOUR : HOUR;
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/**
 * The minute of the Berlin day as the day's own fold reads it: the wall clock, except that
 * it never runs backwards.
 *
 * On the autumn day the wall clock shows 02:00 to 02:59 twice. Read naively, a moment of
 * the day at 02:30 would be applied at the first 02:30, taken back at the second 02:00 and
 * applied again at the second 02:30, and the screen would flicker for half an hour. ADR
 * 0059 §6 promises the opposite: a minute that occurs twice applies an idempotent change
 * twice, and nothing is undone in between. So for the repeated hour this answers the
 * latest minute the day has already shown, 02:59, until the wall clock passes 03:00 again.
 * An edition does not need this, because it is read on the instant axis.
 */
export function berlinDayMinute(instant: Instant): number {
  const back = lastSundayAtOne(new Date(instant).getUTCFullYear(), 9);
  if (instant >= back && instant < back + HOUR) return 2 * 60 + 59;
  const shifted = new Date(instant + offset(instant));
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** A `Date` read through its UTC fields, as a Berlin date. */
function dateOf(shifted: Date): BerlinDate {
  return `${pad(shifted.getUTCFullYear(), 4)}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/**
 * An instant on Berlin's wall clock: the day, and the minute of it.
 *
 * Shift by the offset, then read the UTC fields, which are Berlin's once shifted. The
 * minute is floored, so 18:00:59 is still 18:00, which is what a moment at 18:00 means.
 */
export function berlinWallClock(instant: Instant): WallClock {
  const shifted = new Date(instant + offset(instant));
  return {
    date: dateOf(shifted),
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/**
 * The Berlin day of an instant, as a `Date` safe to hand to a formatter that reads its
 * own runtime's local fields — `Intl.DateTimeFormat` with no `timeZone`, which is what
 * `format.ts` uses throughout.
 *
 * `new Date(instant)` is the wrong half of this: an absolute instant, read back through
 * whatever zone the device is in. A reader east of Berlin can be into the next calendar
 * day there while Berlin's own evening is still running, and the home screen's header
 * showed exactly that split date once it started taking the fold's instant instead of its
 * own (#254) — a real device is one fixed zone, but not necessarily Berlin's. Local noon of
 * the Berlin day sidesteps it instead of asking the device to agree with Berlin: built and
 * read back through the SAME zone, whichever one that is, its local calendar fields are
 * always this day, never the one before or after it.
 */
export function berlinCalendarDate(instant: Instant): Date {
  const [year, month, day] = dateParts(berlinWallClock(instant).date)!;
  return new Date(year, month, day, 12);
}

/** The parts of a Berlin date, or null when it is not one the calendar has. */
function dateParts(date: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month, day));
  // `Date.UTC` rolls 2026-02-30 over into March rather than refusing it, so the date is
  // read back and compared: a day the calendar has not got is not a day.
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return [year, month, day];
}

/** Whether a string is a Berlin date this file can read. */
export function isBerlinDate(value: unknown): value is BerlinDate {
  return typeof value === 'string' && dateParts(value) !== null;
}

/**
 * A minute of a Berlin day, as an instant.
 *
 * Two candidates, summer and winter, and the one that reads back as the same wall clock
 * wins; summer is tried first, which is what makes the doubled autumn hour answer with the
 * earlier of its two instants. Neither reading back is the spring gap, and the answer there
 * is the instant the clock jumps.
 *
 * `minute` may run past a day either way (1440 is the next midnight), which is what lets a
 * caller ask for the end of a day without doing calendar arithmetic of its own.
 */
export function berlinInstant(date: BerlinDate, minute: number): Instant | null {
  const parts = dateParts(date);
  if (!parts) return null;
  const [year, month, day] = parts;
  const wall = Date.UTC(year, month, day) + minute * MINUTE;
  const wanted = new Date(wall);

  for (const candidate of [wall - 2 * HOUR, wall - HOUR]) {
    const read = new Date(candidate + offset(candidate));
    if (read.getTime() === wanted.getTime()) return candidate;
  }
  // The spring gap: the wall clock never shows this minute, so it is the moment it jumps.
  return lastSundayAtOne(wanted.getUTCFullYear(), 2);
}

/** A Berlin date, some days later or earlier. Calendar days, not 24-hour steps. */
export function addDays(date: BerlinDate, days: number): BerlinDate {
  const parts = dateParts(date);
  if (!parts) return date;
  const [year, month, day] = parts;
  return dateOf(new Date(Date.UTC(year, month, day + days)));
}

/**
 * The next Berlin midnight strictly after this instant.
 *
 * `home-layout.ts`'s `nextChangeAfter` computes exactly this as one of its candidates,
 * and it is here too because a host's clock needs it independently of the document: the
 * home header names a Berlin calendar day (ADR 0059 §6), which changes at Berlin midnight
 * whether or not anything in the document does, and `nextChangeAfter` answers `null` for
 * a layout with no moments and no editions — correctly, that is a fact about the FOLD, not
 * about the header. `apps/mobile/src/lib/home/clock.ts` is where the two are combined.
 *
 * Always strictly after `instant`: today's Berlin day runs at most to minute 1439, and
 * tomorrow's midnight is the first instant of the day after it, so no filtering is needed
 * the way `nextChangeAfter`'s other candidates need it.
 */
export function nextBerlinMidnightAfter(instant: Instant): Instant {
  const { date } = berlinWallClock(instant);
  return berlinInstant(addDays(date, 1), 0)!;
}

/**
 * `YYYY-MM-DDTHH:MM`, as the document writes `from` and `until`, into its two halves.
 *
 * As strict as `parseTimeOfDay` is about a time, for the same reason: a parser that
 * guessed what `2026-9-27 18:00` meant would be where the guess went wrong. No seconds, no
 * zone and no `Z`, because the document speaks Berlin time and says so nowhere else.
 */
export function parseBerlinDateTime(value: unknown): WallClock | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 23 || minutes > 59 || !isBerlinDate(match[1])) return null;
  return { date: match[1]!, minute: hours * 60 + minutes };
}

/** The same two halves back into the document's spelling. */
export function formatBerlinDateTime(clock: WallClock): string {
  return `${clock.date}T${pad(Math.floor(clock.minute / 60))}:${pad(clock.minute % 60)}`;
}
