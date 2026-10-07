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
  newScreenFault,
  screenTitle,
  selectLayout,
  setScreen,
} from '../../src/preview/home/store';
import { forgetMigration } from '../../src/preview/home/write';
import type { ScenarioControl } from '../../src/preview/home/Scenario';
import { TooltipProvider } from '../../src/ui/kit/tooltip';

/**
 * The bar above the block list: the form for a screen, and the bell that stays silent. Three files
 * and not one, because every render of the bar costs seconds in jsdom and later tests in a file
 * pay more for the earlier ones, which blocks the worker past vitest's reporting timeout.
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
});
