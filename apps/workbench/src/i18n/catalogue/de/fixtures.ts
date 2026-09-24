/**
 * German for the `fixtures.*` ids: the storage fixtures the preview's state tool
 * offers, one name and one line each.
 *
 * They live with the data they write, in `preview/frame/seed.ts`, rather than
 * with the panel that lists them, because a fixture is a whole state and its
 * name is part of it. The one row of that list that is NOT a fixture, „Unberührt
 * lassen“, is `tools.state.none`.
 *
 * **What the fixtures write is not here at all.** An account, an entitlement, two
 * saved articles and a submitted form go into `localStorage` for the app to find,
 * so they are in whatever spelling the app expects and no reader of this panel
 * ever sees them.
 *
 * „Die Anmeldung“ is this tool's word for the sign-in gate the app's root layout
 * renders in place of every route. It said „die Tür“ until the plain-words pass,
 * which is the team's word for it and not the newsroom's. `A++` stays in its own
 * spelling because it is what the app itself calls the setting, and the saved
 * articles are named by their tab, „Gespeichert“, rather than by its route.
 */
/*
 * "Start" and not "Startseite", which is what this said first. The app's own
 * German for that tab is "Start" (`de/frame.ts`'s `frame.pages.home`), and the
 * descriptors on these two hints say so to a translator: a fixture's hint names
 * a screen, so it has to use the name the reader will see on it.
 */
export const fixtures: Record<string, string> = {
  'fixtures.fresh': 'Frische Installation',
  'fixtures.fresh.hint': 'Nichts gespeichert. Die App startet abgemeldet bei der Anmeldung.',

  'fixtures.signedIn': 'Angemeldet',
  'fixtures.signedIn.hint': 'Der erste Start eines Mitglieds: nach der Anmeldung ins Onboarding.',

  'fixtures.noAccess': 'Angemeldet, kein Zugang zur App',
  'fixtures.noAccess.hint':
    'Ein Mitglied mit 0 € Beitrag. Die Anmeldung leitet es zum Upgrade weiter.',

  'fixtures.onboarded': 'Onboarding abgeschlossen',
  'fixtures.onboarded.hint': 'Der Normalfall: Die App startet auf dem Tab Start.',

  'fixtures.freeMember': 'Kostenlos, mit Lokal-Newsletter',
  'fixtures.freeMember.hint':
    'Ein kostenloses Mitglied statt eines mit Beitrag. Die App startet auf dem Tab Start.',

  'fixtures.saved': 'Gespeicherte Artikel',
  'fixtures.saved.hint': 'Ohne diesen Zustand ist der Tab „Gespeichert“ leer.',

  'fixtures.interests': 'Interessen gewählt',
  'fixtures.interests.hint':
    'Eine persönliche Startseite: mehr Feeds, Blöcke in anderer Reihenfolge.',

  'fixtures.submitted': 'Aufruf beantwortet',
  'fixtures.submitted.hint': 'Das Formular zeigt den Dank statt der Fragen.',

  'fixtures.bundle': 'Nur mitgelieferte Inhalte',
  'fixtures.bundle.hint': 'Die App zeigt nur die mitgelieferten Inhalte, als wäre sie offline.',

  'fixtures.bigType': 'Größte Textgröße',
  'fixtures.bigType.hint':
    'A++ (1,15), in der App gewählt: ersetzt die Textgröße des Systems auf jedem Bildschirm, auch im Artikel.',
};
