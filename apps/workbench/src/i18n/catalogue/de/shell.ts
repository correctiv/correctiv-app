/**
 * German for the `shell.*` ids: what the right panel and the rail beside it are
 * called, on every view of this site.
 *
 * The names come out of `src/shell/views.ts`, which is a table and not a component.
 * Several of them stay as they are and each for the same reason: `State`, `Tokens`,
 * `Props` and `Source` are what the team calls those tools out loud, and a `Prop` is
 * not a „Eigenschaft“ to anybody who has ever read the reference beside it. What is
 * translated is the prose: a section whose name is a sentence, and the tooltip the
 * rail adds to it.
 */
export const shell: Record<string, string> = {
  'shell.section.contents': 'Auf dieser Seite',
  'shell.section.appearance': 'Erscheinungsbild',
  'shell.section.state': 'State',
  'shell.section.home': 'Startseiten-Layout',
  'shell.section.console': 'Konsole',
  'shell.section.tokens': 'Tokens',
  'shell.section.measure': 'Messen',
  'shell.section.inspect': 'Prüfen',
  'shell.section.strings': 'Texte',
  'shell.section.designLinks': 'Öffnen',
  'shell.section.designClients': 'Desktop-Programme',
  'shell.section.designCode': 'Wo es den Code erreicht',
  'shell.section.rendering': 'Darstellung',
  'shell.section.device': 'Gerät',
  'shell.section.props': 'Props',
  'shell.section.source': 'Source',

  'shell.panel.design': 'Design-Werkzeuge',
  'shell.panel.component': 'Komponente',
  'shell.panel.tools': 'Werkzeuge',

  'shell.rail.closeTip': '{tool} · zum Schließen drücken',

  // The in-page contents (`ui/Toc.tsx`). What the panel is called is
  // `shell.section.contents` above, because the nav and the panel are one thing.
  'shell.toc.none': 'Keine Überschriften auf dieser Seite.',

  // The rail down the left edge (`ui/ActivityBar.tsx`). Its words are short on
  // purpose: they sit under a 36px icon and in a tooltip beside it.
  'shell.activity.label': 'Bereiche',
  'shell.activity.overview': 'Überblick',
  'shell.activity.app': 'Die App',
  'shell.activity.handbook': 'Handbuch',
  'shell.activity.decisions': 'Entscheidungen',
  'shell.activity.sources': 'Quellen',
  'shell.activity.design': 'Design',
  'shell.activity.reference': 'Referenz',
  'shell.activity.components': 'Komponenten',
  'shell.activity.strings': 'Texte',

  // The bar across the top (`ui/Header.tsx`).
  'shell.header.search': 'Die Workbench durchsuchen',
  'shell.header.searchShort': 'Suchen',
  'shell.header.full': 'Der App den ganzen Bildschirm geben',
  'shell.header.fullTip': 'Nur die App',
  'shell.header.source': 'Der Quelltext auf GitHub',
  'shell.header.settings': 'Einstellungen',

  // The palette (`ui/Search.tsx`). Everything it LISTS is the repository's own
  // English; these are the frame around it.
  'shell.search.dialog': 'Die Workbench durchsuchen',
  'shell.search.placeholder': 'Dokumente, Abschnitte, die API des Core und die Komponenten',
  'shell.search.empty': 'Dazu passt nichts.',
  'shell.search.kind.page': 'Seite',
  'shell.search.kind.document': 'Dokument',
  'shell.search.group.pages': 'Seiten',
  'shell.search.group.documents': 'Dokumente',
  'shell.search.group.sections': 'Abschnitte',
  'shell.search.group.reference': 'Referenz',
  'shell.search.group.components': 'Komponenten',

  // A view that threw (`ui/Boundary.tsx`), and the way back into the chrome
  // (`ui/ShowChrome.tsx`). `Esc` and `⌘K` are the keys' own names.
  'shell.boundary.heading': 'Diese Ansicht ließ sich nicht anzeigen',
  'shell.boundary.lead':
    'Der Rest der Workbench funktioniert weiter. Wählen Sie links einen anderen Bereich, oder drücken Sie <kbd>⌘K</kbd>, um zu suchen. Der Fehler steht unten und in der Konsole des Browsers.',
  'shell.boundary.retry': 'Diese Ansicht noch einmal versuchen',
  'shell.chrome.show': 'Die Leisten wieder einblenden',
  'shell.chrome.showTip': 'Die Leisten einblenden · Esc',

  'shell.dialog.close': 'Schließen',
  'shell.info.about': 'Mehr zu „{topic}“',

  // The shell's own few words on the page (`App.tsx`).
  'shell.skip': 'Zum Inhalt springen',
  'shell.build': ' · gebaut aus {commit}',
  'shell.notFound.heading': 'Keine Seite unter {route}',
  'shell.notFound.lead':
    'Drücken Sie <kbd>⌘K</kbd>, um zu suchen, oder wählen Sie links einen Bereich.',
  'shell.notFound.component':
    'Die App hat keine solche Komponente. <back>Alle Komponenten ansehen</back>.',
};
