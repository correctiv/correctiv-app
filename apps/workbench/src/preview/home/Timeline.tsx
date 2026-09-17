import { Plus } from 'lucide-react';
import { useRef, useSyncExternalStore } from 'react';

import { MINUTES_IN_DAY, type MinuteOfDay } from '@correctiv/app-core/lib/home-layout';

import { cn } from '../../lib/cn';
import { Button } from '../../ui/kit/button';
import type { PreviewState } from '../state';
import { timeOf } from './clock';
import { formatTimeOfDay, momentAt, movedMoment, pointAt, withMoment } from './document';
import { minuteFrom, openedAt, parseMinute, percent, snap, STEP } from './minutes';
import { getLayout, setLayout, subscribeLayout } from './store';

/** The hours that carry a number. Every three, because every one of them did not fit. */
const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

/**
 * The day, under the framed app.
 *
 * [ADR 0042](../../../../../adr/0042-the-timeline-belongs-to-the-stage.md) §1: this is
 * not a tool. The controls above the frame say what you are looking at — which device,
 * which way up, which route — and the hour is that kind of fact, not an inspection of
 * what is on the stage. So it sits with them, below the frame rather than behind the
 * rail, and somebody showing another person the home screen in the evening does not have
 * to find a tool first.
 *
 * ## Looking and writing, and where the line falls
 *
 * §3: looking never changes anything. With the home tool shut, the track moves the
 * playhead and jumps between the moments the document already names, and that is all —
 * which is enough for the demo, the screenshot and the argument about whether the evening
 * reads well. It is also exactly what `apps/mobile/src/lib/home/clock.ts` already says
 * about its own key: the simulated hour selects between states the document describes and
 * cannot introduce one.
 *
 * With the tool open, `editing` is true and two things are added: a stop can be dragged,
 * and the playhead's minute can be made a moment. Both are writes, and both are here
 * rather than in the panel because a track is where they are done — you cannot drag a
 * stop that is on another screen. Removing a moment stays in the panel, because removing
 * names *which* point, and naming the point is what the panel's head is for.
 *
 * A moment is never created as a side effect of a drag. ADR 0039 §10 decided that while
 * the track was still in the panel, and putting the track where everybody will touch it
 * makes that argument stronger rather than weaker.
 *
 * ## One minute, two drawings
 *
 * The playhead's minute is `state.time`, which is the address (`tm=18:30`), and the
 * panel's head reads the same value out of the same place. ADR 0042's "What it costs"
 * names this as the thing that must not become two pieces of state, because two of them
 * would disagree in front of somebody. The document is read the same way, straight out of
 * `./store.ts` rather than handed down from the page, because the page does not have it.
 */
