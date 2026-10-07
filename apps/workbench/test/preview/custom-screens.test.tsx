/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { formatLayoutDocument } from '../../src/preview/home/document';
import {
  layoutDraftKey,
  LAYOUT_SET_KEY,
  layoutKey,
  navigationDraftKey,
  NAVIGATION_KEY,
} from '../../src/preview/home/names';
import {
  blankScreen,
  routeAfterDeletion,
  routeOf,
  screenOfRoute,
} from '../../src/preview/home/screens';
import {
  changedScreens,
  createScreen,
  deletedScreenIds,
  deleteScreen,
  discardScreens,
  getLayout,
  getScreen,
  newScreenFault,
  restoreScreen,
  screenExists,
  screenIds,
  screenTitle,
  selectLayout,
  setLayout,
  setScreen,
} from '../../src/preview/home/store';
import { getNavigation } from '../../src/preview/navigation/store';
import { deletion, forgetMigration, submission } from '../../src/preview/home/write';

/**
 * The screens of a layout (ADR 0075 §7, ADR 0080), in the editor: the id is held to the
 * core's rule and the fault is told as text, a new screen opens on its own title and
 * `/s/<id>`, a draft that was never submitted is gone when deleted, a screen the repository
 * carries is deleted as a draft that outlives a reload, and what is submitted is the
 * envelope the workflow reads, naming its layout.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The frame's whole layout, as the app reads it. */
function frameSet(): { layout: string; navigation: { tabs: string[] }; screens: object } {
  return JSON.parse(window.localStorage.getItem(LAYOUT_SET_KEY) ?? 'null');
}

beforeEach(() => {
  window.localStorage.clear();
  forgetMigration();
  selectLayout('demo');
  discardScreens();
  setScreen('home');
});

const format = (message: { defaultMessage?: unknown }, values: Record<string, string> = {}) =>
  String(message.defaultMessage).replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

describe('making a screen', () => {
  it('opens it on its title, keeps the draft, tells the frame, and lists it with the rest', () => {
    expect(createScreen('kampagne', 'Kampagne')).toBeNull();

    expect(getScreen()).toBe('kampagne');
    expect(getLayout().words?.title.de).toBe('Kampagne');
    expect(screenIds()).toEqual([
      'entdecken',
      'home',
      'kampagne',
      'mediathek',
      'mitmachen',
      'profil',
    ]);
    expect(screenTitle('kampagne')).toBe('Kampagne');
    expect(window.localStorage.getItem(layoutDraftKey('demo', 'kampagne'))).toBe(
      formatLayoutDocument(blankScreen('Kampagne')),
    );
    expect(Object.keys(frameSet().screens)).toContain('kampagne');
    expect(changedScreens()).toBe('kampagne');
  });

  it('tells the core’s fault, and its own: a taken name, whichever screen holds it', () => {
    expect(newScreenFault('Kampagne')).toBe('malformed');
    expect(newScreenFault('')).toBe('empty');
    expect(newScreenFault('navigation')).toBe('reserved');
    expect(newScreenFault('x'.repeat(41))).toBe('too-long');
    // No screen is built in: `home` is taken in the demo because the demo has one.
    expect(newScreenFault('home')).toBe('taken');
    createScreen('kampagne', 'Kampagne');
    expect(newScreenFault('kampagne')).toBe('taken');
    expect(createScreen('kampagne', 'Zwei')).toBe('taken');
    expect(createScreen('Nope', 'Nope')).toBe('malformed');
  });

  it('allows a name the demo uses in a layout that has no such screen', () => {
    selectLayout('ship');
    expect(newScreenFault('home')).toBeNull();
    expect(createScreen('home', 'Start')).toBeNull();
    expect(screenIds()).toEqual(['home']);
  });

  it('is followed from the frame, at /s/<id>', () => {
    expect(routeOf('kampagne')).toBe('/s/kampagne');
    expect(screenOfRoute('/s/kampagne')).toBe('kampagne');
    expect(screenOfRoute('/s/kampagne?x=1#y')).toBe('kampagne');
    expect(screenOfRoute('/s/Not Valid')).toBeNull();
    expect(screenOfRoute('/s/a/b')).toBeNull();
  });
});

