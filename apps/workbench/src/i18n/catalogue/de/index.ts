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
import { articlePath } from './articlePath';
import { components } from './components';
import { conditions } from './conditions';
import { coreAndHost } from './coreAndHost';
import { decisions } from './decisions';
import { decisionsChain } from './decisionsChain';
import { design } from './design';
import { devices } from './devices';
import { diagrams } from './diagrams';
import { documentFrame } from './document';
import { drawing } from './drawing';
import { edition } from './edition';
import { fixtures } from './fixtures';
import { frame } from './frame';
import { handbook } from './handbook';
import { home } from './home';
import { insideCore } from './insideCore';
import { landing } from './landing';
import { measured } from './measured';
import { nav } from './nav';
import { preview } from './preview';
import { reference } from './reference';
import { services } from './services';
import { settings } from './settings';
import { shell } from './shell';
import { signIn } from './signIn';
import { sources } from './sources';
import { strings } from './strings';
import { tools } from './tools';

export const de: Record<string, string> = {
  ...articlePath,
  ...components,
  ...conditions,
  ...coreAndHost,
  ...decisions,
  ...decisionsChain,
  ...design,
  ...devices,
  ...diagrams,
  ...documentFrame,
  ...drawing,
  ...edition,
  ...fixtures,
  ...frame,
  ...handbook,
  ...home,
  ...insideCore,
  ...landing,
  ...measured,
  ...nav,
  ...preview,
  ...reference,
  ...services,
  ...settings,
  ...shell,
  ...signIn,
  ...sources,
  ...strings,
  ...tools,
};
