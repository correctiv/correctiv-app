import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { parseHomeLayout, reportLayoutProblems } from '../lib/home-layout';
import { platform } from '../ports';
import { fetchTextResponse } from '../services/http';
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
 * renderable modules, and reports what it drew past; this slice decides whether a
 * document is good enough to keep, and `fetchedHomeLayout` whether it is new enough to
 * draw.
 */
export interface HomeLayoutState {
  /** The last fetched document that was good enough to keep, as it arrived. */
  text: string | null;
  /**
   * When that document was published, in ms since the epoch: its `last-modified`.
   * See `fetchedHomeLayout` for what it is compared with.
   */
  publishedAt: number | null;
  /**
   * When the last try STARTED, successful or not, in ms since the epoch.
   *
   * Not persisted. A launch is a new process and §5 says it fetches; the floor is about
   * a reader switching apps inside one. Being in this slice costs no write:
   * `persist()` writes a slice only when one of its declared keys changed.
   */
  triedAt: number | null;
}

const initialState: HomeLayoutState = { text: null, publishedAt: null, triedAt: null };

/** What `persist()` writes back. `triedAt` is left out, and its own comment says why. */
export const PERSISTED_KEYS = ['text', 'publishedAt'] satisfies Array<keyof HomeLayoutState>;

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
 * The largest body this will read: 256 KiB.
 *
 * The shipped document is about 1 KiB (1,058 bytes on 2026-09-23), so this is two
 * hundred and fifty times what it needs today and room for the editions ADR 0059 plans.
 * What it bounds is not the parse but the storage: a kept copy is persisted, and on the
 * web target `persist()` writes into `localStorage`, whose quota of a few megabytes is
 * shared with every other slice. A body beyond this is not a home screen somebody
 * wrote; it is an error page or a mistake, and it is refused before it is parsed.
 */
export const HOME_LAYOUT_MAX_CHARS = 256 * 1024;

/**
 * The fetched document to draw, or null when the bundled one should be drawn instead.
 *
 * **A fetched copy is drawn only when it is not older than the build.** `builtAt` is
 * when the host's bundle was made, and `publishedAt` the published file's
 * `last-modified`, which GitHub Pages sets to the deploy time: every file of the site
 * carried the same second, a few seconds before the deploy job ended, measured on
 * 2026-09-23. That one comparison covers each way an older document could beat the
 * newer one a build carries:
 *
 * - a release built from `main` after the last Pages deploy, or an app update that
 *   keeps the copy the previous build fetched;
 * - the web target in the ten minutes after a deploy, while the CDN still serves the
 *   file the deploy replaced (`max-age=600`);
 * - a local production export of a branch that edits `home.layout.json`, which is
 *   exactly what AGENTS.md says to open to check such an edit. Built now, it predates
 *   no deploy, so it shows the edit and not `main`'s copy.
 *
 * Why the deploy's date and not a revision written into the document: a stamp inside
 * the file would be one more key in the grammar that every editor has to carry and
 * that the deploy would have to rewrite, and a local export's working tree has no
 * commit to stamp. The date is already on the response, and the build time is one
 * constant the host sets at build.
 *
 * What it cannot see: a build made from something other than `main` after a deploy of
 * an older `main` would lose to that deploy. Releases are built from `main`.
 *
 * A copy with no date is not drawn, because nothing says which is newer.
 */
export function fetchedHomeLayout(state: HomeLayoutState, builtAt: number): string | null {
  if (state.text === null || state.publishedAt === null) return null;
  return state.publishedAt >= builtAt ? state.text : null;
}

/**
 * Whether the floor still holds at `now`: true means a try would be too soon.
 *
 * A stamp in the future counts as expired. A clock set back after a try would otherwise
 * hold the floor for however far it went back, which on a phone whose date was wrong is
 * up to a day of a home screen that never refreshes.
 */
export function withinFloor(state: HomeLayoutState, now: number): boolean {
  if (state.triedAt === null || now < state.triedAt) return false;
  return now - state.triedAt < HOME_LAYOUT_FLOOR_MS;
}

const slice = createSlice({
  name: 'homeLayout',
  initialState,
  reducers: {
    tried(state, action: PayloadAction<number>) {
      state.triedAt = action.payload;
    },
    received(state, action: PayloadAction<{ text: string; publishedAt: number }>) {
      state.text = action.payload.text;
      state.publishedAt = action.payload.publishedAt;
    },

    /**
     * Applied by persist() at startup — see stores/persist.ts.
     *
     * Checked rather than assigned, unlike the settings-sized slices beside it: this one
     * is a document from somewhere else stored as a string, and a payload that is not a
     * string would reach `JSON.parse` in the host on the first render.
     */
    hydrate(state, action: PayloadAction<Partial<HomeLayoutState>>) {
      const { text, publishedAt } = action.payload;
      if (typeof text === 'string' && typeof publishedAt === 'number') {
        state.text = text;
        state.publishedAt = publishedAt;
      }
    },
  },
});

