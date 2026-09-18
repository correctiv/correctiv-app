/**
 * @jest-environment jsdom
 */
import { GRIP } from '@/lib/rail/drag';
import { railDrag } from '@/lib/rail/useRailDrag.web';

/**
 * The browser half of the rail's drag-to-scroll: the part that decides whether a
 * press is a press at all, when the pointer is captured, which click is thrown
 * away, and what is left attached after the component goes.
 *
 * `rail-drag.test.ts` beside this one covers `drag.ts`, which is arithmetic and
 * needs nothing. This file is the other side of that split and it is the larger
 * one — the arithmetic is four lines and cannot fail quietly, while every rule
 * below is a listener talking to another listener, which can.
 *
 * `.web` explicitly, as `document-title.test.tsx` imports its own: on a device
 * `useRailDrag.ts` is a no-op with the same signature and jest would resolve
 * that half. `railDrag` rather than the hook, because the hook is four lines of
 * ref plumbing around this function and reaching it through a mounted
 * `ScrollView` would be a test of react-native-web's ref forwarding.
 *
 * ## What jsdom does not have, and what is done about it
 *
 * Measured against the jsdom this suite runs. Each shim below is here because
 * the thing it stands in for is missing, so a jsdom that grows one makes its
 * shim redundant rather than wrong:
 *
 * - **No `PointerEvent` constructor.** `MouseEvent` is there and carries
 *   `clientX` and `button`, so `pointer()` below subclasses it and adds the
 *   three fields the code reads. A listener registered for `pointerdown` is
 *   called by a `MouseEvent` of that type — jsdom dispatches on the type string
 *   and does not check the interface — so this is a shim for the payload only.
 * - **No `setPointerCapture`.** The code already try/catches it, so without a
 *   stub every capture would silently land in the catch and the ORDER this file
 *   is partly about would be untestable. A recording stub goes on the node
 *   instead, which is also what lets `captures` below be asserted.
 * - **No layout, so `scrollWidth` and `clientWidth` are both nought.** Left
 *   alone, `reach()` is nought, the code correctly refuses every press, and the
 *   whole file would pass while testing nothing. They are defined per node.
 * - **`scrollLeft` is real**: it stores what it is given and reads back. That is
 *   the one thing this needed that jsdom has, and it is why the scroll
 *   assertions are readings rather than spies.
 *
 * **What jsdom cannot hold, so this file does not claim it.** Nothing here
 * proves the capture-phase `click` listener beats React's delegated one, because
 * that is a fact about where React attaches its root listener and there is no
 * React in this file; the ordering rule is asserted as "`stopPropagation` was
 * called on the click", which is the mechanism, and ADR 0055 §3 carries the
 * measurement in a real browser. Nor does anything here prove a pointer capture
 * delivers a release from outside the window, which is the reason the capture
 * exists at all — jsdom has no window to leave.
 */

/** A `PointerEvent` as much as jsdom can make one; see the note above. */
function pointer(
  type: string,
  init: { x?: number; pointerType?: string; pointerId?: number; button?: number } = {},
): MouseEvent {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.x ?? 0,
    button: init.button ?? 0,
  });
  Object.assign(event, {
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? 'mouse',
    isPrimary: true,
  });
  return event;
}

/** One listener registration, as `listeners()` records it. */
interface Registration {
  readonly target: string;
  readonly type: string;
  readonly fn: unknown;
  readonly capture: boolean;
}

/** One `addEventListener`/`removeEventListener` wrapper that notes the call and passes it on. */
const record = (target: string, into: Registration[], original: EventTarget['addEventListener']) =>
  function (this: EventTarget, type: string, fn: unknown, options?: unknown) {
    into.push({ target, type, fn, capture: options === true });
    return original.call(this, type, fn as EventListener, options as boolean);
  };

/**
 * Every `addEventListener` and `removeEventListener` the code under test makes,
 * on the rail and on the document alike.
 *
 * The capture flag is part of the identity on purpose. `removeEventListener`
 * only takes a listener off the phase it was added to, so a teardown that says
 * `removeEventListener('click', click)` for a listener added with `true` leaves
 * it attached — and the rail would go on swallowing clicks for a component that
 * no longer exists. Matching on the triple without the flag would call that
 * removed.
 */
function listeners(node: HTMLElement) {
  const added: Registration[] = [];
  const removed: Registration[] = [];

  node.addEventListener = record('node', added, node.addEventListener.bind(node)) as never;
  node.removeEventListener = record('node', removed, node.removeEventListener.bind(node)) as never;
  const documentAdd = document.addEventListener.bind(document);
  const documentRemove = document.removeEventListener.bind(document);
  document.addEventListener = record('document', added, documentAdd) as never;
  document.removeEventListener = record('document', removed, documentRemove) as never;

  return {
    added,
    removed,
    /** What is still attached: added, and never taken off the same phase. */
    outstanding: () =>
      added.filter(
        (a) =>
          !removed.some(
            (r) =>
              r.target === a.target &&
              r.type === a.type &&
              r.fn === a.fn &&
              r.capture === a.capture,
          ),
      ),
    restore: () => {
      document.addEventListener = documentAdd;
      document.removeEventListener = documentRemove;
    },
  };
}

