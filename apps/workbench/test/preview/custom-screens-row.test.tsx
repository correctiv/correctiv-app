/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE } from '../../src/i18n/language';
import { EditorBar } from '../../src/preview/home/Controls';
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
 * The open screen's row and the question before a deletion. Its own file, see
 * `custom-screens-bar.test.tsx`.
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

describe('the open screen row', () => {
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
});
