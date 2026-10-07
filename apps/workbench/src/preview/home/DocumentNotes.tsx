import { TriangleAlert } from 'lucide-react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { languageName } from './document';
import type { Gap } from './gaps';
import { SHIPPED_LAYOUT } from '@correctiv/app-core/lib/screen-layout';
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
  gap: {
    id: 'home.document.gap',
    defaultMessage:
      '{language} is missing in {count, plural, one {# text} other {# texts}} on this screen.',
    description:
      'Under the head of the layout tool, one line per language some text of the screen does not carry (ADR 0075 §2). {language} is that language’s own name in the reader’s language, as Intl.DisplayNames writes it, and {count} is how many of the screen’s texts lack it. A mark and not a fault: the app draws German where a language is missing.',
  },
  shipped: {
    id: 'home.document.shipped',
    defaultMessage:
      'This is the layout the app ships. Once this change is merged and published, readers get it.',
    description:
      'Beside Submit changes while the open layout is the one the app ships (ADR 0080 §5). It says that, unlike the demo, a change to this layout reaches readers.',
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

export function GapsNote({ gaps }: { gaps: readonly Gap[] }) {
  const intl = useWorkbenchIntl();
  if (gaps.length === 0) return null;
  return (
    <output className={NOTE} data-testid="gaps-note">
      <TriangleAlert aria-hidden="true" className="mt-4xs size-[0.875rem] shrink-0" />
      <span className="flex min-w-0 flex-col">
        {gaps.map((gap) => (
          <span key={gap.language}>
            {intl.formatMessage(COPY.gap, {
              language: languageName(intl, gap.language),
              count: gap.texts,
            })}
          </span>
        ))}
      </span>
    </output>
  );
}

/**
 * What a submission to the shipped layout is, said where it is made. The other layouts are
 * examples and nothing says a word, so the one that reaches readers is the one that speaks.
 */
export function ShippedNote({ layout }: { layout: string }) {
  const intl = useWorkbenchIntl();
  if (layout !== SHIPPED_LAYOUT) return null;
  return (
    <output className={NOTE} data-testid="shipped-note">
      <TriangleAlert aria-hidden="true" className="mt-4xs size-[0.875rem] shrink-0" />
      <span className="min-w-0">{intl.formatMessage(COPY.shipped)}</span>
    </output>
  );
}
