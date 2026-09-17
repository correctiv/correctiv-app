import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  MINUTES_IN_DAY,
  type HomeLayout,
  type HomeSection,
  type MinuteOfDay,
} from '@correctiv/app-core/lib/home-layout';
import { HOME_PINS } from '@correctiv/app-core/data/home-pins';

import { SOURCES } from '../../../content/sources.manifest';
import { AppHost } from '../../components/AppHost';
import { cn } from '../../lib/cn';
import { Badge } from '../../ui/kit/badge';
import { Button } from '../../ui/kit/button';
import { DEFAULT_DEVICE, preset } from '../devices';
import { timeOf } from './clock';
import { frameSize, type PreviewState } from '../state';
import { HomeBlock } from './HomeBlock';
import { minuteFrom, openedAt, parseMinute, STEP } from './minutes';
import {
  changedAt,
  differs,
  effectiveAt,
  formatLayoutDocument,
  formatTimeOfDay,
  inheritedAt,
  moduleLabel,
  moved,
  movedMoment,
  momentAt,
  pointAt,
  settingLabel,
  settingsFor,
  SHIPPED,
  spanOf,
  withHidden,
  withoutMoment,
  withSetting,
  type CountSetting,
  type Point,
  type SettingSpec,
} from './document';
import { getLayout, setLayout, subscribeLayout } from './store';
import { canSave, publish, save, type SaveResult } from './write';

/**
 * The home screen's document, as a day somebody can arrange.
 *
 * One tool, one registration: `shell/views.ts` declares the `home` section, the rail
 * draws its icon (`ui/ToolRail.tsx`) and `pages/Preview.tsx` fills its one slot.
 *
 * ## What it is, since ADR 0039, and what left it in ADR 0042
 *
 * The document is **a day**: the places as the day starts, and moments, each carrying
 * only what changes at it. The panel edits **the point the playhead is in** — the day's
 * start, or the moment currently in effect — and what an edit writes is a difference
 * from the point before it, which is what the document already is.
 *
 * That is the whole of why this replaced four checkboxes per block. The checkboxes could
 * say "this block appears between eleven and two" and nothing else: not a fifth point,
 * not half past six, and not "the same block, a different article in the evening". The
 * day is a sequence of changes, and an editor describing one should be writing changes.
 *
 * **The track itself is not here any more.** ADR 0042 §1 put it under the framed app,
 * because the hour is a fact about what you are looking at rather than an inspection of
 * it, and because twenty-four hours want the full width. `./Timeline.tsx` draws it. What
 * stays here is the half that writes: which point is in effect, what it inherits, what
 * it changes, and the day's blocks. The two read one minute out of one place —
 * `state.time`, which is the address — because two pieces of state for one playhead
 * would disagree in front of somebody, which is what ADR 0042's "What it costs" names.
 *
 * ## The list is the day, the frame is the moment
 *
 * ADR 0045 §1. Every block the document has, in the document's order, each drawn as the
 * app's own component (§3, `./HomeBlock.tsx`); the frame beside it shows the screen at
 * the minute the playhead names. Two different truths, and each says what the other
 * cannot: the frame cannot show what is not on screen at this hour, and a list that
 * repeated the frame would be the worse of two renderings of one fact.
 *
 * A block switched off at the playhead keeps its row and loses its drawing (§2). That is
 * the decision the interview turned on: a list that hid what is off would make "remove"
 * mean *not on the home screen at all* and *not at this hour* with nothing on screen
 * telling the two apart, and it would make a second callout unpickable and so
 * unrepeatable except by adding a third.
 *
 * ## Two things it will not let itself do
 *
 * It never writes a change equal to what the point already inherits — `withHidden` and
 * `withSetting` take one out instead — so a moment's diff is what is different about it.
 * An absent inherited value counts as one: absent means the module's own default, which
 * `home-settings.ts` names and which "The newest investigation (no pin)" below sends back.
 * And it never says a thing on screen that is not true of the frame: the sample-data
 * marking on the article picker is read out of `content/sources.manifest.ts` rather than
 * typed here, so it disappears by itself on the day that row turns live.
 */