describe('deleting a screen', () => {
  it('forgets a draft altogether, from the list and from the frame', () => {
    createScreen('kampagne', 'Kampagne');
    deleteScreen('kampagne');

    expect(screenIds()).not.toContain('kampagne');
    expect(window.localStorage.getItem(layoutDraftKey('demo', 'kampagne'))).toBeNull();
    expect(Object.keys(frameSet().screens)).not.toContain('kampagne');
    expect(deletedScreenIds()).toEqual([]);
    expect(changedScreens()).toBe('');
  });

  it('takes a screen of the repository away as a draft, whatever its name', () => {
    for (const id of ['home', 'entdecken']) {
      deleteScreen(id);
      expect(screenIds()).not.toContain(id);
      expect(Object.keys(frameSet().screens)).not.toContain(id);
      expect(deletedScreenIds()).toContain(id);
    }
    expect(changedScreens().split(',')).toEqual(expect.arrayContaining(['home', 'entdecken']));
  });

  it('stays deleted after a reload, for as long as the draft is kept', () => {
    deleteScreen('entdecken');
    // A reload is a new page over the same storage: nothing in memory, the draft on disk.
    selectLayout('ship');
    selectLayout('demo');
    expect(screenIds()).not.toContain('entdecken');
    expect(deletedScreenIds()).toEqual(['entdecken']);
    expect(Object.keys(frameSet().screens)).not.toContain('entdecken');
  });

  it('opens the next screen, and the empty layout once the last one is gone', () => {
    deleteScreen('home');
    expect(getScreen()).toBe('entdecken');
    for (const id of screenIds()) deleteScreen(id);
    expect(screenIds()).toEqual([]);
    expect(screenExists()).toBe(false);
    expect(frameSet().screens).toEqual({});
  });

  it('sends the frame to the next screen, and to the start once none is left', () => {
    expect(routeAfterDeletion('entdecken', true)).toBe('/s/entdecken');
    expect(routeAfterDeletion(getScreen(), false)).toBe('/');
  });

  it('drops the tab of the deleted screen, so the layout still checks', () => {
    expect(getNavigation().tabs).toContain('entdecken');
    deleteScreen('entdecken');
    expect(getNavigation().tabs).not.toContain('entdecken');
    expect(frameSet().navigation.tabs).not.toContain('entdecken');
  });

  it('is taken back by Restore, and by Discard', () => {
    deleteScreen('mediathek');
    restoreScreen('mediathek');
    expect(screenIds()).toContain('mediathek');
    expect(deletedScreenIds()).toEqual([]);
    expect(Object.keys(frameSet().screens)).toContain('mediathek');

    deleteScreen('profil');
    discardScreens();
    expect(screenIds()).toContain('profil');
    expect(deletedScreenIds()).toEqual([]);
  });
});

describe('layouts', () => {
  it('keeps a draft per layout, so a change in one never shows in another', () => {
    createScreen('kampagne', 'Kampagne');
    selectLayout('ship');
    expect(screenIds()).toEqual([]);
    expect(frameSet()).toMatchObject({ layout: 'ship', screens: {} });
    selectLayout('demo');
    expect(screenIds()).toContain('kampagne');
    expect(frameSet().layout).toBe('demo');
  });

  it('hands the frame the whole of the chosen layout, the empty one included', () => {
    selectLayout('ship');
    expect(frameSet()).toEqual({
      layout: 'ship',
      navigation: { version: 1, maxTabs: 5, tabs: [] },
      screens: {},
    });
    selectLayout('demo');
    expect(Object.keys(frameSet().screens).sort()).toEqual(screenIds());
  });

  it('opens no layout that is not a folder', () => {
    expect(selectLayout('elsewhere')).toBe(false);
    expect(frameSet().layout).toBe('demo');
  });

  it('reads the keys an older visit left as the demo’s drafts, and writes to them no more', () => {
    window.localStorage.clear();
    forgetMigration();
    const draft = formatLayoutDocument(blankScreen('Alt'));
    window.localStorage.setItem(layoutKey('entdecken'), draft);
    window.localStorage.setItem(layoutKey('home'), draft);
    window.localStorage.setItem(NAVIGATION_KEY, '{"version":1,"maxTabs":3,"tabs":["home"]}');
    selectLayout('ship');
    selectLayout('demo');

    expect(window.localStorage.getItem(layoutDraftKey('demo', 'entdecken'))).toBe(draft);
    expect(window.localStorage.getItem(layoutDraftKey('demo', 'home'))).toBe(draft);
    expect(window.localStorage.getItem(navigationDraftKey('demo'))).toContain('"maxTabs": 3');
    expect(window.localStorage.getItem(layoutKey('entdecken'))).toBeNull();
    expect(window.localStorage.getItem(layoutKey('home'))).toBeNull();
    expect(window.localStorage.getItem(NAVIGATION_KEY)).toBeNull();
    setScreen('entdecken');
    expect(getLayout().words?.title.de).toBe('Alt');
  });
});

describe('submitting a screen', () => {
  it('sends the envelope the workflow reads, with the layout and the id', () => {
    createScreen('kampagne', 'Kampagne');
    const offer = submission(getLayout(), format, 'kampagne', 'demo');
    const body = decodeURIComponent(offer.href);
    expect(body).toContain('[layout]');
    expect(body).toContain('"layout":"demo","target":"kampagne"');
    expect(body).toContain('"title":{"de":"Kampagne"}');
  });

  it('names the layout it is for, whichever it is', () => {
    const offer = submission(blankScreen('Start'), format, 'home', 'ship');
    expect(decodeURIComponent(offer.href)).toContain('"layout":"ship","target":"home"');
  });

  it('asks for a deletion with a document of null, in the layout it is deleted from', () => {
    const offer = deletion('kampagne', 'demo', format);
    const body = decodeURIComponent(offer.href);
    expect(body).toContain('[layout] Delete the kampagne screen from the demo layout');
    expect(body).toContain('{"layout":"demo","target":"kampagne","document":null}');
  });

  it('renames through a write, which is what a change to the title is', () => {
    createScreen('kampagne', 'Kampagne');
    setLayout({ ...getLayout(), words: { title: { de: 'Sommer' } } });
    expect(screenTitle('kampagne')).toBe('Sommer');
    expect(window.localStorage.getItem(layoutDraftKey('demo', 'kampagne'))).toContain('Sommer');
  });
});
