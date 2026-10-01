/**
 * Podcast series variants — the cases a series screen has to draw.
 *
 * The shipped four are the offline seed `data/podcasts.ts` falls back to, and the
 * gallery draws the first of them for `SeriesTile`. What the seed has no example
 * of is a series with nothing in it, which is what a live Castopod show looks
 * like on the day it is announced, and a title long enough to run over the lines
 * a tile gives it.
 *
 * **No cover variant, and the reason is the same as for callouts.** The four
 * shipped series carry no `imageUrl` at all — the field is documented as coming
 * from Castopod's `itunes:image`, which the offline seed does not have — so the
 * "no cover" case is already the shape of the whole set. A variant that varied
 * it would need an invented image address, and a specimen whose image 404s is a
 * worse specimen than one that draws the fallback.
 */
import { podcastSeries, type PodcastSeries } from '../podcasts';

import { sampleDomain, variant } from './variant';

const SERIES_VARIANTS = [
  variant(
    'default',
    'The CORRECTIV Podcast as the seed ships it: two episodes, no cover. What the gallery draws for SeriesTile.',
    podcastSeries[0],
  ),
  variant(
    'no-episodes',
    'A series that has published nothing yet: the list a series screen draws while it is empty.',
    {
      id: 'correctiv-podcast-kuenftig',
      title: 'CORRECTIV Podcast, ab Herbst',
      publisher: 'CORRECTIV',
      description: 'Eine neue Staffel ist angekündigt und hat noch keine Folge.',
      episodes: [],
    },
  ),
  variant(
    'long-text',
    'A title and a description over the lines a tile and a series header give them.',
    {
      id: 'recherchen-lang',
      title:
        'Die Recherche, die niemand bestellt hat: eine sehr lange Folge über Konzerne, Briefkastenfirmen und die Frage, wer eine Stadt besitzt',
      publisher: 'CORRECTIV',
      description:
        'Diese Beschreibung läuft über mehrere Zeilen, damit der Kopf einer Serie etwas zu umbrechen hat, das nicht der Titel ist und deshalb die Höhe der Karte verändert.',
      episodes: [
        {
          id: 'rl-1',
          title: 'Die Folge, die erstmal nur erklärt',
          date: '2026-06-01T06:00:00+02:00',
          durationLabel: '52 Min.',
          audio: 'assets/audio/sample-episode.mp3',
        },
      ],
    },
  ),
] as const satisfies readonly { name: string; note: string; data: PodcastSeries }[];

export const podcastSamples = sampleDomain('podcasts', SERIES_VARIANTS);

/** Every name the podcasts domain has, as literals. */
export type PodcastSampleName = (typeof SERIES_VARIANTS)[number]['name'];
