import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { homeLayoutDocument, parseHomeLayout, reportLayoutProblems } from '../lib/home-layout';
import { platform } from '../ports';
import { fetchText } from '../services/http';
import type { AppThunk } from './store';

/**
 * The home document as the app last fetched it
 * ([ADR 0036](../../../../adr/0036-the-home-screen-becomes-data.md) §4, §5, §9, §10).
 *
 * The app fetches its layout, keeps the last good copy and draws from that copy. Where
 * the copy comes from is ADR 0057 §4: the same file the core bundles,
 * `data/home.layout.json`, published beside the site by the Pages deploy, at an address
 * the HOST holds. So the address is a parameter of the thunk below and is typed nowhere
 * in this package; the core knows how to fetch a layout, not where a given app keeps one.
 *
 * What this slice holds is TEXT, not a parsed layout. The text is what says whether the
 * document changed, which is the question the host asks on every render before it
 * decides to parse again, and a parsed layout would be a second copy of the same fact
 * that could disagree with the first. The host parses what it draws, with its own set of
 * renderable modules, and reports what it drew past; this slice only decides whether a
 * document is good enough to keep.
 *
 * The floor between tries, the stale rule and what is reported are argued where each
 * one is written.
 */
export interface HomeLayoutState {
  /** The last fetched document that parsed into a layout, as it arrived. */
  text: string | null;
  /**
   * `BUNDLED_FINGERPRINT` as it was when `text` was stored — which bundled document the
   * copy was fetched beside. See `fetchedHomeLayout`.
   */
  bundled: string | null;
  /**
   * When the last try STARTED, successful or not, in ms since the epoch.
   *
   * Not persisted, on purpose. A launch is a new process and §5 says it fetches; the
   * floor is about a reader switching apps inside one, and a launch within ten minutes
   * of the last costs one request the CDN answers from its cache.
   */
  triedAt: number | null;
}

const initialState: HomeLayoutState = { text: null, bundled: null, triedAt: null };

/** What `persist()` writes back. `triedAt` is left out, and its own comment says why. */
export const PERSISTED_KEYS = ['text', 'bundled'] satisfies Array<keyof HomeLayoutState>;

/**
 * The floor between two tries: ten minutes.
 *
 * Not a guess, a reading of the host that serves the document. GitHub Pages answers
 * `https://correctiv.github.io/correctiv-app/…` with `cache-control: max-age=600`,
 * measured on 2026-09-23, so for ten minutes after one fetch the CDN hands every later
 * one the same copy. A shorter floor buys a request and not a newer document; a longer
 * one only makes a newsroom's edit reach a reader later than the CDN would allow.
 *
 * If the document ever moves to a host with a different cache lifetime, this number
 * moves with it, and the measurement above is what to re-take.
 */
export const HOME_LAYOUT_FLOOR_MS = 10 * 60 * 1000;

/**
 * A short fingerprint of a text: FNV-1a, 32 bits, as hex.
 *
 * Not a security property and not asked to be one. It tells one bundled document from
 * the next, which is a question about accidental difference between two files somebody
 * edited, and eight hex digits answer it without a dependency.
 */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Which bundled document this build carries.
 *
 * Taken from the parsed JSON re-serialised rather than from the file's bytes, because
 * the bundler hands the core an object and not the file. Two builds of the same document
 * serialise alike; a changed document does not, which is all the stale rule needs.
 */
export const BUNDLED_FINGERPRINT = fingerprint(JSON.stringify(homeLayoutDocument));

/**
 * The fetched document to draw, or null when there is none worth drawing.
 *
 * **An app update is not overridden by the copy the previous build fetched.** A phone
 * that updates keeps its storage, so without this the new build would open on a
 * document fetched beside the OLD bundle — possibly one written for modules the update
 * renamed, and at best a document the update's own default had already replaced. A copy
 * stored beside a different bundled document is ignored until the next fetch replaces
 * it, and until then the bundle this build shipped is what Home draws, which is §10's
 * floor doing exactly its job.
 *
 * A selector taking state, per the core's rule, and the only reading of `text` a host
 * should make: the raw field does not know which build it is in.
 */
export function fetchedHomeLayout(state: HomeLayoutState): string | null {
  return state.bundled === BUNDLED_FINGERPRINT ? state.text : null;
}

