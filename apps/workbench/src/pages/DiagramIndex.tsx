import { defineMessages } from 'react-intl';

import { DIAGRAMS } from '../diagrams';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { CardGrid, type Card } from '../ui/CardGrid';
import { InfoTip } from '../ui/kit/info-tip';
import { Page } from '../ui/Page';
import { diagramRoute } from './DiagramView';

/**
 * Everything this page says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/diagrams.ts`, which holds both this page's ids and a
 * single drawing's — one namespace per area rather than one per file.
 *
 * **What a card says about a drawing is not here, and is a message all the
 * same.** A card's title and its sentence are `title` and `lede` off the
 * drawing's own module in `src/diagrams/`, where they are descriptors in that
 * drawing's own namespace. This page formats them; it does not hold them. A
 * drawing's name belongs to the drawing
 * ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
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
    defaultMessage: 'The architecture the handbook describes, as drawings.',
    description:
      'The sentence under the heading, which says what the page is. The rest of what used to be this paragraph is diagrams.lede.more, behind the ⓘ at its end.',
  },
  ledeMore: {
    id: 'diagrams.lede.more',
    defaultMessage:
      'Each drawing is hand-written SVG and takes all of its colours from classes. So it follows the light and dark scheme by itself, and there is no second file to keep in step.',
    description:
      'Behind the ⓘ at the end of the sentence under the heading, followed there by diagrams.list.',
  },
  list: {
    id: 'diagrams.list',
    defaultMessage:
      'Under every drawing, the same content appears as a list. The list is not a caption. It is the page for anyone who cannot use the picture.',
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

  const cards: Card[] = DIAGRAMS.map(({ id, title, lede, ledeValues, Drawing }, i) => ({
    route: diagramRoute(id),
    // The number is the reading order and is no word: `1. ` is the same in both
    // languages. The title beside it is the drawing's own descriptor, out of
    // `src/diagrams/`, formatted here and written there.
    title: `${i + 1}. ${intl.formatMessage(title)}`,
    blurb: intl.formatMessage(lede, ledeValues),
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
        {intl.formatMessage(COPY.lede)}{' '}
        <InfoTip about={intl.formatMessage(COPY.title)}>
          <p>{intl.formatMessage(COPY.ledeMore)}</p>
          <p>{intl.formatMessage(COPY.list)}</p>
        </InfoTip>
      </p>

      <CardGrid cards={cards} columns={2} />
    </Page>
  );
}
