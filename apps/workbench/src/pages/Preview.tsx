import { useEffect, useRef } from 'react';

import { Slot } from '../shell/slots';
import { writeAddress, type ShellProps } from '../shell/address';
import { VIEWS } from '../shell/views';
import { defaultFull } from '../preview/devices';
import { toAddress } from '../preview/state';
import { namesFrame } from '../preview/store';
import { usePreview } from '../preview/Preview';
import { governs } from '../preview/home/document';
import { HomeDocument } from '../preview/home/HomeDocument';
import { useScenario } from '../preview/home/Scenario';
import { Timeline } from '../preview/home/Timeline';
import {
  Appearance,
  Console,
  ConsoleMark,
  Inspect,
  Measure,
  MeasureMark,
  State,
  Tokens,
} from '../preview/ui/Panels';
import { Readout } from '../preview/ui/Readout';
import { StringsTool } from '../preview/strings/StringsTool';
import { DraftMarker } from '../preview/ui/DraftMarker';
import { Stage } from '../preview/ui/Stage';
import { LinkBar, Toolbar } from '../preview/ui/Toolbar';

const VIEW = VIEWS.preview;

/**
 * The app itself, at device size, as a view of the shell rather than a shell of
 * its own.
 *
 * This is the route that used to be seven `isApp` branches in `App.tsx`. Its
 * body is the stage; everything else it has — the frame controls, the
 * tools, the two numbers on the rail, the readout and the link — goes into the
 * places the declaration in `shell/views.ts` keeps for it. Most of those tools
 * are `preview/ui/Panels.tsx`; `preview/home/` holds a document of its own
 * rather than a readout, and `preview/strings/` holds a draft of the German.
 *
 * **The two halves of the address meet here and nowhere else.** The shell owns
 * `tool` and `full`; the frame owns `d`, `o`, `z`, `w`, `h`, `t`, `lg`, `s`, `sc`, `tm`,
 * `tl`, `check`, `kl` and `kd`, which travel in `rest` untouched. `preview/store.ts` no longer
 * writes history at all, so a link written before any of this still resolves and
 * writes back byte for byte.
 */
