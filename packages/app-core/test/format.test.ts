import { describe, expect, it } from 'vitest';
import {
  assembleDateParts,
  formatDate,
  formatDateShort,
  formatDateWeekday,
  formatMinutesDe,
  minutesOf,
  formatNumber,
  formatTimeHm,
} from '../src/lib/format';

/**
 * These formatters lean on `Intl.DateTimeFormat` and `Intl.NumberFormat`. Two
 * separate measurements stand behind that, and neither covers the other:
 *
 * - Both constructors exist on `hermes-android 250829098.0.17` (arm64), the runtime
 *   this app ships on Android — ADR 0026 §6, which measured which `Intl`
 *   constructors are present and says to confirm on a device, and on iOS separately.
 * - The German data itself came out of that confirmation: an Android 16 / API 36
 *   x86_64 emulator run on 2026-09-14, recorded in pull request #135.
 *
 * Node's own `Intl` is full ICU, though, so a pass here only proves the assembly
 * logic is right; it is not evidence the device produces the same bytes. iOS has
 * never been measured at all.
 */
describe('date formatting', () => {
  // Constructed in local time so the assertions do not depend on the TZ the
  // suite runs in (CI is UTC, Pascal's machine is CEST).
  const d = new Date(2026, 5, 12, 17, 20, 6); // 12 June 2026, a Friday

  it('formats a full German date', () => {
    expect(formatDate(d, 'de')).toBe('12. Juni 2026');
  });

  it('formats a German date with weekday', () => {
    expect(formatDateWeekday(d, 'de')).toBe('Freitag, 12. Juni 2026');
  });

  it('formats a short German date', () => {
    expect(formatDateShort(d, 'de')).toBe('12. Juni');
  });

  it('accepts ISO strings', () => {
    expect(formatDate('2026-01-01T00:00:00', 'de')).toBe('1. Januar 2026');
    expect(formatDateShort('2026-12-31T12:00:00', 'de')).toBe('31. Dezember');
  });

  it('returns an empty string for unparseable input instead of "Invalid Date"', () => {
    expect(formatDate('nope', 'de')).toBe('');
    expect(formatDateWeekday('', 'de')).toBe('');
    expect(formatDateShort('nope', 'de')).toBe('');
  });

  it('names every month, on both the long and the short formatter', () => {
    const months = [
      'Januar',
      'Februar',
      'März',
      'April',
      'Mai',
      'Juni',
      'Juli',
      'August',
      'September',
      'Oktober',
      'November',
      'Dezember',
    ];
    months.forEach((name, index) => {
      const date = new Date(2026, index, 1);
      expect(formatDate(date, 'de')).toBe(`1. ${name} 2026`);
      expect(formatDateShort(date, 'de')).toBe(`1. ${name}`);
    });
  });

  it('names every weekday', () => {
    const weekdays = [
      'Sonntag',
      'Montag',
      'Dienstag',
      'Mittwoch',
      'Donnerstag',
      'Freitag',
      'Samstag',
    ];
    // 2026-06-07 is a Sunday, so the seven days from it cover every weekday once.
    for (let offset = 0; offset < 7; offset++) {
      const date = new Date(2026, 5, 7 + offset);
      expect(date.getDay()).toBe(offset);
      expect(formatDateWeekday(date, 'de')).toBe(`${weekdays[offset]}, ${formatDate(date, 'de')}`);
    }
  });

  it('does not pad a single-digit day', () => {
    expect(formatDate(new Date(2026, 6, 5), 'de')).toBe('5. Juli 2026');
    expect(formatDateShort(new Date(2026, 6, 5), 'de')).toBe('5. Juli');
  });

  it('crosses a year boundary', () => {
    expect(formatDate(new Date(2026, 11, 31), 'de')).toBe('31. Dezember 2026');
    expect(formatDate(new Date(2027, 0, 1), 'de')).toBe('1. Januar 2027');
  });

  it('formats a leap day', () => {
    expect(formatDate(new Date(2028, 1, 29), 'de')).toBe('29. Februar 2028');
    expect(formatDateShort(new Date(2028, 1, 29), 'de')).toBe('29. Februar');
  });

  it('reads the day off the clock the device is on, not off a pinned zone', () => {
    // Every assertion above builds a local-time Date and CI runs in UTC, so a
    // formatter pinned to a fixed `timeZone` would pass all of them. These do not:
    // a pinned zone whose offset differs from the environment's pushes one end of
    // the local day into the neighbouring one. Both ends are asserted, because a
    // pin ahead of local moves the late one and a pin behind it moves the early one.
    expect(formatDate(new Date(2026, 5, 12, 0, 0, 0), 'de')).toBe('12. Juni 2026');
    expect(formatDate(new Date(2026, 5, 12, 23, 59, 59), 'de')).toBe('12. Juni 2026');
    expect(formatDateWeekday(new Date(2026, 5, 12, 0, 0, 0), 'de')).toBe('Freitag, 12. Juni 2026');
    expect(formatDateWeekday(new Date(2026, 5, 12, 23, 59, 59), 'de')).toBe(
      'Freitag, 12. Juni 2026',
    );
    expect(formatDateShort(new Date(2026, 5, 12, 0, 0, 0), 'de')).toBe('12. Juni');
    expect(formatDateShort(new Date(2026, 5, 12, 23, 59, 59), 'de')).toBe('12. Juni');
  });
});

