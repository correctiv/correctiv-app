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
 * „Die Tür“ is this tool's word throughout for the sign-in gate the app's root
 * layout renders in place of every route, and `/gespeichert`, `A++` and `offline`
 * stay in their own spelling because each is what the app itself calls the thing.
 */
export const fixtures: Record<string, string> = {
  'fixtures.fresh': 'Frische Installation',
  'fixtures.fresh.hint': 'Nichts gespeichert. Die App startet an der Tür, abgemeldet.',

  'fixtures.signedIn': 'Angemeldet',
  'fixtures.signedIn.hint': 'Der erste Start eines Mitglieds: durch die Tür, ins Onboarding.',

  'fixtures.noAccess': 'Angemeldet, kein Zugang zur App',
  'fixtures.noAccess.hint':
    'Der vierte Zustand der Tür: ein 0-€-Mitglied, weitergeleitet zum Upgrade.',

  'fixtures.onboarded': 'Onboarding abgeschlossen',
  'fixtures.onboarded.hint': 'Der Normalfall: die App startet auf der Startseite.',

  'fixtures.saved': 'Gespeicherte Artikel',
  'fixtures.saved.hint': '/gespeichert ist sonst leer und zeigt nur seinen Leerzustand.',

  'fixtures.interests': 'Interessen gewählt',
  'fixtures.interests.hint':
    'Eine personalisierte Startseite: zusätzliche Feeds, Module in anderer Reihenfolge.',

  'fixtures.submitted': 'Callout beantwortet',
  'fixtures.submitted.hint': 'Das Formular zeigt dann seinen Dank statt seiner Fragen.',

  'fixtures.bundle': 'Nur mitgelieferte Inhalte',
  'fixtures.bundle.hint': 'Erzwingt den Rückfall auf das Bundle, den Status „offline“ der Feeds.',

  'fixtures.bigType': 'Größte Textgröße',
  'fixtures.bigType.hint': 'A++ (1,15), die Einstellung, an der der Reader zuerst bricht.',
};
