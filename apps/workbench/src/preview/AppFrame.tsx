import { useEffect, useRef, useState } from 'react';
import { defineMessages } from 'react-intl';

import { BASE, driveRoute, keepFramePath, navigate } from './frame/handle';
import { holdTheDoorOpen } from './frame/seed';
import { useWorkbenchIntl } from '../i18n/Localisation';

/**
 * Everything this file says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/preview.ts`.
 *
 * Two lines, and they are the only words this component owns: everything else on
 * screen while it is mounted is the app's, drawn inside the frame. The frame's
 * own accessible name is not here either, because it is a prop — the caller knows
 * what it is framing and this file does not.
 */
const COPY = defineMessages({
  booting: {
    id: 'preview.frame.booting',
    defaultMessage: 'Booting the app…',
    description:
      'Over the frame while the app’s bundle is still starting, in a live region. preview.frame.stuck replaces it if the app never arrives.',
  },
  stuck: {
    id: 'preview.frame.stuck',
    defaultMessage: 'The app did not load. The console in the tool panel has the details.',
    description:
      'Replaces preview.frame.booting after six seconds with nothing drawn. “The preview” is this site’s /preview view, whose console tool shows what the app said on its way down.',
  },
});

/** Between attempts to hand the route to the app's router, in milliseconds. */
const RETRY = 200;

/** How long to keep trying. A cold Metro bundle is slow, and this is after it. */
const GIVE_UP = 6_000;

/**
 * The device's outline, which is NOT part of the device.
 *
 * Tailwind's preflight makes every box `border-box`, so a 1px border on an
 * element sized `393` leaves 391 for what is inside it — and what is inside it
 * here is the app's whole window. Measured on 2026-09-11 on the built site: the
 * frame said `393 × 852` in its own readout and `innerWidth` inside it was 391,
 * on this route and in the preview alike. Two pixels is nothing to look at and
 * everything to a preview whose one job is to be the size it claims, so the
 * outline is added to the stated size rather than taken out of it.
 */
export const OUTLINE = 2;

/**
 * Whether the route has to be handed to the app's router, or the address will do.
 *
 * The one build-time question this file asks, and it is the honest form of it. A
 * development bundle matches routes without stripping its base path, so
 * `/app/gallery` is a page the app does not have and it draws its own 404 (ADR
 * 0025, measured); the dev handle is the way round that. The published export has
 * no handle and needs none, because there the address *is* the route.
 *
 * Read off this site's build rather than probed in the frame, because probing it
 * is a race. Measured on 2026-09-10 with a warm bundle: the frame's document
 * reports `readyState` "complete" at 1,240 ms and the handle appears at 1,399 ms,
 * so "no handle yet" and "no handle at all" look identical for 159 ms and for
 * however long a cold bundle takes. Re-measured the same day the gap was 45 ms,
 * which is the point: it is a race and not a duration to wait out. The two halves
 * are one deployment: the dev server proxies `/app` to Metro, and the Pages
 * artifact carries an export.
 */
const DRIVES = import.meta.env.DEV;

/**
 * Whether the app's own router has taken the route.
 *
 * Not "is the address right", which is what got this wrong twice. The address is
 * right the moment the frame is pointed at it and stays right while the app draws
 * its 404 behind it. What cannot happen without the router is the *base path
 * going away*: `appendBaseUrl` skips a development build, so the first thing the
 * app writes after a navigation is a path with no `/app` in front of it. That is
 * an observable the address alone cannot fake, and `keepFramePath` puts the base
 * back afterwards.
 */
export function tookTheRoute(win: Window | null): boolean {
  try {
    return (
      !!win && /^https?:$/.test(win.location.protocol) && !win.location.pathname.startsWith(BASE)
    );
  } catch {
    return false;
  }
}

