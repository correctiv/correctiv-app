/**
 * German for the `strings.*` ids: the frame around the board of every wording
 * this repository has.
 *
 * **What is NOT here is every cell of that board.** An id, a wording in either
 * language, the description written for a translator and the path into the
 * repository are the rows the page exists to show, and a translation of one of
 * them would be a different string than the one being reported
 * ([ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * That is also why the `de` column reads German while the setting says English,
 * and the `en` column English while it says German: those are the data.
 *
 * `app`, `workbench`, `settings.title`, `gate.` and the locale codes stay as they
 * are. They are identifiers, and each of them is a thing a reader can type into
 * the filter and find.
 *
 * The page was English throughout until ADR 0052, on ADR 0050 §2's line. What
 * moved is the line rather than the page.
 */
export const strings: Record<string, string> = {
  'strings.title': 'Texte',
  'strings.lede':
    'Jeder Text der App und dieser Site mit seiner ID, aus dem Quelltext und den Katalogen zusammengeführt.',
  'strings.lede.more':
    "Die App und diese Site haben getrennte Kataloge für getrennte Leserschaften. Deshalb nennt jede Überschrift die Oberfläche und den Namensraum, und <code>settings.title</code> steht unten für zwei verschiedene Texte. Ein Wortlaut mit <code>'{braces}'</code> ist ein ICU-Muster und wird als Muster gezeigt.",
  'strings.lede.progress':
    'Die <code>app</code>-Hälfte ist vollständig, bis auf zwei Texte, die eine Leserin in der App sieht und die mit Absicht keine Deskriptoren sind. <code>apps/mobile/__tests__/localisation-seam.test.ts</code> nennt beide und den Grund. Die <code>workbench</code>-Hälfte ist fast vollständig: Jede Seite dieser Site steht hier. Es fehlen die Beschriftungen in den Architekturzeichnungen, die einen eigenen Durchgang brauchen. <code>apps/workbench/test/rendered-literals.test.ts</code> zählt, was noch offen ist.',

  'strings.filter': 'Texte nach ID, Wortlaut oder Beschreibung filtern',
  'strings.filter.placeholder': 'Filtern, zum Beispiel gate., Anmelden oder workbench',
  'strings.filter.summary':
    '{shown} von {total} in {sections, plural, one {# Abschnitt} other {# Abschnitten}}',

  'strings.only.legend': 'Welche Texte',
  'strings.only.all': 'Alle',
  'strings.only.same': 'Gleiches Englisch',
  'strings.only.untranslated': 'Nicht übersetzt',

  'strings.empty': 'Dazu passt kein Text.',
  'strings.row.twins': 'Gleiches Englisch wie {ids}',
  'strings.row.untranslated': 'Nicht übersetzt',
};
