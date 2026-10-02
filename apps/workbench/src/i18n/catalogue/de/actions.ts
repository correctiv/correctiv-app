/**
 * German for the `actions.*` ids: the share, save, submit and discard buttons at the
 * right end of the header (`ui/ToolActions.tsx`), one vocabulary for every tool.
 */
export const actions: Record<string, string> = {
  'actions.group': 'Änderungen des geöffneten Werkzeugs',
  'actions.submit': 'Einreichen',
  'actions.submitTip':
    'Öffnet GitHub mit Ihrer Änderung, oder legt sie in die Zwischenablage, wenn sie zu lang für einen Link ist. Ein Klick auf „Create“ reicht sie ein, daraus entsteht automatisch ein Pull Request. Dafür brauchen Sie ein GitHub-Konto; diese Seite speichert kein Passwort und keinen Token.',
  'actions.submitOff': 'Noch nichts einzureichen. Ändern Sie zuerst etwas in diesem Werkzeug.',
  'actions.share': 'Link teilen',
  'actions.shareTip':
    'Kopiert einen Link, der diesen Entwurf auf einem anderen Rechner öffnet. Ein Entwurf ist kein Geheimnis: Alles, was er enthält, landet beim Einreichen in einem öffentlichen GitHub-Issue.',
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