describe('assembling a date from formatToParts()', () => {
  const d = new Date(2026, 5, 12, 17, 20, 6);
  const full = new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  /** Stands in for a runtime whose `formatToParts()` names one field fewer than the
   * Android Hermes this was measured against. */
  const missing = (type: Intl.DateTimeFormatPartTypes) => ({
    format: (date: Date) => full.format(date),
    formatToParts: (date: Date) => full.formatToParts(date).filter((p) => p.type !== type),
  });
  const dayMonthYear = (parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>>) =>
    parts.day && parts.month && parts.year
      ? `${parts.day}. ${parts.month} ${parts.year}`
      : undefined;

  it('falls back to the formatter instead of rendering the word "undefined"', () => {
    expect(assembleDateParts(full, d, dayMonthYear)).toBe('12. Juni 2026');
    for (const type of ['day', 'month', 'year'] as const) {
      const assembled = assembleDateParts(missing(type), d, dayMonthYear);
      expect(assembled).not.toContain('undefined');
      expect(assembled).toBe(full.format(d));
    }
  });
});

describe('formatTimeHm', () => {
  it('renders player positions as m:ss', () => {
    expect(formatTimeHm(0)).toBe('0:00');
    expect(formatTimeHm(9)).toBe('0:09');
    expect(formatTimeHm(65)).toBe('1:05');
    expect(formatTimeHm(3600)).toBe('60:00');
  });

  it('truncates fractional seconds', () => {
    expect(formatTimeHm(59.9)).toBe('0:59');
  });
});

describe('minutesOf, the number a duration is called', () => {
  it('rounds to the nearest whole minute', () => {
    expect(minutesOf(1500)).toBe(25);
    expect(minutesOf(1530)).toBe(26);
  });

  it('never says nothing, because a clip that exists lasted some time', () => {
    expect(minutesOf(0)).toBe(1);
    expect(minutesOf(5)).toBe(1);
  });
});

describe('formatMinutesDe', () => {
  it('rounds to whole minutes', () => {
    expect(formatMinutesDe(1500)).toBe('25 Min.');
    expect(formatMinutesDe(1530)).toBe('26 Min.');
  });

  it('never shows "0 Min." for a short clip', () => {
    expect(formatMinutesDe(0)).toBe('1 Min.');
    expect(formatMinutesDe(5)).toBe('1 Min.');
  });
});