export function Timeline({
  state,
  onChange,
  editing,
  compact,
}: {
  state: PreviewState;
  onChange: (patch: Partial<PreviewState>) => void;
  /** Whether the home tool is open, which is what §3 makes the writes conditional on. */
  editing: boolean;
  /**
   * §4, and it is only ever about the labels.
   *
   * "The labels are what does not fit; the track itself is one-dimensional and fits
   * anywhere" — so below 1024 the hours lose their numbers, the stops lose their times,
   * the track loses the height it was carrying them in, and **nothing else goes**. The
   * time is named in §4's own list of what the folded row still has, and Live is how a
   * simulated hour is given back; a row that dropped either would be one a narrow window
   * cannot get out of.
   *
   * A prop rather than an `lg:` variant, because the same judgement decides the track's
   * height, the hour numbers and the stop labels, and three spellings of it is three
   * places for it to part company with itself. The page decides, out of the same `WIDE`
   * the chrome already uses.
   */
  compact: boolean;
}) {
  const layout = useSyncExternalStore(subscribeLayout, getLayout, getLayout);

  /*
   * The machine's own clock, so the track can mark it and the app can be put back on it.
   * `openedAt()` and not a `useState` of its own: the panel folds the document at the
   * same minute, and `./minutes.ts` says what two reads of the clock would cost.
   */
  const realMinute = openedAt();

  const simulated = state.time !== null;
  const minute = minuteFrom(state.time, realMinute);
  const point = pointAt(layout, minute);

  const goTo = (next: MinuteOfDay) => onChange({ time: timeOf(next) });

  /*
   * The two writes §3 allows, each refusing itself while the tool is shut.
   *
   * The markup below already withholds the button, and the track below already withholds
   * the drag, so these guards look redundant and are not: a cold review measured what the
   * check on them was worth, and a rendered condition is the thing somebody edits. The
   * guard is in the write, where the rule is, and the markup decides only what is offered.
   *
   * `getLayout()` rather than the `layout` above, because a drag writes many times
   * between two renders: the closed-over document would be the one the drag started on,
   * so every step after the first would move the moment back from where the last put it.
   */
  const moveMoment = (from: MinuteOfDay, to: MinuteOfDay) => {
    if (!editing) return;
    setLayout(movedMoment(getLayout(), from, to));
  };

  const addPoint = () => {
    if (!editing) return;
    setLayout(withMoment(getLayout(), snap(minute)));
    goTo(snap(minute));
  };

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-xs border-t border-stroke bg-surface',
        compact ? 'px-xs py-3xs' : 'px-s py-2xs',
      )}
    >
      <h2 className="sr-only">The day</h2>

      <Track
        moments={layout.moments}
        minute={minute}
        realMinute={realMinute}
        simulated={simulated}
        point={point}
        labelled={!compact}
        editing={editing}
        onGoTo={goTo}
        onMoveMoment={moveMoment}
      />

      <label className="flex shrink-0 items-center gap-2xs">
        <span className="sr-only">The time the frame is showing</span>
        <input
          type="time"
          step={STEP * 60}
          value={formatTimeOfDay(minute)}
          onChange={(event) => {
            const next = parseMinute(event.target.value);
            if (next !== null) goTo(next);
          }}
          className="rounded-s border border-stroke bg-canvas px-3xs py-4xs font-mono text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>

      {/*
        "Live" is the app's own clock, and it is a different state from "the simulated
        time happens to be now": the first has no `tm` in the address and writes no key,
        the second does both. Saying so with one button that is either pressed or not is
        what keeps this row from claiming a thing the frame is not doing.

        Filled while it has something to do and quiet while it does not, which is the way
        round a disabled control has to be drawn: a filled button that cannot be pressed
        reads as a refusal, and the state it is in — already live — is the unremarkable
        one.
      */}
      <Button
        variant={simulated ? 'default' : 'outline'}
        size="sm"
        aria-pressed={!simulated}
        className="shrink-0"
        disabled={!simulated}
        onClick={() => onChange({ time: null })}
      >
        Live
      </Button>

      {/*
        The writing half of §3, and it is on screen only while the tool is open. Both the
        test and the write are against the SNAPPED minute, because that is where the point
        would land: against the raw one, a playhead typed to 11:02 offers a button that
        then makes nothing, since 11:00 already has a moment.

        The word goes below `sm` and the icon stays, which is what the toolbar above does
        with its own four controls and for the same reason — nothing is deleted on a
        narrow window, it is shown with less of itself. `aria-label` carries the word
        either way, so the button reads the same to a screen reader at every width.
      */}
      {editing && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          aria-label="Make this minute a moment"
          disabled={momentAt(layout, snap(minute)) !== null}
          onClick={addPoint}
        >
          <Plus aria-hidden="true" />
          <span aria-hidden="true" className="max-sm:hidden">
            Point here
          </span>
        </Button>
      )}
    </div>
  );
}

/**
 * The track itself: the hours, the moments on it, the machine's clock, the playhead.
 *
 * A pointer anywhere on it moves the playhead, including a drag, because that is the
 * gesture the whole thing is for — you pull along the day and watch the app change. A
 * pointer on a stop moves the stop instead and stops there, so the two gestures share the
 * surface without either having a mode. With `editing` false a stop only jumps the
 * playhead to itself, which is ADR 0042 §3.
 *
 * It is not the accessible control and does not pretend to be one. The time field beside
 * it is, the stops are buttons that move the playhead by being pressed, and the panel's
 * head has a field of its own for moving a moment — so everything the track does can be
 * done by typing or by tabbing. Giving the `<div>` a slider role and arrow keys as well
 * would have been a third way to say the same thing, and the one nobody tests.
 */
