import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CONFIGURABLE_SCREENS } from '@correctiv/app-core/lib/screen-layout';
import { MAX_TABS, MIN_TABS } from '@correctiv/app-core/lib/navigation';

import { ROOT } from '../../plugin/collect.ts';
import {
  applyLayout,
  fileOf,
  mayWriteLayout,
  targetFile,
} from '../../scripts/submission-layout.ts';
import { Refusal } from '../../scripts/submission.ts';
import { applyIssue, mayWrite } from '../../scripts/submission-kinds.ts';
import { formatLayoutDocument, moved, MODULE_LABELS } from '../../src/preview/home/document';
import {
  layoutFile,
  layoutKey,
  LAYOUT_DIR,
  NAVIGATION_FILE,
  NAVIGATION_KEY,
} from '../../src/preview/home/names';
import { screenOfRoute, shippedOf, SCREEN_ROUTES } from '../../src/preview/home/screens';
import { getLayout, getScreen, setLayout, setScreen } from '../../src/preview/home/store';
import {
  barOf,
  checkNavigation,
  DESTINATION_NAMES,
  formatNavigationDocument,
  movedTab,
  navigationDiffers,
  SHIPPED_NAVIGATION,
  unused,
  withMaxTabs,
  withTab,
} from '../../src/preview/navigation/document';
import { issueFor, layoutPayload } from '../../src/preview/submission';

const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const repo = { read, list: () => [] as string[] };
const APP = (path: string) => read(`apps/mobile/src/${path}`);

/** The block names `screens.ts` in the app declares, per screen, read as text: the app is not importable from Node. */
function declared(screen: string): string[] {
  const table = /export const MODULE_SCREENS[\s\S]*?\n};/.exec(APP('lib/home/screens.ts'))![0];
  return [...table.matchAll(/'([\w-]+)': \[([^\]]*)\]/g)]
    .filter(([, , screens]) => screens!.includes(`'${screen}'`))
    .map(([, name]) => name!);
}

