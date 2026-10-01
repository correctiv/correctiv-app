/**
 * German for the `profile.*` ids: the profile tab, the saved list, and the two
 * cards and one vocabulary they share.
 *
 * `profile.tier.*` is printed by the door as well as by the profile, because it
 * names a domain enum rather than a screen — see `lib/membership/tierLabel.ts`.
 * It keeps this namespace anyway: an id belongs to the file its name says
 * (`localisation-seam.test.ts`), and the profile is where those labels are read
 * most.
 */
export const profile: Record<string, string> = {
  'profile.title': 'Profil',

  'profile.tier.free': 'Kostenlose Mitgliedschaft',
  'profile.tier.paid': 'Mitgliedschaft mit Beitrag',
  'profile.tier.soli': 'Soli-Mitgliedschaft',

  'profile.club.fallbackName': 'Mitglied',
  'profile.club.tierSince': '{tier} · seit {date}',

  'profile.membership.section': 'Ihre Mitgliedschaft',
  'profile.membership.tier': 'Stufe',
  'profile.membership.source': 'Zugang über',
  'profile.membership.validUntil': 'Läuft bis',
  'profile.membership.localAreas': 'Lokale Newsletter',
  'profile.membership.manageAccount': 'Konto verwalten',
  'profile.membership.note':
    'Beitrag, Zahlungsweise und Ihre Daten verwalten Sie in Ihrem Konto auf correctiv.org.',

  'profile.source.paid': 'Ihren Beitrag',
  'profile.source.localBundle': 'Ihr Lokal-Abo',
  'profile.source.trial': 'Ihre Testphase',

  'profile.impact.section': 'Ihr Impact',
  'profile.impact.anonymous':
    'Ihr Beitrag ermöglicht diese Recherchen.{articles, select, some { Unter anderem diese hier:} other {}}',
  'profile.impact.since':
    'Sie unterstützen CORRECTIV {months, plural, one {seit Kurzem} other {seit # Monaten}}.{articles, select, some { Unter anderem diese Recherchen wurden mit ermöglicht:} other {}}',

  'profile.area.section': 'Ihr Bereich',
  'profile.nav.clubAccessibility': '{title}, Club',
  'profile.nav.reportSubtitle': 'Wohin Ihr Beitrag fließt, transparent aufgeschlüsselt.',
  'profile.nav.backstage': 'Ihr Backstage',
  'profile.nav.backstageSubtitle': 'Tagebücher, Bonusfolgen, Events',
  'profile.nav.saved': 'Gespeicherte Artikel',
  'profile.nav.savedCount':
    '{count, plural, =0 {Noch nichts gespeichert} one {# Artikel} other {# Artikel}}',
  'profile.nav.settings': 'App-Einstellungen',
  'profile.nav.settingsSubtitle': 'Benachrichtigungen, Textgröße, Über CORRECTIV',

  'profile.newsletter.section': 'Newsletter',
  'profile.newsletter.spotlight': 'Das Wichtigste, werktags am Morgen',
  'profile.newsletter.spotlightCh': 'Recherchen aus der Schweiz',
  'profile.newsletter.klima': 'Die Klima-Recherchen der Woche',

  'profile.saved.title': 'Gespeicherte Artikel',
  'profile.saved.empty':
    'Noch nichts gespeichert. Tippen Sie im Artikel auf das Lesezeichen, um ihn hier abzulegen.',
  'profile.saved.savedOn': 'gespeichert {date}',
  'profile.saved.remove': '{title} entfernen',
};
