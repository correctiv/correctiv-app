/**
 * The German catalogue, merged from one file per id namespace.
 *
 * The same shape `packages/catalogue/src/de/` has, and deliberately not the same
 * package: this site has a second audience and a vocabulary of its own, and the app
 * may never depend on the workbench
 * ([ADR 0050](../../../../../../adr/0050-the-workbench-gets-a-second-audience.md) §3,
 * [ADR 0040](../../../../../../adr/0040-the-app-does-not-depend-on-the-workbench.md)).
 * What is shared is the shape, not the strings.
 */
import { frame } from './frame';
import { home } from './home';
import { nav } from './nav';
import { settings } from './settings';
import { shell } from './shell';

export const de: Record<string, string> = {
  ...frame,
  ...home,
  ...nav,
  ...settings,
  ...shell,
};
