/**
 * @vitest-environment jsdom
 */
import { act, useRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE } from '../../src/i18n/language';
import { ActionsProvider, useToolActions, type ToolActions } from '../../src/shell/actions';
import { useOneRow } from '../../src/ui/header-row';
import { TooltipProvider } from '../../src/ui/kit/tooltip';
import { OverflowActions, ShareNotice, ToolActions as Header } from '../../src/ui/ToolActions';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * jsdom has no `ResizeObserver`, and Radix's popover and tooltip are built on
 * `@floating-ui`, which observes its anchor. An observer that never calls back is
 * the whole of what these tests need: nothing here measures a box, and the two
 * tests that do are `test/ui/header-row.test.tsx`, which writes the numbers itself.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/**
 * The header's own ladder, placed at its tightest tier.
 *
 * **Through `useOneRow` and not by writing to the store**, because the store is what
 * the component under test reads and a test that set it directly would be testing a
 * store nobody can reach. A box that reports a shortfall at every tier is a bar no
 * window is wide enough for, so the walk climbs to the last tier and rests there —
 * which is the state a 1280-pixel window put it in before the ladder existed.
 */
function TightestTier() {
  const box = useRef<HTMLDivElement>(null);
  useOneRow([box]);
  return (
    <div
      ref={(node) => {
        box.current = node;
        if (!node) return;
        Object.defineProperty(node, 'clientWidth', { value: 0, configurable: true });
        Object.defineProperty(node, 'scrollWidth', { value: 999, configurable: true });
      }}
    />
  );
}

function Tool({ actions }: { actions: ToolActions }) {
  useToolActions('home', actions);
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount(
  active: 'home' | 'navigation' | null,
  actions: ToolActions | null,
  { tight }: { tight?: boolean } = {},
) {
  container = document.body.appendChild(document.createElement('div'));
  act(() => {
    root = createRoot(container);
    root.render(
      <Localisation language={SOURCE_LANGUAGE}>
        <TooltipProvider>
          <ActionsProvider active={active}>
            <Header />
            {actions && <Tool actions={actions} />}
            {tight && <TightestTier />}
          </ActionsProvider>
        </TooltipProvider>
      </Localisation>,
    );
  });
}

/** On the bar itself, which is what `container` holds. */
const q = (id: string) => container.querySelector<HTMLElement>(`[data-testid="${id}"]`);

/**
 * One part of this bar on its own, with no tool and no actions behind it.
 *
 * `OverflowActions` and `ShareNotice` are drawn inside a Radix `Popover`, and one
 * open in this repository's jsdom costs about a second and slows every test after it
 * — measured on an empty popover, so it is not what these two draw. This renders the
 * part that is ours.
 */
function renderOnly(node: ReactNode) {
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

/**
 * What an element describes itself with, read the way a screen reader would: through
 * `aria-describedby`, which points at the sentence behind it. The test follows the
 * reference rather than reading a prop, and an element that points at nothing reads
 * as `null`.
 */
const describedBy = (element: HTMLElement | null): string | null => {
  const id = element?.getAttribute('aria-describedby');
  // An attribute selector and not `#id`: `useId` writes `«:r1:»`, whose colons are a
  // pseudo-class to the id form, and jsdom 20 has no `CSS.escape` to quote them with.
  return id ? (document.body.querySelector(`[id="${id}"]`)?.textContent ?? null) : null;
};

/** What the submit button describes itself with. */
const described = (): string | null => describedBy(q('action-submit'));

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  /*
   * Whatever the page still holds, gone. A Radix `Popover` waits for an animation to
   * end before it takes its content down, and jsdom fires no `animationend` — so the
   * panel of a test that opened one stays in `document.body` for the rest of the
   * file, and every test after it pays for a body nobody can see. Measured: the test
   * after the one that opened a popover took 7 seconds against 5 milliseconds for
   * the same render with a clean page.
   */
  for (const left of document.body.children) left.remove();
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

  /*
   * Where the draft came from, and why it is three words and not a paragraph
   * (#331, #323). A permanent sentence at the top of a tool panel is a sentence
   * everybody reads once and then never again, and it pushes the work down; the bar
   * says what it is and the sentence nobody can see stays behind the tooltip.
   */
  it('says a draft arrived in a link, beside the change status and not in the panel', () => {
    mount('home', { dirty: true, origin: 'Nothing of it was written on this machine.' });
    const origin = q('tool-actions-origin');
    expect(origin?.textContent).toBe('From a link');
    // The sentence is read out rather than hovered for, so a screen reader is told
    // the half that matters without the reader having to find the tooltip.
    expect(describedBy(origin)).toBe('Nothing of it was written on this machine.');
  });

  it('draws no origin at all for a draft that was typed here', () => {
    mount('home', { dirty: true });
    expect(q('tool-actions-origin')).toBeNull();
  });

  /*
   * The overflow menu, and what it is for: the header is one row at every width
   * (`ui/header-row.tsx`), so at the tightest tier the two rarely pressed actions go
   * behind one `⋯`. Submit does not — it is the button the bar exists for, and an
   * icon alone is a guess.
   */
  describe('at the tightest tier', () => {
    it('takes the two rare actions off the bar and offers one ⋯ in their place', () => {
      mount('home', { dirty: true, save: { run: () => {} }, discard: () => {} }, { tight: true });
      expect(q('action-more')).not.toBeNull();
      expect(q('action-discard')).toBeNull();
      expect(q('action-save')).toBeNull();
    });

    it('keeps Submit labelled, because an icon alone is a guess', () => {
      mount('home', { dirty: true, submit: { href: 'https://example.test/new' } }, { tight: true });
      const submit = q('action-submit');
      expect(submit?.textContent).toBe('Submit');
      // An icon-only button carries its name in `aria-label` and shows nothing; this
      // is the other half of the same claim, and it is the half a reader sees.
      expect(submit?.getAttribute('aria-label')).toBeNull();
    });
  });
});

