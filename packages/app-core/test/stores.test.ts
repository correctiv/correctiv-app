import { beforeEach, describe, expect, it, vi } from 'vitest';

import { interests } from '../src/data/interests';
import { configurePlatform, createMemoryPlatform, resetPlatform } from '../src/ports';
import {
  boostedModules,
  clear,
  extraFeeds,
  selectedInterests,
  interestsActions,
  toggle as toggleInterest,
  type InterestsState,
} from '../src/stores/interests';
import {
  extraCount,
  hasSubmitted,
  participationActions,
  submit,
} from '../src/stores/participation';
import { persist, persisted } from '../src/stores/persist';
import {
  isSaved,
  remove,
  savedArticlesActions,
  toggle as toggleSaved,
  type SavedArticle,
  type SavedArticlesState,
} from '../src/stores/savedArticles';
import {
  PERSISTED_KEYS,
  TEXT_SIZE_STEPS,
  appTextScale,
  completeOnboarding,
  nearestTextSizeStep,
  resetForDemo,
  scaleTextMetrics,
  setActiveTab,
  setTextSize,
  setTheme,
  settingsActions,
  textSizeFollowsSystem,
  type SettingsState,
  type TextSize,
} from '../src/stores/settings';
import { createAppStore, resetStore, type AppStore } from '../src/stores/store';
import { close, isActive, opened, play, statusChanged } from '../src/stores/video';

/**
 * The state moved from ten observable stores to twelve slices of one Redux store.
 * These tests pin the behaviour that move could quietly change: immutable
 * updates, action semantics, and the pure selectors that were never methods.
 *
 * Every test builds its own store rather than resetting a singleton — the
 * isolation is free here, and a leaked slice between tests is the kind of failure
 * that shows up as an unrelated test going red three months later.
 */
let store: AppStore;

beforeEach(() => {
  store = createAppStore();
  resetPlatform();
});

describe('settings slice', () => {
  it('tracks visited tabs without duplicating them', () => {
    store.dispatch(setActiveTab('media'));
    store.dispatch(setActiveTab('profile'));
    store.dispatch(setActiveTab('media'));

    expect(store.getState().settings.activeTab).toBe('media');
    expect(store.getState().settings.visitedTabs).toEqual(['home', 'media', 'profile']);
  });

  it('replaces the visitedTabs array instead of mutating it', () => {
    const before = store.getState().settings.visitedTabs;
    store.dispatch(setActiveTab('discover'));
    // A binding that diffs by reference (React) only re-renders on a new array.
    // Immer gives one because the draft was written to; `before` is frozen.
    expect(store.getState().settings.visitedTabs).not.toBe(before);
    expect(before).toEqual(['home']);
  });

  it('completes onboarding and sets the theme', () => {
    store.dispatch(completeOnboarding());
    store.dispatch(setTheme('dark'));
    expect(store.getState().settings.onboardingDone).toBe(true);
    expect(store.getState().settings.theme).toBe('dark');
  });
});

describe('the one text size (ADR 0033)', () => {
  const settingsNow = () => store.getState().settings;

  it('follows the system by default, and takes its value exactly', () => {
    expect(textSizeFollowsSystem(settingsNow())).toBe(true);
    expect(appTextScale(settingsNow(), 1)).toBe(1);
    expect(appTextScale(settingsNow(), 2)).toBe(2);
  });

  it('replaces the system scale with a chosen step rather than multiplying it', () => {
    store.dispatch(setTextSize(1.15));
    expect(textSizeFollowsSystem(settingsNow())).toBe(false);
    // The same choice is the same size on every phone: at system 200 % a
    // multiplier would give 2.3, which nothing in the app was ever seen at.
    expect(appTextScale(settingsNow(), 1)).toBe(1.15);
    expect(appTextScale(settingsNow(), 2)).toBe(1.15);
    expect(appTextScale(settingsNow(), 0.85)).toBe(1.15);
  });

  it('refuses a size no control offers', () => {
    store.dispatch(setTextSize(0.9));
    store.dispatch(setTextSize(1.5 as TextSize));
    store.dispatch(setTextSize('1.15' as unknown as TextSize));
    store.dispatch(setTextSize(null as unknown as TextSize));
    expect(settingsNow().textSize).toBe(0.9);
    store.dispatch(setTextSize('system'));
    expect(settingsNow().textSize).toBe('system');
  });

  it('starts a manual choice at the step nearest the system', () => {
    expect(nearestTextSizeStep(1)).toBe(1);
    expect(nearestTextSizeStep(0.85)).toBe(0.9);
    expect(nearestTextSizeStep(1.1)).toBe(1.15);
    // The ceiling holds: a large system scale lands on the largest step.
    expect(nearestTextSizeStep(2)).toBe(TEXT_SIZE_STEPS.at(-1));
  });

  it('scales a style by its font size and line height only', () => {
    expect(scaleTextMetrics({ fontSize: 20, lineHeight: 30, letterSpacing: 1 }, 1.15)).toEqual({
      fontSize: 23,
      lineHeight: 34.5,
      letterSpacing: 1,
    });
    // A style without the metrics is returned as it came.
    expect(scaleTextMetrics({ color: 'red' }, 2)).toEqual({ color: 'red' });
  });

  it('goes back to the system on the demo reset', () => {
    store.dispatch(setTextSize(0.9));
    store.dispatch(resetForDemo());
    expect(settingsNow().textSize).toBe('system');
  });
});

