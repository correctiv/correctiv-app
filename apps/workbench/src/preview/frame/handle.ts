import type { ThemeSetting } from '../state';
import type { Scheme } from './tokens';

/**
 * The shell's half of the contract with the app.
 *
 * Structural on purpose: importing the real types would drag `apps/mobile`'s
 * React Native TypeScript project into this package, and this package is meant
 * to know nothing about React Native. What it needs is four verbs, and the
 * app's own doc comment (`apps/mobile/src/lib/store/core.ts`, `DevHandle`) is
 * the other side of this declaration.
 */
export interface DevHandle {
  store: {
    getState(): { settings?: { theme?: ThemeSetting } } & Record<string, unknown>;
    dispatch(action: unknown): unknown;
    subscribe(listener: () => void): () => void;
  };
  actions: {
    settings: { setTheme(theme: ThemeSetting): unknown };
  } & Record<string, unknown>;
  resetStore: () => unknown;
  /**
   * The app's imperative router. Only `navigate` is declared, because it is the
   * only one this package calls; `driveRoute` below says why the address cannot
   * do the job on its own in a development build.
   */
  router: { navigate(route: string): void };
}

/**
 * Where the app answers, which is no longer this page's own directory.
 *
 * The shell used to sit beside the export inside `apps/mobile/public/`, so its
 * own directory was the app's ([ADR 0014](../../../../../adr/0014-the-preview-shell-as-a-package.md)).
 * The workbench owns the site root now and the app is published beneath it, so the
 * path is the site's base plus `/app`: `/app` locally, `/correctiv-app/app` on
 * Pages, where `app.config.js` has given the export a matching `baseUrl`
 * ([ADR 0024](../../../../../adr/0024-the-handbook-owns-the-root.md)).
 *
 * Same-origin is unchanged and is still the thing everything here depends on. On
 * Pages both halves are one artifact; in development the workbench's Vite server
 * proxies `/app` to the app's dev server, so the browser sees one origin either
 * way.
 */
