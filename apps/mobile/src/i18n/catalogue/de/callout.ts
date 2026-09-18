/**
 * German for the `callout.*` ids: a callout, its card, its teaser and its detail
 * screen.
 *
 * Two words that look duplicated are not. `callout.crowdnewsroom.*` is what
 * `lib/participate/calloutStyle.ts` answers for a callout of that kind, and the
 * detail screen states CrowdNewsroom outright for every callout, survey included
 * — that screen was never one of the two places calloutStyle keeps in step, and
 * the migration is not the place to change what it shows.
 *
 * **One pair is not near-identical but identical**, word for word:
 * `callout.crowdnewsroom.countSoFar` and `callout.detail.responses`. They are two
 * ids because two different things answer them. The first is `calloutStyle`'s,
 * picked from the callout's kind, so a survey gets "Teilnahmen" there where a
 * CrowdNewsroom gets "Beiträge"; the second is the detail screen's own and is
 * printed for every callout whatever its kind. They read alike today only because
 * that screen says CrowdNewsroom to everybody. Merging them would make the day
 * somebody fixes that a translation problem instead of a screen decision.
 *
 * **The half of that a translator needs is no longer only here.** This file is the
 * German, so a person writing the French would never open it, and "with nothing to
 * tell them which they are looking at" was what this paragraph used to say about
 * exactly that. Both ids now carry a `description` on the descriptor itself, which
 * travels with the id into every language, and
 * `__tests__/localisation-seam.test.ts` requires one of every id that shares its
 * English with another. What stays here is the part that is about this repository:
 * which module answers which id, and why the day the detail screen stops saying
 * CrowdNewsroom is a screen decision rather than a translation.
 */
export const callout: Record<string, string> = {
  'callout.survey.kicker': 'Umfrage',
  'callout.survey.cta': 'Teilnehmen',
  'callout.survey.count': '{count, plural, one {Eine Teilnahme} other {# Teilnahmen}}',
  'callout.survey.countSoFar': '{count, plural, one {Eine Teilnahme} other {# Teilnahmen}} bisher',
  'callout.crowdnewsroom.cta': 'Mitmachen',
  'callout.crowdnewsroom.count': '{count, plural, one {Ein Beitrag} other {# Beiträge}}',
  'callout.crowdnewsroom.countSoFar':
    '{count, plural, one {Ein Beitrag} other {# Beiträge}} bisher',
  'callout.contributeAgain': 'Weiteren Hinweis geben',
  'callout.card.contributed': '✓ Sie haben beigetragen',
  'callout.teaser.kicker': 'Mitmachen · {kicker}',
  'callout.teaser.ctaAccessibility': '{cta}: {title}',
  'callout.screenTitle': 'Mitmach-Aufruf',
  'callout.detail.unknownHeadline': 'Diesen Aufruf gibt es nicht',
  'callout.detail.unknownSlug': 'Unbekannte Kennung „{slug}“.',
  'callout.detail.noSlug': 'Es wurde keine Kennung übergeben.',
  'callout.detail.responses': '{count, plural, one {Ein Beitrag} other {# Beiträge}} bisher',
  'callout.detail.whoAsks': 'Wer fragt?',
  'callout.detail.dataUse': 'Was passiert mit Ihren Daten?',
  'callout.detail.contributed':
    '✓ Sie haben bereits beigetragen, danke! Weitere Hinweise sind willkommen.',
  'callout.detail.cta': 'Mitmachen',
};
