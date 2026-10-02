/**
 * German for the `actions.*` ids: the save, submit and discard buttons at the right end
 * of the header (`ui/ToolActions.tsx`), one vocabulary for every tool.
 */
export const actions: Record<string, string> = {
  'actions.group': 'Änderungen des geöffneten Werkzeugs',
  'actions.submit': 'Einreichen',
  'actions.submitTip':
    'Öffnet auf GitHub ein neues Issue mit Ihrer Änderung. Daraus entsteht automatisch ein Pull Request. Diese Seite speichert kein Passwort und keinen Token.',
  'actions.save': 'Speichern',
  'actions.saveTip':
    'Auf einem Entwicklungsserver schreibt Speichern die Änderung in Ihren eigenen Checkout. Eine Abkürzung für Entwickler. Der Weg zum Pull Request ist „Einreichen“.',
  'actions.discard': 'Verwerfen',
  'actions.discardTip':
    'Setzt alle Änderungen dieses Werkzeugs auf den ausgelieferten Stand zurück.',
  'actions.count': '{count, plural, =0 {Keine Änderungen} one {# Änderung} other {# Änderungen}}',
  'actions.changed': 'Geändert',
  'actions.previewTip': 'Die Vorschau zeigt diesen Entwurf, nicht die veröffentlichte App.',
  'actions.unchanged': 'Unverändert',
};
