import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { allBlocks, blocksByCategory } from '@correctiv/app-core/lib/block-category';
import {
  CONFIGURABLE_SCREENS,
  parseScreenDocument,
  type ConfigurableScreen,
} from '@correctiv/app-core/lib/screen-layout';
import { MAX_TABS, MIN_MAX_TABS } from '@correctiv/app-core/lib/navigation';
import { DEMO_SCREENS } from '@correctiv/app-core/data/layouts/demo/bundle';

import { ROOT } from '../../plugin/collect.ts';
import {
  applyLayout,
  fileOf,
  mayWriteLayout,
  targetFile,
} from '../../scripts/submission-layout.ts';
import { Refusal } from '../../scripts/submission.ts';
import { applyIssue, KINDS, mayWrite } from '../../scripts/submission-kinds.ts';
import { formatLayoutDocument, moved, MODULE_LABELS } from '../../src/preview/home/document';
import {
  layoutFile,
  layoutKey,
  layoutDir,
  NAVIGATION_FILE,
  NAVIGATION_KEY,
} from '../../src/preview/home/names';
import {
  screenOfRoute,
  SCREEN_ICONS,
  shippedOf,
  routeOf,
  SCREEN_ROUTES,
} from '../../src/preview/home/screens';
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

describe('the screen picker and its palette', () => {
  it('knows every screen the core configures, with a route each', () => {
    expect(Object.keys(SCREEN_ROUTES).sort()).toEqual([...CONFIGURABLE_SCREENS].sort());
  });

  it('offers one palette to every screen, with each one’s shipped blocks among them', () => {
    const palette = allBlocks();
    expect(palette.length).toBeGreaterThan(20);
    for (const screen of CONFIGURABLE_SCREENS) {
      for (const section of shippedOf(screen).sections) expect(palette).toContain(section.module);
    }
  });

  /**
   * ADR 0073 §1, which is the product decision this editor exists to serve: the pairs
   * below were each impossible before it. ADR 0075 §6 finished it — the four titles were
   * the last thing a screen was not offered, and the one header that replaced them prints
   * the name of wherever it is put.
   */
  it('offers a block of every screen on every other, the header included', () => {
    expect(allBlocks()).toContain('live-radio-banner');
    expect(allBlocks()).toContain('podcast-rail');
    expect(allBlocks()).toContain('article-hero');
    expect(allBlocks()).toContain('faktencheck-rail');
    expect(allBlocks()).toContain('screen-header');
  });

  it('names every block a palette can offer, and puts it in exactly one group', () => {
    for (const module of allBlocks()) expect(MODULE_LABELS[module]).toBeDefined();
    const groups = blocksByCategory();
    expect(groups.flatMap((group) => group.blocks).sort()).toEqual([...allBlocks()].sort());
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

describe('the screen switcher’s icons', () => {
  /**
   * The Ionicons name the app's own tab bar gives each screen.
   *
   * **Out of two places, because the answer is in two** (ADR 0075 §4 and §5): the KEY is
   * in the screen's own document now, which is data this half of the repository may read
   * outright, and the key is declared with its six native names in the app's
   * `screenIcons.ts`, which only text can reach — the app is not importable from Node
   * and its icon components are React Native's. Read either half alone and the answer is
   * a name or a key rather than the mark the tab bar actually draws.
   *
   * It used to read `DESTINATIONS` in `tabTargets.ts` for the key. That table declared a
   * destination's icon until ADR 0075 §5 took the words and the icon out of the app, so
   * reading it now would be reading a table that no longer answers the question.
   */
  function appIonicon(screen: ConfigurableScreen): string | null {
    const key = parseScreenDocument(DEMO_SCREENS[screen]).words?.icon;
    if (key === undefined) return null;
    const icons = /export const SCREEN_ICONS[\s\S]*?\n};/.exec(APP('lib/screenIcons.ts'))![0];
    /*
     * `[{ ]active` and not `active`: `inactive:` ends in it, and a search without
     * the leading character reads `compass-outline` where it means `compass`.
     */
    const at = new RegExp(
      `\\n {2}${key}: \\{[\\s\\S]*?ionicon: \\{[^}]*[{ ]active: '([^']+)'`,
    ).exec(icons);
    return at === null ? null : at[1]!;
  }

  it('gives every screen a mark', () => {
    expect(Object.keys(SCREEN_ICONS).sort()).toEqual([...CONFIGURABLE_SCREENS].sort());
    for (const screen of CONFIGURABLE_SCREENS) expect(SCREEN_ICONS[screen].Icon).toBeTruthy();
  });

  it('draws the app’s own tab icon for each of them', () => {
    // The editor's switcher stands in for the app's tab bar, so a screen marked
    // differently in the two is a mark somebody has to learn twice. Home is no longer
    // read apart: its icon is in its document like every other screen's (ADR 0075 §3),
    // where it used to be the tab bar's fixed first entry and nothing else.
    // One object per screen rather than an `expect` each, as `tool-panel.test.tsx`
    // does it: a failure names every screen whose mark has drifted, and they drift
    // together, because the drift is one rename.
    expect(
      Object.fromEntries(
        CONFIGURABLE_SCREENS.map((of) => [
          of,
          SCREEN_ICONS[of].ionicon === appIonicon(of) ? 'the app’s mark' : SCREEN_ICONS[of].ionicon,
        ]),
      ),
    ).toEqual(Object.fromEntries(CONFIGURABLE_SCREENS.map((of) => [of, 'the app’s mark'])));
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
    expect(screenOfRoute(routeOf(getScreen()))).toBe(getScreen());
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

  it('offers exactly the screens the demo layout carries', () => {
    expect(Object.keys(DESTINATION_NAMES).sort()).toEqual([...CONFIGURABLE_SCREENS].sort());
    expect(Object.keys(DESTINATION_NAMES).sort()).toEqual(Object.keys(DEMO_SCREENS).sort());
  });

  it('accepts any number of entries and a threshold of two to five, and refuses the rest', () => {
    const doc = (tabs: unknown, maxTabs: unknown = 5) => ({ version: 1, tabs, maxTabs });
    expect(checkNavigation(doc(['entdecken'])).navigation).not.toBeNull();
    expect(checkNavigation(doc(['entdecken'], MIN_MAX_TABS)).navigation).not.toBeNull();
    expect(checkNavigation(doc(['entdecken'], MAX_TABS)).navigation).not.toBeNull();
    expect(checkNavigation(doc([])).navigation).not.toBeNull();
    expect(checkNavigation(doc(['entdecken'], MIN_MAX_TABS - 1)).navigation).toBeNull();
    expect(checkNavigation(doc(['entdecken'], MAX_TABS + 1)).navigation).toBeNull();
    expect(checkNavigation(doc(['home', 'entdecken'])).navigation).not.toBeNull();
    expect(checkNavigation(doc(['mehr'])).navigation).toBeNull();
    expect(checkNavigation(doc(['entdecken', 'entdecken'])).navigation).toBeNull();
    expect(checkNavigation(doc(['Nirgends'])).navigation).toBeNull();
  });

  it('treats Home as an entry like any other: it can be moved and taken off, and is first only by position', () => {
    expect(SHIPPED_NAVIGATION.tabs[0]).toBe('home');
    expect(barOf(SHIPPED_NAVIGATION).start).toBe('home');
    const homeSecond = movedTab(SHIPPED_NAVIGATION, 'home', 1);
    expect(homeSecond.tabs.slice(0, 2)).toEqual(['entdecken', 'home']);
    expect(barOf(homeSecond).start).toBe('entdecken');
    expect(withTab(SHIPPED_NAVIGATION, 'home', false).tabs).not.toContain('home');
    expect(withTab(SHIPPED_NAVIGATION, 'index', true)).toBe(SHIPPED_NAVIGATION);
  });

  it('lets the last entry go: a bar of none is the empty state, and of one the screen alone', () => {
    const none = SHIPPED_NAVIGATION.tabs.reduce(
      (nav, id) => withTab(nav, id, false),
      SHIPPED_NAVIGATION,
    );
    expect(none.tabs).toEqual([]);
    expect(barOf(none).kind).toBe('empty');
    expect(barOf(withTab(none, 'profil', true))).toMatchObject({ kind: 'single', start: 'profil' });
    expect(checkNavigation(none).navigation).not.toBeNull();
  });

  it('moves, adds and removes entries and clamps the threshold', () => {
    const moved1 = movedTab(SHIPPED_NAVIGATION, SHIPPED_NAVIGATION.tabs[1]!, -1);
    expect(moved1.tabs[0]).toBe(SHIPPED_NAVIGATION.tabs[1]);
    expect(movedTab(SHIPPED_NAVIGATION, SHIPPED_NAVIGATION.tabs[0]!, -1)).toBe(SHIPPED_NAVIGATION);
    const without = withTab(SHIPPED_NAVIGATION, 'profil', false);
    expect(unused(without)).toEqual(['profil']);
    expect(withTab(without, 'profil', true).tabs.at(-1)).toBe('profil');
    expect(withMaxTabs(SHIPPED_NAVIGATION, 1).maxTabs).toBe(MIN_MAX_TABS);
    expect(withMaxTabs(SHIPPED_NAVIGATION, 9).maxTabs).toBe(MAX_TABS);
    expect(navigationDiffers(withMaxTabs(SHIPPED_NAVIGATION, 3))).toBe(true);
  });

  it('puts the surplus behind Mehr, which counts as a visible tab', () => {
    const bar = barOf(withMaxTabs(SHIPPED_NAVIGATION, 3));
    expect(bar.tabs).toHaveLength(3);
    expect(bar.tabs.at(-1)).toBe('mehr');
    expect(bar.more).toHaveLength(SHIPPED_NAVIGATION.tabs.length - 2);
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

  it('carries the layout it is about in the payload, first, beside target and document', () => {
    const payload = layoutPayload('entdecken', '{}', undefined, 'ship');
    expect(payload).toBe('{"layout":"ship","target":"entdecken","document":{}}');
    expect(layoutPayload('entdecken', '{}')).toContain('"layout":"demo"');
    expect(layoutPayload('entdecken', '{}', 'link')).toBe(
      '{"layout":"demo","target":"entdecken","document":{},"via":"link"}',
    );
  });

  it('writes into the layout the payload names, and into no other', () => {
    const base = 'packages/app-core/src/data/layouts';
    expect(fileOf('ship', 'entdecken')).toBe(`${base}/ship/screens/entdecken.json`);
    expect(fileOf('ship', 'navigation')).toBe(`${base}/ship/navigation.json`);
    expect(targetFile(layoutPayload('home', '{}', undefined, 'ship'))).toBe(
      `${base}/ship/screens/home.json`,
    );
    expect(mayWriteLayout(`${base}/ship/screens/home.json`)).toBe(true);
    expect(mayWriteLayout(`${base}/ship/navigation.json`)).toBe(true);
  });

  it('refuses a layout whose id is not one, whatever it would spell as a path', () => {
    const same = JSON.stringify(JSON.parse(formatLayoutDocument(entdecken)));
    for (const id of ['Demo', '../demo', 'a/b', 'a.b', '', 'a'.repeat(41)])
      expect(
        refusal(() => applyLayout(layoutPayload('entdecken', same, undefined, id), repo)),
      ).toBe('layout-id');
    expect(fileOf('../demo', 'entdecken')).toBeNull();
    for (const path of [
      'packages/app-core/src/data/layouts/../x/navigation.json',
      'packages/app-core/src/data/layouts/Demo/navigation.json',
      'packages/app-core/src/data/layouts/demo/screens/a/b.json',
      'packages/app-core/src/data/layouts/demo/x.json',
      'packages/app-core/src/data/layouts/demo/screens/navigation.json',
    ])
      expect(mayWriteLayout(path)).toBe(false);
  });

  it('refuses a payload without a layout, and a layout the repository does not hold', () => {
    const same = JSON.stringify(JSON.parse(formatLayoutDocument(entdecken)));
    expect(refusal(() => applyLayout(`{"target":"entdecken","document":${same}}`, repo))).toBe(
      'layout-target',
    );
    expect(
      refusal(() => applyLayout(layoutPayload('entdecken', same, undefined, 'elsewhere'), repo)),
    ).toBe('layout-unknown');
  });

  it('accepts a navigation with no entry, which is what a layout with no screen carries', () => {
    const payload = layoutPayload('navigation', '{"version":1,"maxTabs":5,"tabs":[]}');
    const noTabs = {
      ...repo,
      read: (path: string) => (path === NAVIGATION_FILE ? '{}' : read(path)),
    };
    const applied = applyLayout(payload, noTabs);
    expect(applied.content).toBe('{\n  "version": 1,\n  "maxTabs": 5,\n  "tabs": []\n}\n');
  });

  it('refuses an unchanged document, an unknown target and a refused document', () => {
    const same = JSON.stringify(JSON.parse(formatLayoutDocument(entdecken)));
    expect(refusal(() => applyLayout(layoutPayload('entdecken', same), repo))).toBe('unchanged');
    expect(refusal(() => applyLayout(layoutPayload('../x', same), repo))).toBe('layout-target');
    expect(refusal(() => applyLayout('{"document":{}}', repo))).toBe('layout-target');
    expect(
      refusal(() =>
        applyLayout(layoutPayload('navigation', '{"version":1,"tabs":["Nirgends"]}'), repo),
      ),
    ).toBe('refused');
    // A module the app holds no renderer for, which is what `module-unrecognised` says
    // and the last of what this kind refuses. What it used to refuse as well — another
    // screen's own title — is gone with ADR 0075 §6's one header.
    const unknown = JSON.parse(same) as { sections: { id: string; module: string }[] };
    unknown.sections[0]!.module = 'quiz-of-the-day';
    expect(
      refusal(() => applyLayout(layoutPayload('entdecken', JSON.stringify(unknown)), repo)),
    ).toBe('refused');
  });

  it('allows the kind to write every screen and the navigation of a layout, and nothing else', () => {
    expect(fileOf('demo', 'home')).toBe(layoutFile('home'));
    expect(mayWriteLayout(layoutFile('profil'))).toBe(true);
    expect(mayWriteLayout(NAVIGATION_FILE)).toBe(true);
    expect(mayWriteLayout(layoutFile('home'))).toBe(true);
    expect(mayWriteLayout(`${layoutDir()}/screens/../../x.json`)).toBe(false);
    expect(mayWrite('layout', layoutFile('entdecken'))).toBe(true);
    expect(mayWrite('layout', layoutFile('home'))).toBe(true);
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

const code = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof Refusal ? error.code : String(error);
  }
  return null;
};

describe('the layout submission for a screen the newsroom made (ADR 0075 §7)', () => {
  const campaign = {
    ...shippedOf('entdecken'),
    words: { title: { de: 'Kampagne' } },
  };
  const document = JSON.stringify(JSON.parse(formatLayoutDocument(campaign)));
  /** A repository with no file for the screen, which is what `main` has before the pull request. */
  const without = {
    read: (path: string) => {
      if (path === layoutFile('kampagne')) throw new Error('ENOENT');
      return read(path);
    },
    list: () => [] as string[],
  };
  /** One that has it. */
  const withIt = {
    read: (path: string) =>
      path === layoutFile('kampagne') ? formatLayoutDocument(campaign) : read(path),
    list: () => [] as string[],
  };

  it('creates the file under screens/ from an id the core accepts', () => {
    const payload = layoutPayload('kampagne', document);
    const applied = applyLayout(payload, without);
    expect(applied.file).toBe(layoutFile('kampagne'));
    expect(applied.content).toBe(formatLayoutDocument(campaign));
    expect(applied.summary).toContain('Neuer Bildschirm');
    expect(targetFile(payload)).toBe(`${layoutDir()}/screens/kampagne.json`);
    expect(mayWrite('layout', layoutFile('kampagne'))).toBe(true);
  });

  it('refuses an id the core would not, and a file name the id could not make', () => {
    for (const id of ['Kampagne', 'a/b', '..', 'a--b', '-a', 'a.json', 'x'.repeat(41), '']) {
      expect(code(() => applyLayout(layoutPayload(id, document), without))).toBe('layout-target');
    }
    expect(mayWrite('layout', `${layoutDir()}/screens/Kampagne.json`)).toBe(false);
    expect(mayWrite('layout', `${layoutDir()}/screens/a/b.json`)).toBe(false);
    expect(mayWrite('layout', `${layoutDir()}/other/kampagne.json`)).toBe(false);
  });

  it('refuses a new screen that has no German title', () => {
    const nameless = JSON.stringify({
      ...JSON.parse(document),
      title: undefined,
      words: undefined,
    });
    expect(code(() => applyLayout(layoutPayload('kampagne', nameless), without))).toBe('refused');
  });

  it('deletes any screen that exists, and never the navigation', () => {
    const payload = layoutPayload('kampagne', 'null');
    const applied = applyLayout(payload, withIt);
    expect(applied.content).toBeNull();
    expect(applied.file).toBe(layoutFile('kampagne'));
    expect(applied.summary).toContain('gelöscht');
    expect(code(() => applyLayout(payload, without))).toBe('unchanged');
    for (const built of ['entdecken', 'home'])
      expect(applyLayout(layoutPayload(built, 'null'), withIt).content).toBeNull();
    // The navigation is the one document a layout cannot be without.
    expect(code(() => applyLayout(layoutPayload('navigation', 'null'), withIt))).toBe(
      'layout-target',
    );
  });

  it('proves a created file as untracked, a deleted one as deleted, and nothing else', () => {
    const create = layoutPayload('kampagne', document);
    const remove = layoutPayload('kampagne', 'null');
    const file = layoutFile('kampagne');
    const verify = (payload: string, status: string, path = file) =>
      KINDS.layout!.verify(payload, [{ status, path }], {
        before: read,
        after: read,
        list: () => [],
      });
    expect(verify(create, '??')).toEqual([]);
    expect(verify(create, ' M')).toEqual([]);
    expect(verify(create, ' D')).not.toEqual([]);
    expect(verify(remove, ' D')).toEqual([]);
    expect(verify(remove, '??')).not.toEqual([]);
    expect(verify(create, '??', layoutFile('profil'))).not.toEqual([]);
  });

  it('goes the whole way from an issue to a created file', () => {
    const issue = issueFor('layout', layoutPayload('kampagne', document), {
      heading: 'Kampagne',
      lead: 'Lead',
    });
    const applied = applyIssue(issue.title, issue.body, without);
    expect(applied.files.map((file) => file.path)).toEqual([layoutFile('kampagne')]);
    expect(applied.removed ?? []).toEqual([]);
  });

  it('goes the whole way from an issue to a deleted file, which is removed and not written', () => {
    const issue = issueFor('layout', layoutPayload('kampagne', 'null'), {
      heading: 'Kampagne löschen',
      lead: 'Lead',
    });
    const applied = applyIssue(issue.title, issue.body, withIt);
    expect(applied.files).toEqual([]);
    expect(applied.removed).toEqual([layoutFile('kampagne')]);
  });
});
