import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Plugin } from 'vite';

import { collectDocs, ROOT } from './collect.ts';
import { homeLayoutEndpoint } from './home-layout.ts';
import { stringsEndpoint } from './strings.ts';

const MODULE_ID = 'virtual:docs';
const API_ID = 'virtual:api';
const STRINGS_ID = 'virtual:strings';
const API_FILE = join(ROOT, 'apps/workbench/content/api.generated.json');
const STRINGS_FILE = join(ROOT, 'apps/workbench/content/strings.generated.json');

/**
 * Serves the repository's own Markdown to the workbench, parsed, at build time.
 *
 * The workbench holds no copy of any document. That is the whole point of reading
 * them from here: a second copy of `ARCHITECTURE.md` would be the one on the
 * website, and it would be the one nobody edits. The cost is that editing a
 * document outside this package has to reload the page, which `handleHotUpdate`
 * below arranges.
 *
 * Markdown is parsed here and not in the browser, so `marked` is a build-time
 * dependency and the bundle ships rendered HTML strings with no parser in them.
 */
export function docsPlugin(): Plugin {
  let watched: string[] = [];
  // Taken from the resolved config rather than from `process.env.WORKBENCH_BASE`,
  // which is where `vite.config.ts` reads it. One source, so the prefix in a
  // document's links cannot disagree with the prefix Vite puts on everything else.
  let base = '/';

  return {
    name: 'workbench-docs',

    configResolved(config) {
      base = config.base;
    },

    resolveId(id) {
      if (id === MODULE_ID) return `\0${MODULE_ID}`;
      if (id === API_ID) return `\0${API_ID}`;
      if (id === STRINGS_ID) return `\0${STRINGS_ID}`;
      return null;
    },

    load(id) {
      if (id === `\0${API_ID}`) {
        // Extracted by `npm run api`, which `npm run build` runs first. Not
        // committed: it is derived, it is large, and it would conflict on every
        // rename in the core or in the app's components. A clear failure beats an
        // empty reference page that looks like nothing is exported.
        if (!existsSync(API_FILE)) {
          throw new Error(
            'apps/workbench/content/api.generated.json is missing. Run `npm run api -w @correctiv/workbench`.',
          );
        }
        this.addWatchFile(API_FILE);
        return `export default ${readFileSync(API_FILE, 'utf8')};`;
      }
      if (id === `\0${STRINGS_ID}`) {
        // Joined by `npm run strings`, which `npm run build` runs. Same treatment as
        // the reference above and for the same reason: derived, large, and a clear
        // failure beats a table that looks like the app has no strings.
        if (!existsSync(STRINGS_FILE)) {
          throw new Error(
            'apps/workbench/content/strings.generated.json is missing. Run `npm run strings -w @correctiv/workbench`.',
          );
        }
        this.addWatchFile(STRINGS_FILE);
        return `export default ${readFileSync(STRINGS_FILE, 'utf8')};`;
      }
      if (id !== `\0${MODULE_ID}`) return null;
      const { module, files } = collectDocs(base);
      watched = files;
      // Declared rather than inferred: these files are outside this package and
      // Vite has no other way to know the virtual module depends on them.
      for (const file of files) this.addWatchFile(file);
      return `export default ${JSON.stringify(module)};`;
    },

    configureServer(server) {
      // The documents live above this package's root, and Vite's dev server
      // refuses to watch outside it unless told. Without this an edit to
      // ARCHITECTURE.md changes nothing until the server is restarted, which
      // looks like the plugin not working.
      server.watcher.add(watched.length > 0 ? watched : [join(ROOT, 'adr'), join(ROOT, '*.md')]);

      // The two things this site writes back, and the reason they are here rather
      // than in a plugin of their own: `configureServer` is the hook that does not
      // run in a build, so a dev-only endpoint costs nothing in the published
      // bundle, and the repository has one place to read them in.
      // `plugin/home-layout.ts` is what they refuse and why; `plugin/strings.ts` is
      // the German of the strings tool (ADR 0056 §8), on the same terms.
      server.middlewares.use(homeLayoutEndpoint(server));
      server.middlewares.use(stringsEndpoint());
    },

    handleHotUpdate({ file, server }) {
      if (!watched.includes(file)) return;
      // A document is one big string inside one virtual module, so there is
      // nothing finer to invalidate than the module, and nothing to hot-swap.
      const mod = server.moduleGraph.getModuleById(`\0${MODULE_ID}`);
      if (mod) server.moduleGraph.invalidateModule(mod);
      server.hot.send({ type: 'full-reload' });
      return [];
    },
  };
}
