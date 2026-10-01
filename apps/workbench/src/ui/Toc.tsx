import { useEffect, useMemo, useState } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../i18n/Localisation';
import { cn } from '../lib/cn';
import { SECTION_TITLES } from '../shell/views';
import type { Heading } from '../../plugin/markdown.ts';

/**
 * The one sentence this list writes itself, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/shell.ts`.
 *
 * What it is CALLED is not here. The nav's accessible name is
 * `SECTION_TITLES.contents`, the same descriptor the rail button and the panel's
 * own heading use, because all three name one thing: a second id reading
 * `On this page` would be one string translated three times and three chances for
 * the panel to disagree with the nav inside it.
 *
 * The headings themselves are a document's, so they are not here either and never
 * will be — this is the contents of a page that publishes, and ADR 0050 §2 leaves
 * that body in the language it was written in.
 */
const COPY = defineMessages({
  none: {
    id: 'shell.toc.none',
    defaultMessage: 'No headings on this page.',
    description:
      'Stands in the contents panel for a document with fewer than two headings. The section exists because the route declared it, so it says what it has rather than leaving an empty box behind a title.',
  },
});

interface Props {
  headings: Heading[];
}

/**
 * The in-page contents, following the heading currently on screen.
 *
 * It has no chrome of its own: the page hands it to the `contents` slot, and the
 * tool panel it lands in carries the title. Nothing here shuts it, because nothing
 * in the panel does — the rail is the switch.
 *
 * Only h2 and h3. An h4 in these documents is a detail inside an argument, and
 * listing them turns a map into a transcript. The observer's top margin keeps a
 * heading current while its section is being read rather than only while the
 * heading itself is visible.
 */
export function Toc({ headings }: Props) {
  const intl = useWorkbenchIntl();
  const shown = useMemo(() => headings.filter((h) => h.depth === 2 || h.depth === 3), [headings]);
  const [active, setActive] = useState<string | null>(shown[0]?.id ?? null);

  useEffect(() => {
    if (shown.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: '-80px 0px -70% 0px' },
    );
    for (const heading of shown) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [shown]);

  /*
   * A map of one heading is not a map. The section still exists, because the
   * route declared it, so it says what it has rather than leaving an empty box
   * behind a title.
   */
  if (shown.length < 2) {
    return <p className="p-s text-s text-on-canvas-muted">{intl.formatMessage(COPY.none)}</p>;
  }

  return (
    <nav aria-label={intl.formatMessage(SECTION_TITLES.contents)} className="p-s">
      <ul className="space-y-3xs text-m">
        {shown.map((heading) => (
          <li key={heading.id} className={heading.depth === 3 ? 'pl-s' : undefined}>
            <a
              href={`#${heading.id}`}
              aria-current={heading.id === active ? 'true' : undefined}
              className={cn(
                'block rounded-md py-4xs leading-snug',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                heading.id === active
                  ? 'font-medium text-on-canvas'
                  : 'text-on-canvas-muted hover:text-on-canvas',
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
