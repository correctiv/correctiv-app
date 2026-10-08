/** German for the `sudoku.*` ids: the Sudoku screen, its board and the home card. */
export const sudoku: Record<string, string> = {
  'sudoku.title': 'Sudoku',
  'sudoku.intro':
    'Jeden Tag ein neues Rätsel, für alle Mitglieder dasselbe. Füllen Sie jede Zeile, jede Spalte und jeden Block mit den Ziffern 1 bis 9.',
  'sudoku.difficulty': 'Schwierigkeit',
  'sudoku.level.easy': 'Leicht',
  'sudoku.level.medium': 'Mittel',
  'sudoku.level.hard': 'Schwer',
  'sudoku.playDaily': 'Tagesrätsel spielen',
  'sudoku.continueDaily': 'Tagesrätsel fortsetzen',
  'sudoku.dailySolved': 'Tagesrätsel gelöst: {points, number} Punkte in {time}',
  'sudoku.newFree': 'Neues freies Spiel',
  'sudoku.freeNote':
    'Ein freies Spiel ist ein eigenes Rätsel und zählt ebenfalls für die Bestenliste.',
  'sudoku.status':
    '{kind, select, daily {Tagesrätsel} other {Freies Spiel}} · {difficulty} · {time} · {mistakes, plural, =0 {keine Fehler} one {ein Fehler} other {# Fehler}}',
  'sudoku.notes': 'Notizen',
  'sudoku.erase': 'Löschen',
  'sudoku.hint': 'Tipp',
  'sudoku.giveUp': 'Dieses Spiel aufgeben',
  'sudoku.solved.section': 'Gelöst',
  'sudoku.solved.points': '{points, number} Punkte',
  'sudoku.solved.detail':
    '{time} · {mistakes, plural, =0 {keine Fehler} one {ein Fehler} other {# Fehler}} · {hints, plural, =0 {keine Tipps} one {ein Tipp} other {# Tipps}} · Platz {rank} in dieser Stufe',
  'sudoku.table.section': 'Bestenliste',
  'sudoku.table.all': 'Alle',
  'sudoku.table.empty': 'Noch kein Rätsel gelöst. Das erste Ergebnis steht dann hier.',
  'sudoku.table.row': '{rank}. {name}',
  'sudoku.table.value': '{points, number} · {time}',
  'sudoku.table.anonymous': 'Mitglied',
  'sudoku.table.note':
    'Ihre Ergebnisse stehen hier als „{name}“. Die Liste liegt vorerst nur auf diesem Gerät, eine gemeinsame für alle Mitglieder ist geplant.',
  'sudoku.setNickname': 'Spitznamen wählen',
  'sudoku.board': 'Sudoku-Spielfeld',
  'sudoku.cell':
    'Zeile {row}, Spalte {column}: {digit, select, 0 {leer} other {{digit}}}{state, select, given {, vorgegeben} wrong {, falsch} other {}}',
  'sudoku.pad.digit':
    '{digit}, {remaining, plural, =0 {alle gesetzt} one {noch eine} other {noch #}}',
  'sudoku.card.label': 'Rätsel des Tages',
  'sudoku.card.heading': 'Das tägliche Sudoku',
  'sudoku.card.leadNew': 'Ein Rätsel am Tag, für alle Mitglieder dasselbe. Wie schnell sind Sie?',
  'sudoku.card.leadPlaying': 'Ihr Spiel läuft: bisher {time}.',
  'sudoku.card.leadSolved': 'Heute gelöst: {points, number} Punkte in {time}.',
  'sudoku.card.play': 'Jetzt spielen',
  'sudoku.card.resume': 'Weiterspielen',
  'sudoku.card.table': 'Zur Bestenliste',
};
