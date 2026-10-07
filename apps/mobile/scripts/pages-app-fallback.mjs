#!/usr/bin/env node
/**
 * Makes `/app/s/<id>` load on GitHub Pages (ADR 0075 §7).
 *
 * A screen the newsroom makes has no page in the export: its id arrives in a document
 * published after the build, so the export holds one `s/[id].html` and nothing per id.
 * Pages answers an address it has no file for with the SITE's `404.html`, and that is the
 * workbench's shell, not the app's: the `404.html` `build:web` writes into the app's own
 * `dist/` ends up at `/app/404.html`, which Pages never serves. So `/app/s/klima` used to
 * load the workbench's "no such page".
 *
 * What this adds to the assembled site is a classic script, `app-route-fallback.js`, and
 * the tag that loads it in front of the workbench's bundle in `404.html`. On an address
 * under `/app/s/` whose last segment could be a screen id, it fetches the app's entry
 * page and writes it over the document; the address stays, the app starts, and its own
 * router resolves `/s/<id>` (a screen the document does not carry is its `+not-found`).
 * Every other address is left to the workbench.
 *
 * A file and not an inline script, because the workbench's policy is `script-src 'self'`
 * (`apps/workbench/plugin/policy.ts`), and that policy stays on the document the app is
 * written into: it admits the app's bundle and its own origin, which is all it asks for.
 *
 * Usage: node scripts/pages-app-fallback.mjs <site dir> [<base path>]
 *
 * <base path> is `steps.pages.outputs.base_path` in pages.yml: `/correctiv-app` for a
 * project site, empty on a custom domain.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const FALLBACK_FILE = 'app-route-fallback.js';

/**
 * The same shape `customScreenIdFault` in the core admits, short of the length bound and
 * the declared ids: those are the app's to refuse, and a page that says so is better than
 * the workbench's.
 */
const ID_SOURCE = '[a-z0-9]+(?:-[a-z0-9]+)*';

/**
 * `/correctiv-app/` and `/` the same way, whatever way the base was spelled.
 *
 * @param {string | undefined} base
 */
function normalBase(base) {
  const trimmed = (base ?? '').replace(/^\/+|\/+$/g, '');
  return trimmed === '' ? '' : `/${trimmed}`;
}

/**
 * The text of the script the browser runs, for one base path.
 *
 * @param {string | undefined} base
 */
export function fallbackScript(base) {
  const prefix = `${normalBase(base)}/app/s/`;
  return `(function () {
  var prefix = ${JSON.stringify(prefix)};
  var path = window.location.pathname;
  if (path.indexOf(prefix) !== 0) return;
  var id = path.slice(prefix.length).replace(/\\/$/, '');
  if (!/^${ID_SOURCE}$/.test(id)) return;
  fetch(${JSON.stringify(`${normalBase(base)}/app/index.html`)})
    .then(function (response) {
      return response.ok ? response.text() : Promise.reject(new Error(String(response.status)));
    })
    .then(function (html) {
      // The page's own inline scripts are refused by the workbench's policy (script-src 'self')
      // and logged as errors. The one the export writes only says "hydrate", and the entry
      // page's markup is not this screen's, so there is nothing to hydrate and it is left out.
      html = html.replace(/<script\\b(?![^>]*\\bsrc=)[^>]*>[^<]*<\\/script>/g, '');
      document.open();
      document.write(html);
      document.close();
    })
    .catch(function () {});
})();
`;
}

/**
 * `404.html` with the script's tag in front of everything else that runs.
 *
 * Placed after the charset and the policy meta, so the policy governs the tag, and before
 * the module script so the workbench has not started when the app's page replaces it.
 * Throws when the page has no module script to go in front of, because a page this does
 * not recognise is one whose fallback would silently not run.
 *
 * @param {string} html
 * @param {string | undefined} base
 */
export function withFallbackTag(html, base) {
  const tag = `<script src="${normalBase(base)}/${FALLBACK_FILE}"></script>`;
  if (html.includes(tag)) return html;
  const at = html.search(/<script\b[^>]*type="module"/);
  if (at === -1) {
    throw new Error('pages-app-fallback: 404.html has no module script to put the fallback before');
  }
  return `${html.slice(0, at)}${tag}\n    ${html.slice(at)}`;
}

/**
 * Writes the script into the site and its tag into `404.html`.
 *
 * @param {string} siteDir
 * @param {string | undefined} base
 */
export function applyFallback(siteDir, base) {
  const page = join(siteDir, '404.html');
  writeFileSync(join(siteDir, FALLBACK_FILE), fallbackScript(base));
  writeFileSync(page, withFallbackTag(readFileSync(page, 'utf8'), base));
}

// Under jest `import.meta` carries no url; the guard keeps the import free of side effects.
const self = typeof import.meta?.url === 'string' ? import.meta.url : null;
if (self && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(self)) {
  const [siteDir, base] = process.argv.slice(2);
  if (!siteDir) {
    console.error('usage: node scripts/pages-app-fallback.mjs <site dir> [<base path>]');
    process.exit(2);
  }
  applyFallback(siteDir, base);
  console.log(`${siteDir}: ${FALLBACK_FILE} written and linked from 404.html`);
}
