/**
 * German for the `coreAndHost.*` ids: the first drawing, the core and its host.
 *
 * One namespace per drawing, named after the drawing's own module rather than
 * after its route: the route segments carry hyphens, `test/i18n.test.ts` reads an
 * id as `[\w.]+`, and a namespace it cannot match is a file quietly excused from
 * the check that keeps every id under the name of the file it sits in. A camel
 * back is checked; a hyphen is not.
 *
 * **What is NOT here is every name in the picture.** The eight chips across the
 * top are the directories of `packages/app-core/src`; the five card headings are
 * what `ports/index.ts` declares; `packages/app-core`, `apps/mobile`, `MMKV`,
 * `expo-audio` and `Expo / React Native` are packages and paths. All of them are
 * drawn as literals in `src/diagrams/CoreAndHost.tsx` and stay in their own
 * spelling, and `test/diagrams.test.ts` reads the five interface names straight
 * straight out of the drawing.
 *
 * **Two labels are drawn five times each** and so are one id each:
 * `coreAndHost.needs` over the upper half of every card and `coreAndHost.answers` over
 * the lower half. `coreAndHost.asynchronously` is drawn twice for the same reason.
 *
 * **The port count is English by decision, not by omission.**
 * `test/diagrams.test.ts` counts the members of `CorePlatform` and reads the
 * count out of the drawing's own source, so "fünf Ports" here is a second copy
 * that nothing checks. It has to be moved by hand when the core grows a port.
 */
