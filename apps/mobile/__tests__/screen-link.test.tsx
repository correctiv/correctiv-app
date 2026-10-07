/**
 * A link to another screen exists only where the active layout carries that screen.
 *
 * The roles (`SCREEN_ROLES`) name the screens the app points at; a layout that lacks one
 * leaves the link out instead of leading nowhere, and the pure routing decisions follow.
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { builtAt: '2026-09-23T06:00:00.000Z' } } },
}));

import { Text } from 'react-native';
import { act } from 'react-test-renderer';

import { searchSamples } from '@correctiv/app-core/data/search-samples';
import { projectGroups } from '@correctiv/app-core/data/projects';
import { resetStore } from '@correctiv/app-core/stores/store';

import { sampleTarget } from '@/components/discover/SampleHitRow';
import { LAYOUT_SET_KEY } from '@/lib/home/layout';
import { projectTarget } from '@/lib/discover/target';
import { screenHref } from '@/lib/navigation/screenHref';
import { screenLink, useScreenLink } from '@/lib/navigation/screenLink';
import { SCREEN_ROLES } from '@/lib/navigation/screenRoles';
import { coreStore } from '@/lib/store/core';

import { render } from './support/rendering';

const storage = new Map<string, string>();
const listeners = new Set<(event: StorageEvent) => void>();

beforeAll(() => {
  // The test runner's window has no events; the layout subscribes to `storage` on the web target.
  Object.assign(window, {
    addEventListener: (_type: string, listener: (event: StorageEvent) => void) =>
      void listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: StorageEvent) => void) =>
      void listeners.delete(listener),
  });
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
      removeItem: (key: string) => void storage.delete(key),
      get length() {
        return storage.size;
      },
      key: (at: number) => [...storage.keys()][at] ?? null,
    },
  });
});

beforeEach(() => {
  storage.clear();
  act(() => {
    coreStore.dispatch(resetStore());
  });
});

const DOCUMENT = { version: 2, sections: [{ id: 'a', module: 'screen-header' }], moments: [] };

/** A layout holding exactly the given screens. */
function holdOnly(...ids: string[]) {
  storage.set(
    LAYOUT_SET_KEY,
    JSON.stringify({
      layout: 'ship',
      navigation: { version: 1, maxTabs: 5, tabs: ids },
      screens: Object.fromEntries(ids.map((id) => [id, DOCUMENT])),
    }),
  );
}

describe('screenLink', () => {
  it('addresses every role the bundled layout carries', () => {
    for (const [role, id] of Object.entries(SCREEN_ROLES)) {
      expect(screenLink(role as keyof typeof SCREEN_ROLES)).toBe(screenHref(id));
    }
  });

  it('is null for a role whose screen the active layout lacks, and only for that one', () => {
    holdOnly(SCREEN_ROLES.media, SCREEN_ROLES.profile);
    expect(screenLink('media')).toBe(screenHref('mediathek'));
    expect(screenLink('discover')).toBeNull();
    expect(screenLink('participate')).toBeNull();
  });

  it('follows the layout when it changes under a mounted component', () => {
    function Probe() {
      return <Text>{useScreenLink('media') ?? 'none'}</Text>;
    }
    const tree = render(<Probe />);
    expect(tree.root.findByType(Text).props.children).toBe(screenHref('mediathek'));
    holdOnly(SCREEN_ROLES.profile);
    // `subscribeToLayout` listens for the set's key, which is what the workbench's write raises.
    act(() => {
      for (const listener of listeners) listener({ key: LAYOUT_SET_KEY } as StorageEvent);
    });
    expect(tree.root.findByType(Text).props.children).toBe('none');
  });
});

describe('the routing decisions without the screen', () => {
  const none = () => null;
  const crowdnewsroom = projectGroups
    .flatMap((g) => g.projects)
    .find((p) => p.id === 'crowdnewsroom')!;

  it('opens a participate project as a page when there is no participate screen', () => {
    expect(projectTarget(crowdnewsroom, none)).toEqual({ kind: 'project', id: 'crowdnewsroom' });
  });

  it('leaves a search hit inert when its screen is missing', () => {
    for (const hit of searchSamples) expect(sampleTarget(hit.kind, none)).toBeNull();
  });
});
