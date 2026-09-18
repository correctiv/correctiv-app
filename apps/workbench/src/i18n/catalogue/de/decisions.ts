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
    'Die Entscheidungen, die dieses Repository ausdiskutiert statt vorausgesetzt hat, und welche davon noch gelten. Ein Protokoll sagt das <em>Warum</em>; <architecture>die Architektur</architecture> sagt, was die Sache ist.',

  'decisions.rule.label': 'Wie eine überholte Aussage markiert wird',
  'decisions.rule.never':
    '<strong>Ein Protokoll wird nie umgeschrieben, damit es im Nachhinein richtig aussieht.</strong> Eine Aussage, die eine spätere Entscheidung <em>falsch</em> gemacht hat, wird an Ort und Stelle durchgestrichen, mit einem Zusatz, der sagt, was sie ungültig gemacht hat, und einem Link auf das Protokoll, das es getan hat. Die Argumentation darum herum bleibt unangetastet, denn die Begründung ist der Teil, der es wert ist, behalten zu werden.',
  'decisions.rule.struck':
    'Also sind <f>{struck}</f> {struck, plural, one {Aussage} other {Aussagen}} in diesen <f>{records}</f> Protokollen gestrichen, und ein Protokoll mit einer gestrichenen Aussage gilt weiterhin. Das ist die Disziplin bei der Arbeit und kein Fehler, und genau das soll diese Übersicht sichtbar machen: In den Dokumenten selbst ist es unsichtbar, solange Sie nicht alle {records} öffnen.',
  'decisions.rule.unattributed':
    '{count, plural, one {<f>#</f> dieser Streichungen nennt in ihrem Zusatz kein späteres Protokoll. Sie entstand durch eine erneute Messung oder durch einen späteren Abschnitt desselben Protokolls, hat also keinen Pfeil zu zeichnen, und ihr Zusatz ist das Einzige, was sich über sie sagen lässt.} other {<f>#</f> dieser Streichungen nennen in ihrem Zusatz kein späteres Protokoll. Sie entstanden durch eine erneute Messung oder durch einen späteren Abschnitt desselben Protokolls, haben also keinen Pfeil zu zeichnen, und ihr Zusatz ist das Einzige, was sich über sie sagen lässt.}} Genau das sagt eine Zeile unter ihrem Titel: ein Zusatz, auf einen Satz gekürzt. Die Detailansicht unten hat sie alle, vollständig.',
  'decisions.rule.clauseless':
    '{count, plural, one {<f>#</f> davon trägt überhaupt keinen Zusatz. Die Begründung stand im Absatz nach der Streichung, oder eine zweite Streichung daneben hat sie für sich beansprucht, und beides lässt sich beim Lesen des Protokolls nicht zurückgewinnen. Diese Zeile sagt das an Ort und Stelle, und das Protokoll selbst hat die Antwort.} other {<f>#</f> davon tragen überhaupt keinen Zusatz. Die Begründung stand im Absatz nach der Streichung, oder eine zweite Streichung daneben hat sie für sich beansprucht, und beides lässt sich beim Lesen des Protokolls nicht zurückgewinnen. Diese Zeilen sagen das an Ort und Stelle, und das Protokoll selbst hat die Antwort.}}',

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
    'Eine Zeile pro Protokoll, die ältesten zuerst. Eine Zeile mit einer Streichung sagt unter ihrem Titel, warum: den Zusatz der neuesten, auf einen Satz gekürzt, und hinter dem Text, den sie gestrichen hat, wo er sich nur daran gelesen erschließt. Eine Zeile klappt auf zum Satz des Index über sie, zu jeder darin gestrichenen Aussage samt dem vollständigen Zusatz, der sie ungültig gemacht hat, und zu beiden Richtungen des Streichungsgraphen. In der Detailansicht ist nichts gekürzt. Die Kacheln oben filtern auch diese Übersicht.',
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
    'Auf diese Streichung folgt kein Zusatz. Das Protokoll sagt es im Text darum herum.',
  'decisions.detail.voids':
    '{count, plural, one {Es hat eine Aussage gestrichen in} other {Es hat Aussagen gestrichen in}}',
  'decisions.detail.read': 'ADR {number} lesen',

  'decisions.footer.build':
    'Jede Zeile, jede Zahl und jede Kante oben wird beim Build aus den Protokollen selbst gelesen. Die Workbench hält keine Kopie davon, diese Übersicht kann <code>adr/</code> also nicht widersprechen, und wenn sie ein Protokoll nicht lesen kann, wird die Site nicht gebaut.',
  'decisions.footer.notes':
    'Der Index, aus dem diese Sätze stammen, ist vollständig unter <notes>Entscheidungen, die Notizen</notes> veröffentlicht. Er trägt den Teil, den eine Tabelle aus Zeilen nicht tragen kann: die Notizen für alle, die die älteren Protokolle lesen, und die Regel von oben in voller Länge.',
};
