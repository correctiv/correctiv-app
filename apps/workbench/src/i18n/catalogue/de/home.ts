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

  // The editing surface (`preview/home/HomeDocument.tsx`). `{block}` and
  // `{standsIn}` arrive as English prose, out of `preview/home/document.ts` and
  // out of `content/sources.manifest.ts`, so these read German around an English
  // fragment until those tables are descriptors too.
  'home.document.rule': 'Ein Moment trägt nur das, was sich an ihm ändert.',
  'home.document.follow': 'Den Rahmen zu dem Block scrollen, über dem der Zeiger steht',
  'home.document.revert': 'Zurück zur Datei',
  'home.document.save': 'Ins Repository speichern',
  'home.document.copy': 'Das Dokument kopieren',
  'home.document.changed': 'geändert',
  'home.document.unchanged': 'unverändert',
  'home.document.saveNote':
    'Speichern schreibt <code>packages/app-core/src/data/home.layout.json</code> über den Entwicklungsserver, der alles zurückweist, was der Core nicht lesen kann. Der nächste Schritt ist ein Pull Request statt eines Schreibvorgangs, so wie es der Quellen-Job bereits tut (ADR 0036 §15).',
  'home.document.copyNote':
    'Dies ist die veröffentlichte Website, es gibt also keinen Server zum Schreiben und nichts von hier erreicht das Repository. Kopieren Sie das Dokument und legen Sie es in <code>packages/app-core/src/data/home.layout.json</code>, oder öffnen Sie <code>/preview</code> auf einem Entwicklungsserver, wo Speichern angeboten wird.',
  'home.document.copied': 'Kopiert.',
  'home.document.refused': 'abgelehnt',

  // The head of the editor: which point is in effect, and what can be done to it.
  'home.point.midnight': 'Mitternacht',
  'home.point.start': 'Der Beginn des Tages',
  'home.point.startLead':
    'Das Dokument, wie es steht, gültig von Mitternacht bis {until}. Jeder Moment erbt davon.',
  'home.point.time': 'Die Uhrzeit dieses Moments',
  'home.point.span':
    'bis {until} · {changes, plural, =0 {hier ändert sich noch nichts} one {# Änderung hier} other {# Änderungen hier}}',
  'home.point.remove': 'Den Moment um {time} entfernen',
  'home.point.noMoments':
    'Dieses Dokument hat keine Momente, die Startseite sieht also zu jeder Stunde gleich aus.',

  // One block's row, and its four controls.
  'home.row.off': 'aus',
  'home.row.changed': 'geändert',
  'home.row.switchOnAtStart': '{block} ab dem Beginn des Tages einschalten',
  'home.row.switchOnAt': '{block} um {time} einschalten',
  'home.row.switchOffAtStart': '{block} ab dem Beginn des Tages ausschalten',
  'home.row.switchOffAt': '{block} um {time} ausschalten',
  'home.row.moveUp': '{block} nach oben schieben',
  'home.row.moveDown': '{block} nach unten schieben',
  'home.row.remove': '{block} aus dem Tag entfernen',
  'home.row.offAtStart': 'Zu Beginn des Tages nicht auf dem Bildschirm.',
  'home.row.offAt': 'Um {time} nicht auf dem Bildschirm.',

  // A value this moment sets, and the one setting that reads from the inventory.
  'home.setHere': 'hier gesetzt',
  'home.setting.noPin': 'Die neueste Recherche (kein Artikel gesetzt)',
  'home.setting.sampleBadge': 'Beispieldaten',
  'home.setting.sample':
    'Das ist <code>packages/app-core/src/data/home-pins.ts</code>, stellvertretend für {standsIn}. Echte Artikel, eine feste Liste, nicht die von heute.',

  // What a save says back (`preview/home/write.ts`). `{said}` is the dev server's
  // own sentence and `{codes}` is the core's vocabulary; neither is translated, so
  // the wrapper has to read around both.
  'home.save.written': 'Geschrieben nach {path}.',
  'home.save.repository': 'das Repository',
  'home.save.refusedWith': '{said} ({codes})',
  'home.save.http': 'HTTP {status}',
};
