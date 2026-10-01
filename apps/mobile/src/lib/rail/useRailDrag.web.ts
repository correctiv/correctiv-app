import { useCallback, useRef } from 'react';
import type { Ref } from 'react';
import type { ScrollView } from 'react-native';

import { heldAt, isDrag, reach, type Extent, type Grab } from './drag';

/**
 * Lets a mouse drag a rail sideways, which in a browser is the only way there is.
 *
 * ## What a mouse could do before this, measured
 *
 * Measured on 2026-09-18 against the assembled site — the workbench with the
 * app's export under `/app`, the arrangement `pages.yml` deploys — on the
 * Mediathek's podcast rail and the fact-check rail, in the framed app at
 * `/preview` and in this site's own document at `/components/feed/…` alike:
 *
 * | gesture | what happened |
 * | --- | --- |
 * | drag | the headline was selected, the rail did not move, and the release opened the card |
 * | wheel, vertical | the page scrolled by exactly as much as it does beside the rail; the rail did not move |
 * | wheel, horizontal | the rail scrolled — a trackpad already works |
 * | scrollbar | there is none: `showsHorizontalScrollIndicator={false}` is `scrollbar-width: none` |
 *
 * So a mouse had no way at all to reach the far end of a rail, and trying the
 * obvious one navigated. That is the whole of what this fixes.
 *
 * **The vertical wheel is deliberately left alone.** Translating it into
 * horizontal movement is the other half of what such a component usually does,
 * and the measurement above is the argument against it: the page scrolls
 * correctly under the pointer today, the Mediathek stacks several rails down one
 * screen, and a reader scrolling past them would find the page stop and a row
 * slide sideways instead. Fixing a gesture that works is a worse trade than
 * leaving one gesture to the hand.
 *
 * ## The element this attaches to
 *
 * react-native-web renders a horizontal `ScrollView` as a `<div>` with
 * `overflow-x: auto; overflow-y: hidden`, and hands a forwarded ref that div
 * itself rather than a component instance (`exports/ScrollView/index.js`,
 * `_setScrollNodeRef` → `mergeRefs(this.props.forwardedRef)`). React Native's
 * types cannot say that, which is what the cast at the bottom is for.
 *
 * It also means the callback follows the OLD ref contract and not React 19's:
 * `mergeRefs` throws away whatever a callback returns, so a cleanup function
 * would never be called. The teardown is the `null` call instead.
 *
 * ## Why not a cursor
 *
 * A rail that can move would like to say so, and `cursor: grab` on the scroller
 * is how that is usually said. It does not work here, measured the same day: the
 * cards are `Pressable`s, so the element under the pointer over almost all of a
 * rail's area carries `cursor: pointer` of its own, and a child's cursor wins
 * over its scroller's. A `grab` on the scroller would therefore appear only in
 * the gaps between cards and flicker as the pointer crossed one, which says less
 * than nothing. Saying it properly would mean a rule reaching every descendant,
 * i.e. a stylesheet injected from a hook, and that is more machinery than the
 * gesture is worth. The affordance is the card cut off at the screen edge, which
 * is what `Rail` is arranged around in the first place.
 */
export function useRailDrag(): Ref<ScrollView> | undefined {
  /*
   * The teardown of the rail this component currently has, kept in a ref because
   * the `null` call carries no node to look one up by.
   */
  const release = useRef<(() => void) | null>(null);

  /*
   * One callback for the life of the component, because nothing here re-runs it:
   * React hands the node to react-native-web's own ref, which calls this one —
   * once with the node and once with `null`. A callback whose identity changed
   * per render would simply never be called again.
   */
  const attach = useCallback((node: HTMLElement | null) => {
    release.current?.();
    release.current = node === null ? null : railDrag(node);
  }, []);

  return attach as unknown as Ref<ScrollView>;
}

/** A press in progress. Absent between presses, which is most of the time. */
interface Press {
  readonly pointer: number;
  readonly grab: Grab;
  /**
   * The rail's size at the grab, read once.
   *
   * Once rather than per move because reading `scrollWidth` forces layout and a
   * drag asks for one on every frame, and because the answer cannot usefully
   * change: content arriving mid-press would extend the rail, and the press
   * simply cannot reach the new part until it is let go of. The browser clamps
   * the assignment either way, so the worst case is a rail that stops one card
   * early for the rest of one gesture.
   */
  readonly extent: Extent;
  /**
   * The pointer's furthest HORIZONTAL distance from the grab so far; see
   * `isDrag`, which says why the furthest rather than the latest and why the
   * vertical component is thrown away.
   */
  travelled: number;
  /** Whether that distance has passed `GRIP` at any point during this press. */
  dragging: boolean;
}

/**
 * Everything a browser needs for one rail, returning its own teardown.
 *
 * Separate from the hook because it is plain DOM: no React, nothing to re-run,
 * and every listener it adds is removed by the function it returns.
 *
 * Exported for `__tests__/rail-drag-web.test.ts` and for nothing else — `Rail`
 * reaches this file through the hook. The export is the whole of what makes the
 * part that can actually go wrong testable: the `pointerType` gate, the capture
 * held back to the threshold, the capture-phase swallow and this teardown are
 * all here, and a test that had to mount a `ScrollView` to reach them would be
 * testing react-native-web's ref forwarding instead.
 */
