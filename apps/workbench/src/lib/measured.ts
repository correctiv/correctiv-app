import type { IntlShape } from 'react-intl';

import { wbMessage } from '../i18n/messages';

/**
 * How old a hand-taken figure is, worked out in the reader's browser.
 *
 * Deliberately not at build time. A published page sits at its address for
 * months, and a build-time "2 days ago" is a lie the moment the third day
 * passes. The date in the manifest is a fact and does not move; the distance
 * from today to it is the part that has to be recomputed on every view.
 */
export function daysSince(iso: string): number {
  const then = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(then)) return Number.NaN;
  const today = new Date();
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((now - then) / 86_400_000);
}

/**
 * The age in words, for a sentence that already names the date.
 *
 * **It takes the formatter**, and until 2026-09-18 it did not: it returned
 * English prose, and three sentences on this site dropped that prose into their
 * own. On the German pages that read „gemessen (2 days ago)“ and „Die Zahlen …
 * wurden von Hand am 2026-09-16 erhoben (2 days ago)“.
 *
 * Nothing caught it and nothing could. `test/rendered-literals.test.ts` walks JSX
 * children and visible props; a string returned from a function is neither, so
 * this is one of the places ADR 0052 §1 reaches and the check does not. The
 * remedy is the shape rather than the walk: a function that hands out a sentence
 * has to be handed the language, and then it cannot get it wrong.
 *
 * `wbMessage` and not `defineMessages`, because this module imports no React.
 */
export const AGE = wbMessage({
  id: 'measured.age',
  defaultMessage: '{days, plural, =0 {today} one {yesterday} other {# days ago}}',
  description:
    'How long ago a figure was measured, in a sentence that already names the day. {days} is whole days, counted in the reader’s own browser rather than at build time, because a published page sits at its address for months. Zero is today and one is yesterday; German needs no other branches, and a language that does may add them.',
});

export const AGE_UNKNOWN = wbMessage({
  id: 'measured.age.unknown',
  defaultMessage: 'date unknown',
  description:
    'Stands in for measured.age when the day cannot be parsed, or is in the future. Not an error a reader can act on, which is why it says what is missing rather than what went wrong.',
});

export function ageInWords(intl: IntlShape, iso: string): string {
  const days = daysSince(iso);
  if (Number.isNaN(days) || days < 0) return intl.formatMessage(AGE_UNKNOWN);
  return intl.formatMessage(AGE, { days });
}

/**
 * A quarter, because the article feeds publish weekly at best.
 *
 * A post count from three months ago is not a current one, and nothing on this
 * site can tell the reader that except the calendar.
 */
export const STALE_AFTER_DAYS = 90;

export function isStale(iso: string): boolean {
  const days = daysSince(iso);
  return !Number.isNaN(days) && days >= STALE_AFTER_DAYS;
}
