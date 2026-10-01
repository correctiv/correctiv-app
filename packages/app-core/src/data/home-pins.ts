import type { FeedItem } from '../types/models';

/**
 * The articles a place on the home screen can be pinned to, while nothing can be asked.
 *
 * ADR 0036 §3 gives every place a rule and lets the configuration override it with a
 * specific item; [ADR 0039](../../../../adr/0039-the-home-screen-is-a-day-not-a-timetable.md)
 * §4 makes that override a setting a moment can change. Both need the same thing from
 * somewhere: **the set of items an editor may choose between.**
 *
 * WordPress will answer that. `wp/v2/posts` already serves the feeds
 * (`services/wp.service.ts`), and the editorial query behind "what may lead the app
 * today" — a window, a category, a flag, something — has not been asked for and does not
 * exist. Until it does, an editor picking an article has to pick it from something, and
 * the honest something is a short list of real articles in the shape the endpoint will
 * answer in.
 *
 * ## Why these are `FeedItem`s and not a smaller shape of their own
 *
 * `FeedItem` is what `wp.service.ts` maps a post INTO, so it is the shape the replacement
 * arrives in, and a narrower type here would be a second shape that has to be widened on
 * the day the query exists. It is also what makes a pin drawable: a place pinned to an
 * article that today's feed does not carry — an older one, or one in a feed this screen
 * does not read — has something to draw rather than a hole, which is what ADR 0036 §8
 * asks for from the other direction.
 *
 * The cascade a module runs is therefore: the live feed first, because a pinned article
 * that IS in the feed should be drawn with whatever the feed knows about it today; then
 * this list; then the place's own rule. Only the middle rung is sample data, and it is
 * the rung that disappears when the query exists.
 *
 * ## It says it is sample data, and it says it in one place
 *
 * Not here. `apps/workbench/content/sources.manifest.ts` carries the row — `status:
 * 'sample'`, and what it stands in for — and the editor reads that row rather than a
 * sentence typed beside the picker, so the day the row turns `live` the marking goes
 * with it. `apps/workbench/test/sources.test.ts` already fails on a file in this
 * directory with no row, which is how this one got its.
 *
 * Real articles, taken from the bundled snapshot on 2026-09-17 so that a person choosing
 * one recognises it. They are not refreshed and are not meant to be: this is a list of
 * *choices*, and a choice that changes under the editor is worse than an old one.
 */
export const HOME_PINS: readonly FeedItem[] = [
  {
    id: 'https://correctiv.org/?p=284870',
    feed: 'recherchen',
    title: 'Russisches Haus – Ein Ende für Propaganda und Spionage?',
    url: 'https://correctiv.org/russland/2026/08/11/russisches-haus-ein-ende-fuer-propaganda-und-spionage/',
    teaser:
      'Mitten im Wahlkampf um den Berliner Senat werden die Rufe lauter, das Russische Haus in der Friedrichstraße zu schließen.',
    author: 'Silvia Stöber',
    publishedAt: '2026-08-11T14:34:42.000Z',
    categories: ['Hybride Kriegsführung', 'International', 'Russland'],
    imageUrl: null,
  },
  {
    id: 'https://correctiv.org/?p=284791',
    feed: 'recherchen',
    title: 'Riskante Grauzone: Bundeswehr schafft Einfallstor für chinesische Spionage',
    url: 'https://correctiv.org/aktuelles/sicherheit-und-verteidigung/2026/08/11/bundeswehr-schafft-einfallstor-fuer-chinesische-spionage-pistorius-bmvg-verteidigungsministerium-drohnen-dji/',
    teaser:
      'Die Bundeswehr trainiert mit chinesischen Drohnen. Ihre Beschaffung ist voller Widersprüche.',
    publishedAt: '2026-08-11T13:39:45.000Z',
    categories: ['Hybride Kriegsführung', 'Sicherheit und Verteidigung'],
    imageUrl: null,
  },
  {
    id: 'https://correctiv.org/?p=284798',
    feed: 'faktencheck',
    title: 'Keine KI: Foto von Voigt, Kretschmer und Schulze ist echt',
    url: 'https://correctiv.org/faktencheck/2026/08/11/keine-ki-foto-von-voigt-kretschmer-und-schulze-ist-echt/',
    teaser:
      'Anders als in Sozialen Netzwerken behauptet ist ein Bild, das Mario Voigt, Michael Kretschmer und Schulze zeigt, nicht künstlich erzeugt.',
    publishedAt: '2026-08-11T14:48:48.000Z',
    categories: ['Faktencheck'],
    imageUrl: null,
  },
  {
    id: 'https://correctiv.org/?p=284440',
    feed: 'faktencheck',
    title: '5.000 neue Moscheen für Spanien? Tiktok-Account streut unbelegte Gerüchte',
    url: 'https://correctiv.org/faktencheck/2026/08/06/5-000-neue-moscheen-fuer-spanien-tiktok-account-streut-unbelegte-geruechte/',
    teaser:
      'Online verbreitet sich seit Monaten die Behauptung, Spanien wolle 5.000 Moscheen bauen. Belege dafür gibt es nicht.',
    publishedAt: '2026-08-06T14:46:00.000Z',
    categories: ['Faktencheck'],
    imageUrl: null,
  },
  {
    id: 'https://correctiv.org/?p=283163',
    feed: 'klima',
    title: 'Hitzeschutz in deutschen Städten: Zwischen Konzept und Wirklichkeit',
    url: 'https://correctiv.org/aktuelles/klimawandel/2026/07/29/hitzeschutz-in-deutschen-staedten-zwischen-konzept-und-wirklichkeit/',
    teaser:
      'Trinkbrunnen, Hitzewarnungen oder nur Verhaltenstipps. Solche Maßnahmen sind Teil von Hitzeaktionsplänen.',
    publishedAt: '2026-07-29T10:32:51.000Z',
    categories: ['Klimawandel'],
    imageUrl: null,
  },
  {
    id: 'https://correctiv.org/?p=281476',
    feed: 'klima',
    title: 'Fehlender Hitzeschutz an Schulen als bildungspolitisches Problem',
    url: 'https://correctiv.org/aktuelles/bildung/2026/07/16/fehlender-hitzeschutz-an-schulen-als-bildungspolitisches-problem/',
    teaser:
      'Bis 45 Grad Celsius in Klassenräumen: Schulen in Deutschland sind nicht auf den Klimawandel vorbereitet.',
    publishedAt: '2026-07-16T06:18:09.000Z',
    categories: ['Bildung'],
    imageUrl: null,
  },
];

/** A pinned address back to the item it names, or null if this list does not carry it. */
export function pinnedArticle(url: string | null): FeedItem | null {
  if (url === null) return null;
  return HOME_PINS.find((item) => item.url === url) ?? null;
}
