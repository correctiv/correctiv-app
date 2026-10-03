import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';

/**
 * How much of the header has to be gone before it fits in one row, and the one
 * measurement that decides it.
 *
 * **The header is one row or it is broken.** It was `flex-wrap`, and at 1280,
 * 1600 and 2000 CSS pixels alike it broke into three rows: the device picker
 * and the orientation on one, the mark, the actions and the search on the next,
 * the route field and the last two buttons on a third. A bar that grows pushes
 * the frame down and moves everything under it, so a page that reflows the
 * header is a page whose layout depends on the width of the window, and the
 * header is where a reader's eye starts. That is why this is `flex-nowrap` plus
 * what the nowrap cannot hold, and not a breakpoint.
 *
 * **Measured rather than guessed.** Four tiers is a claim about widths, and a
 * claim about widths is one number typed somewhere and wrong on the next font,
 * the next language or the next tool: German runs wider than English, a tool
 * with two changes writes more than one with none, and the panel being open
 * takes the width away from the bar without touching the bar. So the header is
 * measured — `scrollWidth` against `clientWidth` on itself and on the context bar
 * inside it, which is the pair that has to be true — and the tier is whatever
 * measurement says fits. Both boxes are asked, because the context bar is
 * `min-w-0` and takes the shortfall on itself: a bar that clipped its own
 * overflow would measure as fitting at every width.
 *
 * **What each tier gives up, largest saving first**, so that the fewest things
 * have to go for the row to close. Measured on `/preview` with the layout tool
 * open at 1280, 1600 and 2000 CSS pixels:
 *
 * | Tier | What goes | What it saves |
 * |---|---|---|
 * | 0 | nothing: every control with its label | — |
 * | 1 | the frame's secondary controls (language, channel, zoom, reload, open without the frame) behind the bar's own `⋯` | ~400px |
 * | 2 | Verwerfen, Link teilen and Speichern as icons, the label in the tooltip | ~210px |
 * | 3 | Speichern and Verwerfen into one `⋯`; the orientation one icon; the device select narrower | ~310px |
 *
 * The order is the order of what is cheapest to lose, not the order of
 * importance: Submit keeps its label at every tier, because it is the button
 * the bar exists for, and the route field shrinks before any of this — it is the
 * one control here whose width is a choice rather than a meaning.
 *
 * `number` and not a union of four literals, because the walk steps it with
 * `Math.min` and `Math.max`, and those widen a `0 | 1 | 2 | 3` to `number` on
 * the way out. `LAST` is what says how far it may go.
 */
export type HeaderDensity = number;

/** The last tier, named where it is decided so the walk cannot run past it. */
const LAST = 3;

/** One pixel of slack: a sub-pixel layout rounds both sides up and never fits. */
const FITS = 1;

/**
 * **A store and not a React context**, which is the one thing here that is not
 * obvious. The consumers are `ToolActions` (drawn by the header) and the preview's
 * `Toolbar`, and the toolbar arrives through `shell/slots.tsx`, which is a
 * **portal**: the provider wraps the header's own `<header>`, while the toolbar's
 * element tree lives under `SlotProvider` beside it. Context follows the element
 * tree, so the toolbar measured the default of zero and never folded — with the
 * context version the header looked right and the controls beside the frame stayed
 * on the bar anyway. `shell/actions.tsx` is the same shape for the same reason.
 *
 * **The store is also the measurement's own state.** `useOneRow` reads the tier
 * back out of it through `useSyncExternalStore` rather than holding it in a
 * `useState` and publishing on the way out, because a tier the consumers read is a
 * tier that has to be measured again: folding the toolbar's controls gives the bar
 * room back, and the header has to notice that it no longer needs that tier. Held
 * apart, the tier would settle one fold too high and stay there for the width.
 */
let current: HeaderDensity = 0;
const listeners = new Set<() => void>();
/** How many headers are on the page, for the reset below. One, in this site. */
let mounted = 0;

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function tier(): HeaderDensity {
  return current;
}

function publish(next: HeaderDensity): void {
  if (next === current) return;
  current = next;
  // `Set` iteration is defined over a set a listener may have just left, so an
  // unsubscribing re-render during this loop cannot skip the listener after it.
  for (const listener of listeners) listener();
}

