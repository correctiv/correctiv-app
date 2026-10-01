/**
 * German for the `sources.*` ids: the status board of everything the app reads,
 * at `/sources`.
 *
 * **What is NOT here is the ledger the board is built from.** Every row's name,
 * note, endpoint and file, every gap's label and note, and all ten open editorial
 * questions come out of `content/sources.manifest.ts`, which
 * [ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §4
 * keeps in its own spelling: it is this site's ledger of what the app reads, and a
 * ledger is quoted rather than narrated. §4 names the questions as the case against
 * that exception and says what would have to be measured before it moves, so read
 * it before translating a row.
 *
 * **Two English fragments land inside German sentences here.** `{age}` in
 * `sources.measured.when` is worked out in the reader's browser by
 * `src/lib/measured.ts` and comes back in English words, which is why that sentence
 * puts it in brackets, exactly as `settings.build.note` does. `{posts}` and
 * `{newest}` come from `feedFigures()` in the manifest, which answers `every post`,
 * `none` or `unknown` where it has no number. Neither is an oversight: both are
 * written outside this site's own words, and a German sentence that reads around
 * them is the honest shape until they move.
 *
 * **The vocabulary, because the board uses each word in three places.** A row is a
 * „Zeile“, a state a „Zustand“, a finding a „Befund“. The five state names are the
 * chip in a row, the name of the tile that filters for it and the heading of its
 * group in the table, and all three read this catalogue, so one word has to work
 * in all three positions.
 *
 * `sources.column.state` is „Zustand“ while `shell.section.state` stays „State“.
 * They are not the same thing: the first is the condition a source is in, the
 * second is the name of the preview's tool onto the app's Redux store, which the
 * team says in English.
 *
 * `sources.question.chip` is „F“ and not „Q“, for Frage. It is the label on the
 * chip and the number in the circle beside the question itself, both of which read
 * this one id, and `sources.questions.lede` names it „F-Chip“ so the page keeps
 * agreeing with itself.
 *
 * `MVP`, `CORRECTIV`, `CORS`, `RSS` and every path stay as they are.
 */
