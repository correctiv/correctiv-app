/**
 * German for the `settings.*` ids: the dialog behind the gear.
 *
 * `settings.language` carries both language names in this catalogue too, with the
 * German one first. That heading is the one control somebody has to find while the
 * site is in a language they do not read, so a translation that dropped either word
 * would take away the way back.
 *
 * `settings.language.system` is the only row of that group with a German side at
 * all. „English“ and „Deutsch“ name themselves in the dialog and are literals in
 * `ui/Settings.tsx`, because a German reader looking for English does not look for
 * „Englisch“. This row has no language of its own, so it follows the setting like
 * the rest of the dialog. Its hint says „Browser“ where the appearance's says
 * „Gerät“, and that is the truth rather than a variation: the language list comes
 * from the browser's own settings and the colour scheme from the operating system's.
 *
 * The shortcut keys themselves are not here. `⌘K` is a key on a keyboard and not a
 * word, and the dialog's `<kbd>` elements hold them.
 */
export const settings: Record<string, string> = {
  'settings.title': 'Einstellungen',
  'settings.lede':
    'Diese Einstellungen gelten nur für diesen Browser. Nichts davon wird gesendet. Die App im Rahmen behält ihre eigenen Einstellungen.',

  'settings.appearance': 'Erscheinungsbild',
  'settings.mode.light': 'Hell',
  'settings.mode.light.hint': 'Immer hell',
  'settings.mode.dark': 'Dunkel',
  'settings.mode.dark.hint': 'Immer dunkel',
  'settings.mode.system': 'System',
  'settings.mode.system.hint': 'Dem Gerät folgen',

  'settings.language': 'Sprache · Language',
  'settings.language.system': 'System',
  'settings.language.system.hint': 'Dem Browser folgen',

  'settings.keyboard': 'Tastatur',
  'settings.shortcut.search': 'Dokumente, Abschnitte und die API durchsuchen',
  'settings.shortcut.panel': 'Die Werkzeugleiste öffnen oder schließen',
  'settings.shortcut.leaveFull': 'Den Vollbildmodus der App-Ansicht verlassen',

  'settings.build': 'Dieser Build',
  'settings.build.note':
    'Gebaut aus Commit <commitLink>{commit}</commitLink>. Jeder Link in den Quelltext zeigt auf diesen Commit, nicht auf <code>main</code>. Die Zahlen zu den Quellen stammen vom <day>{measured}</day> ({age}). Ein Job misst sie jede Woche neu.',
};
