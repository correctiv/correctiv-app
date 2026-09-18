/**
 * German for the `design.*` ids: the page that frames the Figma file, and the
 * three tools in the right-hand panel.
 *
 * **What is NOT here is every name and every identifier.** `Figma`, `macOS`,
 * `Windows`, `Linux`, `Apple silicon` and `figma-linux-next` are called that
 * wherever you are; `@correctiv/design-tokens`, `bg-canvas`,
 * `tools/figma-plugin`, `code.js` and `spec.json` are identifiers.
 * `pages/Design.tsx` hands every one of them in as a value, so none of them is
 * inside a string here and no catalogue can reword one
 * ([ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 *
 * **One exception sits in the middle of a sentence and stays English:** the menu
 * path „Plugins, Development, Import plugin from manifest“ in
 * `design.clients.note`. It is not a description of a menu, it is the words a
 * reader has to find in Figma's own English one, so a German version of it would
 * translate them out of the instruction.
 *
 * `design.reload` reads word for word like `frame.reload`, and the two mean two
 * different frames: the Figma file here, the running app there. Both descriptors
 * say so in their `description`, which is where a translator will look.
 */
export const design: Record<string, string> = {
  'design.title': 'Design',
  'design.lede':
    'Die App wird in einer einzigen Figma-Datei entworfen, <b>{file}</b>. Sie ist die Quelle für die Screens, und diese Workbench ist die Quelle für alles, was darüber aufgeschrieben ist.',
  'design.frameTitle': '{file}, in Figma',

  'design.loads': 'Was geladen wird',
  'design.loads.note': 'Eine Anfrage an figma.com, und keine, bevor Sie den Knopf drücken.',
  'design.see': 'Was Sie sehen werden',
  'design.see.note':
    'Die Datei, wenn Sie bei Figma angemeldet sind und Zugriff darauf haben. Sonst Figmas eigene Anmeldeseite. Diese Seite ist eine Frage der Berechtigung und kein Fehler: Die Datei ist nicht öffentlich geteilt.',

  'design.full': 'Im Vollbild öffnen',
  'design.full.note':
    'Der Rahmen braucht die Breite des Bildschirms und öffnet deshalb für sich allein. Die Datei selbst wird auch dann erst auf einen Druck geladen.',
  'design.load': 'Die Figma-Datei laden',
  'design.load.note': 'von figma.com',

  'design.rest.side':
    'Alles Weitere zum Design, die Desktop-Programme, das Plugin und die Stellen, an denen die Farben den Code erreichen, steht rechts.',
  'design.rest.below':
    'Alles Weitere zum Design, die Desktop-Programme, das Plugin und die Stellen, an denen die Farben den Code erreichen, steht darunter.',

  'design.open': 'In Figma öffnen',
  'design.reload': 'Den Rahmen neu laden',

  'design.links.file': 'Die Datei in Figma',
  'design.links.app': 'Die App, in Gerätegröße',
  'design.links.note':
    'Die Vorschau rahmt die laufende App in der Größe, in der die Datei sie zeichnet. Genau für diesen Vergleich ist die Datei da.',

  'design.clients.note':
    'Das Plugin wird über Plugins, Development, Import plugin from manifest geladen, und dieses Menü gibt es nur im Desktop-Programm. Figma baut eines für macOS und Windows; unter Linux nutzt dieses Projekt einen Fork.',
  'design.clients.official': 'Offiziell',
  'design.clients.fork': 'figma-linux-next, ein Fork',

  'design.colours': 'Die Farben',
  'design.colours.note':
    'Nicht aus der Datei nachgezeichnet. <code>{pkg}</code> wird generiert, und die App und diese Site importieren dasselbe Stylesheet, sodass <code>{token}</code> an drei Stellen dasselbe bedeutet.',
  'design.board': 'Das Board',
  'design.board.note':
    '<code>{path}</code> zeichnet die Screen-Übersicht aus Daten dieses Repositories in die Datei, statt dass jemand ein Board von Hand nachführt.',
  'design.plugin': 'Das Plugin',
  'design.plugin.note':
    'Ein Interpreter und kein Baukasten: <code>{codeFile}</code> weiß nichts über die App und zeichnet, was immer <code>{specFile}</code> beschreibt. Seine eigene Dokumentation ist eine Seite dieser Site, mit den drei Fallstricken des Linux-Programms darin.',
  'design.plugin.doc': 'Das Figma-Plugin',
  'design.plugin.repo': 'Im Repository',
};
