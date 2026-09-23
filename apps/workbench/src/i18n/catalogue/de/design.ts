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
    'Die Datei, wenn Sie bei Figma angemeldet sind und Zugriff haben. Sonst Figmas Anmeldeseite. Das ist eine Frage der Berechtigung, kein Fehler: Die Datei ist nicht öffentlich geteilt.',

  'design.full': 'Im Vollbild öffnen',
  'design.full.note':
    'Der Rahmen braucht die ganze Breite des Bildschirms und öffnet sich deshalb allein. Die Datei lädt auch dann erst, wenn Sie auf den Knopf drücken.',
  'design.load': 'Die Figma-Datei laden',
  'design.load.note': 'von figma.com',

  'design.rest.side':
    'Mehr zum Design steht rechts: die Desktop-Programme, das Plugin und wo die Farben den Code erreichen.',
  'design.rest.below':
    'Mehr zum Design steht unten: die Desktop-Programme, das Plugin und wo die Farben den Code erreichen.',

  'design.open': 'In Figma öffnen',
  'design.reload': 'Den Rahmen neu laden',

  'design.links.file': 'Die Datei in Figma',
  'design.links.app': 'Die App, in Gerätegröße',
  'design.links.note':
    'Die Vorschau zeigt die laufende App in der Größe, in der die Datei sie zeichnet. So können Sie beide vergleichen.',

  'design.clients.note':
    'Das Plugin laden Sie über Plugins, Development, Import plugin from manifest. Dieses Menü gibt es nur im Desktop-Programm. Figma bietet es für macOS und Windows an, unter Linux nutzt dieses Projekt einen Fork.',
  'design.clients.official': 'Offiziell',
  'design.clients.fork': 'figma-linux-next, ein Fork',

  'design.colours': 'Die Farben',
  'design.colours.note':
    'Nicht aus der Datei abgemalt. <code>{pkg}</code> wird generiert, und die App und diese Site importieren dasselbe Stylesheet. So bedeutet <code>{token}</code> an drei Stellen dasselbe.',
  'design.board': 'Das Board',
  'design.board.note':
    '<code>{path}</code> zeichnet die Übersicht aller Screens aus Daten dieses Repositorys in die Datei. Niemand muss ein Board von Hand pflegen.',
  'design.plugin': 'Das Plugin',
  'design.plugin.note':
    '<code>{codeFile}</code> weiß nichts über die App. Es zeichnet, was <code>{specFile}</code> beschreibt. Seine Dokumentation ist eine Seite dieser Site und nennt die Fallstricke des Linux-Programms.',
  'design.plugin.doc': 'Das Figma-Plugin',
  'design.plugin.repo': 'Im Repository',
};
