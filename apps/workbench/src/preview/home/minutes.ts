import {
  berlinInstant,
  berlinWallClock,
  formatBerlinDateTime,
  parseBerlinDateTime,
  type BerlinDate,
  type Instant,
} from '@correctiv/app-core/lib/berlin-time';
import {
  MINUTES_IN_DAY,
  formatTimeOfDay,
  type MinuteOfDay,
} from '@correctiv/app-core/lib/home-layout';

/**
 * The arithmetic the day's two drawings share, and the reason it is a file.
 *
 * ADR 0042 §1 moved the track out of the panel and onto the stage, which made the
 * panel's head and the stage's track two components in two files reading one minute.
 * Everything here was a private constant in `HomeDocument.tsx` when there was only one
 * of them; copied rather than moved, the snap step is the failure that follows — a track
 * landing on fives beside a field accepting minutes, disagreeing by four minutes about
 * where a drag put the playhead, with both of them right about their own rule.
 */

/**
 * The step a drag lands on, in minutes.
 *
 * Even at the full width ADR 0042 §1 buys, a pixel is a minute and a bit, and a free
 * drag would write `11:03` for a click somebody made at eleven. Five is the coarsest step
 * nobody has to fight and the finest one a mouse can actually hit; the time field beside
 * the track is where a minute is typed exactly.
 */
export const STEP = 5;

export const snap = (minute: number): MinuteOfDay =>
  Math.max(0, Math.min(MINUTES_IN_DAY - STEP, Math.round(minute / STEP) * STEP));

/** Where a minute sits on the track, as a CSS length. */
export const percent = (value: number): string => `${(value / MINUTES_IN_DAY) * 100}%`;

/** `HH:MM` to minutes, for the `<input type="time">` fields and the address. */
export function parseMinute(value: string): MinuteOfDay | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Where the playhead is: a Berlin day, a minute of it, and the instant the two make.
 *
 * `dated` is whether the address named the day. A bare `tm=18:30` is that minute today,
 * which is what it meant before ADR 0059 gave the playhead a date, and moving the playhead
 * along the track writes the address back in whichever of the two spellings it arrived in,
 * so a link that did not name a day does not start naming one because somebody dragged.
 */
export interface Playhead {
  readonly date: BerlinDate;
  readonly minute: MinuteOfDay;
  readonly instant: Instant;
  readonly dated: boolean;
}

/**
 * The playhead a drawing shows: the address while it names a time, the moment the page was
 * opened while it does not.
 *
 * Both `Timeline.tsx` and `HomeDocument.tsx` read `state.time` this way, and it was the
 * same ternary copied into both when the track moved out of the panel — the exact
 * failure this file's header describes, one step earlier: a rule in two places agrees
 * with itself right up until somebody changes one of them.
 */
export function playheadFrom(time: string | null, opened: Instant): Playhead {
  const today = berlinWallClock(opened);
  const dated = parseBerlinDateTime(time);
  if (dated) {
    return { ...dated, instant: berlinInstant(dated.date, dated.minute)!, dated: true };
  }
  const minute = time === null ? null : parseMinute(time);
  const at = minute ?? today.minute;
  return {
    date: today.date,
    minute: at,
    instant: berlinInstant(today.date, at)!,
    dated: false,
  };
}

/** A minute on the playhead's day, in the address's spelling for that playhead. */
export function timeAt(playhead: Playhead, minute: MinuteOfDay): string {
  return playhead.dated
    ? formatBerlinDateTime({ date: playhead.date, minute })
    : formatTimeOfDay(minute);
}

/** The same minute on another day, which always names the day. */
export function timeOn(date: BerlinDate, minute: MinuteOfDay): string {
  return formatBerlinDateTime({ date, minute });
}

/**
 * The instant this page was opened at, which is what "the app's own clock" means here.
 *
 * One answer for the whole page, and that is the point of it being a function rather
 * than a `useState` initialiser in each of the two components. The track marks it and
 * the panel folds the document at it; read separately, on a page opened at 10:59:58,
 * the two would be a minute apart and the panel would name a point the track does not
 * put the playhead in. Second by second that is a rare bug and once a minute it is a
 * certain one.
 *
 * It does not tick. This is a mark on a timeline and the minute the document is read at
 * while nobody has said otherwise; a value that moved every minute would be a re-render
 * of the whole editor every minute for a line nobody is watching. A page left open
 * overnight shows the hour it was opened at, which is the same bargain
 * `HomeDocument.tsx` made when it was one `useState` — and pressing Live re-reads
 * nothing, because there is nothing here to re-read.
 *
 * Lazy rather than module scope, so the clock is read when the editor is first drawn
 * rather than when the site's bundle loads, which on a page somebody arrived at through
 * the handbook can be a different day.
 */
let opened: Instant | null = null;

export function openedAt(): Instant {
  opened ??= Date.now();
  return opened;
}
