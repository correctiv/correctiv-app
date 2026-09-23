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
  'conditions.intrinsic.loadingOrOffline': 'Erscheint nur, solange die App lädt oder offline ist.',
  'conditions.intrinsic.hasLeadArticle':
    'Erscheint nur, wenn es einen Aufmacher gibt: angeheftet oder der neueste.',
  'conditions.intrinsic.hasSpotlightIssue':
    'Erscheint erst, wenn eine Spotlight-Ausgabe geladen ist.',
  'conditions.intrinsic.hasMoreResearch':
    'Erscheint nur, wenn es mehr Recherchen als den Aufmacher gibt.',
  'conditions.intrinsic.hasFactChecks': 'Erscheint nur, wenn Faktenchecks geladen sind.',
  'conditions.intrinsic.hasOpenCallout': 'Erscheint nur, solange ein Aufruf offen ist.',

  // The same, as the chip in the popover; the sentence above is behind its ⓘ.
  'conditions.chip.loadingOrOffline': 'Nur beim Laden oder offline',
  'conditions.chip.hasLeadArticle': 'Nur mit Aufmacher',
  'conditions.chip.hasSpotlightIssue': 'Nur mit Spotlight-Ausgabe',
  'conditions.chip.hasMoreResearch': 'Nur mit weiteren Recherchen',
  'conditions.chip.hasFactChecks': 'Nur mit Faktenchecks',
  'conditions.chip.hasOpenCallout': 'Nur bei offenem Aufruf',

  // Who a block, and a change, is for.
  'conditions.audience.everyone': 'Alle',
  'conditions.audience.payingMembers': 'Mitglieder mit Beitrag',
  'conditions.audience.freeMembers': 'Kostenlose Mitglieder',

  'conditions.placeFor': 'Zeigen für',
  'conditions.changeFor': 'Diese Änderung gilt für',
  'conditions.byDefault': '{audience} (Voreinstellung)',
  'conditions.notYet': 'Noch keine Mitglieder (die App ist nur für Mitglieder)',
  'conditions.stranding': 'Manche Zielgruppen lassen sich hier nicht wählen.',
  'conditions.strandingWhy':
    'Diese Änderung holt den Block von seinem anderen Platz weg. Würde sie nur für einige Leserinnen und Leser gelten, sähen die anderen den Block an keinem der beiden Plätze.',
  'conditions.locked':
    'Diese Änderung gilt für eine andere Zielgruppe. Um sie zu bearbeiten, melden Sie im Rahmen eine Person aus dieser Zielgruppe an.',
  'conditions.notFor':
    'Im Rahmen ausgeblendet. Die dort angemeldete Person gehört nicht zu dieser Zielgruppe.',
};
