import { useEffect, useState } from 'react';

import type { Heading } from '../../plugin/markdown.ts';

/**
 * The open view's sections, read off the page rather than declared twice.
 *
 * A document arrives with its headings extracted at build time. The pages built as
 * components — the reference, the decisions board, the component catalogue and the
 * sources board — have no such list, and they are the longest things on the site. A
 * second hand-kept list of their sections would be a list that drifts, so the shell
 * reads the headings the page actually rendered.
 *
 * Only headings with an id, because the list navigates by fragment and an entry
 * that scrolls nowhere is worse than no entry. The observer is for the reference
 * page's filter, which adds and removes modules as it is typed in.
 */
export function useSections(route: string, enabled: boolean): Heading[] {
  const [sections, setSections] = useState<Heading[]>([]);

  useEffect(() => {
    if (!enabled) {
      setSections([]);
      return;
    }
    const main = document.getElementById('content');
    if (!main) return;

    const read = () => {
      const found = [...main.querySelectorAll<HTMLElement>('h2[id], h3[id]')].map((el) => ({
        id: el.id,
        depth: el.tagName === 'H2' ? 2 : 3,
        text: el.textContent?.trim() ?? '',
      }));
      setSections((previous) => (same(previous, found) ? previous : found));
    };

    read();
    const observer = new MutationObserver(read);
    observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled, route]);

  return sections;
}

function same(a: Heading[], b: Heading[]): boolean {
  return a.length === b.length && a.every((h, i) => h.id === b[i].id && h.text === b[i].text);
}
