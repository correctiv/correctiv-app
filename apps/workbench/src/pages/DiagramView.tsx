import { ArrowLeft, ArrowRight } from 'lucide-react';
import { defineMessages } from 'react-intl';

import { DIAGRAMS, type DiagramMeta } from '../diagrams';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { Page } from '../ui/Page';
import { cn } from '../lib/cn';
import { href } from '../router';
import { sectionOf } from '../ui/ActivityBar';

const LINK =
  'inline-flex items-center gap-2xs rounded-md text-m text-on-canvas underline decoration-accent underline-offset-2 hover:text-on-canvas-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/**
 * Everything this page says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/diagrams.ts`, which holds both this page's ids and
 * `/diagrams`'s.
 *
 * **What is here is the frame and not the drawing.** The breadcrumb, where this
 * drawing sits in the set and the name of the navigation at the foot are what
 * this page says in its own voice. The title, the lede, the picture and the list
 * under it come out of the drawing's own module in `src/diagrams/`, and so do the
 * two titles the links at the foot carry. Those are this site's words as well by
 * [ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1,
 * and they are descriptors in the drawing's own namespace; this page formats
 * them and holds none of them.
 *
 * The first step of the breadcrumb is not here either, and that one is not
 * waiting for anybody: it is `sectionOf()`, the rail's own word for whichever
 * section the route is in. `pages/Document.tsx` says why a breadcrumb asks the
 * rail rather than asserting a word of its own.
 */
const COPY = defineMessages({
  breadcrumb: {
    id: 'diagrams.breadcrumb',
    defaultMessage: 'Breadcrumb',
    description:
      'Read aloud as the name of the trail above the drawing, and never drawn. The trail itself is the handbook, the drawings, and where this one is in the set.',
  },
  crumb: {
    id: 'diagrams.crumb',
    defaultMessage: 'Diagrams',
    description:
      'The second step of that trail, which is the name of the page it links to. diagrams.title is that page’s own heading and handbook.card.diagrams is the card that opens it; all three read the same in English and are three entries because one is a heading, one is a card and one is a link in a trail.',
  },
  position: {
    id: 'diagrams.position',
    defaultMessage: '{position} of {total}',
    description:
      'The last step of the trail, which says where this drawing is in the set rather than naming it: the drawing’s own title is the heading directly underneath. {position} is its number from one and {total} is how many drawings there are.',
  },
  others: {
    id: 'diagrams.others',
    defaultMessage: 'The other diagrams',
    description:
      'Read aloud as the name of the navigation at the foot of the page, which holds the drawing before this one and the one after it, and is never drawn.',
  },
});

/** The route segment a drawing answers on, which is the id it already carried. */
export function diagramRoute(id: string): string {
  return `/diagrams/${id}`;
}

/**
 * One drawing, on its own.
 *
 * The four of them used to be one page, nine screens tall, and looking at the
 * third meant scrolling past two. A drawing is a thing you go to and study, so
 * it gets an address, and the page around it holds nothing but that drawing, what
 * it is for, and the way to the next one.
 */
export function DiagramView({ meta }: { meta: DiagramMeta }) {
  const intl = useWorkbenchIntl();
  const index = DIAGRAMS.findIndex((d) => d.id === meta.id);
  const previous = index > 0 ? DIAGRAMS[index - 1] : null;
  const next = index < DIAGRAMS.length - 1 ? DIAGRAMS[index + 1] : null;
  const { Figure } = meta;

  return (
    <Page>
      <nav
        aria-label={intl.formatMessage(COPY.breadcrumb)}
        className="mb-sm text-s text-on-canvas-muted"
      >
        <ol className="flex flex-wrap items-center gap-2xs">
          <li>
            {/* The section the rail lights, rather than the word "Handbook" written
                out here. `pages/Document.tsx` carries the argument: a breadcrumb is
                navigation and follows the language setting, and a page that spells
                its own section is a page that can be wrong about where it is. */}
            <a className="hover:text-on-canvas" href={href('/handbook')}>
              {intl.formatMessage(sectionOf(diagramRoute(meta.id)))}
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <a className="hover:text-on-canvas" href={href('/diagrams')}>
              {intl.formatMessage(COPY.crumb)}
            </a>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-on-canvas">
            {intl.formatMessage(COPY.position, { position: index + 1, total: DIAGRAMS.length })}
          </li>
        </ol>
      </nav>

      {/* The drawing's own title and lede, out of `src/diagrams/`. This site wrote
          them and they follow the setting too, but where they are written rather
          than here (ADR 0052 §1). */}
      <h1 className="max-w-content text-headline-xl font-semibold tracking-tight">
        {intl.formatMessage(meta.title)}
      </h1>
      <p className="mt-xs max-w-content text-l leading-normal text-on-canvas-muted">
        {intl.formatMessage(meta.lede, meta.ledeValues)}
      </p>

      <Figure />

      <nav
        aria-label={intl.formatMessage(COPY.others)}
        className="mt-2xl flex flex-wrap items-center justify-between gap-s border-t border-stroke pt-sm"
      >
        {previous ? (
          <a className={LINK} href={href(diagramRoute(previous.id))}>
            <ArrowLeft aria-hidden="true" className="size-[0.875rem]" />
            {intl.formatMessage(previous.title)}
          </a>
        ) : (
          <span />
        )}
        {next && (
          <a className={cn(LINK, 'ml-auto')} href={href(diagramRoute(next.id))}>
            {intl.formatMessage(next.title)}
            <ArrowRight aria-hidden="true" className="size-[0.875rem]" />
          </a>
        )}
      </nav>
    </Page>
  );
}
