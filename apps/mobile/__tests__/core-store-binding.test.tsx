import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { Provider } from 'react-redux';

import { resetPlatform } from '@correctiv/app-core';
import { clearMemoryCache } from '@correctiv/app-core/services/cache.service';
import { patch as feedsPatch } from '@correctiv/app-core/stores/feeds';
import { patch as mediaPatch } from '@correctiv/app-core/stores/media';
import { setPushOptIn, setTheme } from '@correctiv/app-core/stores/settings';
import { signIn } from '@correctiv/app-core/stores/session';
import { toggle as toggleInterest } from '@correctiv/app-core/stores/interests';
import { toggle as toggleSaved } from '@correctiv/app-core/stores/savedArticles';
import {
  createAppStore,
  resetStore,
  type AppStore,
  type AppThunk,
} from '@correctiv/app-core/stores/store';

import type { FeedItem, FeedKey } from '@correctiv/app-core/types/models';

import { useInvestigations } from '@/lib/feeds/useFeed';
import {
  coreStore,
  useCoreActions,
  useExtraFeeds,
  useIsAdmitted,
  useIsSaved,
  useLazyLoad,
  useSelectedInterests,
  useVideoChannel,
  type CoreActions,
} from '@/lib/store/core';

/**
 * Proves the React side actually binds to the core's Redux store.
 *
 * Three things could break here and none of them is visible to typecheck:
 *
 *  1. The Provider and the bound actions have to reach the SAME store instance.
 *     This file's `core.ts` builds that instance and exports it, and the bound
 *     actions dispatch straight into it (the core exports `createAppStore()` and
 *     no singleton — ADR 0023), so a second copy — a duplicated module under
 *     Metro, say — would show up as a component that never updates. That the
 *     app's Provider is handed that very instance is pinned in
 *     `root-layout.test.tsx`; what is pinned here is the other half, that a
 *     component's own writes go to the Provider's store and not past it.
 *  2. `useSelector` compares results by REFERENCE. A selector that builds a fresh
 *     array on every call therefore re-renders its component on every dispatch in
 *     the app, including the audio position tick twice a second. That is why the
 *     interest hooks subscribe to the raw array and derive under useMemo.
 *  3. A lazy load has to fire for the thing that is being asked for, which is not
 *     the same as firing when a status changes.
 */

beforeEach(() => {
  // Inside act(): a reset notifies subscribers, and a mounted probe from a
  // previous test would otherwise re-render outside React's batching and warn.
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

/**
 * Every tree this creates is unmounted after the test.
 *
 * Leaking them is not cosmetic: a probe left mounted stays SUBSCRIBED, so the
 * reset in beforeEach re-renders it, its effect fires, and the next test starts
 * against a store some earlier component already moved. That is exactly how
 * "kicks off the load on first use" saw zero requests — the previous test's probe
 * had already done the loading.
 */
const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    for (const tree of mounted) tree.unmount();
  });
  mounted.length = 0;
});

/**
 * Renders a hook under the Provider and reports how many times it rendered.
 *
 * `store` defaults to the singleton every screen ends up on; pass an isolated one
 * to check that a hook writes where it reads.
 */
function renderHook<T>(
  hook: () => T,
  store: AppStore = coreStore,
): {
  tree: ReactTestRenderer;
  value: () => T;
  renders: () => number;
  rerender: () => void;
} {
  let latest!: T;
  let renders = 0;

  function Probe() {
    latest = hook();
    renders += 1;
    return <Text>{String(latest)}</Text>;
  }

  /**
   * A FRESH element per render, deliberately. React bails out of re-rendering a
   * child whose element is referentially identical, so re-using one would make
   * `rerender()` a no-op that looks like a passing stability assertion.
   */
  const element = () => (
    <Provider store={store}>
      <Probe />
    </Provider>
  );

  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element());
  });
  mounted.push(tree);
  return {
    tree,
    value: () => latest,
    renders: () => renders,
    rerender: () =>
      act(() => {
        tree.update(element());
      }),
  };
}

describe('useSelector over the core store', () => {
  it('reads the current value', () => {
    const { value } = renderHook(() => useIsAdmitted());
    expect(value()).toBe(false);
  });

  it('re-renders when the store changes', async () => {
    const { value } = renderHook(() => useIsAdmitted());

    await act(async () => {
      await coreStore.dispatch(signIn('alex@example.org', 'geheim', { delayMs: 0 }));
    });

    expect(value()).toBe(true);
  });

  it('does not re-render for an unrelated field in another slice', () => {
    const { renders } = renderHook(() => useIsAdmitted());
    const before = renders();

    act(() => {
      coreStore.dispatch(setPushOptIn(true));
    });

    // The selector narrows to one derived boolean over `session`, so a settings
    // change costs no render here.
    expect(renders()).toBe(before);
  });

  it('tracks a parameterised selector', () => {
    const url = 'https://correctiv.org/x/';
    const { value } = renderHook(() => useIsSaved(url));
    expect(value()).toBe(false);

    act(() => {
      coreStore.dispatch(
        toggleSaved({ url, title: 'X', kicker: null, rating: null, savedAt: 'now' }),
      );
    });

    expect(value()).toBe(true);
  });
});

