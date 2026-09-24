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

  // The strings tool, `preview/strings/StringsTool.tsx`. What it edits is the app's
  // German, which is printed as it stands and is not this site's to translate.
  'tools.strings.pick': 'Text auswählen',
  'tools.strings.picking': 'Klicken Sie im Rahmen auf einen Text',
  'tools.strings.noOwners':
    'Ohne Development-Build gibt es keinen Quell-Stack. Ein Wortlaut, den mehrere IDs teilen, lässt sich deshalb nicht auf eine eingrenzen. Die Suche über den Text funktioniert trotzdem.',
  'tools.strings.english':
    'Der Rahmen ist auf Englisch. Bearbeitet wird hier das Deutsche, eine Änderung ist also erst zu sehen, wenn der Rahmen wieder Deutsch ist.',
  'tools.strings.noId':
    'Keine Text-ID. Das ist Inhalt, ein Name oder eine Marke, die die App nicht übersetzt. Es sei denn, es ist eine der wenigen Meldungen, die fast nur aus Platzhaltern bestehen, die Liste kennzeichnet sie.',
  'tools.strings.several': '{count} IDs haben diesen Wortlaut. Wählen Sie eine:',
  'tools.strings.narrowed': 'Über den Quell-Stack eingegrenzt.',
  'tools.strings.edited': 'geändert',
  'tools.strings.loose': 'nicht auswählbar',
  'tools.strings.looseNote':
    'Diese Meldung besteht fast nur aus Platzhaltern, ihr Text passt deshalb auf beinahe jeden Satz. Der Picker lässt sie aus, statt zu raten. Sie finden sie hier in der Liste.',
  'tools.strings.englishSource': 'Englisch, und das ist Quellcode',
  'tools.strings.writtenIn': 'Steht in {place}. Das Englische zu ändern ist eine Änderung am Code.',
  'tools.strings.german': 'Deutsch',
  'tools.strings.reset': 'Zurück zum Katalog',
  'tools.strings.problem.empty': 'Das Deutsche ist leer.',
  'tools.strings.problem.tooLong': 'Das Deutsche ist länger als {max} Zeichen.',
  'tools.strings.problem.unsafe':
    'Im Deutschen steht ein unsichtbares Zeichen, {character}, an Stelle {position}. Geben Sie den Text an dieser Stelle ohne das Zeichen neu ein.',
  'tools.strings.problem.syntax': 'Das ist keine gültige Meldung: {detail}',
  'tools.strings.problem.missing':
    'Das Englische hat Platzhalter, die im Deutschen fehlen: {names}',
  'tools.strings.problem.extra':
    'Das Deutsche hat Platzhalter, die das Englische nicht hat: {names}',
  'tools.strings.problem.kind':
    'Das Deutsche verwendet diese Platzhalter anders als das Englische: {names}',
  'tools.strings.problem.unknown': 'Diese ID gibt es im Katalog nicht.',
  'tools.strings.changes': '{count, plural, one {# Text geändert} other {# Texte geändert}}',
  'tools.strings.save': 'In den Katalog schreiben',
  'tools.strings.saved': 'Geschrieben nach {paths}.',
  'tools.strings.savedStale':
    'Geschrieben nach {paths}. Die Liste ließ sich nicht neu aufbauen, führen Sie vor dem nächsten Blick darauf npm run workbench:strings aus.',
  'tools.strings.rejected':
    'Der Dev-Server hat das Speichern abgelehnt (HTTP {status}). Es wurde nichts geschrieben.',
  'tools.strings.rejectedOrigin':
    'Der Dev-Server nimmt nur von dieser Seite auf diesem Rechner etwas an. Es wurde nichts geschrieben.',
  'tools.strings.quoted': '„{text}“',
  'tools.strings.refused': 'Nichts wurde geschrieben. {ids}',
  'tools.strings.saveFailed': 'Der Dev-Server hat nicht geantwortet: {detail}',
  'tools.strings.copy': 'Änderungen kopieren',
  'tools.strings.discard': 'Alle verwerfen',
  'tools.strings.submit': 'Texte einreichen',
  'tools.strings.submitHint':
    'GitHub öffnet sich mit Ihren geänderten Texten. Ein Klick auf „Create“ reicht sie ein. Dafür brauchen Sie ein GitHub-Konto.',
  'tools.strings.submitHintLong':
    'Diese Änderungen sind zu lang für einen Link. Der Klick kopiert sie in die Zwischenablage, auf GitHub fügen Sie sie ein. Dafür brauchen Sie ein GitHub-Konto.',
  'tools.strings.submitCopied':
    'Die geänderten Texte liegen in der Zwischenablage. Fügen Sie sie auf GitHub in das Issue ein.',
  'tools.strings.submitNoClipboard':
    'Der Browser hat den Zugriff auf die Zwischenablage nicht erlaubt. Kopieren Sie die geänderten Texte aus diesem Feld und fügen Sie sie auf GitHub in das Issue ein.',
  'tools.strings.submitField': 'Die geänderten Texte',
  'tools.strings.submitNote':
    '„Texte einreichen“ öffnet auf GitHub ein neues Issue mit Ihrem geänderten Deutsch. Daraus entsteht automatisch ein Pull Request, der diese Wortlaute ändern darf und sonst nichts. In der App erscheinen sie, sobald jemand ihn geprüft und übernommen hat. Diese Seite speichert kein Passwort und keinen Token.',
  'tools.strings.filter': 'Text suchen',
  'tools.strings.shown': '{shown} von {total}',
  // The issue Texte einreichen opens (`preview/strings/submit.ts`). „Create“ is GitHub's own
  // button, which GitHub labels in English, so it is quoted as it reads there.
  'tools.strings.issue.heading': 'Änderungen an den Texten der App',
  'tools.strings.issue.lead':
    'Diese Änderungen an den deutschen Texten der App kommen aus der Workbench. Klicken Sie unten auf „Create“. Danach entsteht automatisch ein Pull Request, und dieses Issue verlinkt ihn. Bitte lassen Sie den Block darunter, wie er ist.',
  'tools.strings.issue.help':
    'Die Änderungen waren zu lang für den Link. Sie liegen deshalb in Ihrer Zwischenablage. Löschen Sie diesen Text, fügen Sie die Änderungen hier ein (Strg+V, auf dem Mac Cmd+V) und klicken Sie auf „Create“.',
};
