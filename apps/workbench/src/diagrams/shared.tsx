import { defineMessages } from 'react-intl';

import type { ReactNode } from 'react';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { cn } from '../lib/cn';

/*
 * The drawings' vocabulary, which used to be a stylesheet.
 *
 * Tailwind utilities work on SVG elements, so `fill-canvas` and `stroke-stroke`
 * say on a `rect` what they say on a `div`, and both read the same token the app
 * reads. What a plain utility cannot say is that eighteen chips are one thing, so
 * each visual role keeps its name here. A role named once is a role that cannot
 * drift across three diagrams, which is the whole reason the deleted sheet had
 * these names.
 *
 * Every one of them is a token, never a literal. That is what makes the drawings
 * follow the light and dark schemes with no second asset to keep in step, and
 * `test/styles.test.ts` fails the build on a colour value written here.
 */

/** A container, filled with the ground so a line behind it is knocked out. */
export const BOX = 'fill-canvas stroke-stroke';
/** The core's own frame, which is the one box that outranks the boxes near it. */
export const BOX_CORE = 'fill-canvas stroke-stroke-strong [stroke-width:1.5]';
/** A labelled block sitting on the ground, one step up from it. */
export const CHIP = 'fill-surface stroke-stroke';
/** A port, drawn as a contract rather than a block, so it takes the accent. */
export const CHIP_PORT = 'fill-canvas stroke-accent [stroke-width:1.5]';
export const CARD = 'fill-surface stroke-stroke';
/** The adapter band, which is a fill and no outline because a rule sits under it. */
export const BAND = 'fill-surface stroke-none';
export const CALLOUT = 'fill-surface stroke-stroke';
/** A grouping frame, dashed because it encloses without being a thing itself. */
export const DASHED = 'fill-none stroke-stroke-strong [stroke-dasharray:6_5]';
/** A dependency the package may not have, drawn as an absence. */
export const GHOST = 'fill-canvas stroke-stroke [stroke-dasharray:4_3]';

export const RULE = 'stroke-stroke';
export const RULE_STRONG = 'stroke-stroke-strong';
export const AXIS = 'stroke-stroke';
export const WIRE = 'fill-none stroke-on-canvas-muted [stroke-width:1.5]';
export const LEAD = 'stroke-stroke';
/** The line nothing crosses, and the figcaption below calls it the red line. */
export const BOUNDARY = 'stroke-accent stroke-2';
/** An amendment a record makes to an earlier one, stated in the record itself. */
export const ARC = 'fill-none stroke-on-canvas-muted';
/** A relation drawn as weaker than a stated one, because it is inferred. */
export const ARC_INDEX = 'fill-none stroke-stroke-strong [stroke-dasharray:2_3]';
/*
 * The arrowhead. A marker does not inherit from the line that references it, it
 * inherits from where it is defined, so it carries its own fill.
 *
 * There were three more roles here — a lighter arrowhead, a dashed arc into a
 * living document, and a hatch — and all three belonged to the hand-drawn
 * decisions chain. It generates itself from `adr/` now and draws neither the
 * index's prose relations nor the living documents, because neither can be
 * derived from a record; `diagrams/layout.ts` carries that reasoning. A named
 * role with no drawing behind it is the vocabulary going stale on its own.
 */
export const MARKER = 'fill-on-canvas-muted stroke-none';

/**
 * The arrowhead itself, which five of the drawings had a copy of.
 *
 * A marker is referenced by id and an id is document-wide, so each drawing needs
 * one of its own rather than a shared definition — but the geometry was the same
 * eight numbers in all five, and the fifth copy is how a drawing ends up with a
 * head a size nobody chose. The id stays at the call site because that is the half
 * that genuinely differs, and it is what `markerEnd="url(#…)"` a few lines below
 * has to match.
 *
 * `Services.tsx` keeps its own, smaller: it is the one drawing laid out at a
 * different scale, and parameterising this for its six numbers would be the shared
 * thing carrying the difference rather than the sameness.
 */
export function ArrowMarker({ id }: { id: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="9"
      refY="5"
      markerWidth="8"
      markerHeight="8"
      orient="auto"
    >
      <path d="M0 0 L10 5 L0 10 z" className={MARKER} />
    </marker>
  );
}

/** A record with nothing recorded against it, drawn small on the axis. */
export const NODE_QUIET = 'fill-stroke-strong stroke-none';
export const NODE_INTACT = 'fill-canvas stroke-on-canvas-muted [stroke-width:1.5]';
/** Accepted, with claims struck in place. Club yellow, which both schemes share. */
export const NODE_STRUCK = 'fill-accent-alternative stroke-stroke-strong';
/** Moot, so the ring is broken rather than merely pale. */
export const NODE_MOOT = 'fill-surface stroke-stroke-strong [stroke-dasharray:2_2]';

