/**
 * An address from outside, rewritten before the router sees it. On iOS and Android a screen
 * opened by id is `/screen/<id>` (`lib/navigation/screenHref.ts`), because the system's tab
 * bar leaves nothing under `(tabs)` to navigate to by name, and the addresses a link or a
 * shared URL carries are the web's `/s/<id>`
 * ([ADR 0081](../../../../adr/0081-the-system-tab-bar-returns-and-is-decided-at-start.md)).
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return path.replace(/^(\/?)s\/([^/?#]+)/, '$1screen/$2');
}
