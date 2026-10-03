/**
 * @vitest-environment jsdom
 */
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { inBar, mountBar, onPage, unmountBar } from './share-notice-harness.tsx';

/**
 * That the too-long notice opens **at the Share button**, and that it does not open at
 * all without a press to open it.
 *
 * **A file of its own, and the reason is a number.** Opening a Radix `Popover` costs
 * seconds in this jsdom and taxes every open after it in the same file — measured on an
 * EMPTY popover on 2026-10-03, so it is `@floating-ui` and not anything this bar draws.
 * Kept in `actions.test.tsx` it made three later tests in that file four to five seconds
 * each for no reason of their own. The numbers here: the first open in a file takes
 * 2.8 s and the second 10.7 s, so this file makes ONE and the ways out that need a panel
 * of their own are in `share-notice-dismiss.test.tsx`.
 *
 * What is and is not asserted, stated plainly because a browser would do better:
 * that the notice OPENS and that the trigger is the Share button, both of which the DOM
 * can say. Where it SITS is floating-ui's arithmetic on `getBoundingClientRect`, which
 * jsdom answers with zeroes, so "anchored at the button" is checked as far as the DOM
 * goes and the rest is `apps/workbench/scripts/measure-header.mjs` and a pair of eyes.
 *
 * `test/shell/actions.test.tsx` holds what the notice SAYS, rendered without the popover
 * around it, and the fold and the way out.
 */

afterEach(unmountBar);

describe('the too-long notice', () => {
  it('opens nothing for a draft the link carried', () => {
    mountBar({ dirty: true, share: { run: () => {} } });
    // The anchor is always there — the popover is always mounted — so what is
    // asserted is that no warning reached it.
    expect(inBar('share-anchor')?.getAttribute('aria-expanded')).toBe('false');
    expect(onPage('share-warning-submit')).toBeNull();
  });

  /**
   * A warning on its own opens nothing, which is the whole of #338's defect and the
   * one thing a picture cannot settle.
   *
   * **The warning is a state and the panel wants an act**, so the panel opens on the
   * press of the button and on nothing else. #337's before-picture shows what a panel
   * that opens on a field rather than on a press looks like: a sentence under the header
   * with no pointer, taken with the state forced — which is exactly what this mounts, a
   * tool that hands over a warning without anybody having pressed anything.
   */
  it('opens nothing on load, though a warning is already waiting', () => {
    mountBar({
      dirty: true,
      share: {
        run: () => {},
        warning: { text: 'Too long for a link.', submit: { href: 'https://example.test/new' } },
      },
    });
    expect(inBar('share-anchor')?.getAttribute('aria-expanded')).toBe('false');
    expect(onPage('share-warning-submit')).toBeNull();
  });

  /**
   * The press, and everything the open panel can be asked in one go.
   *
   * **Anchored is a relation in the DOM and not a position.** Radix points the trigger at
   * the panel with `aria-controls`, and the panel carries the side and the alignment it
   * was opened on. Where it SITS is floating-ui's arithmetic, which jsdom answers with
   * zeroes — that half is `measure-header.mjs` and a pair of eyes.
   *
   * **No tooltip open, and it is in here for that reason.** Radix draws a tooltip while
   * its trigger is hovered or focused, and the panel takes the focus for itself, so a
   * tooltip beside the notice would mean the notice had dragged one open: which is the
   * second half of #337's before-picture. The panel and the share button hang off the
   * same span, so this also says the popover did not drag the button's own tooltip.
   *
   * One open, because an open is the expensive thing in this file and everything below
   * wants the same one. The close button's press ends it and the fold goes with it: by
   * the warning's own text, so the same warning does not come back on the next press,
   * because a tool may not clear its news and the bar must. The ways out that each need
   * a panel of their own — Escape and a press outside — are in
   * `share-notice-dismiss.test.tsx`.
   */
  it('opens at the Share button on a press, hangs off it, and goes away again', () => {
    let pressed = 0;
    mountBar({
      dirty: true,
      share: {
        run: () => (pressed += 1),
        warning: { text: 'Too long for a link.', submit: { href: 'https://example.test/new' } },
      },
    });
    expect(onPage('share-warning-close')).toBeNull();
    act(() => inBar('action-share')!.click());

    /*
     * `aria-expanded` and not `data-state`: the span carries BOTH triggers' — the
     * popover's and the tooltip's — and `data-state` is whichever wrote last, so it
     * cannot say which one opened. This attribute is the popover's own, and it is also
     * what a screen reader hears from this button.
     */
    const anchor = inBar('share-anchor');
    expect(anchor?.getAttribute('aria-expanded')).toBe('true');
    expect(anchor?.querySelector('[data-testid="action-share"]')).not.toBeNull();
    // The press is also what the tool is told about, so the clipboard is not a casualty
    // of the panel being a press rather than a field.
    expect(pressed).toBe(1);
    // The way out is in there, so a reader is not told what went wrong and left.
    expect(onPage('share-warning-submit')?.getAttribute('href')).toBe('https://example.test/new');

    // The relation to the trigger, then the panel itself.
    const controls = anchor?.getAttribute('aria-controls');
    expect(controls).toBeTruthy();
    const panel = document.getElementById(controls ?? '');
    expect(panel?.getAttribute('data-side')).toBe('bottom');
    // The portalled one, not something the bar drew inline: a child of `document.body`.
    expect(panel?.parentElement?.parentElement).toBe(document.body);
    expect(panel?.querySelector('[data-testid="share-warning-close"]')).not.toBeNull();
    // The pointer, which is what makes it read as a popover and not as a banner under
    // the bar: Radix's own arrow, a polygon in an SVG, inside the panel it belongs to.
    // `svg polygon` and not the wrapper's attribute, which this Radix version does not
    // put on the element.
    expect(panel?.querySelector('svg polygon')).not.toBeNull();
    // Nothing in the bar is showing a tooltip while this one is.
    expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(0);

    act(() => onPage('share-warning-close')!.click());
    expect(onPage('share-warning-close')).toBeNull();
    // Folded by the warning's own text: the same warning does not come back.
    act(() => inBar('action-share')!.click());
    expect(onPage('share-warning-close')).toBeNull();
  });
});
