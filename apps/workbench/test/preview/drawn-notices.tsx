import { act } from 'react';
import { createRoot } from 'react-dom/client';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE, type Language } from '../../src/i18n/language';
import { NotificationCenter } from '../../src/preview/home/NotificationCenter';
import { noticesOf, type NoticeState } from '../../src/preview/home/notices';
import { TooltipProvider } from '../../src/ui/kit/tooltip';

/**
 * What the bell lists for a state, as the text a person would read: the bell is drawn, pressed
 * open, and its list read out of the portal. Empty while there is nothing to list.
 */
export function drawnNotices(state: NoticeState, language: Language = SOURCE_LANGUAGE): string {
  document.body.innerHTML = '';
  const container = document.body.appendChild(document.createElement('div'));
  const root = createRoot(container);
  act(() => {
    root.render(
      <Localisation language={language}>
        <TooltipProvider>
          <NotificationCenter notices={noticesOf(state)} />
        </TooltipProvider>
      </Localisation>,
    );
  });
  const bell = container.querySelector<HTMLElement>('[data-testid="notifications"]');
  act(() => bell?.click());
  const text = document.body.querySelector('[data-testid="notifications-list"]')?.textContent ?? '';
  // An open popover left mounted slows every later render in the file to seconds, so it is
  // closed by the control that opened it before the tree goes.
  act(() => bell?.click());
  act(() => root.unmount());
  container.remove();
  return text;
}
