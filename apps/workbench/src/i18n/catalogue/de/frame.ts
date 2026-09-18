/**
 * German for the `frame.*` ids: the bar above the framed app, and the address under it.
 *
 * `Portrait`, `Landscape` and `Fit` stay as they are. The team says them in English and
 * they are what the control has always been labelled; translating them would rename a
 * control rather than translate a sentence.
 */
export const frame: Record<string, string> = {
  'frame.toolbar': 'Rahmen',
  'frame.device': 'Gerät',
  'frame.width': 'Breite in CSS-Pixeln',
  'frame.height': 'Höhe in CSS-Pixeln',

  'frame.day.hide': 'Den Tag einklappen',
  'frame.day.show': 'Den Tag unter dem Rahmen zeigen',
  'frame.day.hideTip': 'Der Tag · zum Einklappen drücken',

  'frame.orientation.toPortrait': 'Auf Portrait umschalten',
  'frame.orientation.toLandscape': 'Auf Landscape umschalten',
  'frame.orientation.portraitTip': 'Portrait · zum Drehen drücken',
  'frame.orientation.landscapeTip': 'Landscape · zum Drehen drücken',
  'frame.orientation.legend': 'Ausrichtung',
  'frame.orientation.portrait': 'Portrait',
  'frame.orientation.landscape': 'Landscape',

  'frame.more': 'Weitere Bedienelemente des Rahmens: Zoom, neu laden, ohne Rahmen öffnen',
  'frame.more.tip': 'Zoom, neu laden, ohne Rahmen öffnen',
  'frame.more.fold': 'Einklappen',

  'frame.zoom': 'Zoom',
  'frame.zoom.fit': 'Fit',
  'frame.route': 'Route',
  'frame.reload': 'Den Rahmen neu laden',

  'frame.raw': 'Die App allein öffnen, ohne den Rahmen',
  'frame.raw.tip': 'Die App ohne den Rahmen öffnen',
  'frame.raw.devTip':
    'Die App ohne den Rahmen öffnen · ein Entwicklungsserver wendet keinen Basispfad an, deshalb landet das auf der 404-Seite der App',

  'frame.copyLink': 'Diese Ansicht als Link kopieren',
  'frame.copied': 'Kopiert',

  // The page list on the bar (`preview/ui/Pages.tsx`). What is inside the list —
  // the groups, the labels, the notes — comes from `preview/routes.ts` and is
  // still English.
  'frame.pages.open': 'Zu einer Seite springen',
  'frame.pages.empty': 'Keine Seite dieses Namens. Das Feld daneben nimmt jede beliebige Adresse.',

  // The stage the frame stands on (`preview/ui/Stage.tsx`). Neither is drawn.
  'frame.stage.heading': 'App-Rahmen',
  'frame.stage.title': 'Vorschau der App',

  // What is inside the page list (`preview/routes.ts`): the groups, the notes, and
  // the three labels this site had to invent. The other labels are the app's own
  // screen names, are already German, and are not ids at all.
  'frame.pages.group.tabs': 'Tabs',
  'frame.pages.group.screens': 'Screens',
  'frame.pages.group.withAnId': 'Mit einer Id',
  'frame.pages.group.worthReaching': 'Erreichbar sein sollte',

  'frame.pages.home': 'Start',
  'frame.pages.artikel': 'der Reader, eine WebView',
  'frame.pages.gespeichert': 'eine FlatList',
  'frame.pages.formular': 'das Mitmach-Formular',
  'frame.pages.onboarding': 'ein Modal',
  'frame.pages.player': 'ein Modal über dem laufenden Audio',
  'frame.pages.serie': 'die zweite FlatList',
  'frame.pages.gallery': 'Komponenten-Galerie',
  'frame.pages.gallery.note': 'jede Komponente, zweimal, auf beiden Flächen',
  'frame.pages.notFound': 'Nicht gefunden',
  'frame.pages.notFound.note': 'jede Adresse, für die die App keine Route hat',
};
