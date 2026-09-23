/**
 * German for the `edition.*` ids: an edition of the home screen, ADR 0059.
 *
 * "Ausgabe" is the record's own word for it, and the newsroom's. The two warnings are the
 * ones the private plan of §7 would make unnecessary; until it exists they are the whole of
 * what stands between a submitted edition and a plan published early, so they say so plainly.
 */
export const edition: Record<string, string> = {
  // Beside the track (`preview/home/Timeline.tsx`).
  'edition.here': 'Ausgabe hier',
  'edition.hereLong': 'Ab dieser Minute eine Ausgabe für einen Tag anlegen',
  'edition.band': '{edition}, an diesem Tag von {from} bis {to}',
  'edition.momentGo': 'Zu {time} in {edition} springen',

  // The head of the panel while an edition is what an edit lands on (`Edition.tsx`).
  'edition.kind': 'Ausgabe',
  'edition.start': 'Beginn der Ausgabe, bis {until}',
  'edition.end': 'zu ihrem Ende',
  'edition.momentTime': 'Die Uhrzeit dieses Moments der Ausgabe',
  'edition.momentSpan':
    'bis {until} · {changes, plural, =0 {hier ändert sich noch nichts} one {# Änderung hier} other {# Änderungen hier}}',
  'edition.momentRemove': 'Den Moment um {time} aus {edition} entfernen',
  'edition.landsOnDay': 'Änderungen landen im gewöhnlichen Tag.',
  'edition.landsOn': 'Änderungen landen in der Ausgabe „{edition}“, nicht im gewöhnlichen Tag.',

  // The edition's popover.
  'edition.details': 'Zeitraum, Titel und Löschen für {edition}',
  'edition.title': 'Titel',
  'edition.from': 'Von (Berliner Zeit)',
  'edition.until': 'Bis (Berliner Zeit)',
  'edition.untilNote':
    'Zur Minute in „Bis“ ist die Ausgabe schon vorbei. Ein Ende am oder vor dem Beginn wird nicht übernommen.',
  'edition.remove': 'Ausgabe löschen',
  'edition.publicWhenMerged':
    'Eine Ausgabe ist öffentlich, sobald sie gemergt ist. Ab dann stehen ihr Zeitraum, ihr Titel und alles, was sie ändert, im offenen Repository und in jeder Kopie der App. Reichen Sie sie nicht früher ein, als sie bekannt sein darf.',
  'edition.pinEarly':
    'Ein in einer Ausgabe angehefteter Artikel ist so früh öffentlich wie die Ausgabe. Um mit einem Stück unter Sperrfrist aufzumachen, setzen Sie bei der Veröffentlichung dessen Markierung in WordPress, statt es hier anzuheften.',

  // What a block's row says about an edition (`HomeDocument.tsx`).
  'edition.decides': '{edition} bestimmt diesen Block hier',
  'edition.switchOnIn': '{block} in {edition} einschalten',
  'edition.switchOffIn': '{block} in {edition} ausschalten',
  'edition.offIn': 'In {edition} nicht auf dem Bildschirm.',
};