export const sources: Record<string, string> = {
  'sources.count.everyPost': 'jeden Beitrag',
  'sources.count.none': 'keine Beiträge',
  'sources.count.unknown': 'keine Antwort',
  'sources.newest.none': 'keiner',
  'sources.newest.unknown': 'keine Antwort',

  'sources.state.live': 'Live',
  'sources.state.stale': 'Live, veraltet',
  'sources.state.broken': 'Live, defekt',
  'sources.state.sample': 'Beispiel',
  'sources.state.noSource': 'Keine Quelle',

  'sources.kind.articles': 'Artikel',
  'sources.kind.newsletter': 'Newsletter',
  'sources.kind.search': 'Suche',
  'sources.kind.audio': 'Audio',
  'sources.kind.video': 'Video',
  'sources.kind.community': 'Community',
  'sources.kind.club': 'Club',
  'sources.kind.directory': 'Verzeichnis',

  'sources.group.sampleData': 'Beispieldaten',
  'sources.group.rows': '{count, plural, one {# Zeile} other {# Zeilen}}',
  'sources.group.rowsOf': '{shown} von {total, plural, one {# Zeile} other {# Zeilen}}',
  'sources.group.some.live': '{count} live',
  'sources.group.some.sample': '{count} mit Beispieldaten',
  'sources.group.some.noSource': '{count} ohne Quelle',

  'sources.question.chip': 'F{n}',
  'sources.question.chipName': ', offene Frage {n}',
  'sources.question.link': 'Offene Frage {n}',

  'sources.feed.newest': 'neuester Beitrag: <f>{newest}</f>',
  'sources.feed.run':
    '{category}: Der Lauf vom <f>{measured}</f> fand {posts}, neuester Beitrag <f>{newest}</f>.',
  'sources.feed.unmeasured':
    '<strong>Weder der Feed noch seine Kategorie haben in diesem Lauf geantwortet.</strong> Die Zahlen oben sind also unbekannt, nicht null. Was die fehlgeschlagene Messung gefunden hat, steht in ihrer Zeile in <code>apps/workbench/content/sources.measured.ts</code>.',
  'sources.feed.configured': 'Konfiguriert in <code>{module}</code>.',

  'sources.reads.none': 'nichts, keine Quelle benannt',
  'sources.standsIn': 'Platzhalter für:',
  'sources.measured.used': '{used} von {available} genutzt',
  'sources.measured.reachable': 'erreichbar',
  'sources.measured.silent': 'hat nicht geantwortet',
  'sources.measured.nothing': 'nichts zu messen',

  'sources.flag.unused': 'Ungenutzt, {unused} von {available}',
  'sources.flag.silent': 'Hat nicht geantwortet',
  'sources.flag.invented': 'Erfunden',
  'sources.flag.mvp': 'MVP',
  'sources.flag.notMvp': 'Kein MVP',

  'sources.eyebrow': 'CORRECTIV Community-App · interne Dokumentation',
  'sources.title': 'Statusübersicht der Quellen',
  'sources.lede':
    'Für jede Art von Inhalt in der App: Sind es Livedaten, Beispieldaten als Ersatz für eine API, die es noch nicht gibt, oder eine gewünschte Funktion ohne Quelle?',

  'sources.measured.label': 'Wie diese Zahlen erhoben wurden',
  'sources.measured.when':
    '<strong>Alle Zahlen auf dieser Seite wurden am <f>{measured}</f> gemessen ({age}).</strong>',
  'sources.measured.how':
    'Gemessen hat <code>apps/workbench/scripts/measure-sources.mjs</code> auf {where}. {answered, plural, one {Geantwortet hat # von} other {Geantwortet haben # von}} {probes, plural, one {# Quelle} other {# Quellen}}, bei {seconds} Sekunden Zeitlimit und {attempts, plural, one {# Versuch} other {# Versuchen}} je Quelle. Ihr Browser hat nichts geprüft und kann es auch nicht, denn die RSS-Feeds lassen das nicht zu. Deshalb ist das ein Skript und kein Aktualisieren-Knopf.',
  'sources.measured.stale':
    'Die Zahlen unten sind wahrscheinlich veraltet. Sie sind mehr als {days, plural, one {# Tag} other {# Tage}} alt, die wöchentliche Messung ist also seit einem Quartal nicht gelaufen.',
  'sources.measured.silentSome':
    '<strong>{count, plural, one {Eine Quelle hat} other {# Quellen haben}} nicht geantwortet:</strong> {list}. Das ist ein Befund, kein Fehler. Eine ausgefallene Quelle stoppt hier nie einen Build.',
  'sources.measured.allAnswered':
    'Jede Quelle hat in diesem Lauf geantwortet, keine Zahl unten ist also unbekannt.',
  'sources.measured.noReason': 'kein Grund vermerkt',

  'sources.show.legend': 'Welche Zeilen anzeigen',
  'sources.show.title': 'Anzeigen',
  'sources.tile.all': 'Alle Zeilen',
  'sources.tile.all.note':
    '{rows, plural, one {# Zeile} other {# Zeilen}} zu {entries, plural, one {# Eintrag} other {# Einträgen}} im Manifest. Die Artikel zählen als ihre {feeds, plural, one {# Feed} other {# Feeds}}.',
  'sources.tile.live.note':
    '{ok} wie erwartet, {stale} veraltet, {broken} defekt. Die letzten beiden stehen unten bei den schlechten Nachrichten.',
  'sources.tile.sample.note':
    '{count, plural, one {# Datei} other {# Dateien}} in der Form der künftigen API. Auf dem Bildschirm sehen sie aus wie echte Inhalte.',
  'sources.tile.noSource.note':
    '{count, plural, one {# gewünschte Funktion} other {# gewünschte Funktionen}} ohne Quelle. {mvp} davon sind MVP.',

  'sources.findings.title': 'Zuerst die schlechten Nachrichten',
  'sources.findings.lede':
    'Eine Beispieldatei gibt sich als das zu erkennen, was sie ist. Ein Livefeed, der stillsteht oder ins Leere zeigt, tut das nicht: Die App zeigt ihn als aktuellen Inhalt. {ailing} der {feeds} Artikelfeeds {ailing, plural, one {ist} other {sind}} in diesem Zustand.',
  'sources.findings.figures': '{category}: <f>{posts}</f>, neuester Beitrag <f>{newest}</f>.',
  'sources.findings.rest':
    '{count, plural, one {Der andere Artikelfeed lief} other {Die anderen # Artikelfeeds liefen}} am <f>{measured}</f> wie erwartet. Ein Feed kann aus gutem Grund veraltet sein. Die Notiz auf jeder Karte erklärt das.',
  'sources.row': 'Zeile',

  'sources.gaps.title': 'Angebunden, aber ungenutzt',
  'sources.gaps.lede':
    '{count, plural, one {# Quelle ist} other {# Quellen sind}} live und erreichbar, aber die App nutzt von jeder nur einen Teil. Kaputt ist nichts, und es fehlt auch nichts. Es hat nur noch niemand entschieden, was genutzt wird.',
  'sources.gaps.legend': 'Gefüllte Punkte zeigt die App an.',
  'sources.gap.used': '<big>{used}</big> von <f>{available}</f> genutzt',
  'sources.gap.unknown': 'unbekannt',

  'sources.board.title': 'Die Übersicht',
  'sources.board.lede':
    'Eine Zeile je Quelle, Artikelfeed oder gewünschter Quelle. Klappen Sie eine Zeile auf, um alles dazu zu sehen. Gekürzt ist nichts. Die Kacheln oben filtern auch diese Liste.',
  'sources.filter': 'Zeilen filtern',
  'sources.filter.placeholder': 'Name, Endpunkt, Datei, Frage',
  'sources.groupBy': 'Gruppieren nach',
  'sources.column.state': 'Zustand',
  'sources.groupBy.kind': 'Inhaltsart',
  'sources.column.kind': 'Art',
  'sources.column.source': 'Quelle',
  'sources.column.reads': 'Liest aus',
  'sources.column.measured': 'Gemessen',
  'sources.column.flags': 'Merkmale',
  'sources.only': 'Nur Zeilen mit einem Befund: veraltet, defekt, ungenutzt, erfunden',
  'sources.expandAll': 'Alle aufklappen',
  'sources.collapseAll': 'Alle zuklappen',
  'sources.showing': '{shown} von {total, plural, one {# Zeile} other {# Zeilen}} angezeigt',
  'sources.caption':
    'Jede Inhaltsquelle, die die App liest, ersetzt oder noch braucht. Zahlen vom <f>{measured}</f>.',
  'sources.details': 'Details',
  'sources.hide': 'Ausblenden',
  'sources.rowName': ', {name}',

  'sources.questions.title':
    '{count, plural, one {# offene redaktionelle Frage} other {# offene redaktionelle Fragen}}',
  'sources.questions.lede':
    'Diese Seite soll helfen, diese Fragen zu klären. Jede Frage kommt aus einer Zeile oben, dort markiert mit einem F-Chip.',

  'sources.footer.label': 'Woher diese Übersicht kommt',
  'sources.footer.files':
    'Zwei Dateien, mit Absicht. Jede Zeile, jeder Zustand und jeder Satz oben kommt aus <code>apps/workbench/content/sources.manifest.ts</code>. Sie ist von Hand geschrieben, und ein Test prüft sie gegen den Datenordner des Core. Jede Zahl, jedes Datum und jede Hörerzahl kommt aus <code>apps/workbench/content/sources.measured.ts</code>. Diese Datei wird generiert, bearbeiten Sie sie nicht.',
  'sources.footer.remeasure':
    'Für eine neue Messung führen Sie <code>node apps/workbench/scripts/measure-sources.mjs</code> aus. <code>.github/workflows/sources.yml</code> tut das jede Woche und öffnet einen Pull Request, wenn sich etwas geändert hat. Es berichtet nur und blockiert nie. Eine Quelle, die ausfällt, langsam ist oder umgezogen ist, erscheint auf dieser Seite und in der Zusammenfassung des Laufs, und nichts schlägt fehl.',
};
