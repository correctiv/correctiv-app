import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE, type Language } from '../../src/i18n/language';
import { NoticeList } from '../../src/preview/home/NotificationCenter';
import { noticesOf, type NoticeState } from '../../src/preview/home/notices';
import { TooltipProvider } from '../../src/ui/kit/tooltip';

/**
 * What the bell lists for a state, as the text a person would read: the list the bell opens, drawn
 * without the popover, which jsdom pays for with every test after it. Empty while there is nothing to list.
 */
export function drawnNotices(state: NoticeState, language: Language = SOURCE_LANGUAGE): string {
  document.body.innerHTML = '';
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  act(() => {
    root.render(
      <Localisation language={language}>
        <TooltipProvider>
          <NoticeList notices={noticesOf(state)} />
        </TooltipProvider>
      </Localisation>,
    );
  });
  const text = container.querySelector('[data-testid="notifications-list"]')?.textContent ?? '';
  act(() => root.unmount());
  container.remove();
  return text;
}
