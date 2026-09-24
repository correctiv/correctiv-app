import { describe, expect, it } from 'vitest';

import {
  addDays,
  berlinCalendarDate,
  berlinDayMinute,
  berlinInstant,
  berlinWallClock,
  formatBerlinDateTime,
  isBerlinDate,
  nextBerlinMidnightAfter,
  parseBerlinDateTime,
} from '../src/lib/berlin-time';

/**
 * Berlin's wall clock, held against somebody else's reading of the same rule.
 *
 * `berlin-time.ts` implements the EU rule by hand so that the app never has to ask `Intl`
 * for a zone, which is ADR 0059 §6's open question about Hermes answered by not asking it.
 * That makes this file the only place the rule is checked against anything but its own
 * comment, and what it is checked against is Node's ICU, which carries the tz database:
 * every hour for six years, both directions, and the two days a year where a wall clock is
 * not a function of the instant.
 *
 * Node is where this runs and not where the app runs, which is the point. ICU's answer is
 * the reference; the code under test uses nothing but `Date.UTC` and the `getUTC*` family,
 * so what passes here passes on an engine without ICU data too.
 */

const ICU = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ICU's Berlin wall clock for an instant, in the same shape the file under test answers. */
function icu(instant: number): { date: string; minute: number } {
  const parts = Object.fromEntries(
    ICU.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const HOUR = 3_600_000;
const FROM = Date.UTC(2025, 0, 1);
const UNTIL = Date.UTC(2031, 0, 1);

describe('an instant on Berlin’s wall clock', () => {
  /**
   * Every hour, and a quarter past it as well, because a rule that is off by a whole hour
   * at the change would agree with ICU at every minute but the ones either side of it, and
   * the half of the check that matters is the instants closest to 01:00 UTC.
   */
  it('agrees with ICU at every hour from 2025 to 2031', () => {
    const disagreements: string[] = [];
    let checked = 0;
    for (let instant = FROM; instant < UNTIL; instant += HOUR) {
      for (const at of [instant, instant + 15 * 60_000, instant + HOUR - 60_000]) {
        checked += 1;
        const ours = berlinWallClock(at);
        const theirs = icu(at);
        if (ours.date !== theirs.date || ours.minute !== theirs.minute) {
          disagreements.push(
            `${new Date(at).toISOString()}: ${JSON.stringify(ours)} vs ${JSON.stringify(theirs)}`,
          );
        }
      }
    }
    // The floor: six years of hours, and a check that walked none of them passes nothing.
    expect(checked).toBeGreaterThan(3 * 52_000);
    expect(disagreements).toEqual([]);
  });

  /**
   * The other direction, which is what `from` and `until` go through. Every wall-clock hour
   * of six years read as an instant, and that instant read back through ICU: it has to be
   * the same wall clock, except in the one hour a year that does not exist.
   */
  it('turns every Berlin hour back into an instant ICU reads as the same hour', () => {
    const disagreements: string[] = [];
    let date = '2025-01-01';
    let checked = 0;
    while (date < '2031-01-01') {
      for (let hour = 0; hour < 24; hour += 1) {
        const instant = berlinInstant(date, hour * 60 + 30)!;
        const back = icu(instant);
        checked += 1;
        const gap = isSpringGap(date, hour);
        if (gap) continue;
        if (back.date !== date || back.minute !== hour * 60 + 30) {
          disagreements.push(`${date} ${hour}:30 -> ${JSON.stringify(back)}`);
        }
      }
      date = addDays(date, 1);
    }
    expect(checked).toBeGreaterThan(6 * 365 * 24);
    expect(disagreements).toEqual([]);
  });
});

describe('berlinCalendarDate, the day a formatter with no zone of its own can read', () => {
  /**
   * The original bug (#254): a device is one fixed zone, and reading an absolute instant
   * through it can land on a different calendar day than Berlin's. 20:00 UTC on 27
   * September is still 22:00 in Berlin (UTC+2 in September) that same evening, but it is
   * already 10:00 on the 28th fourteen hours further east — Kiribati's, which really runs
   * that far ahead of UTC. `berlinCalendarDate` has to answer the 27th whichever zone reads
   * it back; `new Date(instant)` would not.
   */
  it('names Berlin’s day, not the day a zone far enough east would read the instant as', () => {
    const instant = Date.UTC(2026, 8, 27, 20, 0);
    expect(berlinWallClock(instant).date).toBe('2026-09-27');

    const original = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Kiritimati'; // UTC+14, so the naive read is a day ahead.
      expect(new Intl.DateTimeFormat('en-CA').format(new Date(instant))).toBe('2026-09-28');
      expect(new Intl.DateTimeFormat('en-CA').format(berlinCalendarDate(instant))).toBe(
        '2026-09-27',
      );
    } finally {
      process.env.TZ = original;
    }
  });

  /** Local noon on the day itself, so a formatter reading it back needs no zone at all. */
  it('is local noon of the Berlin day', () => {
    const instant = berlinInstant('2026-06-12', 23 * 60 + 30)!;
    const date = berlinCalendarDate(instant);
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 5, 12, 12,
    ]);
  });
});

describe('nextBerlinMidnightAfter', () => {
  it('is always strictly after the instant, at the start of the next Berlin day', () => {
    expect(nextBerlinMidnightAfter(berlinInstant('2026-09-27', 0)!)).toBe(
      berlinInstant('2026-09-28', 0),
    );
    expect(nextBerlinMidnightAfter(berlinInstant('2026-09-27', 23 * 60 + 59)!)).toBe(
      berlinInstant('2026-09-28', 0),
    );
  });

  /** Both sides of a clock change, since a Berlin day either side of one is not 24 hours. */
  it('holds across a change of clocks', () => {
    // The autumn day is 25 hours; the next midnight is still the next calendar day.
    expect(nextBerlinMidnightAfter(berlinInstant('2026-10-25', 12 * 60)!)).toBe(
      berlinInstant('2026-10-26', 0),
    );
    // The spring day is 23 hours, same claim.
    expect(nextBerlinMidnightAfter(berlinInstant('2026-03-29', 12 * 60)!)).toBe(
      berlinInstant('2026-03-30', 0),
    );
  });
});