/**
 * Whether the document at the address the frame was pointed at has finished.
 *
 * In the published export that is the whole job, the address being the route
 * there. In a development build it is only what the poll falls back to showing
 * when the handover never happens, which beats an overlay over a working page.
 * Kept apart from `tookTheRoute` because the two are opposite readings of the
 * same path, and merging them is how a frame that is still loading gets called
 * done.
 *
 * `readyState` is not a reading on its own, which is the whole of this function.
 * The document a frame starts with is `about:blank`, and an empty document is
 * "complete" from the first tick: asked that alone, the poll called a frame that
 * had loaded nothing finished, stopped, and left the app's 404 on screen. So the
 * address has to agree, and it is taken from `document.URL` — the document's own
 * address, which cannot be a pending one. `location` was suspected of reporting
 * the pending address ahead of the document, and it does not: sampled every 4 ms
 * through a 400 ms navigation on 2026-09-10, by `location.replace` and by `src`
 * alike, the two never disagreed. `document.URL` is asked anyway, being the
 * reading that survives a browser where they do.
 */
export function loadedTheAddress(win: Window | null): boolean {
  try {
    return !!win && win.document.readyState === 'complete' && win.document.URL.includes(BASE);
  } catch {
    return false;
  }
}

/**
 * This origin's storage, or nothing.
 *
 * Reading the property is what throws when site data is switched off, so it
 * cannot be done inside `holdTheDoorOpen` — and a page must not fail to render
 * because one frame could not seed a session. `theme.ts` guards its own two calls
 * for the same reason.
 */
function ownStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The app on one route, in a box, without the preview around it.
 *
 * `Preview.tsx` is the tool: device sizes, appearance, storage fixtures, the
 * console, the measure checks, all carried in its address. This is the other
 * thing a frame is for, which is to draw one screen where the text about it
 * stands, and `/components/<group>/<name>` is the reader it was written for. It
 * shares the three parts of the mechanism that are hard to get right rather than
 * copying them: where the app answers, how to reach a route in a development
 * build, and how to get past the door.
 *
 * Why a frame and not a component rendered in place: the components are React
 * Native, and this package compiles none of it. The app's own bundle is the only
 * thing that can draw them, and an iframe is how this page borrows it.
 *
 * Mounted by the caller, only when something has asked for it. One frame boots
 * the whole app bundle, and the overview of forty-five components holds none:
 * the frame is on the detail route, where a device has room to be a device
 * (ADR 0028).
 */
