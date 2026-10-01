import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { PODCAST_CHANNELS } from '../data/feeds.config';
import { podcastSeries as sampleSeries, type PodcastSeries } from '../data/podcasts';
import { platform } from '../ports';
import { getCached, getStale, setCached } from '../services/cache.service';
import { fetchPodcastSeries } from '../services/podcast.service';
import type { AppThunk } from './store';

const CACHE_NS = 'podcasts';
const TTL_MS = 60 * 60 * 1000;

/**
 * How much of the list is real.
 *
 * - `ready`   — every curated show came back live.
 * - `partial` — some shows failed; the list mixes live, cached and bundled entries.
 * - `offline` — nothing was reachable, this is the typed sample seed.
 *
 * An earlier store had one flag for the last two, and that is exactly the
 * distinction a demo needs to make: "a show is missing" is not the same as "you
 * are looking at sample data".
 */
export type PodcastsStatus = 'idle' | 'loading' | 'ready' | 'partial' | 'offline';

/**
 * What this store reports to the host, as a code rather than a sentence.
 *
 * The `AudioError` convention pointed at a machine instead of at a person
 * ([ADR 0032](../../../../adr/0032-a-port-for-the-error-report-before-a-provider-for-it.md)).
 * One member, and the union is here for the second one: `ErrorReport.code` is
 * typed `string` at the port, so without a named union at the call site a code is
 * a free-text string somebody types twice with two spellings.
 *
 * Nothing renders it and nothing should, which is why there is no labels record
 * beside it. A listener is told nothing about a show that did not come back; they
 * are shown the six that did.
 */
type PodcastsErrorCode = 'series-unreachable';

export interface PodcastsState {
  series: PodcastSeries[];
  status: PodcastsStatus;
}

const initialState: PodcastsState = { series: [], status: 'idle' };

/** Pure selector — see the note in stores/interests.ts for why not part of the slice. */
export function findSeries(state: PodcastsState, id: string): PodcastSeries | null {
  return state.series.find((s) => s.id === id) ?? null;
}

const slice = createSlice({
  name: 'podcasts',
  initialState,
  reducers: {
    statusChanged(state, action: PayloadAction<PodcastsStatus>) {
      state.status = action.payload;
    },
    loaded(state, action: PayloadAction<{ series: PodcastSeries[]; status: PodcastsStatus }>) {
      state.series = action.payload.series;
      state.status = action.payload.status;
    },
  },
});

export const podcastsReducer = slice.reducer;
export const { statusChanged, loaded } = slice.actions;

/**
 * The Salon5 podcast library (Castopod).
 *
 * Cascade, deliberately explicit: fresh cache → the seven curated shows live,
 * each falling back to the host's bundled snapshot → stale cache → typed sample
 * seed. The list is never empty, online or off — the same promise the feed cache
 * makes.
 *
 * The per-show bundled snapshot reaches the core through the `ContentBundle`
 * port, so every host can offer it and none needs a store of its own to do it.
 */
export const fetchAll =
  (options: { force?: boolean } = {}): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const cached = options.force ? null : await getCached<PodcastSeries[]>(CACHE_NS, 'all', TTL_MS);
    if (cached?.length) {
      dispatch(loaded({ series: cached, status: 'ready' }));
      return;
    }
    if (getState().podcasts.series.length === 0) dispatch(statusChanged('loading'));

    let liveCount = 0;
    const results = await Promise.all(
      PODCAST_CHANNELS.map(async (handle) => {
        try {
          const series = await fetchPodcastSeries(handle);
          liveCount += 1;
          return series;
        } catch (err) {
          const bundled = platform().content.podcastSeries(handle);
          /**
           * The one fault in this cascade that nobody hears about, which is why
           * it is the core's first call through `ErrorReporter`.
           *
           * Everything else here is visible somewhere: an unreachable library
           * shows `offline` and the Mediathek prints a line about it. A single
           * show that 502s shows nothing. It is swallowed by this `catch`, the
           * bundled snapshot takes its place or the tile disappears, and the
           * status goes to `partial` — which no screen in the app reads. There
           * was no log either, so Castopod could drop a show for a week and the
           * only trace would be one missing tile on a grid of seven.
           *
           * The context is the two things already in hand: which show, and
           * whether anything took its place. `replacedBy` is what separates
           * "somebody is looking at last week's episodes" from "the show is
           * simply gone from the app", and neither is legible from the handle.
           */
          const code: PodcastsErrorCode = 'series-unreachable';
          platform().errors.report({
            domain: 'podcasts',
            code,
            context: { handle, replacedBy: bundled ? 'bundle' : 'nothing' },
            cause: err,
          });
          return bundled;
        }
      }),
    );
    const series = results.filter((s): s is PodcastSeries => !!s && s.episodes.length > 0);

    if (series.length > 0) {
      // The status describes what is on screen, not how many requests succeeded:
      // a show whose feed parsed but carried no episodes is just as missing as one
      // that timed out, and an empty tile is worse than no tile.
      dispatch(
        loaded({
          series,
          status: series.length === PODCAST_CHANNELS.length ? 'ready' : 'partial',
        }),
      );
      // Only cache when at least one show is live: caching a bundle-only list
      // would freeze the offline state in for a whole hour after the network came back.
      if (liveCount > 0) await setCached(CACHE_NS, 'all', series);
      return;
    }

    // Nothing reachable. Stale beats nothing, and the seed beats an empty screen.
    const stale = await getStale<PodcastSeries[]>(CACHE_NS, 'all');
    dispatch(
      loaded({
        series: stale?.length ? stale : sampleSeries,
        status: stale?.length ? 'partial' : 'offline',
      }),
    );
  };
