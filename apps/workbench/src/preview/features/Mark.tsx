import { TriangleAlert } from 'lucide-react';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import { MARK_CHIP, markOf } from './document';

/**
 * What a release build would do with a thing, said beside it when it would not draw it
 * (ADR 0072 §5): shown and labelled, never hidden. Nothing for a feature that ships.
 */
export function FeatureMark({
  feature,
  className,
}: {
  feature: string | undefined;
  className?: string;
}) {
  const intl = useWorkbenchIntl();
  const mark = feature === undefined ? null : markOf(feature);
  if (mark === null) return null;
  return (
    <p
      className={cn(
        'flex items-start gap-3xs text-s leading-relaxed text-on-canvas-muted',
        className,
      )}
      data-testid="feature-mark"
      data-feature-state={mark.state}
    >
      <TriangleAlert aria-hidden="true" className="mt-4xs size-[0.875rem] shrink-0" />
      <span>
        {intl.formatMessage(mark.state_words)} {intl.formatMessage(mark.reason_words)}
      </span>
    </p>
  );
}

/**
 * The same mark as a chip: one word on a pill, and the whole sentence underneath it.
 *
 * **A chip and not the sentence, because the sentence is what made the tiles unequal.** In
 * the block picker the mark was a paragraph over two or three lines under a card whose other
 * halves were a name and a clamped sentence, so one marked card in a row was half again as
 * tall as its neighbours and the row read as a mistake rather than as a choice. Here the mark
 * is `MARK_CHIP`'s one word and the card's height no longer depends on it.
 *
 * **The reason is not dropped, it is moved.** The pill carries the full sentence in its
 * `title`, which is what a pointer reads on hover, and `aria-description` carries the same
 * text for a screen reader. Both are the same two descriptors `FeatureMark` prints, so a
 * tooltip and the long form cannot part: one `Mark`, two renderings.
 *
 * `title` rather than the site's own tooltip primitive, because the card is behind the
 * button that adds the block and this pill is inside the drawing's `inert` subtree — a
 * floating tooltip would have to be focusable to be opened by the keyboard, and a focusable
 * thing inside a tile that is one button is two stops where the tile is one.
 */
export function FeatureChip({
  feature,
  className,
}: {
  feature: string | undefined;
  className?: string;
}) {
  const intl = useWorkbenchIntl();
  const mark = feature === undefined ? null : markOf(feature);
  if (mark === null) return null;
  const full = `${intl.formatMessage(mark.state_words)} ${intl.formatMessage(mark.reason_words)}`;
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-3xs self-start rounded-full border border-stroke',
        'bg-surface px-2xs py-4xs text-xs font-medium leading-none text-on-canvas-muted',
        className,
      )}
      data-testid="feature-chip"
      data-feature-state={mark.state}
      title={full}
      aria-description={full}
    >
      <TriangleAlert aria-hidden="true" className="size-[0.75rem] shrink-0" />
      <span className="min-w-0 truncate">{intl.formatMessage(MARK_CHIP[mark.state])}</span>
    </span>
  );
}
