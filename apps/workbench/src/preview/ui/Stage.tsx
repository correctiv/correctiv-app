import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

import { cn } from '../../lib/cn';
import { OUTLINE } from '../AppFrame';
import { HOST_DEVICE } from '../devices';
import type { PreviewState } from '../state';

/** Shared by the three drag handles, which differ only in edge and cursor. */
const HANDLE =
  'absolute bg-transparent after:absolute after:inset-0 after:m-auto after:rounded-s after:bg-stroke-strong hover:after:bg-accent';

interface Props {
  state: PreviewState;
  /** Measured, not looked up: `host` has no preset. */
  size: { w: number; h: number };
  scale: number;
  stageRef: RefObject<HTMLDivElement | null>;
  frameRef: RefObject<HTMLIFrameElement | null>;
  onResize: (size: { w: number; h: number }) => void;
  onLoad: () => void;
  /**
   * Whether to print the sentence under the frame that says what this view is.
   *
   * The demo audience's, and not the inspector audience's. It used to be read off
   * `state.tools` and `state.full`, which are the shell's now and not the frame's,
   * so the page that knows both decides and this one draws. Off whenever a tool
   * is open, because the sentence points at a rail the reader has evidently found.
   */
  hint: boolean;
  /**
   * The day, drawn between the frame and whatever is below it, or nothing.
   *
   * A node rather than a flag, because whether there is a timeline at all is a
   * question about the route the frame is showing, the width of the window and
   * `full` — three things this component has no business knowing and `pages/Preview.tsx`
   * already holds. ADR 0042 §1 decides that it belongs here; §2 decides when there is
   * one; and a stage that asked the second question would be the third copy of it.
   */
  timeline: ReactNode;
}

type Axes = 'x' | 'y' | 'xy';

/**
 * The frame, at the size of a device, and the handles that change that size.
 *
 * Why an iframe and not a web-only wrapper inside the app: inside the frame the
 * app's own `window` **is** the device. `useWindowDimensions`, media queries
 * (including the reader's 48rem breakpoint) and scroll behaviour all report the
 * simulated size. A wrapper in `_layout.tsx` would draw a phone frame while the
 * app still measured the desktop window, which is a preview that lies. It also
 * keeps every line of this out of the app bundle and the native builds.
 *
 * Nothing is injected into the frame for sizing, deliberately: measured at
 * 393px, the app reports `innerWidth` 393 and `clientWidth` 393, so no desktop
 * scrollbar is eating layout width and there is nothing to compensate for.
 *
 * That is true of the frame and it was not true of the box around it. Tailwind's
 * preflight makes every box `border-box`, so the device's 1px outline came out of
 * the width it was given: measured on 2026-09-11 on the built site, a frame
 * reading `393 × 852` handed the app `innerWidth` 391. `OUTLINE` in
 * `preview/AppFrame.tsx` says the rest; the outline is added to the stated size
 * here for the same reason.
 *
 * The graph-paper ground is `stage-grid`, the one piece of decoration in
 * `styles/app.css`. It is there so the frame reads as a thing standing on a
 * surface rather than a white box on a white page, which is what it looked like
 * without it.
 */