/** The last Sunday of March's 02:00 hour, according to ICU rather than to the code. */
function isSpringGap(date: string, hour: number): boolean {
  if (hour !== 2) return false;
  // If ICU never shows 02:30 on this day, it is the gap.
  const probe = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
  for (let at = probe - 3 * HOUR; at < probe + 3 * HOUR; at += 15 * 60_000) {
    const seen = icu(at);
    if (seen.date === date && seen.minute === 150) return false;
  }
  return true;
}

describe('the two days a year the wall clock is not a function of the instant', () => {
  /** 2026-03-29 is the last Sunday of March 2026: 02:00 becomes 03:00 at 01:00 UTC. */
  it('reads a minute that does not exist as the instant the clock jumps', () => {
    const jump = Date.UTC(2026, 2, 29, 1);
    expect(berlinInstant('2026-03-29', 2 * 60 + 30)).toBe(jump);
    expect(berlinInstant('2026-03-29', 2 * 60)).toBe(jump);
    expect(berlinInstant('2026-03-29', 3 * 60)).toBe(jump);
    // And the minute before the gap is an hour before it, not a minute.
    expect(berlinInstant('2026-03-29', 60 + 59)).toBe(jump - 60_000);
    expect(berlinWallClock(jump)).toEqual({ date: '2026-03-29', minute: 3 * 60 });
    expect(berlinWallClock(jump - 60_000)).toEqual({ date: '2026-03-29', minute: 60 + 59 });
  });

  /** 2026-10-25 is the last Sunday of October 2026: 03:00 becomes 02:00 at 01:00 UTC. */
  it('reads a minute that happens twice as the first of the two', () => {
    const back = Date.UTC(2026, 9, 25, 1);
    const first = back - 30 * 60_000;
    const second = back + 30 * 60_000;
    expect(berlinWallClock(first)).toEqual({ date: '2026-10-25', minute: 2 * 60 + 30 });
    expect(berlinWallClock(second)).toEqual({ date: '2026-10-25', minute: 2 * 60 + 30 });
    expect(berlinInstant('2026-10-25', 2 * 60 + 30)).toBe(first);
    // 03:00 exists once, after the repeat.
    expect(berlinInstant('2026-10-25', 3 * 60)).toBe(back + HOUR);
  });

  /**
   * The day's fold reads this rather than the wall clock, so that the repeated hour undoes
   * nothing. It is the wall clock everywhere else, and never runs backwards within a day.
   */
  it('reads the day’s minute as the wall clock, except that it never runs backwards', () => {
    const departures: number[] = [];
    for (let instant = FROM; instant < UNTIL; instant += HOUR / 4) {
      const wall = berlinWallClock(instant).minute;
      const read = berlinDayMinute(instant);
      if (read !== wall) departures.push(read);
    }
    // Six autumn days, four quarter hours of the repeated hour each, all reading 02:59.
    expect(departures).toEqual(Array.from({ length: 6 * 4 }, () => 2 * 60 + 59));
    const back = Date.UTC(2026, 9, 25, 1);
    let last = -1;
    for (let instant = Date.UTC(2026, 9, 24, 22); instant < back + 3 * HOUR; instant += 60_000) {
      const read = berlinDayMinute(instant);
      expect(read).toBeGreaterThanOrEqual(last);
      last = read;
    }
    expect(berlinDayMinute(back + 30 * 60_000)).toBe(2 * 60 + 59);
    expect(berlinDayMinute(back + HOUR)).toBe(3 * 60);
  });

  it('gives the two days their true lengths, 23 and 25 hours', () => {
    const length = (date: string) =>
      (berlinInstant(addDays(date, 1), 0)! - berlinInstant(date, 0)!) / HOUR;
    expect(length('2026-03-29')).toBe(23);
    expect(length('2026-10-25')).toBe(25);
    expect(length('2026-09-27')).toBe(24);
  });
});

describe('a date and time, as the document writes one', () => {
  it.each([
    ['2026-09-27T18:00', { date: '2026-09-27', minute: 18 * 60 }],
    ['2026-12-31T23:59', { date: '2026-12-31', minute: 23 * 60 + 59 }],
    ['2028-02-29T00:00', { date: '2028-02-29', minute: 0 }],
  ])('reads %s', (text, clock) => {
    expect(parseBerlinDateTime(text)).toEqual(clock);
    expect(formatBerlinDateTime(clock)).toBe(text);
  });

  it.each([
    ['a day the calendar has not got', '2026-02-30T12:00'],
    ['a leap day in a year without one', '2027-02-29T12:00'],
    ['a single-digit month', '2026-9-27T18:00'],
    ['a space for the T', '2026-09-27 18:00'],
    ['seconds', '2026-09-27T18:00:00'],
    ['a zone', '2026-09-27T18:00Z'],
    ['24:00', '2026-09-27T24:00'],
    ['a time alone', '18:00'],
    ['a number', 20260927],
  ])('refuses %s', (_name, value) => {
    expect(parseBerlinDateTime(value)).toBeNull();
  });

  it('knows a date from something that looks like one', () => {
    expect(isBerlinDate('2026-09-27')).toBe(true);
    expect(isBerlinDate('2026-13-01')).toBe(false);
    expect(berlinInstant('2026-13-01', 0)).toBeNull();
  });

  it('steps calendar days across a month, a year and a change of clocks', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
  });
});
