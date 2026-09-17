import { Fragment, useEffect, useState } from 'react';
import {
  CalendarClock,
  Check,
  Copy,
  ExternalLink,
  MoreHorizontal,
  RectangleHorizontal,
  RectangleVertical,
  RotateCw,
  X,
} from 'lucide-react';

import { cn } from '../../lib/cn';
import { Button } from '../../ui/kit/button';
import { Segmented } from '../../ui/kit/segmented';
import { Separator } from '../../ui/kit/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/kit/tooltip';
import { Pages } from './Pages';
import { DEVICES, HOST_DEVICE } from '../devices';
import { governs } from '../home/document';
import { ROUTES } from '../routes';
import { frameSize, type PreviewState } from '../state';
import type { Status } from '../api';

/** The context bar's one field shape, so its selects and inputs agree. */
const FIELD =
  'h-[1.75rem] rounded-md border border-stroke bg-canvas px-2xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

interface Props {
  state: PreviewState;
  status: Status;
  routeField: string;
  onRouteField: (value: string) => void;
  onChange: (patch: Partial<PreviewState>) => void;
  onReload: () => void;
  onRaw: () => void;
}

const ZOOMS: { value: string; label: string }[] = [
  { value: '0.5', label: '50%' },
  { value: '0.75', label: '75%' },
  { value: '1', label: '100%' },
  { value: 'fit', label: 'Fit' },
];

/**
 * What the app view puts in the header's context bar: device, size, zoom, route.
 *
 * These four are the demo's own controls, and `README.md` hands out the address
 * that carries them. Everything added since is behind the rail on the right edge,
 * which opens nothing until it is asked, because a debug surface is not what
 * somebody following a link to see the app came for. They stay here rather than
 * moving onto the rail: a device and a route are what the frame IS, not a tool
 * for looking at it.
 *
 * One row, no labels above the fields. The bar is 2.75rem tall on every view and
 * has to stay that way, so each control names itself through its own value or an
 * `aria-label`, and the tooltip carries the rest.
 *
 * `status` is read for one thing only, and never for a count: the warning and
 * error counts belong to the tools, and a count of errors on the demo bar is the
 * first crack in the two-audience rule above. What it is read for is the last
 * button, whose behaviour differs between the two builds — see there.
 *
 * **Below `sm` (640px) three things change shape or fold away.** Measured at
 * 420px: device and orientation alone filled one row, and zoom, the route
 * list button, the route field, a separator, reload and "open without the
 * frame" filled most of a second — three rows in all once the header's own
 * logo-and-icons row is counted, on top of a panel beneath that used to claim
 * half the window regardless of what was in it (`App.tsx` has that half).
 * Below `sm`: the device select's own width narrows (the dropdown's options
 * are unaffected — only the closed control shows less of the chosen name),
 * orientation is a single icon toggle rather than a labelled two-segment
 * control, and zoom, reload and "open without the frame" fold behind one
 * `MoreHorizontal` button — `moreOpen` picks between that button and the
 * group it stands for, never both. Nothing here is deleted: a press reaches
 * everything the wider bar shows inline, one press further in. `sm:` and up
 * is unchanged, because a tablet or a desktop window already had the room
 * these controls asked for.
 */