describe('formatNumber', () => {
  it('groups thousands with a dot', () => {
    expect(formatNumber(1000, 'de')).toBe('1.000');
    expect(formatNumber(1234567, 'de')).toBe('1.234.567');
  });

  it('leaves small numbers alone', () => {
    expect(formatNumber(0, 'de')).toBe('0');
    expect(formatNumber(999, 'de')).toBe('999');
  });

  it('groups right at the thousands boundaries', () => {
    expect(formatNumber(999, 'de')).toBe('999');
    expect(formatNumber(1000, 'de')).toBe('1.000');
    expect(formatNumber(1001, 'de')).toBe('1.001');
    expect(formatNumber(9999, 'de')).toBe('9.999');
    expect(formatNumber(10000, 'de')).toBe('10.000');
    expect(formatNumber(999999, 'de')).toBe('999.999');
    expect(formatNumber(1000000, 'de')).toBe('1.000.000');
  });

  it('groups a negative number the same way, with the sign kept in front', () => {
    expect(formatNumber(-999, 'de')).toBe('-999');
    expect(formatNumber(-1000, 'de')).toBe('-1.000');
    expect(formatNumber(-1234567, 'de')).toBe('-1.234.567');
  });

  it('rounds a fraction at three decimals, where the grouping it replaced never rounded', () => {
    // Every caller passes a count, so this is not a case the app reaches today. It
    // is pinned because the contract moved silently: the regex this replaced left
    // the fraction alone, and the first caller to hand over an average would be
    // rounded past a green suite otherwise.
    expect(formatNumber(1234.5, 'de')).toBe('1.234,5');
    expect(formatNumber(1234.5678, 'de')).toBe('1.234,568');
  });
});

/**
 * The same dates and numbers in the other language, which is the half that could
 * not exist before [ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §4.
 *
 * **The German assembly is German's and nobody else's.** `assembleDateParts` reads
 * the fields by name and throws the locale's separators away, so that the output is
 * byte-identical with the tables it replaced and cannot drift when CLDR changes its
 * mind. Applied to English that produces "12. June 2026", which is not a date
 * anybody writes — so the assembly is asked for only when the locale is `'de'`, and
 * every other language takes the formatter's own output.
 *
 * These assertions are what says that is true rather than intended. Without them
 * the German pattern could be applied to English and nothing here would notice,
 * which is exactly the shape the whole file was in before.
 */
describe('the other language', () => {
  const d = new Date(2026, 5, 12, 17, 20, 6); // 12 June 2026, a Friday

  it('writes an English date the way English writes one', () => {
    expect(formatDate(d, 'en')).toBe('12 June 2026');
    expect(formatDateShort(d, 'en')).toBe('12 June');
  });

  it('does not put the German full stop after the day', () => {
    // The one thing the German assembly would carry across if it were applied.
    expect(formatDate(d, 'en')).not.toContain('12.');
    expect(formatDateShort(d, 'en')).not.toContain('12.');
  });

  it('names the weekday in the language asked for', () => {
    expect(formatDateWeekday(d, 'de')).toBe('Freitag, 12. Juni 2026');
    expect(formatDateWeekday(d, 'en')).toBe('Friday, 12 June 2026');
  });

  it('groups a number the way the locale groups it', () => {
    // The separator is the whole point: a German reader sees 1.234 where an
    // English one sees 1,234, and getting it the wrong way round reads as a
    // decimal fraction rather than as a thousand.
    expect(formatNumber(1234, 'de')).toBe('1.234');
    expect(formatNumber(1234, 'en')).toBe('1,234');
    expect(formatNumber(1234567, 'de')).toBe('1.234.567');
    expect(formatNumber(1234567, 'en')).toBe('1,234,567');
  });

  it('gives the same answer twice, because the formatters are cached per locale', () => {
    // They were module constants until a second locale existed, and they are a map
    // now. A cache keyed wrongly would hand German's formatter to English on the
    // second call and nothing else here would see it.
    expect(formatDate(d, 'en')).toBe(formatDate(d, 'en'));
    expect(formatDate(d, 'de')).toBe('12. Juni 2026');
    expect(formatDate(d, 'en')).toBe('12 June 2026');
    expect(formatDate(d, 'de')).toBe('12. Juni 2026');
  });

  it('still returns an empty string for unparseable input', () => {
    expect(formatDate('nope', 'en')).toBe('');
    expect(formatDateWeekday('', 'en')).toBe('');
    expect(formatDateShort('nope', 'en')).toBe('');
  });
});
