import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { spotlightIssues as seed, type SpotlightIssue } from '../data/spotlight';
import { getCached, getStale, setCached } from '../services/cache.service';
import { fetchSpotlightIssues } from '../services/spotlight.service';
import type { AppThunk } from './store';

const CACHE_NS = 'spotlight';
/** Spotlight is a morning newsletter, so half an hour is already generous. */
const TTL_MS = 30 * 60 * 1000;
const COUNT = 12;

/**
 * How much of the archive is real, in the same three words the podcast slice uses.
 *
 * `offline` is the one that matters to a reader: it means these four issues are
 * the ones baked into the app, from the end of August 2026, and not this
 * morning's. A screen that shows them owes the reader that sentence.
 */
export type SpotlightStatus = 'idle' | 'loading' | 'ready' | 'offline';

export interface SpotlightState {
  issues: SpotlightIssue[];
  status: SpotlightStatus;
}

const initialState: SpotlightState = { issues: [], status: 'idle' };

/** Pure selectors — see the note in stores/interests.ts for why not part of the slice. */
export function latestIssue(state: SpotlightState): SpotlightIssue | null {
  return state.issues[0] ?? null;
}

/**
 * The issues Home's briefing card shows.
 *
 * Home's card is an index into recent days, so it takes the newest few. The count
 * is the caller's, because the card's height is a layout decision and this slice
 * has no business knowing it.
 */
export function recentIssues(state: SpotlightState, count: number): SpotlightIssue[] {
  return state.issues.slice(0, count);
}

const slice = createSlice({
  name: 'spotlight',
  initialState,
  reducers: {
    statusChanged(state, action: PayloadAction<SpotlightStatus>) {
      state.status = action.payload;
    },
    loaded(state, action: PayloadAction<{ issues: SpotlightIssue[]; status: SpotlightStatus }>) {
      state.issues = action.payload.issues;
      state.status = action.payload.status;
    },
  },
});

export const spotlightReducer = slice.reducer;
export const { statusChanged, loaded } = slice.actions;

/**
 * The archive: fresh cache → the network → stale cache → the bundled seed.
 *
 * One rung shorter than the feeds', because there is nothing to put in the middle:
 * a newsletter issue cannot be pre-extracted into the app bundle the way an
 * article can, so the `ContentBundle` port has no part in this and the four seeded
 * issues in `data/spotlight.ts` are the floor.
 *
 * The list is never empty, online or off, which is the same promise the feed and
 * podcast caches make.
 */
export const fetchIssues =
  (options: { force?: boolean } = {}): AppThunk<Promise<void>> =>
  async (dispatch, getState) => {
    const cached = options.force
      ? null
      : await getCached<SpotlightIssue[]>(CACHE_NS, 'all', TTL_MS);
    if (cached?.length) {
      dispatch(loaded({ issues: cached, status: 'ready' }));
      return;
    }
    if (getState().spotlight.issues.length === 0) dispatch(statusChanged('loading'));

    try {
      const issues = await fetchSpotlightIssues(COUNT);
      if (issues.length === 0) throw new Error('Spotlight archive returned nothing');
      dispatch(loaded({ issues, status: 'ready' }));
      await setCached(CACHE_NS, 'all', issues);
    } catch (err) {
      console.error('Spotlight failed:', err instanceof Error ? err.message : err);
      const stale = await getStale<SpotlightIssue[]>(CACHE_NS, 'all');
      dispatch(
        loaded(
          stale?.length ? { issues: stale, status: 'ready' } : { issues: seed, status: 'offline' },
        ),
      );
    }
  };
