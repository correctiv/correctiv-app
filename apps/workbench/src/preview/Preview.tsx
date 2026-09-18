import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import type { Locale } from '@correctiv/app-core/stores/settings';

import {
  install,
  NO_FRAME,
  readFrame,
  registerFrame,
  statusOf,
  uninstall,
  type FrameInfo,
} from './api';
import { attachConsole } from './frame/console';
import { applyTheme, BASE, driveRoute, frameRoute, keepFramePath, navigate } from './frame/handle';
import { outlineByTestId } from './frame/highlight';
import { reveal } from './frame/reveal';
import { armPicker, openInEditor, type Located } from './frame/locate';
import { audit, setOutline, type Finding } from './frame/measure';
import { waitReady } from './frame/ready';
import { applyFixture, ensureOnboarded, holdTheDoorOpen } from './frame/seed';
import { apply as applyHomeTime } from './home/clock';
import { apply as applyLocale } from './frame/locale';
import { apply as applyTokens, type Scheme } from './frame/tokens';
import { sectionTestId } from './home/names';
import { addLog, clearLogs, getLogs, subscribeLogs } from './logs';
import { HOST_DEVICE } from './devices';
import { fitScale, STAGE_ROOM } from './scale';
import { frameSize, type PreviewState } from './state';
import { getState, set, start, subscribe } from './store';
import type { ToolBindings } from './ui/Panels';

/**
 * Everything the app view is, minus how it is arranged.
 *
 * A hook rather than a component because the pieces no longer sit together: the
 * controls are in the header's context bar, the frame is the main area, the
 * inspector is the right sidebar and the readout is the status line. They all
 * need the same state, and `App.tsx` is the only place that can hand it to all
 * four.
 *
 * The site's own appearance is deliberately not read here. `App.tsx` owns
 * `useAppearance()` and the class it stamps; a second call would be a second
 * copy of that state, and the copy in `App.tsx` would go stale the moment this
 * one wrote.
 *
 * Every effect here used to open with `if (!active) return`, because `App.tsx`
 * called this hook on every view and a shell that polled a frame that is not
 * there wrote `#/?d=iphone-15-pro` over a document's heading anchor. The hook is
 * mounted by `pages/Preview.tsx` now, which exists only on its own route, so
 * the condition is the mounting.
 */
