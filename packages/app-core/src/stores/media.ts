import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { MEDIA_SOURCE, PEERTUBE_CHANNELS, YOUTUBE_FEEDS } from '../data/feeds.config';
import { getCached, getStale, setCached } from '../services/cache.service';
import { fetchPeertubeChannelsAsVideos } from '../services/peertube.service';
import { fetchYoutubeFeed } from '../services/rss.service';
import type { Video } from '../types/models';
import type { AppThunk } from './store';

const TTL_MS = 30 * 60 * 1000;

export type YoutubeKey = keyof typeof YOUTUBE_FEEDS;

export interface VideoListState {
  videos: Video[];
  status: 'idle' | 'loading' | 'ready' | 'error';
}

export interface MediaState {
  byKey: Record<YoutubeKey, VideoListState>;
}

const initialState: MediaState = {
  byKey: {
    gespraech: { videos: [], status: 'idle' },
    funfacts: { videos: [], status: 'idle' },
    hauptkanal: { videos: [], status: 'idle' },
  },
};

const slice = createSlice({
  name: 'media',
  initialState,
  reducers: {
    /**
     * Replaces one channel's slice.
     *
     * Immer patches in place, so the OTHER channels keep their object identity —
     * which is what lets a component select `byKey[key]` directly. If this ever
     * rebuilt all three slices per update, every such selector would return a
     * fresh object per render and React would throw the getSnapshot loop error.
     */
    patch: {
      reducer(state, action: PayloadAction<{ key: YoutubeKey; slice: Partial<VideoListState> }>) {
        Object.assign(state.byKey[action.payload.key], action.payload.slice);
      },
      prepare: (key: YoutubeKey, slice: Partial<VideoListState>) => ({ payload: { key, slice } }),
    },
  },
});

export const mediaReducer = slice.reducer;
export const { patch } = slice.actions;

/**
 * A channel's videos, from wherever that channel streams.
 *
 * `MEDIA_SOURCE` is the declared truth about where a channel streams from, so it
 * decides the branch. Reading the branch off "does the PeerTube table have an
 * entry" instead would make a forgotten config line look like a YouTube channel
 * and fetch the wrong thing quietly.
 *
 * The cast this replaces (`PEERTUBE_CHANNELS[key as keyof typeof …]`) was
 * load-bearing and wrong: `key` is one of three channels and the PeerTube table
 * held one, so the cast promised a handle for `gespraech` too and would have
 * answered `undefined` for it. A `Partial<Record<…>>` plus this check says the
 * same thing honestly, and the error names the missing entry instead of
 * requesting `/video-channels/undefined/videos`.
 */
async function fetchVideos(key: YoutubeKey): Promise<Video[]> {
  if (MEDIA_SOURCE[key] !== 'peertube') return fetchYoutubeFeed(YOUTUBE_FEEDS[key], key);

  const channels = PEERTUBE_CHANNELS[key];
  if (!channels?.length) {
    throw new Error(`Channel '${key}' is peertube-sourced but has no channel handle`);
  }
  return fetchPeertubeChannelsAsVideos(channels);
}

/** One media channel, cache-first with a stale fallback. */
export const fetchChannel =
  (key: YoutubeKey): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const source = MEDIA_SOURCE[key];
    const cached = await getCached<Video[]>(source, key, TTL_MS);
    if (cached) {
      dispatch(patch(key, { videos: cached, status: 'ready' }));
      return;
    }
    if (getState().media.byKey[key].videos.length === 0)
      dispatch(patch(key, { status: 'loading' }));
    try {
      const videos = await fetchVideos(key);
      dispatch(patch(key, { videos, status: 'ready' }));
      await setCached(source, key, videos);
    } catch (err) {
      console.error(
        `Media feed '${key}' (${source}) failed:`,
        err instanceof Error ? err.message : err,
      );
      const stale = await getStale<Video[]>(source, key);
      if (stale) dispatch(patch(key, { videos: stale, status: 'ready' }));
      else dispatch(patch(key, { status: 'error' }));
    }
  };
