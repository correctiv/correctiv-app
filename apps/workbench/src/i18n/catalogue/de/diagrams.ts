/**
 * German for the `diagrams.*` ids: the board of drawings and a single drawing's
 * own page.
 *
 * One namespace for two files, because it is one area. `pages/DiagramIndex.tsx`
 * holds the heading and the two paragraphs under it, `pages/DiagramView.tsx` the
 * breadcrumb, the position in the set and the navigation at the foot.
 *
 * **What is NOT here is every word inside and around the pictures.** A drawing's
 * title, its lede and every label in its SVG live in `src/diagrams/`. They are
 * this site's own words too and follow the setting by
 * [ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1,
 * but they are a pass of their own: an SVG label is sized by its own text, so a
 * longer German word reflows the drawing it sits in, and that is a question to
 * answer per picture rather than per page.
 *
 * The first step of a drawing's breadcrumb is not here either. It is
 * `shell.activity.handbook`, because the breadcrumb asks the rail what section
 * the route is in instead of writing the word itself.
 */
export const diagrams: Record<string, string> = {
  'diagrams.title': 'Diagramme',
  'diagrams.lede':
    'Dieselbe Architektur, die die Workbench in Prosa erklärt, gezeichnet. Jede Zeichnung ist von Hand geschriebenes SVG, dessen Füllungen und Striche alle aus einer Klasse kommen. So folgt sie dem hellen und dem dunklen Schema von selbst, und es gibt kein zweites Asset, das mitgepflegt werden muss.',
  'diagrams.list':
    'Jede Zeichnung trägt dasselbe noch einmal als Liste unter sich. Diese Liste ist keine Bildunterschrift: Sie ist die Seite für alle, die mit dem Bild nichts anfangen können.',

  'diagrams.breadcrumb': 'Navigationspfad',
  'diagrams.crumb': 'Diagramme',
  'diagrams.position': '{position} von {total}',
  'diagrams.others': 'Die anderen Diagramme',
};