/*
 * Type, in the drawing's own units.
 *
 * These are the one place the theme's named steps are the wrong tool. A step is
 * in rem, which does not scale with the viewBox, so a label set in `text-s` would
 * hold still while the drawing around it grew. Inside an SVG a size in px is a
 * size in user units, and the drawings were laid out against these four.
 */
export const T11 = 'text-[11px]';
export const T12 = 'text-[12px]';
export const T13 = 'text-[13px]';
export const T16 = 'text-[16px]';
export const MONO = 'font-mono';
export const BOLD = 'font-semibold';
export const MUTED = 'fill-on-canvas-muted';
export const STRIKE = 'line-through fill-on-canvas-muted';
/**
 * A label that sits on a line it must stay readable over.
 *
 * The glyphs are stroked in the ground colour and painted stroke-first, so the
 * outline knocks the line out behind the text rather than over it. This is why
 * the scroll box below is `bg-canvas` and not `bg-surface`: the halo is a colour,
 * and it has to be the colour actually behind it.
 */
export const HALO = '[paint-order:stroke] stroke-canvas [stroke-width:3] [stroke-linejoin:round]';

/*
 * And the drawing surface itself.
 *
 * `fill-on-canvas` is inherited by every `text` in the drawing, which is what
 * keeps a label from falling back to the browser's black on a dark page. The
 * baseline rule is a descendant selector because `dominant-baseline` is one of
 * the few SVG properties that does not inherit, and the drawings are laid out
 * centred: a legend's text shares the y of the circle beside it.
 */
export const DRAWING = 'fill-on-canvas [&_text]:[dominant-baseline:central]';

/**
 * A diagram is wider than the column, so it scrolls inside its own box.
 *
 * The focus ring is for the stop `DiagramFigure` puts on that box, and the argument
 * for the stop is down there beside the `tabIndex` rather than up here beside the
 * class it is drawn with.
 */
export const SCROLL_BOX = cn(
  'overflow-x-auto rounded-md border border-stroke bg-canvas p-xs',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
);

/**
 * Identifiers in the prose around the drawings, styled as the documents style them,
 * since this page names the same paths.
 *
 * `app.css` styles `code` only inside `.prose`, which is the rendered-Markdown
 * wrapper, and none of this page is that. Naming the element from its container
 * keeps the rule in one place rather than on every `code` element in a caption or a
 * list, which is why `CAPTION` and `ALT` below fold this in and no call site writes
 * it on a `code` of its own.
 *
 * `overflow-wrap: anywhere` for the same reason `app.css` gives it to `.prose`:
 * a path has no break opportunity in it, and one `apps/mobile/src/lib/platform/
 * expo.ts` took the whole page sideways in a 375px window.
 */
export const PROSE_CODE =
  '[&_code]:rounded-s [&_code]:border [&_code]:border-stroke [&_code]:bg-canvas [&_code]:px-3xs [&_code]:font-mono [&_code]:text-[0.875em] [&_code]:[overflow-wrap:anywhere]';

/*
 * The page around the drawings.
 *
 * The measure is the theme's, and only the scroll boxes are allowed past it: a
 * caption and a list are prose and want a line length, a diagram is a picture and
 * wants the width of the column.
 */
export const SECTION = 'mt-2xl first:mt-0 scroll-mt-m';
export const HEADING = 'max-w-content text-headline-xl font-semibold tracking-tight text-on-canvas';
export const LEDE = 'mt-xs max-w-content text-l leading-normal text-on-canvas-muted';
export const FIGURE = 'mt-m';
export const CAPTION = cn(
  'mt-s max-w-content text-m leading-normal text-on-canvas-muted [&_strong]:text-on-canvas',
  PROSE_CODE,
);
/** The list under each figure, which is the page for anyone who cannot see it. */
export const ALT = cn(
  'mt-m max-w-content rounded-md border border-stroke bg-surface p-sm text-m leading-normal',
  '[&_h3]:mb-xs [&_h3]:text-headline-xs [&_h3]:font-semibold [&_h3]:text-on-canvas',
  '[&_dt]:mt-s [&_dt]:font-semibold [&_dt]:text-on-canvas [&_dt:first-of-type]:mt-0',
  '[&_dd]:ml-0 [&_dd]:mt-3xs [&_dd]:text-on-canvas-muted',
  '[&_ul]:mt-3xs [&_ul]:list-disc [&_ul]:space-y-3xs [&_ul]:pl-sm',
  '[&_ol]:mt-3xs [&_ol]:list-decimal [&_ol]:space-y-3xs [&_ol]:pl-sm',
  '[&_p]:mt-xs [&_p]:text-on-canvas-muted',
  '[&_strong]:font-semibold [&_strong]:text-on-canvas',
  '[&_s]:text-on-canvas-muted',
  PROSE_CODE,
);

