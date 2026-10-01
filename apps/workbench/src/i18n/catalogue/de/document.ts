/**
 * German for the `document.*` ids: the frame a repository document is rendered
 * in, and nothing inside it.
 *
 * **This namespace is the seam, one file wide.** The breadcrumb's name, the note
 * about struck claims, the chip on each one, the line at the foot and the two
 * cards to the neighbouring records are this site's own words and are here. The
 * document itself is not: `doc.html` is the repository's Markdown rendered at
 * build time, `doc.nav` and `doc.title` are its own name, `doc.file` is a path,
 * and `ADR 0052` is a record's number. A German reader gets a German frame
 * around an English document, which
 * [ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1
 * calls the answer rather than an unfinished translation.
 *
 * „Aussage“ for a claim and „Protokoll“ for a record, the same two words
 * `landing.ts` and `decisions.ts` use.
 *
 * **„Streichung“ and not „zurückgezogen“**, which is what this file said first.
 * `/decisions` landed in the same change and its vocabulary block argues the
 * four words that board uses: a claim a later decision made false is
 * „gestrichen“ and the mark through it is a „Streichung“. A reader meeting
 * „gestrichene Aussagen“ on the board and „zurückgezogen“ on the page one click
 * behind it would read the two as two mechanisms, which is the failure
 * `ui/ActivityBar.tsx`'s `sectionOf()` argues against and ADR 0052 §5 names.
 * A cold review found both files in the same commit, each unaware of the other.
 *
 * The badge is a NOUN in German where the English is a participle. „9
 * gestrichen“ is the same ellipsis as „Komponenten, die der App“; „9
 * Streichungen“ stands on its own and inflects, which is what the English
 * descriptor's plural slot was put there for.
 */
// `documentFrame` and not `document`, which is the only name in this directory
// that does not match its namespace: `document` is a browser global, and a
// module-scope const of that name shadows it for the whole file.
export const documentFrame: Record<string, string> = {
  'document.breadcrumb': 'Navigationspfad',

  'document.retired.badge': '{count, plural, one {# Streichung} other {# Streichungen}}',
  'document.retired.note':
    '{count, plural, one {Eine Aussage auf dieser Seite ist durchgestrichen.} other {Einige Aussagen auf dieser Seite sind durchgestrichen.}} Der Grund steht jeweils daneben.',
  'document.retired.tag': 'gestrichen',

  'document.source':
    'Diese Seite ist <fileLink>{file}</fileLink> aus dem Repository, hier angezeigt. Sie ist keine Kopie, es gibt also nur eine Stelle zum Bearbeiten.',
  'document.source.generated':
    'Diese Seite schreibt ein Programm: <fileLink>{file}</fileLink> im Repository. Es läuft beim Build der Site, hier gibt es also nichts zu bearbeiten.',

  'document.neighbours': 'Die Protokolle vor und nach diesem',
  'document.previous': 'Vorheriges · {nav}',
  'document.next': 'Nächstes · {nav}',
};
