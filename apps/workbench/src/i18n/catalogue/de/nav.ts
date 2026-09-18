/**
 * German for the `nav.*` ids: what a page of this site is called, in the browser
 * tab and in the search palette.
 *
 * Only the pages this site answers itself. A document's name is its own h1 and a
 * drawing's is its caption, both of them the repository's English, and neither
 * passes through here
 * ([ADR 0050](../../../../../../adr/0050-the-workbench-gets-a-second-audience.md) §2).
 * Neither does the site's own name, which is a name in both languages.
 */
export const nav: Record<string, string> = {
  'nav.handbook': 'Handbuch',
  'nav.components': 'Komponenten der App',
  'nav.decisions': 'Entscheidungsprotokolle',
  'nav.design': 'Design, die Figma-Datei',
  'nav.diagrams': 'Architekturdiagramme',
  'nav.reference': 'Referenz, der Core',
  'nav.sources': 'Statusübersicht der Quellen',
  'nav.strings': 'Texte der App',
  'nav.preview': 'Vorschau',

  'nav.title.component': '{name}, eine Komponente',
  'nav.title.notFound': 'Nicht gefunden',
};
