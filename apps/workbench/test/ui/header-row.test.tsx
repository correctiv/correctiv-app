/**
 * @vitest-environment jsdom
 */
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { useHeaderDensity, useOneRow } from '../../src/ui/header-row';

/**
 * The ladder that keeps the header in one row, and the three questions about it that
 * no source-reading test can answer.
 *
 * **The header is one row or it is broken.** It was `flex-wrap` and broke into three
 * rows at 1280, 1600 and 2000 CSS pixels alike. `flex-nowrap` is what the header now
 * says; these tests are about what it now DOES, which is four tiers of giving-up
 * driven by a measurement, and a ladder that measures itself in a loop is a page
 * that never stops rendering. `apps/workbench/scripts/measure-header.mjs` is the half
 * that needs a real browser, and the table in the source's docblock is its output.
 *
 * **The boxes are two, and that is the half a real header does not survive
 * without.** The header and the context bar inside it both have to fit, because the
 * context bar is `min-w-0` and takes the shortfall on itself: a bar that clipped its
 * own overflow would measure as fitting at every width, and the route field would
 * vanish rather than the ladder climbing. jsdom lays nothing out — every box reports
 * zero, which the ladder reads as "fits" — so `Bar` writes `clientWidth` and
 * `scrollWidth` from the tier it is showing, which is the shape of the real thing:
 * every tier above the answer is narrower, so "fits" is monotone in the tier and the
 * smallest fitting tier is the answer.
 *
 * **A store and not a context, and the fourth test is why.** The consumers are
 * `ToolActions` (drawn by the header) and the preview's `Toolbar`, and the toolbar
 * arrives through `shell/slots.tsx`, which is a portal: with a context provider
 * wrapping the header, the toolbar read the default of zero and folded nothing, so
 * the header looked right and the controls beside the frame stayed on the bar. That
 * consumer is drawn here outside the measured element's subtree, which is a portal's
 * shape.
 */

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The tightest tier, spelled out so a failure names a number and not "the max". */
const LAST = 3;

/** Every tier the walk rendered, in order. The path is the assertion, not the end. */
let walked: number[] = [];

const ROOM = 100;
const WIDE = 400;

function widths(element: HTMLElement | null, overflow: boolean): void {
  if (!element) return;
  Object.defineProperty(element, 'clientWidth', { value: ROOM, configurable: true });
  Object.defineProperty(element, 'scrollWidth', {
    value: overflow ? WIDE : ROOM,
    configurable: true,
  });
}

/**
 * A header with a context bar inside it, a consumer drawn outside both, and boxes
 * whose overflow follows the tier on screen.
 *
 * `shortFrom` is the tier from which the bar reports a shortfall: the real ladder's
 * answer, written down, so a test says "the bar needs tier 2" and asks whether the
 * walk finds 2 — and asks that of a bar whose true answer is an interior tier, which
 * is the case a walk that steps down while it fits can never finish.
 *
 * The widths are written in a LAYOUT effect in this component, and that is what puts
 * them in front of the measurement: React runs a child's layout effects before its
 * parent's, and the parent is where `useOneRow` reads them.
 */
function Bar({
  shortFrom = LAST + 1,
  outside,
}: {
  /** The tier from which the bar fits; everything below it overflows. */
  shortFrom?: number;
  outside?: (density: number) => void;
}) {
  const bar = useRef<HTMLDivElement>(null);
  const context = useRef<HTMLDivElement>(null);
  const density = useOneRow([bar, context]);
  walked = [...walked, density];

  /*
   * The widths in a REF CALLBACK and not in an effect, and that is the whole trick:
   * `useOneRow` measures in a layout effect registered before this component's own,
   * so anything written after it is a layout pass too late — the walk would read
   * the previous tier's numbers and settle on tier 0 for want of a second look. A
   * ref callback runs in the commit phase, ahead of every layout effect, which is
   * where a box's size is real.
   */
  const overflow = density < shortFrom;
  const barRef = (node: HTMLDivElement | null) => {
    bar.current = node;
    widths(node, overflow);
  };
  const contextRef = (node: HTMLDivElement | null) => {
    context.current = node;
    widths(node, overflow);
  };

  return (
    <>
      <header ref={barRef} data-testid="bar" data-density={density}>
        <div ref={contextRef} data-testid="context" />
      </header>
      {outside?.(density)}
    </>
  );
}

let container: HTMLDivElement;
let root: Root;

/** Mounts a bar and returns its boxes, with `act` having flushed the whole walk. */
function mount(props: Parameters<typeof Bar>[0] = {}) {
  container = document.body.appendChild(document.createElement('div'));
  act(() => {
    root = createRoot(container);
    root.render(<Bar {...props} />);
  });
  return {
    bar: container.querySelector<HTMLElement>('[data-testid="bar"]')!,
    context: container.querySelector<HTMLElement>('[data-testid="context"]')!,
    density: () =>
      Number(container.querySelector<HTMLElement>('[data-testid="bar"]')?.dataset.density),
  };
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  walked = [];
});

