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
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { useHeaderDensity } from '../../ui/header-row';

import { cn } from '../../lib/cn';
import { Button } from '../../ui/kit/button';
import { Segmented } from '../../ui/kit/segmented';
import { Select } from '../../ui/kit/select';
import { Separator } from '../../ui/kit/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../ui/kit/tooltip';
import { Pages } from './Pages';
import { deviceOption, DEVICES, HOST_DEVICE } from '../devices';
import { isFrameChannel } from '../frame/channel';
import { isLocale, LOCALES } from '../frame/locale';
import { governs } from '../home/document';
import { LAYOUT_NAMES, layoutIds } from '../home/screens';
import { say } from '../../i18n/messages';
import { ROUTES } from '../routes';
import { frameSize, type PreviewState } from '../state';
import type { Status } from '../api';

/**
 * Everything this bar says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/frame.ts`.
 *
 * `frame.*` and not `home.*`: these are the frame's own controls — which device, which
 * way up, which route — and the home tool that borrows the row beside them has a
 * namespace of its own. The bar is one row tall and shows almost no words, so most of
 * what is here is an accessible name or a tooltip rather than a label anybody reads.
 */
const COPY = defineMessages({
  toolbar: {
    id: 'frame.toolbar',
    defaultMessage: 'Frame',
    description:
      'The accessible name of the whole control bar above the framed app. Read aloud and never seen.',
  },
  device: {
    id: 'frame.device',
    defaultMessage: 'Device',
    description:
      'The accessible name of the select that picks which device the app is framed at. The bar carries no labels above its fields.',
  },
  width: { id: 'frame.width', defaultMessage: 'Width in CSS pixels' },
  height: { id: 'frame.height', defaultMessage: 'Height in CSS pixels' },
  layout: {
    id: 'frame.layout',
    defaultMessage: 'Layout',
    description:
      'The accessible name of the select that chooses which layout the workbench edits and the frame shows: the one the app ships, the demo, or any other folder under data/layouts. The bar carries no labels above its fields.',
  },
  dayHide: { id: 'frame.day.hide', defaultMessage: 'Put the day away' },
  dayShow: {
    id: 'frame.day.show',
    defaultMessage: 'Show the day under the frame',
    description:
      'Says what pressing does while the timeline is away, and is both the button’s accessible name and its tooltip.',
  },
  dayHideTip: { id: 'frame.day.hideTip', defaultMessage: 'The day · press to put it away' },
  toPortrait: { id: 'frame.orientation.toPortrait', defaultMessage: 'Switch to portrait' },
  toLandscape: { id: 'frame.orientation.toLandscape', defaultMessage: 'Switch to landscape' },
  portraitTip: {
    id: 'frame.orientation.portraitTip',
    defaultMessage: 'Portrait · press to rotate',
    description:
      'The tooltip on the one-icon orientation toggle below 640px, saying which way the frame is up now.',
  },
  landscapeTip: {
    id: 'frame.orientation.landscapeTip',
    defaultMessage: 'Landscape · press to rotate',
    description:
      'The tooltip on the one-icon orientation toggle below 640px, saying which way the frame is up now.',
  },
  orientation: {
    id: 'frame.orientation.legend',
    defaultMessage: 'Orientation',
    description:
      'The legend of the two-segment orientation control at 640px and up. Read aloud and not drawn.',
  },
  portrait: {
    id: 'frame.orientation.portrait',
    defaultMessage: 'Portrait',
    description: 'One of the two segments of the orientation control. A term of art.',
  },
  landscape: {
    id: 'frame.orientation.landscape',
    defaultMessage: 'Landscape',
    description: 'One of the two segments of the orientation control. A term of art.',
  },
  more: {
    id: 'frame.more',
    defaultMessage: 'More frame controls: language, zoom, reload, open without the frame',
    description:
      'The accessible name of the button that unfolds the controls that do not fit below 640px.',
  },
  moreTip: {
    id: 'frame.more.tip',
    defaultMessage: 'Language, zoom, reload, open without the frame',
  },
  moreFold: { id: 'frame.more.fold', defaultMessage: 'Fold away' },
  language: {
    id: 'frame.language',
    defaultMessage: 'App language',
    description:
      'The accessible name of the select that chooses which language the framed app runs in. This is the APP’s language, not this site’s, which is in the settings dialog. The bar carries no labels above its fields.',
  },
  languageShipped: {
    id: 'frame.language.shipped',
    defaultMessage: 'As it ships',
    description:
      'The one option of the app-language select that is a word rather than a locale code: leave the app in the language it ships, which is what an address naming no language asks for.',
  },
  channel: {
    id: 'frame.channel',
    defaultMessage: 'Channel',
    description:
      'The accessible name of the select that chooses which build the framed app pretends to be: the preview, which reaches features marked vorschau, or the release, which a store build is and which reaches only what is on. The bar carries no labels above its fields.',
  },
  channelPreview: {
    id: 'frame.channel.preview',
    defaultMessage: 'Preview build',
    description:
      'An option of the channel select: the build this site frames by default, which reaches features that are on and features that are in preview.',
  },
  channelRelease: {
    id: 'frame.channel.release',
    defaultMessage: 'Release build',
    description:
      'An option of the channel select: what a store build shows, which reaches only features that are on. Choosing it reloads the frame.',
  },
  zoom: {
    id: 'frame.zoom',
    defaultMessage: 'Zoom',
    description: 'The accessible name of the select that scales the frame.',
  },
  zoomFit: {
    id: 'frame.zoom.fit',
    defaultMessage: 'Fit',
    description:
      'The one option of the zoom select that is a word rather than a percentage: scale the frame to whatever room the stage has.',
  },
  route: {
    id: 'frame.route',
    defaultMessage: 'Route',
    description: 'The accessible name of the field the app’s address is typed into.',
  },
  reload: {
    id: 'frame.reload',
    defaultMessage: 'Reload the frame',
    description:
      'Both the reload button’s accessible name and its tooltip, on the preview’s own bar. The frame there holds a whole route of the app. components.detail.reload is the same words on a single component’s page, where the frame holds the gallery.',
  },
  raw: {
    id: 'frame.raw',
    defaultMessage: 'Open the app on its own, without the frame',
    description:
      'The accessible name of the button that leaves this site for the app itself. frame.raw.tip is the shorter tooltip beside it.',
  },
  rawTip: { id: 'frame.raw.tip', defaultMessage: 'Open the app without the frame' },
  rawDevTip: {
    id: 'frame.raw.devTip',
    defaultMessage:
      'Open the app without the frame · a dev server applies no base path, so this lands on the app’s 404',
  },
  copyLink: {
    id: 'frame.copyLink',
    defaultMessage: 'Copy this view as a link',
    description: 'Both the copy button’s accessible name and its tooltip.',
  },
  copied: {
    id: 'frame.copied',
    defaultMessage: 'Copied',
    description:
      'Announced in a live region for a second and a half after the address has been copied. Read aloud and never seen.',
  },
});

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

