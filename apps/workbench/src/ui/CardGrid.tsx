import { ArrowRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from './kit/badge';
import { cn } from '../lib/cn';
import { href } from '../router';

export interface Card {
  route: string;
  title: string;
  blurb?: string;
  /** A word for what kind of thing this is, where the grid mixes kinds. */
  kind?: string;
  /** Drawn above the title, where the thing has a picture of itself. */
  preview?: ReactNode;
}

/**
 * A set of doors, which is what an index page is.
 *
 * One component because more than one page wants it: the workbench's documents
 * and the drawings. The card is a link with a heading inside it rather than a div
 * with a link inside it, so the whole card is the target and the heading is
 * still a heading, which is how a reader moving by heading finds the doors.
 */
export function CardGrid({ cards, columns = 2 }: { cards: Card[]; columns?: 2 | 3 }) {
  return (
    <ul
      className={cn(
        'mt-m grid gap-s',
        columns === 3 ? 'sm:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2',
      )}
    >
      {cards.map((card) => (
        <li key={card.route} className="min-w-0">
          <a
            href={href(card.route)}
            className={cn(
              'group flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-stroke bg-canvas shadow-e1',
              'transition-[color,background-color,box-shadow,border-color] duration-150 hover:border-stroke-strong hover:shadow-e2',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            {card.preview}
            <span className="flex min-w-0 flex-col p-sm">
              {card.kind && (
                <Badge variant="outline" className="mb-2xs self-start">
                  {card.kind}
                </Badge>
              )}
              {/*
                A real heading, because these pages are an h1 and then a set of
                doors, and a reader moving by heading should reach them. It was a
                span painted at heading size, which this comment already claimed
                it was not.
              */}
              <h2 className="flex items-center gap-2xs text-headline-xs font-semibold text-on-canvas">
                {card.title}
                <ArrowRight
                  aria-hidden="true"
                  className="size-[0.875rem] shrink-0 text-on-canvas-muted transition-transform group-hover:translate-x-3xs"
                />
              </h2>
              {card.blurb && (
                <span className="mt-3xs text-m leading-relaxed text-on-canvas-muted">
                  {card.blurb}
                </span>
              )}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
