import { type ComponentProps, type ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import { useClipped } from '../../components/clipped';
import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
// The one crossing this component makes out of its own layer, and it is deliberate: `fit()` is
// where ADR 0045 §3's "never above one" lives, with a test under it. Scaling here without it
// would be a second `Math.min(1, …)` in a second file, which is the shape of mistake this
// repository has been bitten by. Everything else this needs is its own.
import { fit } from '../../preview/home/fit';

/**
 * One card with a drawing on top, and what is written about it underneath.
 *
 * **Two pages draw this shape and they had drifted apart.** The component page's card reserves
 * a square, draws the specimen at its own width and unscaled, and puts its path and prop count
 * in the foot; the block picker's card reserved a ratio, scaled a whole block into it, and put
 * a feature mark in the foot. Two cards that both answer "what does this look like" and disagree
 * about height, crop and type is the shape a design review finds twice — the picker had rows of
 * 318px beside rows of 337px, a well three fifths empty on the blocks that draw least, and a
 * grid that broke a row in two at every family boundary. So the shape is here once and each page
 * says what is different about its thing.
 *
 * ## The regions, and why each of them is fixed
 *
 * | region | what it is | why it does not vary |
 * |---|---|---|
 * | the well | `previewHeight` tall, or a square | the drawing's own height is a fact about a block, and letting it decide the card's height is what made two rows in one grid differ |
 * | the name | one line, truncated by the caller | ditto |
 * | the sentence | two lines reserved, `min-h-[2lh]` | `line-clamp-2` alone holds the long ones to two and lets the short ones stand at one, which is the same fault one level down |
 * | the foot | pinned with `mt-auto` | a card with a foot and one without are then the same height |
 *
 * **The well is `previewHeight` or a square, and both answers are needed.** The component page
 * draws components of the app's own width, which is not the app's width — `Badge` is 24px tall
 * and `LoginGate` is a screen — so its well follows the column the grid gives it
 * (`aspect-ratio: 1`) and is a different height on every column. The picker draws blocks, which
 * are all drawn at the same 393px, and a well that grew with the column would be 300px at two
 * columns and 244px at three: the same block at two heights in one dialog. A fixed height and a
 * square are the two shapes there are, and this picks between them by prop.
 *
 * ## The crop, which says it is one
 *
 * A block is far taller than any well here, so the drawing is cut off at the bottom, and a cut
 * passed off as the whole thing is the quieter version of the lie ADR 0027 measured: a frame that
 * drew a 393pt phone and called it `Hairline`. It is a fade and one line, painted over a region
 * that is already cut, and only on the cards that are cutting something. Which drawings crop is
 * measured and never listed, because it is a fact about the grid, the window and the app; a list
 * of names would be right on the day it was written and wrong on the next one.
 *
 * **The height in the note is the drawing's own, not the painted one.** A card that scales draws
 * a 484px block at 244px, and „244 px hoch" would be a fact about the card. `offsetHeight` is the
 * layout box and a transform does not touch it, so the number means the same pixels on both
 * pages.
 *
 * The note itself is `aria-hidden`, and that is deliberate rather than an omission: it is a
 * number nobody can act on. `overlay` is handed the same measurement so the control a caller
 * puts over the drawing can carry it into its own name, which is what the component page's link
 * does — the height belongs in the accessible name of the thing that resolves the picture, not
 * beside it.
 */
const COPY = defineMessages({
  clipped: {
    id: 'kit.previewCard.clipped',
    defaultMessage: 'Clipped · {height} px tall',
    description:
      'Printed over the lower edge of a card whose well is showing only the top of what it draws. {height} is that thing’s real height in CSS pixels, measured in the browser, and on a card that scales its drawing it is the height of the app rather than of the scaled copy. Read by eye only: the same fact is in the accessible name of whatever control covers the drawing.',
  },
});

/** What a caller needs to know about the crop to name the control that resolves it. */
export interface PreviewCardCrop {
  /** Whether the well is showing less than the whole of what it draws. */
  clipped: boolean;
  /** The drawing's own height in the app's pixels, which a scale does not change. */
  height: number;
}

interface Props extends Omit<ComponentProps<'div'>, 'title'> {
  /**
   * The name, and whatever else belongs on that line beside it.
   *
   * A node and not a string because both callers put something else on the line — a platform
   * badge on the component page — and neither wants the row the card puts it in.
   */
  title: ReactNode;
  /** Beside the name, and after it. Kept on the line rather than wrapped under it. */
  titleExtra?: ReactNode;
  /**
   * What the thing does, in one or two lines.
   *
   * Clamped, and the whole of it in the `title` under the pointer: a string is clamped to what
   * fits, and nothing here reaches past the clamp on its own.
   */
  description: ReactNode;
  /**
   * The sentence's full text for the `title`, where the description is not itself a string.
   *
   * A string description needs no second answer — this is it — and a node one cannot be read
   * out of, which is the component page's case: its sentence is a component's own JSDoc and
   * stands in for a missing one with an element of this site's.
   */
  descriptionTitle?: string;
  /**
   * The foot, and the only region a caller fills with something of its own.
   *
   * Whatever this is, it is on one line and pinned to the bottom of the card, so a card whose
   * foot is two words is the height of one whose foot is a path and a count.
   */
  footer?: ReactNode;
  /**
   * The drawing.
   *
   * Laid out at `appWidth` and scaled into the well when one is given, and at its own width when
   * one is not — which is the component page's arrangement and its own argument: `LoginGate` is a
   * screen, and a screen shrunk into a card is an unreadable thumbnail claiming a size it has
   * never had.
   */
  preview: ReactNode;
  /**
   * The width the drawing is laid out at, in the app's own pixels, and the switch to scaling.
   *
   * The picker passes the device width the list draws at (393) and gets a drawing scaled to the
   * well, which is what makes a block recognisable at a card's width: measured in a design
   * review, a headline in a 132px thumbnail is two grey pixels, and then the card's own words are
   * carrying the whole decision.
   */
  appWidth?: number;
  /** The well's height in pixels. Omitted for a square, which is what the component page reserves. */
  previewHeight?: number;
  /**
   * Over the drawing, as a sibling of it rather than around it, and handed the crop.
   *
   * A specimen contains `<button>`s and `<a>`s of its own, so a control wrapped round one is
   * invalid HTML and a press lands on the specimen's control rather than the card's. The picker
   * does not use this and puts its button over the whole card as a sibling of the card itself,
   * because its target is the card and not the drawing.
   */
  overlay?: (crop: PreviewCardCrop) => ReactNode;
}

export function PreviewCard({
  title,
  titleExtra,
  description,
  descriptionTitle,
  footer,
  preview,
  appWidth,
  previewHeight,
  overlay,
  className,
  ...rest
}: Props) {
  const intl = useWorkbenchIntl();
  const { stage, column, clipped, natural, painted, room } = useClipped<
    HTMLDivElement,
    HTMLDivElement
  >();

  /**
   * The well is measured and the drawing inside it is not.
   *
   * The picker's first version watched the drawing, whose `clientWidth` is the device's own 393
   * whatever the scale, so every card came out at a scale of one and the drawing was clipped
   * rather than shrunk — three cards in a row showed the top-left corner of a phone-width block
   * with its text cut off at the card's edge. `room` is the stage's own width, measured by the
   * same observer that answers whether the well is cropping, because both are the same question
   * about the same two boxes.
   */
  const fitted = appWidth === undefined ? null : fit(room > 0 ? room : null, appWidth);

  return (
    <div
      className={cn(
        'flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-stroke bg-surface',
        'transition-colors hover:border-stroke-strong',
        className,
      )}
      {...rest}
    >
      {/* Graph paper under the well, so a drawing that paints its own surface reads as a thing
          standing on a stage rather than a box on a page. */}
      <div
        ref={stage}
        className={cn(
          'stage-grid relative flex shrink-0 flex-col overflow-hidden border-b border-stroke bg-canvas',
          previewHeight === undefined && 'aspect-square',
        )}
        style={previewHeight === undefined ? undefined : { height: previewHeight }}
      >
        {/*
          THE STAGE IS CENTRED, NEVER THE DRAWING.

          `my-auto` and not `justify-center`, and the difference is the whole rule. Auto margins
          take the free space when there is some, which centres a short drawing in the well —
          vertical position carries no meaning for something that lives in a scrolling column, and
          a row pinned to the top of the well reads as adrift. That was the picker's `Kopfzeile`,
          its `Lade- und Offline-Hinweis` and its `Sucheinstieg`: three cards whose whole content
          sat in the top fifth of a well and looked like a card that failed to draw. When the
          drawing is taller than the well there is no free space, the margins resolve to zero, and
          it is drawn from its top edge and cut off below. `justify-content: center` would instead
          split the overflow between the two edges and shave the top off every tall drawing, which
          is the half a reader most needs.

          **The wrapper carries the height the drawing is PAINTED at, not its own.** A scaled
          drawing's layout box is still 393 × 484 while it is painted at 393 × 244, and auto
          margins read the layout box — so a scaled drawing centred here would sit a hundred pixels
          too low and be cropped at the bottom instead of in the middle. `painted` is the measured
          height after the transform, which is the box the margins are asking about.
        */}
        {/* THE DRAWING IS WHAT GETS MEASURED, ON A CARD THAT SCALES.

            Two boxes here on purpose, and which one carries the ref is the whole of it. The
            wrapper is what the auto margins centre and what a scaled card's painted height is set
            on; the drawing inside it is what has a height to find. Measuring the wrapper and then
            setting a height on it is a loop that closes on the wrong answer: a block's first
            layout can be an empty one, the empty one measures zero, `height: 0` fixes the box at
            zero, and the drawing that arrives a moment later is then drawn from the middle of the
            well with no crop and no centring — measured, every card on the shelf reported a
            drawing height of 0 and sat 120 pixels down. So the ref goes on the drawing, whose
            height nothing sets, and the wrapper takes the answer.

            With nothing to scale there is one box and it is the wrapper, which is what the
            component page has always measured. `ref` is a prop on an element rather than a thing
            both of them can have, so the two shapes are written out here rather than papered over
            with a wrapper that would put a box into a page this file is only meant to be a
            shape for. */}
        <div
          ref={fitted === null ? column : undefined}
          className="mx-auto my-auto w-full"
          style={fitted === null ? undefined : { height: painted }}
        >
          {/* `w-full` on the wrapper is the horizontal half and it matters: what must never happen
              is the drawing shrinking to its own width, because `ui/Badge` and
              `participate/ClaimStatusTag` would appear centred when both say `self-start` in the
              app, and the card would misdescribe them. `aside` is `fit()`'s own answer to the room
              left over when the well is wider than the phone, which is a card at two columns. */}
          {fitted === null ? (
            preview
          ) : (
            <div
              ref={column}
              style={{
                width: appWidth,
                marginLeft: fitted.aside,
                transform: `scale(${fitted.scale})`,
                transformOrigin: 'top left',
              }}
            >
              {preview}
            </div>
          )}
        </div>

        {clipped ? (
          <>
            {/*
              A fade rather than a cut. The well is shorter than most of what it draws, so the
              last row of pixels is a hard horizontal line through a headline or a rail's second
              tile. Fading the last third into the card's own ground says "there is more below" and
              costs one gradient. Only where there is a crop: over a drawing that fits, a fade
              would be a band painted on nothing.
            */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-canvas to-transparent"
            />
            <p
              aria-hidden="true"
              /* The fade reaches full canvas before the line starts, so the note is read against
                 the card's own ground and not against whatever the drawing happens to be showing
                 there. Above that it is a fade and nothing else: the point is that the drawing
                 runs out of card, not that a band was painted. */
              className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end bg-linear-to-t from-canvas from-40% to-transparent px-s pb-2xs pt-ml text-s text-on-canvas-muted tabular-nums"
            >
              {intl.formatMessage(COPY.clipped, { height: natural })}
            </p>
          </>
        ) : null}

        {overlay?.({ clipped, height: natural })}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3xs p-sm">
        {/*
          The name's own line, and `titleExtra` on it rather than under it. The row does not wrap,
          so a name longer than the line truncates itself — `truncate` on the name, which both
          callers do — rather than pushing the badge off the card.
        */}
        <p className="flex min-w-0 items-center gap-2xs">
          {title}
          {titleExtra}
        </p>

        {/* `text-m` and not a size per caller: the sentence is a step below the name on this card
            and one step above the foot, and the two pages that share it agree on that. The picker
            had it at `text-s`, which is now the foot's size and would have made the sentence and
            the file path under it the same size. */}
        <p
          className="line-clamp-2 min-h-[2lh] text-m leading-relaxed text-on-canvas-muted"
          title={typeof description === 'string' ? description : descriptionTitle}
        >
          {description}
        </p>

        {/* `mt-auto` pins every card's foot to the same line whatever is above it, and
            `min-h-[2lh]` reserves two lines for it whatever is IN it — the same rule the
            sentence above follows, and for the same reason. The block picker's foot holds two
            optional things, a family badge and a one-word feature mark, and the mark is on a
            fifth of the shelf and not on the rest: measured, a card carrying „Vorschau" stood
            387px beside its neighbours at 376px, one mark and eleven pixels. `mt-auto` alone
            pins the foot to the bottom; it does not stop a taller foot from making the card
            taller, and that is this card's whole subject one region lower. */}
        {footer === undefined ? null : (
          <div className="mt-auto flex min-h-[2lh] min-w-0 items-baseline gap-2xs pt-s text-s text-on-canvas-muted">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
