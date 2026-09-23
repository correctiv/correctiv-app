/**
 * German for the `handbook.*` ids: the grid of doors onto the repository's own
 * documents.
 *
 * **What is NOT here is the sentence under each card.** Those come out of
 * `virtual:docs`, where they are written beside the document's path in
 * `plugin/registry.ts`, and they stay English because the repository wrote them
 * about its own files
 * ([ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * `handbook.card.diagrams.blurb` is the single exception and is here, because the
 * drawings have no Markdown document and so nobody wrote a line for them.
 *
 * So a German reader gets German cards over English one-liners, with English
 * documents one click behind them. That is the mixed page ADR 0052 §1 calls the
 * answer, and the seam runs between what this site says and what it quotes.
 *
 * `Readme` and `Release` are not translated: they are the names of two files in
 * the root of this repository, and the card leads to `README.md` itself.
 */
export const handbook: Record<string, string> = {
  'handbook.title': 'Handbuch',
  'handbook.lede': 'Die Dokumente des Repositorys, direkt aus ihren Dateien angezeigt.',
  'handbook.lede.more':
    'Nichts hier ist eine Kopie. Die Dateien sind die Quelle, und diese Site ist ein zweiter Weg, sie zu lesen. So gibt es nur eine Stelle zum Bearbeiten, und keine Fassung veraltet unbemerkt.',
  'handbook.records':
    'Die Entscheidungen dahinter haben einen eigenen Bereich. Ein Entscheidungsprotokoll ist eine andere Art Dokument: Es wird nie umgeschrieben. Macht eine spätere Entscheidung eine Aussage falsch, wird sie durchgestrichen statt korrigiert.',

  'handbook.card.architecture.kind': 'Erklärung',

  'handbook.card.diagrams': 'Diagramme',
  'handbook.card.diagrams.kind': 'Gezeichnet',
  'handbook.card.diagrams.blurb':
    'Dieselbe Architektur, gezeichnet: der Core und sein Host, welche Entscheidungen noch gelten, womit die App spricht, wie der Core innen geschichtet ist, wie sich jemand anmeldet und woher ein Artikel kommt.',

  'handbook.card.conventions.kind': 'Regeln',

  'handbook.card.traps.kind': 'Teuer bezahlt',

  'handbook.card.provenance.kind': 'Generiert',

  'handbook.card.readme.kind': 'Anfang',

  'handbook.card.release.kind': 'Ablauf',
};
