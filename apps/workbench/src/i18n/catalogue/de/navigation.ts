/** German for the `navigation.*` ids: the tab bar editor. */
export const navigation: Record<string, string> = {
  'navigation.lead':
    'Die Tab-Leiste der App. Der erste Eintrag ist der Bildschirm, mit dem die App startet. Der Rahmen folgt jeder Änderung.',
  'navigation.entries': 'Einträge',
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
  'navigation.resultEmpty': 'nichts, die App zeigt ihren Leerzustand',
  'navigation.resultSingle': '{name}, ohne Tab-Leiste',
  'navigation.invalid': 'Die App würde diese Leiste nicht zeichnen: {codes}',
  'navigation.copied':
    'Die Änderung war zu lang für den Link und liegt in der Zwischenablage. Fügen Sie sie in das Issue ein.',
  'navigation.refused': 'abgelehnt',
  'navigation.save.written': 'Geschrieben nach {path}.',
  'navigation.save.refused': '{said} ({codes})',
  'navigation.save.http': 'HTTP {status}',
  'navigation.issue.heading': 'Änderungen an der Navigation im Layout {layout}',
  'navigation.issue.lead':
    'Diese Änderung an der Navigation kommt aus der Workbench. Klicken Sie unten auf „Create“. Danach entsteht automatisch ein Pull Request, auf den dieses Issue verweist. Bitte lassen Sie den Block darunter unverändert.',
  'navigation.issue.help':
    'Die Änderung war zu lang für den Link und liegt in der Zwischenablage. Löschen Sie diesen Text, fügen Sie die Änderung hier ein (Strg+V, am Mac Cmd+V) und klicken Sie auf „Create“.',
};
