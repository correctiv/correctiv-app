/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE } from '../../src/i18n/language';
import { EditorBar } from '../../src/preview/home/Controls';
import type { CustomScreensControl } from '../../src/preview/home/CustomScreens';
import { formatLayoutDocument } from '../../src/preview/home/document';
import { layoutKey } from '../../src/preview/home/names';
import { blankScreen, routeOf, screenOfRoute } from '../../src/preview/home/screens';
import {
  changedScreens,
  createScreen,
  customScreenIds,
  deleteScreen,
  discardScreens,
  getLayout,
  getScreen,
  newScreenFault,
  screenTitle,
  setLayout,
  setScreen,
} from '../../src/preview/home/store';
import { deletion, submission } from '../../src/preview/home/write';
import type { ScenarioControl } from '../../src/preview/home/Scenario';
import { TooltipProvider } from '../../src/ui/kit/tooltip';

/**
 * The screens the newsroom makes (ADR 0075 §7), in the editor: the id is held to the core's
 * rule and the fault is told as text, a new screen opens on its own title and `/s/<id>`, a
 * draft that was never submitted is gone when deleted, and what is submitted is the
 * envelope the workflow reads.
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

const control: CustomScreensControl = {
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

beforeEach(() => {
  window.localStorage.clear();
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

describe('making a screen', () => {
  it('opens it on its title, writes it where the frame looks, and lists it', () => {
    expect(createScreen('kampagne', 'Kampagne')).toBeNull();

    expect(getScreen()).toBe('kampagne');
    expect(getLayout().words?.title.de).toBe('Kampagne');
    expect(customScreenIds()).toEqual(['kampagne']);
    expect(screenTitle('kampagne')).toBe('Kampagne');
    expect(window.localStorage.getItem(layoutKey('kampagne'))).toBe(
      formatLayoutDocument(blankScreen('Kampagne')),
    );
    expect(changedScreens()).toBe('kampagne');
  });

  it('tells the core’s fault, and its own: a taken name', () => {
    expect(newScreenFault('Kampagne')).toBe('malformed');
    expect(newScreenFault('')).toBe('empty');
    expect(newScreenFault('home')).toBe('declared');
    expect(newScreenFault('navigation')).toBe('reserved');
    expect(newScreenFault('x'.repeat(41))).toBe('too-long');
    createScreen('kampagne', 'Kampagne');
    expect(newScreenFault('kampagne')).toBe('taken');
    expect(createScreen('kampagne', 'Zwei')).toBe('taken');
    expect(createScreen('Nope', 'Nope')).toBe('malformed');
    expect(customScreenIds()).toEqual(['kampagne']);
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
  it('forgets a draft altogether, from the list and from the frame’s storage', () => {
    createScreen('kampagne', 'Kampagne');
    deleteScreen('kampagne');

    expect(customScreenIds()).toEqual([]);
    expect(window.localStorage.getItem(layoutKey('kampagne'))).toBeNull();
    expect(getScreen()).toBe('home');
    expect(changedScreens()).toBe('');
  });

  it('leaves a declared screen alone', () => {
    deleteScreen('entdecken');
    expect(window.localStorage.getItem(layoutKey('entdecken'))).toBeNull();
    setScreen('entdecken');
    expect(getScreen()).toBe('entdecken');
  });
});

describe('submitting a screen the newsroom made', () => {
  it('sends the envelope the workflow reads, with the id as the target', () => {
    createScreen('kampagne', 'Kampagne');
    const offer = submission(getLayout(), format, 'kampagne');
    const body = decodeURIComponent(offer.href);
    expect(body).toContain('[layout]');
    expect(body).toContain('"target":"kampagne"');
    expect(body).toContain('"title":{"de":"Kampagne"}');
  });

  it('asks for a deletion with a document of null', () => {
    const offer = deletion('kampagne', format);
    const body = decodeURIComponent(offer.href);
    expect(body).toContain('[layout] Delete the kampagne screen');
    expect(body).toContain('{"layout":"demo","target":"kampagne","document":null}');
  });

  it('renames through a write, which is what a change to the title is', () => {
    createScreen('kampagne', 'Kampagne');
    setLayout({ ...getLayout(), words: { title: { de: 'Sommer' } } });
    expect(screenTitle('kampagne')).toBe('Sommer');
    expect(window.localStorage.getItem(layoutKey('kampagne'))).toContain('Sommer');
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
      custom={control}
      {...over}
    />
  );
  const byTestId = (id: string) =>
    container.querySelector<HTMLElement>(`[data-testid="${id}"]`) as HTMLElement;

  it('offers a way to make a screen, and the way is a button with a name', () => {
    draw(bar());
    expect(byTestId('new-screen').getAttribute('aria-label')).toBe('New screen');
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
        custom: { ...control, ids: customScreenIds() },
        openCustom: {
          id: 'kampagne',
          words: getLayout().words,
          onTitle: () => {},
          onPreview: () => {},
          submitDeletion: null,
          onDelete: () => {},
        },
      }),
    );
    const field = container.querySelector<HTMLInputElement>('input[aria-label="Title"]');
    // The field writes the language the interface is in, as every text setting does, so
    // under the English source it shows the English word and there is none yet.
    expect(field).not.toBeNull();
    expect(field?.value).toBe('');
    expect(byTestId('preview-screen').textContent).toContain('/s/kampagne');
    expect(byTestId('delete-screen').textContent).toBe('Delete this screen');
  });

  it('makes the deletion of a repository screen a link to the issue, not a button', () => {
    draw(
      bar({
        screen: 'kampagne',
        custom: { ...control, ids: ['kampagne'] },
        openCustom: {
          id: 'kampagne',
          words: blankScreen('Kampagne').words,
          onTitle: () => {},
          onPreview: () => {},
          submitDeletion: { href: 'https://github.com/x/y/issues/new?title=z' },
          onDelete: () => {},
        },
      }),
    );
    const link = byTestId('delete-screen');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toContain('issues/new');
  });
});