describe('selectors that build new arrays', () => {
  it('useSelectedInterests renders without an infinite loop', () => {
    const { value, renders } = renderHook(() => useSelectedInterests());
    expect(value()).toEqual([]);
    expect(renders()).toBeLessThan(5);
  });

  it('useSelectedInterests updates on toggle and stays referentially stable', () => {
    const { value } = renderHook(() => useSelectedInterests());

    act(() => {
      coreStore.dispatch(toggleInterest('klima'));
    });
    const afterToggle = value();
    expect(afterToggle.map((i) => i.id)).toEqual(['klima']);

    act(() => {
      // A change in a different slice must not produce a new array here.
      coreStore.dispatch(setTheme('dark'));
    });
    expect(value()).toBe(afterToggle);
  });

  it('useExtraFeeds renders without an infinite loop', () => {
    const { renders } = renderHook(() => useExtraFeeds());
    expect(renders()).toBeLessThan(5);
  });
});

describe('useVideoChannel', () => {
  /**
   * The hook loads on first use, so mounting it reaches for the network. Stub
   * fetch with an empty-but-valid Atom feed: without this the suite makes a real
   * request to YouTube, jest reports an open handle, and the result depends on
   * whoever's Wi-Fi is running the tests.
   */
  const realFetch = global.fetch;
  let fetchCalls: string[];

  beforeEach(() => {
    fetchCalls = [];
    global.fetch = ((url: string) => {
      fetchCalls.push(url);
      // fetchText only touches .ok and .text().
      return Promise.resolve({ ok: true, text: () => Promise.resolve('<feed></feed>') });
    }) as unknown as typeof global.fetch;
    // The core's blob cache outlives a single test, on BOTH its layers: the
    // session map here and the FileStore behind the default memory platform.
    // An empty feed from an earlier test caches as `[]`, and the thunk's
    // `if (cached)` counts that as a hit — so without clearing both, the next
    // test sees a cache hit instead of a fetch and passes or fails by order.
    clearMemoryCache();
    resetPlatform();
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  /** Lets the thunk settle inside React's batching. */
  const flush = () => act(async () => undefined);

  /**
   * This hook selects `byKey[key]`, an object. That only works because the media
   * slice patches one channel at a time — Immer gives `byKey` a new identity but
   * leaves the OTHER channels' slices alone. If a refactor ever rebuilt all three
   * per update, this hook would return a fresh object on every dispatch and
   * re-render on FunFacts' loading. Hence a render count, not just a value.
   */
  it('subscribes to one channel without an infinite loop', async () => {
    const { value, renders } = renderHook(() => useVideoChannel('gespraech'));
    expect(value().videos).toEqual([]);
    expect(renders()).toBeLessThan(5);
    await flush();
  });

  it('kicks off the load on first use, and only once', async () => {
    renderHook(() => useVideoChannel('gespraech'));
    await flush();

    // One request for the channel it was asked for — the thunk's own guard plus
    // the hook's idle check must not add a second.
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]).toContain('youtube.com/feeds/videos.xml');
  });

  it('re-renders when its own channel changes', async () => {
    const { value } = renderHook(() => useVideoChannel('gespraech'));

    act(() => {
      coreStore.dispatch(
        mediaPatch('gespraech', { videos: [{ id: 'v1' } as never], status: 'ready' }),
      );
    });

    expect(value().status).toBe('ready');
    expect(value().videos).toHaveLength(1);
    await flush();
  });

  it('does not re-render when a different channel changes', async () => {
    const { renders } = renderHook(() => useVideoChannel('gespraech'));
    const before = renders();

    act(() => {
      coreStore.dispatch(
        mediaPatch('funfacts', { videos: [{ id: 'v2' } as never], status: 'ready' }),
      );
    });

    // The whole point of selecting one slice: FunFacts loading must not re-render
    // a component showing "CORRECTIV im Gespräch".
    expect(renders()).toBe(before);
    await flush();
  });
});

