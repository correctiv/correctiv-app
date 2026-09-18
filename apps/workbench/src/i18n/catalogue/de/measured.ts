/**
 * German for the `measured.*` ids: how old a figure on this site is.
 *
 * Two ids and one sentence between them, used by three pages that each name the
 * day and then say how long ago that was. `lib/measured.ts` argues why the
 * distance is worked out in the reader's browser rather than at build time, and
 * why the function that says it in words has to be handed the language.
 *
 * German counts the days the same way English does, so the plural has the two
 * branches the source has and no more. "heute" and "gestern" are the two days
 * that have a name rather than a number, in both.
 */
export const measured: Record<string, string> = {
  'measured.age': '{days, plural, =0 {heute} one {gestern} other {vor # Tagen}}',
  'measured.age.unknown': 'Datum unbekannt',
};