export const coreAndHost: Record<string, string> = {
  'coreAndHost.title': 'Der Core und sein Host',
  'coreAndHost.lede':
    'Alles Verhalten auf der einen Seite, aller Plattformcode auf der anderen. Beide treffen sich nur an fünf benannten Ports. Die zwei kleinen Dateien, die diese Ports beantworten, sind alles, was ein weiterer Host kostet.',

  'coreAndHost.svg.title':
    'Der Core und sein Host: packages/app-core oben, apps/mobile unten, verbunden nur durch fünf Ports',

  'coreAndHost.core.side': 'das Verhalten, alles davon',
  'coreAndHost.core.rule':
    'Importiert kein UI-Framework und kein Plattform-SDK. Diese Regel ist der Wert des Pakets.',
  'coreAndHost.core.test':
    '<file>packages/app-core/test/boundary.test.ts</file> lässt den Build scheitern, sobald ein Plattform-Import auftaucht.',

  'coreAndHost.calls': 'der Core ruft auf',
  'coreAndHost.reports': 'der Core meldet',
  'coreAndHost.storage': 'Speicher-Ports',

  'coreAndHost.needs': 'der Core braucht',
  'coreAndHost.answers': 'dieser Host antwortet mit',
  'coreAndHost.asynchronously': 'asynchron',

  'coreAndHost.keyValue.needs': 'kleine Einstellungen,',
  'coreAndHost.keyValue.answer.1': 'MMKV, einem Store, den',
  'coreAndHost.keyValue.answer.2': 'der Cache nicht erreicht',

  'coreAndHost.blob.needs': 'den HTTP-Cache,',
  'coreAndHost.blob.answer.1': 'noch einem MMKV-Store,',
  'coreAndHost.blob.answer.2': 'begrenzt und räumbar',

  'coreAndHost.bundle.needs.1': 'das, was in der App',
  'coreAndHost.bundle.needs.2': 'mitgeliefert wurde',
  'coreAndHost.bundle.answer': 'generierten TS-Modulen',

  'coreAndHost.audio.needs.1': 'Wiedergabe, als',
  'coreAndHost.audio.needs.2': 'Status-Ticks',
  'coreAndHost.audio.answer.1': 'den Status-Events',
  'coreAndHost.audio.answer.2': 'von expo-audio',

  'coreAndHost.error.needs.1': 'Gehör für einen',
  'coreAndHost.error.needs.2': 'Fehler ohne Bildschirm',
  'coreAndHost.error.answer.1': 'einer Logzeile, und noch',
  'coreAndHost.error.answer.2': 'kein Anbieter gewählt',

  'coreAndHost.storage.note.1': 'beide asynchron, getrennt nur',
  'coreAndHost.storage.note.2': 'durch das, was sie halten: ein',
  'coreAndHost.storage.note.3': 'Einstellungs-String gegen ein',
  'coreAndHost.storage.note.4': 'Megabyte Feeds im Cache',

  'coreAndHost.implements': 'der Host implementiert',
  'coreAndHost.adapter':
    '<muted>Adapter </muted><file>lib/platform/expo.ts</file><muted> und </muted><file>lib/audio/backend.ts</file><muted>, die gesamten Kosten eines weiteren Hosts</muted>',
  'coreAndHost.host.side': 'der Host, die ganze Plattform',
  'coreAndHost.host.targets': 'Ziele: iOS, Android und Web',

  'coreAndHost.caption.lead':
    'Alles, was sich verhält, liegt über den Ports; alles, was eine Plattform berührt, darunter.',
  'coreAndHost.caption':
    'Der Core deklariert die fünf Schnittstellen und ruft sie auf, und ein Test hält die Linie fest. Vier davon braucht er, um zu arbeiten. <code>ErrorReporter</code> braucht er, um gehört zu werden: Die Voreinstellung meldet nirgendwohin, niemand wartet auf den Aufruf, und ein nicht konfigurierter Core wird still, statt zu brechen. Dieser Host beantwortet vier davon in <code>apps/mobile/src/lib/platform/expo.ts</code> und den Audio-Port in <code>apps/mobile/src/lib/audio/backend.ts</code>, den <code>apps/mobile/src/app/_layout.tsx</code> auf die anderen vier setzt. Einen zweiten Host hinzuzufügen heißt, diese zwei Dateien noch einmal zu schreiben.',

  'coreAndHost.alt.core.term': '<code>packages/app-core</code>, das Verhalten',
  'coreAndHost.alt.core':
    'Enthält stores, articles, media, services, data, lib, ports und types. Es importiert kein UI-Framework und kein Plattform-SDK. <code>packages/app-core/test/boundary.test.ts</code> lässt den Build bei einem Import scheitern, der auf seine Liste passt.',
  'coreAndHost.alt.ports.term': 'Fünf Ports, der einzige Übergang zwischen beiden',
  'coreAndHost.alt.keyValue':
    '<code>KeyValueStore</code>: Der Core braucht kleine Einstellungen, asynchron. Dieser Host antwortet mit MMKV, in dem Store, der hält, was beim Lesen gewählt wurde.',
  'coreAndHost.alt.blob':
    '<code>BlobStore</code>: Der Core braucht den HTTP-Cache, asynchron. Dieser Host antwortet mit einem zweiten MMKV-Store, den der Cache des Cores begrenzt und aus dem er räumt. Zwei Stores statt einem sind der Grund, warum eine Räumung kein Lesezeichen erreichen kann.',
  'coreAndHost.alt.bundle':
    '<code>ContentBundle</code>: Der Core braucht das, was in der App mitgeliefert wurde. Dieser Host antwortet mit generierten TS-Modulen.',
  'coreAndHost.alt.audio':
    '<code>AudioBackend</code>: Der Core braucht Wiedergabe, als Status-Ticks. Dieser Host antwortet mit den Status-Events von expo-audio.',
  'coreAndHost.alt.error':
    '<code>ErrorReporter</code>: Der Core braucht Gehör, für einen Fehler, den kein Bildschirm zeigt. Dieser Host antwortet mit einer Logzeile, und ein Anbieter ist noch nicht gewählt. Es ist der eine Port, den der Core nicht braucht, um zu arbeiten, und deshalb meldet seine Voreinstellung nirgendwohin und der Aufruf gibt nichts zurück, worauf jemand warten könnte. Die Fehlergrenze des Hosts meldet über dieselbe Implementierung, erreicht sie aber direkt statt über diese Linie.',
  'coreAndHost.alt.storage':
    'Beide Speicher-Ports sind asynchron. Was sie trennt, ist das, was sie halten: ein Einstellungs-String gegen ein Megabyte Feeds im Cache.',
  'coreAndHost.alt.adapter.term': 'Der Adapter',
  'coreAndHost.alt.adapter':
    '<code>apps/mobile/src/lib/platform/expo.ts</code> beantwortet vier davon: die beiden Speicher-Schnittstellen, das Content-Bundle und den Reporter. <code>apps/mobile/src/lib/audio/backend.ts</code> beantwortet den Audio-Port, und <code>apps/mobile/src/app/_layout.tsx</code> setzt ihn auf die anderen vier, damit Überlegungen dazu, wo Zustand liegt, kein Audio-SDK mitziehen. Diese zwei Dateien sind die gesamten Kosten eines weiteren Hosts.',
  'coreAndHost.alt.host.term': '<code>apps/mobile</code>, der Host',
  'coreAndHost.alt.host': 'Expo / React Native, für iOS, Android und Web.',
};
