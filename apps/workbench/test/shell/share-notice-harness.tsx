import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE } from '../../src/i18n/language';
import { ActionsProvider, useToolActions, type ToolActions } from '../../src/shell/actions';
import { TooltipProvider } from '../../src/ui/kit/tooltip';
import { ToolActions as Header } from '../../src/ui/ToolActions';

/**
 * Mounting the header bar with a tool's actions behind it, for the two files that open
 * the too-long notice's Radix `Popover`.
 *
 * **Why this is a module and not written out twice.** Opening that popover costs
 * seconds in this jsdom and taxes every open after it in the same FILE — measured on
 * 2026-10-03, the second open in a file took 10.5 s where the first took 2.5 s. So the
 * ways out of the panel are in a file of their own and the harness is here rather than
 * copied, because a copy would have to be kept in step with the polypfills below and
 * the copy nobody reads is the copy that goes stale. What is IN each file is its
 * assertions.
 *
 * `test/shell/actions.test.tsx` renders the same bar without a popover anywhere near it.
 *
 * **No `@vitest-environment` docblock here, because this is not a test file.** It is the
 * environment each of the two files that import it declares for itself, and the
 * polyfills below run on import whichever way the importer is set up.
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

/**
 * jsdom has no `PointerEvent`, and Radix's dismissable layer listens for `pointerdown`
 * on the way out of a panel. Without this a press outside is a plain `MouseEvent` under
 * another name's constructor, and the panel stays open for a reason that has nothing to
 * do with the bar.
 */
if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = class extends MouseEvent {
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
    }
  } as unknown as typeof PointerEvent;
}

function Tool({ actions }: { actions: ToolActions }) {
  useToolActions('home', actions);
  return null;
}

let container: HTMLDivElement;
let root: Root;

/** The header bar with a tool behind it, mounted into a fresh container. */
export function mountBar(actions: ToolActions) {
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

/** Takes down what `mountBar` put up, and everything Radix left behind. */
export function unmountBar() {
  act(() => root.unmount());
  container.remove();
  /*
   * Whatever the page still holds, gone. Radix takes a `Popover`'s content down when
   * its exit animation ends, and jsdom fires no `animationend` — so the panel of a
   * test stays in `document.body` for the rest of the file and every test after it
   * pays for a page nobody can see.
   */
  for (const left of document.body.children) left.remove();
}

/** Something inside the bar, by its test id. */
export const inBar = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

/** The notice is portalled out of the bar, so it is asked for on the page. */
export const onPage = (id: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="${id}"]`);
