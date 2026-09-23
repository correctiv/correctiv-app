/**
 * German for the `landing.*` ids: the front page, which is the first thing the
 * second audience reads.
 *
 * **Written as German prose rather than translated sentence by sentence.** The
 * English lede is one long sentence with a relative clause hanging off the end;
 * the German breaks where German breaks and says the same thing. Where the
 * English addresses the reader, the German does so in the formal *Sie*, which is
 * how the rest of this site addresses them.
 *
 * **Nothing here is the repository's.** Every figure the page prints arrives as a
 * number and every identifier as a value, so the licence, the repository's name,
 * the commit, the measuring day, the four counts and the four directory names are
 * outside these strings and cannot be reworded by a catalogue
 * ([ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 *
 * `Core`, `State`, `Expo`, `CORRECTIV`, `WordPress` and `CORS` are left as they
 * are. Each is what the thing is called in a German sentence too, and the first
 * two are what this team says out loud; `landing.layout.core` would read oddly
 * as „Kern“ beside a row headed `packages/app-core`.
 *
 * „Protokoll“ is the word for a record here and in `landing.door.decisions.kind`,
 * and it is the word `/decisions` and a document's own frame use, which landed
 * in the same change. An earlier version of this sentence said that board was
 * not translated yet, which was already false when it was written.
 */
export const landing: Record<string, string> = {
  'landing.title': 'Die CORRECTIV-App und alles, was darüber aufgeschrieben ist',
  'landing.lede':
    'Eine Community-App für die Mitglieder von CORRECTIV. Ihr ganzes Verhalten steckt in einem Core, der von keiner Plattform abhängt. Die Expo-App ist der Host, der ihn auf iOS, Android und ins Web bringt. Deshalb ließ sich die ganze Ansichtsschicht schon einmal austauschen, ohne dass Verhalten verloren ging.',
  'landing.note':
    'Diese Workbench zeigt die Dokumente des Repositorys unverändert und stellt die laufende App daneben.',

  'landing.status.heading': 'Was die App liest',
  'landing.status.when': 'Gemessen an den Livequellen am {measured}, {age}.',
  'landing.status.why':
    'Eine Zahl je Eintrag im Manifest. Die Quellen-Seite zählt mehr Zeilen, weil sie die Artikel als ihre {feeds} Feeds aufführt, denn veralten kann nur ein Feed. Ein wöchentlicher Job misst die Zahlen neu. Während Sie lesen, ändert sich nichts, denn die Feeds lassen keinen Abruf aus dem Browser zu.',

  'landing.figure.live': 'Livequellen',
  'landing.figure.sample': 'Beispieldatensätze',
  'landing.figure.noSource': 'Gewünscht, ohne Quelle',
  'landing.figure.questions': 'Offene redaktionelle Fragen',

  'landing.doors.heading': 'Wohin als Nächstes',

  'landing.door.preview.kind': 'Die App, laufend',
  'landing.door.preview.title': 'Vorschau',
  'landing.door.preview.blurb':
    'Die App selbst in Gerätegröße, mit Werkzeugen für ihren Zustand, ihre Konsole, ihre Farben und ihr Layout. Sie müssen nichts installieren. Die Adresse im Browser stellt genau das wieder her, was Sie sehen.',

  'landing.door.sources.kind': 'Bestandsaufnahme',
  'landing.door.sources.title': 'Quellen',
  'landing.door.sources.blurb':
    'Für alles, was die App zeigt: Ist es live, eine Ersatzdatei für eine API, die es noch nicht gibt, oder ein gewünschtes Feature ohne Quelle?',

  'landing.door.handbook.kind': 'Aufgeschrieben',
  'landing.door.handbook.title': 'Handbuch',
  'landing.door.handbook.blurb':
    'Was das System ist und wie man darin arbeitet: die Architektur, Zeichnungen dazu, die Konventionen und die Fallstricke, die jede Prüfung bestehen.',

  'landing.door.decisions.kind': 'Protokolle',
  'landing.door.decisions.title': 'Entscheidungen',
  'landing.door.decisions.blurb':
    'Warum das Repository so ist, wie es ist, und welche seiner Aussagen nicht mehr gelten.',

  'landing.door.design.kind': 'Von Hand gezeichnet',
  'landing.door.design.title': 'Design',
  'landing.door.design.blurb':
    'Die Figma-Datei hinter den Screens und die Stellen, an denen sie mit dem Code verbunden ist.',

  'landing.layout.heading': 'Wie das Repository aufgebaut ist',
  'landing.layout.core':
    'Das Modell, die Parser, die Services, die Caches und der gesamte Zustand. Es nutzt kein UI-Framework und kein Plattform-SDK. Ein Test stoppt den Build, wenn sich das ändert.',
  'landing.layout.mobile':
    'Die Expo-App für iOS, Android und das Web. Sie enthält die Screens und eine Datei, die die Ports umsetzt.',
  'landing.layout.tokens':
    'Die gemeinsame Farbpalette. Das WordPress-CMS von CORRECTIV nutzt dieselben Werte, und diese Workbench auch. Deshalb kann keine Seite hier eigene Farben verwenden.',
  'landing.layout.records':
    '{records, plural, one {# Protokoll} other {# Protokolle}}. Ein Protokoll wird nachträglich nie umgeschrieben. Macht eine spätere Entscheidung eine Aussage falsch, wird sie an ihrer Stelle durchgestrichen. Bisher {retired, plural, one {ist # Aussage} other {sind # Aussagen}} gestrichen.',

  'landing.footer':
    '{licence} · <repoLink>{repo}</repoLink> · gebaut aus <commitLink>{commit}</commitLink>',
};