/**
 * The scales the frame offers.
 *
 * Three of them are a number and read the same in every language. `fit` is a word, so
 * it carries no label of its own here and `COPY.zoomFit` says it where the option is
 * drawn; a literal left in this table would be an English string nothing renders.
 */
const ZOOMS: { value: string; label: string | null }[] = [
  { value: '0.5', label: '50%' },
  { value: '0.75', label: '75%' },
  { value: '1', label: '100%' },
  { value: 'fit', label: null },
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
 * control, and language, zoom, reload and "open without the frame" fold behind
 * one `MoreHorizontal` button — `moreOpen` picks between that button and the
 * group it stands for, never both. Nothing here is deleted: a press reaches
 * everything the wider bar shows inline, one press further in. `sm:` and up
 * is unchanged, because a tablet or a desktop window already had the room
 * these controls asked for.
 *
 * **And again, further up, because "one row" is a rule and not a note.** The
 * header stopped wrapping in `ui/header-row.tsx`, which meant this bar had to
 * take its share of the shortfall before anything was clipped: at 1280, 1600
 * and 2000 CSS pixels alike the header broke into three rows, and this bar is
 * two thirds of what it carries. So the same fold runs on `density` as well as on
 * the media query, and the four tiers are that file's table. The route field is
 * the one control that gives up its width without being touched — its width is a
 * choice and every other control's is a meaning — which is why it is `flex-1`
 * with a `min-w-0` and not one of the things folded.
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
  const intl = useWorkbenchIntl();
  const size = frameSize(state);
  // Left shut until asked, and not reset when the frame's own state changes —
  // it is a fact about what this bar is showing, not about the frame.
  const [moreOpen, setMoreOpen] = useState(false);
  /**
   * How much room the header has given up, which is this bar's share of it. The
   * fold below runs on this as well as on the media query, because the header is
   * one row at every width now and this bar is most of what it carries.
   */
  const density = useHeaderDensity();
  /** The same fold the small breakpoint asks for, at the header's tiers. */
  const fold = moreOpen || density >= 1;
  /**
   * `hidden` and not `max-sm:hidden` once the HEADER is what is folding the group,
   * because the header's tiers are a measurement rather than a breakpoint: there is
   * no width at which `max-sm` becomes true, so the controls stayed on the bar at
   * 1280 and 1600 with everything else already given up around them.
   */
  const FOLDED = fold ? 'hidden' : 'max-sm:hidden';
  /** Tier 3: one icon for the orientation, and a narrower device select. */
  const tight = density >= 3;
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
      className="flex min-w-0 flex-1 flex-nowrap items-center gap-2xs"
      role="toolbar"
      aria-label={intl.formatMessage(COPY.toolbar)}
    >
      {/*
        The layout, first because it decides what everything after it shows: the frame draws
        this layout whole and the tools edit it (ADR 0080 §1). In the address as `ly`, so a
        link opens on the layout it was made on.
      */}
      <Select
        className="max-w-[6rem] shrink-0 sm:max-w-[8rem]"
        aria-label={intl.formatMessage(COPY.layout)}
        value={state.layout}
        // The route goes back to the start: a screen of the layout left behind is an address
        // the new one may not have, and the app answers it with its not-found page.
        onValueChange={(layout) => onChange({ layout, route: '/' })}
        options={layoutIds().map((id) => ({
          value: id,
          label: LAYOUT_NAMES[id] === undefined ? id : say(intl, LAYOUT_NAMES[id]),
          badge: LAYOUT_NAMES[id] === undefined ? undefined : id,
        }))}
      />

      <Select
        className={cn(
          'shrink-0 max-w-[7rem] sm:max-w-[13rem]',
          // Tier 3, and the closed control only: the options in the dropdown are
          // the same list at every width, so narrowing this hides characters of a
          // device name rather than a device.
          tight && 'sm:max-w-[9rem]',
        )}
        aria-label={intl.formatMessage(COPY.device)}
        value={state.device}
        onValueChange={(device) =>
          onChange({
            device,
            landscape: false,
            // Carry the size over into `custom`, so picking it keeps what is on
            // screen. Not from `host`, whose `frameSize` is zero by design: the
            // stage measures that one, and spreading it collapsed the frame to
            // 0 × 0 with no way back but a reload.
            ...(device === 'custom' && !host ? size : {}),
          })
        }
        options={DEVICES.map((d) => ({ value: d.id, label: deviceOption(intl, d) }))}
      />

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
            aria-label={intl.formatMessage(COPY.width)}
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
            aria-label={intl.formatMessage(COPY.height)}
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
              aria-label={intl.formatMessage(state.timeline ? COPY.dayHide : COPY.dayShow)}
              onClick={() => onChange({ timeline: !state.timeline })}
            >
              <CalendarClock aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {intl.formatMessage(state.timeline ? COPY.dayHideTip : COPY.dayShow)}
          </TooltipContent>
        </Tooltip>
      )}

      {!host && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn('shrink-0 sm:hidden', tight && 'sm:block')}
              aria-label={intl.formatMessage(landscape ? COPY.toPortrait : COPY.toLandscape)}
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
            {intl.formatMessage(landscape ? COPY.landscapeTip : COPY.portraitTip)}
          </TooltipContent>
        </Tooltip>
      )}

      {!host && (
        <Segmented
          name="orientation"
          legend={intl.formatMessage(COPY.orientation)}
          className={cn('hidden shrink-0 sm:block', tight && 'lg:hidden')}
          value={landscape ? 'landscape' : 'portrait'}
          options={[
            { value: 'portrait', label: intl.formatMessage(COPY.portrait) },
            { value: 'landscape', label: intl.formatMessage(COPY.landscape) },
          ]}
          // A radio group fires only when the value actually changes, so the one
          // thing ever being asked for here is the other way round.
          onChange={() => onChange({ landscape: !state.landscape })}
        />
      )}

      {/*
        Below `sm`, and at every header tier above zero, one button that opens
        and shuts the group beneath it — itself never hidden there, so folding
        the group away always leaves a way back. `fold` picks exactly one of
        `max-sm:hidden` (on each of the items past this one) and no override at
        all, never both, so there is nothing for an importance modifier to win
        against. At `sm` and up with nothing folded the state is ignored: the
        group shows and this button does not.
      */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={moreOpen || density >= 1}
            className={cn('shrink-0 sm:hidden', density >= 1 && 'sm:block')}
            aria-label={intl.formatMessage(COPY.more)}
            onClick={() => setMoreOpen((open) => !open)}
          >
            {moreOpen ? <X aria-hidden="true" /> : <MoreHorizontal aria-hidden="true" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {intl.formatMessage(moreOpen ? COPY.moreFold : COPY.moreTip)}
        </TooltipContent>
      </Tooltip>

      {/*
        The app's own language, which is a way of looking at the app rather than a
        setting of this site — ADR 0050 §4 puts the reader's language in storage and the
        framed app's in the address, beside the appearance.

        Here rather than in the Appearance panel because, unlike the theme, it needs no
        dev handle: the theme travels as a dispatch and the published export has nothing
        to dispatch to, while this one is a key in storage that any build reads when it
        boots. A control that could work has no business being disabled.

        Not hidden at the host's own size either, which the zoom and the orientation are:
        those two are about a frame there is not one of, and a language is about the app.
      */}
      <Select
        className={cn('shrink-0', FOLDED)}
        aria-label={intl.formatMessage(COPY.language)}
        value={state.lang ?? ''}
        onValueChange={(lang) => onChange({ lang: isLocale(lang) ? lang : null })}
        /*
          The two values are locale codes and are not translated, which is the exemption
          `ZOOMS` above takes for `50%` and `preview/routes.ts` takes for the app's own
          screen names. `de` is what the address carries, what the catalogue directory is
          called and what `<html lang>` says; a "German" here would be this site renaming
          an identifier, and a German reader offered "Englisch" has been answered in the
          language they are trying to leave (`ui/Settings.tsx` makes the same point about
          its own picker).
        */
        options={[
          { value: '', label: intl.formatMessage(COPY.languageShipped) },
          ...LOCALES.map((code) => ({ value: code, label: code })),
        ]}
      />

      <Select
        className={cn('shrink-0', FOLDED)}
        aria-label={intl.formatMessage(COPY.channel)}
        value={state.channel ?? ''}
        onValueChange={(channel) => onChange({ channel: isFrameChannel(channel) ? channel : null })}
        options={[
          { value: '', label: intl.formatMessage(COPY.channelPreview) },
          { value: 'release', label: intl.formatMessage(COPY.channelRelease) },
        ]}
      />

      {!host && (
        <Select
          className={cn('shrink-0', FOLDED)}
          aria-label={intl.formatMessage(COPY.zoom)}
          value={String(state.zoom)}
          onValueChange={(zoom) => onChange({ zoom: zoom === 'fit' ? 'fit' : Number(zoom) })}
          options={ZOOMS.map((z) => ({
            value: String(z.value),
            label: z.label ?? intl.formatMessage(COPY.zoomFit),
          }))}
        />
      )}

      <Pages onPick={(route) => onChange({ route })} />

      <input
        className={cn(FIELD, 'min-w-[5.5rem] flex-1 font-mono sm:min-w-[8rem]')}
        type="text"
        list="routes"
        aria-label={intl.formatMessage(COPY.route)}
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

      <Separator orientation="vertical" className={cn('h-[1.5rem]', FOLDED)} />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(FOLDED)}
            aria-label={intl.formatMessage(COPY.reload)}
            onClick={onReload}
          >
            <RotateCw aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{intl.formatMessage(COPY.reload)}</TooltipContent>
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
            className={cn(FOLDED)}
            aria-label={intl.formatMessage(COPY.raw)}
            onClick={onRaw}
          >
            <ExternalLink aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {intl.formatMessage(status.handle ? COPY.rawDevTip : COPY.rawTip)}
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
  const intl = useWorkbenchIntl();
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
            aria-label={intl.formatMessage(COPY.copyLink)}
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
        <TooltipContent side="top">{intl.formatMessage(COPY.copyLink)}</TooltipContent>
      </Tooltip>
      {/* `output`, not a span with `role="status"`: same live region, and the
          element the linter and the platform both name for it. */}
      <output className="sr-only">{copied ? intl.formatMessage(COPY.copied) : ''}</output>
    </span>
  );
}