/** The dock's ground is `surface`, so a row inside it steps back to `canvas`. */
const CARD = 'rounded-md border border-stroke bg-canvas';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
const CODE = 'rounded-s border border-stroke px-3xs font-mono text-[0.8125rem]';
const FIELD =
  'rounded-s border border-stroke bg-canvas px-3xs py-4xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function HomeDocument({
  state,
  onChange,
  drawing,
  outline,
}: {
  state: PreviewState;
  onChange: (patch: Partial<PreviewState>) => void;
  /**
   * Whether the pictures are drawn, which is whether this tool is the open one.
   *
   * **The panel is mounted whether or not it is on screen**, by ADR 0038 §1 — a tool that
   * unmounted took its slot target with it, and the console's filter reset every time
   * somebody looked at something else. That is right for a tool's state and wrong for a
   * drawing of every block in the document: measured on the dev server, the whole list
   * was in the page on a plain visit to `/preview` with no tool open at all, so the demo
   * audience ADR 0038 §2 protects was mounting and feeding the app's modules a second
   * time beside the frame that already has them.
   *
   * So the panel keeps its state and gives up its pictures. The rows are unchanged when
   * this is false — the day, the order, the marks, the settings — and `HomeBlock` is
   * simply not there, which is the one part of the row nobody can see while the panel is
   * behind the rail.
   */
  drawing: boolean;
  /** Outlines the section's element in the frame, or clears the outline on `null`. */
  outline: (id: string | null) => void;
}) {
  const layout = useSyncExternalStore(subscribeLayout, getLayout, getLayout);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [copied, setCopied] = useState(false);

  /*
   * The same minute the track under the frame is drawing, out of the same two places:
   * the address while a time is simulated, and `openedAt()` while it is not.
   * `minuteFrom` is what keeps the two readings one rule.
   */
  const minute = minuteFrom(state.time, openedAt());
  const point = pointAt(layout, minute);
  const moment = momentAt(layout, point);
  const span = spanOf(layout, point);

  /*
   * The width a block draws at, which is the device the frame is set to — ADR 0045 §3:
   * what is in the list should be the size it is on the phone. `host` has no preset and
   * reports zero, and the default device's width is the honest stand-in, because it is
   * the width this tool opens at and the one number here that is already a fact
   * somewhere else.
   */
  const deviceWidth = frameSize(state).w || preset(DEFAULT_DEVICE).w;

  /*
   * Once, on arrival: a stored document that is now identical to the shipped one is a
   * key nobody can see and nobody clears, and `publish` takes it away. It is the state
   * every successful save leaves behind, because saving is what makes the two the same
   * — the file changes, Vite reloads the page, and the override is then a copy of it.
   */
  useEffect(() => publish(getLayout()), []);

  /*
   * A save message is about the document that was saved, so it goes when the document
   * moves on — whoever moved it. Keyed on the layout rather than cleared inside `edit`
   * below, because the track under the frame writes the document too since ADR 0042 §3,
   * and a "saved" line left standing over a document that has changed since is a claim
   * this panel would be making about a file it no longer matches. Neither `save` nor
   * `publish` replaces the layout, so this never clears its own result.
   */
  useEffect(() => {
    setResult(null);
    setCopied(false);
  }, [layout]);

  const goTo = (next: MinuteOfDay) => onChange({ time: timeOf(next) });

  const effective = effectiveAt(layout, point);
  const inherited = inheritedAt(layout, point);
  const edited = changedAt(layout, minute);
  const dirty = differs(layout);

  return (
    <>
      <p className={NOTE}>
        The home screen as a day. The track under the frame is midnight to midnight, and each stop
        on it is a moment the document names; a moment carries only what changes at it. The list
        below is the whole day in the document’s order. The frame is one minute of it.
      </p>

      <PointHead
        layout={layout}
        point={point}
        span={span}
        changes={moment?.changes.length ?? 0}
        onMove={(to) => {
          if (point === null) return;
          setLayout(movedMoment(layout, point, to));
          goTo(to);
        }}
        onRemove={() => {
          if (point === null) return;
          setLayout(withoutMoment(layout, point));
        }}
      />

      {/*
        One environment around the whole list, not one per row. `AppEnvironment` mounts a
        store provider, an intl provider, a safe-area provider and a gesture root, and one
        per row would be one of each per row; `components/AppHost.tsx` says the rest.
      */}
      <AppHost>
        <ol className="flex flex-col gap-3xs">
          {layout.sections.map((section, index) => (
            <Row
              key={section.id}
              section={effective.find((held) => held.id === section.id) ?? section}
              inherited={inherited.find((held) => held.id === section.id) ?? section}
              point={point}
              index={index}
              last={index === layout.sections.length - 1}
              changed={edited.includes(section.id)}
              deviceWidth={drawing ? deviceWidth : null}
              onMove={(delta) => setLayout(moved(layout, section.id, delta))}
              onHidden={(hidden) => setLayout(withHidden(layout, point, section.id, hidden))}
              onSetting={(key, value) =>
                setLayout(withSetting(layout, point, section.id, key, value))
              }
              outline={outline}
            />
          ))}
        </ol>
      </AppHost>

      <div className="flex flex-wrap items-center gap-xs">
        {/*
          `mr-auto` rather than a neighbouring spot next to Save: the two are not a
          matched pair. This one throws work away, Save writes the repository, and an
          outline button beside a filled one at the same size still reads as "pick
          either" unless something else keeps them apart.
        */}
        <Button
          variant="outline"
          size="sm"
          className="mr-auto"
          disabled={!dirty}
          onClick={() => setLayout(SHIPPED)}
        >
          <RotateCcw aria-hidden="true" />
          Back to the file
        </Button>

        {canSave ? (
          <Button size="sm" disabled={!dirty} onClick={() => void save(layout).then(setResult)}>
            <Save aria-hidden="true" />
            Save to the repository
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(formatLayoutDocument(layout));
              setCopied(true);
            }}
          >
            <Copy aria-hidden="true" />
            Copy the document
          </Button>
        )}

        <span className={NOTE}>{dirty ? 'changed' : 'unchanged'}</span>
      </div>

      {/*
        The difference between the two Saves is said here rather than discovered by
        pressing one. `canSave` is `import.meta.env.DEV`, so this is the published site
        telling the truth about itself, which is the shape the Tokens tool already has.
      */}
      <p className={NOTE}>
        {canSave ? (
          <>
            Save writes <code className={CODE}>packages/app-core/src/data/home.layout.json</code>{' '}
            through the dev server, which refuses anything the core will not parse. The next step is
            a pull request rather than a write, the way the sources job already does it (ADR 0036
            §15).
          </>
        ) : (
          <>
            This is the published site, so there is no server to write with and nothing here reaches
            the repository. Copy the document and put it in{' '}
            <code className={CODE}>packages/app-core/src/data/home.layout.json</code>, or open{' '}
            <code className={CODE}>/preview</code> on a dev server, where Save is offered.
          </>
        )}
      </p>

      {copied && (
        <p className="flex items-center gap-xs text-s text-on-canvas">
          <Check aria-hidden="true" className="size-[0.875rem] shrink-0" />
          Copied.
        </p>
      )}
      {/*
        A refusal is a red fill with white text, not red text on the canvas. That is what
        the console's `error` badge does two files over, and it is the treatment that
        survives the scheme flipping.
      */}
      {result && (
        <p className="flex items-start gap-xs text-s text-on-canvas">
          {result.ok ? (
            <Check aria-hidden="true" className="mt-4xs size-[0.875rem] shrink-0" />
          ) : (
            <span className="shrink-0 rounded-s bg-red-500 px-3xs font-mono text-[0.75rem] font-semibold uppercase text-white">
              refused
            </span>
          )}
          <span className="min-w-0">{result.message}</span>
        </p>
      )}
    </>
  );
}

