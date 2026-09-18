/** German for the `home.*` ids: the home-screen configurator. */
export const home: Record<string, string> = {
  // The day under the frame (`preview/home/Timeline.tsx`).
  'home.timeline.heading': 'Der Tag',
  'home.timeline.time': 'Die Uhrzeit, die der Rahmen zeigt',
  'home.timeline.live': 'Live',
  'home.timeline.addPoint': 'Aus dieser Minute einen Moment machen',
  'home.timeline.addPointShort': 'Punkt setzen',
  'home.timeline.momentDrag': 'Der Moment um {time}, zum Verschieben ziehen',
  'home.timeline.momentGo': 'Zum Moment um {time} springen',

  // The palette, and the hairline that opens it (`preview/home/Palette.tsx`).
  // `{where}`, `{name}` and `{what}` arrive as English prose out of
  // `preview/home/document.ts`, so these read German around an English fragment
  // until those tables are descriptors too.
  'home.palette.addHere': 'Einen Block hinzufügen: {where}',
  'home.palette.title': 'Einen Block hinzufügen',
  'home.palette.lead':
    'Eingefügt wird: {where}. Angeboten wird jedes Modul, das die App hat; beurteilt wird eine Anordnung im Rahmen daneben, nicht in dieser Liste.',
  'home.palette.addModule': '{name} hinzufügen. {what}',

  // What a row says instead of a drawing (`preview/home/HomeBlock.tsx`).
  'home.block.unknown': 'Nicht gezeichnet: Diese App hat kein Modul namens <name>{module}</name>.',
  'home.block.empty': 'Zeichnet hier nichts.',
};
