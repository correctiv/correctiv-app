import { describe, expect, it } from 'vitest';
import {
  BUNDLED_NAVIGATION_DOCUMENT,
  MAX_TABS,
  MIN_MAX_TABS,
  MORE_TAB,
  arrangeTabBar,
  chooseTabBar,
  parseNavigation,
} from '../src/lib/navigation';
import { joinScreenDocuments, navigationDocumentOf } from '../src/lib/screen-layout';
import { DEMO_NAVIGATION } from './__fixtures__/demo-layout';

const all = () => true;
const doc = (tabs: string[], extra: Record<string, unknown> = {}) => ({
  version: 1,
  tabs,
  ...extra,
});
const ids = (count: number) => Array.from({ length: count }, (_, i) => `s${i + 1}`);

describe('the bundled navigation', () => {
  it('is the ship layout, which lists nothing and draws the empty state', () => {
    const { navigation, problems } = parseNavigation(BUNDLED_NAVIGATION_DOCUMENT);
    expect(problems).toEqual([]);
    expect(navigation?.tabs).toEqual([]);
    expect(chooseTabBar({ reachable: all }).bar).toEqual({
      kind: 'empty',
      start: null,
      entries: [],
      tabs: [],
      more: [],
    });
  });
});

describe('the demo navigation', () => {
  it('parses with no problems and lists the five screens, Home first because it is written first', () => {
    const { navigation, problems } = parseNavigation(DEMO_NAVIGATION);
    expect(problems).toEqual([]);
    expect(arrangeTabBar(navigation!, all)).toEqual({
      kind: 'tabs',
      start: 'home',
      entries: ['home', 'entdecken', 'mediathek', 'mitmachen', 'profil'],
      tabs: ['home', 'entdecken', 'mediathek', 'mitmachen', 'profil'],
      more: [],
    });
  });
});

describe('parseNavigation', () => {
  it('refuses what is not an object', () => {
    for (const bad of [null, [], 'x', 3]) {
      expect(parseNavigation(bad).navigation).toBeNull();
    }
  });

  it('refuses an unknown key, a wrong version and a bad maxTabs', () => {
    expect(parseNavigation({ ...doc([]), colour: 'red' }).problems[0]?.code).toBe(
      'navigation-unknown-key',
    );
    expect(parseNavigation({ version: 2, tabs: [] }).problems[0]?.code).toBe(
      'navigation-version-invalid',
    );
    for (const maxTabs of [1, 6, 2.5, '3']) {
      expect(parseNavigation(doc([], { maxTabs })).problems[0]?.code).toBe(
        'navigation-max-tabs-invalid',
      );
    }
  });

  it('refuses a reserved, malformed or duplicate id, and a tabs list that is not strings', () => {
    expect(parseNavigation(doc([MORE_TAB])).problems[0]?.code).toBe('navigation-tab-reserved');
    expect(parseNavigation(doc(['navigation'])).problems[0]?.code).toBe('navigation-tab-reserved');
    expect(parseNavigation(doc(['Not An Id'])).problems[0]?.code).toBe('navigation-tab-malformed');
    expect(parseNavigation(doc(['profil', 'profil'])).problems[0]?.code).toBe(
      'navigation-tab-duplicate',
    );
    expect(parseNavigation({ version: 1, tabs: [1] }).problems[0]?.code).toBe(
      'navigation-tabs-invalid',
    );
  });

  it('takes any well-formed id, Home and the old route name included: no screen is built in', () => {
    expect(parseNavigation(doc(['home', 'index', 'nope'])).navigation?.tabs).toEqual([
      'home',
      'index',
      'nope',
    ]);
  });

  it('allows an empty list and every maxTabs from the minimum to the ceiling', () => {
    expect(parseNavigation(doc([])).navigation?.tabs).toEqual([]);
    for (let maxTabs = MIN_MAX_TABS; maxTabs <= MAX_TABS; maxTabs++) {
      expect(parseNavigation(doc([], { maxTabs })).navigation?.maxTabs).toBe(maxTabs);
    }
  });
});

