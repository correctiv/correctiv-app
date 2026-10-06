import { TriangleAlert } from 'lucide-react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import type { SizeReading } from './size';

/**
 * What the panel says about the document as a whole, and only when there is something to
 * say. Its own file for the reason `TextSetting.tsx` is one: `HomeDocument.tsx` cannot be
 * rendered by a test, and a sentence kept beside its markup there would have none.
 */
const COPY = defineMessages({
  nearLimit: {
    id: 'home.document.nearLimit',
    defaultMessage:
      'The published screens are at {share} of what the app reads: {length} of {limit} characters. Past that the app ignores the document and draws the one it ships with.',
    description:
      'A warning under the head of the layout tool, shown from 80 percent of the limit on (ADR 0075 §7). {share} is the fraction already formatted as a percentage, {length} is how many characters the screens and the navigation come to when they are joined, and {limit} is the most the app reads, both as plain numbers.',
  },
  overLimit: {
    id: 'home.document.overLimit',
    defaultMessage:
      'The published screens are over what the app reads: {length} of {limit} characters. The app ignores the document and draws the one it ships with.',
    description:
      'Replaces home.document.nearLimit once the joined document is longer than the limit (ADR 0075 §7). {length} is how many characters the screens and the navigation come to when they are joined and {limit} is the most the app reads, both as plain numbers.',
  },
});

const NOTE = 'flex items-start gap-xs text-s leading-relaxed text-on-canvas';

export function SizeNote({ size }: { size: SizeReading }) {
  const intl = useWorkbenchIntl();
  if (!size.near) return null;
  return (
    <output className={NOTE} data-testid="size-note">
      <TriangleAlert aria-hidden="true" className="mt-4xs size-[0.875rem] shrink-0" />
      <span className="min-w-0">
        {size.over
          ? intl.formatMessage(COPY.overLimit, {
              length: intl.formatNumber(size.length),
              limit: intl.formatNumber(size.limit),
            })
          : intl.formatMessage(COPY.nearLimit, {
              share: intl.formatNumber(size.length / size.limit, {
                style: 'percent',
                maximumFractionDigits: 0,
              }),
              length: intl.formatNumber(size.length),
              limit: intl.formatNumber(size.limit),
            })}
      </span>
    </output>
  );
}