/** Whether the floor still holds at `now`: true means a try would be too soon. */
export function withinFloor(state: HomeLayoutState, now: number): boolean {
  return state.triedAt !== null && now - state.triedAt < HOME_LAYOUT_FLOOR_MS;
}

const slice = createSlice({
  name: 'homeLayout',
  initialState,
  reducers: {
    tried(state, action: PayloadAction<number>) {
      state.triedAt = action.payload;
    },
    received(state, action: PayloadAction<{ text: string; bundled: string }>) {
      state.text = action.payload.text;
      state.bundled = action.payload.bundled;
    },

    /**
     * Applied by persist() at startup — see stores/persist.ts.
     *
     * Checked rather than assigned, unlike the settings-sized slices beside it: this one
     * is a document from somewhere else stored as a string, and a payload that is not a
     * string would reach `JSON.parse` in the host on the first render.
     */
    hydrate(state, action: PayloadAction<Partial<HomeLayoutState>>) {
      const { text, bundled } = action.payload;
      if (typeof text === 'string' && typeof bundled === 'string') {
        state.text = text;
        state.bundled = bundled;
      }
    },
  },
});

export const homeLayoutReducer = slice.reducer;
export const homeLayoutActions = slice.actions;

/**
 * The code for the one fault this file reports on its own.
 *
 * `layout` codes are otherwise the parser's (`LayoutProblemCode`); this is the fault
 * before a parse, a body that is not JSON at all, and it lives beside what dispatches
 * it, which is the port's rule.
 */
export type HomeLayoutFetchCode = 'document-not-json';

/** What one call did, for a caller or a test that wants to know without reading state. */
export type HomeLayoutRefresh = 'too-soon' | 'unreachable' | 'rejected' | 'unchanged' | 'stored';

/**
 * Fetch the home document and keep it if it is a layout.
 *
 * In order, and each step is a decision:
 *
 * 1. **The floor, then the stamp.** The attempt is stamped BEFORE the request, so a
 *    failure holds the floor as firmly as a success does. Stamping only successes would
 *    make an offline phone try on every return to the foreground, which is the
 *    hammering §5 puts the floor there to prevent, aimed at the one moment it can do
 *    no good.
 * 2. **A failed request is not a report.** A phone without a network is the normal
 *    case, not a fault, and neither is a CDN hiccup. That includes a 404, which
 *    `fetchText` throws like any other status; what guards against the file being
 *    missing is the deploy, which refuses to publish without it.
 * 3. **A body that arrived and is not a layout IS a report**, because the newsroom
 *    believes it filled the screen and a reader is looking at an older one. Both ends
 *    validate (§9), and this is the app's end. The old copy stays. One false report
 *    is known and accepted: a captive portal that answers 200 with its own page reads
 *    here as a document that is not JSON, and nothing in a response tells the two
 *    apart that a portal could not also imitate.
 * 4. **A document that is a layout is kept**, even when parts of it are not: §7 draws
 *    past what it does not know, and the host reports those parts when it draws it,
 *    once per document. Reporting them here as well would report every one twice.
 *
 * The request carries no browser user agent, for the reason `fetchText` gives for a
 * JSON API: a header a page cannot set only invites a preflight.
 */
export const refreshHomeLayout =
  (url: string): AppThunk<Promise<HomeLayoutRefresh>> =>
  async (dispatch, getState) => {
    const now = Date.now();
    if (withinFloor(getState().homeLayout, now)) return 'too-soon';
    dispatch(slice.actions.tried(now));

    let text: string;
    try {
      text = await fetchText(url, {
        browserAgent: false,
        headers: { Accept: 'application/json' },
      });
    } catch {
      return 'unreachable';
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      const code: HomeLayoutFetchCode = 'document-not-json';
      platform().errors.report({ domain: 'layout', code, context: { length: text.length } });
      return 'rejected';
    }

    const { layout, problems } = parseHomeLayout(body);
    if (!layout) {
      reportLayoutProblems(problems);
      return 'rejected';
    }

    const held = getState().homeLayout;
    if (held.text === text && held.bundled === BUNDLED_FINGERPRINT) return 'unchanged';
    dispatch(slice.actions.received({ text, bundled: BUNDLED_FINGERPRINT }));
    return 'stored';
  };
