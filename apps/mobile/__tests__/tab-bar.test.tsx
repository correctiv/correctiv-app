import { isReachable, type Channel } from '@correctiv/app-core/features/features';
import { MAX_TABS, MORE_TAB, chooseTabBar } from '@correctiv/app-core/lib/navigation';

import { tabReachable } from '../src/lib/features';
import { KNOWN_DESTINATIONS, TAB_ROUTES, TAB_TARGETS } from '../src/lib/tabTargets';

const reachableIn = (channel: Channel) => (tab: string) =>
  tabReachable(tab, (id) => isReachable({ features: { channel, override: null } }, id));

const bar = (channel: Channel, candidate?: unknown) =>
  chooseTabBar({ candidate, known: KNOWN_DESTINATIONS, reachable: reachableIn(channel) });

describe('the tab bar the bundled navigation makes', () => {
  it('is the five tabs the app had, in the preview channel', () => {
    expect(bar('preview').bar).toEqual({
      tabs: ['index', 'entdecken', 'mediathek', 'mitmachen', 'profil'],
      more: [],
    });
  });

  it('drops Mitmachen in the release channel, exactly as the gated tab did before', () => {
    // callouts, faktenforum and abriss-atlas are all `vorschau`, so nothing in the tab is `an`.
    expect(bar('release').bar.tabs).toEqual(['index', 'entdecken', 'mediathek', 'profil']);
  });
});

describe('a document with more tabs than fit', () => {
  const candidate = {
    version: 1,
    maxTabs: 3,
    tabs: ['profil', 'entdecken', 'mediathek', 'mitmachen'],
  };

  it('overflows into Mehr, which is one of the tabs shown', () => {
    const { bar: shown, source } = bar('preview', candidate);
    expect(source).toBe('candidate');
    expect(shown.tabs).toEqual(['index', 'profil', MORE_TAB]);
    expect(shown.more).toEqual(['entdecken', 'mediathek', 'mitmachen']);
  });

  it('never makes more than five triggers visible, in either channel', () => {
    for (const channel of ['preview', 'release'] as const) {
      expect(bar(channel, { ...candidate, maxTabs: 5 }).bar.tabs.length).toBeLessThanOrEqual(
        MAX_TABS,
      );
    }
  });
});

describe('the declared tab routes', () => {
  it('have a target each, Home and Mehr included', () => {
    expect(TAB_ROUTES).toEqual(['index', 'entdecken', 'mediathek', 'mitmachen', 'profil', 'mehr']);
    for (const route of TAB_ROUTES) expect(TAB_TARGETS[route]?.route).toBe(route);
  });

  it('keep Home and Mehr out of what a document may name', () => {
    expect(KNOWN_DESTINATIONS.has('index')).toBe(false);
    expect(KNOWN_DESTINATIONS.has('mehr')).toBe(false);
  });
});
