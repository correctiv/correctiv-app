import { describe, expect, it } from 'vitest';

import { EXAMPLE_LAYOUT, layoutBundle } from '@correctiv/app-core/data/layouts/registry';
import { parseHomeLayout } from '@correctiv/app-core/lib/home-layout';
import { SHIPPED_LAYOUT } from '@correctiv/app-core/lib/screen-layout';

import { applyLayout, fileOf, mayWriteLayout } from '../../scripts/submission-layout.ts';
import { applyIssue, mayWrite } from '../../scripts/submission-kinds.ts';
import { formatLayoutDocument } from '../../src/preview/home/document';
import { layoutDraftKey, layoutFile, navigationDraftKey } from '../../src/preview/home/names';
import {
  layoutIdsOf,
  navigationOf,
  readRepository,
  type Repository,
} from '../../src/preview/home/screens';
import { pack, unpack } from '../../src/preview/share';
import { issueFor, layoutPayload } from '../../src/preview/submission';

/**
 * A layout the repository does not have. Everything the workbench knows about layouts has
 * to work for a third one with nothing but its folder and its line in the registry's list,
 * so these tests hand each piece the files of one called `newsroom`.
 */
const THIRD = 'newsroom';
const BASE = '/repo/packages/app-core/src/data/layouts';
const home = layoutBundle(EXAMPLE_LAYOUT)!.screens.home;
const PARSED = parseHomeLayout(home).layout!;
const NAVIGATION = { version: 1, maxTabs: 5, tabs: ['home'] };

const NAVIGATION_FILES = {
  [`${BASE}/ship/navigation.json`]: { version: 1, maxTabs: 5, tabs: [] },
  [`${BASE}/demo/navigation.json`]: { version: 1, maxTabs: 5, tabs: ['home'] },
  [`${BASE}/${THIRD}/navigation.json`]: NAVIGATION,
};
const SCREEN_FILES = {
  [`${BASE}/demo/screens/home.json`]: home,
  [`${BASE}/${THIRD}/screens/home.json`]: home,
  [`${BASE}/${THIRD}/screens/Nope.json`]: home,
};

describe('a third layout in the picker', () => {
  const repository: Repository = readRepository(NAVIGATION_FILES, SCREEN_FILES);

  it('is listed after ship and demo, and the shipped one stays first', () => {
    expect(layoutIdsOf(repository)).toEqual([SHIPPED_LAYOUT, EXAMPLE_LAYOUT, THIRD]);
    expect(
      layoutIdsOf(
        readRepository({ ...NAVIGATION_FILES, [`${BASE}/alpha/navigation.json`]: {} }, {}),
      ),
    ).toEqual([SHIPPED_LAYOUT, EXAMPLE_LAYOUT, 'alpha', THIRD]);
  });

  it('holds its screens by valid id and leaves a file that is none out', () => {
    expect([...repository.get(THIRD)!.keys()]).toEqual(['home']);
  });

  it('starts from the navigation its folder carries, and from an empty one without a file', () => {
    expect(navigationOf(NAVIGATION_FILES, THIRD)).toEqual(NAVIGATION);
    expect(navigationOf(NAVIGATION_FILES, 'missing').tabs).toEqual([]);
  });
});

describe('a third layout’s drafts, links and submissions', () => {
  it('keeps its drafts apart from every other layout’s', () => {
    expect(layoutDraftKey(THIRD, 'home')).toBe(`workbench:layout:${THIRD}:home`);
    expect(layoutDraftKey(THIRD, 'home')).not.toBe(layoutDraftKey(EXAMPLE_LAYOUT, 'home'));
    expect(navigationDraftKey(THIRD)).not.toBe(navigationDraftKey(EXAMPLE_LAYOUT));
  });

  it('keeps the layout a link names, and reads a link that names none as the example', async () => {
    const named = await unpack(await pack({ screen: 'home', document: '{}', layout: THIRD }));
    expect(named).toMatchObject({ draft: { layout: THIRD } });
    const legacy = await unpack(
      await pack({ screen: 'home', document: '{}' } as Parameters<typeof pack>[0]),
    );
    expect(legacy).toMatchObject({ draft: { layout: EXAMPLE_LAYOUT } });
  });

  const files: Record<string, string> = {
    [layoutFile('home', THIRD)]: formatLayoutDocument(PARSED),
    [`packages/app-core/src/data/layouts/${THIRD}/navigation.json`]: JSON.stringify(NAVIGATION),
  };
  const repo = {
    read: (path: string) => {
      if (path in files) return files[path]!;
      throw new Error('ENOENT');
    },
    list: () => [] as string[],
  };

  it('writes into its own folder and nowhere else', () => {
    expect(fileOf(THIRD, 'home')).toBe(layoutFile('home', THIRD));
    expect(mayWriteLayout(layoutFile('home', THIRD))).toBe(true);
    expect(mayWrite('layout', layoutFile('kampagne', THIRD))).toBe(true);
    expect(mayWriteLayout(`packages/app-core/src/data/layouts/${THIRD}/other/x.json`)).toBe(false);
  });

  it('goes from an issue to a file in the third layout, and refuses a layout with no folder', () => {
    const document = JSON.stringify(
      JSON.parse(formatLayoutDocument({ ...PARSED, words: { title: { de: 'Neu' } } })),
    );
    const payload = layoutPayload('kampagne', document, undefined, THIRD);
    const applied = applyLayout(payload, repo);
    expect(applied.file).toBe(layoutFile('kampagne', THIRD));
    const issue = issueFor('layout', payload, { heading: 'Neu', lead: 'Lead' });
    expect(applyIssue(issue.title, issue.body, repo).files.map((file) => file.path)).toEqual([
      layoutFile('kampagne', THIRD),
    ]);
    expect(() =>
      applyLayout(layoutPayload('kampagne', document, undefined, 'ghost'), repo),
    ).toThrow(expect.objectContaining({ code: 'layout-unknown' }));
  });
});