export function AppFrame({
  route,
  title,
  size,
  scale = 1,
}: {
  /** An app route, with its query if it takes one: `/gallery?c=ui/Button`. */
  route: string;
  /** Names the frame for a screen reader, which cannot see what is in it. */
  title: string;
  /**
   * The device, in CSS pixels. A frame always carries a viewport, so the size is
   * the caller's choice rather than a number in here: `/components/<group>/<name>`
   * offers the presets in `preview/devices.ts`, which is the whole reason the
   * frame lives on a detail route and not on a card three hundred pixels wide.
   */
  size: { w: number; h: number };
  /** Drawn smaller to fit the box it stands in, the way `ui/Stage.tsx` does. */
  scale?: number;
}) {
  const intl = useWorkbenchIntl();
  const ref = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<'booting' | 'drawn' | 'stuck'>('booting');

  /**
   * Points the frame at the route, then hands the route to the app's router until
   * the app takes it.
   *
   * One poll rather than a `load` handler, and that is the second attempt. The
   * first drove the route once, on `load`, and the frame stayed on the app's 404:
   * a frame with no `src` fires `about:blank`'s load event as well as the app's,
   * and even on the right one the handle can be there while the router is not
   * mounted yet. Measured, that first `navigate` is dropped in silence and the
   * same call by hand twelve seconds later worked. A poll has to know none of
   * that, because every tick asks the frame what is true now.
   *
   * It ends when the app's router has written the address; when the document is
   * loaded and nothing is going to drive it, which is the published export; or
   * when the time is up, and then it shows whatever did load rather than leaving
   * a box that says it is still booting.
   */
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;
    setState('booting');
    // Before the frame is pointed anywhere, because the app reads the session on
    // its first render and the gate replaces the whole router.
    const store = ownStorage();
    if (store) holdTheDoorOpen(store);
    navigate(frame, route);

    const started = Date.now();
    let taken = 0;
    const timer = window.setInterval(() => {
      const win = frame.contentWindow;
      const loaded = loadedTheAddress(win);

      /*
       * Done, and then twice more.
       *
       * The app writes a path with no `/app` in front of it, so a frame left that
       * way is one reload away from leaving the app and rendering this site inside
       * itself; `keepFramePath` puts the base back and `frame/handle.ts` carries
       * the measurement. Doing it once was not enough: more than one `navigate`
       * reaches the router before a tick can see the first one arrive, and the
       * later one writes the address again afterwards. Measured, one frame in
       * three kept a base-less path. So the base goes back on three ticks, and
       * `taken` is what stops the route being driven again in between — the base
       * being back is exactly what `tookTheRoute` reads as "not yet".
       */
      if (taken > 0 || tookTheRoute(win)) {
        taken += 1;
        keepFramePath(win);
        setState('drawn');
        if (taken > 2) window.clearInterval(timer);
        return;
      }

      if (DRIVES) driveRoute(win, route);

      if ((!DRIVES && loaded) || Date.now() - started > GIVE_UP) {
        window.clearInterval(timer);
        setState(loaded ? 'drawn' : 'stuck');
      }
    }, RETRY);

    return () => window.clearInterval(timer);
  }, [route]);

  return (
    /*
      Two boxes, because a scaled element still occupies its unscaled space. The
      outer one is the room the frame takes on the page; the inner one is the
      device, scaled from its own top left so the two agree. `ui/Stage.tsx` does
      the same thing for the same reason.
    */
    <div
      className="relative shrink-0 overflow-hidden"
      style={{ width: (size.w + OUTLINE) * scale, height: (size.h + OUTLINE) * scale }}
    >
      <div
        className="absolute left-0 top-0 overflow-hidden rounded-md border border-stroke bg-canvas"
        style={{
          width: size.w + OUTLINE,
          height: size.h + OUTLINE,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {state !== 'drawn' && (
          // A live region, because the frame it covers is what a reader is waiting
          // for and "did not load" arrives six seconds after they stopped looking.
          // `output` and not `p role="status"`: oxlint asks for the element whose
          // implicit role that is, and the two are the same announcement.
          <output className="absolute inset-0 grid place-items-center px-s text-center text-s text-on-canvas-muted">
            {intl.formatMessage(state === 'booting' ? COPY.booting : COPY.stuck)}
          </output>
        )}
        {/* eslint-disable-next-line react/iframe-missing-sandbox */}
        <iframe
          ref={ref}
          title={title}
          /* No `sandbox`: `allow-same-origin` would have to be in it for the two
           lines below to work at all, and with `allow-scripts` beside it on a
           same-origin document the attribute grants what it appears to withhold.
           `ui/Stage.tsx` carries the long version of this argument. */
          /* The frame follows THIS page's appearance, which is the one thing about
           it a reader can set and the app in it cannot see. `color-scheme` on an
           embedding element is what `prefers-color-scheme` resolves to inside the
           document, so these two classes reach across the origin the class on
           `<html>` cannot: measured on 2026-09-10, flipping this property moved
           the framed app's own `light`/`dark` class with no reload and no handle,
           which is what makes it work in the published export too. The app stays
           the authority when its own setting is explicit — Uniwind then writes the
           class from the setting and ignores the query — and this decides the
           default, `'system'`, which is what a reader of this page has. Without it
           the reference drew a black phone on a white page whenever the two
           disagreed, and that is the app's own default against a dark device. */
          className="block h-full w-full border-0 scheme-light dark:scheme-dark"
        />
      </div>
    </div>
  );
}