export function railDrag(node: HTMLElement): () => void {
  let press: Press | null = null;
  /** Set by a drag that was RELEASED, read and cleared by the click that follows it. */
  let swallow = false;

  const down = (event: PointerEvent) => {
    /*
     * Every press clears it, not only a press that becomes a drag. A drag that
     * ends outside any element produces no click at all, and without this the
     * flag would sit there and eat the next real one.
     */
    swallow = false;

    /*
     * A mouse and nothing else. A finger and a pen already scroll a rail
     * natively and would be dragging it twice; the second copy is not even the
     * same gesture, because a finger gets momentum from the browser and this
     * gives none.
     *
     * `pointerType` and not `'ontouchstart' in window`, which is what the
     * dragscroll this borrows from tests: that question is about the DEVICE, so
     * a touchscreen laptop answers yes and loses the drag on the mouse it also
     * has. This question is about the pointer that is actually pressing.
     */
    if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary) return;
    if (press !== null) return;

    const extent = { scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
    // Nothing to drag, so nothing to take over: a press on a rail that fits is
    // an ordinary press on a card.
    if (reach(extent) === 0) return;

    press = {
      pointer: event.pointerId,
      grab: { x: event.clientX, left: node.scrollLeft },
      extent,
      travelled: 0,
      dragging: false,
    };

    /*
     * On the document, not on the rail: the first move of a fast drag can land
     * outside the rail's own box, and a listener on the rail would miss it and
     * never start.
     */
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  };

  const move = (event: PointerEvent) => {
    if (press === null || event.pointerId !== press.pointer) return;

    press.travelled = Math.max(press.travelled, Math.abs(event.clientX - press.grab.x));

    if (!press.dragging && isDrag(press.travelled)) {
      press.dragging = true;
      /*
       * Capture the pointer HERE and not at the press.
       *
       * Capture is what makes a release outside the browser window still arrive,
       * which is the failure mode of every drag-scroll that listens on `window`
       * instead: the button comes up over another application, no `pointerup` is
       * delivered, and the rail goes on following the mouse when it comes back.
       *
       * It costs something, though, and that is why it waits: a captured pointer
       * retargets the compatibility mouse events to the capturing element, so
       * the `click` that ends the press is dispatched against the rail rather
       * than against the card under it — and a card's `onPress` is react-native-
       * web's `onClick` (`modules/usePressEvents/PressResponder.js`: "Only when
       * the browser produces a `click` event is `onPress` invoked"). Capturing
       * from `pointerdown` would therefore have made every tap on a rail card
       * dead. Past `GRIP` there is no press left to break, because the click is
       * about to be swallowed anyway.
       */
      try {
        node.setPointerCapture(press.pointer);
      } catch {
        // The pointer is already gone. The document listeners are what actually
        // drive the drag, so it carries on without the guarantee.
      }
    }

    if (press.dragging) node.scrollLeft = heldAt(press.grab, press.extent, event.clientX);
  };

  const end = (event: PointerEvent) => {
    if (press === null || event.pointerId !== press.pointer) return;
    /*
     * A release arms the swallow; a CANCEL must not. Both end the press and both
     * arrive here, but only a release is followed by the `click` that reads the
     * flag and clears it. Setting it on a cancel leaves it armed with nothing
     * coming to consume it, and the next real click on this rail — a whole
     * gesture later — is the one that gets eaten.
     */
    swallow = event.type === 'pointerup' && press.dragging;
    press = null;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', end);
  };

  /**
   * The click a drag leaves behind, taken out before anything can act on it.
   *
   * In the CAPTURE phase and on the rail, which is what makes it early enough.
   * React attaches its delegated listeners to the root container, so a card's
   * `onPress` runs when the event bubbles back up there — after this. Calling
   * `stopPropagation` here means it never gets that far.
   */
  const click = (event: MouseEvent) => {
    if (!swallow) return;
    swallow = false;
    event.stopPropagation();
    // And the element's own default with it, for the day a card is an <a href>.
    event.preventDefault();
  };

  /**
   * A selection and a native drag image, refused for as long as a button is down
   * on the rail.
   *
   * `preventDefault` on `pointerdown` would stop both in one line and is what
   * the dragscroll this borrows from used to do. It also stops the compatibility
   * `mousedown`, and `mousedown` is what focuses an element — so a rail's cards
   * would stop taking focus from a click, which is a real loss for a real
   * keyboard user in exchange for a tidier implementation.
   */
  const refuse = (event: Event) => {
    if (press !== null) event.preventDefault();
  };

  node.addEventListener('pointerdown', down);
  node.addEventListener('click', click, true);
  node.addEventListener('selectstart', refuse);
  node.addEventListener('dragstart', refuse);

  return () => {
    node.removeEventListener('pointerdown', down);
    node.removeEventListener('click', click, true);
    node.removeEventListener('selectstart', refuse);
    node.removeEventListener('dragstart', refuse);
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', end);
    document.removeEventListener('pointercancel', end);
    press = null;
  };
}