describe('the header ladder', () => {
  it('gives nothing up while the bar fits at the widest tier', () => {
    const { density } = mount({ shortFrom: 0 });
    expect(density()).toBe(0);
    // One measurement, one tier, no walk: a bar that fits as drawn is not a bar
    // that needs a second look.
    expect(walked).toEqual([0]);
  });

  /**
   * The answer, found from the widest tier, and the path is the assertion rather
   * than the end state: each tier is rendered once and in order. A bar that needs
   * tier 1 and no more must not settle at 2, which is what a walk that only ever
   * climbs would do, and a walk that asked for a tier twice would be a page
   * rendering for as long as it is open.
   */
  it.each([0, 1, 2, 3])('settles on tier %i, and renders each tier once', (shortFrom) => {
    const { density } = mount({ shortFrom });
    expect(density()).toBe(shortFrom);
    expect(walked).toEqual(Array.from({ length: shortFrom + 1 }, (_, tier) => tier));
  });

  /**
   * The oscillation, and the reason the ladder carries a floor.
   *
   * The obvious rule — step down while it fits, up while it does not — reaches tier 2
   * and then goes back to 1 and then back to 2, for as long as the tab is open: the
   * two tiers are adjacent and from either of them the other one is the wrong
   * answer. So the walk above is `[0, 1, 2]` and ends, and this is the test that
   * says so.
   */
  it('stops at an interior tier instead of walking between it and the one above', () => {
    const { density } = mount({ shortFrom: 2 });
    expect(density()).toBe(2);
    expect(walked).toEqual([0, 1, 2]);
  });

  it('never asks for more than the tightest tier, however short the bar is', () => {
    // `shortFrom` past the ladder: nothing fits at any tier, which is a window
    // narrower than the bar can be given up to.
    const { density } = mount({ shortFrom: LAST + 1 });
    expect(density()).toBe(LAST);
    expect(walked).toEqual([0, 1, 2, LAST]);
  });

  /**
   * The floor is void once the bar's content changes for a reason that is not the
   * walk. Without this, a tier that overflowed because of a status that has since
   * gone shorter would fold the header one tier too far for the rest of the session
   * and nothing would say so.
   */
  it('asks again when the content changed rather than the tier', () => {
    let shortFrom = 2;
    container = document.body.appendChild(document.createElement('div'));
    act(() => {
      root = createRoot(container);
      root.render(<Bar shortFrom={shortFrom} />);
    });
    const bar = container.querySelector<HTMLElement>('[data-testid="bar"]')!;
    expect(bar.dataset.density).toBe('2');

    // The bar needs less now: a render nobody asked for, with the tier unmoved.
    shortFrom = 1;
    act(() => root.render(<Bar shortFrom={shortFrom} />));
    expect(bar.dataset.density).toBe('1');

    // And back again, which is the same reasoning the other way round.
    shortFrom = 3;
    act(() => root.render(<Bar shortFrom={shortFrom} />));
    expect(bar.dataset.density).toBe('3');
  });

  /**
   * The context bar is measured as well as the header, and the test is the shape a
   * header without it fails: the header itself fits — it is `min-w-0` and gives its
   * shortfall to the bar inside it — while the box that actually clips does not.
   * Read as the header alone this is a bar that fits at tier 0, and the route field
   * is gone.
   */
  it('climbs when the context bar overflows even though the header does not', () => {
    container = document.body.appendChild(document.createElement('div'));
    act(() => {
      root = createRoot(container);
      root.render(<OnlyTheContextBarOverflows />);
    });
    const bar = container.querySelector<HTMLElement>('[data-testid="bar"]')!;
    expect(bar.dataset.density).toBe('2');
  });

  /**
   * Going to `full` draws no header at all, and the one that comes back is a new
   * header against a new layout. Without the reset it would start folded at the tier
   * the last layout needed, keep the fold for a tier that now fits, and the page
   * would have nothing to say so.
   */
  it('starts the next header at the widest tier rather than the last one', () => {
    const first = mount({ shortFrom: 3 });
    expect(first.density()).toBe(3);

    act(() => root.unmount());
    container.remove();
    const second = mount({ shortFrom: 0 });
    expect(second.density()).toBe(0);
  });

  it('reaches a consumer drawn outside the measured element, which is what a portal is', () => {
    let seen: number | null = null;
    mount({ shortFrom: 2, outside: (density) => (seen = density) });
    // The toolbar beside the frame is not a descendant of the header, and with a
    // context this would still be 0.
    expect(seen).toBe(2);
  });
});

describe('the tier a header reads', () => {
  it('is zero before any header has measured, which is the widest tier', () => {
    let seen: number | null = null;
    container = document.body.appendChild(document.createElement('div'));
    act(() => {
      root = createRoot(container);
      root.render(<Probe onTier={(density) => (seen = density)} />);
    });
    expect(seen).toBe(0);
  });
});

function Probe({ onTier }: { onTier: (tier: number) => void }) {
  onTier(useHeaderDensity());
  return null;
}

/**
 * The bar fits and the bar inside it does not, which is what `min-w-0` does to a
 * header that measures only itself.
 */
function OnlyTheContextBarOverflows() {
  const bar = useRef<HTMLDivElement>(null);
  const context = useRef<HTMLDivElement>(null);
  const density = useOneRow([bar, context]);
  const barRef = (node: HTMLDivElement | null) => {
    bar.current = node;
    widths(node, false);
  };
  const contextRef = (node: HTMLDivElement | null) => {
    context.current = node;
    widths(node, density < 2);
  };

  return (
    <header ref={barRef} data-testid="bar" data-density={density}>
      <div ref={contextRef} data-testid="context" />
    </header>
  );
}
