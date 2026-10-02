/** German for the `navigation.*` ids: the tab bar editor. */
export const navigation: Record<string, string> = {
  'navigation.lead':
    'Die Tab-Leiste der App. Home steht immer an erster Stelle. Der Rahmen lädt nach jeder Änderung neu, weil die App die Navigation nur beim Start liest.',
  'navigation.entries': 'Einträge',
  'navigation.homeFixed': 'immer zuerst',
  'navigation.moveUp': '{name} nach oben',
  'navigation.moveDown': '{name} nach unten',
  'navigation.remove': '{name} aus der Tab-Leiste nehmen',
  'navigation.add': '{name} hinzufügen',
  'navigation.available': 'Nicht in der Leiste',
  'navigation.maxTabs': 'Tabs vor „Mehr“',
  'navigation.maxTabsOption': '{count} Tabs',
  'navigation.maxTabsNote':
    '„Mehr“ zählt als einer davon. Gibt es mehr Einträge, wandert der Rest hinter „Mehr“. Mindestens {min}, höchstens {max}.',
  'navigation.result': 'Die Leiste zeigt',
  'navigation.behindMore': 'hinter „Mehr“: {names}',
  'navigation.lastTab':
    'Eine Leiste braucht mindestens {min} Tabs, Home eingerechnet. Der letzte Eintrag bleibt deshalb.',
  'navigation.invalid': 'Die App würde diese Leiste nicht zeichnen: {codes}',
  'navigation.changed': 'geändert',
  'navigation.unchanged': 'unverändert',
  'navigation.revert': 'Änderungen verwerfen',
  'navigation.submit': 'Änderungen einreichen',
  'navigation.save': 'Ins Repository speichern',
  'navigation.copied':
    'Die Änderung war zu lang für den Link und liegt in der Zwischenablage. Fügen Sie sie in das Issue ein.',
  'navigation.refused': 'abgelehnt',
  'navigation.save.written': 'Geschrieben nach {path}.',
  'navigation.save.refused': '{said} ({codes})',
  'navigation.save.http': 'HTTP {status}',
  'navigation.issue.heading': 'Änderungen an der Navigation',
  'navigation.issue.lead':
    'Diese Änderung an der Navigation kommt aus der Workbench. Klicken Sie unten auf „Create“. Danach entsteht automatisch ein Pull Request, auf den dieses Issue verweist. Bitte lassen Sie den Block darunter unverändert.',
  'navigation.issue.help':
    'Die Änderung war zu lang für den Link und liegt in der Zwischenablage. Löschen Sie diesen Text, fügen Sie die Änderung hier ein (Strg+V, am Mac Cmd+V) und klicken Sie auf „Create“.',
};