export function usePreview() {
  const state = useSyncExternalStore(subscribe, getState);
  const logs = useSyncExternalStore(subscribeLogs, getLogs);
  const stageRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const win = () => frameRef.current?.contentWindow ?? null;

  const [frameInfo, setFrameInfo] = useState<FrameInfo>(NO_FRAME);
  const [reportedRoute, setReportedRoute] = useState<string | undefined>(undefined);
  const [routeField, setRouteField] = useState(state.route);

  // The overrides live in the URL with everything else: a proposed palette is
  // exactly the kind of thing worth handing to someone as a link. The text pass
  // is a way of looking, not part of the proposal, so it stays local.
  const [textPass, setTextPass] = useState(true);
  const [outline, setOutlineOn] = useState(false);
  const [report, setReport] = useState<{
    findings: Finding[];
    scheme: Scheme;
    scanned: number;
  } | null>(null);
  const [picking, setPicking] = useState(false);
  const [hit, setHit] = useState<{ label: string; frames: Located[] } | null>(null);
  /**
   * The home document's row currently hovered or focused, and whether the frame follows
   * it there. None when nothing is hovered.
   *
   * The two travel together because they are read together, once, in the effect below:
   * holding `follow` apart would put a second value in that effect's dependencies and
   * make a change of setting re-run a scroll nobody asked for.
   */
  const [hoveredSection, setHoveredSection] = useState<{ id: string; follow: boolean } | null>(
    null,
  );
  /** The innermost frame is the usual answer, so it is the one preselected. */
  const [selected, setSelected] = useState(0);
  /** Bumped on every load, so everything injected into the frame is re-injected. */
  const [loaded, setLoaded] = useState(0);
  /**
   * Whether the store has read the address yet, which the page has to know before it
   * writes one back.
   *
   * **The hour in a link did not survive being opened.** `#/?d=iphone-15-pro&tm=11:30`
   * came back as `#/?d=iphone-15-pro`, so the one thing ADR 0039 §9 puts in the address
   * — a view of the home screen at half past six, as a thing to send somebody — was the
   * one thing a cold arrival dropped. Measured against `origin/main` as well: older than
   * anything the timeline's move did, and found by opening a link rather than by reading
   * the code.
   *
   * The order is the whole of it. The first render reads `INITIAL` out of the store,
   * because `start()` runs in the effect below and effects run after a render; the page's
   * "state out through `toAddress`" effect then fires with that first, empty state and
   * `replaceState`s a hash built from the defaults. `d` survives because the default
   * device happens to be the one in the link; `tm` has no default, so it goes. Nothing
   * puts it back, because what would put it back is a re-read of the hash that is now
   * the one just written.
   *
   * So the page waits to be told the store has taken the address. One boolean rather
   * than reordering the effects: the order effects run in is the mechanism that broke
   * this, and a fix that depended on a second, subtler ordering would be the same bug
   * with a longer fuse.
   */
  const [started, setStarted] = useState(false);

  /*
   * `Stage` draws the device frame and the full-bleed frame as two different
   * subtrees, so switching between them replaces both the stage box and the
   * iframe. Every effect that holds one of those elements depends on this, or it
   * keeps measuring and messaging the element that was thrown away: that is how
   * the app came back blank at 0 × 0 the first time.
   */
  const shape = state.device === HOST_DEVICE ? 'host' : 'framed';

  const { size, scale } = useStage(stageRef, state, shape);

  const status = statusOf(state, frameInfo, reportedRoute, logs);

  /*
   * The address bar is taken on the way in and given back on the way out, and
   * `window.preview` goes up with it: an automation asking a page that is not
   * showing the app to change devices would be answering about nothing.
   */
  useEffect(() => {
    install();
    const release = start();
    setStarted(true);
    return () => {
      release();
      uninstall();
    };
  }, []);

  /*
   * Re-run whenever the stage changes shape, not only on load. `Stage` draws a
   * device frame and a full-bleed frame as two different subtrees, so switching
   * between them replaces the iframe element, and both this and the navigation
   * below would otherwise still be holding the one that was thrown away.
   */
  useEffect(() => {
    registerFrame(frameRef.current);
    return () => registerFrame(null);
  }, [loaded, shape]);

  /**
   * The frame's first navigation, every one the route field causes, and the route
   * again after every load.
   *
   * A fixture has to be in storage before the app boots, so it is written here
   * rather than in an effect of its own: same-origin means this page's
   * `localStorage` IS the app's, and the app reads it while mounting.
   *
   * `loaded` is a dependency because of the development build. There the address
   * cannot carry the route at all (`driveRoute` says why), so a frame that has just
   * booted at `/app/gespeichert` is showing `+not-found` while its address claims
   * it is exactly where the state wants it — and the address is all `frameRoute`
   * below can see. Asking the router again after every load is what puts the app
   * where the state says. In the published export there is no handle to ask, and
   * the address was right to begin with.
   */
  const seeded = useRef<string | null>(null);
  /**
   * The language the frame was last BOOTED in, which is not what the address says
   * until a load has happened.
   *
   * `undefined` until the frame has been booted once. The gate below is what makes
   * that the same thing as "until the link has been read", so a cold arrival writes
   * the key and boots, rather than booting and then reloading itself. After that a
   * difference is a language somebody changed, and the only way to apply one is
   * another boot.
   */
  const built = useRef<Locale | null | undefined>(undefined);
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    /*
     * And not before the store has read the address, which is the gate
     * `pages/Preview.tsx` already puts on writing one back and `started` argues in
     * full: the first render holds `INITIAL`, because `start()` runs in an effect and
     * effects run after a render.
     *
     * Without it this effect boots twice on a cold link and the docblock above is
     * false. Measured on 2026-09-18 against `#/?d=iphone-15-pro&lg=en`: the first pass
     * saw `lang: null`, removed the key and pointed the frame at the app; the pass
     * after `start()` saw `en`, read that as a language somebody had changed and
     * pointed it there again. Only the second navigation landing while the first had
     * not committed yet kept that from being two loads, which is the browser being
     * kind rather than this file being right — and the load it would have thrown away
     * is the app in the wrong language.
     */
    if (!started) return;

    /*
     * The language, written before the frame is pointed anywhere, for the reason the
     * fixture below is written here rather than in an effect of its own: the app reads
     * it while its store is being constructed. `packages/app-core/src/stores/settings.ts`
     * has no `setLocale` to dispatch afterwards and does not want one, so a change of
     * language is a reload exactly as a reseed is, and folding it in here keeps one
     * place deciding when the frame loads. `frame/locale.ts` has the rest.
     */
    const relanguage = built.current !== undefined && built.current !== state.lang;
    applyLocale(state.lang);
    built.current = state.lang;

    // No fixture means leave the storage alone, which is what the plain demo
    // asks for: `/preview` with no `s` is the link `RELEASE.md` hands out,
    // and it must not wipe what the last visit left behind on its way in.
    let reseed = false;
    if (state.seed !== null && seeded.current !== state.seed) {
      applyFixture(window.localStorage, state.seed);
      seeded.current = state.seed;
      reseed = true;
    } else if (state.seed === null) {
      // "Must not wipe" is not "must show a stranger the sign-in form". A
      // first visit to that plain link has nothing stored yet, so the door —
      // and then onboarding behind it — stood between it and every tool on
      // this page, the Home layout editor included: every edit landed in
      // storage and never reached a screen, because there was no screen
      // behind either gate to redraw. That read as "moving a block does not
      // redraw the app" and was reported as one, on the published site, from
      // a visitor who had never opened it before. `AppFrame.tsx` already
      // carries `holdTheDoorOpen` for every component page and the reasoning
      // for it: "a frame that draws the door is worse than one that draws a
      // component"; `ensureOnboarded` is the same argument one screen later,
      // needed here and not there because this frame, unlike that one, starts
      // at `/`. Both are idempotent and touch nothing once a session —
      // seeded or real — is already held, so this changes nothing for a
      // returning visitor and nothing for `s=fresh` or `s=no-access`, which
      // choose the door on purpose and take the branch above instead.
      holdTheDoorOpen(window.localStorage);
      ensureOnboarded(window.localStorage);
    }

    const moving = reseed || relanguage || frameRoute(frame.contentWindow) !== state.route;
    if (moving) clearLogs();

    // A reseed has to reload, because the fixture is read while the app mounts, and a
    // change of language has to for the same reason one turn earlier: the locale is
    // construction state. Everything else prefers the router: it keeps the screen's
    // state, it is faster, and in a development build it is the only thing that works.
    if (!reseed && !relanguage && driveRoute(frame.contentWindow, state.route)) return;
    if (!moving) return;

    document.body.dataset.state = 'loading';
    navigate(frame, state.route);
  }, [started, shape, state.route, state.seed, state.lang, loaded]);

  /** The appearance setting, re-applied after every load because a reload resets it. */
  useEffect(() => {
    if (state.theme) applyTheme(win(), state.theme);
  }, [state.theme, loaded]);

  /*
   * What time the framed app is told it is, which follows the address the way the
   * appearance above does and for the same reason: it is a way of looking at the app,
   * not a setting of one tool. The home tool draws the timeline that MOVES it; the tool
   * being open or shut is not what decides whether a `tm=` in the address means
   * anything.
   *
   * Cleared when this view goes away. A simulated clock left in storage is durable state
   * nobody can see — the published demo would open on some fixed hour for ever, with
   * nothing on screen saying why — and leaving `/preview` is exactly the moment nothing
   * is framing the app any more. `preview/home/clock.ts` argues it in full.
   */
  useEffect(() => applyHomeTime(state.time), [state.time]);
  useEffect(() => () => applyHomeTime(null), []);

  /*
   * And cleared when the DOCUMENT goes away, which an unmount is not.
   *
   * The two effects above run while this page is alive: one on every change of
   * `state.time`, one when React takes the view down. Closing the tab is neither, so
   * the key outlived the page that wrote it — measured against the assembled site,
   * where `handle.ts`'s `BASE` makes `onRaw` open `<site>/app/` in a tab of its own on
   * the same origin. Set an hour, open raw, close the workbench tab, and the published
   * demo was pinned to that hour for that browser for ever, with nothing on screen
   * saying why. That is the exact state ADR 0039 §9 put the time in the address to
   * prevent, reached by the one door the address cannot reach: there is no later
   * address, because there is no later page.
   *
   * `pagehide` is the event for it, and `pageshow` is why it can be. A tab close, a
   * navigation away and a freeze into the back/forward cache are all one event here,
   * and only the last of them comes back — `pageshow` then writes `state.time` again,
   * so a restored page is simulating the hour its address still names. `unload` would
   * have covered the first two and made the third impossible, because a page with an
   * `unload` handler is not cached at all.
   *
   * The other way out was the APP clearing a key that did not arrive with the page it is
   * rendering, and it is worse for a reason that is not taste. The app
   * cannot tell: this shell writes the key from an effect and boots the frame in the
   * same render, so "it was already there when I started" is a race and not a fact, and
   * the first thing the app would clear on a slow boot is the hour the timeline just
   * asked for. It would also make the app a writer of this key, and the whole event
   * model next door rests on it not being one — a browser tells every same-origin
   * document about a write except the one that made it, which is exactly why a write
   * here reaches the frame (`apps/mobile/src/lib/home/clock.ts`).
   */
  useEffect(() => {
    const hide = () => applyHomeTime(null);
    const show = () => applyHomeTime(state.time);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, [state.time]);

  /*
   * And the language cleared on the same two exits, for the same reason and with one
   * difference worth naming.
   *
   * The write is not here: it is in the boot effect above, because the app reads the key
   * while it is mounting and a language applied after the fact would be a language
   * applied to nothing. What is here is the pair of exits `applyHomeTime` argues at
   * length — the view going away, and the DOCUMENT going away, which an unmount is not.
   * `onRaw` opens `<site>/app/` in a tab of its own on this origin, so an hour left
   * behind pins the published demo to an hour and a language left behind pins it to a
   * language, and the second reads as the app having shipped wrong rather than as a tool
   * having left something on.
   *
   * `pageshow` writes it back for a document restored from the back/forward cache, which
   * is the one of `pagehide`'s three cases that returns.
   */
  useEffect(() => () => applyLocale(null), []);
  useEffect(() => {
    const hide = () => applyLocale(null);
    const show = () => applyLocale(state.lang);
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => {
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    };
  }, [state.lang]);

  useEffect(
    () => applyTokens(win(), state.overrides, textPass),
    [state.overrides, textPass, loaded],
  );
  useEffect(() => setOutline(win(), outline), [outline, loaded]);

  // `#/?check=1` runs the checks by itself once the frame settles, so a finding
  // is reachable by opening a link rather than by clicking a button — the same
  // reason the device and the route live in the address bar.
  useEffect(() => {
    if (state.check && loaded > 0) setReport(audit(win()));
  }, [state.check, loaded]);

  useEffect(() => {
    if (!picking) return;
    return armPicker(win(), (frames, label) => {
      setHit({ label, frames });
      setSelected(0);
      setPicking(false);
    });
  }, [picking, loaded]);

  /**
   * The home tool's row, outlined in the frame while it is hovered or focused.
   *
   * The same mark the picker uses, reached the same way: same-origin property
   * access into the frame's document, degrading to nothing where that fails —
   * before the frame exists, in a build with no matching element, or once the
   * hovered section itself no longer draws one. The `useEffect` clears its own
   * mark before every re-run, which is what takes it off a section switched off
   * mid-hover and what stops it surviving a navigation that replaces the frame's
   * whole document.
   */
  useEffect(() => {
    const node = outlineByTestId(win(), hoveredSection ? sectionTestId(hoveredSection.id) : null);
    // An outline below the fold is an outline nobody can see, and more than half the
    // shipped document's blocks are below it at a phone's height. `reveal` moves the
    // frame's own scroller and only when it has to; `reveal.ts` says why not
    // `scrollIntoView`.
    if (node && hoveredSection?.follow) reveal(node);
    return () => {
      outlineByTestId(win(), null);
    };
  }, [hoveredSection, loaded]);

  const onLoad = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    attachConsole(frame.contentWindow, addLog);
    document.body.dataset.state = 'loading';

    void waitReady(frame).then(() => {
      setLoaded((n) => n + 1);
      document.body.dataset.state = 'ready';
      return undefined; // `promise/always-return`, which has nothing to be given here
    });
  }, []);

  /**
   * expo-router navigates with `pushState`, which fires no event an outer frame
   * can hear, so the route is polled. Cheap, and it also catches taps inside the
   * app — the field follows the frame wherever the app takes it. The same tick
   * re-reads the handle and both schemes, which a person can change in DevTools
   * at any moment.
   */
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    const id = window.setInterval(() => {
      const current = win();

      // First in the tick, because everything below reads the frame's address, and
      // in a development build nothing that navigates writes the base: not
      // `driveRoute`, and not a tap inside the app either. `keepFramePath` says why
      // it insists on a handle before it touches anything.
      keepFramePath(current);

      // Also patched here, not only on load, because `load` is late: the app's
      // first render happens before it, and a React warning from that render is
      // exactly what this panel exists to catch. Attaching is idempotent.
      attachConsole(current, addLog);

      const info = readFrame(current);
      setFrameInfo((previous) => (unchanged(previous, info) ? previous : info));
      const route = frameRoute(current);
      setReportedRoute(route);

      // The setting is re-asserted rather than set once. `persist()` hydrates
      // asynchronously and dispatches the stored theme, so a single dispatch at
      // load time is a race it can lose — and it did, in one of two otherwise
      // identical runs. Re-asserting settles it within a tick, whoever won.
      // While a setting is pinned in the URL, the app's own control cannot hold
      // against it; that is what pinning means.
      const wanted = getState().theme;
      if (wanted && info.appTheme && info.appTheme !== wanted) applyTheme(current, wanted);

      // Only a route the frame has MOVED to is written back, never one it is
      // merely still on. `driveRoute` returns before the app has gone anywhere:
      // `router.navigate` queues the action and the address follows up to 40 ms
      // later, measured, so a tick landing inside that window reads the route the
      // app is leaving — and writing that sends it straight back. Seen once, on
      // `/mediathek`: the field snapped to `/`, the frame followed, and the whole
      // navigation was undone by the poll that exists to observe it. A value this
      // tick has already reported is an echo of our own command, not a move.
      const moved = route !== seen.current;
      seen.current = route;
      if (moved && route !== undefined && route !== getState().route) set({ route });
    }, 300);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => setRouteField(state.route), [state.route]);

  const onChange = useCallback((patch: Partial<PreviewState>) => set(patch), []);
  // Stable, because `Stage` re-attaches its drag handles whenever this changes.
  const onResize = useCallback(
    ({ w, h }: { w: number; h: number }) => set({ device: 'custom', landscape: false, w, h }),
    [],
  );

  const tools: ToolBindings = {
    scheme: frameInfo.active,
    tokens: {
      overrides: state.overrides,
      set: (overrides) => set({ overrides }),
      textPass,
      setTextPass,
    },
    measure: { outline, setOutline: setOutlineOn, report, run: () => setReport(audit(win())) },
    inspect: {
      picking,
      setPicking,
      hit,
      selected,
      setSelected,
      open: (frame) => void openInEditor(frame),
    },
  };

  return {
    state,
    status,
    logs,
    tools,
    scale,
    size,
    routeField,
    setRouteField,
    stageRef,
    frameRef,
    onChange,
    onResize,
    onLoad,
    /** The home tool's own outline, separate from `tools`: the seventh tool, not one of the six. */
    /** See above: the page may not write the address until the store has read it. */
    started,
    outlineSection: setHoveredSection,
    onReload: () => win()?.location.reload(),
    onRaw: () => window.open(BASE + (state.route || '/'), '_blank', 'noopener'),
    clearLogs,
  };
}
function unchanged(a: FrameInfo, b: FrameInfo): boolean {
  return (
    a.handle === b.handle &&
    a.appTheme === b.appTheme &&
    a.scheme === b.scheme &&
    a.active === b.active
  );
}

