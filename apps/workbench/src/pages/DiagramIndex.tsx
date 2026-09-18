import { defineMessages } from 'react-intl';

import { DIAGRAMS } from '../diagrams';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { CardGrid, type Card } from '../ui/CardGrid';
import { Page } from '../ui/Page';
import { diagramRoute } from './DiagramView';

/**
 * Everything this page says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/diagrams.ts`, which holds both this page's ids and a
 * single drawing's — one namespace per area rather than one per file.
 *
 * **What a card says about a drawing is not here.** A card's title and its
 * sentence are `title` and `lede` off the drawing's own module in `src/diagrams/`.
 * Those are this site's own words too by
 * [ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1, and
 * they are a separate pass: a label in an SVG is sized by its own text, so a
 * longer German word reflows the drawing it sits in, and that is a question about
 * each picture rather than about this page.
 */
const COPY = defineMessages({
  title: {
    id: 'diagrams.title',
    defaultMessage: 'Diagrams',
    description:
      'The page’s heading. handbook.card.diagrams is the card on /handbook that opens this page and diagrams.crumb is the step in a single drawing’s breadcrumb that leads back to it; all three read the same in English. nav.diagrams is the longer name the browser tab carries.',
  },
  lede: {
    id: 'diagrams.lede',
    defaultMessage:
      'The same architecture the workbench explains in prose, drawn. Each one is hand-authored SVG whose every fill and stroke comes from a class, so it follows the light and dark schemes on its own and there is no second asset to keep in step.',
  },
  list: {
    id: 'diagrams.list',
    defaultMessage:
      'Every drawing carries the same thing as a list underneath it. That list is not a caption: it is the page for anyone who cannot use the picture.',
  },
});

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
  const intl = useWorkbenchIntl();

  const cards: Card[] = DIAGRAMS.map(({ id, title, lede, Drawing }, i) => ({
    route: diagramRoute(id),
    // The number is the reading order and the title is the drawing's own, out of
    // `src/diagrams/`. Neither is a word, so neither is a message: `1. ` is the
    // same in both languages, and the title is translated where it is written.
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
      <h1 className="max-w-content text-headline-xl font-semibold tracking-tight">
        {intl.formatMessage(COPY.title)}
      </h1>
      <p className="mt-xs max-w-content text-l leading-normal text-on-canvas-muted">
        {/* `intl.formatMessage` and never `<FormattedMessage>`: that component reads
            react-intl's own context, which the app's provider shadows inside an
            `AppHost`. `test/i18n.test.ts` fails on one, and `i18n/Localisation.tsx`
            carries the measurement. */}
        {intl.formatMessage(COPY.lede)}
      </p>
      <p className="mt-s max-w-content text-m leading-relaxed text-on-canvas-muted">
        {intl.formatMessage(COPY.list)}
      </p>

      <CardGrid cards={cards} columns={2} />
    </Page>
  );
}