/**
 * A rail with the extent of the Mediathek's podcast row, the same numbers
 * `rail-drag.test.ts` states its arithmetic against.
 */
function rail({ scrollWidth = 1164, clientWidth = 1000 } = {}) {
  const node = document.createElement('div');
  Object.defineProperty(node, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(node, 'clientWidth', { value: clientWidth, configurable: true });
  const captures: number[] = [];
  Object.assign(node, { setPointerCapture: (id: number) => captures.push(id) });
  document.body.appendChild(node);
  return { node, captures };
}

/**
 * The click a release leaves behind, and whether anything stopped it.
 *
 * It takes its own listener off again, which matters beyond tidiness: `listeners()`
 * above records every `document.addEventListener` while it is installed, so a helper
 * that added one and left it would show up as the code under test failing to clean up.
 */
function click(node: HTMLElement) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  let reachedTheRoot = false;
  const atTheRoot = () => {
    reachedTheRoot = true;
  };
  document.addEventListener('click', atTheRoot);
  node.dispatchEvent(event);
  document.removeEventListener('click', atTheRoot);
  // React's delegated listener sits on the root container, so a click that never
  // arrives there is a click no card's `onPress` will ever see.
  return { swallowed: !reachedTheRoot, defaultPrevented: event.defaultPrevented };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the press this takes', () => {
  it('refuses a pointer that is not a mouse', () => {
    const { node, captures } = rail();
    railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500, pointerType: 'touch' }));
    document.dispatchEvent(pointer('pointermove', { x: 200, pointerType: 'touch' }));

    /*
     * A finger and a pen scroll a rail natively, so taking their press would
     * drag it twice — and the second copy has no momentum, which the first one
     * does. The gate is on the POINTER and not on the device, so a touchscreen
     * laptop keeps the drag on the mouse it also has.
     */
    expect(node.scrollLeft).toBe(0);
    expect(captures).toEqual([]);
    expect(click(node).swallowed).toBe(false);
  });

  it('refuses a button that is not the first one', () => {
    const { node } = rail();
    railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500, button: 2 }));
    document.dispatchEvent(pointer('pointermove', { x: 200 }));

    // A right click opens a context menu; dragging the rail out from under it
    // would be the app answering a gesture aimed at the browser.
    expect(node.scrollLeft).toBe(0);
  });

  it('refuses a rail whose content already fits', () => {
    const { node, captures } = rail({ scrollWidth: 800, clientWidth: 1000 });
    railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    document.dispatchEvent(pointer('pointermove', { x: 200 }));

    /*
     * `reach()` is nought, so there is nothing to offer a hand and the press
     * stays an ordinary press on a card. Without this the gallery's short
     * specimen rails would swallow clicks for a scroll they cannot perform.
     */
    expect(captures).toEqual([]);
    expect(click(node).swallowed).toBe(false);
  });
});

describe('the threshold', () => {
  it('leaves a press under it alone, and lets its click through', () => {
    const { node, captures } = rail();
    railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    document.dispatchEvent(pointer('pointermove', { x: 500 - (GRIP - 1) }));
    document.dispatchEvent(pointer('pointerup', { x: 500 - (GRIP - 1) }));

    /*
     * The asymmetry ADR 0055 §3 argues for, from this side: every card in a rail
     * is a link, so a hand that shakes five pixels on the way down still opens
     * the article. Nothing moved, nothing was captured, and the click survived.
     */
    expect(node.scrollLeft).toBe(0);
    expect(captures).toEqual([]);
    expect(click(node).swallowed).toBe(false);
  });

  it('takes the press at it, scrolls, and eats the click that follows', () => {
    const { node, captures } = rail();
    railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    document.dispatchEvent(pointer('pointermove', { x: 400 }));
    document.dispatchEvent(pointer('pointerup', { x: 400 }));

    // 100 to the left, and the rail is 100 further along: `heldAt`, reached
    // through the listener rather than called directly.
    expect(node.scrollLeft).toBe(100);
    expect(captures).toEqual([1]);

    const { swallowed, defaultPrevented } = click(node);
    expect(swallowed).toBe(true);
    // And the element's own default with it, for the day a card is an <a href>.
    expect(defaultPrevented).toBe(true);
  });

  it('captures at the threshold and not at the press', () => {
    const { node, captures } = rail();
    railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    /*
     * The order is load-bearing and this is the assertion that holds it. A
     * captured pointer retargets the compatibility mouse events to the capturing
     * element, so the `click` ending the press is dispatched against the rail
     * rather than against the card — and react-native-web invokes `onPress` from
     * that click. Capturing here, at `pointerdown`, would make every TAP on a
     * rail card dead, which is a worse defect than the one this PR fixes.
     */
    expect(captures).toEqual([]);

    document.dispatchEvent(pointer('pointermove', { x: 500 - GRIP }));
    expect(captures).toEqual([1]);

    // And only once, however far the drag goes on.
    document.dispatchEvent(pointer('pointermove', { x: 100 }));
    expect(captures).toEqual([1]);
  });

  it('reads the furthest travel and not the distance at the release', () => {
    const { node } = rail();
    railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    document.dispatchEvent(pointer('pointermove', { x: 300 }));
    // Out and back: the press ends where it started, having plainly been a drag.
    document.dispatchEvent(pointer('pointermove', { x: 500 }));
    document.dispatchEvent(pointer('pointerup', { x: 500 }));

    expect(node.scrollLeft).toBe(0);
    expect(click(node).swallowed).toBe(true);
  });

  it('ignores a second pointer while one is pressing', () => {
    const { node } = rail();
    railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500, pointerId: 1 }));
    // A second mouse is not a thing, but a stale pointerId from a cancelled
    // gesture is: the press answers to the id it started with and no other.
    document.dispatchEvent(pointer('pointermove', { x: 100, pointerId: 2 }));
    expect(node.scrollLeft).toBe(0);

    document.dispatchEvent(pointer('pointermove', { x: 400, pointerId: 1 }));
    expect(node.scrollLeft).toBe(100);
  });
});

