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
    'Eine Community-App für die Mitglieder von CORRECTIV, gebaut als ein plattformfreier Core mit der Expo-App als Host. Der Core hält das gesamte Verhalten und importiert kein UI-Framework und kein Plattform-SDK. Deshalb hat der Austausch der kompletten Ansichtsschicht seinerzeit kein einziges Verhalten gekostet.',
  'landing.note':
    'Diese Workbench veröffentlicht die Dokumente des Repositories selbst, unverändert und an Ort und Stelle, und stellt die laufende App daneben.',

  'landing.status.heading': 'Was die App liest',
  'landing.status.note':
    'Eine Zahl je Eintrag im Manifest, weshalb die Statusübersicht auf mehr kommt: Sie zeichnet die Artikelfamilie als ihre {feeds} Feeds, denn veraltet ist immer ein Feed. Die Zahlen stammen aus einem Lauf gegen die Livequellen vom {measured}, {age}, den ein wöchentlicher Job neu nimmt. Während Sie das hier lesen, aktualisiert sich nichts, denn die Feeds senden keinen CORS-Header, über den ein Browser sie neu nehmen könnte.',

  'landing.figure.live': 'Livequellen',
  'landing.figure.sample': 'Beispieldatensätze',
  'landing.figure.noSource': 'Gewünscht, ohne Quelle',
  'landing.figure.questions': 'Offene redaktionelle Fragen',

  'landing.doors.heading': 'Wohin von hier',

  'landing.door.preview.kind': 'Die App, laufend',
  'landing.door.preview.title': 'Vorschau',
  'landing.door.preview.blurb':
    'Die App selbst in Gerätegröße, mit einem Inspektor für ihren State, ihre Konsole, ihre Palette und ihr Layout. Keine Installation und kein Emulator, und die Adresse stellt genau das wieder her, was Sie gerade sehen.',

  'landing.door.sources.kind': 'Bestandsaufnahme',
  'landing.door.sources.title': 'Quellen',
  'landing.door.sources.blurb':
    'Zu allem, was die App zeigt: ob es eine Live-Quelle ist, eine Datei, die für eine noch nicht vorhandene API einspringt, oder ein gewünschtes Feature, zu dem es überhaupt nichts zu lesen gibt.',

  'landing.door.handbook.kind': 'Aufgeschrieben',
  'landing.door.handbook.title': 'Handbuch',
  'landing.door.handbook.blurb':
    'Was das System ist und wie man darin arbeitet: die Architektur, die Zeichnungen davon, die Konventionen und die Fallstricke, die jede Prüfung bestehen.',

  'landing.door.decisions.kind': 'Protokolle',
  'landing.door.decisions.title': 'Entscheidungen',
  'landing.door.decisions.blurb':
    'Warum das Repository so ist, wie es ist, und welche seiner Aussagen inzwischen abgelaufen sind.',

  'landing.door.design.kind': 'Von Hand gezeichnet',
  'landing.door.design.title': 'Design',
  'landing.door.design.blurb':
    'Die Figma-Datei, aus der die Screens kommen, und die drei Stellen, an denen sie den Code erreicht.',

  'landing.layout.heading': 'Wie das Repository aufgebaut ist',
  'landing.layout.core':
    'Das Modell, die Parser, die Services, die Caches und der gesamte State. Es importiert kein UI-Framework und kein Plattform-SDK, und ein Test lässt den Build scheitern, sobald sich daran etwas ändert.',
  'landing.layout.mobile':
    'Die Expo-App: iOS, Android und ein Web-Target. Sie hält die Screens und eine Datei, die die Ports implementiert.',
  'landing.layout.tokens':
    'Die gemeinsame Palette. Das WordPress-CMS von CORRECTIV nutzt dieselben Werte, und diese Workbench ebenso, weshalb keine Seite hier die Farben für sich abspalten kann.',
  'landing.layout.records':
    '{records, plural, one {# Protokoll} other {# Protokolle}}. Ein Protokoll wird nie umgeschrieben, damit es im Rückblick richtig aussieht: Eine Aussage, die eine spätere Entscheidung falsch gemacht hat, wird an Ort und Stelle durchgestrichen. So durchgestrichen {retired, plural, one {ist # Aussage} other {sind # Aussagen}}.',

  'landing.footer':
    '{licence} · <repoLink>{repo}</repoLink> · gebaut aus <commitLink>{commit}</commitLink>',
};
