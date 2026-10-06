/**
 * The bar the shell and "Mehr" read: the one this process started with, because the
 * system's tab bar is decided once per start
 * ([ADR 0081](../../../../../adr/0081-the-system-tab-bar-returns-and-is-decided-at-start.md)).
 * `shellTabs.web.ts` is the live one, which the drawn bar needs.
 */
export { useStartTabs as useShellTabs } from './tabWords';
