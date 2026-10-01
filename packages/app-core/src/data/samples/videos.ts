/**
 * Video variants — `Video`, the shape a PeerTube or YouTube feed arrives in.
 *
 * The second model that had no offline constant, for the same reason as
 * `articles.ts`: `Video` is what `services/peertube.service.ts` and
 * `lib/rss-parse.ts` map a video into, and the gallery was the only place in the
 * repository that held one.
 *
 * The two variants are the two platforms rather than the two states, because the
 * platform is what the fields hang off: PeerTube answers a duration and a view
 * count, and the YouTube Atom feed answers neither, which is why
 * `Video.durationSec` and `Video.views` are optional and why `app/video.tsx`
 * has a message for a missing duration. Two of the three YouTube feeds in
 * `data/feeds.config.ts` answer 404 today (measured 2026-09-28), so this specimen
 * is the shape a source would answer in rather than one it currently does.
 */
import type { Video } from '../../types/models';

import { sampleDomain, variant } from './variant';

const VIDEO_VARIANTS = [
  variant(
    'peertube',
    'A PeerTube video with everything: thumbnail, duration, view count. What the FunFacts channel answers in.',
    {
      id: 'video-peertube',
      title: 'FunFacts, Folge 12: Was kostet ein Windrad wirklich?',
      url: 'https://tube.funfacts.de/w/video-peertube',
      thumbnailUrl: 'https://tube.funfacts.de/lazy-static/previews/video-peertube.jpg',
      publishedAt: '2026-08-28T16:00:00.000Z',
      channel: 'funfacts',
      source: 'peertube',
      durationSec: 512,
      views: 4211,
    },
  ),
  variant(
    'youtube',
    'A YouTube video: no duration and no view count, which is what the Atom feed carries. The card that prints a duration has nothing to print.',
    {
      id: 'video-youtube',
      title: 'Correctiv im Gespräch: Was die Recherche verändert',
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      thumbnailUrl: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg',
      publishedAt: '2026-08-21T09:00:00.000Z',
      channel: 'hauptkanal',
      source: 'youtube',
    },
  ),
] as const satisfies readonly { name: string; note: string; data: Video }[];

export const videoSamples = sampleDomain('videos', VIDEO_VARIANTS);

/** Every name the videos domain has, as literals. */
export type VideoSampleName = (typeof VIDEO_VARIANTS)[number]['name'];
