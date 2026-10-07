/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE } from '../../src/i18n/language';
import { EditorBar } from '../../src/preview/home/Controls';
import { noticesOf } from '../../src/preview/home/notices';
import type { ScreensControl } from '../../src/preview/home/CustomScreens';
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
import type { ScenarioControl } from '../../src/preview/home/Scenario';
import { TooltipProvider } from '../../src/ui/kit/tooltip';

/**
 * The screens of a layout (ADR 0075 §7, ADR 0080), in the editor: the id is held to the
 * core's rule and the fault is told as text, a new screen opens on its own title and
 * `/s/<id>`, a draft that was never submitted is gone when deleted, a screen the repository
 * carries is deleted as a draft that outlives a reload, and what is submitted is the
 * envelope the workflow reads, naming its layout.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SCENARIO: ScenarioControl = {
  open: null,
  asking: null,
  choose: () => {},
  replace: () => {},
  keep: () => {},
  close: () => {},
};

let container: HTMLDivElement;
let root: Root;

const control: ScreensControl = {
  ids: [],
  titleOf: screenTitle,
  fault: newScreenFault,
  create: createScreen,
};

function draw(node: ReactNode): void {
  container = document.body.appendChild(document.createElement('div'));
  act(() => {
    root = createRoot(container);
    root.render(
      <Localisation language={SOURCE_LANGUAGE}>
        <TooltipProvider>{node}</TooltipProvider>
      </Localisation>,
    );
  });
}

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

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  document.body.innerHTML = '';
});

const format = (message: { defaultMessage?: unknown }, values: Record<string, string> = {}) =>
  String(message.defaultMessage).replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');

const byId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`) as HTMLElement;

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

describe('the bar', () => {
  const bar = (over: Partial<Parameters<typeof EditorBar>[0]> = {}): ReactNode => (
    <EditorBar
      screen="home"
      guarded={false}
      onScreen={() => {}}
      scenario={SCENARIO}
      follow
      onFollow={() => {}}
      screens={control}
      openScreen={null}
      notices={[]}
      {...over}
    />
  );
  const byTestId = (id: string) =>
    container.querySelector<HTMLElement>(`[data-testid="${id}"]`) as HTMLElement;

  it('offers a way to make a screen, and the way is a button with a name', () => {
    draw(bar());
    expect(byTestId('new-screen').getAttribute('aria-label')).toBe('New screen');
  });

  it('keeps Create off until the id and the title hold, and tells a fault in red', () => {
    draw(bar());
    act(() => byTestId('new-screen').click());
    const type = (id: string, value: string) =>
      act(() => {
        const field = byId(id) as HTMLInputElement;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
          field,
          value,
        );
        field.dispatchEvent(new Event('input', { bubbles: true }));
      });
    const create = () => byId('new-screen-create') as HTMLButtonElement;

    expect(create().disabled).toBe(true);
    type('new-screen-id', 'Home');
    type('new-screen-title', 'Start');
    expect(byId('new-screen-fault').className).toContain('text-red-500');
    expect(create().disabled).toBe(true);
    type('new-screen-id', 'kampagne');
    expect(create().disabled).toBe(false);
    type('new-screen-title', ' ');
    expect(create().disabled).toBe(true);
  });

  it('is switched off with the rest of the bar while a scenario is open', () => {
    draw(bar({ guarded: true }));
    expect((byTestId('new-screen') as HTMLButtonElement).disabled).toBe(true);
  });

  it('draws the open screen’s row: title as a field, the preview and the deletion', () => {
    createScreen('kampagne', 'Kampagne');
    draw(
      bar({
        screen: 'kampagne',
        screens: { ...control, ids: screenIds() },
        openScreen: {
          id: 'kampagne',
          title: 'Kampagne',
          words: getLayout().words,
          onTitle: () => {},
          onPreview: () => {},
          onDelete: () => {},
        },
      }),
    );
    const field = container.querySelector<HTMLInputElement>('input[aria-label="Title"]');
    // The field writes the language the interface is in, as every text setting does, so
    // under the English source it shows the English word and there is none yet.
    expect(field).not.toBeNull();
    expect(field?.value).toBe('');
    expect(byTestId('preview-screen').getAttribute('aria-label')).toContain('/s/kampagne');
    expect(byTestId('delete-screen').getAttribute('aria-label')).toBe('Delete this screen');
    // Icons with a name, so neither button draws a word of its own.
    expect(byTestId('preview-screen').textContent).toBe('');
    expect(byTestId('delete-screen').textContent).toBe('');
  });

  it('asks before it deletes, and deletes on the answer and not on the first press', () => {
    let deleted = 0;
    draw(
      bar({
        openScreen: {
          id: 'kampagne',
          title: 'Kampagne',
          words: null,
          onTitle: () => {},
          onPreview: () => {},
          onDelete: () => (deleted += 1),
        },
      }),
    );
    act(() => byTestId('delete-screen').click());
    expect(deleted).toBe(0);
    expect(document.body.textContent).toContain('Delete “Kampagne”?');
    act(() => byId('delete-screen-confirm').click());
    expect(deleted).toBe(1);
  });

  it('says what a deletion is in the notifications: a draft, with a way back and a way to submit it', () => {
    let restored = '';
    draw(
      bar({
        notices: noticesOf({
          layout: 'demo',
          deleted: [
            {
              id: 'entdecken',
              title: 'Entdecken',
              href: 'https://github.com/x/y/issues/new?title=z',
              onRestore: () => (restored = 'entdecken'),
            },
          ],
        }),
      }),
    );
    // The bar itself says no sentence: the hint is behind the bell, which counts it.
    expect(byTestId('notifications-badge').textContent).toBe('1');
    act(() => byTestId('notifications').click());
    expect(byId('notifications-list').textContent).toContain(
      'Deleted “Entdecken” in this draft only',
    );
    expect(byId('submit-deletion-entdecken').getAttribute('href')).toContain('issues/new');
    expect(byId('restore-screen-entdecken').getAttribute('aria-label')).toBe('Restore Entdecken');
    act(() => byId('restore-screen-entdecken').click());
    expect(restored).toBe('entdecken');
  });

  it('has no badge while there is nothing to say', () => {
    draw(bar());
    expect(container.querySelector('[data-testid="notifications-badge"]')).toBeNull();
    expect(byTestId('notifications').getAttribute('data-level')).toBe('none');
  });
});
