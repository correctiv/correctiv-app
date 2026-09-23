/**
 * German for the `tools.*` ids: the six tools in the preview's rail, and what
 * each of them prints.
 *
 * One namespace for four files, because it is one area and the four are parts of
 * one tool each. `preview/ui/Panels.tsx` holds the six panel bodies,
 * `preview/api.ts` names the four appearance combinations, `preview/frame/
 * measure.ts` holds what a finding says, and `preview/handover.ts` holds the four
 * field names of the block the inspector builds for pasting into a chat. The
 * tools' own names, on the rail and over each panel, are `shell.section.*`.
 *
 * **What the tools report back is not here.** `light`, `dark` and `system` are
 * the literal contents of the app's own setting; `warn` and `error` are the two
 * levels the frame's console is patched for; a console row is the app's own
 * output and stays in whatever words it was written in, which
 * `preview/frame/console.ts` argues at length; `--color-canvas` is a custom
 * property and `#ffffff` a colour. `DevTools`, `Rendering`, `expo export` and
 * `npm run web` are a browser's name, one of its panels, and two commands.
 *
 * Two things this file does NOT hold, so that looking for them here is short: a
 * fixture's own name and the line under it are `fixtures.*`, and the storage a
 * fixture writes is not user-facing at all.
 */
export const tools: Record<string, string> = {
  'tools.needsDev': 'Braucht einen Development-Build',

  'tools.appearance.setting': 'App-Einstellung sagt',
  'tools.appearance.legend': 'App-Einstellung',
  'tools.appearance.device': 'Gerät meldet',
  'tools.appearance.unknown': 'unbekannt',
  'tools.appearance.needsDev':
    'Im veröffentlichten Build lässt sich diese Einstellung nicht ändern. <code>expo export</code> setzt <code>__DEV__</code> auf false, deshalb bietet die App kein Dev-Handle. Starten Sie die Workbench gegen <code>npm run web</code>.',
  'tools.appearance.default': 'Voreinstellung',
  'tools.appearance.onScreen': 'gerade zu sehen',
  'tools.appearance.here': 'hier',
  'tools.appearance.note':
    'Ein iframe kann kein eigenes Farbschema bekommen. Die beiden mit DevTools markierten Zeilen erreichen Sie, wenn Sie in den DevTools unter Rendering <code>prefers-color-scheme</code> emulieren.',

  // The four combinations TROUBLESHOOTING.md numbers. Each names the setting and,
  // for the last two, what the device reports; both are values of the app's own
  // state and are left in their spelling, so a row can be matched against the two
  // readouts at the top of the same panel.
  'tools.appearance.combination.1': 'Einstellung light',
  'tools.appearance.combination.2': 'Einstellung dark',
  'tools.appearance.combination.3': 'System · Gerät light',
  'tools.appearance.combination.4': 'System · Gerät dark',

  'tools.state.legend': 'App-Zustand · eine Auswahl lädt den Rahmen neu',
  'tools.state.none': 'Unberührt lassen',
  'tools.state.none.hint': 'Was vom letzten Besuch gespeichert ist.',

  'tools.console.levels': 'Angezeigte Level',
  'tools.console.filter': 'Konsolenzeilen filtern',
  'tools.console.filter.placeholder': 'filtern',
  'tools.console.clear': 'Leeren',
  'tools.console.log': 'Konsole der App',
  'tools.console.empty': 'Nichts seit der letzten Navigation.',
  'tools.console.noMatch': 'Nichts passt zum Filter.',
  // Inflected where the English is not. Exactly one warning is an ordinary
  // reading of this line, and „1 Warnungen“ is wrong in a way „1 warnings“ is
  // only careless; a translation may take a plural its source did not.
  'tools.console.summary':
    '{shown} von {total} Zeilen angezeigt, {warnings, plural, one {# Warnung} other {# Warnungen}}, {errors, plural, one {# Fehler} other {# Fehler}}.',
  'tools.console.mark.errors': '{count, plural, one {Fehler} other {Fehler}}',
  'tools.console.mark.warnings': '{count, plural, one {Warnung} other {Warnungen}}',

  'tools.tokens.lede': 'Überschrieben wird das Schema <b>{scheme}</b>, das die App gerade zeigt.',
  'tools.tokens.changed': 'geändert',
  'tools.tokens.reset': 'Überschreibungen zurücksetzen',
  'tools.tokens.copy': 'CSS kopieren',
  'tools.tokens.changedCount': '{count} geändert',
  'tools.tokens.text': 'Text auch',
  'tools.tokens.textNote': 'Textfarben werden über ihren Wert gefunden, dabei kann manches fehlen.',

  'tools.measure.check.overflow': 'Horizontaler Überlauf',
  'tools.measure.check.tapTarget': 'Tap-Ziele unter {minimum} px',
  'tools.measure.check.offPalette': 'Farben außerhalb der Palette',
  'tools.measure.kind.overflow': 'Überlauf',
  'tools.measure.kind.tapTarget': 'Tap-Ziel',
  'tools.measure.kind.offPalette': 'Farbe',
  'tools.measure.run': 'Prüfungen ausführen',
  'tools.measure.outline': 'Boxen umranden',
  'tools.measure.scanned': '{count} Elemente geprüft.',
  'tools.measure.none': 'Nichts gefunden in {count} Elementen.',
  'tools.measure.lightNote':
    'Im hellen Modus sind Farben mehrdeutig. Mehrere Tokens haben den Wert #ffffff, mehrere #333333, und ein Vergleich kann nicht sagen, welches gemeint war. Führen Sie die Prüfungen im dunklen Modus erneut aus, dort hat die Palette mehr verschiedene Werte.',
  'tools.measure.mark': '{count, plural, one {Befund} other {Befunde}}',

  // The pixel counts take a space before the unit, which the English does not.
  'tools.measure.finding.page':
    'Die Seite scrollt seitwärts: {content} px Inhalt in {viewport} px.',
  'tools.measure.finding.node': 'Reicht bis {right} px, über die Kante bei {viewport} px hinaus.',
  'tools.measure.finding.tapTarget':
    '{width}×{height} px, unter den {minimum} px, die ein Daumen braucht.',
  'tools.measure.finding.offPalette': '{property}: {value} ist kein Token in {scheme}.',

  'tools.inspect.needsDev':
    'Der Picker braucht einen Development-Build und ist hier aus. Er liest die Quellzeile aus dem Owner-Stack von React, und ein Produktions-Bundle hat keinen.',
  'tools.inspect.arm': 'Element auswählen',
  'tools.inspect.armed': 'Klicken Sie im Rahmen auf ein Element',
  'tools.inspect.noLabel': 'Element ohne Label',
  'tools.inspect.nothing': 'Nichts ausgewählt.',
  'tools.inspect.noSource':
    'Keine Quelle gefunden. Entweder stammt nichts in der Owner-Kette dieses Knotens aus der App, oder dies ist ein Produktions-Build, und der hat keine Owner-Stacks.',
  'tools.inspect.stack': 'Der Quell-Stack, der innerste zuerst',
  'tools.inspect.block': 'Übergabeblock',
  'tools.inspect.copy': 'Für einen Agenten kopieren',
  'tools.inspect.open': 'Im Editor öffnen',
  'tools.inspect.note': 'Der Block trägt die Adresse dieser Ansicht.',

  // The four field names of that block. They are padded to one column at run
  // time, from whatever these resolve to, so a translation is free to be longer
  // or shorter than the English.
  'tools.inspect.handover.element': 'Element',
  'tools.inspect.handover.source': 'Quelle',
  'tools.inspect.handover.context': 'Kontext',
  'tools.inspect.handover.view': 'Ansicht',
  'tools.inspect.handover.noLabel': '(kein Label)',
};
