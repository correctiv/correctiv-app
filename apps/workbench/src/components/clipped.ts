import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Whether the square a card reserves is showing the whole component or a crop.
 *
 * **Measured, never listed.** Which components do not fit is a fact about three
 * things that all move: the grid (how wide a column is at this width), the
 * viewport, and the app (a component gains a row and grows by 24px). A list of
 * names in this repository would be right on the day it was written and wrong on
 * the next one, and wrong here means a card cropping a component while claiming
 * to show all of it — the same lie the old iframe told when it drew a 393pt phone
 * for a one-pixel `Hairline` (ADR 0027). So the card asks the two boxes.
 *
 * Measured on 2026-09-11 at 1280 with the shipped grid: three of the 47 clip.
 * That number is in ADR 0028 as an observation and in no branch anywhere.
 */

/**
 * A pixel of slack, because a box measured against itself is never exact.
 *
 * `getBoundingClientRect` returns fractions, the two boxes are laid out by
 * different rules — one from `aspect-ratio` on a fractional column width, the
 * other from a specimen's own content — and a card whose specimen fits exactly
 * would otherwise flicker its marker on and off as the column crosses a
 * half-pixel. One pixel of a component is not worth a claim about it.
 */
export const CLIP_SLACK = 1;

/** Whether `content` is taller than the `stage` it is drawn in, past the slack. */
export function clips(content: number, stage: number): boolean {
  // Before the first layout both are zero, and nothing is known yet. Answering
  // "yes" there would put a marker on all 47 cards for one frame.
  if (stage <= 0 || content <= 0) return false;
  return content - stage > CLIP_SLACK;
}

export interface Clipped {
  /** True while the specimen is taller than the square it is drawn in. */
  clipped: boolean;
  /**
   * The specimen's own height in CSS pixels, which is what the crop hides.
   *
   * **`offsetHeight` and not the rectangle's height**, because a card that scales its
   * drawing has two heights and the one a reader is told is the larger of them. The card in
   * `ui/kit/PreviewCard.tsx` puts `transform: scale` on the drawing so a block is recognisable
   * at a card's width; the rectangle then measures the scaled height, which is a number about
   * the card rather than about the component. `offsetHeight` is the layout box, which a
   * transform does not touch, so „484 px hoch" means 484 pixels of app either way.
   */
  natural: number;
  /**
   * The height the specimen is PAINTED at, which is the one a crop is measured against.
   *
   * Equal to `natural` wherever nothing is scaled — which is every card the component page
   * draws, and all but the block picker's.
   */
  painted: number;
  /**
   * The stage's own width in CSS pixels: the room a card has to draw in.
   *
   * **`clientWidth` and not the rectangle's width**, because it is the content box and that is
   * what a drawing laid out at `100%` lands in. Zero before the first layout, which `fit()`
   * reads as "not measured yet" rather than as no room at all.
   *
   * It is here because this is the observer that already watches the stage: a card that has to
   * know how wide its well is to scale what it draws into it is asking about the same two boxes
   * in the same pass, and a second observer per card would be a second answer that can arrive a
   * frame apart from the first.
   */
  room: number;
}

/**
 * The two boxes a card has to compare, and the answer they give.
 *
 * A `ResizeObserver` over both rather than one measurement after mount: a
 * specimen settles at its own speed — a font arrives, an image resolves its
 * aspect ratio — and the column itself changes width when the window or the
 * right-hand panel does. Both of those change the answer, and neither fires an
 * event a single pass would see.
 *
 * One observer per card watching two elements. ADR 0028 refused an
 * `IntersectionObserver` here because it would have gated *mounting* — a second
 * lifecycle under every specimen, and a new place for one to fail. This gates
 * nothing: the specimen is mounted and drawn either way, and all this decides is
 * whether a marker is painted over the bottom of it.
 */
export function useClipped<S extends HTMLElement, C extends HTMLElement>() {
  const stage = useRef<S>(null);
  const column = useRef<C>(null);
  const [state, setState] = useState<Clipped>({
    clipped: false,
    natural: 0,
    painted: 0,
    room: 0,
  });

  useLayoutEffect(() => {
    const stageElement = stage.current;
    const columnElement = column.current;
    if (!stageElement || !columnElement) return;

    const measure = () => {
      const painted = Math.round(columnElement.getBoundingClientRect().height);
      const natural = columnElement.offsetHeight;
      const box = Math.round(stageElement.getBoundingClientRect().height);
      const next = {
        natural,
        painted,
        room: stageElement.clientWidth,
        clipped: clips(painted, box),
      };
      setState((previous) =>
        previous.natural === next.natural &&
        previous.painted === next.painted &&
        previous.room === next.room &&
        previous.clipped === next.clipped
          ? previous
          : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stageElement);
    observer.observe(columnElement);
    return () => observer.disconnect();
  }, []);

  return { stage, column, ...state };
}