export function Toolbar({
  state,
  status,
  routeField,
  onRouteField,
  onChange,
  onReload,
  onRaw,
}: Props) {
  const size = frameSize(state);
  // Left shut until asked, and not reset when the frame's own state changes —
  // it is a fact about what this bar is showing, not about the frame.
  const [moreOpen, setMoreOpen] = useState(false);
  /*
   * At the host's own size there is no frame to turn or to scale: the app has
   * the screen. Both controls are written out rather than disabled, because a
   * bar on a 390px screen wraps, and two rows of controls that cannot do
   * anything are two rows of the app nobody can see.
   */
  const host = state.device === HOST_DEVICE;
  /*
   * Read off the frame, never off `state.landscape`. That flag swaps the two
   * numbers, and it only reads as "landscape" while every pair is written
   * portrait-first. Two things are not: a custom size is whatever was typed into
   * the fields, and the presets above tablet size are written the way a laptop is
   * used. Measured on `d=desktop` before this line existed, the control had
   * "Portrait" lit beside a 1440 × 900 frame.
   */
  const landscape = size.w > size.h;
  /*
   * ADR 0042 §2: the switch is here on the routes the document governs and absent on the
   * others, rather than present and inert. A control that demonstrably does nothing is
   * what §2 refuses, and 0038 §5 already cut six badges for saying less than that. What
   * decides it is the route the FRAME reports, which is also what decides whether there
   * is a track for this to put away — one predicate, called twice, so the button and the
   * thing it switches cannot disagree.
   */
  const day = governs(status.frameRoute);

  return (
    <div
      className="flex min-w-0 flex-1 flex-wrap items-center gap-2xs"
      role="toolbar"
      aria-label="Frame"
    >
      <select
        className={cn(FIELD, 'shrink-0 max-w-[7rem] sm:max-w-[13rem]')}
        aria-label="Device"
        value={state.device}
        onChange={(e) =>
          onChange({
            device: e.target.value,
            landscape: false,
            // Carry the size over into `custom`, so picking it keeps what is on
            // screen. Not from `host`, whose `frameSize` is zero by design: the
            // stage measures that one, and spreading it collapsed the frame to
            // 0 × 0 with no way back but a reload.
            ...(e.target.value === 'custom' && !host ? size : {}),
          })
        }
      >
        {DEVICES.map((d) => (
          <option key={d.id} value={d.id}>
            {d.w === 0 ? d.label : `${d.label}, ${d.w}×${d.h}`}
          </option>
        ))}
      </select>

      {/*
        Only while the size is the person's own, as in the design. Every preset
        states its size in the option beside it, so two number fields that merely
        echo the select are noise on the bar the demo audience sees. Dragging the
        stage handles switches the device to `custom`, which is how the fields
        appear without anyone looking for them.
      */}
      {!host && state.device === 'custom' && (
        <span className="flex shrink-0 items-center gap-3xs">
          <input
            className={cn(FIELD, 'w-[4rem] text-center font-mono tabular-nums')}
            type="number"
            min={240}
            max={2400}
            aria-label="Width in CSS pixels"
            value={size.w}
            onChange={(e) =>
              onChange({
                device: 'custom',
                landscape: false,
                w: Math.max(240, Number(e.target.value) || size.w),
                h: size.h,
              })
            }
          />
          <span aria-hidden="true" className="text-on-canvas-muted">
            ×
          </span>
          <input
            className={cn(FIELD, 'w-[4rem] text-center font-mono tabular-nums')}
            type="number"
            min={320}
            max={2400}
            aria-label="Height in CSS pixels"
            value={size.h}
            onChange={(e) =>
              onChange({
                device: 'custom',
                landscape: false,
                w: size.w,
                h: Math.max(320, Number(e.target.value) || size.h),
              })
            }
          />
        </span>
      )}

      {day && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={state.timeline ? 'outline' : 'ghost'}
              size="icon"
              aria-pressed={state.timeline}
              className="shrink-0"
              aria-label={state.timeline ? 'Put the day away' : 'Show the day under the frame'}
              onClick={() => onChange({ timeline: !state.timeline })}
            >
              <CalendarClock aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {state.timeline ? 'The day · press to put it away' : 'Show the day under the frame'}
          </TooltipContent>
        </Tooltip>
      )}

      {!host && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 sm:hidden"
              aria-label={landscape ? 'Switch to portrait' : 'Switch to landscape'}
              onClick={() => onChange({ landscape: !state.landscape })}
            >
              {landscape ? (
                <RectangleHorizontal aria-hidden="true" />
              ) : (
                <RectangleVertical aria-hidden="true" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {landscape ? 'Landscape' : 'Portrait'} · press to rotate
          </TooltipContent>
        </Tooltip>
      )}

      {!host && (
        <Segmented
          name="orientation"
          legend="Orientation"
          className="hidden shrink-0 sm:block"
          value={landscape ? 'landscape' : 'portrait'}
          options={[
            { value: 'portrait', label: 'Portrait' },
            { value: 'landscape', label: 'Landscape' },
          ]}
          // A radio group fires only when the value actually changes, so the one
          // thing ever being asked for here is the other way round.
          onChange={() => onChange({ landscape: !state.landscape })}
        />
      )}

      {/*
        Below `sm`, one button that opens and shuts the group beneath it —
        itself never hidden there, so folding the group away always leaves a
        way back. `moreOpen` picks exactly one of `max-sm:hidden` (on each of
        the four items past this one) and no override at all, never both, so
        there is nothing for an importance modifier to win against. `sm` and up
        ignores the state, always shows the group and never shows this button,
        which is its own `sm:hidden`.
      */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={moreOpen}
            className="shrink-0 sm:hidden"
            aria-label="More frame controls: zoom, reload, open without the frame"
            onClick={() => setMoreOpen((open) => !open)}
          >
            {moreOpen ? <X aria-hidden="true" /> : <MoreHorizontal aria-hidden="true" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {moreOpen ? 'Fold away' : 'Zoom, reload, open without the frame'}
        </TooltipContent>
      </Tooltip>

      {!host && (
        <select
          className={cn(FIELD, 'shrink-0', !moreOpen && 'max-sm:hidden')}
          aria-label="Zoom"
          value={String(state.zoom)}
          onChange={(e) =>
            onChange({ zoom: e.target.value === 'fit' ? 'fit' : Number(e.target.value) })
          }
        >
          {ZOOMS.map((z) => (
            <option key={z.value} value={z.value}>
              {z.label}
            </option>
          ))}
        </select>
      )}

      <Pages onPick={(route) => onChange({ route })} />

      <input
        className={cn(FIELD, 'min-w-[5.5rem] flex-1 font-mono sm:min-w-[8rem]')}
        type="text"
        list="routes"
        aria-label="Route"
        spellCheck={false}
        autoComplete="off"
        value={routeField}
        onChange={(e) => onRouteField(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onChange({ route: routeField });
        }}
        onBlur={() => onChange({ route: routeField })}
      />
      <datalist id="routes">
        {ROUTES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </datalist>

      <Separator
        orientation="vertical"
        className={cn('h-[1.5rem]', !moreOpen && 'max-sm:hidden')}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(!moreOpen && 'max-sm:hidden')}
            aria-label="Reload the frame"
            onClick={onReload}
          >
            <RotateCw aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Reload the frame</TooltipContent>
      </Tooltip>

      {/*
        Said on this button because this button is where it bites, which is the
        rule that took it off a paragraph at the top of the tools panel. Expo
        Router applies its base path when the export is built and not in the dev
        server, so an address under the base is not a route the app can match. The
        field beside this works anyway, by driving the app's own router over the
        dev handle (`frame/handle.ts`, `driveRoute`); this button has no such way
        in and lands on the app's 404. The published build has neither limit.
        `TROUBLESHOOTING.md` has the measurement.
      */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(!moreOpen && 'max-sm:hidden')}
            aria-label="Open the app on its own, without the frame"
            onClick={onRaw}
          >
            <ExternalLink aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {status.handle
            ? 'Open the app without the frame · a dev server applies no base path, so this lands on the app’s 404'
            : 'Open the app without the frame'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * The address that reproduces exactly what is on screen.
 *
 * In the status line rather than in a row of its own. It is a fact about the
 * current view, which is what that line is for, and a second row under the header
 * would have pushed the frame down.
 *
 * The hash is handed over rather than derived here, and it is the shell's whole
 * hash: `shell/address.ts` has already written it with `replaceState`, and it
 * carries the panel's own `tools` and `open` beside the frame's parameters. So
 * this line shows the browser's address rather than a second rendering of half
 * the state that could drift from it. The values are picked out because the
 * point of it is that a knob moved and the link changed with it.
 */
export function LinkBar({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  const cut = hash.indexOf('?');
  const route = hash.slice(1, cut === -1 ? undefined : cut);
  const params = cut === -1 ? [] : hash.slice(cut + 1).split('&');

  return (
    <span className="flex min-w-0 items-center gap-2xs">
      <code aria-live="off" className="truncate">
        {window.location.pathname}#<b className="text-on-canvas">{route}</b>
        {params.map((pair, index) => {
          const [key, value] = pair.split('=');
          return (
            <Fragment key={key}>
              {index === 0 ? '?' : '&'}
              {key}=<b className="text-on-canvas">{value}</b>
            </Fragment>
          );
        })}
      </code>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-[1.375rem] shrink-0"
            aria-label="Copy this view as a link"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            }}
          >
            {copied ? (
              <Check aria-hidden="true" className="text-on-canvas-accent" />
            ) : (
              <Copy aria-hidden="true" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Copy this view as a link</TooltipContent>
      </Tooltip>
      {/* `output`, not a span with `role="status"`: same live region, and the
          element the linter and the platform both name for it. */}
      <output className="sr-only">{copied ? 'Copied' : ''}</output>
    </span>
  );
}
