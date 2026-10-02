/**
 * German for the `ui.*` ids: the design system, where a primitive carries a word
 * of its own, and the one tab the app names itself.
 *
 * The five destinations used to be here too. They are in their screens' own
 * documents since ADR 0075 §5, where the newsroom can change them without a
 * release; `ui.tabMore` stays because "Mehr" is the screen the app draws when the
 * bar overflows and nobody arranges it (ADR 0071 §5).
 */
export const ui: Record<string, string> = {
  'ui.back': 'Zurück',
  'ui.tabMore': 'Mehr',
};
