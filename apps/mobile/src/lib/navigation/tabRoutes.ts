import { MORE_TAB, type TabBar } from '@correctiv/app-core/lib/navigation';

import { screenHref } from './screenHref';

/**
 * Where a tab leads. Every screen is `/s/<id>` on the web (ADR 0079), so a tab is an address and
 * nothing the navigator has to declare: there is no route per tab, and a screen that is
 * gone is an address that leads nowhere.
 */
export function tabHref(tab: string): string {
  return tab === MORE_TAB ? '/mehr' : screenHref(tab);
}

/**
 * The tab an address belongs to, or null when it belongs to none of the bar's.
 *
 * A screen behind "Mehr" highlights "Mehr", which is the tab it was reached from; where the
 * bar has no "Mehr" there is nothing to highlight, so a screen the navigation does not list
 * and nothing hides is simply on no tab.
 */
export function activeTabOf(pathname: string, bar: TabBar): string | null {
  if (pathname === '/mehr') return bar.tabs.includes(MORE_TAB) ? MORE_TAB : null;
  const id = /^\/s\/([^/?#]+)/.exec(pathname)?.[1];
  if (id === undefined) return null;
  if (bar.tabs.includes(id)) return id;
  return bar.tabs.includes(MORE_TAB) ? MORE_TAB : null;
}
