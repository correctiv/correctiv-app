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
import { components } from './components';
import { devices } from './devices';
import { diagrams } from './diagrams';
import { drawing } from './drawing';
import { fixtures } from './fixtures';
import { frame } from './frame';
import { handbook } from './handbook';
import { home } from './home';
import { nav } from './nav';
import { preview } from './preview';
import { reference } from './reference';
import { settings } from './settings';
import { shell } from './shell';
import { strings } from './strings';
import { tools } from './tools';

export const de: Record<string, string> = {
  ...components,
  ...devices,
  ...diagrams,
  ...drawing,
  ...fixtures,
  ...frame,
  ...handbook,
  ...home,
  ...nav,
  ...preview,
  ...reference,
  ...settings,
  ...shell,
  ...strings,
  ...tools,
};
