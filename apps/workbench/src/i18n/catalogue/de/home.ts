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
  'home.module.header.what': 'Der Titel des Bildschirms, und was Sie daneben einschalten.',
  'home.module.feedStatus': 'Lade- und Offline-Hinweis',
  'home.module.feedStatus.what':
    'Erscheint nur, solange Inhalte laden oder wenn die App ihre mitgelieferten Inhalte zeigt.',
  'home.module.articleHero': 'Aufmacher',
  'home.module.articleHero.what': 'Die neueste Recherche, über die volle Breite.',
  'home.module.spotlight': 'Spotlight-Briefing',
  'home.module.spotlight.what': 'Die aktuelle Ausgabe, mit einem Link ins Archiv.',
  'home.module.earlyAccess': 'Früher lesen',
  'home.module.earlyAccess.what': 'Was Mitglieder vor allen anderen sehen.',
  'home.module.latest': 'Neueste Recherchen',
  'home.module.latest.what': 'Die Recherchen unter dem Aufmacher, als Liste.',
  'home.module.faktencheck': 'Faktenchecks',
  'home.module.faktencheck.what': 'Die neuesten Faktenchecks, als Reihe, die seitlich scrollt.',
  'home.module.callout': 'Mitmach-Aufruf',
  'home.module.callout.what':
    'Der offene Aufruf. Er hat zwei Plätze: Mittags rückt er über den Aufmacher.',
  'home.module.mediathek': 'Mediathek',
  'home.module.mediathek.what': 'Video und Audio, als Reihe.',
  'home.module.backstage': 'Backstage',
  'home.module.backstage.what': 'Das Redaktionstagebuch, mit einem Link dorthin.',
  'home.module.impact': 'Impact',
  'home.module.impact.what': 'Was die Recherchen verändert haben, und ein Dankeschön.',
  'home.module.searchEntry': 'Sucheinstieg',
  'home.module.searchEntry.what': 'Das Feld, das die Suche öffnet.',
  'home.module.topicRail': 'Themenleiste',
  'home.module.topicRail.what': 'Die Themen mit eigenem Feed, als Reihe von Chips.',
  'home.module.projectDirectory': 'Projektverzeichnis',
  'home.module.projectDirectory.what': 'Die Projekte und Produkte von CORRECTIV, nach Gruppen.',
  'home.module.liveRadioBanner': 'Live-Radio',
  'home.module.liveRadioBanner.what': 'Das Salon5-Radio mit dem, was gerade läuft.',
  'home.module.podcastRail': 'Podcast-Reihe',
  'home.module.podcastRail.what': 'Die Salon5-Podcasts, als Reihe von Kacheln.',
  'home.module.gespraechRail': 'Gesprächs-Videos',
  'home.module.gespraechRail.what': 'Die neuesten Videos des Kanals CORRECTIV im Gespräch.',
  'home.module.funfactsRail': 'FunFacts-Videos',
  'home.module.funfactsRail.what': 'Die neuesten FunFacts-Videos.',
  'home.module.bonusAudioList': 'Backstage-Audio',
  'home.module.bonusAudioList.what': 'Die Bonus-Tonspuren des Clubs, als Liste.',
  'home.module.calloutList': 'Aufrufe',
  'home.module.calloutList.what': 'Alle offenen Aufrufe, als Karten.',
  'home.module.faktenforumCard': 'Faktenforum-Karte',
  'home.module.faktenforumCard.what': 'Die Karte zu den gemeinsam geprüften Behauptungen.',
  'home.module.atlasCard': 'Abriss-Atlas-Karte',
  'home.module.atlasCard.what': 'Die Karte zum Abriss-Atlas.',
  'home.module.tipCard': 'Tipp-Karte',
  'home.module.tipCard.what': 'Die WhatsApp-Tippleitung der Faktencheck-Redaktion.',
  'home.module.screenLink': 'Link zu einem Bildschirm',
  'home.module.screenLink.what':
    'Eine Zeile, die einen anderen Bildschirm öffnet, benannt nach dessen eigener Tab-Bezeichnung.',
  'home.module.communityNote': 'Community-Hinweis',
  'home.module.communityNote.what': 'Ein kurzer Hinweis auf den Community-Bereich.',
  'home.module.profileClubCard': 'Profilkarte',
  'home.module.profileClubCard.what': 'Die Mitgliedskarte mit Name und Stufe.',
  'home.module.profileMembership': 'Mitgliedschaft',
  'home.module.profileMembership.what': 'Stufe, Zugang, Laufzeit und der Link zum Konto.',
  'home.module.profileImpact': 'Ihre Wirkung',
  'home.module.profileImpact.what': 'Was der Beitrag möglich gemacht hat, mit Recherchen.',
  'home.module.profileArea': 'Ihr Bereich',
  'home.module.profileArea.what':
    'Bericht, Backstage, Gespeichertes und die Einstellungen, als Liste.',
  'home.module.profileNewsletter': 'Newsletter',
  'home.module.profileNewsletter.what': 'Die Newsletter zum Ein- und Ausschalten.',
  'home.module.unknown.what': 'Für diesen Block gibt es noch keine Beschreibung.',

  // --- the settings under a block ------------------------------------------------
  'home.setting.screenHeader.mark': 'Wortmarke statt Titel zeigen',
  'home.setting.screenHeader.mark.what':
    'Die Wortmarke CORRECTIV mit einer Linie darunter, wie auf dem Home-Bildschirm.',
  'home.setting.screenHeader.intro': 'Der Satz unter dem Titel',
  'home.setting.screenHeader.intro.what':
    'Eine Zeile dazu, wofür der Bildschirm da ist. Leer lässt sie weg.',
  'home.setting.screenHeader.date': 'Das heutige Datum zeigen',
  'home.setting.screenHeader.date.what':
    'Neben der Wortmarke, damit der Bildschirm sich wie die Ausgabe von heute liest.',
  'home.setting.screenHeader.search': 'Die Suche anbieten',
  'home.setting.screenHeader.search.what':
    'Das Feld unter der Kopfzeile, das den Suchbildschirm öffnet.',
  'home.setting.screenLink.screen': 'Welchen Bildschirm er öffnet',
  'home.setting.screenLink.screen.what':
    'Die Kennung eines selbst angelegten Bildschirms. Ein Link auf einen Bildschirm, den das Dokument nicht enthält, wird weggelassen.',
  'home.setting.articleHero.pin': 'Welcher Artikel führt',
  'home.setting.articleHero.pin.what':
    'Der angeheftete, oder die neueste Recherche, wenn keiner angeheftet ist.',
  'home.setting.articleHero.category': 'Aus welcher Kategorie der Aufmacher kommt',
  'home.setting.articleHero.category.what':
    'Die Regel, die den Aufmacher wählt, solange nichts angeheftet ist.',
  'home.setting.latestResearch.category': 'Aus welcher Kategorie die Recherchen kommen',
  'home.setting.latestResearch.category.what':
    'Begrenzt die Liste unter dem Aufmacher auf eine Kategorie.',
  'home.setting.latestResearch.tag': 'Welches Schlagwort die Recherchen tragen',
  'home.setting.latestResearch.tag.what':
    'Begrenzt die Liste unter dem Aufmacher auf ein Schlagwort.',
  'home.setting.faktencheckRail.category': 'Aus welcher Kategorie die Faktenchecks kommen',
  'home.setting.faktencheckRail.category.what':
    'Die Kategorie, die die Reihe liest; Faktenchecks, solange nichts geändert wird.',
  'home.setting.latestResearch.count': 'Wie viele Recherchen',
  'home.setting.latestResearch.count.what': 'Die Liste unter dem Aufmacher.',
  'home.setting.faktencheckRail.count': 'Wie viele Faktenchecks',
  'home.setting.faktencheckRail.count.what': 'Die Reihe, die seitlich scrollt.',
  'home.setting.unknown.what': 'Keine Beschreibung dafür.',

  // --- a word, which is the fifth kind of setting -------------------------------
  //
  // The field, the count and the mark on the block card. ADR 0075 §2: Deutsch ist
  // Pflicht, jede andere Sprache darf fehlen, und eine Lücke ist eine Marke und kein
  // Fehler. „{language}“ ist der Eigenname der Sprache in der Sprache der Leserin
  // („Englisch“ hier, „English“ dort), nicht der Name der Sprache als Datenpunkt.
  'home.setting.text.charsLeft':
    '{count, plural, =0 {Keine Zeichen mehr} one {Noch ein Zeichen} other {Noch # Zeichen}}',
  'home.setting.text.missing': '{language} fehlt',
  'home.setting.text.aboutLanguage':
    'Dieses Feld schreibt die Sprache, in der diese Workbench gerade läuft. Deutsch ist Pflicht, jede andere Sprache darf fehlen. Eine fehlende Übersetzung ist eine Marke und kein Fehler.',
  'home.setting.text.bound': 'Höchstens {count} Zeichen.',
  'home.setting.text.boundMultiline':
    'Höchstens {count} Zeichen. Der Text darf über mehrere Zeilen laufen.',

  // --- where an insertion mark puts a block -------------------------------------
  //
  // Dropped into the middle of a sentence, so lower case and no full stop. The
  // brackets in `home.block.name` stay: the id inside them is an identifier, and the
  // two halves have to stay tellable apart when a screen reader reads them out.
  'home.block.name': '{name} ({id})',
  'home.where.top': 'ganz nach oben',
  'home.where.end': 'ganz nach unten',
  'home.where.between': 'zwischen {before} und {after}',

  // The day under the frame (`preview/home/Timeline.tsx`).
  'home.timeline.heading': 'Der Tag',
  'home.timeline.time': 'Die Uhrzeit, die der Rahmen zeigt',
  'home.timeline.live': 'Live',
  'home.timeline.addPoint': 'Zu dieser Minute einen Moment anlegen',
  'home.timeline.addPointShort': 'Moment',
  'home.timeline.momentDrag': 'Der Moment um {time}, zum Verschieben ziehen',
  'home.timeline.momentGo': 'Zum Moment um {time} springen',
  'home.timeline.date': '{date}',
  'home.timeline.dayBefore': 'Der Tag davor',
  'home.timeline.dayAfter': 'Der Tag danach',
  'home.timeline.zoom': 'Zeitraum',
  'home.timeline.zoomHelp':
    'Woche und Monat zeigen jede Ausgabe als Balken. Klicken Sie auf einen Tag, um ihn im Rahmen zu sehen, und auf einen Balken, um seine Ausgabe zu bearbeiten. Ist das „Bildschirm-Layout“ offen, legt Ziehen über mehrere Tage eine Ausgabe für diese Tage an. Mit der Tastatur: Die Pfeiltasten wählen einen Tag, Umschalt und Pfeiltaste erweitern die Auswahl, die Eingabetaste legt die Ausgabe an.',
  'home.timeline.zoomDay': 'Tag',
  'home.timeline.zoomWeek': 'Woche',
  'home.timeline.zoomMonth': 'Monat',
  'home.timeline.zoomDayShort': 'T',
  'home.timeline.zoomWeekShort': 'W',
  'home.timeline.zoomMonthShort': 'M',
  'home.timeline.weekBefore': 'Die Woche davor',
  'home.timeline.weekAfter': 'Die Woche danach',
  'home.timeline.monthBefore': 'Der Monat davor',
  'home.timeline.monthAfter': 'Der Monat danach',
  'home.timeline.week': 'KW {week}',
  'home.timeline.month': '{month}',

  // The week and the month under the frame (`preview/home/Calendar.tsx`).
  'home.calendar.today': '{day}, heute',
  'home.calendar.chosen': '{from} bis {to} ausgewählt',
  'home.calendar.refused':
    'Diese Tage sind schon ganz von Ausgaben belegt, die Vorrang haben. Bearbeiten Sie stattdessen eine davon.',

  // The palette, and the hairline that opens it (`preview/home/Palette.tsx`).
  // `{where}`, `{name}` and `{what}` come out of `preview/home/document.ts` and are
  // German too since that table became descriptors, so these read German through.
  'home.palette.addHere': 'Einen Block hinzufügen: {where}',
  'home.palette.title': 'Einen Block hinzufügen',
  'home.palette.lead': 'Der neue Block kommt {where}.',
  'home.palette.leadMore':
    'Das Regal bietet jeden Block der App an, nach Familien sortiert und so gezeichnet, wie er erscheint. Jeder Block kann auf jedem Bildschirm stehen, die Kopfzeile eingeschlossen: Sie druckt den Titel des Bildschirms, auf dem sie steht. Wie es aussieht, sehen Sie im Rahmen daneben.',
  'home.palette.addModule': '{name} hinzufügen. {what}',
  'home.palette.tab.all': 'Alle',
  'home.palette.tab.legend': 'In welcher Familie von Blöcken Sie suchen',
  'home.palette.search.legend': 'Nach Name und Beschreibung suchen',
  'home.palette.search': 'Name oder Beschreibung',
  'home.palette.found': '{found} von {total} Blöcken passen.',
  'home.palette.none': 'Kein Block passt zu „{query}“.',

  // The headings the palette groups the blocks under (ADR 0073 §2) are NO LONGER here:
  // the component gallery groups by the same families and is the app's own page, so the
  // words live in the app beside the blocks, in
  // `apps/mobile/src/lib/home/category-labels.ts`, and their German with every other
  // `home.*` string in `packages/catalogue/src/de/home.ts`.

  // What a block says instead of a drawing (`preview/home/HomeBlock.tsx`). Since ADR 0053
  // §1 the list shows no names, so the second of these carries the block's own name.
  'home.block.unknown': 'Nicht angezeigt: Die App hat keinen Block namens <name>{module}</name>.',
  'home.block.empty': '{block} zeigt hier nichts an.',

  // The editing surface (`preview/home/HomeDocument.tsx`). `{block}` comes out of
  // `preview/home/document.ts` and is German. The inventory's own English, which ADR
  // 0052 §4 leaves as written, is no longer spliced into a sentence here: it is quoted on
  // its own behind the ⓘ beside „Beispieldaten“, under `home.setting.sampleQuote`.
  'home.document.rule':
    'Ein Moment enthält nur, was sich zu dieser Uhrzeit ändert. Alles andere bleibt wie vorher.',
  'home.document.follow': 'Den Rahmen zu dem Block scrollen, auf den Sie zeigen',
  'home.document.screen': 'Bildschirm',
  'home.document.screenLocked':
    'Ein Szenario ist ein Dokument der Startseite, deshalb bleibt der Bildschirm auf Home, solange eines offen ist.',
  'home.screen.home': 'Home',
  'home.issue.headingScreen': 'Änderungen am Bildschirm {screen}',
  'home.issue.headingDelete': 'Bildschirm {screen} löschen',
  'home.custom.more': 'Eigene Bildschirme',
  'home.custom.new': 'Neuer Bildschirm',
  'home.custom.idLabel': 'Kennung, z. B. sommer-kampagne',
  'home.custom.titleLabel': 'Titel auf Deutsch',
  'home.custom.create': 'Bildschirm anlegen',
  'home.custom.cancel': 'Abbrechen',
  'home.custom.address': 'Die App öffnet ihn unter {path}.',
  'home.custom.fault.empty': 'Geben Sie eine Kennung ein.',
  'home.custom.fault.tooLong': 'Höchstens {max} Zeichen.',
  'home.custom.fault.malformed':
    'Nur Kleinbuchstaben, Ziffern und einzelne Bindestriche dazwischen.',
  'home.custom.fault.declared': 'Die App hat schon einen Bildschirm mit diesem Namen.',
  'home.custom.fault.reserved': 'Dieser Name ist für die Tab-Leiste reserviert.',
  'home.custom.fault.taken': 'Es gibt schon einen Bildschirm mit dieser Kennung.',
  'home.custom.fault.titleMissing': 'Geben Sie dem Bildschirm einen deutschen Titel.',
  'home.custom.title': 'Titel',
  'home.custom.preview': '{path} im Rahmen zeigen',
  'home.custom.delete': 'Diesen Bildschirm löschen',
  'home.custom.deleteSubmit': 'Diesen Bildschirm löschen und die Löschung einreichen',
  'home.issue.leadLayout':
    'Diese Änderung an einem Bildschirm kommt aus der Workbench. Klicken Sie unten auf „Create“. Danach entsteht automatisch ein Pull Request, auf den dieses Issue verweist. Bitte lassen Sie den Block darunter unverändert.',
  'home.document.scenarioGuard': 'Szenarien sind Beispiele. Sie werden nicht eingereicht.',
  'home.document.submitCopied':
    'Die Änderung liegt in der Zwischenablage. Fügen Sie sie auf GitHub in das Issue ein.',
  'home.document.submitNoClipboard':
    'Der Browser hat den Zugriff auf die Zwischenablage nicht erlaubt. Kopieren Sie die Änderung aus diesem Feld und fügen Sie sie auf GitHub in das Issue ein.',
  'home.document.field': 'Die Änderung',
  'home.document.refused': 'abgelehnt',

  // Der geteilte Entwurf: ein Link, der ihn trägt, und woher das Dokument kam (ADR 0076).
  'home.document.shareCopied':
    'Der Link liegt in der Zwischenablage. Öffnen Sie ihn selbst, um zu sehen, was die Person sehen wird, der Sie ihn schicken.',
  'home.document.shareNoClipboard':
    'Der Browser hat den Zugriff auf die Zwischenablage nicht erlaubt. Kopieren Sie den Link aus diesem Feld.',
  'home.document.shareTooLong':
    'Zu lang als Link: {link} Zeichen statt {limit}. Reichen Sie ihn ein.',
  'home.document.shareField': 'Der Link',
  'home.document.nearLimit':
    'Die veröffentlichten Bildschirme sind bei {share} dessen, was die App liest: {length} von {limit} Zeichen. Darüber ignoriert die App das Dokument und zeigt das mitgelieferte.',
  'home.document.overLimit':
    'Die veröffentlichten Bildschirme sind über dem, was die App liest: {length} von {limit} Zeichen. Die App ignoriert das Dokument und zeigt das mitgelieferte.',
  'home.document.sharedHeld':
    'Dieser Entwurf ist über einen Link gekommen. Er ist auf diesem Rechner nicht gespeichert: Reichen Sie ihn ein, oder laden Sie neu, um Ihr eigenes Dokument zurückzubekommen.',
  'home.document.sharedDamaged':
    'Dieser Link enthält keinen Entwurf, den dieses Werkzeug öffnen kann, deshalb wurde er weggelassen. Das Werkzeug ist unverändert.',

  // The head of the editor: which point is in effect, and what can be done to it.
  'home.point.midnight': 'Mitternacht',
  'home.point.start': 'Der Beginn des Tages',
  'home.point.startLead': 'von Mitternacht bis {until}',
  'home.point.startUntil': 'bis {until}',
  'home.point.time': 'Die Uhrzeit dieses Moments',
  'home.point.span':
    'bis {until} · {changes, plural, =0 {hier ändert sich noch nichts} one {# Änderung hier} other {# Änderungen hier}}',
  'home.point.open':
    'Der bearbeitete Punkt: {point}. Seine Uhrzeit, seine Regel und das, was damit geht, einblenden.',
  'home.point.close':
    'Der bearbeitete Punkt: {point}. Seine Uhrzeit, seine Regel und das, was damit geht, ausblenden.',
  'home.point.remove': 'Den Moment um {time} entfernen',
  'home.point.noMoments':
    'Dieser Tag hat keine Momente. Die Startseite sieht den ganzen Tag gleich aus.',

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
  'home.setting.noPin': 'Die neueste Recherche (nichts angeheftet)',
  'home.setting.sampleBadge': 'Beispieldaten',
  'home.setting.pinLive': 'Live',
  'home.setting.pinSample': 'Beispiel',
  'home.setting.pinSearch': 'Artikel auf correctiv.org suchen',
  'home.setting.searching': 'Suche läuft …',
  'home.setting.searchHits':
    '{count, plural, =0 {Keine Artikel gefunden.} one {# Artikel gefunden.} other {# Artikel gefunden.}}',
  'home.setting.termNone': 'Alle (kein Filter)',
  'home.setting.termDefault': 'Die eigene Kategorie des Blocks',
  'home.setting.termOption': '{name} ({count})',
  'home.setting.screenId': 'Kennung des Bildschirms, z. B. sommer-aktion',
  'home.setting.screenId.invalid':
    'Keine gültige Kennung: Kleinbuchstaben, Ziffern und einzelne Bindestriche, höchstens 40 Zeichen, und keiner der eingebauten Bildschirme. Gespeichert wird erst, wenn sie gültig ist.',
  'home.setting.termSearch': 'Schlagwörter suchen',
  'home.setting.sample':
    'Eine feste Auswahl echter Artikel, stellvertretend für das, was WordPress später liefert.',
  'home.setting.sampleQuote': 'In der Statusübersicht der Quellen:',

  // What a save says back (`preview/home/write.ts`). `{said}` is the dev server's
  // own sentence and `{codes}` is the core's vocabulary; neither is translated, so
  // the wrapper has to read around both.
  'home.save.written': 'Geschrieben nach {path}.',
  'home.save.repository': 'das Repository',
  'home.save.refusedWith': '{said} ({codes})',
  'home.save.http': 'HTTP {status}',

  // The issue Submit changes opens (`preview/home/write.ts`). „Create“ is GitHub's own
  // button, which GitHub labels in English, so it is quoted as it reads there.
  'home.issue.heading': 'Änderungen an der Startseite',
  'home.issue.lead':
    'Diese Änderung an der Startseite kommt aus der Workbench. Klicken Sie unten auf „Create“. Danach entsteht automatisch ein Pull Request, und dieses Issue verlinkt ihn. Bitte lassen Sie den Block darunter, wie er ist.',
  'home.issue.help':
    'Die Änderung war zu lang für den Link. Sie liegt deshalb in Ihrer Zwischenablage. Löschen Sie diesen Text, fügen Sie die Änderung hier ein (Strg+V, auf dem Mac Cmd+V) und klicken Sie auf „Create“.',
};
