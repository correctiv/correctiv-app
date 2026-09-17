import { useCallback, useEffect, useState } from 'react';

/**
 * The site is served from a directory, not always from a domain root.
 *
 * Locally that directory is `/`; on Pages it is `/correctiv-app/`. Vite hands the
 * value over as `BASE_URL`, and every route in this app is written without it, so
 * only `currentPath` and `href` below know about the prefix. One more place knows,
 * and knows deliberately: `preview/frame/handle.ts` adds `/app` to it, because
 * where the app answers is not a route of this site. Anything that is a route goes
 * through `href`.
 */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** A site route, e.g. `/decisions/0022`, from wherever the browser currently is. */
export function currentPath(): string {
  const path = window.location.pathname;
  const stripped = BASE && path.startsWith(BASE) ? path.slice(BASE.length) : path;
  return (stripped || '/').replace(/\/$/, '') || '/';
}

/** The address to put in an `href`, which is the route plus the prefix. */
export function href(route: string): string {
  return `${BASE}${route === '/' ? '/' : route}`;
}

/**
 * Every address this site has published and then moved, and where it goes now.
 *
 * A route is a promise to whoever pasted it into a chat, a README or a browser
 * bookmark, and this site has two such promises outstanding. `/preview.html` was
 * the device frame while it was a page of the app's own export
 * ([ADR 0014](../../../adr/0014-the-preview-shell-as-a-package.md)); `/workbench` was
 * it while this site was called the handbook
 * ([ADR 0024](../../../adr/0024-the-handbook-owns-the-root.md)). Both now name the
 * same view, `/preview`, and both are answered here rather than dying.
 *
 * **`/preview.html` used to be a file in `public/` and cannot be one any more.**
 * GitHub Pages and `screens/tools/serve-clean.mjs` both resolve `/preview` by
 * trying `preview.html` before falling through to `404.html`, so a stub of that
 * name would be served for the live route and would redirect it to itself — a
 * loop, on the one address this whole change is about. With no such file, both
 * hosts fall through to `404.html`, which is a copy of `index.html`, and this
 * table answers. That is how `/decisions/0022` has always resolved.
 */
export const MOVED: Readonly<Record<string, string>> = {
  '/workbench': '/preview',
  '/preview.html': '/preview',
};

/**
 * Where a moved address goes, or `undefined` for one that never moved.
 *
 * Exported for `test/routes.test.ts`, which is also what holds every target to a
 * route the site actually publishes: a redirect to an address that has since been
 * renamed again is a 404 with an extra step in front of it.
 */
export function movedTo(route: string): string | undefined {
  return MOVED[route];
}

/**
 * Answers a moved address before React has decided anything, once, on load.
 *
 * `replaceState` rather than a render-time redirect: the reader never sees "No
 * page at /workbench" flash past, and the back button goes where they came from
 * rather than to the address that forwarded them.
 *
 * The query and the hash are carried across untouched, and that is the whole
 * point of keeping the promise. `/workbench#/artikel?d=iphone-15-pro&t=dark` is
 * what a frame link looks like, and a redirect that dropped the fragment would
 * resolve to the right page and the wrong everything else.
 */
export function redirectMoved(): void {
  const target = movedTo(currentPath());
  if (target === undefined) return;
  const { search, hash } = window.location;
  window.history.replaceState(null, '', href(target) + search + hash);
}

/**
 * `replace` for a redirect nobody asked for by name.
 *
 * `/components?c=ui/Card` is the address the app's gallery links back with, and
 * this site answers it by sending the reader to that component's own page. Pushed,
 * the back button would land them on the overview, which would immediately
 * redirect them forward again: a trap, from a link that was only ever a
 * translation between two vocabularies.
 */
export function navigate(route: string, options?: { replace?: boolean }): void {
  const state = options?.replace ? window.history.replaceState : window.history.pushState;
  state.call(window.history, null, '', href(route));
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * The current route, and a navigate that does not reload the page.
 *
 * Deliberately small. A router library would bring its own link component, its
 * own data conventions and a second idea of what a route is, and this site does
 * not need one.
 */
export function useRoute(): [string, (route: string) => void] {
  const [route, setRoute] = useState(currentPath);

  useEffect(() => {
    const onPop = () => setRoute(currentPath());
    /*
     * Read the address again on the way in, because something may have moved it
     * before this listener existed. A page's effects run before its parent's, and
     * `/components` redirects `?c=ui/Card` to that component's own page from one
     * of them: the `popstate` it dispatched landed with nobody listening, so the
     * address said one route and the shell went on drawing another. Measured on
     * 2026-09-11 — the URL was `/components/ui/SectionCard` and the page was the
     * overview, with no error anywhere.
     */
    onPop();
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return [route, navigate];
}

/**
 * Turns a click on any in-site link into a navigation, once, at the root.
 *
 * The documents are rendered HTML strings, so their links are plain `<a>`
 * elements that no component wraps. Delegating from the root is what lets a link
 * inside `ARCHITECTURE.md` behave like every other link on the site without the
 * Markdown pipeline having to know React exists.
 *
 * Modified clicks, new tabs and anything the renderer marked external are left
 * to the browser, which is what a reader expects of them.
 */
export function useLinkInterception(): void {
  const onClick = useCallback((event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = (event.target as Element | null)?.closest?.('a');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (anchor.target === '_blank' || anchor.dataset.external === 'true') return;

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;

    // An anchor on the page we are already on is the browser's job, not ours.
    if (url.pathname === window.location.pathname && url.hash) return;

    const path = url.pathname;
    if (BASE && !path.startsWith(BASE)) return;

    event.preventDefault();
    window.history.pushState(null, '', url.pathname + url.hash);
    window.dispatchEvent(new PopStateEvent('popstate'));
    if (url.hash) {
      // The target does not exist until the new route has rendered.
      requestAnimationFrame(() => {
        document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
      });
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [onClick]);
}