describe('the screen picker and its palette', () => {
  it('knows every screen the core configures, with a route each', () => {
    expect(Object.keys(SCREEN_ROUTES).sort()).toEqual([...CONFIGURABLE_SCREENS].sort());
  });

  it('offers each screen the blocks that declare it, and its shipped blocks are among them', () => {
    for (const screen of CONFIGURABLE_SCREENS) {
      const palette = declared(screen);
      expect(palette.length).toBeGreaterThan(0);
      for (const section of shippedOf(screen).sections) expect(palette).toContain(section.module);
    }
  });

  it('keeps a block off a screen it does not declare, and offers a shared one on both', () => {
    expect(declared('entdecken')).not.toContain('article-hero');
    expect(declared('profil')).not.toContain('podcast-rail');
    expect(declared('home')).toContain('faktencheck-rail');
    expect(declared('entdecken')).toContain('faktencheck-rail');
  });

  it('names every block a palette can offer', () => {
    for (const screen of CONFIGURABLE_SCREENS)
      for (const module of declared(screen)) expect(MODULE_LABELS[module]).toBeDefined();
  });

  it('writes each screen to its own file and its own preview key, spelled as the app spells them', () => {
    expect(layoutKey('home')).toBe('workbench:home-layout');
    for (const screen of CONFIGURABLE_SCREENS.filter((s) => s !== 'home'))
      expect(layoutKey(screen)).toBe(`workbench:layout:${screen}`);
    expect(APP('lib/home/layout.ts')).toContain("'workbench:layout:${screen}'".replace(/'/g, '`'));
    expect(APP('lib/home/layout.ts')).toContain("'workbench:home-layout'");
    expect(APP('lib/navigation/tabBar.ts')).toContain(`'${NAVIGATION_KEY}'`);
    for (const screen of CONFIGURABLE_SCREENS)
      expect(read(layoutFile(screen))).toBe(formatLayoutDocument(shippedOf(screen)));
  });
});

describe('the editor follows the frame', () => {
  it('maps the route of every configurable screen back to that screen, whatever the spelling', () => {
    for (const screen of CONFIGURABLE_SCREENS) {
      expect(screenOfRoute(SCREEN_ROUTES[screen])).toBe(screen);
      expect(screenOfRoute(`${SCREEN_ROUTES[screen]}?x=1`)).toBe(screen);
    }
    expect(screenOfRoute('/index')).toBe('home');
  });

  it('answers null for a route that is no configurable screen, and for no route yet', () => {
    for (const route of ['/artikel', '/einstellungen', '/gespeichert', '/entdecken/x', undefined])
      expect(screenOfRoute(route)).toBeNull();
  });

  it('goes both ways without a loop: the picker’s screen is already the one its route maps to', () => {
    setScreen('mitmachen');
    expect(screenOfRoute(SCREEN_ROUTES[getScreen()])).toBe(getScreen());
    const before = getScreen();
    const followed = screenOfRoute(SCREEN_ROUTES.mitmachen);
    if (followed) setScreen(followed);
    expect(getScreen()).toBe(before);
    setScreen('home');
  });

  it('keeps an unsaved draft per screen while the editor moves with the frame', () => {
    setScreen('entdecken');
    const draft = moved(shippedOf('entdecken'), shippedOf('entdecken').sections[0]!.id, 1);
    setLayout(draft);
    setScreen('mitmachen');
    expect(getLayout()).not.toBe(draft);
    setScreen('entdecken');
    expect(getLayout()).toBe(draft);
  });
});

describe('the navigation editor', () => {
  it('prints the shipped file exactly and reports it as unchanged', () => {
    expect(formatNavigationDocument(SHIPPED_NAVIGATION)).toBe(read(NAVIGATION_FILE));
    expect(navigationDiffers(SHIPPED_NAVIGATION)).toBe(false);
  });

  it('names exactly the destinations the app declares', () => {
    const section = /export const DESTINATIONS[\s\S]*?\n};/.exec(APP('lib/tabTargets.ts'))![0];
    const ids = [...section.matchAll(/^ {2}(\w+): \{$/gm)].map((match) => match[1]);
    expect(Object.keys(DESTINATION_NAMES).sort()).toEqual(ids.sort());
  });

  it('accepts two to five tabs with Home first, and refuses the rest', () => {
    const doc = (tabs: unknown, maxTabs: unknown = 5) => ({ version: 1, tabs, maxTabs });
    expect(checkNavigation(doc(['entdecken'])).navigation).not.toBeNull();
    expect(checkNavigation(doc(['entdecken'], MIN_TABS)).navigation).not.toBeNull();
    expect(checkNavigation(doc(['entdecken'], MAX_TABS)).navigation).not.toBeNull();
    expect(checkNavigation(doc([])).problems.map((p) => p.code)).toEqual([
      'navigation-too-few-tabs',
    ]);
    expect(checkNavigation(doc(['entdecken'], MIN_TABS - 1)).navigation).toBeNull();
    expect(checkNavigation(doc(['entdecken'], MAX_TABS + 1)).navigation).toBeNull();
    expect(checkNavigation(doc(['index', 'entdecken'])).navigation).toBeNull();
    expect(checkNavigation(doc(['mehr'])).navigation).toBeNull();
    expect(checkNavigation(doc(['entdecken', 'entdecken'])).navigation).toBeNull();
    expect(checkNavigation(doc(['nirgends'])).navigation).toBeNull();
  });

  it('keeps Home out of every operation: it cannot be moved, added or removed', () => {
    expect(withTab(SHIPPED_NAVIGATION, 'index', true)).toBe(SHIPPED_NAVIGATION);
    expect(withTab(SHIPPED_NAVIGATION, 'index', false)).toBe(SHIPPED_NAVIGATION);
    expect(movedTab(SHIPPED_NAVIGATION, 'index', 1)).toBe(SHIPPED_NAVIGATION);
    expect(barOf(SHIPPED_NAVIGATION)!.tabs[0]).toBe('index');
  });

  it('moves, adds and removes entries and clamps the threshold', () => {
    const moved1 = movedTab(SHIPPED_NAVIGATION, SHIPPED_NAVIGATION.tabs[1]!, -1);
    expect(moved1.tabs[0]).toBe(SHIPPED_NAVIGATION.tabs[1]);
    expect(movedTab(SHIPPED_NAVIGATION, SHIPPED_NAVIGATION.tabs[0]!, -1)).toBe(SHIPPED_NAVIGATION);
    const without = withTab(SHIPPED_NAVIGATION, 'profil', false);
    expect(unused(without)).toEqual(['profil']);
    expect(withTab(without, 'profil', true).tabs.at(-1)).toBe('profil');
    expect(withMaxTabs(SHIPPED_NAVIGATION, 1).maxTabs).toBe(MIN_TABS);
    expect(withMaxTabs(SHIPPED_NAVIGATION, 9).maxTabs).toBe(MAX_TABS);
    expect(navigationDiffers(withMaxTabs(SHIPPED_NAVIGATION, 3))).toBe(true);
  });

  it('puts the surplus behind Mehr, which counts as a visible tab', () => {
    const bar = barOf(withMaxTabs(SHIPPED_NAVIGATION, 3))!;
    expect(bar.tabs).toHaveLength(3);
    expect(bar.tabs.at(-1)).toBe('mehr');
    expect(bar.more).toHaveLength(SHIPPED_NAVIGATION.tabs.length + 1 - 2);
  });
});

describe('the layout submission', () => {
  const entdecken = shippedOf('entdecken');
  const edited = moved(entdecken, entdecken.sections[0]!.id, 1);

  it('writes a screen to its own file and nowhere else', () => {
    const payload = layoutPayload(
      'entdecken',
      JSON.stringify(JSON.parse(formatLayoutDocument(edited))),
    );
    const applied = applyLayout(payload, repo);
    expect(applied.file).toBe(layoutFile('entdecken'));
    expect(applied.content).toBe(formatLayoutDocument(edited));
    expect(targetFile(payload)).toBe(layoutFile('entdecken'));
  });

  it('writes the navigation to its file', () => {
    const next = withMaxTabs(SHIPPED_NAVIGATION, 3);
    const payload = layoutPayload('navigation', JSON.stringify(next));
    const applied = applyLayout(payload, repo);
    expect(applied.file).toBe(NAVIGATION_FILE);
    expect(applied.content).toBe(formatNavigationDocument(next));
  });

  const refusal = (fn: () => unknown) => {
    try {
      fn();
    } catch (error) {
      return error instanceof Refusal ? error.code : String(error);
    }
    return null;
  };

  it('refuses an unchanged document, Home, an unknown target and a refused document', () => {
    const same = JSON.stringify(JSON.parse(formatLayoutDocument(entdecken)));
    expect(refusal(() => applyLayout(layoutPayload('entdecken', same), repo))).toBe('unchanged');
    expect(refusal(() => applyLayout(layoutPayload('home', same), repo))).toBe('layout-target');
    expect(refusal(() => applyLayout(layoutPayload('../x', same), repo))).toBe('layout-target');
    expect(refusal(() => applyLayout('{"document":{}}', repo))).toBe('layout-target');
    expect(
      refusal(() => applyLayout(layoutPayload('navigation', '{"version":1,"tabs":[]}'), repo)),
    ).toBe('refused');
    // A block the screen does not declare is the parser's to refuse (ADR 0071 §2).
    const foreign = JSON.parse(same) as { sections: { id: string; module: string }[] };
    foreign.sections[0]!.module = 'article-hero';
    expect(
      refusal(() => applyLayout(layoutPayload('entdecken', JSON.stringify(foreign)), repo)),
    ).toBe('refused');
  });

  it('allows the kind to write the other screens and the navigation, and nothing in Home’s file', () => {
    expect(fileOf('home')).toBeNull();
    expect(mayWriteLayout(layoutFile('profil'))).toBe(true);
    expect(mayWriteLayout(NAVIGATION_FILE)).toBe(true);
    expect(mayWriteLayout(layoutFile('home'))).toBe(false);
    expect(mayWriteLayout(`${LAYOUT_DIR}/screens/../../x.json`)).toBe(false);
    expect(mayWrite('layout', layoutFile('entdecken'))).toBe(true);
    expect(mayWrite('layout', layoutFile('home'))).toBe(false);
    expect(mayWrite('home', layoutFile('entdecken'))).toBe(false);
  });

  it('goes the whole way from an issue to a file', () => {
    const payload = layoutPayload('navigation', JSON.stringify(withMaxTabs(SHIPPED_NAVIGATION, 4)));
    const issue = issueFor('layout', payload, { heading: 'Navigation', lead: 'Lead' });
    expect(issue.title.startsWith('[layout]')).toBe(true);
    const applied = applyIssue(issue.title, issue.body, repo);
    expect(applied.kind).toBe('layout');
    expect(applied.files.map((file) => file.path)).toEqual([NAVIGATION_FILE]);
  });
});
