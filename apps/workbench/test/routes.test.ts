import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectDocs, ROOT } from '../plugin/collect.ts';
import { DOCUMENTS } from '../plugin/registry.ts';
import { MOVED } from '../src/router.tsx';
import { PAGE_ROUTES } from '../src/shell/views.ts';

const { module } = collectDocs();

/**
 * What is left here once the shell has a declaration table.
 *
 * "A page must not shadow a document" and "every route resolves" moved to
 * `test/shell.test.ts`, where they are asked of `resolveView` rather than of a
 * list typed twice. These two are still about strings and nothing else.
 */
describe('the site’s routes', () => {
  it('gives every registered document a distinct route', () => {
    const routes = module.docs.map((d) => d.route);
    expect(routes.length).toBe(new Set(routes).size);
  });

  it('starts every route with a slash and ends none with one', () => {
    // `currentPath()` normalises a trailing slash away before matching, so a route
    // written with one here would never be found and the page would 404.
    const malformed = [...DOCUMENTS.map((d) => d.route), ...PAGE_ROUTES].filter(
      (route) => !route.startsWith('/') || (route.length > 1 && route.endsWith('/')),
    );
    expect(malformed).toEqual([]);
  });

  /**
   * A published address that moved still has to land somewhere.
   *
   * Three ways this breaks quietly, so all three are asked. A target that is not a
   * route any more is a 404 with a redirect in front of it. A key that IS a route
   * is worse: `/preview` in this table would forward the live page to itself for
   * ever. And a stub file named after a target — `public/preview.html`, which is
   * where `/preview.html` used to be answered — is served by GitHub Pages and by
   * `screens/tools/serve-clean.mjs` for the clean URL `/preview`, which is the same
   * loop arriving from the other side.
   */
  it('sends every moved address to a route it still publishes, and shadows none', () => {
    const published = new Set([...PAGE_ROUTES, ...DOCUMENTS.map((d) => d.route)]);

    expect(Object.entries(MOVED).filter(([, to]) => !published.has(to))).toEqual([]);
    expect(Object.keys(MOVED).filter((from) => published.has(from))).toEqual([]);
    expect(MOVED['/workbench']).toBe('/preview');
    expect(MOVED['/preview.html']).toBe('/preview');
  });

  it('keeps no file in public/ that a moved target would resolve to first', () => {
    const files = readdirSync(join(ROOT, 'apps/workbench/public'));
    const shadowing = Object.values(MOVED).filter((to) => files.includes(`${to.slice(1)}.html`));
    expect(shadowing).toEqual([]);
  });

  /**
   * The app is reachable from the component route by frame, and must not be by
   * address.
   *
   * This is the second shape of one bug. The page used to link to `/app/gallery`,
   * and the link needed `data-external` or this site's own router took it and
   * landed on "No page at /app/gallery" without a request ever reaching the app.
   * That got the attribute, and the link then failed for a second reason nothing
   * in the build could see: in a development bundle the app matches routes
   * without stripping its base path, so `/app/gallery` is a page it does not have
   * and it renders its own 404 (ADR 0025, measured).
   *
   * So the drawing happens in a frame, which reaches the route through the app's
   * own router, and no anchor points into the app's directory. The third
   * assertion is the half ADR 0028 adds: the overview has no frame at all any
   * more, because a card of three hundred pixels cannot hold a device.
   */
  it('draws the app in a frame on the detail route, and links to it by no address', () => {
    const pages = join(ROOT, 'apps/workbench/src/pages');
    const detail = readFileSync(join(pages, 'ComponentDetail.tsx'), 'utf8');
    const overview = readFileSync(join(pages, 'Components.tsx'), 'utf8');

    const anchors = (detail.match(/<a\b[^>]*>/g) ?? []).filter((tag) => tag.includes('/app'));
    expect(anchors).toEqual([]);

    expect(detail).toContain('`/gallery?c=${id}&bare=1`');
    expect(detail).toContain('<AppFrame');
    expect(overview).not.toContain('AppFrame');
  });

  /**
   * The Figma frame is third-party, and a browser that partitions third-party
   * state hands it a jar with no Figma session in it. The frame then draws the
   * sign-in screen to a reader who is signed in one tab over, and the Storage
   * Access API is the way out of that — but a sandboxed frame may not even call it
   * without this token. Reported from a reader's console on 2026-09-11.
   *
   * Asserted because the attribute reads like a list of permissions to trim, and
   * this one grants nothing on its own: it lets the frame ask, and the reader
   * answers.
   */
  it('lets the Figma frame ask for its own cookies', () => {
    const design = readFileSync(join(ROOT, 'apps/workbench/src/pages/Design.tsx'), 'utf8');
    const attribute = design.match(/sandbox="([^"]+)"/)?.[1];
    expect(attribute).toBeDefined();
    expect(attribute?.split(' ')).toContain('allow-storage-access-by-user-activation');
  });
});