/**
 * Type on club yellow, which is the one place here a colour must NOT follow the
 * scheme.
 *
 * `NODE_STRUCK` fills with `accent-alternative`, and that token is the same
 * `#fde162` in both schemes on purpose. The text over it inherits `fill-on-canvas`
 * from `DRAWING`, which is near-black in light and near-white in dark — so a chip
 * that reads perfectly in one scheme is pale grey on yellow in the other. Found by
 * looking at the dark rendering of the fifth drawing; `test/styles.test.ts` cannot
 * see it, because both halves are tokens and neither is a colour literal.
 *
 * `neutral-700` is a primitive rather than a semantic role, which is the point:
 * AGENTS.md reserves the primitives for exactly this case, "a label on club
 * yellow", and the token package defines this one as `#333333` in both schemes.
 */
export const ON_ALTERNATIVE = 'fill-neutral-700';

/**
 * The box around a drawing, which every drawing had written out for itself.
 *
 * Six copies of the same four elements, and the parts worth getting right were in
 * all six: a named section, because that is what a landmark for a scrollable box is
 * spelled as in HTML, and an `<svg>` with no role of its own, because that element
 * already carries the graphics-document role a diagram wants. The name and the
 * description come from the `<title>` inside the drawing and the list below it, so
 * the picture is never the only way to read this.
 *
 * `tabIndex={0}` is the exception `.oxlintrc.json` carries for
 * `apps/workbench/src/diagrams/*.tsx`, and it now sits here rather than once per
 * figure. Chrome and Firefox focus a scroll container on their own, Safari does
 * not, and a diagram nobody can scroll is worse than a lint exception with a reason
 * attached.
 *
 * **`number` is typed rather than derived, and it is the one figure here that can
 * drift.** It is the drawing's place in `DIAGRAMS`, which `DiagramView` also counts
 * the breadcrumb off, and the number a screen reader hears has to be the number the
 * page shows. Reading it from `diagrams/index.ts` is what the drawings cannot do:
 * that module imports every one of them, so asking it back would be a cycle.
 */
/**
 * The two things the frame around a drawing says in its own voice, in ENGLISH;
 * the German that ships is `src/i18n/catalogue/de/diagrams.ts`.
 *
 * They are in the `diagrams.*` namespace rather than in a drawing's, because
 * this frame is drawn six times and belongs to none of the six. Nothing outside
 * this file reads them, so the block keeps the plain name.
 */
const COPY = defineMessages({
  scroll: {
    id: 'diagrams.figure.scroll',
    defaultMessage: 'Diagram {number}, scrollable',
    description:
      'The name of the box a drawing scrolls sideways inside, read aloud and never drawn. {number} is the drawing’s place in the set, counted from one, and is the same number the page shows in its breadcrumb.',
  },
  alt: {
    id: 'diagrams.figure.alt',
    defaultMessage: 'The same diagram as a list',
    description:
      'The heading over the list beneath a drawing. That list is not a caption: it is the page for anyone who cannot use the picture.',
  },
});

export function DiagramFigure({
  number,
  altId,
  drawing,
  caption,
  alt,
  children,
}: {
  number: number;
  /** What the drawing's `aria-describedby` points at, on the drawings that have one. */
  altId?: string;
  drawing: ReactNode;
  caption: ReactNode;
  alt: boolean;
  /** The list under the figure, which is the page for anyone who cannot see it. */
  children: ReactNode;
}) {
  const intl = useWorkbenchIntl();

  return (
    <figure className={FIGURE}>
      {/* `intl.formatMessage` and never `<FormattedMessage>`: that component reads
          react-intl's own context, which the app's provider shadows inside an
          `AppHost`. `test/i18n.test.ts` fails on one. */}
      <section
        className={SCROLL_BOX}
        aria-label={intl.formatMessage(COPY.scroll, { number })}
        tabIndex={0}
      >
        {drawing}
      </section>
      <figcaption className={CAPTION}>{caption}</figcaption>
      {alt && (
        <div className={ALT} id={altId}>
          <h3>{intl.formatMessage(COPY.alt)}</h3>
          {children}
        </div>
      )}
    </figure>
  );
}