export const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/app`;

/**
 * The handle the app leaves on its own global in a dev build, or `null`.
 *
 * `null` is the normal state of the published demo, not a fault: `expo export`
 * sets `__DEV__` false, so the static export carries no handle. Every caller has
 * to render that difference rather than appear to work: `NeedsDev` in
 * `ui/Panels.tsx` says it beside the control it disables, and `ui/Readout.tsx`
 * says it in the status line for a reader who never opens a panel.
 */
export function handleOf(win: Window | null): DevHandle | null {
  try {
    const handle = (win as (Window & { __correctiv?: DevHandle }) | null)?.__correctiv;
    return handle && typeof handle.store?.getState === 'function' ? handle : null;
  } catch {
    return null; // only reachable if the frame ever left this origin
  }
}

/**
 * Put the frame's own base back at the front of its address.
 *
 * A development bundle writes the path without the base the frame was loaded under
 * — `appendBaseUrl` skips development just as `stripBaseUrl` does, see `driveRoute`
 * below — so the address ends up at `/gespeichert`, a path on the WORKBENCH's origin.
 * Left there, reloading the frame leaves the app entirely and renders the workbench
 * inside it. Measured, both the fault and the fix. It is not only `driveRoute` that
 * causes this: a tap inside the framed app writes the same base-less path.
 *
 * **Only ever on a frame that is already running the app**, which is what the handle
 * proves. A first attempt left that condition out and cost an afternoon: on the tick
 * before the frame has been sent anywhere it rewrote the address of an empty frame,
 * `frameRoute` then reported a route the app was not on, the poll wrote that into the
 * state, and the effect that navigates found the frame already where the state said
 * it should be and never sent it anywhere. The frame stayed blank for ever. That is
 * the same deadlock `frameRoute` guards against for `about:blank`, reached by a
 * different door.
 *
 * Idempotent, so the poll can call it every tick: an address that already carries
 * the base is left alone.
 */
export function keepFramePath(win: Window | null): void {
  if (!BASE || !win || !handleOf(win)) return;
  try {
    const path = win.location.pathname;
    if (path.startsWith(BASE)) return;
    win.history.replaceState(null, '', BASE + path + win.location.search + win.location.hash);
  } catch {
    // only reachable if the frame ever left this origin
  }
}

/**
 * What the *device* reports, measured inside the frame where it counts.
 *
 * `null` for a frame there is nothing to ask yet, rather than a cheerful
 * "light": the appearance readout counts `'system'` against a light device as
 * combination 3, and guessing that before the frame exists would name a
 * combination nobody is in.
 */
export function frameScheme(win: Window | null): Scheme | null {
  if (!win) return null;
  try {
    return win.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return null;
  }
}

/**
 * Which palette the app is painting with, which is not the same question.
 *
 * On web Uniwind puts exactly one of `light` / `dark` on `<html>`, and that
 * class is the setting after `'system'` has been resolved. `frameScheme()` above
 * is what the device asked for; the two differ on every screen where the setting
 * is explicit, and keeping them apart is the whole of the appearance readout.
 */
export function activeScheme(win: Window | null): Scheme {
  return win?.document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/** The app's appearance setting, as the store currently holds it. */
export function appTheme(win: Window | null): ThemeSetting | null {
  return handleOf(win)?.store.getState().settings?.theme ?? null;
}

/** Sets the appearance setting through the app's own action. No reload. */
export function applyTheme(win: Window | null, theme: ThemeSetting): boolean {
  const handle = handleOf(win);
  if (!handle) return false;
  handle.actions.settings.setTheme(theme);
  return true;
}

/** The route the frame is showing, with the Pages prefix removed. */
export function frameRoute(win: Window | null): string | undefined {
  try {
    // `about:blank` has a pathname too, and it is the string "blank". A frame
    // that has not been sent anywhere yet is not on a route, and reporting one
    // deadlocks the shell: the poll wrote `route: 'blank'` into the state, and
    // the effect that navigates then found the frame already where the state
    // said it should be and never sent it anywhere.
    if (!win || !/^https?:$/.test(win.location.protocol)) return undefined;
    const path = win.location.pathname;
    if (path === undefined) return undefined;
    const stripped = BASE && path.startsWith(BASE) ? path.slice(BASE.length) : path;
    return (stripped || '/').replace(/\.html$/, '').replace(/\/index$/, '/');
  } catch {
    return undefined;
  }
}

export function navigate(frame: HTMLIFrameElement, route: string): void {
  const target = BASE + (route.startsWith('/') ? route : `/${route}`);
  try {
    // replace(), so stepping through the app does not bury the shell in history.
    frame.contentWindow?.location.replace(target);
  } catch {
    frame.src = target;
  }
}

/**
 * Send the frame to a route through the app's own router.
 *
 * The address alone cannot do it in development, and the reason is upstream:
 * `expo-router`'s `stripBaseUrl` removes the base path only when
 * `NODE_ENV !== 'development'`
 * (`expo-router/build/fork/getStateFromPath-forks.js`), so a dev bundle framed at
 * `/app/` matches `/app/gespeichert` against its own routes, finds nothing, and
 * renders `+not-found`. Measured 2026-09-10 with both servers running: every framed
 * route did that, `/app/` included, which is worse than
 * [ADR 0025](../../../../../adr/0025-the-published-app-is-a-production-bundle.md)
 * had recorded.
 *
 * So the route travels the way everything else in this directory travels, by
 * same-origin property access
 * ([ADR 0014](../../../../../adr/0014-the-preview-shell-as-a-package.md)).
 *
 * **This leaves the address behind, and cannot put it back itself.** `navigate`
 * only queues a `ROUTER_LINK` action (`expo-router/build/global-state/router.js`,
 * `linkTo`), so nothing has moved yet when this returns. `keepFramePath` repairs the
 * address from the poll instead, which leaves a window in which reloading the frame
 * lands on the workbench rather than on the app. Sampled every 50 ms on 2026-09-10,
 * the base was back within 50 ms of a driven route and within 250 ms of a tap on a
 * tab, both inside the one 300 ms tick. Closing it here would not close it, because
 * a tap inside the app opens the same window and there is nothing to hook.
 *
 * Returns whether there was a router to ask, not whether the app arrived. `false` is
 * the normal state of the published export — and the state in which the address
 * works by itself, because a production bundle does apply the base path. The two
 * halves cover the two builds exactly, which is why neither needs a flag.
 */
export function driveRoute(win: Window | null, route: string): boolean {
  const handle = handleOf(win);
  if (!handle?.router) return false;
  try {
    handle.router.navigate(route);
    return true;
  } catch {
    // Only reachable if the frame left this origin between the check and here. An
    // unknown route does not come back this way: it is queued, and warns later.
    return false;
  }
}
