/**
 * German for the `insideCore.*` ids: the fourth drawing, how the core is layered
 * inside.
 *
 * One namespace per drawing, named after the drawing's own module rather than
 * after its route: the route segments carry hyphens, `test/i18n.test.ts` reads an
 * id as `[\w.]+`, and a namespace it cannot match is a file quietly excused from
 * the check that keeps every id under the name of the file it sits in. A camel
 * back is checked; a hyphen is not.
 *
 * **What is NOT here is every name in the picture.** Every chip in the stack is
 * a directory, a file, an interface or a package — `stores`, `articles`,
 * `media`, `services`, `data`, `lib`, `ports`, `types`, the ten service modules,
 * the five port interfaces, `configurePlatform()`, `articles/extract`, `string`,
 * `DOM`, `@correctiv/app-core/stores/session` and the four SDKs below the red
 * line. All of them are drawn as literals in `src/diagrams/InsideCore.tsx` and
 * stay in their own spelling.
 *
 * **Two figures here are second copies of a figure a check holds.**
 * `test/diagrams.test.ts` counts `.ts` and `.tsx` under `packages/app-core/src`
 * and counts the members of `CorePlatform`, and it reads both out of the
 * drawing's own source rather than out of this file. So "60 TypeScript-Dateien"
 * and "alle fünf Ports" have to be moved by hand when the English moves.
 *
 * "Slice" and "Store" are Redux Toolkit's own words and stay, as they do in the
 * app; "Verträge" is what the contracts are called on `/handbook` as well.
 */
