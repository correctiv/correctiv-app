/**
 * @vitest-environment jsdom
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Localisation } from '../../src/i18n/Localisation';
import { SOURCE_LANGUAGE } from '../../src/i18n/language';
import { NoticeList } from '../../src/preview/home/NotificationCenter';
import { noticesOf } from '../../src/preview/home/notices';
import { discardScreens, selectLayout, setScreen } from '../../src/preview/home/store';
import { forgetMigration } from '../../src/preview/home/write';
import { TooltipProvider } from '../../src/ui/kit/tooltip';

/**
 * What a deleted screen says in the notifications' list. Its own file, see
 * `custom-screens-bar.test.tsx`.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function draw(node: ReactNode): void {
  container = document.body.appendChild(document.createElement('div'));
  act(() => {
    root = createRoot(container);
    root.render(
      <Localisation language={SOURCE_LANGUAGE}>
        <TooltipProvider>{node}</TooltipProvider>
      </Localisation>,
    );
  });
}

beforeEach(() => {
  window.localStorage.clear();
  forgetMigration();
  selectLayout('demo');
  discardScreens();
  setScreen('home');
});

afterEach(() => {
  if (root) act(() => root.unmount());
  container?.remove();
  document.body.innerHTML = '';
});

const byId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`) as HTMLElement;

describe('the deletion notice', () => {
  it('says what a deletion is in the notifications: a draft, with a way back and a way to submit it', () => {
    let restored = '';
    const deletedNotices = noticesOf({
      layout: 'demo',
      deleted: [
        {
          id: 'entdecken',
          title: 'Entdecken',
          href: 'https://github.com/x/y/issues/new?title=z',
          onRestore: () => (restored = 'entdecken'),
        },
      ],
    });
    // The list the bell opens, drawn on its own: a popover left open costs every later test.
    draw(<NoticeList notices={deletedNotices} />);
    expect(byId('notifications-list').textContent).toContain(
      'Deleted “Entdecken” in this draft only',
    );
    expect(byId('submit-deletion-entdecken').getAttribute('href')).toContain('issues/new');
    expect(byId('restore-screen-entdecken').getAttribute('aria-label')).toBe('Restore Entdecken');
    act(() => byId('restore-screen-entdecken').click());
    expect(restored).toBe('entdecken');
  });
});
