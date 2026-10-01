import { fileURLToPath } from 'node:url';

import tailwind from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import { docsPlugin } from './plugin/index.ts';
import { contentSecurityPolicy } from './plugin/policy.ts';
import { appPlugins, appResolve } from './vite.app.mjs';

/**
 * The app's dev server, which this one borrows rather than replaces.
 *
 * `npm run app` serves the app here. The workbench frames it, and framing it is
 * only useful if the frame can be reached, which means one origin.
 *
 * The port is overridable so a second instance can be run beside a first without
 * editing this file.
 */
const APP_DEV_SERVER = process.env.APP_DEV_SERVER || 'http://localhost:8081';

/**
 * The workbench is the site, and the app is a directory inside it.
 *
 * This is the one setting the preview hangs on, and it is easy to get wrong in
 * a way that leaves no error. Everything the inspector does is a same-origin
 * property access into the frame: `contentWindow`, `matchMedia`,
 * `documentElement.classList`, `localStorage`, and the handle the app leaves on
 * its own global. None of it is path-sensitive, and all of it is refused outright
 * across origins, silently, because the browser simply does not answer the
 * property.
 *
 * On Pages that costs nothing: both halves are uploaded as one artifact, so `/`
 * and `/app/` are already the same origin. In development they are two servers,
 * so the app is proxied under this one instead of being framed across ports.
 * `ws: true` because the app's dev server pushes its reloads over a socket, and a
 * proxy that forwards only HTTP gives a frame that loads once and then never
 * updates.
 *
 * ADR 0014 put the older preview shell inside `apps/mobile/public/` to get this
 * same-origin guarantee. Its argument was right and its conclusion was one way of
 * several: assembling one origin at deploy time and proxying in development is
 * another, and it is the one that lets the workbench own the site root.
 */
export default defineConfig(({ command }) => ({
  base: process.env.WORKBENCH_BASE?.trim() || '/',
  /*
   * `resolve` at this level rather than from a plugin, and that is not a style
   * choice: a plugin's `config()` result is merged AFTER the user's and array
   * values are concatenated, so `.web.*` only comes first if it is written here.
   * `vite.app.mjs` explains what the order is for.
   */
  resolve: appResolve,
  /*
   * `appPlugins()` is what lets this build compile a component out of
   * `apps/mobile`: Flow stripped, `react-native` aliased, Uniwind's classes
   * generated from the app's own stylesheet. It is shared with
   * `scripts/measure-direct.mjs`, so the number in ADR 0027 is about this build
   * and not about a second one that merely looks like it.
   *
   * No `@vitejs/plugin-react` of this package's own any more: `rnw()` ends with
   * one, and two React plugins transform every file twice.
   */
  plugins: [docsPlugin(), ...appPlugins(), tailwind(), contentSecurityPolicy()],
  build: {
    outDir: fileURLToPath(new URL('./dist', import.meta.url)),
    emptyOutDir: true,
    // The documents are large strings and there are thirty of them. Reporting
    // them as oversized on every build would train everyone to ignore the
    // warning, and the number it would be reporting is not actionable.
    chunkSizeWarningLimit: 1500,
  },
  server:
    command === 'serve'
      ? {
          proxy: {
            /*
             * The app itself, one path below this server.
             *
             * A regular expression, not the plain prefix `/app`, because Vite
             * matches proxy keys as prefixes in declaration order and `/app` is a
             * prefix of `/apps`. The bundle request below was matched by this rule
             * first and rewritten to `s/mobile/index.bundle`, which the app's
             * server has never heard of.
             */
            '^/app(/|$)': {
              target: APP_DEV_SERVER,
              changeOrigin: false,
              ws: true,
              rewrite: (path) => path.replace(/^\/app/, '') || '/',
            },
            /*
             * And the two roots the app's own HTML asks for absolutely.
             *
             * Its dev server writes `/apps/mobile/index.bundle` and `/assets/...`
             * from the origin root, whatever base path it is given, so a proxy
             * that covered only `/app` served the bundle request from this server
             * instead. Vite answered with its own 404 page, the browser refused it
             * for having a JSON content type, and the frame stayed white with
             * nothing in it explaining why. Measured against the running dev
             * server: those two are the only roots it reaches for.
             *
             * Neither collides here. The workbench serves nothing at `/apps`, and
             * in development Vite serves its own modules from `/src` and `/@fs`,
             * so `/assets` is free until the production build, which is not this.
             */
            '/apps': { target: APP_DEV_SERVER, changeOrigin: false },
            '/assets': { target: APP_DEV_SERVER, changeOrigin: false },
            /*
             * The two questions the element picker asks Metro, which it used to
             * be able to ask because the shell was served by Metro itself
             * (ADR 0014). `frame/locate.ts` posts a stack to `/symbolicate` to
             * turn bundle positions into source files, and `/open-stack-frame`
             * to open one in an editor. Both are absolute from the origin root,
             * and this origin is the workbench's; without these two lines the
             * picker returned nothing and said "no source", which is what it
             * says for a static export, so it looked like a build difference
             * rather than a missing proxy.
             */
            '/symbolicate': { target: APP_DEV_SERVER, changeOrigin: false },
            '/open-stack-frame': { target: APP_DEV_SERVER, changeOrigin: false },
            /*
             * The two sockets that make an edit appear, which is the whole point
             * of a dev server and the one thing the frame could not do.
             *
             * `ws: true` on the `/app` rule above covers only sockets opened
             * below that path, and neither of Metro's is. Both build their own
             * address from `window.location.host` — inside the frame that is this
             * server, not the app's — and ask at the origin root: `/hot` carries
             * Fast Refresh, `/message` the reload commands the CLI sends.
             *
             * Vite answered `/hot` itself, because Vite has its own socket on this
             * port, so the two spoke past each other: no error in the console, no
             * reload, an edit that simply never arrived. Reloading the frame by
             * hand fetched the new bundle, which is what made it look like the app
             * was fine and the change had not been saved.
             */
            '/hot': { target: APP_DEV_SERVER, changeOrigin: false, ws: true },
            '/message': { target: APP_DEV_SERVER, changeOrigin: false, ws: true },
          },
        }
      : undefined,
}));
