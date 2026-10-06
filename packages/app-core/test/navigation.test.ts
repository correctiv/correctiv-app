import { describe, expect, it } from 'vitest';
import {
  BUNDLED_NAVIGATION_DOCUMENT,
  MAX_TABS,
  MORE_TAB,
  arrangeTabBar,
  chooseTabBar,
  parseNavigation,
} from '../src/lib/navigation';
import { joinScreenDocuments, navigationDocumentOf } from '../src/lib/screen-layout';

const KNOWN = new Set(['entdecken', 'mediathek', 'mitmachen', 'profil', 'game']);
const all = () => true;
const doc = (tabs: string[], extra: Record<string, unknown> = {}) => ({
  version: 1,
  tabs,
  ...extra,
});

describe('the bundled navigation', () => {
  it('parses with no problems and reproduces the five tabs the app had before', () => {
    const { navigation, problems } = parseNavigation(BUNDLED_NAVIGATION_DOCUMENT, KNOWN);
    expect(problems).toEqual([]);
    expect(arrangeTabBar(navigation!, all)).toEqual({
      tabs: ['index', 'entdecken', 'mediathek', 'mitmachen', 'profil'],
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

  it('refuses a reserved, duplicate or unknown tab, and a tabs list that is not strings', () => {
    expect(parseNavigation(doc(['index'])).problems[0]?.code).toBe('navigation-tab-reserved');
    expect(parseNavigation(doc([MORE_TAB])).problems[0]?.code).toBe('navigation-tab-reserved');
    expect(parseNavigation(doc(['profil', 'profil'])).problems[0]?.code).toBe(
      'navigation-tab-duplicate',
    );
    expect(parseNavigation(doc(['nope']), KNOWN).problems[0]?.code).toBe('navigation-tab-unknown');
    expect(parseNavigation({ version: 1, tabs: [1] }).problems[0]?.code).toBe(
      'navigation-tabs-invalid',
    );
  });

  it('does not check membership when it is given no set to check against', () => {
    expect(parseNavigation(doc(['nope'])).navigation?.tabs).toEqual(['nope']);
  });
});

describe('arrangeTabBar', () => {
  const nav = (tabs: string[], maxTabs?: number) =>
    parseNavigation(doc(tabs, maxTabs === undefined ? {} : { maxTabs }), KNOWN).navigation!;

  it('overflows into Mehr above the threshold, and Mehr counts as a tab', () => {
    const bar = arrangeTabBar(nav(['entdecken', 'mediathek', 'mitmachen', 'profil'], 3), all)!;
    expect(bar.tabs).toEqual(['index', 'entdecken', MORE_TAB]);
    expect(bar.more).toEqual(['mediathek', 'mitmachen', 'profil']);
  });

  it('never shows more than five triggers, whatever the document lists', () => {
    const bar = arrangeTabBar(nav(['entdecken', 'mediathek', 'mitmachen', 'profil', 'game']), all)!;
    expect(bar.tabs).toHaveLength(MAX_TABS);
    expect(bar.tabs.at(-1)).toBe(MORE_TAB);
    expect(bar.more).toEqual(['profil', 'game']);
    for (let maxTabs = 2; maxTabs <= 5; maxTabs++) {
      const b = arrangeTabBar(
        nav(['entdecken', 'mediathek', 'mitmachen', 'profil', 'game'], maxTabs),
        all,
      )!;
      expect(b.tabs.length).toBeLessThanOrEqual(maxTabs);
      expect(b.tabs.length + b.more.length - (b.more.length ? 1 : 0)).toBe(6);
    }
  });

  it('keeps Home first and drops unreachable tabs before deciding on overflow', () => {
    const bar = arrangeTabBar(
      nav(['entdecken', 'mediathek', 'mitmachen', 'profil']),
      (tab) => tab !== 'mitmachen',
    )!;
    expect(bar).toEqual({ tabs: ['index', 'entdecken', 'mediathek', 'profil'], more: [] });
  });

  it('is null when fewer than two tabs remain', () => {
    expect(arrangeTabBar(nav(['mitmachen']), () => false)).toBeNull();
  });

  describe('with a screen to list (ADR 0075 §7)', () => {
    it('adds Mehr with nothing behind it when every destination fits', () => {
      const bar = arrangeTabBar(nav(['entdecken', 'profil']), all, true)!;
      expect(bar).toEqual({ tabs: ['index', 'entdecken', 'profil', MORE_TAB], more: [] });
    });

    it('makes room for Mehr in a bar that is exactly full, as an overflow does', () => {
      const bar = arrangeTabBar(nav(['entdecken', 'mediathek', 'mitmachen', 'profil']), all, true)!;
      expect(bar.tabs).toEqual(['index', 'entdecken', 'mediathek', 'mitmachen', MORE_TAB]);
      expect(bar.more).toEqual(['profil']);
    });

    it('is the same bar as before when an overflow already put Mehr there', () => {
      const tabs = ['entdecken', 'mediathek', 'mitmachen', 'profil', 'game'];
      expect(arrangeTabBar(nav(tabs), all, true)).toEqual(arrangeTabBar(nav(tabs), all));
    });

    it('is a bar without Mehr when asked for none', () => {
      expect(arrangeTabBar(nav(['entdecken']), all)!.tabs).toEqual(['index', 'entdecken']);
    });
  });
});

describe('chooseTabBar', () => {
  const base = { known: KNOWN, reachable: all };

  it('draws a good candidate', () => {
    const choice = chooseTabBar({ ...base, candidate: doc(['profil', 'entdecken']) });
    expect(choice.source).toBe('candidate');
    expect(choice.bar.tabs).toEqual(['index', 'profil', 'entdecken']);
  });

  it.each([
    ['nothing fetched', undefined],
    ['a document that does not parse', { version: 1 }],
    ['a tab this app does not know', doc(['entdecken', 'unheard-of'])],
    ['an unknown key', doc(['entdecken'], { extra: 1 })],
  ])('falls back to the bundle for %s', (_name, candidate) => {
    const choice = chooseTabBar({ ...base, candidate });
    expect(choice.source).toBe('bundled');
    expect(choice.bar.tabs).toEqual(['index', 'entdecken', 'mediathek', 'mitmachen', 'profil']);
  });

  it('falls back when fewer than two tabs remain after feature gating', () => {
    const choice = chooseTabBar({
      known: KNOWN,
      candidate: doc(['mitmachen']),
      reachable: (tab) => tab !== 'mitmachen',
    });
    expect(choice.source).toBe('bundled');
    expect(choice.bar.tabs).toEqual(['index', 'entdecken', 'mediathek', 'profil']);
  });

  it('reports what was wrong with the candidate', () => {
    const choice = chooseTabBar({ ...base, candidate: doc(['nope']) });
    expect(choice.problems.map((p) => p.code)).toEqual(['navigation-tab-unknown']);
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
