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
};