describe('the flag that eats a click', () => {
  it('is cleared by the click it was set for', () => {
    const { node } = rail();
    railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    document.dispatchEvent(pointer('pointermove', { x: 400 }));
    document.dispatchEvent(pointer('pointerup', { x: 400 }));

    expect(click(node).swallowed).toBe(true);
    // One click, not every click after it.
    expect(click(node).swallowed).toBe(false);
  });

  it('is cleared by the next press when the drag produced no click at all', () => {
    const { node } = rail();
    railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    document.dispatchEvent(pointer('pointermove', { x: 400 }));
    document.dispatchEvent(pointer('pointerup', { x: 400 }));

    // A drag released outside any element produces no click, so nothing consumes
    // the flag. The next press clears it rather than leaving it to eat a real one.
    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    expect(click(node).swallowed).toBe(false);
  });

  /**
   * A cancelled drag must not arm the swallow, and this is the assertion that
   * says so.
   *
   * `pointercancel` and `pointerup` share the one handler, and both end the
   * press. Only a release is followed by the `click` that reads the flag and
   * clears it — the browser produces none for a cancel. Arming it on a cancel
   * therefore leaves it set with nothing coming to consume it, and the victim is
   * the next real click on that rail, a whole gesture later, which is as far
   * from the cause as a defect gets.
   *
   * Unreachable in the app today only because a rail card is a `<div
   * role="link">`: nothing else on the rail dispatches a click. It becomes real
   * the day a card is an `<a href>`.
   */
  it('is not armed by a pointercancel', () => {
    const { node } = rail();
    railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    document.dispatchEvent(pointer('pointermove', { x: 400 }));
    document.dispatchEvent(pointer('pointercancel', { x: 400 }));

    expect(click(node).swallowed).toBe(false);
  });
});

describe('the selection and the drag image', () => {
  it('are refused while a button is down, and not otherwise', () => {
    const { node } = rail();
    railDrag(node);

    const refused = (type: string) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      node.dispatchEvent(event);
      return event.defaultPrevented;
    };

    // Before the press, a rail is ordinary text.
    expect(refused('selectstart')).toBe(false);
    expect(refused('dragstart')).toBe(false);

    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    expect(refused('selectstart')).toBe(true);
    expect(refused('dragstart')).toBe(true);

    document.dispatchEvent(pointer('pointerup', { x: 500 }));
    expect(refused('selectstart')).toBe(false);
  });
});

describe('the teardown', () => {
  it('takes off every listener it put on, between presses', () => {
    const { node } = rail();
    const spy = listeners(node);
    const release = railDrag(node);

    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    document.dispatchEvent(pointer('pointermove', { x: 400 }));
    document.dispatchEvent(pointer('pointerup', { x: 400 }));
    // A whole gesture including the click, so the accounting covers the listener
    // that only a completed drag reaches.
    expect(click(node).swallowed).toBe(true);

    release();
    spy.restore();

    // A floor, so that a teardown which removed nothing because nothing was ever
    // added could not pass this: the rail's four plus the document's three.
    expect(spy.added.length).toBeGreaterThanOrEqual(7);
    expect(spy.outstanding()).toEqual([]);
  });

  it('takes them off mid-press too, with the document ones among them', () => {
    const { node } = rail();
    const spy = listeners(node);
    const release = railDrag(node);

    // Torn down with a drag in flight, which is what a route change during a
    // drag does. The document listeners are the ones that would survive it.
    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    document.dispatchEvent(pointer('pointermove', { x: 400 }));

    release();
    spy.restore();

    expect(spy.added.some((a) => a.target === 'document' && a.type === 'pointermove')).toBe(true);
    expect(spy.outstanding()).toEqual([]);
  });

  it('leaves a torn-down rail inert', () => {
    const { node, captures } = rail();
    const release = railDrag(node);
    release();

    node.dispatchEvent(pointer('pointerdown', { x: 500 }));
    document.dispatchEvent(pointer('pointermove', { x: 200 }));

    expect(node.scrollLeft).toBe(0);
    expect(captures).toEqual([]);
    expect(click(node).swallowed).toBe(false);
  });
});