export const homeLayoutReducer = slice.reducer;
export const homeLayoutActions = slice.actions;

/**
 * The faults this file reports on its own, before or beside the parser's.
 *
 * `layout` codes are otherwise the parser's (`LayoutProblemCode`); these live beside
 * what dispatches them, which is the port's rule.
 *
 * - `document-too-large`: a body over `HOME_LAYOUT_MAX_CHARS`, refused unread.
 * - `document-undated`: no readable `last-modified`, so nothing says whether it is
 *   newer than the build. A host serving the document without one is misconfigured.
 * - `document-not-json`: a body that is not JSON at all.
 * - `document-draws-nothing`: a document this app would draw as an empty screen.
 */
export type HomeLayoutFetchCode =
  | 'document-too-large'
  | 'document-undated'
  | 'document-not-json'
  | 'document-draws-nothing';

/** What one call did, for a caller or a test that wants to know without reading state. */
export type HomeLayoutRefresh =
  | 'too-soon'
  | 'unreachable'
  | 'older-than-bundle'
  | 'rejected'
  | 'unchanged'
  | 'stored';

export interface RefreshHomeLayoutOptions {
  /** When the host's bundle was built, in ms since the epoch. */
  builtAt: number;
  /** The module names the host holds a renderer for (ADR 0036 §14). */
  renderable: ReadonlySet<string>;
}

function report(code: HomeLayoutFetchCode, context: Record<string, number>): void {
  platform().errors.report({ domain: 'layout', code, context });
}

/**
 * Fetch the home document and keep it if it is a layout this app can draw.
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
 *    `fetchTextResponse` throws like any other status; what guards against the file
 *    being missing is the deploy, which refuses to publish without it.
 * 3. **Too large, then undated, then older than the build.** The first two are
 *    reported. The third is not: it is what every phone sees between an app update and
 *    the next deploy, and it is kept out of storage rather than drawn past, because a
 *    copy older than the bundle is never drawn anyway (`fetchedHomeLayout`).
 * 4. **A body that arrived and is not a layout, or that draws nothing, IS a report**,
 *    because the newsroom believes it filled the screen and a reader is looking at an
 *    older one. Both ends validate (§9), and this is the app's end. The old copy stays.
 *
 *    "Draws nothing" is judged against the host's `renderable` set and not only the
 *    grammar: a document of sections that all name modules this app has never heard of
 *    parses, and is an empty home screen here all the same. So is
 *    `{"version":2,"sections":[]}`. The line is drawn at NOTHING rather than at the
 *    first problem, because §7 wants a document that is ahead of the app drawn past,
 *    and that document always has problems for an older app. What §7 does not want is
 *    a screen with nothing on it replacing a screen with something on it. The parse's
 *    own problems are reported beside the refusal, since this document never reaches
 *    the host that would otherwise report them.
 *
 *    One false report is known and accepted: a captive portal that answers 200 with its
 *    own page reads here as a document that is not JSON, or as one without a date.
 * 5. **A document that is kept may still have parts that are not**: §7 draws past what
 *    it does not know, and the host reports those parts when it draws it. Reporting
 *    them here as well would report every one twice.
 *
 * The request carries no browser user agent, for the reason `fetchText` gives for a
 * JSON API: a header a page cannot set only invites a preflight.
 */
export const refreshHomeLayout =
  (
    url: string,
    { builtAt, renderable }: RefreshHomeLayoutOptions,
  ): AppThunk<Promise<HomeLayoutRefresh>> =>
  async (dispatch, getState) => {
    const now = Date.now();
    if (withinFloor(getState().homeLayout, now)) return 'too-soon';
    dispatch(slice.actions.tried(now));

    let response;
    try {
      response = await fetchTextResponse(url, {
        browserAgent: false,
        headers: { Accept: 'application/json' },
      });
    } catch {
      return 'unreachable';
    }
    const text = response.body;

    if (text.length > HOME_LAYOUT_MAX_CHARS) {
      report('document-too-large', { length: text.length });
      return 'rejected';
    }

    const publishedAt = Date.parse(response.header('last-modified') ?? '');
    if (!Number.isFinite(publishedAt)) {
      report('document-undated', { length: text.length });
      return 'rejected';
    }
    if (publishedAt < builtAt) return 'older-than-bundle';

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      report('document-not-json', { length: text.length });
      return 'rejected';
    }

    const { layout, problems } = parseHomeLayout(body, renderable);
    if (!layout || layout.sections.length === 0) {
      reportLayoutProblems(problems);
      report('document-draws-nothing', { problems: problems.length });
      return 'rejected';
    }

    const held = getState().homeLayout;
    if (held.text === text && held.publishedAt === publishedAt) return 'unchanged';
    dispatch(slice.actions.received({ text, publishedAt }));
    return 'stored';
  };
