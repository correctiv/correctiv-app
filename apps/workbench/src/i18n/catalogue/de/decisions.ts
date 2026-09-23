/**
 * German for the `decisions.*` ids: the board of every architecture decision
 * record, at `/decisions`.
 *
 * **What is NOT here is every record.** A record's title, the sentence the index
 * writes about it, its caveats, the claims struck inside it and the clause under
 * each of those are the ADRs' own words, read in at build time through
 * `virtual:docs`, and they stay English because the repository wrote them
 * ([ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * So a German reader gets a German board over English records, and that seam is
 * the decision rather than a translation somebody stopped halfway through.
 *
 * **The vocabulary, because it has to be the same word every time.** A record is
 * a „Protokoll“, a claim inside one an „Aussage“, the mark through it a
 * „Streichung“, and the sentence added beside it a „Zusatz“. Those four carry the
 * whole page: the standing chips, the column heads, the note under the lede and
 * the detail all name the same four things, and a reader who met two words for one
 * of them would read the board as two mechanisms.
 *
 * `ADR` and `adr/` are left as they are. The first is what this repository calls
 * these documents out loud and the second is a directory in it.
 *
 * `decisions.reason.withdrawn` and `decisions.reason.struck` are read aloud and
 * never drawn, and each names its subject rather than saying „es“: the English
 * says "it" in both, where the first means the record and the second the claim,
 * and a screen reader gives a listener no sentence around it to tell them apart.
 */