describe('arrangeTabBar', () => {
  const nav = (tabs: string[], maxTabs?: number) =>
    parseNavigation(doc(tabs, maxTabs === undefined ? {} : { maxTabs })).navigation!;

  it('draws the empty state for no entry, and no bar', () => {
    expect(arrangeTabBar(nav([]), all)).toEqual({
      kind: 'empty',
      start: null,
      entries: [],
      tabs: [],
      more: [],
    });
  });

  it('draws one entry as the screen alone, and that is the start', () => {
    expect(arrangeTabBar(nav(['klima']), all)).toEqual({
      kind: 'single',
      start: 'klima',
      entries: ['klima'],
      tabs: [],
      more: [],
    });
  });

  it('draws two entries as two tabs, in the order the document has them', () => {
    expect(arrangeTabBar(nav(['profil', 'home']), all)).toEqual({
      kind: 'tabs',
      start: 'profil',
      entries: ['profil', 'home'],
      tabs: ['profil', 'home'],
      more: [],
    });
  });

  it.each([2, 3, 4, 5])('draws every entry as a tab when there are exactly %i of them', (max) => {
    const bar = arrangeTabBar(nav(ids(max), max), all);
    expect(bar.tabs).toEqual(ids(max));
    expect(bar.more).toEqual([]);
  });

  it.each([2, 3, 4, 5])('moves the rest behind Mehr when there is one more than %i', (max) => {
    const bar = arrangeTabBar(nav(ids(max + 1), max), all);
    expect(bar.tabs).toEqual([...ids(max - 1), MORE_TAB]);
    expect(bar.tabs).toHaveLength(max);
    expect(bar.more).toEqual(ids(max + 1).slice(max - 1));
    expect(bar.start).toBe('s1');
  });

  it('never shows more than five tabs, whatever the document lists', () => {
    const bar = arrangeTabBar(nav(ids(12)), all);
    expect(bar.tabs).toHaveLength(MAX_TABS);
    expect(bar.tabs.at(-1)).toBe(MORE_TAB);
    expect(bar.more).toHaveLength(12 - (MAX_TABS - 1));
  });

  it('counts after the unreachable entries are gone, and leaves no gap for them', () => {
    const bar = arrangeTabBar(nav(ids(6)), (tab) => tab !== 's2' && tab !== 's3');
    expect(bar).toEqual({
      kind: 'tabs',
      start: 's1',
      entries: ['s1', 's4', 's5', 's6'],
      tabs: ['s1', 's4', 's5', 's6'],
      more: [],
    });
  });

  it('makes the first reachable entry the start, and a bar of one when only one remains', () => {
    expect(arrangeTabBar(nav(ids(3)), (tab) => tab === 's3')).toEqual({
      kind: 'single',
      start: 's3',
      entries: ['s3'],
      tabs: [],
      more: [],
    });
  });

  it('is the empty state when nothing is reachable', () => {
    expect(arrangeTabBar(nav(ids(3)), () => false).kind).toBe('empty');
  });

  describe('with a screen the navigation does not list', () => {
    it('adds Mehr to a bar that has room, with nothing of the navigation behind it', () => {
      expect(arrangeTabBar(nav(['s1', 's2']), all, true)).toEqual({
        kind: 'tabs',
        start: 's1',
        entries: ['s1', 's2'],
        tabs: ['s1', 's2', MORE_TAB],
        more: [],
      });
    });

    it('draws a single entry as a bar of that entry and Mehr', () => {
      expect(arrangeTabBar(nav(['s1']), all, true)).toEqual({
        kind: 'tabs',
        start: 's1',
        entries: ['s1'],
        tabs: ['s1', MORE_TAB],
        more: [],
      });
    });

    it('makes room for Mehr in a bar that is exactly full, as an overflow does', () => {
      const bar = arrangeTabBar(nav(ids(4), 4), all, true);
      expect(bar.tabs).toEqual(['s1', 's2', 's3', MORE_TAB]);
      expect(bar.more).toEqual(['s4']);
    });

    it('is the same bar as before when an overflow already put Mehr there', () => {
      expect(arrangeTabBar(nav(ids(8)), all, true)).toEqual(arrangeTabBar(nav(ids(8)), all));
    });

    it('draws nothing for a navigation that lists nothing it can open', () => {
      expect(arrangeTabBar(nav(['gone']), () => false, true).kind).toBe('empty');
    });
  });
});

describe('chooseTabBar', () => {
  const base = { reachable: all, bundled: DEMO_NAVIGATION };

  it('draws a good candidate', () => {
    const choice = chooseTabBar({ ...base, candidate: doc(['profil', 'entdecken']) });
    expect(choice.source).toBe('candidate');
    expect(choice.bar.tabs).toEqual(['profil', 'entdecken']);
    expect(choice.bar.start).toBe('profil');
  });

  it.each([
    ['nothing fetched', undefined],
    ['a document that does not parse', { version: 1 }],
    ['a malformed id', doc(['entdecken', 'Not An Id'])],
    ['an unknown key', doc(['entdecken'], { extra: 1 })],
  ])('falls back to the bundle for %s', (_name, candidate) => {
    const choice = chooseTabBar({ ...base, candidate });
    expect(choice.source).toBe('bundled');
    expect(choice.bar.tabs).toEqual(['home', 'entdecken', 'mediathek', 'mitmachen', 'profil']);
  });

  it('keeps a candidate whose entries can none be opened, as the empty state', () => {
    const choice = chooseTabBar({
      ...base,
      candidate: doc(['mitmachen']),
      reachable: () => false,
    });
    expect(choice.source).toBe('candidate');
    expect(choice.bar.kind).toBe('empty');
  });

  it('reports what was wrong with the candidate', () => {
    const choice = chooseTabBar({ ...base, candidate: doc(['Not An Id']) });
    expect(choice.problems.map((p) => p.code)).toEqual(['navigation-tab-malformed']);
  });
});

describe('the published document', () => {
  it('carries the navigation beside the screens, and reads it back', () => {
    const joined = JSON.parse(
      JSON.stringify(joinScreenDocuments({ home: {} }, BUNDLED_NAVIGATION_DOCUMENT)),
    );
    expect(Object.keys(joined)).toEqual(['version', 'screens', 'navigation']);
    expect(navigationDocumentOf(joined)).toEqual(BUNDLED_NAVIGATION_DOCUMENT);
  });

  it('has no navigation key when none is given, and reads undefined', () => {
    expect(joinScreenDocuments({ home: {} })).not.toHaveProperty('navigation');
    expect(navigationDocumentOf({ screens: {} })).toBeUndefined();
    expect(navigationDocumentOf(null)).toBeUndefined();
  });
});