/**
 * How big the frame is and how much it is scaled, both measured against the box.
 *
 * Two answers from one observer because they come from one measurement. `host`
 * takes the box itself as the size and is never scaled: it is the app at the
 * screen's size, which is the point of it, and a scale factor over that would be
 * a lie about how many pixels the app thinks it has.
 *
 * `shape` is a dependency because it is what replaces the element. This used to
 * take an `active` flag as well, for the render in which the hook ran on a view
 * that had no stage: the ref went from null to an element without any other
 * dependency changing, the observer was never attached, and the frame stayed at
 * the initial 100%. The hook is mounted with its route now, so that render does
 * not happen.
 */
function useStage(
  stageRef: React.RefObject<HTMLDivElement | null>,
  state: PreviewState,
  shape: string,
): { size: { w: number; h: number }; scale: number } {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const asked = frameSize(state);
  const isHost = state.device === HOST_DEVICE;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const next = { w: stage.clientWidth, h: stage.clientHeight };
      setBox((previous) => (previous.w === next.w && previous.h === next.h ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [shape, stageRef]);

  // Full bleed: no padding to subtract and no handles to leave room for.
  if (isHost) return { size: box, scale: 1 };

  const size = asked;
  if (state.zoom !== 'fit') return { size, scale: Number(state.zoom) };

  return { size, scale: fitScale(box, size, STAGE_ROOM) };
}