export const decisions: Record<string, string> = {
  'decisions.eyebrow': 'CORRECTIV Community-App · interne Dokumentation',
  'decisions.title': 'Entscheidungsprotokolle',
  'decisions.lede':
    'Die Entscheidungen, die dieses Repository begründet statt vorausgesetzt hat, und welche davon noch gelten. Ein Protokoll sagt das <em>Warum</em>. <architecture>Die Architektur</architecture> sagt, was die Sache ist.',

  'decisions.rule.label': 'Wie eine überholte Aussage markiert wird',
  'decisions.rule.never':
    '<strong>Ein Protokoll wird nie umgeschrieben, damit es im Nachhinein richtig aussieht.</strong> Macht eine spätere Entscheidung eine Aussage <em>falsch</em>, wird sie an ihrer Stelle durchgestrichen. Ein kurzer Grund sagt, was sie ungültig gemacht hat, mit einem Link auf das Protokoll, das es getan hat. Die Argumentation darum herum bleibt, wie sie war, denn die Begründung ist das, was sich zu behalten lohnt.',
  'decisions.rule.struck':
    'In diesen <f>{records}</f> Protokollen {struck, plural, one {ist <f>#</f> Aussage} other {sind <f>#</f> Aussagen}} gestrichen, und ein Protokoll mit gestrichener Aussage gilt weiter. Das ist die Regel bei der Arbeit, kein Fehler. Diese Übersicht macht es sichtbar. In den Dokumenten selbst müssten Sie dafür alle {records} öffnen.',
  'decisions.rule.unattributed':
    '{count, plural, one {<f>#</f> dieser Streichungen nennt kein späteres Protokoll. Gestrichen hat sie eine neue Messung oder ein späterer Abschnitt desselben Protokolls. Es gibt also keinen Pfeil, und ihr Grund ist alles, was sich dazu sagen lässt.} other {<f>#</f> dieser Streichungen nennen kein späteres Protokoll. Gestrichen haben sie eine neue Messung oder ein späterer Abschnitt desselben Protokolls. Es gibt also keinen Pfeil, und ihr Grund ist alles, was sich dazu sagen lässt.}} Diesen Grund zeigt eine Zeile unter ihrem Titel, auf einen Satz gekürzt. Die Detailansicht unten zeigt alle vollständig.',
  'decisions.rule.clauseless':
    '{count, plural, one {<f>#</f> davon hat keinen Grund dabei. Der Grund stand im Absatz nach der Streichung, oder eine zweite Streichung daneben hat ihn übernommen. Beides kann die Übersicht nicht automatisch zuordnen. Diese Zeile sagt das, und das Protokoll selbst hat die Antwort.} other {<f>#</f> davon haben keinen Grund dabei. Der Grund stand im Absatz nach der Streichung, oder eine zweite Streichung daneben hat ihn übernommen. Beides kann die Übersicht nicht automatisch zuordnen. Diese Zeilen sagen das, und das Protokoll selbst hat die Antwort.}}',

  'decisions.show.legend': 'Welche Protokolle anzeigen',
  'decisions.show.title': 'Anzeigen',
  'decisions.tile.all': 'Alle Protokolle',
  'decisions.tile.all.note':
    'Geschrieben zwischen <f>{from}</f> und <f>{to}</f>, in der Reihenfolge ihrer Entstehung.',

  'decisions.standing.stands': 'Gilt',
  'decisions.standing.stands.meaning': 'Nichts darin ist seit dem Schreiben falsch geworden.',
  'decisions.standing.partly': 'Teilweise gestrichen',
  'decisions.standing.partly.meaning':
    'Die Entscheidung gilt. Aussagen darin nicht, und sie sind an Ort und Stelle durchgestrichen statt umgeschrieben.',
  'decisions.standing.withdrawn': 'Gilt nicht mehr',
  'decisions.standing.withdrawn.meaning':
    'Die Statuszeile selbst ist durchgestrichen. Lesen Sie das Protokoll als Geschichte.',

  'decisions.reason.withdrawn': 'Warum das Protokoll nicht mehr gilt:',
  'decisions.reason.struck': 'Warum die Aussage gestrichen wurde:',

  'decisions.recordName': ', ADR {number}, {title}',

  'decisions.careful.title': 'Diese mit Vorsicht lesen',
  'decisions.careful.lede':
    '{careful, plural, one {<f>#</f> Protokoll, bei dem Protokoll und Repository nicht dieselbe Geschichte erzählen} other {<f>#</f> Protokolle, bei denen Protokoll und Repository nicht dieselbe Geschichte erzählen}}: {withdrawn, plural, one {eines, dessen eigene Statuszeile durchgestrichen ist} other {#, deren eigene Statuszeilen durchgestrichen sind}}, und {rest, plural, one {eines, das etwas entschieden hat} other {#, die etwas entschieden haben}}, was laut Index nicht gebaut oder nicht auf jeder Plattform geprüft ist. Alles andere auf dieser Übersicht wurde umgesetzt.',
  'decisions.careful.row': 'Zeile',
  'decisions.careful.read': 'Das Protokoll lesen',

  'decisions.board.title': 'Die Übersicht',
  'decisions.board.lede':
    'Eine Zeile je Protokoll, die ältesten zuerst. Hat ein Protokoll gestrichene Aussagen, steht der Grund unter seinem Titel, auf einen Satz gekürzt. Klappen Sie eine Zeile auf, sehen Sie den Satz aus dem Index, jede gestrichene Aussage mit ihrem vollen Grund und welche Protokolle darin gestrichen haben oder von ihm gestrichen wurden. In der Detailansicht ist nichts gekürzt. Die Kacheln oben filtern auch diese Liste.',
  'decisions.filter': 'Protokolle filtern',
  'decisions.filter.placeholder': 'Nummer, Titel oder eine Aussage',
  'decisions.only': 'Nur, was nicht gebaut oder nicht geprüft ist',
  'decisions.expandAll': 'Alle aufklappen',
  'decisions.collapseAll': 'Alle zuklappen',
  'decisions.showing':
    '{shown} von {total, plural, one {# Protokoll} other {# Protokollen}} angezeigt',
  'decisions.caption':
    'Jedes Architekturentscheidungsprotokoll in <code>adr/</code>, mit dem, was seither darin gestrichen wurde.',

  'decisions.column.standing': 'Stand',
  'decisions.column.record': 'Protokoll',
  'decisions.column.decision': 'Entscheidung',
  'decisions.column.struck': 'Gestrichene Aussagen',
  'decisions.details': 'Details',
  'decisions.hide': 'Ausblenden',

  'decisions.struck.none': 'keine',
  'decisions.struck.count':
    '{count, plural, one {<n>#</n><w>Aussage</w>} other {<n>#</n><w>Aussagen</w>}}',
  'decisions.struck.by': 'durch',
  'decisions.struck.finding': 'einem späteren Befund',

  'decisions.detail.index': 'Der Index sagt:',
  'decisions.detail.struck':
    '{count, plural, one {Eine Aussage ist gestrichen:} other {# Aussagen sind gestrichen:}}',
  'decisions.detail.noClause':
    'Zu dieser Streichung steht kein Grund dabei. Das Protokoll erklärt sie im Text darum herum.',
  'decisions.detail.voids':
    '{count, plural, one {Es hat eine Aussage gestrichen in} other {Es hat Aussagen gestrichen in}}',
  'decisions.detail.read': 'ADR {number} lesen',

  'decisions.footer.label': 'Woher diese Übersicht kommt',
  'decisions.footer.build':
    'Jede Zeile, jede Zahl und jede Verbindung oben wird beim Build aus den Protokollen selbst gelesen. Die Workbench hält keine Kopie, diese Übersicht kann <code>adr/</code> also nicht widersprechen. Kann sie ein Protokoll nicht lesen, wird die Site nicht gebaut.',
  'decisions.footer.notes':
    'Der Index, aus dem diese Sätze stammen, steht vollständig unter <notes>Entscheidungen, die Notizen</notes>. Dort steht auch, was eine Tabelle nicht fassen kann: Hinweise zum Lesen der älteren Protokolle und die Regel von oben in voller Länge.',
};
