/**
 * German for the `strings.*` ids: the frame around the board at `/strings`.
 *
 * Only the frame. What the page is made of — every id, every wording, every path —
 * is the material and is printed as it is written, and the columns are called `de`
 * and `en` because those are the model's own keys rather than labels.
 *
 * „Texte“ and not „Strings“, here and in `shell.activity.strings` and
 * `nav.strings`. The second audience
 * [ADR 0050](../../../../../../adr/0050-the-workbench-gets-a-second-audience.md) §1
 * names sits in the newsroom, and for this page that is the audience. `shell.ts`
 * leaves `State`, `Props` and `Source` standing because those are the names of
 * tools; a sentence somebody reads inside the app is not one.
 */
export const strings: Record<string, string> = {
  'strings.title': 'Texte',
  'strings.lede':
    'Jeder Text, den die App anzeigt, zusammengeführt aus der Extraktion und den Katalogen.',

  // The filter in the header's context bar (`pages/Strings.tsx`).
  'strings.filter.label': 'Texte nach Id, Wortlaut oder Beschreibung filtern',
  // The two examples stay as they are: one is an id prefix and the other a German
  // wording, which are the two ways this board is searched in either language.
  'strings.filter.placeholder': 'z. B. gate. oder Anmelden',
  'strings.filter.summary':
    '{shown, plural, one {# Text} other {# Texte}} in {namespaces, plural, one {# Namensraum} other {# Namensräumen}}',
  'strings.filter.which': 'Welche Texte',
  'strings.filter.all': 'Alle',
  'strings.filter.sameEnglish': 'Gleiches Englisch',

  // The mark in a language's cell where that catalogue has no entry, and the third
  // segment beside the filter, which is one word for one thing.
  'strings.untranslated': 'Nicht übersetzt',
  'strings.twin': 'Gleiches Englisch wie {ids}',
  'strings.empty': 'Kein Text passt dazu.',
};