/**
 * The profile's impact list, measured rather than reasoned about, because this hook
 * got it wrong once: it selected `s.feeds`, which Immer hands a new identity every
 * time ANY feed lands, so a profile tab left open re-rendered whenever Home finished
 * loading a list it does not show. The selector takes the one slice it reads now
 * (`RecherchenFeed` in `stores/feeds.ts`), and these two cases are the difference —
 * the same pair as `useVideoChannel` above, for the same reason.
 *
 * The feed is seeded BEFORE the hook mounts, so `useLazyLoad` sees a status that is
 * not `idle` and nothing here reaches for the network.
 */
describe('useInvestigations', () => {
  const article = (id: string, path: string, feed: FeedKey = 'recherchen'): FeedItem => ({
    id,
    feed,
    title: id,
    url: `https://correctiv.org${path}`,
    teaser: '',
    publishedAt: '2026-08-11T08:00:00.000Z',
    categories: [],
  });

  const STORY = article('r', '/russland/2026/08/11/russisches-haus/');

  const land = (key: FeedKey, items: FeedItem[]) =>
    act(() => {
      coreStore.dispatch(feedsPatch(key, { items, status: 'ready' }));
    });

  beforeEach(() => land('recherchen', [STORY]));

  it('re-renders for its own feed, with the fact checks taken out', () => {
    const { value, renders } = renderHook(() => useInvestigations(3));
    const before = renders();

    land('recherchen', [STORY, article('c', '/faktencheck/2026/08/11/keine-ki-foto-ist-echt/')]);

    expect(renders()).toBeGreaterThan(before);
    expect(value().map((i) => i.id)).toEqual(['r']);
  });

  it('does not re-render when a different feed lands', () => {
    const { renders } = renderHook(() => useInvestigations(3));
    const before = renders();

    land('klima', [article('k', '/klima/2026/08/10/hitze-in-der-stadt/', 'klima')]);

    expect(renders()).toBe(before);
  });
});

describe('useCoreActions', () => {
  it('writes to the store its Provider holds, not to the singleton', () => {
    // The seam this hook exists to close. `coreActions` is bound to the imported
    // store, so a component reaching for it while its Provider holds another one
    // reads one tree and writes to a second — and both calls succeed, which is why
    // nothing reports it.
    const isolated = createAppStore();
    const { value } = renderHook(() => useCoreActions(), isolated);

    act(() => {
      value().settings.setPushOptIn(true);
    });

    expect(isolated.getState().settings.pushOptIn).toBe(true);
    expect(coreStore.getState().settings.pushOptIn).toBe(false);
  });

  it('keeps one identity across renders', () => {
    // These go straight into an `onPress`, so a fresh object per render would
    // defeat any memoisation downstream.
    const { value, rerender } = renderHook(() => useCoreActions());
    const first: CoreActions = value();

    rerender();

    expect(value()).toBe(first);
  });
});

/**
 * The shared half of the three lazy loads, exercised on its own — with a thunk that
 * records instead of fetching, because what is under test is WHEN it is dispatched.
 *
 * Doing it through `useVideoChannel` cannot prove the interesting case: loading a
 * channel moves its status off `'idle'`, so switching to a second channel changes
 * the status as well as the key and an implementation watching only the status
 * would pass. Here the status is pinned.
 */
describe('useLazyLoad', () => {
  const loaded: string[] = [];
  const load =
    (subject: string): AppThunk<void> =>
    () => {
      loaded.push(subject);
    };

  beforeEach(() => {
    loaded.length = 0;
  });

  interface Props {
    status: 'idle' | 'ready';
    subject: string;
  }

  function Probe({ status, subject }: Props) {
    useLazyLoad(status, load, subject);
    return <Text>{subject}</Text>;
  }

  const wrap = (props: Props) => (
    <Provider store={coreStore}>
      <Probe {...props} />
    </Provider>
  );

  function mount(props: Props) {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(wrap(props));
    });
    mounted.push(tree);
    return (next: Props) =>
      act(() => {
        tree.update(wrap(next));
      });
  }

  it('loads while the slice is idle', () => {
    mount({ status: 'idle', subject: 'a' });
    expect(loaded).toEqual(['a']);
  });

  it('does not load when the slice already holds something', () => {
    mount({ status: 'ready', subject: 'a' });
    expect(loaded).toEqual([]);
  });

  it('loads again for a new subject, though the status never changed', () => {
    // Two video channels are both 'idle' at startup. A rail switching from one to
    // the other has to load the second one, and only the argument says so.
    const update = mount({ status: 'idle', subject: 'a' });
    update({ status: 'idle', subject: 'b' });
    expect(loaded).toEqual(['a', 'b']);
  });

  it('does not load twice for the same subject', () => {
    const update = mount({ status: 'idle', subject: 'a' });
    update({ status: 'idle', subject: 'a' });
    expect(loaded).toEqual(['a']);
  });
});