describe('interests selectors', () => {
  it('toggle adds and removes, immutably', () => {
    const before = store.getState().interests.selected;
    store.dispatch(toggleInterest('klima'));
    expect(store.getState().interests.selected).toEqual(['klima']);
    expect(store.getState().interests.selected).not.toBe(before);

    store.dispatch(toggleInterest('klima'));
    expect(store.getState().interests.selected).toEqual([]);
  });

  it('clear empties the selection', () => {
    store.dispatch(toggleInterest('klima'));
    store.dispatch(clear());
    expect(store.getState().interests.selected).toEqual([]);
  });

  it('selectors are pure functions of the state passed in', () => {
    // The whole point: a selector must never read a store itself, or a binding
    // calling it would escape its own dependency tracking.
    const detached: InterestsState = { selected: ['klima'] };
    expect(selectedInterests(detached).map((i) => i.id)).toEqual(['klima']);
    // The real store is untouched by the call above.
    expect(selectedInterests(store.getState().interests)).toEqual([]);
  });

  it('boostedModules drops interests without a boostModule', () => {
    const all: InterestsState = { selected: interests.map((i) => i.id) };
    const expected = interests.filter((i) => i.boostModule).length;
    expect(boostedModules(all)).toHaveLength(expected);
    expect(boostedModules(all).every((m) => !!m)).toBe(true);
  });

  it('extraFeeds keeps feed-backed interests but never salon5', () => {
    const all: InterestsState = { selected: interests.map((i) => i.id) };
    expect(extraFeeds(all).some((i) => i.feed === 'salon5')).toBe(false);
    expect(extraFeeds(all).every((i) => !!i.feed)).toBe(true);
    expect(extraFeeds(all)).toHaveLength(
      interests.filter((i) => i.feed && i.feed !== 'salon5').length,
    );
  });
});

describe('savedArticles slice', () => {
  const article: SavedArticle = {
    url: 'https://correctiv.org/a/',
    title: 'A',
    kicker: null,
    rating: null,
    savedAt: '2026-08-05T00:00:00.000Z',
  };

  it('toggle saves, then unsaves', () => {
    store.dispatch(toggleSaved(article));
    expect(isSaved(store.getState().savedArticles, article.url)).toBe(true);
    store.dispatch(toggleSaved(article));
    expect(isSaved(store.getState().savedArticles, article.url)).toBe(false);
  });

  it('newest saved article comes first', () => {
    store.dispatch(toggleSaved(article));
    store.dispatch(toggleSaved({ ...article, url: 'https://correctiv.org/b/', title: 'B' }));
    expect(store.getState().savedArticles.items.map((a) => a.title)).toEqual(['B', 'A']);
  });

  it('remove deletes only the given url', () => {
    store.dispatch(toggleSaved(article));
    store.dispatch(toggleSaved({ ...article, url: 'https://correctiv.org/b/' }));
    store.dispatch(remove(article.url));
    expect(store.getState().savedArticles.items.map((a) => a.url)).toEqual([
      'https://correctiv.org/b/',
    ]);
  });
});

describe('participation slice', () => {
  it('counts repeated submissions per callout', () => {
    store.dispatch(submit('pflege', { a: 1 }));
    store.dispatch(submit('pflege', { a: 2 }));
    store.dispatch(submit('mieten', { a: 3 }));

    const state = store.getState().participation;
    expect(hasSubmitted(state, 'pflege')).toBe(true);
    expect(hasSubmitted(state, 'unbekannt')).toBe(false);
    expect(extraCount(state, 'pflege')).toBe(2);
    expect(extraCount(state, 'mieten')).toBe(1);
    expect(extraCount(state, 'unbekannt')).toBe(0);
  });
});

