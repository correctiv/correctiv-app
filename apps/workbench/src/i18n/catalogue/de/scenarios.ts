/**
 * German for the `scenarios.*` ids: the list of named examples of the home screen in the
 * home tool, and the few lines it shows (`preview/scenarios.ts`, `preview/home/Scenario.tsx`).
 *
 * „Szenario“ is the word the records use (ADR 0036 §11). A scenario's title says that it
 * is an example, because its date is made up.
 */
export const scenarios: Record<string, string> = {
  'scenarios.label': 'Szenario',
  'scenarios.none': 'Keins',
  'scenarios.wahlabend': 'Wahlabend (Beispiel)',
  'scenarios.sample': 'Angeheftete Artikel sind feste Beispiele. Alles andere ist live.',
  'scenarios.live': 'Alle Inhalte sind live.',
  'scenarios.ask': 'Sie haben eigene Änderungen. Das Szenario würde sie ersetzen.',
  'scenarios.replace': 'Szenario laden',
  'scenarios.keep': 'Meine Änderungen behalten',
};