function Track({
  moments,
  minute,
  realMinute,
  simulated,
  point,
  labelled,
  editing,
  onGoTo,
  onMoveMoment,
}: {
  moments: readonly { minute: MinuteOfDay; at: string }[];
  minute: MinuteOfDay;
  realMinute: MinuteOfDay;
  simulated: boolean;
  point: MinuteOfDay | null;
  /** Whether the hours and the moments carry their times, which is what §4 gives up. */
  labelled: boolean;
  editing: boolean;
  onGoTo: (minute: MinuteOfDay) => void;
  onMoveMoment: (from: MinuteOfDay, to: MinuteOfDay) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  /** Which moment a drag is carrying, by the minute it was at when the drag began. */
  const dragging = useRef<MinuteOfDay | null>(null);

  const at = (event: { clientX: number }): MinuteOfDay => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return minute;
    const share = (event.clientX - box.left) / box.width;
    return snap(Math.max(0, Math.min(1, share)) * MINUTES_IN_DAY);
  };

  return (
    <div
      ref={track}
      className={cn(
        'relative min-w-0 flex-1 cursor-pointer select-none rounded-md border border-stroke bg-canvas',
        labelled ? 'h-[3.25rem]' : 'h-[1.5rem]',
      )}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        if (dragging.current === null) onGoTo(at(event));
      }}
      onPointerMove={(event) => {
        if (event.buttons === 0) return;
        const to = at(event);
        const held = dragging.current;
        if (held === null) {
          onGoTo(to);
          return;
        }
        if (to !== held) {
          onMoveMoment(held, to);
          dragging.current = to;
          onGoTo(to);
        }
      }}
      onPointerUp={() => {
        dragging.current = null;
      }}
      onPointerCancel={() => {
        dragging.current = null;
      }}
    >
      {/* The hours, as the only fixed thing on the track. */}
      {HOURS.map((hour) => (
        <div
          key={hour}
          aria-hidden="true"
          className="absolute top-0 flex h-full flex-col justify-end"
          style={{ left: percent(hour * 60), transform: 'translateX(-50%)' }}
        >
          {/*
            Full height where a number anchors it, a short mark where none does. Drawn
            the full height in the folded row, eight equal boxes read as a segmented
            control rather than as a ruler — the ticks stop being marks ON a track and
            become the edges BETWEEN parts of one.
          */}
          <span
            className={cn(
              'absolute left-1/2 w-px bg-stroke',
              labelled ? 'inset-y-0' : 'bottom-0 h-1/3',
            )}
          />
          {labelled && (
            <span className="relative bg-canvas px-4xs text-[0.6875rem] text-on-canvas-muted">
              {String(hour).padStart(2, '0')}
            </span>
          )}
        </div>
      ))}

      {/*
        The machine's clock, drawn even while a simulated time is set, because "what the
        app would be showing if you pressed Live" is the thing a person needs to see next
        to what it is showing now.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 w-px bg-on-canvas-muted/50"
        style={{ left: percent(realMinute) }}
      />

      {/*
        The moments. A filled stop is the one in effect at the playhead, and at full width
        it carries its time — which is the room ADR 0042 §1 moved the track here to get.
      */}
      {moments.map((held) => (
        <div
          key={held.minute}
          className="absolute top-0 flex flex-col items-center"
          style={{ left: percent(held.minute), transform: 'translateX(-50%)' }}
        >
          <button
            type="button"
            aria-label={
              editing
                ? `The moment at ${held.at}, drag to move it`
                : `Go to the moment at ${held.at}`
            }
            className={cn(
              'mt-2xs size-[0.875rem] shrink-0 rounded-full border-2 border-accent',
              editing ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
              held.minute === point ? 'bg-accent' : 'bg-canvas',
              labelled ? '' : 'mt-[0.125rem] size-[0.75rem]',
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (editing) {
                dragging.current = held.minute;
                track.current?.setPointerCapture(event.pointerId);
              }
              onGoTo(held.minute);
            }}
          />
          {labelled && (
            <span
              aria-hidden="true"
              className={cn(
                'mt-4xs rounded-s bg-canvas px-4xs font-mono text-[0.6875rem] leading-none',
                held.minute === point ? 'text-on-canvas' : 'text-on-canvas-muted',
              )}
            >
              {held.at}
            </span>
          )}
        </div>
      ))}

      {/* The playhead, last so it is over everything it points at. */}
      <div
        aria-hidden="true"
        className={cn('absolute inset-y-0 w-[2px]', simulated ? 'bg-accent' : 'bg-on-canvas')}
        style={{ left: percent(minute), transform: 'translateX(-1px)' }}
      >
        <span
          className={cn(
            'absolute -top-4xs left-1/2 size-2xs -translate-x-1/2 rotate-45',
            simulated ? 'bg-accent' : 'bg-on-canvas',
          )}
        />
      </div>
    </div>
  );
}
