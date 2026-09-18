import type { Locale } from '../stores/settings';

/**
 * A date or a number, in the language the host said it renders in.
 *
 * **Everything here was pinned to `'de-DE'`**, in four module-scope formatters and
 * three hand-assembled patterns, and the functions were named for it. That was
 * right while the locale was a constant in the core: one locale, one option bag,
 * every time. [ADR 0049](../../../../adr/0049-the-catalogue-is-a-package.md) §4 made
 * the language a thing the host names, and a date that ignores it is the half of a
 * translated app that nobody notices until they read "12. June 2026".
 *
 * So the locale is a parameter. Not read from a module-scope value, and not
 * defaulted: a default would be the constant back under another name, and the whole
 * failure mode is that it is invisible.
 *
 * **Built once per locale rather than once.** The formatters were module constants
 * because nothing about them varied. Something does now, so they are cached by
 * locale instead. That is not a speed claim — nobody has measured either shape, and
 * ADR 0026 holds that "a performance recommendation stays a measurement task until a
 * runtime problem is demonstrated". It is the same reasoning arriving at a map
 * instead of a constant.
 */
interface Formatters {
  weekday: Intl.DateTimeFormat;
  dayMonthYear: Intl.DateTimeFormat;
  dayMonth: Intl.DateTimeFormat;
  number: Intl.NumberFormat;
}

/**
 * What a locale is called to `Intl`, which is not what it is called to this app.
 *
 * **`en-GB` is the choice that decides something, and it was nearly left unargued.**
 * Measured against the four formats this file asks for — `weekday`, `dayMonthYear`,
 * `dayMonth` and `number`. `de` and `de-DE` agree on all four. `en` and `en-GB`
 * disagree on the two that write the month out, `dayMonthYear` and `dayMonth`:
 * "January 1, 2024" against "1 January 2024", because the bare tag resolves to
 * American order. The weekday and the number come out the same either way. So the
 * region is not decorative here and it is not decisive everywhere either: it picks
 * the order of a written-out date, which is what `formatDate` and `formatDateShort`
 * both print. A first version of this paragraph said the short date was one of the
 * two that agree; it is `dayMonth` and it is one of the two that differ.
 * British, because this repository's English is British
 * throughout: its prose, its `defaultMessage`s and its own `toLocaleString('en-GB')` in
 * the workbench.
 *
 * `de-DE` is kept for the same kind of reason even though it changes nothing today:
 * "which region's conventions" is a real question — Swiss German writes thousands with
 * an apostrophe — and the answer this app has shipped is Germany's.
 *
 * **One answer, read by two places.** `apps/mobile/src/i18n/Localisation.tsx` hands the
 * same tag to `IntlProvider`, so that an ICU `{x, date}` in a catalogue and a call into
 * this file cannot print the same day two ways. Nothing in the catalogue uses one yet;
 * the first that does would have found the seam.
 */
const REGION: Record<Locale, string> = { de: 'de-DE', en: 'en-GB' };

/** The tag `Intl` wants for a locale this app names. */
export function intlLocale(locale: Locale): string {
  return REGION[locale];
}

const cache = new Map<Locale, Formatters>();

function formatters(locale: Locale): Formatters {
  const held = cache.get(locale);
  if (held) return held;
  const tag = REGION[locale];
  const built: Formatters = {
    weekday: new Intl.DateTimeFormat(tag, { weekday: 'long' }),
    dayMonthYear: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long', year: 'numeric' }),
    dayMonth: new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'long' }),
    number: new Intl.NumberFormat(tag),
  };
  cache.set(locale, built);
  return built;
}

/** The slice of `Intl.DateTimeFormat` the assembly below uses. Named so a test can
 * stand in for a runtime whose `formatToParts()` has a hole. */
interface PartFormatter {
  format(date: Date): string;
  formatToParts(date: Date): Intl.DateTimeFormatPart[];
}

type DateParts = Partial<Record<Intl.DateTimeFormatPartTypes, string>>;

/** Pins one date string to the German pattern `assemble` spells out, reading the
 * fields by name out of `formatter.formatToParts()`. Assembling does not merely
 * order the fields, it discards whatever separators the locale data carries, and
 * that is the point: byte-identity with the tables this replaced is the goal, and a
 * pinned pattern cannot drift when CLDR changes its mind.
 *
 * `assemble` returns undefined when the runtime left a field out, and the
 * formatter's own `format()` answers instead. That case is not hypothetical:
 * Android's Hermes was measured and produces every field, iOS was never measured at
 * all and its Hermes is not backed by `android.icu`, and a German-looking
 * "12. Juni undefined" on screen is worse than the locale's own wording. */
