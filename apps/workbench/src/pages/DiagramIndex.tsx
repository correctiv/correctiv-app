import { DIAGRAMS } from '../diagrams';
import { CardGrid, type Card } from '../ui/CardGrid';
import { Page } from '../ui/Page';
import { diagramRoute } from './DiagramView';

/**
 * The drawings, as doors.
 *
 * They used to be one page nine screens tall, so looking at the third meant
 * scrolling past two others, each of which is a picture you are meant to study
 * rather than skim.
 *
 * The card carries the drawing itself, scaled to fit, and not a picture of it.
 * A thumbnail that is a separate asset is a thumbnail that goes stale, and these
 * are inline SVG with a `viewBox`, so a box and two rules are the whole cost of
 * having one that cannot.
 */
export function DiagramIndex() {
  const cards: Card[] = DIAGRAMS.map(({ id, title, lede, Drawing }, i) => ({
    route: diagramRoute(id),
    title: `${i + 1}. ${title}`,
    blurb: lede,
    preview: (
      <span
        aria-hidden="true"
        className="stage-grid block h-[11rem] shrink-0 overflow-hidden border-b border-stroke p-s [&>svg]:h-full [&>svg]:w-full [&>svg]:max-w-none"
      >
        <Drawing />
      </span>
    ),
  }));

  return (
    <Page>
      <h1 className="max-w-content text-headline-xl font-semibold tracking-tight">Diagrams</h1>
      <p className="mt-xs max-w-content text-l leading-normal text-on-canvas-muted">
        The same architecture the workbench explains in prose, drawn. Each one is hand-authored SVG
        whose every fill and stroke comes from a class, so it follows the light and dark schemes on
        its own and there is no second asset to keep in step.
      </p>
      <p className="mt-s max-w-content text-m leading-relaxed text-on-canvas-muted">
        Every drawing carries the same thing as a list underneath it. That list is not a caption: it
        is the page for anyone who cannot use the picture.
      </p>

      <CardGrid cards={cards} columns={2} />
    </Page>
  );
}
