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

/**
 * That the too-long notice opens **at the Share button**, and that it does not open at
 * all without a warning to open.
 *
 * **A file of its own, and the reason is a number.** This is the only test in the
 * repository that opens a Radix `Popover`, and one open costs about two seconds in
 * this jsdom and taxes the tests after it — measured on an EMPTY popover, so it is
 * `@floating-ui` and not anything this bar draws. Kept in `actions.test.tsx` it made
 * three later tests in that file four to five seconds each for no reason of their
 * own; here it taxes this file and the next one starts clean.
 *
 * What is and is not asserted, stated plainly because a browser would do better:
 * that the notice OPENS and that the trigger is the Share button, both of which the
 * DOM can say. Where it SITS is floating-ui's arithmetic on `getBoundingClientRect`,
 * which jsdom answers with zeroes, so "anchored at the button" is checked as far as
 * the DOM goes and the rest is `apps/workbench/scripts/measure-header.mjs` and a pair
 * of eyes.
 *
 * `test/shell/actions.test.tsx` holds what the notice SAYS, rendered without the
 * popover around it, and the fold and the way out.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Radix's popper observes its anchor, and jsdom has nothing to give it. */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

function Tool({ actions }: { actions: ToolActions }) {
  useToolActions('home', actions);
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount(actions: ToolActions) {
  container = document.body.appendChild(document.createElement('div'));
  act(() => {
    root = createRoot(container);
    root.render(
      <Localisation language={SOURCE_LANGUAGE}>
        <TooltipProvider>
          <ActionsProvider active="home">
            <Header />
            <Tool actions={actions} />
          </ActionsProvider>
        </TooltipProvider>
      </Localisation>,
    );
  });
}

const q = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`);
/** The notice is portalled out of the bar, so it is not in `container`. */
const anywhere = (id: string) => document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  /*
   * Whatever the page still holds, gone. Radix takes a `Popover`'s content down when
   * its exit animation ends, and jsdom fires no `animationend` — so the panel of this
   * test stays in `document.body` for the rest of the file and every test after it
   * pays for a page nobody can see.
   */
  for (const left of document.body.children) left.remove();
});

describe('the too-long notice', () => {
  /*
   * The cheap one first, on purpose: the open popover below leaves `@floating-ui`
   * work behind that the next test in this file pays for, so it goes last and pays
   * for itself in the teardown instead.
   */
  it('opens nothing for a draft the link carried', () => {
    mount({ dirty: true, share: { run: () => {} } });
    // The anchor is always there — the popover is always mounted — so what is
    // asserted is that no warning reached it.
    expect(q('share-anchor')?.getAttribute('aria-expanded')).toBe('false');
    expect(anywhere('share-warning-submit')).toBeNull();
  });

  it('opens at the Share button, with the address to submit inside it', () => {
    mount({
      dirty: true,
      share: {
        run: () => {},
        warning: { text: 'Too long for a link.', submit: { href: 'https://example.test/new' } },
      },
    });
    /*
     * `aria-expanded` and not `data-state`: the span carries BOTH triggers' — the
     * popover's and the tooltip's — and `data-state` is whichever wrote last, so it
     * cannot say which one opened. This attribute is the popover's own, and it is
     * also what a screen reader hears from this button.
     */
    const anchor = q('share-anchor');
    expect(anchor?.getAttribute('aria-expanded')).toBe('true');
    expect(anchor?.querySelector('[data-testid="action-share"]')).not.toBeNull();
    expect(anywhere('share-warning-submit')?.getAttribute('href')).toBe('https://example.test/new');
    expect(anywhere('share-warning-close')).not.toBeNull();
  });
});
