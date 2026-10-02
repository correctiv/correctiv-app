import { TriangleAlert } from 'lucide-react';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { cn } from '../../lib/cn';
import { markOf } from './document';

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
