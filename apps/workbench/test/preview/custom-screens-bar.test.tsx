/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE } from '../../src/i18n/language';
import { EditorBar } from '../../src/preview/home/Controls';
import { NoticeList } from '../../src/preview/home/NotificationCenter';
import { noticesOf } from '../../src/preview/home/notices';
import type { ScreensControl } from '../../src/preview/home/CustomScreens';
import {
  createScreen,
  discardScreens,
  getLayout,
  newScreenFault,
  screenIds,
  screenTitle,
  selectLayout,
  setScreen,
} from '../../src/preview/home/store';
import { forgetMigration } from '../../src/preview/home/write';
import type { ScenarioControl } from '../../src/preview/home/Scenario';
import { TooltipProvider } from '../../src/ui/kit/tooltip';

/**
 * The bar above the block list while screens are being made, opened and deleted: the form, the
 * open screen's row, the question before a deletion and the notifications' list. Its own file
 * because every render of the bar costs seconds in jsdom, and a file that draws many of them
 * blocks its worker past vitest's reporting timeout.
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

const byId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`) as HTMLElement;

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

  it('offers a way to make a screen, and a silent bell', () => {
    draw(bar());
    expect(byTestId('new-screen').getAttribute('aria-label')).toBe('New screen');
    // Nothing to say, so the bell carries no count.
    expect(container.querySelector('[data-testid="notifications-badge"]')).toBeNull();
    expect(byTestId('notifications').getAttribute('data-level')).toBe('none');
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
    // Closed again, because a popover left open makes every later render in the file slower.
    act(() => byTestId('new-screen').click());
  });

  it('is switched off with the rest of the bar while a scenario is open', () => {
    draw(bar({ guarded: true }));
    expect((byTestId('new-screen') as HTMLButtonElement).disabled).toBe(true);
  });

  it('draws the open screen’s row, and asks before it deletes', () => {
    let deleted = 0;
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
          onDelete: () => (deleted += 1),
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
    // The answer deletes, the first press does not.
    act(() => byTestId('delete-screen').click());
    expect(deleted).toBe(0);
    expect(document.body.textContent).toContain('Delete “Kampagne”?');
    act(() => byId('delete-screen-confirm').click());
    expect(deleted).toBe(1);
  });

  it('says what a deletion is in the notifications: a draft, with a way back and a way to submit it', () => {
    let restored = '';
    const deletedNotices = noticesOf({
      layout: 'demo',
      deleted: [
        {
          id: 'entdecken',
          title: 'Entdecken',
          href: 'https://github.com/x/y/issues/new?title=z',
          onRestore: () => (restored = 'entdecken'),
        },
      ],
    });
    // The list the bell opens, drawn on its own: a popover left open costs every later test.
    draw(<NoticeList notices={deletedNotices} />);
    expect(byId('notifications-list').textContent).toContain(
      'Deleted “Entdecken” in this draft only',
    );
    expect(byId('submit-deletion-entdecken').getAttribute('href')).toContain('issues/new');
    expect(byId('restore-screen-entdecken').getAttribute('aria-label')).toBe('Restore Entdecken');
    act(() => byId('restore-screen-entdecken').click());
    expect(restored).toBe('entdecken');
  });
});