export function Preview({ address, onAddress, wide, full }: ShellProps) {
  const preview = usePreview();
  const { state } = preview;
  /*
   * Here and not in the home tool, because the panel is drawn into a slot that is not
   * always there, and a scenario in a link has to open whether or not anybody opens the
   * tool. `preview/home/Scenario.tsx` has the rest.
   */
  const scenario = useScenario(state, preview.onChange);

  /*
   * The frame's state, back into the address.
   *
   * One direction only, and the other is `preview/store.ts`'s own `hashchange`
   * listener — which only a person editing the address bar or a step through
   * history can reach, because `shell/address.ts` writes with `replaceState` and
   * that fires no event. So there is no loop to guard against: a control moves
   * the state, the state writes the hash, and the hash stays quiet.
   */
  useEffect(() => {
    // Not before the store has read the hash. `usePreview`'s `started` says why in full:
    // the first render holds the defaults, and writing those back is what took the hour
    // out of a link somebody had been sent.
    if (!preview.started) return;
    const { head, rest } = toAddress(state);
    onAddress({ head, rest });
  }, [preview.started, state, onAddress]);

  /*
   * And the chrome out of the way on a small screen, once, on arrival.
   *
   * The same line as the device default (`HOST_BELOW`, 1024, which is also the
   * shell's `WIDE`): below it the header, the rail, a sidebar and a status line
   * are most of the screen, and the app is what somebody opened this address
   * for. A link that named a device or `full` has said what it wants and is not
   * second-guessed.
   */
  const asked = useRef(namesFrame(window.location.hash));
  useEffect(() => {
    if (!asked.current && defaultFull()) onAddress({ full: true });
    // Arrival only. Resizing the window later is not a request to hide anything.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * And a scenario's link opens the home tool, once, on arrival, where the address names no
   * tool of its own. The scenario is a home document, the question it may have to ask
   * about somebody's own changes is asked there, and so is why it cannot be submitted.
   */
  const arrived = useRef(false);
  useEffect(() => {
    if (!preview.started || arrived.current) return;
    arrived.current = true;
    if (state.scenario !== null && address.tool === null) onAddress({ tool: 'home' });
  }, [preview.started, state.scenario, address.tool, onAddress]);

  /*
   * Whether the day is drawn under the frame, which is three questions and they are all
   * asked here because this is the one component that can see all three.
   *
   * ADR 0042 §2: the route the FRAME reports, so the track follows the app rather than
   * a half-typed field. §2 again: the switch in the toolbar puts it away, and that is
   * `state.timeline`. §5: `full` keeps the track above 64rem — because `full` exists so
   * that somebody can look at the app and the track is the control for looking — and
   * gives it up below, on the line the chrome already uses, because at 420 x 860 a line
   * spent here is a line taken back off the app.
   */
  const timeline = state.timeline && governs(preview.status.frameRoute) && (!full || wide);

  const panels = {
    state,
    status: preview.status,
    logs: preview.logs,
    tools: preview.tools,
    onChange: preview.onChange,
    onClearLogs: preview.clearLogs,
  };

  return (
    <>
      {/*
        Above the frame rather than inside `Stage`, which only lays the frame out and
        would otherwise be the one place drawing a fact about two tools it does not
        hold state for. A normal flow element and not an overlay: the frame's own
        `useStage` measures the box it is actually given, so the stage simply gets
        less of it while this is showing, rather than the marker floating over
        content it might obscure.
      */}
      <div className="flex h-full min-h-0 flex-col gap-xs">
        <DraftMarker scenario={scenario} />
        <div className="min-h-0 flex-1">
          <Stage
            state={state}
            size={preview.size}
            scale={preview.scale}
            stageRef={preview.stageRef}
            frameRef={preview.frameRef}
            onResize={preview.onResize}
            onLoad={preview.onLoad}
            timeline={
              timeline ? (
                <Timeline
                  state={state}
                  onChange={preview.onChange}
                  /*
                   * ADR 0042 §3: the tool being open is what adds the two writes. Not a
                   * second switch — "the tool is open" is already the sentence that
                   * separates reading the document from writing it.
                   */
                  editing={address.tool === 'home'}
                  compact={!wide}
                />
              ) : null
            }
          />
        </div>
      </div>

      <Slot id="context-bar">
        <Toolbar
          state={state}
          status={preview.status}
          routeField={preview.routeField}
          onRouteField={preview.setRouteField}
          onChange={preview.onChange}
          onReload={preview.onReload}
          onRaw={preview.onRaw}
        />
      </Slot>

      <Slot id="appearance">
        <Appearance {...panels} />
      </Slot>

      <Slot id="state">
        <State {...panels} />
      </Slot>

      <Slot id="home">
        <HomeDocument
          state={state}
          onChange={preview.onChange}
          /*
           * The slot keeps this mounted whether or not the tool is open (ADR 0038 §1), so
           * "is it on screen" has to be handed in. `HomeDocument` says what it costs not
           * to.
           */
          drawing={address.tool === 'home'}
          outline={preview.outlineSection}
          scenario={scenario}
        />
      </Slot>

      {/* Two marks on the rail, and nothing on the other five. A tool whose
          number is zero, or which has no number, says nothing there. */}
      <Slot id="console:mark">
        <ConsoleMark {...panels} />
      </Slot>
      <Slot id="console">
        <Console {...panels} />
      </Slot>

      <Slot id="tokens">
        <Tokens {...panels} />
      </Slot>

      <Slot id="measure:mark">
        <MeasureMark {...panels} />
      </Slot>
      <Slot id="measure">
        <Measure {...panels} />
      </Slot>

      <Slot id="inspect">
        <Inspect {...panels} />
      </Slot>

      <Slot id="strings">
        <StringsTool
          status={preview.status}
          picking={preview.tools.strings.picking}
          setPicking={preview.tools.strings.setPicking}
          pick={preview.tools.strings.pick}
        />
      </Slot>

      <Slot id="status">
        {/*
          Clipped, not wrapped. The line is one row tall by definition, and a
          readout that ran past the end used to widen the page itself: 120px of
          sideways scroll on a 1440px window, from a status bar.
        */}
        <span className="flex min-w-0 items-center gap-s overflow-hidden">
          <Readout status={preview.status} size={preview.size} scale={preview.scale} />
        </span>
        <span className="min-w-0 flex-1" />
        <LinkBar hash={writeAddress(address, VIEW)} />
      </Slot>
    </>
  );
}
