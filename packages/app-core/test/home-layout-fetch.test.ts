import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/http', () => ({ fetchTextResponse: vi.fn() }));

import { configurePlatform, createMemoryPlatform, type ErrorReport } from '../src/ports';
import { fetchTextResponse } from '../src/services/http';
import {
  HOME_LAYOUT_FLOOR_MS,
  HOME_LAYOUT_MAX_CHARS,
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
 * The address, the build time and the modules a host can draw are the host's, so these
 * tests name their own.
 */
const URL = 'https://example.test/home.layout.json';
const NOW = Date.parse('2026-09-23T08:00:00.000Z');
/** This build, an hour before the tests' clock. */
const BUILT_AT = NOW - 60 * 60 * 1000;
/** A deploy after this build, and one before it. */
const AFTER_BUILD = 'Wed, 23 Sep 2026 07:30:00 GMT';
const BEFORE_BUILD = 'Wed, 23 Sep 2026 06:30:00 GMT';
const RENDERABLE = new Set(['home-header', 'impact-footer']);
const OPTIONS = { builtAt: BUILT_AT, renderable: RENDERABLE };

const fetchMock = vi.mocked(fetchTextResponse);
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

/** The response the host would get, with the date Pages would put on it. */
function answer(body: string, lastModified: string | null = AFTER_BUILD) {
  fetchMock.mockResolvedValue({
    body,
    header: (name: string) => (name.toLowerCase() === 'last-modified' ? lastModified : null),
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
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

const refresh = () => store.dispatch(refreshHomeLayout(URL, OPTIONS));

function held(): string | null {
  return fetchedHomeLayout(store.getState().homeLayout, BUILT_AT);
}

/** Past the floor, so the next refresh fetches. */
function later() {
  vi.setSystemTime(Date.now() + HOME_LAYOUT_FLOOR_MS);
}

describe('a document that is a layout', () => {
  it('is kept, and is what the selector hands the host', async () => {
    answer(GOOD);

    expect(await refresh()).toBe('stored');

    expect(fetchMock).toHaveBeenCalledWith(URL, expect.objectContaining({ browserAgent: false }));
    expect(held()).toBe(GOOD);
    expect(store.getState().homeLayout.publishedAt).toBe(Date.parse(AFTER_BUILD));
    expect(reports).toEqual([]);
  });

  /*
   * §7 draws past what it does not know, and the host reports those parts when it draws
   * the document. A report here as well would be every problem twice.
   */
  it('is kept with a part the app cannot draw, and the part is left for the host to report', async () => {
    const ahead = JSON.stringify({
      version: 2,
      sections: [
        { id: 'header', module: 'home-header' },
        { id: 'quiz', module: 'quiz-of-the-day' },
      ],
      moments: [],
    });
    answer(ahead);

    expect(await refresh()).toBe('stored');
    expect(held()).toBe(ahead);
    expect(reports).toEqual([]);
  });
});

describe('the floor between tries', () => {
  it('holds after a success', async () => {
    answer(GOOD);
    await refresh();

    vi.setSystemTime(Date.now() + HOME_LAYOUT_FLOOR_MS - 1);
    expect(await refresh()).toBe('too-soon');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('opens once the floor has passed', async () => {
    answer(GOOD);
    await refresh();

    later();
    expect(await refresh()).toBe('unchanged');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /*
   * The stamp is the attempt, not the success. Stamping only successes would have an
   * offline phone try on every return to the foreground, which is exactly the moment a
   * try can do no good.
   */
  it('holds after a failure too, because the attempt is what is stamped', async () => {
    fetchMock.mockRejectedValue(new Error('Network request failed'));
    expect(await refresh()).toBe('unreachable');

    vi.setSystemTime(Date.now() + 60_000);
    expect(await refresh()).toBe('too-soon');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is stamped before the request, so two calls at once make one request', async () => {
    answer(GOOD);
    const outcomes = await Promise.all([refresh(), refresh()]);
    expect(outcomes.sort()).toEqual(['stored', 'too-soon']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /*
   * A clock set back after a try would otherwise hold the floor for as far as it went
   * back, a day on a phone whose date was wrong.
   */
  it('counts a stamp in the future as expired, so a clock set back does not stall it', async () => {
    answer(GOOD);
    await refresh();

    vi.setSystemTime(NOW - 24 * 60 * 60 * 1000);
    expect(await refresh()).toBe('unchanged');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('a request that fails', () => {
  it('keeps the last good copy and reports nothing, because offline is not a fault', async () => {
    answer(GOOD);
    await refresh();

    later();
    fetchMock.mockRejectedValue(new Error('HTTP 404 for ' + URL));
    expect(await refresh()).toBe('unreachable');

    expect(held()).toBe(GOOD);
    expect(reports).toEqual([]);
  });
});

describe('a document that is worse than the copy it would replace', () => {
  /*
   * Each of these came back 'stored' with no report in an earlier version, and the first
   * two gave an empty Home on every phone. Refused, reported, and the good copy stays:
   * §9's "falls back to the last copy that did".
   */
  const worse: [string, unknown, ErrorReport[]][] = [
    [
      'no sections at all',
      { version: 2, sections: [] },
      [{ domain: 'layout', code: 'document-draws-nothing', context: { problems: 0 } }],
    ],
    [
      'a version from the future and no sections',
      { version: 99, sections: [] },
      [
        { domain: 'layout', code: 'version-unknown', context: { version: 99, expected: 2 } },
        { domain: 'layout', code: 'document-draws-nothing', context: { problems: 1 } },
      ],
    ],
    [
      'sections that are not sections',
      { version: 2, sections: [1, 2, { id: 'x' }] },
      [
        { domain: 'layout', code: 'section-not-an-object', context: { index: 0, type: 'number' } },
        { domain: 'layout', code: 'section-not-an-object', context: { index: 1, type: 'number' } },
        {
          domain: 'layout',
          code: 'section-module-invalid',
          context: { id: 'x', type: 'undefined' },
        },
        { domain: 'layout', code: 'document-draws-nothing', context: { problems: 3 } },
      ],
    ],
    [
      'only modules this app cannot draw',
      { version: 2, sections: [{ id: 'quiz', module: 'quiz-of-the-day' }], moments: [] },
      [
        {
          domain: 'layout',
          code: 'module-unrecognised',
          context: { id: 'quiz', module: 'quiz-of-the-day' },
        },
        { domain: 'layout', code: 'document-draws-nothing', context: { problems: 1 } },
      ],
    ],
    [
      'a version that is not a number',
      { version: '2', sections: [] },
      [
        { domain: 'layout', code: 'version-invalid', context: { type: 'string' } },
        { domain: 'layout', code: 'document-draws-nothing', context: { problems: 1 } },
      ],
    ],
    [
      'the literal null',
      null,
      [
        { domain: 'layout', code: 'document-not-an-object', context: { type: 'null' } },
        { domain: 'layout', code: 'document-draws-nothing', context: { problems: 1 } },
      ],
    ],
  ];

  it.each(worse)('is refused and reported: %s', async (_, document, expected) => {
    answer(GOOD);
    await refresh();

    later();
    answer(JSON.stringify(document));
    expect(await refresh()).toBe('rejected');

    expect(held()).toBe(GOOD);
    expect(reports).toEqual(expected);
  });

  it('is refused and reported when it is not JSON at all, as a code and a length', async () => {
    const page = '<!doctype html><title>Not found</title>';
    answer(page);

    expect(await refresh()).toBe('rejected');

    expect(held()).toBeNull();
    expect(reports).toEqual([
      { domain: 'layout', code: 'document-not-json', context: { length: page.length } },
    ]);
  });

  /*
   * A kept copy is persisted, and on the web that is `localStorage`, whose quota is a few
   * megabytes shared with every other slice.
   */
  it('is refused unread when it is larger than the bound, and the good copy stays', async () => {
    answer(GOOD);
    await refresh();

    later();
    const huge = JSON.stringify({
      version: 2,
      sections: [{ id: 'header', module: 'home-header', settings: {} }],
      moments: [],
      padding: 'x'.repeat(HOME_LAYOUT_MAX_CHARS),
    });
    answer(huge);
    expect(await refresh()).toBe('rejected');

    expect(held()).toBe(GOOD);
    expect(reports).toEqual([
      { domain: 'layout', code: 'document-too-large', context: { length: huge.length } },
    ]);
  });

  it('is refused and reported when it carries no date, because nothing says it is newer', async () => {
    answer(GOOD, null);
    expect(await refresh()).toBe('rejected');
    expect(held()).toBeNull();
    expect(reports).toEqual([
      { domain: 'layout', code: 'document-undated', context: { length: GOOD.length } },
    ]);
  });
});

describe('a document older than this build', () => {
  /*
   * An update that shipped a newer bundle, the CDN's copy in the ten minutes after a
   * deploy, and a local export of an edited document are all this case: the published
   * file predates the build. It is the normal state between a release and the next
   * deploy, so it is not a report.
   */
  it('is not kept, not drawn and not reported', async () => {
    answer(GOOD, BEFORE_BUILD);
    expect(await refresh()).toBe('older-than-bundle');
    expect(store.getState().homeLayout.text).toBeNull();
    expect(held()).toBeNull();
    expect(reports).toEqual([]);
  });

  it('does not displace the bundle when the copy was kept by the build before', async () => {
    // What the previous build fetched and persisted, an hour and a half before this one.
    store.dispatch(
      homeLayoutActions.hydrate({ text: GOOD, publishedAt: Date.parse(BEFORE_BUILD) - 1_800_000 }),
    );
    expect(store.getState().homeLayout.text).toBe(GOOD);
    expect(held()).toBeNull();
  });

  /*
   * The local-export case, with the numbers it has in practice: `build:web` run today on
   * a branch that edits the document, against a site last deployed at 05:13:15 UTC.
   */
  it('loses to a local export built after the last deploy', async () => {
    const exportedNow = NOW;
    answer(GOOD, 'Wed, 23 Sep 2026 05:13:15 GMT');
    expect(
      await store.dispatch(
        refreshHomeLayout(URL, { builtAt: exportedNow, renderable: RENDERABLE }),
      ),
    ).toBe('older-than-bundle');
    expect(fetchedHomeLayout(store.getState().homeLayout, exportedNow)).toBeNull();
  });
});

describe('persistence', () => {
  const slices = [persisted('homeLayout', PERSISTED_KEYS, homeLayoutActions.hydrate)];

  /*
   * The copy goes through `persist()`, the store that holds what a reader chose, and
   * not through the blob cache: eviction there would take a phone back to the bundled
   * layout for no reason a reader could see.
   */
  it('writes the copy and its date, and a new store reads them back', async () => {
    vi.useRealTimers();
    await persist(store, slices);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    answer(GOOD);
    await refresh();
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const next = createAppStore();
    await persist(next, slices);
    expect(fetchedHomeLayout(next.getState().homeLayout, BUILT_AT)).toBe(GOOD);
    // The stamp is not persisted: a launch is a new process, and it fetches.
    expect(next.getState().homeLayout.triedAt).toBeNull();
  });

  /*
   * Every try stamps `triedAt`. Were that a write, a quarter of a megabyte of document
   * would be rewritten into `localStorage` on every return to the foreground.
   */
  it('does not rewrite the stored copy when only the stamp changed', async () => {
    vi.useRealTimers();
    const platform = createMemoryPlatform();
    const writes: string[] = [];
    const setString = platform.keyValue.setString;
    platform.keyValue.setString = (key, value) => {
      writes.push(key);
      return setString(key, value);
    };
    configurePlatform(platform);
    store.dispatch(homeLayoutActions.received({ text: GOOD, publishedAt: 1 }));
    await persist(store, slices);

    store.dispatch(homeLayoutActions.tried(Date.now()));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(writes).toEqual([]);

    store.dispatch(homeLayoutActions.received({ text: GOOD, publishedAt: 2 }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(writes).toEqual(['store.homeLayout']);
  });

  it('ignores a stored payload that is not a string and a date', () => {
    store.dispatch(homeLayoutActions.hydrate({ text: 42 as unknown as string, publishedAt: 1 }));
    store.dispatch(homeLayoutActions.hydrate({ text: GOOD }));
    expect(store.getState().homeLayout.text).toBeNull();
  });
});
