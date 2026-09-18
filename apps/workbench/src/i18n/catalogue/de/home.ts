/** German for the `home.*` ids: the home-screen configurator. */
export const home: Record<string, string> = {
  // --- the blocks the configurator offers, and what each one draws --------------
  //
  // The most important German on this site by the argument that started it: ADR 0050
  // §1 names one audience outside development, somebody from the newsroom arranging
  // the home screen, and this palette is what they arrange it with. It was English
  // through five passes because the table used the keys `name` and `what`, neither of
  // which the literal check watched.
  //
  // "Mediathek", "Backstage", "Impact" and "Spotlight" stay as they are, each for
  // the reason on its own descriptor: two are what the app calls those sections and
  // two are the names of a CORRECTIV product and a CORRECTIV newsletter. A
  // translation of one of them would rename the thing rather than translate a label.
  'home.module.header': 'Kopfzeile',
  'home.module.header.what': 'Das Datum, die Begrüßung und der Weg in die Suche.',
  'home.module.feedStatus': 'Lade- und Offline-Hinweis',
  'home.module.feedStatus.what':
    'Erscheint nur, solange die Feeds laden, oder wenn sie aus dem Bundle kamen.',
  'home.module.articleHero': 'Aufmacher',
  'home.module.articleHero.what': 'Die neueste Recherche, über die volle Breite.',
  'home.module.spotlight': 'Spotlight-Briefing',
  'home.module.spotlight.what': 'Die aktuelle Ausgabe, mit dem Weg ins Archiv.',
  'home.module.earlyAccess': 'Früher lesen',
  'home.module.earlyAccess.what': 'Was Mitglieder vor allen anderen sehen.',
  'home.module.latest': 'Neueste Recherchen',
  'home.module.latest.what': 'Die Recherchen unter dem Aufmacher, als Liste.',
  'home.module.faktencheck': 'Faktenchecks',
  'home.module.faktencheck.what': 'Die neuesten Faktenchecks, als Reihe, die seitlich scrollt.',
  'home.module.callout': 'Mitmach-Aufruf',
  'home.module.callout.what':
    'Der offene Aufruf. Zwei Stellen im Dokument, eine davon mittags über den Aufmacher gehoben.',
  'home.module.mediathek': 'Mediathek',
  'home.module.mediathek.what': 'Video und Audio, als Reihe.',
  'home.module.backstage': 'Backstage',
  'home.module.backstage.what': 'Das Redaktionstagebuch und der Weg hinein.',
  'home.module.impact': 'Impact',
  'home.module.impact.what': 'Was die Recherchen verändert haben, und ein Dankeschön.',
  'home.module.unknown.what': 'Dieses Werkzeug hat keine Beschreibung dafür.',

  // --- the three settings under a block -----------------------------------------
  'home.setting.articleHero.pin': 'Welcher Artikel führt',
  'home.setting.articleHero.pin.what':
    'Der angeheftete, oder die neueste Recherche, wenn keiner angeheftet ist.',
  'home.setting.latestResearch.count': 'Wie viele Recherchen',
  'home.setting.latestResearch.count.what': 'Die Liste unter dem Aufmacher.',
  'home.setting.faktencheckRail.count': 'Wie viele Faktenchecks',
  'home.setting.faktencheckRail.count.what': 'Die Reihe, die seitlich scrollt.',
  'home.setting.unknown.what': 'Keine Beschreibung dafür.',

  // --- where an insertion mark puts a block -------------------------------------
  //
  // Dropped into the middle of a sentence, so lower case and no full stop. The
  // brackets in `home.block.name` stay: the id inside them is an identifier, and the
  // two halves have to stay tellable apart when a screen reader reads them out.
  'home.block.name': '{name} ({id})',
  'home.where.top': 'ganz oben im Tag',
  'home.where.end': 'ganz am Ende des Tages',
  'home.where.between': 'zwischen {before} und {after}',

  // The day under the frame (`preview/home/Timeline.tsx`).
  'home.timeline.heading': 'Der Tag',
  'home.timeline.time': 'Die Uhrzeit, die der Rahmen zeigt',
  'home.timeline.live': 'Live',
  'home.timeline.addPoint': 'Aus dieser Minute einen Moment machen',
  'home.timeline.addPointShort': 'Punkt setzen',
  'home.timeline.momentDrag': 'Der Moment um {time}, zum Verschieben ziehen',
  'home.timeline.momentGo': 'Zum Moment um {time} springen',

  // The palette, and the hairline that opens it (`preview/home/Palette.tsx`).
  // `{where}`, `{name}` and `{what}` come out of `preview/home/document.ts` and are
  // German too since that table became descriptors, so these read German through.
  'home.palette.addHere': 'Einen Block hinzufügen: {where}',
  'home.palette.title': 'Einen Block hinzufügen',
  'home.palette.lead':
    'Eingefügt wird: {where}. Angeboten wird jeder Block, der für diesen Bildschirm deklariert ist; beurteilt wird eine Anordnung im Rahmen daneben, nicht in dieser Liste.',
  'home.palette.addModule': '{name} hinzufügen. {what}',

  // What a block says instead of a drawing (`preview/home/HomeBlock.tsx`). Since ADR 0053
  // §1 the list shows no names, so the second of these carries the block's own name.
  'home.block.unknown': 'Nicht gezeichnet: Diese App hat kein Modul namens <name>{module}</name>.',
  'home.block.empty': '{block} zeichnet hier nichts.',

  // The editing surface (`preview/home/HomeDocument.tsx`). `{block}` comes out of
  // `preview/home/document.ts` and is German. `{standsIn}` comes out of
  // `content/sources.manifest.ts`, which ADR 0052 §4 leaves quoted as written, so
  // that one sentence still reads German around an English fragment.
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

  // One block, and the controls that appear over it.
  'home.row.off': 'aus',
  'home.row.changed': 'geändert',
  'home.row.switchOnAtStart': '{block} ab dem Beginn des Tages einschalten',
  'home.row.switchOnAt': '{block} um {time} einschalten',
  'home.row.switchOffAtStart': '{block} ab dem Beginn des Tages ausschalten',
  'home.row.switchOffAt': '{block} um {time} ausschalten',
  'home.row.moveUp': '{block} nach oben schieben',
  'home.row.moveDown': '{block} nach unten schieben',
  'home.row.remove': '{block} aus dem Tag entfernen',
  'home.row.details': 'Einstellungen und Angaben zu {block}',
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