/**
 * How much room the bar has to give up. Zero where nothing is drawn above it, so
 * a `ToolActions` rendered on its own in a test behaves as the widest tier and
 * the test sees the labelled buttons.
 */
export function useHeaderDensity(): HeaderDensity {
  return useSyncExternalStore(subscribe, tier, tier);
}

function overflows(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth + FITS;
}

/**
 * The walk one step, from the tier the bar is on now.
 *
 * **A step per layout pass, and one box per question.** React has not drawn the
 * next tier yet, so a burst of measurements here would read the same two boxes four
 * times and hand back the first answer.
 *
 * **Up while it does not fit, and down one tier at a time only past what is already
 * known not to fit** — which is what a floor of one tier for "this bar overflowed
 * here" is for. The obvious rule, "step down while it fits and up while it does not",
 * never finishes: a bar whose true tier is 2 fits at 2, steps down to 1, does not
 * fit there, steps back to 2, and the header renders for as long as the tab is
 * open. `test/ui/header-row.test.tsx` is that oscillation, written down.
 *
 * **The tiers nest, and that is why the answer is the tier the walk rests on.** Each
 * step gives up more than the control it adds, so a bar that fits at a tier fits at
 * every tier above it, and the smallest fitting tier is the answer. The walk finds
 * it from the widest tier downwards, because it starts at zero and climbs into
 * place, and the floor is what stops the one tier above the answer from being asked
 * for twice.
 *
 * **The floor is void whenever the bar's content changed for a reason that is not the
 * walk** — a tool with more changes, a longer status, a panel that took the width. A
 * tier that did not fit because of the content that has since gone is not evidence
 * about the content that replaced it, and keeping it would fold one tier too far and
 * nobody would see it. A render nobody asked for is that signal, and it is the tier
 * not having moved across it that says so.
 *
 * A layout effect and not an effect, because a bar that is briefly too wide and
 * then corrects itself is a bar that reflows twice, and the measurement has to
 * be of the corrected one.
 */
export function useOneRow(boxes: RefObject<HTMLElement | null>[]): HeaderDensity {
  const density = useSyncExternalStore(subscribe, tier, tier);
  /** Bumped when a box is resized by something that renders no line of its own. */
  const [resized, setResized] = useState(0);
  /** The highest tier known not to fit at this width, or -1 while nothing is known. */
  const floor = useRef(-1);
  /** The tier of the last measurement, for telling the walk's own renders from others. */
  const measured = useRef(density);

  /*
   * The tier goes back to zero with the header, and this is not tidiness. Going to
   * `full` draws no header at all (`App.tsx`), and the header that comes back is a
   * new one against a new layout with a floor remembered from the old one: it would
   * start folded, keep the fold for a tier that now fits, and there would be nothing
   * on the page to say so.
   */
  useEffect(() => {
    mounted += 1;
    return () => {
      mounted -= 1;
      if (mounted === 0) publish(0);
    };
  }, []);

  // A window drag, a panel opening and a font arriving all resize the bar without
  // rendering a line, so the measuring effect needs a nudge. One observer for the
  // life of the header and not one per nudge: `observe()` reports the size once on
  // the way in, so an observer rebuilt on every nudge would nudge again, forever.
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setResized((n) => n + 1));
    for (const box of boxes) if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
    // `boxes` is a fresh array every render holding the same refs every render, so
    // the effect below is written once and observes the elements it names.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resized]);

  useLayoutEffect(() => {
    const drawn = boxes.map((box) => box.current).filter((box): box is HTMLElement => box !== null);
    if (drawn.length === 0) return;
    // A render nobody asked for is a bar whose content is not the one the floor is
    // about, and the floor goes with it.
    if (density === measured.current) floor.current = -1;
    measured.current = density;
    if (!drawn.every((box) => !overflows(box))) {
      floor.current = density;
      if (density < LAST) publish(density + 1);
      return;
    }
    if (density > 0 && density - 1 > floor.current) publish(density - 1);
  });

  return density;
}
