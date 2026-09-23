/**
 * German for the `edition.*` ids: an edition of the home screen, ADR 0059.
 *
 * "Ausgabe" is the record's own word for it, and the newsroom's. The two warnings are the
 * ones the private plan of §7 would make unnecessary; until it exists they are the whole of
 * what stands between a submitted edition and a plan published early, so they say so plainly.
 */
export const edition: Record<string, string> = {
  // Beside the track (`preview/home/Timeline.tsx`).
  'edition.here': 'Neue Ausgabe',
  'edition.hereLong': 'Ab dieser Minute eine Ausgabe für einen Tag anlegen',
  'edition.taken':
    'Genau zu dieser Minute beginnt schon eine Ausgabe. Bearbeiten Sie stattdessen diese.',
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
  'edition.landsOnDay': 'Ihre Änderungen gehen in den normalen Tag.',
  'edition.landsOn': 'Ihre Änderungen gehen in die Ausgabe „{edition}“.',

  // The edition's popover.
  'edition.details': 'Zeitraum, Titel und Löschen für {edition}',
  'edition.title': 'Titel',
  'edition.from': 'Beginnt um (Berliner Zeit)',
  'edition.until': 'Endet um (Berliner Zeit)',
  'edition.remove': 'Ausgabe löschen',
  'edition.publicWhenMerged':
    'Eine Ausgabe ist öffentlich, sobald sie übernommen ist. Reichen Sie sie erst ein, wenn sie bekannt werden darf.',
  'edition.pinEarly':
    'Diese Anheftung ist öffentlich, sobald die Ausgabe es ist. Für einen Text mit Sperrfrist nutzen Sie stattdessen seine Markierung in WordPress.',

  // What a block's row says about an edition (`HomeDocument.tsx`).
  'edition.decides': '{edition} legt diesen Block hier fest',
  'edition.switchOnIn': '{block} in {edition} einschalten',
  'edition.switchOffIn': '{block} in {edition} ausschalten',
  'edition.offIn': 'In {edition} nicht auf dem Bildschirm.',
};
