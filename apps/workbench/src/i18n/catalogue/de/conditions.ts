/**
 * German for the `conditions.*` ids: when a block of the home screen appears and for whom,
 * ADR 0060.
 *
 * The audiences are the club's own words. „Mitglieder mit Beitrag“ is what the door into
 * the app says it is for, and „Kostenlose Mitglieder“ matches the profile's „Kostenlose
 * Mitgliedschaft“, so the configurator and the app call one person the same thing.
 */
export const conditions: Record<string, string> = {
  // What a block owns, printed read-only in its popover (`preview/home/Conditions.tsx`).
  'conditions.intrinsic.loadingOrOffline': 'Erscheint nur, wenn die App lädt oder offline ist.',
  'conditions.intrinsic.hasLeadArticle':
    'Erscheint nur, wenn es einen Aufmacher gibt: angeheftet oder der neueste.',
  'conditions.intrinsic.hasSpotlightIssue':
    'Erscheint erst, wenn eine Spotlight-Ausgabe geladen ist.',
  'conditions.intrinsic.hasMoreResearch':
    'Erscheint nur, wenn der Recherchen-Feed mehr als den Aufmacher enthält.',
  'conditions.intrinsic.hasFactChecks': 'Erscheint nur, wenn Faktenchecks geladen sind.',
  'conditions.intrinsic.hasOpenCallout': 'Erscheint nur, solange ein Aufruf offen ist.',

  // Who a block, and a change, is for.
  'conditions.audience.everyone': 'Alle',
  'conditions.audience.payingMembers': 'Mitglieder mit Beitrag',
  'conditions.audience.freeMembers': 'Kostenlose Mitglieder',

  'conditions.placeFor': 'Zeigen für',
  'conditions.changeFor': 'Diese Änderung gilt für',
  'conditions.byDefault': '{audience} (Voreinstellung)',
  'conditions.notYet': 'Noch keine Mitglieder (in der App niemand)',
  'conditions.stranding':
    'Manche Zielgruppen sind aus: Eine Änderung hier blendet den anderen Platz aus, und ohne diese sähen manche Leserinnen und Leser keinen von beiden.',
  'conditions.locked':
    'Die Änderung hier gilt für eine andere Zielgruppe. Zum Bearbeiten eine Person daraus im Rahmen anmelden.',
  'conditions.notFor': 'Im Rahmen nicht zu sehen: die angemeldete Person gehört nicht dazu.',
};