export function assembleDateParts(
  formatter: PartFormatter,
  date: Date,
  assemble: (parts: DateParts) => string | undefined,
): string {
  const byType: DateParts = {};
  for (const part of formatter.formatToParts(date)) byType[part.type] = part.value;
  return assemble(byType) ?? formatter.format(date);
}

/**
 * The hand-assembled patterns are GERMAN'S, and every other language gets its own.
 *
 * `assembleDateParts` reads the fields by name and throws the locale's separators
 * away, which is deliberate: byte-identity with the tables this replaced was the
 * goal, and a pinned pattern cannot drift when CLDR changes its mind. That argument
 * is about German and holds only for German. `${day}. ${month} ${year}` in English
 * is "12. June 2026", which is not a date anybody writes.
 *
 * So the assembly is asked for only when the locale is the one it was written for,
 * and every other language takes the formatter's own `format()` — which is the
 * branch `assembleDateParts` already had for a runtime whose `formatToParts()` has a
 * hole. The German output is unchanged to the byte; English is CLDR's.
 */
const assembled = (locale: Locale, assemble: (parts: DateParts) => string | undefined) =>
  locale === 'de' ? assemble : () => undefined;

/** "12. Juni 2026" in German, and whatever the locale writes elsewhere. */
function dayMonthYear(d: Date, locale: Locale): string {
  return assembleDateParts(
    formatters(locale).dayMonthYear,
    d,
    assembled(locale, ({ day, month, year }) =>
      day && month && year ? `${day}. ${month} ${year}` : undefined,
    ),
  );
}

/** "Freitag, 12. Juni 2026" — the home header's date, per the design draft. */
export function formatDateWeekday(iso: string | Date, locale: Locale): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  const weekday = assembleDateParts(formatters(locale).weekday, d, (parts) => parts.weekday);
  /*
   * The comma and the space are German's too, and they are the one piece this
   * cannot hand to `Intl`: there is no option bag that produces "weekday, date" as
   * one call, so the two are formatted apart and joined here. Every language this
   * app is likely to grow puts a comma there, and the day one does not, this is the
   * line to look at — named rather than left to be discovered.
   */
  return `${weekday}, ${dayMonthYear(d, locale)}`;
}

export function formatDate(iso: string | Date, locale: Locale): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return dayMonthYear(d, locale);
}

export function formatDateShort(iso: string | Date, locale: Locale): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '';
  return assembleDateParts(
    formatters(locale).dayMonth,
    d,
    assembled(locale, ({ day, month }) => (day && month ? `${day}. ${month}` : undefined)),
  );
}

export function formatTimeHm(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Seconds as the whole number of minutes a duration is called, never zero.
 *
 * The rounding and not the word, so a screen can hand the number to a descriptor
 * and get its own language's spelling. `formatMinutesDe` below is the one caller
 * that still wants the German with it.
 */
export function minutesOf(sec: number): number {
  return Math.max(1, Math.round(sec / 60));
}

/**
 * "25 Min." — coarse episode length from seconds (podcast lists).
 *
 * **The one German the core still renders that no check names.** It was two
 * callers until a cold review separated them, and only one of them was ever the
 * hard case. The video screen had `Video.durationSec` on the model already, so
 * lifting it was a descriptor and `minutesOf` above, which is what it now does.
 *
 * What is left is the podcast path, where `Min.` is not a sentence a caller could
 * be handed: the result goes into `PodcastEpisode.durationLabel`, a FORMATTED
 * string that `services/podcast.service.ts` builds, `data/podcasts.ts` and
 * `data/backstage.ts` type out by hand, and
 * `apps/mobile/src/lib/podcasts/offlineBundle.generated.ts` carries 132 of.
 * Getting the word out of THAT means the episode model carrying `durationSec` and
 * the screens formatting it, which rewrites sample data and regenerates a bundle —
 * worth doing, and not inside somebody else's string lift (#141).
 *
 * `packages/app-core/test/localisation-seam.test.ts` cannot see it, and that is
 * not a hole to plug there: the net is the characters `äöüß„“`, and no cheap
 * check catches a German word spelled with none of them. Named here instead, where
 * the string is, the way the app names the four in `RecoveryScreen.tsx`.
 */
export function formatMinutesDe(sec: number): string {
  return `${minutesOf(sec)} Min.`;
}

/** Counts, grouped the way the locale groups them: responses, reports, views.
 * Every caller passes a whole number, and that is the contract — this is a
 * counter's formatter, not a general-purpose one. It no longer refuses to round,
 * though: the hand-rolled grouping it replaced never touched a fraction,
 * `Intl.NumberFormat` defaults to three decimals, and 1234.5678 therefore reads
 * "1.234,568" in German. An average or a rate wants its own formatter with the
 * precision written down, not this one. */
export function formatNumber(n: number, locale: Locale): string {
  return formatters(locale).number.format(n);
}
