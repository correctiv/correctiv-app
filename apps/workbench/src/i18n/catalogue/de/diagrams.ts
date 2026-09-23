/**
 * German for the `diagrams.*` ids: the board of drawings and a single drawing's
 * own page.
 *
 * One namespace for two files, because it is one area. `pages/DiagramIndex.tsx`
 * holds the heading and the two paragraphs under it, `pages/DiagramView.tsx` the
 * breadcrumb, the position in the set and the navigation at the foot.
 *
 * **What is NOT here is what a picture itself says.** A drawing's title, its
 * lede and every label in its SVG live in `src/diagrams/`, one namespace per
 * drawing named after its module: `coreAndHost`, `decisionsChain`, `services`,
 * `insideCore`, `signIn`, `articlePath`. They are this site's own words too by
 * [ADR 0052](../../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1,
 * and they are separate because an SVG label is sized by its own text: a longer
 * German word reflows the drawing it sits in, which is a question to answer per
 * picture rather than per page.
 *
 * The two `diagrams.figure.*` ids below are the exception, and they belong here
 * rather than to a drawing because `diagrams/shared.tsx` draws the same frame
 * around all six: the name of the box a drawing scrolls inside, and the heading
 * over the list underneath it.
 *
 * The first step of a drawing's breadcrumb is not here either. It is
 * `shell.activity.handbook`, because the breadcrumb asks the rail what section
 * the route is in instead of writing the word itself.
 */
export const diagrams: Record<string, string> = {
  'diagrams.title': 'Diagramme',
  'diagrams.lede': 'Dieselbe Architektur, die die Workbench in Prosa erklärt, gezeichnet.',
  'diagrams.lede.more':
    'Jede Zeichnung ist von Hand geschriebenes SVG, dessen Füllungen und Striche alle aus einer Klasse kommen. So folgt sie dem hellen und dem dunklen Schema von selbst, und es gibt kein zweites Asset, das mitgepflegt werden muss.',
  'diagrams.list':
    'Jede Zeichnung trägt dasselbe noch einmal als Liste unter sich. Diese Liste ist keine Bildunterschrift: Sie ist die Seite für alle, die mit dem Bild nichts anfangen können.',

  'diagrams.figure.scroll': 'Diagramm {number}, scrollbar',
  'diagrams.figure.alt': 'Dasselbe Diagramm als Liste',

  'diagrams.breadcrumb': 'Navigationspfad',
  'diagrams.crumb': 'Diagramme',
  'diagrams.position': '{position} von {total}',
  'diagrams.others': 'Die anderen Diagramme',
};