export function Stage({
  state,
  size,
  scale,
  stageRef,
  frameRef,
  onResize,
  onLoad,
  hint,
  timeline,
}: Props) {
  const { w, h } = size;
  const host = state.device === HOST_DEVICE;
  const right = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const corner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (host) return;
    const handles: [RefObject<HTMLDivElement | null>, Axes][] = [
      [right, 'x'],
      [bottom, 'y'],
      [corner, 'xy'],
    ];
    const detach = handles.map(([ref, axes]) => drag(ref.current, axes, { w, h }, scale, onResize));
    return () => detach.forEach((off) => off());
  }, [host, w, h, scale, onResize]);

  /*
   * The app at the size of the screen it is already on, with nothing drawn round
   * it. A device frame here would be a phone rendered inside a phone at forty per
   * cent, which is what this view used to be on a 390px screen, and it is also
   * how the app view opens on one.
   */
  if (host) {
    return (
      /*
       * The frame is still what `stageRef` measures, and the timeline is its sibling
       * rather than its child. ADR 0042 §4 keeps one order down the screen at every
       * width — frame, timeline, tools — and `useStage` measures the box the frame has,
       * which is the box minus the track. A track inside the measured element would
       * make the frame fit itself.
       */
      <div className="flex h-full min-h-0 flex-col bg-canvas">
        <div ref={stageRef} className="min-h-0 flex-1">
          <h2 className="sr-only">App frame</h2>
          {/* eslint-disable-next-line react/iframe-missing-sandbox */}
          <iframe
            className="block h-full w-full border-0 bg-transparent"
            ref={frameRef}
            title="App preview"
            allow="autoplay; fullscreen; encrypted-media"
            onLoad={onLoad}
          />
        </div>
        {timeline}
      </div>
    );
  }

  return (
    <div className="stage-grid flex h-full min-h-0 flex-col">
      <h2 className="sr-only">App frame</h2>

      {/*
        The box the frame is measured against, and nothing else in it. The
        caption below used to be a sibling inside this box, which meant `useScale`
        had to guess how tall two lines of prose would be, and it guessed low: the
        frame ran off the bottom of the view at 900px tall.

        `m-auto` rather than `items-center`, because a frame larger than the box
        has to be scrollable from its own top left, and centring in a scroll
        container puts the top out of reach.
      */}
      <div ref={stageRef} className="relative flex min-h-0 flex-1 overflow-auto p-m">
        <div
          className="relative m-auto shrink-0"
          style={{ width: (w + OUTLINE) * scale, height: (h + OUTLINE) * scale }}
        >
          {/*
          The ground behind the app while it boots. Only a pinned dark setting is
          known here without reading the frame, and reading the frame is the
          `Readout`'s job; guessing anything else would flash the wrong colour
          under the app on every load.

          `transformOrigin` is what makes the box above the right size: scaled
          from its own top left, the device covers exactly `w * scale` by
          `h * scale`, which is what the handles are then positioned against.
        */}
          <div
            className="overflow-hidden rounded-md border border-stroke-strong bg-white text-neutral-700 shadow-lg"
            data-app-scheme={state.theme === 'dark' ? 'dark' : undefined}
            style={{
              width: w + OUTLINE,
              height: h + OUTLINE,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {/*
            No `sandbox`, on purpose. The attribute's useful values would have to
            include `allow-same-origin` for this tool to work at all, since
            reading the frame's route, its console and its store is the entire
            point, and `allow-same-origin` plus `allow-scripts` on a document
            from this very origin is a sandbox that sandboxes nothing. An
            attribute that only looks like a precaution is worse than none.
          */}
            {/* eslint-disable-next-line react/iframe-missing-sandbox */}
            <iframe
              className="block h-full w-full border-0 bg-transparent"
              ref={frameRef}
              title="App preview"
              allow="autoplay; fullscreen; encrypted-media"
              onLoad={onLoad}
            />
          </div>
          {/*
          Pointer only, and deliberately not the sole way to change the size:
          the same numbers are in the toolbar, in two fields, whenever the device
          is the person's own.
        */}
          <div
            ref={right}
            className={cn(
              HANDLE,
              '-right-s top-0 h-full w-s cursor-ew-resize after:h-[2.625rem] after:w-[0.1875rem]',
            )}
          />
          <div
            ref={bottom}
            className={cn(
              HANDLE,
              '-bottom-s left-0 h-s w-full cursor-ns-resize after:h-[0.1875rem] after:w-[2.625rem]',
            )}
          />
          <div
            ref={corner}
            className={cn(
              HANDLE,
              '-bottom-s -right-s h-s w-s cursor-nwse-resize after:h-[0.4375rem] after:w-[0.4375rem]',
            )}
          />
        </div>
      </div>

      {timeline}

      {/*
        The sentence the demo audience gets, and the one the inspector's audience
        does not. Written out of the tree, so a screen reader cannot read out a
        hint about a sidebar that is already open, and gone in full screen too,
        where it would name a bar and a shortcut that are not on the screen.

        Below 64rem it is `display: none`, which takes it out of the accessibility
        tree as well. Five lines of prose under a phone-sized frame on a
        phone-sized screen is a third of the room the app has, spent explaining
        controls that are one tap away.
      */}
      {hint && (
        <p className="mx-auto hidden max-w-[42rem] shrink-0 px-m pb-m text-center text-m text-on-canvas-muted lg:block">
          This is the app at device size. Pick a device or a route in the bar above; the address in
          the status line reproduces exactly what you see. The rail on the right has the console,
          the colour tokens and the element picker.
        </p>
      )}
    </div>
  );
}

/** Drag deltas are screen pixels; the frame is CSS pixels behind a `scale()`. */
function drag(
  handle: HTMLDivElement | null,
  axes: Axes,
  start: { w: number; h: number },
  scale: number,
  onResize: (size: { w: number; h: number }) => void,
): () => void {
  if (!handle) return () => {};

  const down = (ev: PointerEvent) => {
    ev.preventDefault();
    handle.setPointerCapture(ev.pointerId);
    const from = { x: ev.clientX, y: ev.clientY };

    const move = (e: PointerEvent) => {
      const next = { ...start };
      if (axes.includes('x'))
        next.w = Math.max(240, Math.round(start.w + (e.clientX - from.x) / scale));
      if (axes.includes('y'))
        next.h = Math.max(320, Math.round(start.h + (e.clientY - from.y) / scale));
      onResize(next);
    };

    // `pointercancel` as well as `pointerup`: a touch the browser takes over
    // (a scroll gesture, a call coming in) ends the drag without an up, and the
    // move listener left behind would then run a second time on the next drag.
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
    };

    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  handle.addEventListener('pointerdown', down);
  return () => handle.removeEventListener('pointerdown', down);
}