/**
 * What the too-long notice says, which is the half of it that is ours.
 *
 * Opened through the bar in the test above, where the anchor is; rendered on its own
 * here, because a Radix `Popover` in this repository's jsdom costs about a second and
 * taxes every test after it — measured on an empty one, so it is not what this draws.
 * The sentence is the tool's own, because only the tool knows how many characters
 * there were; what the notice adds is the way out and the way to shut it.
 */
describe('the too-long notice', () => {
  it('says what went wrong and offers the address to submit instead', () => {
    renderOnly(
      <ShareNotice
        text="2,400 characters is too long for a link."
        submit={{ href: 'https://example.test/new' }}
        onFold={() => {}}
      />,
    );
    expect(container.textContent).toContain('2,400 characters is too long for a link.');
    expect(q('share-warning-submit')?.getAttribute('href')).toBe('https://example.test/new');
  });

  it('leaves out the way out while there is nothing to submit to', () => {
    renderOnly(<ShareNotice text="Too long for a link." onFold={() => {}} />);
    expect(q('share-warning-submit')).toBeNull();
    expect(q('share-warning-close')).not.toBeNull();
  });

  it('hands the fold to the caller, because closing is not the same as reading', () => {
    let folded = 0;
    renderOnly(<ShareNotice text="Too long for a link." onFold={() => (folded += 1)} />);
    act(() => q('share-warning-close')!.click());
    expect(folded).toBe(1);
  });
});

/**
 * What the `⋯` holds, and that it is more than an icon.
 *
 * Rendered on its own rather than through the popover, for the reason the notice is:
 * a Radix `Popover` in this repository's jsdom costs about a second and taxes every
 * test after it — measured on an empty one, so it is not what these two draw. Both
 * actions keep the name the button on the bar had: a menu item that said only
 * "Verwerfen" would have lost the half that says it puts every change back to what
 * ships, which was on the button and has nowhere else to be. And both still run the
 * tool's own function.
 */
describe('the actions the ⋯ holds', () => {
  it('holds both of them, named, and hands each click to the tool', () => {
    let discarded = false;
    let saved = 0;
    renderOnly(
      <OverflowActions
        discard={() => (discarded = true)}
        save={{ run: () => (saved += 1) }}
        live
      />,
    );
    expect(q('action-discard')?.textContent).toContain('Discard');
    expect(q('action-save')?.textContent).toContain('Save');
    act(() => q('action-discard')!.click());
    act(() => q('action-save')!.click());
    expect([discarded, saved]).toEqual([true, 1]);
  });

  it('switches Save off while the tool is clean, as the button on the bar did', () => {
    renderOnly(<OverflowActions save={{ run: () => {} }} live={false} />);
    expect((q('action-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('holds only what the tool offers, because a menu item that does nothing is noise', () => {
    renderOnly(<OverflowActions live />);
    expect(q('action-discard')).toBeNull();
    expect(q('action-save')).toBeNull();
  });
});