describe('video slice', () => {
  it('isActive follows the current item', () => {
    expect(isActive(store.getState().video)).toBe(false);
    store.dispatch(opened({ id: 'v1' } as never));
    expect(isActive(store.getState().video)).toBe(true);
    store.dispatch(close());
    expect(isActive(store.getState().video)).toBe(false);
  });

  it('does not ask the PeerTube API about a YouTube video', async () => {
    // It would be a guaranteed 404 — landing as status 'error', which reads as
    // "this video is broken". YouTube plays in an embed and has no stream URL.
    await store.dispatch(
      play({
        id: 'yt-1',
        title: 'Im Gespräch',
        url: 'https://www.youtube.com/watch?v=yt-1',
        thumbnailUrl: '',
        publishedAt: '2026-06-12T10:00:00.000Z',
        source: 'youtube',
      } as never),
    );

    expect(store.getState().video).toMatchObject({ status: 'ready', hlsUrl: '' });
  });

  it('takes the HLS url straight from a PeerTube item that already has one', async () => {
    await store.dispatch(
      play({
        id: 'pt-1',
        title: 'FunFacts',
        url: 'https://tube.funfacts.de/w/pt-1',
        thumbnailUrl: '',
        publishedAt: '2026-08-04T10:00:00.000Z',
        source: 'peertube',
        hlsMasterUrl: 'https://tube.funfacts.de/media/x-master.m3u8',
      } as never),
    );

    // No detail request needed, so no network in this test either.
    expect(store.getState().video).toMatchObject({
      status: 'ready',
      hlsUrl: 'https://tube.funfacts.de/media/x-master.m3u8',
    });
  });

  it('close clears the whole session', () => {
    store.dispatch(opened({ id: 'v1', hlsMasterUrl: 'x' } as never));
    // Seeded explicitly: `opened` does not touch status, so without this the
    // assertion below would be idle→idle and could not catch a `close` that
    // forgets to reset it — leaving the next video showing this one's error.
    store.dispatch(statusChanged('error'));
    expect(store.getState().video.status).toBe('error');

    store.dispatch(close());
    expect(store.getState().video).toMatchObject({
      current: null,
      hlsUrl: '',
      status: 'idle',
      expanded: false,
    });
  });
});

