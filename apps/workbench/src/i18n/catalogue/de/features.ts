/** German for the `features.*` ids: the feature tool and the marks on blocks and components. */
export const features: Record<string, string> = {
  'features.lead':
    'Was ein Build einem Leser zugänglich machen darf. Eine Gruppe ist die Obergrenze ihrer Features. Änderungen hier werden im Rahmen ausprobiert, der dafür neu lädt. Freigeben heißt einreichen, daraus wird ein Pull Request.',
  'features.group': 'Gruppe {name}',
  'features.feature': 'Feature {name}',
  'features.locked': 'immer an',
  'features.state.aus': 'Aus',
  'features.state.vorschau': 'Vorschau',
  'features.state.an': 'An',
  'features.source.live': 'Live',
  'features.source.sample': 'Beispiel',
  'features.sampleOnly': 'Nur Beispieldaten, höchstens Vorschau.',
  'features.noData': 'liest keine Daten',
  'features.groupCeiling': 'Die Gruppe steht niedriger, deshalb ist „An“ hier nicht wählbar.',
  'features.changed': 'ausprobiert',
  'features.unchanged': 'wie freigegeben',
  'features.revert': 'Änderungen verwerfen',
  'features.submit': 'Freigabe einreichen',
  'features.copied':
    'Die Änderung war zu lang für den Link und liegt in der Zwischenablage. Fügen Sie sie in das Issue ein.',
  'features.issue.heading': 'Freigabe von Features',
  'features.issue.lead':
    'Diese Freigabe kommt aus der Workbench. Klicken Sie unten auf „Create“. Daraus wird automatisch ein Pull Request, auf den dieses Issue verweist. Bitte lassen Sie den Block darunter unverändert.',
  'features.issue.help':
    'Die Änderung war zu lang für den Link, deshalb liegt sie in Ihrer Zwischenablage. Löschen Sie diesen Text, fügen Sie die Änderung hier ein (Strg+V, am Mac Cmd+V) und klicken Sie auf „Create“.',
  'features.mark.vorschau': 'Nur Vorschau: Ein Release-Build zeigt es nicht.',
  'features.mark.aus': 'Aus: Kein Build zeigt es.',
  'features.mark.reason.declared': 'Die Freigabedatei hält es zurück.',
  'features.mark.reason.data': 'Es liest nur Beispieldaten.',
  'features.mark.reason.group': 'Seine Gruppe wird zurückgehalten.',
  'features.mark.reason.requires': 'Ein Feature, das es braucht, wird zurückgehalten.',
  'features.mark.reason.unknown': 'Ein Feature dieses Namens ist nicht angelegt.',
};
