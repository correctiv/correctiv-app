/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE } from '../../src/i18n/language';
import { ActionsProvider, useToolActions, type ToolActions } from '../../src/shell/actions';
import { TooltipProvider } from '../../src/ui/kit/tooltip';
import { ToolActions as Header } from '../../src/ui/ToolActions';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Tool({ actions }: { actions: ToolActions }) {
  useToolActions('home', actions);
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount(active: 'home' | 'navigation' | null, actions: ToolActions | null) {
  container = document.body.appendChild(document.createElement('div'));
  act(() => {
    root = createRoot(container);
    root.render(
      <Localisation language={SOURCE_LANGUAGE}>
        <TooltipProvider>
          <ActionsProvider active={active}>
            <Header />
            {actions && <Tool actions={actions} />}
          </ActionsProvider>
        </TooltipProvider>
      </Localisation>,
    );
  });
}

const q = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

/**
 * What the submit button describes itself with, read the way a screen reader would:
 * through `aria-describedby`, which points at the sentence the tooltip draws. Both
 * halves of that are what the check is about, so the test follows the reference
 * rather than reading a prop, and a button that points at nothing reads as `null`.
 */
const described = (): string | null => {
  const id = q('action-submit')?.getAttribute('aria-describedby');
  // An attribute selector and not `#id`: `useId` writes `«:r1:»`, whose colons are a
  // pseudo-class to the id form, and jsdom 20 has no `CSS.escape` to quote them with.
  return id ? (container.querySelector(`[id="${id}"]`)?.textContent ?? null) : null;
};

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('the header actions', () => {
  it('draws nothing for a tool that registered nothing', () => {
    mount('home', null);
    expect(q('tool-actions')).toBeNull();
  });

  it('draws nothing for a tool that is not the open one', () => {
    mount('navigation', { dirty: true, discard: () => {} });
    expect(q('tool-actions')).toBeNull();
  });

  it('keeps every button but disables them while the tool is clean', () => {
    mount('home', { dirty: false, submit: null, save: { run: () => {} }, discard: () => {} });
    expect((q('action-discard') as HTMLButtonElement).disabled).toBe(true);
    expect((q('action-save') as HTMLButtonElement).disabled).toBe(true);
    expect((q('action-submit') as HTMLButtonElement).disabled).toBe(true);
    expect(q('tool-actions-status')?.dataset.draft).toBeUndefined();
  });

  it('enables them when dirty, and submit is a link', () => {
    let discarded = false;
    mount('home', {
      dirty: true,
      count: 2,
      submit: { href: 'https://example.test/new' },
      save: { run: () => {} },
      discard: () => (discarded = true),
    });
    expect(q('tool-actions-status')?.textContent).toBe('2 changes');
    expect(q('tool-actions-status')?.dataset.draft).toBe('true');
    expect((q('action-save') as HTMLButtonElement).disabled).toBe(false);
    expect(q('action-submit')?.tagName).toBe('A');
    act(() => q('action-discard')!.click());
    expect(discarded).toBe(true);
  });

  /*
   * Why a switched-off Submit says so, which is what the per-panel ⓘ was for: every
   * tool used to carry its own paragraph explaining this button, next to a control
   * that is not the one it describes. `blocked` is the tool's reason rather than a
   * flag, and the button says it.
   */
  it('switches save and submit off while blocked, and says why', () => {
    mount('home', {
      dirty: true,
      blocked: 'Scenarios are examples. They are not submitted.',
      submit: { href: 'https://example.test/new' },
      save: { run: () => {} },
    });
    expect((q('action-save') as HTMLButtonElement).disabled).toBe(true);
    expect(q('action-submit')?.tagName).toBe('BUTTON');
    expect(described()).toBe('Scenarios are examples. They are not submitted.');
  });

  it('says there is nothing to submit yet while the tool is clean', () => {
    mount('home', { dirty: false, submit: null });
    expect(described()).toBe('Nothing to submit yet. Change something in this tool first.');
  });

  /*
   * The wrapper span is not decoration. `ui/kit/button.tsx` gives every button
   * `disabled:pointer-events-none`, so a tooltip whose trigger is the disabled button
   * opens for nobody — which would leave the reason above reachable by a screen
   * reader and by nothing else.
   */
  it('puts the tooltip on a wrapper, because a disabled button takes no pointer events', () => {
    mount('home', { dirty: false, submit: null });
    const trigger = q('action-submit')?.closest('[data-state]');
    expect(trigger?.tagName).toBe('SPAN');
  });

  /*
   * The share button (ADR 0076 §5), and the three things about it that are decisions
   * rather than code: the seam is optional, so a tool with no draft to hand over does not
   * draw it at all; it follows the others and is disabled rather than hidden, because a
   * button that comes and goes moves every other control in the bar each time somebody
   * types; and a blocked tool cannot hand out a link to a change it will not let anybody
   * submit.
   */
  it('draws the share button for a tool that fills the seam, and only then', () => {
    mount('home', { dirty: true, save: { run: () => {} } });
    expect(q('action-share')).toBeNull();

    act(() => root.unmount());
    container.remove();
    mount('home', { dirty: true, share: { run: () => {} } });
    expect(q('action-share')?.tagName).toBe('BUTTON');
  });

  it('keeps the share button disabled while the tool is clean and while it is blocked', () => {
    mount('home', { dirty: false, share: { run: () => {} } });
    expect((q('action-share') as HTMLButtonElement).disabled).toBe(true);

    act(() => root.unmount());
    container.remove();
    mount('home', { dirty: true, blocked: 'Not now.', share: { run: () => {} } });
    expect((q('action-share') as HTMLButtonElement).disabled).toBe(true);
  });

  it('hands the click to the tool, which is what builds the link', () => {
    let shared = 0;
    mount('home', { dirty: true, share: { run: () => (shared += 1) } });
    act(() => q('action-share')!.click());
    expect(shared).toBe(1);
  });

  it('removes the actions when the tool unmounts', () => {
    mount('home', { dirty: true, discard: () => {} });
    expect(q('tool-actions')).not.toBeNull();
    act(() =>
      root.render(
        <Localisation language={SOURCE_LANGUAGE}>
          <TooltipProvider>
            <ActionsProvider active="home">
              <Header />
            </ActionsProvider>
          </TooltipProvider>
        </Localisation>,
      ),
    );
    expect(q('tool-actions')).toBeNull();
  });
});
