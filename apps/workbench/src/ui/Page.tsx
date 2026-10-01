import type { ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * The one shape every view has: a padded column, filled, left to right.
 *
 * Left-aligned and full width rather than centred behind a maximum, because the
 * column is already as wide as the reader made it. Two sidebars decide that, and
 * a second cap inside them left 362 pixels of empty page on each side of a
 * drawing that was scrolling for want of room.
 *
 * What is bounded is the reading measure, and that is bounded where it belongs,
 * on the prose. A paragraph gets `max-w-content`, 38.75rem, and a diagram gets
 * the column outright.
 *
 * **A table is neither.** It is data rather than sentences, so the reading
 * measure is the wrong bound for it — a 1400px projector squeezed
 * `/provenance`'s table into a column sized for prose and wrapped every file
 * path mid-word. It is not a sentence either, so the column's full width is not
 * the right answer for one sitting between paragraphs: it would tower over the
 * prose either side of it. `max-w-wide`, 62.5rem, is the width this project
 * keeps for exactly that block, and `pages/Document.tsx` is the one place that
 * reaches for it, cutting a table out of the surrounding prose the same way it
 * already cuts out a diagram. A page built around one table and nothing else —
 * `/decisions`, `/sources` — is a board rather than a document, and a board
 * takes the column outright, the way a diagram does.
 */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('px-m py-ml lg:px-ml', className)}>{children}</div>;
}
