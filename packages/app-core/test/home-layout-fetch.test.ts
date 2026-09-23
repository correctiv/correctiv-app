import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/http', () => ({ fetchText: vi.fn() }));

import { configurePlatform, createMemoryPlatform, type ErrorReport } from '../src/ports';
import { fetchText } from '../src/services/http';
import {
  BUNDLED_FINGERPRINT,
  HOME_LAYOUT_FLOOR_MS,
  PERSISTED_KEYS,
  fetchedHomeLayout,
  homeLayoutActions,
  refreshHomeLayout,
} from '../src/stores/homeLayout';
import { persist, persisted } from '../src/stores/persist';
import { createAppStore, type AppStore } from '../src/stores/store';

/**
 * The app fetches its home document, keeps the last good copy and draws from it
 * (ADR 0036 §4, §5, §9, §10; ADR 0057 §4 for where it comes from).
 *
 * The address is a parameter, which is the host's half: nothing in the core knows where
 * the document is published, so these tests name one of their own.
 */
const URL = 'https://example.test/home.layout.json';

const fetchMock = vi.mocked(fetchText);
let store: AppStore;
let reports: ErrorReport[];

/** A document that is a layout, different from the bundled one so a test can tell. */
const GOOD = JSON.stringify({
  version: 2,
  sections: [
    { id: 'header', module: 'home-header' },
    { id: 'impact', module: 'impact-footer' },
  ],
  moments: [],
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-23T08:00:00.000Z'));
  store = createAppStore();
  fetchMock.mockReset();
  reports = [];
  configurePlatform({
    ...createMemoryPlatform(),
    errors: { report: (report) => reports.push(report) },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

function held(): string | null {
  return fetchedHomeLayout(store.getState().homeLayout);
}

describe('a document that is a layout', () => {
  it('is kept, and is what the selector hands the host', async () => {
    fetchMock.mockResolvedValue(GOOD);

    expect(await store.dispatch(refreshHomeLayout(URL))).toBe('stored');

    expect(fetchMock).toHaveBeenCalledWith(URL, expect.objectContaining({ browserAgent: false }));
    expect(held()).toBe(GOOD);
    expect(reports).toEqual([]);
  });

  /*
   * §7 draws past what it does not know, and the host reports those parts when it draws
   * the document. A report here as well would be every problem twice.
   */
  it('is kept with a part the parser drops, and the part is left for the host to report', async () => {
    const partial = JSON.stringify({
      version: 2,
      sections: [{ id: 'header', module: 'home-header', colour: 'red' }],
      moments: [],
    });
    fetchMock.mockResolvedValue(partial);

    expect(await store.dispatch(refreshHomeLayout(URL))).toBe('stored');
    expect(held()).toBe(partial);
    expect(reports).toEqual([]);
  });
});

describe('the floor between tries', () => {
  it('holds after a success', async () => {
    fetchMock.mockResolvedValue(GOOD);
    await store.dispatch(refreshHomeLayout(URL));

    vi.setSystemTime(Date.now() + HOME_LAYOUT_FLOOR_MS - 1);
    expect(await store.dispatch(refreshHomeLayout(URL))).toBe('too-soon');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('opens once the floor has passed', async () => {
    fetchMock.mockResolvedValue(GOOD);
    await store.dispatch(refreshHomeLayout(URL));

    vi.setSystemTime(Date.now() + HOME_LAYOUT_FLOOR_MS);
    expect(await store.dispatch(refreshHomeLayout(URL))).toBe('unchanged');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /*
   * The stamp is the attempt, not the success. Stamping only successes would have an
   * offline phone try on every return to the foreground, which is exactly the moment a
   * try can do no good.
   */
  it('holds after a failure too, because the attempt is what is stamped', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    expect(await store.dispatch(refreshHomeLayout(URL))).toBe('unreachable');

    vi.setSystemTime(Date.now() + 60_000);
    expect(await store.dispatch(refreshHomeLayout(URL))).toBe('too-soon');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is stamped before the request, so two calls at once make one request', async () => {
    fetchMock.mockResolvedValue(GOOD);
    const outcomes = await Promise.all([
      store.dispatch(refreshHomeLayout(URL)),
      store.dispatch(refreshHomeLayout(URL)),
    ]);
    expect(outcomes.sort()).toEqual(['stored', 'too-soon']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('a request that fails', () => {
  it('keeps the last good copy and reports nothing, because offline is not a fault', async () => {
    fetchMock.mockResolvedValue(GOOD);
    await store.dispatch(refreshHomeLayout(URL));

    vi.setSystemTime(Date.now() + HOME_LAYOUT_FLOOR_MS);
    fetchMock.mockRejectedValue(new Error('HTTP 404 for ' + URL));
    expect(await store.dispatch(refreshHomeLayout(URL))).toBe('unreachable');

    expect(held()).toBe(GOOD);
    expect(reports).toEqual([]);
  });
});

describe('a document that arrived and is not a layout', () => {
  /*
   * Reported, because the newsroom believes it filled the screen. The old copy stays,
   * which is §9's "falls back to the last copy that did".
   */
  it('is refused and reported, and the last good copy stays', async () => {
    fetchMock.mockResolvedValue(GOOD);
    await store.dispatch(refreshHomeLayout(URL));

    vi.setSystemTime(Date.now() + HOME_LAYOUT_FLOOR_MS);
    fetchMock.mockResolvedValue(JSON.stringify({ version: '2', sections: [] }));
    expect(await store.dispatch(refreshHomeLayout(URL))).toBe('rejected');

    expect(held()).toBe(GOOD);
    expect(reports).toEqual([
      { domain: 'layout', code: 'version-invalid', context: { type: 'string' } },
    ]);
  });

  it('is refused and reported when it is not JSON at all, as a code and a length', async () => {
    const page = '<!doctype html><title>Not found</title>';
    fetchMock.mockResolvedValue(page);

    expect(await store.dispatch(refreshHomeLayout(URL))).toBe('rejected');

    expect(held()).toBeNull();
    expect(reports).toEqual([
      { domain: 'layout', code: 'document-not-json', context: { length: page.length } },
    ]);
  });
});

describe('a copy fetched beside a different bundled document', () => {
  /*
   * An app update keeps its storage. Without the fingerprint the new build would open
   * on the copy the old one fetched, and the document the update shipped would lose to
   * it until the next fetch.
   */
  it('is ignored, so an app update is not overridden by a stale copy', () => {
    store.dispatch(homeLayoutActions.hydrate({ text: GOOD, bundled: 'an-older-build' }));
    expect(store.getState().homeLayout.text).toBe(GOOD);
    expect(held()).toBeNull();
  });

  it('is replaced by the next fetch, which is stamped with this build', async () => {
    store.dispatch(homeLayoutActions.hydrate({ text: GOOD, bundled: 'an-older-build' }));
    fetchMock.mockResolvedValue(GOOD);

    expect(await store.dispatch(refreshHomeLayout(URL))).toBe('stored');
    expect(store.getState().homeLayout.bundled).toBe(BUNDLED_FINGERPRINT);
    expect(held()).toBe(GOOD);
  });
});

describe('persistence', () => {
  /*
   * The copy goes through `persist()`, the store that holds what a reader chose, and
   * not through the blob cache: eviction there would take a phone back to the bundled
   * layout for no reason a reader could see.
   */
  it('writes the copy and its fingerprint, and a new store reads them back', async () => {
    const slices = [persisted('homeLayout', PERSISTED_KEYS, homeLayoutActions.hydrate)];
    vi.useRealTimers();
    await persist(store, slices);
    fetchMock.mockResolvedValue(GOOD);
    await store.dispatch(refreshHomeLayout(URL));
    await new Promise((resolve) => setTimeout(resolve, 300));

    const next = createAppStore();
    await persist(next, slices);
    expect(fetchedHomeLayout(next.getState().homeLayout)).toBe(GOOD);
    // The stamp is not persisted: a launch is a new process, and it fetches.
    expect(next.getState().homeLayout.triedAt).toBeNull();
  });

  it('ignores a stored payload that is not a string', () => {
    store.dispatch(homeLayoutActions.hydrate({ text: 42 as unknown as string, bundled: 'x' }));
    expect(store.getState().homeLayout.text).toBeNull();
  });
});
