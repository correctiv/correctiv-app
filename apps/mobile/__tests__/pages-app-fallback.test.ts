import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  FALLBACK_FILE,
  applyFallback,
  fallbackScript,
  withFallbackTag,
} from '../scripts/pages-app-fallback.mjs';

/**
 * `/app/s/<id>` on GitHub Pages (ADR 0075 §7): the export holds `s/[id].html` and nothing
 * per id, so Pages answers with the site's `404.html`, the workbench's. This pins the
 * script that hands such an address to the app, run against a page shaped like the
 * workbench's, and the address it must leave alone.
 */
const PAGE =
  '<!doctype html><head><meta charset="utf-8">\n    <script type="module" src="/assets/index.js"></script></head>';

/** Runs the script for one address and reports what it fetched. */
function run(base: string, pathname: string): string[] {
  const fetched: string[] = [];
  const window = { location: { pathname } };
  const fetchStub = (url: string) => {
    fetched.push(url);
    return Promise.resolve({ ok: false });
  };
  new Function('window', 'fetch', 'document', fallbackScript(base))(window, fetchStub, {});
  return fetched;
}

describe('pages-app-fallback', () => {
  it('fetches the app entry for a screen address, under the base', () => {
    expect(run('/correctiv-app', '/correctiv-app/app/s/klima')).toEqual([
      '/correctiv-app/app/index.html',
    ]);
    expect(run('', '/app/s/klima/')).toEqual(['/app/index.html']);
  });

  it('writes the app page without its inline scripts, which the workbench policy refuses', async () => {
    const entry =
      '<head><script type="module">globalThis.__EXPO_ROUTER_HYDRATE__=true;</script>' +
      '<script src="/app/_expo/static/js/web/index.js" defer></script></head>';
    const written: string[] = [];
    const document = {
      open: () => undefined,
      write: (html: string) => written.push(html),
      close: () => undefined,
    };
    const fetchStub = () => Promise.resolve({ ok: true, text: () => Promise.resolve(entry) });
    const window = { location: { pathname: '/app/s/klima' } };
    new Function('window', 'fetch', 'document', fallbackScript(''))(window, fetchStub, document);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(written).toEqual([
      '<head><script src="/app/_expo/static/js/web/index.js" defer></script></head>',
    ]);
  });

  it('leaves every other address to the workbench', () => {
    expect(run('', '/handbook')).toEqual([]);
    expect(run('', '/app/s/')).toEqual([]);
    expect(run('', '/app/s/Not_An_Id')).toEqual([]);
    expect(run('', '/app/s/a/b')).toEqual([]);
  });

  it('puts the tag in front of the module script, once', () => {
    const once = withFallbackTag(PAGE, '/x/');
    expect(once.indexOf(FALLBACK_FILE)).toBeLessThan(once.indexOf('type="module"'));
    expect(withFallbackTag(once, '/x/')).toBe(once);
  });

  it('refuses a page it does not recognise', () => {
    expect(() => withFallbackTag('<html></html>', '')).toThrow(/module script/);
  });

  it('writes the script and links it from 404.html', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pages-fallback-'));
    writeFileSync(join(dir, '404.html'), PAGE);
    applyFallback(dir, '');
    expect(readFileSync(join(dir, '404.html'), 'utf8')).toContain(`src="/${FALLBACK_FILE}"`);
    expect(readFileSync(join(dir, FALLBACK_FILE), 'utf8')).toContain('/app/s/');
  });
});