describe('persist', () => {
  const settings = () =>
    persisted<SettingsState>('settings', PERSISTED_KEYS, settingsActions.hydrate);

  it('writes only the declared keys, debounced', async () => {
    vi.useFakeTimers();
    const platform = createMemoryPlatform();
    configurePlatform(platform);

    await persist(store, [settings()]);
    store.dispatch(setTheme('light'));
    store.dispatch(setActiveTab('media'));

    expect(await platform.keyValue.getString('store.settings')).toBeNull(); // still debounced
    await vi.advanceTimersByTimeAsync(300);

    const saved = JSON.parse((await platform.keyValue.getString('store.settings')) ?? '{}');
    expect(saved.theme).toBe('light');
    // activeTab is ephemeral shell state and must not be persisted.
    expect(saved).not.toHaveProperty('activeTab');
    expect(Object.keys(saved).sort()).toEqual([...PERSISTED_KEYS].sort());
    vi.useRealTimers();
  });

  it('does not rewrite a slice that did not change', async () => {
    vi.useFakeTimers();
    const platform = createMemoryPlatform();
    configurePlatform(platform);
    await persist(store, [settings()]);

    store.dispatch(setTheme('light'));
    await vi.advanceTimersByTimeAsync(300);
    const first = await platform.keyValue.getString('store.settings');

    // A write in a different slice reaches the same subscriber. Without the
    // per-slice reference check this would re-serialise settings — which, with an
    // audio position tick arriving twice a second, is the whole reason for it.
    const writes: string[] = [];
    const spy = vi.spyOn(platform.keyValue, 'setString').mockImplementation((key) => {
      writes.push(key);
      return Promise.resolve();
    });
    store.dispatch(toggleInterest('klima'));
    await vi.advanceTimersByTimeAsync(300);

    expect(writes).toEqual([]);
    expect(await platform.keyValue.getString('store.settings')).toBe(first);
    spy.mockRestore();
    vi.useRealTimers();
  });

  it('hydrates from storage, ignoring unknown keys', async () => {
    const platform = createMemoryPlatform();
    await platform.keyValue.setString(
      'store.settings',
      JSON.stringify({ theme: 'dark', textSize: 1.15, activeTab: 'profile', bogus: 1 }),
    );
    configurePlatform(platform);

    await persist(store, [settings()]);

    expect(store.getState().settings.theme).toBe('dark');
    expect(store.getState().settings.textSize).toBe(1.15);
    // Not in PERSISTED_KEYS, so a stale payload cannot override live shell state…
    expect(store.getState().settings.activeTab).toBe('home');
    // …nor inject state the slice never declared.
    expect(store.getState().settings).not.toHaveProperty('bogus');
  });

  /**
   * ADR 0033's migration. Every installed app has a `textScale` on disk, because the
   * writer stores every declared key and 1 was the default. Read as the new meaning
   * it would be an override of 1 for everybody, which is the system's font setting
   * switched off on every phone that ever started the app; the reader who had set
   * A++ for the article would get it pinned on every screen instead. So the old key
   * is not read at all and everyone follows the system, which is the default the
   * record decides, and the first write drops the old key from storage.
   */
  it('migrates an old article text scale to following the system', async () => {
    vi.useFakeTimers();
    for (const old of [0.9, 1, 1.15]) {
      const fresh = createAppStore();
      const platform = createMemoryPlatform();
      // eslint-disable-next-line no-await-in-loop
      await platform.keyValue.setString(
        'store.settings',
        JSON.stringify({ onboardingDone: true, theme: 'dark', textScale: old }),
      );
      configurePlatform(platform);
      // eslint-disable-next-line no-await-in-loop
      await persist(fresh, [settings()]);

      expect(fresh.getState().settings.textSize).toBe('system');
      expect(fresh.getState().settings).not.toHaveProperty('textScale');
      // Everything else on the same payload survives the migration.
      expect(fresh.getState().settings.theme).toBe('dark');
      expect(fresh.getState().settings.onboardingDone).toBe(true);

      fresh.dispatch(setTheme('light'));
      // eslint-disable-next-line no-await-in-loop
      await vi.advanceTimersByTimeAsync(300);
      // eslint-disable-next-line no-await-in-loop
      const saved = JSON.parse((await platform.keyValue.getString('store.settings')) ?? '{}');
      expect(saved).not.toHaveProperty('textScale');
      expect(saved.textSize).toBe('system');
    }
    vi.useRealTimers();
  });

  it('drops a stored text size this build does not offer', async () => {
    const platform = createMemoryPlatform();
    await platform.keyValue.setString(
      'store.settings',
      JSON.stringify({ theme: 'dark', textSize: 1.5 }),
    );
    configurePlatform(platform);

    await persist(store, [settings()]);

    expect(store.getState().settings.textSize).toBe('system');
    expect(store.getState().settings.theme).toBe('dark');
  });

  // A stored value is whatever an older build, a hand edit or a corrupt write left,
  // and JSON can carry a string that looks like a step, a null or a structure. Each
  // one is dropped, the reader follows the system, and the fields beside it survive.
  it.each([
    ['a step spelled as a string', '1.15'],
    ['the word for the default in the wrong case', 'System'],
    ['null', null],
    ['an object', { scale: 1.15 }],
    ['an array', [1.15]],
    ['a boolean', true],
    ['zero', 0],
  ])('drops a stored text size that is %s', async (_, textSize) => {
    const platform = createMemoryPlatform();
    await platform.keyValue.setString(
      'store.settings',
      JSON.stringify({ theme: 'dark', textSize }),
    );
    configurePlatform(platform);

    await persist(store, [settings()]);

    expect(store.getState().settings.textSize).toBe('system');
    expect(store.getState().settings.theme).toBe('dark');
  });

  it('discards corrupt persistence instead of throwing', async () => {
    const platform = createMemoryPlatform();
    await platform.keyValue.setString('store.settings', '{not json');
    configurePlatform(platform);

    await expect(persist(store, [settings()])).resolves.toBeUndefined();
    expect(await platform.keyValue.getString('store.settings')).toBeNull();
    expect(store.getState().settings.theme).toBe('system');
  });

  it('keeps the slice usable after hydration', async () => {
    const platform = createMemoryPlatform();
    await platform.keyValue.setString('store.settings', JSON.stringify({ theme: 'dark' }));
    configurePlatform(platform);

    await persist(store, [settings()]);
    store.dispatch(setTheme('light'));
    expect(store.getState().settings.theme).toBe('light');
  });
});

describe('resetStore', () => {
  /**
   * Six test files lean on this in `beforeEach` for isolation, and nothing else
   * proves it works. If the root reducer's `undefined` special case is ever lost
   * — a refactor to `configureStore({ reducer: combined })` is the obvious way —
   * `app/reset` becomes an unknown action, every slice keeps its state, and those
   * six files silently stop being isolated. Nothing would go red at that moment;
   * an unrelated test would start failing by ordering, months later.
   */
  it('returns every touched slice to its initial value', () => {
    store.dispatch(setTheme('dark'));
    store.dispatch(toggleInterest('klima'));
    store.dispatch(submit('pflege', { a: 1 }));

    store.dispatch(resetStore());

    expect(store.getState().settings.theme).toBe('system');
    expect(store.getState().interests.selected).toEqual([]);
    expect(store.getState().participation.submissions).toEqual([]);
  });
});