export const insideCore: Record<string, string> = {
  'insideCore.title': 'Innen im Core',
  'insideCore.lede':
    '60 TypeScript-Dateien in sieben Schichten. Importe zeigen den Stapel hinunter, die Verträge liegen unten, und darunter liegt eine Linie, die nichts im Paket überquert.',

  'insideCore.svg.title':
    'Innen in packages/app-core: stores über articles und media, über services und data, über lib, über ports und types, mit einer harten Grenze darunter und den Plattform-SDKs auf deren anderer Seite',

  'insideCore.imports': 'Importe zeigen den Stapel hinunter',
  'insideCore.files': '60 TypeScript-Dateien',

  'insideCore.stores': 'ein Redux-Toolkit-Store, 13 Slices',
  'insideCore.stores.owns':
    'Der Core besitzt die Slices und exportiert <file>createAppStore()</file>.',
  'insideCore.stores.host': 'Der Host konstruiert die Instanz.',

  'insideCore.articles': 'das Article-Modell und seine Ladekaskade',
  'insideCore.extractors': 'zwei Backends hinter einem <file>ArticleExtractor</file>',

  'insideCore.media.rule': 'eine Regel:',
  'insideCore.media.rule.2': 'nur ein Medium',
  'insideCore.media.rule.3': 'spielt gleichzeitig',

  'insideCore.services.files': '10 Dateien',
  'insideCore.data.files': '11 Dateien',
  'insideCore.data.content.1': 'getippte Inhalte,',
  'insideCore.data.content.2': 'vom Compiler geprüft',

  'insideCore.lib': 'String- und Datumshelfer ohne Abhängigkeiten',

  'insideCore.ports.file': '<file>ports/index.ts</file>, 1 Datei',
  'insideCore.ports.split': 'vier arbeiten, einer wird gehört',

  'insideCore.types.files': '1 Datei',
  'insideCore.types': 'die gemeinsamen Verträge',

  'insideCore.boundary': 'harte Grenze, nichts überquert sie',
  'insideCore.boundary.test':
    '<file>packages/app-core/test/boundary.test.ts</file> lässt den Build bei einem Import scheitern, der auf seine Liste passt: react-native, expo, Node-Builtins',
  'insideCore.sdks': 'Plattform-SDKs, nur vom Host erreicht',

  'insideCore.convention': 'Konvention',
  'insideCore.selectors.1': 'Abgeleitete Werte sind exportierte',
  'insideCore.selectors.2': 'Selektoren über State, nie Store-Methoden.',
  'insideCore.subpaths': 'Subpfad-Importe, kein Barrel:',
  'insideCore.rootEntry': 'Der Root-Entry gibt nur die Ports frei.',

  'insideCore.caption.lead':
    'Jede Schicht importiert nach unten, und die unterste ist ein Satz von Schnittstellen.',
  'insideCore.caption':
    'Die Ports werden hier deklariert und außerhalb implementiert; die SDKs unter der roten Linie sind Sache des Hosts, und ein Test hält sie draußen. Der Root-Entry exportiert nur die Ports, alles andere erreicht ein Host über seinen Pfad.',

  'insideCore.alt.lede':
    '<code>packages/app-core</code>, 60 TypeScript-Dateien. Importe zeigen den Stapel hinunter. Die Schichten von oben:',
  'insideCore.alt.stores':
    '<term>stores</term>: ein Redux-Toolkit-Store mit 13 Slices. Der Core besitzt die Slices und exportiert <code>createAppStore()</code>; der Host konstruiert die Instanz.',
  'insideCore.alt.articles':
    '<term>articles</term>: das Article-Modell und seine Ladekaskade. <code>articles/extract</code> hält zwei Backends, eines über Strings und eines über das DOM, hinter einem Typ <code>ArticleExtractor</code>. Daneben <term>media</term>, mit einer Regel: Es spielt nur ein Medium zur selben Zeit.',
  'insideCore.alt.services':
    '<term>services</term>, 10 Dateien: auth, cache, http, peertube, podcast, radio, rss, search, spotlight, wp. Daneben <term>data</term>, 11 Dateien getippter Inhalte.',
  'insideCore.alt.lib': '<term>lib</term>: String- und Datumshelfer ohne Abhängigkeiten.',
  'insideCore.alt.ports':
    '<term>ports</term> und <term>types</term>, die Verträge: <code>ports/index.ts</code>, eine Datei, deklariert <code>KeyValueStore</code>, <code>BlobStore</code>, <code>ContentBundle</code>, <code>AudioBackend</code>, <code>ErrorReporter</code> und <code>configurePlatform()</code>. Die Zeichnung setzt die ersten vier in eine Reihe und <code>ErrorReporter</code> in die nächste, weil die ersten vier das sind, was der Core zum Arbeiten braucht, und dieser das, was er braucht, um gehört zu werden: Die App läuft ohne ihn, und deshalb meldet seine Voreinstellung nirgendwohin. Daneben <term>types</term>, eine Datei gemeinsamer Verträge.',
  'insideCore.alt.boundary':
    'Unter den Verträgen liegt eine harte Grenze. Die Plattform-SDKs (react-native, expo, expo-audio, react-native-mmkv) liegen auf der anderen Seite, und nichts im Paket importiert sie. <code>packages/app-core/test/boundary.test.ts</code> hält diese Linie, indem es eine Liste von Namen ablehnt: react-native, expo, Node-Builtins, die NativeScript-Scopes und die View-Schichten, an die der Core früher gebunden war. Der Test greift am Anfang des Imports, das Storage-SDK fängt also der Eintrag <code>react-native</code> ab, ohne einen eigenen zu brauchen. Dieselbe Datei prüft außerdem, dass <code>ports/index.ts</code> weiterhin alle fünf Ports deklariert, damit keine Fähigkeit den Host erreicht, ohne dort benannt zu sein.',
  'insideCore.alt.conventions':
    'Zwei Konventionen: Abgeleitete Werte sind exportierte Selektoren über den State, nie Store-Methoden. Importe nutzen Subpfade und kein Barrel, zum Beispiel <code>@correctiv/app-core/stores/session</code>, weil der Root-Entry nur die Ports freigibt.',
};
