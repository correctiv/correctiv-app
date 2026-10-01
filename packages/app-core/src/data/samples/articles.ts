/**
 * Article variants — `FeedItem`, the shape a feed arrives in.
 *
 * This is the one domain with no offline constant behind it: `FeedItem` is what
 * `services/wp.service.ts` and `lib/rss-parse.ts` map a post into, and nothing in
 * the core holds one, so the two models a component may import had to be written
 * out wherever they were needed. These are those written-out specimens, moved
 * here so the gallery, a screen and the workbench's component page can all name
 * the same awkward article.
 *
 * The five are the two shapes the REST and the RSS path differ in (`lead` has
 * everything, `no-image` is the RSS path with neither an image nor a reading
 * time), the two fact-check cards the rail draws, and the long title that runs
 * over three lines where the rail clamps at four.
 *
 * `long-title` is a fact check as well, and the third card of the rail. It was
 * the third entry of one list in the gallery; here it is a name, which is what
 * lets a list be assembled from names rather than from one array that only the
 * gallery knows how to read.
 */
import type { FeedItem } from '../../types/models';

import { sampleDomain, variant } from './variant';

const ARTICLE_VARIANTS = [
  variant(
    'lead',
    'Everything a lead item can carry: image, byline, reading time, two categories. What the REST path answers in.',
    {
      id: 'article-lead',
      feed: 'recherchen',
      title: 'Wem gehört die Stadt? Was die Grundbücher über Eigentum verraten',
      url: 'https://correctiv.org/aktuelles/2026/08/12/wem-gehoert-die-stadt/',
      teaser:
        'Zehntausende Wohnungen, wenige Eigentümer. Eine Recherche über Konzerne, Briefkastenfirmen und die Frage, wer eine Stadt eigentlich besitzt.',
      author: 'Alex Beispiel',
      publishedAt: '2026-08-12T07:30:00.000Z',
      categories: ['Recherchen', 'Lokal'],
      imageUrl: 'https://correctiv.org/wp-content/uploads/2026/08/stadt-1024x576.jpg',
      readingMinutes: 9,
    },
  ),
  variant(
    'no-image',
    'The RSS path, which knows neither an image nor a reading time. The common case on that feed, and the one the hero has to fall back for.',
    {
      id: 'article-no-image',
      feed: 'klima',
      title: 'Ohne Bild und ohne Lesezeit, weil der RSS-Weg beides nicht kennt',
      url: 'https://correctiv.org/klima/2026/08/03/ohne-bild/',
      teaser: 'Der Fallback-Pfad liefert nur Titel, Teaser und Datum.',
      publishedAt: '2026-08-03T05:00:00.000Z',
      categories: ['Klima'],
      imageUrl: null,
    },
  ),
  variant(
    'factcheck-verdict',
    'A fact-check card, refuted. One of the two ordinary cards in the rail.',
    {
      id: 'article-factcheck-verdict',
      feed: 'faktencheck',
      title: 'Roboter greift Menschen an: Video ist inszeniert',
      url: 'https://correctiv.org/faktencheck/2026/07/29/roboter-greift-menschen-an/',
      teaser: 'Die Aufnahme stammt aus einem Werbespot.',
      publishedAt: '2026-07-29T09:00:00.000Z',
      categories: ['Faktencheck'],
      imageUrl: null,
    },
  ),
  variant(
    'factcheck-number',
    'A fact-check card whose verdict is a number that holds. The other ordinary card.',
    {
      id: 'article-factcheck-number',
      feed: 'faktencheck',
      title: 'Zahl der Windräder: Der Vergleich hinkt, die Zahl stimmt aber',
      url: 'https://correctiv.org/faktencheck/2026/07/21/windraeder/',
      teaser: 'Richtig gezählt, falsch verglichen.',
      publishedAt: '2026-07-21T11:15:00.000Z',
      categories: ['Faktencheck'],
      imageUrl: null,
    },
  ),
  variant(
    'long-title',
    'A title over three lines in a rail card, against a card that clamps at four. The rail is where this shows.',
    {
      id: 'article-long-title',
      feed: 'faktencheck',
      title:
        'Ein sehr langer Titel, der in einer schmalen Rail-Karte über drei Zeilen läuft und deshalb hier steht',
      url: 'https://correctiv.org/faktencheck/2026/07/02/langer-titel/',
      teaser: 'Umbruchverhalten im Rail.',
      publishedAt: '2026-07-02T08:00:00.000Z',
      categories: ['Faktencheck'],
      imageUrl: null,
    },
  ),
] as const satisfies readonly { name: string; note: string; data: FeedItem }[];

export const articleSamples = sampleDomain('articles', ARTICLE_VARIANTS);

/** Every name the articles domain has, as literals. */
export type ArticleSampleName = (typeof ARTICLE_VARIANTS)[number]['name'];