describe('hydrate', () => {
  /**
   * On the old store hydration was ONE shared code path, so a single settings
   * test covered every store. It is five hand-written reducers now, so each one
   * needs its own proof that a partial payload merges rather than replaces.
   */
  it('merges a partial payload into each persisted slice', () => {
    store.dispatch(
      savedArticlesActions.hydrate({
        items: [
          { url: 'https://correctiv.org/a/', title: 'A', kicker: null, rating: null, savedAt: 'x' },
        ],
      }),
    );
    expect(store.getState().savedArticles.items).toHaveLength(1);

    store.dispatch(interestsActions.hydrate({ selected: ['klima'] }));
    expect(store.getState().interests.selected).toEqual(['klima']);

    store.dispatch(
      participationActions.hydrate({
        submissions: [{ calloutSlug: 'pflege', answers: {}, submittedAt: 'x' }],
      }),
    );
    expect(store.getState().participation.submissions).toHaveLength(1);
  });
});

describe('persist across several slices', () => {
  const both = () => [
    persisted<SettingsState>('settings', PERSISTED_KEYS, settingsActions.hydrate),
    persisted<SavedArticlesState>('savedArticles', ['items'], savedArticlesActions.hydrate),
  ];

  const ARTICLE: SavedArticle = {
    url: 'https://correctiv.org/a/',
    title: 'A',
    kicker: null,
    rating: null,
    savedAt: '2026-08-05T00:00:00.000Z',
  };

  it('writes each slice under its own key, and only the one that changed', async () => {
    vi.useFakeTimers();
    const platform = createMemoryPlatform();
    configurePlatform(platform);
    await persist(store, both());

    store.dispatch(toggleSaved(ARTICLE));
    await vi.advanceTimersByTimeAsync(300);

    // Its own key — and settings was never touched, which is the per-slice
    // reference check. A single-slice test cannot tell that apart from a global
    // "did anything change" check.
    const saved = JSON.parse((await platform.keyValue.getString('store.savedArticles')) ?? '{}');
    expect(saved.items).toHaveLength(1);
    expect(await platform.keyValue.getString('store.settings')).toBeNull();
    vi.useRealTimers();
  });

  it('writes a pending change even while unrelated dispatches keep arriving', async () => {
    vi.useFakeTimers();
    const platform = createMemoryPlatform();
    configurePlatform(platform);
    await persist(store, both());

    store.dispatch(setTheme('dark'));
    // A burst of traffic in state nobody persists — an audio position tick, or a
    // pull-to-refresh patching six feeds. A debounce resets on each of these and
    // would hold the theme out of storage for as long as they keep coming.
    for (let i = 0; i < 10; i++) {
      store.dispatch(setActiveTab(i % 2 === 0 ? 'media' : 'profile'));
      await vi.advanceTimersByTimeAsync(100);
    }

    expect(JSON.parse((await platform.keyValue.getString('store.settings')) ?? '{}').theme).toBe(
      'dark',
    );
    vi.useRealTimers();
  });
});

/**
 * The one piece of state a host hands in at construction
 * ([ADR 0049](../../../adr/0049-the-catalogue-is-a-package.md) §4).
 *
 * Three assertions, and the middle one is the reason this block exists. A cold
 * review found that `resetStore` asked every slice for its own initial state and
 * so handed the host's locale back to the core's default — measured, `'en'` in and
 * `'de'` out. `resetStore` is on the preview frame's dev handle, so that is a
 * control somebody presses, not a test-only path.
 */
describe('the locale the host names', () => {
  it('reaches the store it was handed to', () => {
    expect(createAppStore({ locale: 'en' }).getState().settings.locale).toBe('en');
  });

  it("survives a reset, because it is the host's and not the reader's", () => {
    const store = createAppStore({ locale: 'en' });
    store.dispatch(resetStore());
    expect(store.getState().settings.locale).toBe('en');
  });

  it('leaves a store built without one exactly as it was', () => {
    // The option is additive: every existing caller builds the same tree it always
    // did, and a reset there still returns the slice's own default.
    const store = createAppStore();
    expect(store.getState().settings.locale).toBe('de');
    store.dispatch(resetStore());
    expect(store.getState().settings.locale).toBe('de');
    expect(createAppStore().getState()).toEqual(createAppStore({ locale: 'de' }).getState());
  });
});