/**
 * Which point is being edited, how long it lasts, and what can be done to it.
 *
 * The day's start is not a moment and the head says so rather than dressing it up as
 * one: it cannot be moved, because there is nothing before midnight for it to inherit
 * from, and it cannot be removed, because it is the document.
 */
function PointHead({
  layout,
  point,
  span,
  changes,
  onMove,
  onRemove,
}: {
  layout: HomeLayout;
  point: Point;
  span: { from: number; to: number };
  changes: number;
  onMove: (to: MinuteOfDay) => void;
  onRemove: () => void;
}) {
  const until = span.to === MINUTES_IN_DAY ? 'midnight' : formatTimeOfDay(span.to);

  return (
    <div className={cn(CARD, 'flex flex-wrap items-center gap-xs p-xs')}>
      {point === null ? (
        <>
          <span className="text-m font-semibold text-on-canvas">The day’s start</span>
          <span className={NOTE}>
            The document as it stands, in effect from midnight until {until}. Every moment inherits
            from it.
          </span>
        </>
      ) : (
        <>
          <label className="flex items-center gap-2xs">
            <span className="sr-only">The time of this moment</span>
            <input
              type="time"
              step={STEP * 60}
              value={formatTimeOfDay(point)}
              onChange={(event) => {
                const next = parseMinute(event.target.value);
                if (next !== null) onMove(next);
              }}
              className={cn(FIELD, 'font-mono text-m font-semibold')}
            />
          </label>
          <span className={NOTE}>
            until {until} · {changes === 0 ? 'nothing changes here yet' : `${changes} changed here`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-[2rem]"
            aria-label={`Remove the moment at ${formatTimeOfDay(point)}`}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </>
      )}
      {point === null && layout.moments.length === 0 && (
        <span className={cn(NOTE, 'w-full')}>
          This document has no moments, so the home screen is the same at every hour.
        </span>
      )}
    </div>
  );
}

/**
 * One place, in the state it is in at the point being edited.
 *
 * Every control says whether what it shows is **inherited** or **set here**, because
 * that is the one question the model asks of a person and a control that hid it would
 * make the panel a set of independent forms again. Setting a control back to what it
 * inherits takes the change out of the document, so there is no separate revert to
 * press and no way to leave a change behind that says nothing.
 */
function Row({
  section,
  inherited,
  point,
  index,
  last,
  changed: isChanged,
  deviceWidth,
  onMove,
  onHidden,
  onSetting,
  outline,
}: {
  section: HomeSection;
  inherited: HomeSection;
  point: Point;
  index: number;
  last: boolean;
  changed: boolean;
  /**
   * The width the drawing is at, which is the device's, or `null` for no drawing at all.
   *
   * One value rather than a width and a flag, because "how wide" and "whether" are one
   * question here: there is no width at which a block is drawn and no drawing, and no
   * drawing that has no width. `HomeBlock.tsx` says what the width is for.
   */
  deviceWidth: number | null;
  onMove: (delta: -1 | 1) => void;
  onHidden: (hidden: boolean) => void;
  onSetting: (key: string, value: string | number | null | undefined) => void;
  outline: (id: string | null) => void;
}) {
  const { name, what } = moduleLabel(section.module);
  const off = Boolean(section.hidden);
  const specs = settingsFor(section.module);
  const hiddenHere = point !== null && Boolean(inherited.hidden) !== off;

  return (
    // Nothing below makes the row operable; the handlers only relay whether the
    // pointer or the focus is somewhere inside it, and every control a person can
    // act on is one of its own buttons, checkboxes and labels.
    //
    // `outline` is called with `section.id` whether or not `off` is true, and this row
    // does not check it first. A moment can hide a place at the point being previewed —
    // `off` is exactly that fact — and the deliberate choice is to let the lookup in
    // `frame/highlight.ts` discover the absence itself: it finds no matching element and
    // clears whatever mark was there, which is the same quiet nothing a mistyped id or an
    // unrendered module would produce. The `off` badge below already tells a person the
    // row is not on screen; the outline does not need to say it twice, and a row cannot
    // drift out of sync with a mechanism it does no filtering of its own.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <li
      className={cn(CARD, 'flex flex-col gap-2xs p-xs', isChanged && 'border-accent')}
      onPointerEnter={() => outline(section.id)}
      onPointerLeave={() => outline(null)}
      onFocus={() => outline(section.id)}
      onBlur={() => outline(null)}
    >
      <div className="flex min-w-0 items-start gap-xs">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2xs">
            <span
              className={cn(
                'text-m font-semibold',
                off ? 'text-on-canvas-muted' : 'text-on-canvas',
              )}
            >
              {name}
            </span>
            {off && <Badge variant="outline">off</Badge>}
            {isChanged && <Badge>changed</Badge>}
          </div>
          <div className={NOTE}>{what}</div>
        </div>

        <div className="flex shrink-0 items-center gap-4xs">
          {/*
            ADR 0045 §5: this was a checkbox labelled "Shown", under the name, with a
            badge beside it saying the value was set here. What the checkbox had to do
            was tell a person the block was off, and the collapsed row does that now
            without a word — so what is left is the switching, which is an act rather
            than a field, and an act is a button.

            The two verbs live at two levels and §5 is where the pair is argued. On and
            off are a MOMENT'S: they change what a block is doing at an hour, and they
            are here. Add and remove are the DAY'S: they change which blocks exist at
            all, and they are ADR 0045 §4 and §6, which are not built. When they are,
            §5's "the switch is the same control a person already used to put the block
            there" is the sentence this button has to answer to, and it may well stop
            being a button of its own.
          */}
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={!off}
            className={cn('size-[2rem]', hiddenHere && 'text-accent')}
            aria-label={
              off
                ? `Switch ${name} on ${point === null ? 'from the start of the day' : `at ${formatTimeOfDay(point)}`}`
                : `Switch ${name} off ${point === null ? 'from the start of the day' : `at ${formatTimeOfDay(point)}`}`
            }
            onClick={() => onHidden(!off)}
          >
            {off ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-[2rem]"
            disabled={index === 0}
            aria-label={`Move ${name} up`}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-[2rem]"
            disabled={last}
            aria-label={`Move ${name} down`}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        {hiddenHere && <Here />}
        <code className={cn(CODE, 'ml-auto text-on-canvas-muted')}>{section.id}</code>
      </div>

      {/*
        ADR 0045 §3, and §2 is the `off` branch. A block that is not on screen at the
        playhead keeps its row and loses its picture — the whole day stays visible and
        every block stays addressable, and only the drawing is spent on what is showing.
        The sentence is drawn rather than nothing at all, because an empty gap would read
        as a block with nothing in it rather than one that is switched off.

        `deviceWidth` being null is the third case and it is not one a reader ever sees:
        the panel is mounted behind the rail whether or not it is open, and nothing is
        drawn while it is shut.
      */}
      {deviceWidth !== null &&
        (off ? (
          <p className={cn(NOTE, 'rounded-s border border-dashed border-stroke px-2xs py-3xs')}>
            Not on screen{' '}
            {point === null ? 'at the start of the day' : `at ${formatTimeOfDay(point)}`}.
          </p>
        ) : (
          <div className="overflow-hidden rounded-s border border-stroke">
            <HomeBlock section={section} deviceWidth={deviceWidth} />
          </div>
        ))}

      {specs.map((spec) => (
        <Setting
          key={spec.key}
          module={section.module}
          spec={spec}
          value={section.settings?.[spec.key]}
          inherited={inherited.settings?.[spec.key]}
          point={point}
          disabled={off}
          onSet={(value) => onSetting(spec.key, value)}
        />
      ))}
    </li>
  );
}

/** The mark that says a value is this moment's rather than something it was handed. */
function Here() {
  return (
    <span className="rounded-s bg-accent px-3xs py-4xs text-[0.6875rem] font-semibold uppercase text-white">
      set here
    </span>
  );
}

/**
 * The sources manifest's row for the pin list, which is where its marking comes from.
 *
 * `SOURCES.md` and this manifest are how this repository already tells a live source
 * from a stand-in, and the rule it enforces is that a sample row names what it stands in
 * for. So the picker reads the row rather than carrying a sentence of its own: the day
 * WordPress answers "what may lead the app today" the row turns `live`, and the marking
 * goes with it without anybody remembering this file.
 */
const PIN_SOURCE = SOURCES.find((entry) => entry.id === 'home-pins');

/** One setting, with the control its kind asks for. */
function Setting({
  module,
  spec,
  value,
  inherited,
  point,
  disabled,
  onSet,
}: {
  module: string;
  spec: SettingSpec;
  value: unknown;
  inherited: unknown;
  point: Point;
  disabled: boolean;
  onSet: (value: string | number | null | undefined) => void;
}) {
  const { name, what } = settingLabel(module, spec);
  const setHere = point !== null && value !== inherited;

  return (
    <div
      className={cn(
        'flex flex-col gap-4xs border-t border-stroke pt-2xs',
        disabled && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-2xs">
        <span className="text-s font-medium text-on-canvas">{name}</span>
        {setHere && <Here />}
        <span className={cn(NOTE, 'ml-auto')}>{what}</span>
      </div>

      {spec.kind === 'count' ? (
        <Count spec={spec} value={value} disabled={disabled} label={name} onSet={onSet} />
      ) : (
        <>
          <select
            disabled={disabled}
            aria-label={name}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onSet(event.target.value === '' ? null : event.target.value)}
            className={cn(FIELD, 'w-full')}
          >
            <option value="">The newest investigation (no pin)</option>
            {HOME_PINS.map((item) => (
              <option key={item.url} value={item.url}>
                {item.title}
              </option>
            ))}
          </select>
          {PIN_SOURCE?.status === 'sample' && (
            <span className={NOTE}>
              <Badge variant="outline">sample data</Badge> These are{' '}
              <code className={CODE}>packages/app-core/src/data/home-pins.ts</code>, standing in for{' '}
              {PIN_SOURCE.standsIn}. Real articles, a fixed list, not today’s.
            </span>
          )}
        </>
      )}
    </div>
  );
}

/**
 * A whole number of items, as a slider with its ends and its value on show.
 *
 * ADR 0045 §8. It was a number field, and a number field hides the two facts the spec
 * already carries: typing a value past the cap did nothing at all, because the handler
 * returned without setting anything and without saying so, and nothing on screen said
 * what the cap was. A range input cannot be out of bounds, carries its ends visibly, and
 * is operable and announced from the keyboard without anything being added to it.
 *
 * The value is drawn beside the track rather than read off it, because a slider's
 * position is an estimate and "eight fact checks" is the thing being chosen. `min` and
 * `max` are drawn at the ends for the same reason they are in the declaration: they are
 * what the module can actually draw, and a person moving the handle to the end should
 * see that the end is the module's limit rather than the tool's.
 *
 * The value is boxed and the ends are not, which is the difference between them doing
 * some work: three bare numerals in a row read as one run — `1 … 12 8` was on screen and
 * the last two of them could be a range. The box is `CODE`'s, so the border and the
 * radius are the ones this panel already uses for the module's own name.
 *
 * `onSet` fires on every step of a drag, which is what makes the frame follow the handle.
 * `document.ts` is what keeps that from filling the document with noise: a value equal to
 * what the point already inherits takes the change out again rather than writing it.
 */
function Count({
  spec,
  value,
  disabled,
  label,
  onSet,
}: {
  spec: CountSetting;
  value: unknown;
  disabled: boolean;
  label: string;
  onSet: (value: number) => void;
}) {
  const held = typeof value === 'number' ? value : spec.fallback;

  return (
    <div className="flex items-center gap-2xs">
      <span className={cn(NOTE, 'tabular-nums')}>{spec.min}</span>
      <input
        type="range"
        min={spec.min}
        max={spec.max}
        step={1}
        disabled={disabled}
        value={held}
        aria-label={label}
        onChange={(event) => onSet(Number(event.target.value))}
        className="h-[1.25rem] min-w-0 flex-1 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <span className={cn(NOTE, 'tabular-nums')}>{spec.max}</span>
      <span
        className={cn(
          CODE,
          'min-w-[2.5ch] py-4xs text-center text-s font-medium tabular-nums text-on-canvas',
        )}
      >
        {held}
      </span>
    </div>
  );
}
