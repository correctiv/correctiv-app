import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { defineMessages } from 'react-intl';

import {
  MINUTES_IN_DAY,
  type HomeLayout,
  type HomeSection,
  type MinuteOfDay,
} from '@correctiv/app-core/lib/home-layout';
import { HOME_PINS } from '@correctiv/app-core/data/home-pins';

import { SOURCES } from '../../../content/sources.manifest';
import { useWorkbenchIntl } from '../../i18n/Localisation';
import { AppHost } from '../../components/AppHost';
import { cn } from '../../lib/cn';
import { Badge } from '../../ui/kit/badge';
import { Button } from '../../ui/kit/button';
import { DEFAULT_DEVICE, preset } from '../devices';
import { timeOf } from './clock';
import type { PreviewState } from '../state';
import { HomeBlock } from './HomeBlock';
import { InsertMark } from './Palette';
import { minuteFrom, openedAt, parseMinute, STEP } from './minutes';
import {
  changedAt,
  differs,
  effectiveAt,
  formatLayoutDocument,
  formatTimeOfDay,
  inheritedAt,
  added,
  moduleLabel,
  moved,
  movedMoment,
  momentAt,
  pointAt,
  removed,
  settingLabel,
  settingsFor,
  SHIPPED,
  spanOf,
  withHidden,
  withoutMoment,
  blockName,
  deltaTo,
  whereAt,
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

/**
 * Everything this tool says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/home.ts`.
 *
 * **Formatted through `useWorkbenchIntl()` and never `useIntl()`**, and here that is
 * not a convention but the only thing that works: the block list is wrapped in one
 * `AppHost`, which mounts the APP's `IntlProvider`, so react-intl's own context
 * inside every `Row` below is the app's. It holds no `home.*` id, and each of these
 * would have rendered its English default and reported nothing. `Palette.tsx` carries
 * the measurement.
 *
 * What is NOT here is everything out of `./document.ts` — `moduleLabel`,
 * `settingLabel`, `blockName` and `whereAt`. Those name the app's own modules and
 * settings, ADR 0050 §5 defers them, and they arrive as English values inside the
 * sentences below. The German is written to read around an English fragment, the way
 * `de/home.ts` already does for `{where}`.
 */
const COPY = defineMessages({
  rule: {
    id: 'home.document.rule',
    defaultMessage: 'A moment carries only what changes at it.',
    description:
      'The one sentence above the editor, and the one rule that makes the rest legible: a moment holds the difference from the point before it rather than the whole state.',
  },
  follow: {
    id: 'home.document.follow',
    defaultMessage: 'Scroll the frame to the block under the pointer',
  },
  revert: {
    id: 'home.document.revert',
    defaultMessage: 'Back to the file',
    description:
      'Throws away every edit of this session and goes back to the document as the repository has it.',
  },
  save: { id: 'home.document.save', defaultMessage: 'Save to the repository' },
  copy: {
    id: 'home.document.copy',
    defaultMessage: 'Copy the document',
    description:
      'What the published site offers instead of Save, because there is no dev server to write the file with.',
  },
  changed: {
    id: 'home.document.changed',
    defaultMessage: 'changed',
    description:
      'The word beside the Save button while the document differs from the file. home.row.changed is the badge on a single block’s row and reads the same in English.',
  },
  unchanged: { id: 'home.document.unchanged', defaultMessage: 'unchanged' },
  saveNote: {
    id: 'home.document.saveNote',
    defaultMessage:
      'Save writes <code>packages/app-core/src/data/home.layout.json</code> through the dev server, which refuses anything the core will not parse. The next step is a pull request rather than a write, the way the sources job already does it (ADR 0036 §15).',
    description:
      'Says what Save does before anybody presses it, on a dev server. The tag wraps a repository path, drawn in a monospace face.',
  },
  copyNote: {
    id: 'home.document.copyNote',
    defaultMessage:
      'This is the published site, so there is no server to write with and nothing here reaches the repository. Copy the document and put it in <code>packages/app-core/src/data/home.layout.json</code>, or open <code>/preview</code> on a dev server, where Save is offered.',
    description:
      'The same, on the published site, where there is no Save. The tag wraps a repository path and an address, both drawn in a monospace face.',
  },
  copied: {
    id: 'home.document.copied',
    defaultMessage: 'Copied.',
    description:
      'Confirms that the whole document is on the clipboard. frame.copied is the shorter word the address bar uses for a link.',
  },
  refused: {
    id: 'home.document.refused',
    defaultMessage: 'refused',
    description:
      'The badge in front of the dev server’s reason for not writing the file. White on the brand red, beside a sentence that comes from the server and is not translated.',
  },

  midnight: {
    id: 'home.point.midnight',
    defaultMessage: 'midnight',
    description:
      'Stands where a time of day would, for the end of the last stretch of the day. Reads inside home.point.startLead and home.point.span.',
  },
  pointStart: {
    id: 'home.point.start',
    defaultMessage: 'The day’s start',
    description:
      'Names the point being edited when it is the document itself rather than one of its moments.',
  },
  pointStartLead: {
    id: 'home.point.startLead',
    defaultMessage:
      'The document as it stands, in effect from midnight until {until}. Every moment inherits from it.',
    description:
      'Under the day’s start. {until} is the time the first moment takes over, as 18:30, or the word for midnight where there is none.',
  },
  pointTime: {
    id: 'home.point.time',
    defaultMessage: 'The time of this moment',
    description: 'The label of the time field at the head of the editor. Read aloud, not drawn.',
  },
  pointSpan: {
    id: 'home.point.span',
    defaultMessage:
      'until {until} · {changes, plural, =0 {nothing changes here yet} other {# changed here}}',
    description:
      'Beside the time field: how long this moment lasts and how much it changes. {until} is when the next point takes over, as 18:30, or the word for midnight; {changes} is how many blocks this moment differs on.',
  },
  pointRemove: {
    id: 'home.point.remove',
    defaultMessage: 'Remove the moment at {time}',
    description:
      'The accessible name of the button that deletes the moment being edited. {time} is its time of day, as 18:30.',
  },
  noMoments: {
    id: 'home.point.noMoments',
    defaultMessage: 'This document has no moments, so the home screen is the same at every hour.',
  },

  rowOff: {
    id: 'home.row.off',
    defaultMessage: 'off',
    description:
      'The badge on a block that is switched off at the point being edited, so it keeps its row and loses its drawing.',
  },
  rowChanged: {
    id: 'home.row.changed',
    defaultMessage: 'changed',
    description:
      'The badge on a block this moment changes something about. home.document.changed is the word beside the Save button and reads the same in English.',
  },
  switchOnAtStart: {
    id: 'home.row.switchOnAtStart',
    defaultMessage: 'Switch {block} on from the start of the day',
    description:
      'The accessible name of the eye button on a block that is off, while the day’s start is being edited. {block} is the block’s own name and arrives in English out of document.ts.',
  },
  switchOnAt: {
    id: 'home.row.switchOnAt',
    defaultMessage: 'Switch {block} on at {time}',
    description:
      'The same button while a moment is being edited. {block} is the block’s own name, in English out of document.ts; {time} is the moment’s time of day, as 18:30.',
  },
  switchOffAtStart: {
    id: 'home.row.switchOffAtStart',
    defaultMessage: 'Switch {block} off from the start of the day',
    description:
      'The accessible name of the eye button on a block that is on, while the day’s start is being edited. {block} is the block’s own name and arrives in English out of document.ts.',
  },
  switchOffAt: {
    id: 'home.row.switchOffAt',
    defaultMessage: 'Switch {block} off at {time}',
    description:
      'The same button while a moment is being edited. {block} is the block’s own name, in English out of document.ts; {time} is the moment’s time of day, as 18:30.',
  },
  moveUp: {
    id: 'home.row.moveUp',
    defaultMessage: 'Move {block} up',
    description:
      'The keyboard’s route through the order, by ADR 0047 §2. {block} is the block’s own name and arrives in English out of document.ts.',
  },
  moveDown: {
    id: 'home.row.moveDown',
    defaultMessage: 'Move {block} down',
    description:
      'The keyboard’s route through the order, by ADR 0047 §2. {block} is the block’s own name and arrives in English out of document.ts.',
  },
  rowRemove: {
    id: 'home.row.remove',
    defaultMessage: 'Remove {block} from the day',
    description:
      'Takes the block out of the document altogether, which is a different act from switching it off at an hour. {block} is the block’s own name, in English out of document.ts.',
  },
  offAtStart: {
    id: 'home.row.offAtStart',
    defaultMessage: 'Not on screen at the start of the day.',
    description:
      'Stands where a switched-off block’s drawing would be, while the day’s start is being edited.',
  },
  offAt: {
    id: 'home.row.offAt',
    defaultMessage: 'Not on screen at {time}.',
    description:
      'Stands where a switched-off block’s drawing would be, while a moment is being edited. {time} is the moment’s time of day, as 18:30.',
  },

  setHere: {
    id: 'home.setHere',
    defaultMessage: 'set here',
    description:
      'The mark on a value this moment sets, as against one it inherits from the point before it. Drawn white on the accent, beside a control.',
  },
  noPin: {
    id: 'home.setting.noPin',
    defaultMessage: 'The newest investigation (no pin)',
    description:
      'The first option of the article picker, which leaves the module to its own default instead of naming an article.',
  },
  sampleBadge: {
    id: 'home.setting.sampleBadge',
    defaultMessage: 'sample data',
    description:
      'Marks the article picker as a checked-in stand-in rather than a live feed. Read out of the source inventory, so it goes by itself on the day the row turns live.',
  },
  sample: {
    id: 'home.setting.sample',
    defaultMessage:
      'These are <code>packages/app-core/src/data/home-pins.ts</code>, standing in for {standsIn}. Real articles, a fixed list, not today’s.',
    description:
      'Beside the sample-data badge. The tag wraps a repository path, drawn in a monospace face; {standsIn} is what the inventory says the file stands in for, in English out of content/sources.manifest.ts.',
  },
});

/** A block a pointer has picked up: which one, where it started, where it would land. */
interface Carry {
  /**
   * Which pointer is carrying it.
   *
   * One column, one ref, and without this every pointer wrote to it. Measured with two
   * touches in a cold review: one finger grabs the header and drags, a second finger
   * merely RESTS on another row's handle, and the second block is the one that moves —
   * the first never budges, the wrong row dims, and the document is marked changed.
   * Every handler below refuses an event whose pointer is not this one.
   */
  pointer: number;
  id: string;
  from: number;
  gap: number;
  /**
   * Where the pointer was, so that a scroll can re-ask the question without a move.
   *
   * The gap was recomputed on `pointermove` alone, so a wheel during a carry left the
   * mark lit on a gap that had scrolled out of sight, and a release there dropped at it.
   */
  y: number;
}

/** The dock's ground is `surface`, so a row inside it steps back to `canvas`. */
const CARD = 'rounded-md border border-stroke bg-canvas';
const NOTE = 'text-s leading-relaxed text-on-canvas-muted';
const CODE = 'rounded-s border border-stroke px-3xs font-mono text-[0.8125rem]';
const FIELD =
  'rounded-s border border-stroke bg-canvas px-3xs py-4xs text-s text-on-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

/**
 * The monospace run inside the two notes and the sample-data sentence.
 *
 * At module scope, the way `./HomeBlock.tsx` has its one tag: a component defined
 * during a render is a new component on every render, which is what
 * `react/no-unstable-nested-components` is about.
 */
const code = (chunks: ReactNode[]) => <code className={CODE}>{chunks}</code>;

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
  /**
   * Outlines the section's element in the frame, or clears the outline on `null`.
   *
   * `follow` is whether the frame also scrolls to it. It travels with the id rather than
   * being read where the scroll happens, so that changing the setting cannot move a frame
   * by itself — only hovering a row can.
   */
  outline: (held: { id: string; follow: boolean } | null) => void;
}) {
  const intl = useWorkbenchIntl();
  const layout = useSyncExternalStore(subscribeLayout, getLayout, getLayout);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [copied, setCopied] = useState(false);
  /**
   * Whether the frame scrolls to the block under the pointer.
   *
   * On, because the outline it goes with is useless where it cannot be seen: at a phone's
   * height, most of the shipped document is below the fold. Switchable, because a moving
   * frame is a thing to be able to stop — somebody comparing two hours, or recording the
   * screen, wants the frame where they put it.
   *
   * Held here and not in the address, which is the same call `textPass` makes one file
   * over and for the same reason: the address carries what a link should reproduce, and
   * this changes nothing a screenshot would show. It changes what happens when a pointer
   * moves, which is not a thing to send somebody.
   */
  const [follow, setFollow] = useState(true);

  /**
   * The block a pointer is carrying, where it started, and the gap it would land in.
   *
   * [ADR 0047](../../../../../adr/0047-the-handle-is-the-pointers-and-the-arrows-are-the-keyboards.md)
   * §1: the handle is the pointer's route and has no keyboard mode; §2 keeps the arrow
   * buttons as the keyboard's. Both end at `moved`, so the document never learns there
   * were two controls.
   *
   * Held here rather than in the row, because a row knows where it is and not where the
   * others are, and a drop is a question about the whole column.
   */
  const [carried, setCarried] = useState<Carry | null>(null);
  /**
   * The same thing again, for the drop to read.
   *
   * A `pointerup` can arrive before React has re-rendered from the last `pointermove`,
   * and the handlers a row carries are the ones built by the render it can see. Reading
   * state at the drop would then apply the position the pointer was in one move ago,
   * which is a block landing one place out — rarely, and only on a fast drag, which is
   * the worst kind of wrong. The ref is written beside the state and never instead of it:
   * the state is what the marks draw, the ref is what the drop reads.
   */
  const carrying = useRef<Carry | null>(null);
  const list = useRef<HTMLOListElement>(null);

  /**
   * Two things that have to reach a carry from outside the handle it started on.
   *
   * **Escape puts the block back.** ADR 0047 §1 refuses the handle a keyboard mode and
   * this is not one: the listener exists only while a pointer is down, so it is a way out
   * of a gesture rather than a way into an edit, and nothing can be reordered with it.
   * Without it, and before the release outside the list became an abandon, a drag
   * somebody had thought better of had no way out but finding the original gap again.
   *
   * **A scroll re-asks where the pointer is.** The gap was recomputed on `pointermove`
   * alone, so a wheel during a carry left the mark lit on a gap that had scrolled away.
   * Capture, because the panel is what scrolls and a scroll does not bubble.
   */
  useEffect(() => {
    if (carried === null) return;
    const abandon = (event: KeyboardEvent) => {
      if (event.key === 'Escape') carry(null);
    };
    const followed = () => {
      const held = carrying.current;
      if (held !== null) carry({ ...held, gap: gapAt(held.y) });
    };
    window.addEventListener('keydown', abandon);
    window.addEventListener('scroll', followed, true);
    return () => {
      window.removeEventListener('keydown', abandon);
      window.removeEventListener('scroll', followed, true);
    };
    // `carry` and `gapAt` are rebuilt every render and close over nothing that changes
    // while a pointer is down; what decides whether this listens at all is the carry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carried !== null]);

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
   * The width a block draws at: the phone's, always, and not the device the frame is set
   * to.
   *
   * ADR 0045 §3 says "a block draws at **the phone's own width**", and this followed the
   * frame instead for one release. What that looked like: pick an iPad and every drawing
   * in the panel shrinks to about a third, because §3's other half — scale down to fit,
   * never up — then has a 744px block to fit into a panel about 400px wide. A column of
   * unreadable thumbnails, and worse, the list quietly became a second, poorer answer to
   * a question the frame beside it was already answering properly.
   *
   * The division of labour is the point and it is the frame's: **the frame is where a
   * device is tried**, at any size, with the handles and the presets and the orientation.
   * The list is where the DOCUMENT is (§1) — which blocks there are, in what order, in
   * what state at this minute — and a block there has to be recognisable as the thing on
   * the phone, which is §3's own words for it. Those two jobs want two widths, and the
   * list's is fixed.
   *
   * `DEFAULT_DEVICE`'s width rather than a number typed here: it is the phone this tool
   * opens at, it is already a fact in `devices.ts`, and a second spelling of 393 is a
   * second thing to edit.
   */
  const deviceWidth = preset(DEFAULT_DEVICE).w;

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

  /**
   * Which gap the pointer is in, by the rows' own boxes.
   *
   * Measured on every move rather than once at the grab: the list reflows while a block
   * is carried, because the row it came from stays where it is and keeps its height, and
   * a drawing inside another row can still finish measuring itself. Boxes read once would
   * be stale by exactly the amount that makes a drop land one place out.
   */
  /**
   * Whether a release at this x lands in the list or abandons the carry.
   *
   * The list's own box, widened by a hand's width either side so that a drag that strays
   * a little is still a drop. Anything further out is somebody leaving, and leaving is
   * the only way out of a carry: the handle has no key, by ADR 0047 §1.
   */
  const overList = (x: number): boolean => {
    const box = list.current?.getBoundingClientRect();
    return box === undefined || (x > box.left - 96 && x < box.right + 96);
  };

  const gapAt = (y: number): number => {
    const rows = list.current === null ? [] : [...list.current.children];
    const above = rows.findIndex(
      (row) => y < row.getBoundingClientRect().top + row.clientHeight / 2,
    );
    return above === -1 ? rows.length : above;
  };

  /** Both at once, because one of them is for drawing and the other is for landing. */
  const carry = (next: Carry | null) => {
    carrying.current = next;
    setCarried(next);
  };

  /**
   * Whether this event belongs to the carry in progress.
   *
   * Two guards in one place. A second pointer must not write to the one ref the column
   * shares, and an event from a pointer that is not carrying must not move anything.
   */
  const mine = (event: PointerEvent<HTMLElement>): Carry | null => {
    const held = carrying.current;
    return held !== null && held.pointer === event.pointerId ? held : null;
  };

  /** The handlers a row's handle carries, built here because the drop needs the column. */
  const gripFor = (id: string, from: number) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      /*
       * The primary button and nothing else. Without this a right-click on the handle
       * picked the block up and the right-button release reordered the day — measured —
       * and a middle drag on Linux is the autoscroll gesture, which nobody means as an
       * edit. A second pointer while one is already carrying is refused outright rather
       * than allowed to take over: taking over is the two-finger failure above.
       */
      if (event.button !== 0 || !event.isPrimary || carrying.current !== null) return;
      // Or the browser starts a text selection across the whole panel instead.
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      carry({ pointer: event.pointerId, id, from, gap: from, y: event.clientY });
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const held = mine(event);
      if (held !== null) carry({ ...held, gap: gapAt(event.clientY), y: event.clientY });
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const held = mine(event);
      carry(null);
      /*
       * Two things decide whether this is a drop or an abandon, and both are read from
       * the event rather than from what the last move left behind.
       *
       * The gap is recomputed here, because a wheel between the last move and the release
       * moves every row without producing a move event. And a release away from the list
       * puts the block back: without that test, letting go anywhere at all reordered the
       * day, including out over the phone frame nine hundred pixels away — which is the
       * only way out of a drag somebody has started and thought better of, since ADR 0047
       * §1 gives the handle no key to press.
       */
      if (held === null || !overList(event.clientX)) return;
      setLayout(moved(layout, held.id, deltaTo(held.from, gapAt(event.clientY))));
    },
    // A touch the browser takes over — a scroll gesture, a call coming in — ends the drag
    // without an up, and the block has to go back rather than stay picked up for ever.
    onPointerCancel: (event: PointerEvent<HTMLElement>) => {
      if (mine(event) !== null) carry(null);
    },
  });

  const effective = effectiveAt(layout, point);
  const inherited = inheritedAt(layout, point);
  const edited = changedAt(layout, minute);
  const dirty = differs(layout);

  return (
    <>
      {/*
        One sentence, and it is the one the interface cannot draw.

        This was four. The other three described the track above it (midnight to
        midnight), the list below it (the day in the document's order) and the frame
        beside it (one minute of it) — three things a reader is looking at while they
        read that they are looking at them. What is left is the rule that makes the
        rest legible and that nothing on screen states: a moment holds the difference
        and not the state.
      */}
      <p className={NOTE}>{intl.formatMessage(COPY.rule)}</p>

      <label className="flex items-center gap-2xs text-s text-on-canvas">
        <input
          type="checkbox"
          checked={follow}
          onChange={(event) => setFollow(event.target.checked)}
          className="size-[0.875rem] shrink-0 accent-accent"
        />
        {intl.formatMessage(COPY.follow)}
      </label>

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
      {/*
        The day, and before every block a place to put one. ADR 0045 §6 wants the mark at
        each end too, so there is one more of them than there are blocks.

        **Each mark lives inside the row it comes before**, and the last one lives outside
        the list, because a `list` may own only `listitem`s. The marks were their own
        `role="presentation"` items for a while and Chrome did report the twelve blocks as
        twelve items — but thirteen buttons as non-`listitem` children of a list is a thing
        other assistive technology may resolve differently, and a structure that is simply
        valid needs no prediction about who resolves what.
      */}
      <AppHost>
        <ol ref={list} className="flex flex-col">
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
              follow={follow}
              before={
                <InsertMark
                  where={whereAt(layout, index)}
                  deviceWidth={deviceWidth}
                  dropping={carried !== null && carried.gap === index}
                  onAdd={(module) => setLayout(added(layout, index, module))}
                />
              }
              grip={gripFor(section.id, index)}
              carried={carried?.id === section.id}
              onMove={(delta) => setLayout(moved(layout, section.id, delta))}
              onHidden={(hidden) => setLayout(withHidden(layout, point, section.id, hidden))}
              onSetting={(key, value) =>
                setLayout(withSetting(layout, point, section.id, key, value))
              }
              onRemove={() => setLayout(removed(layout, section.id))}
              outline={outline}
            />
          ))}
        </ol>
        {/* The last gap, which has no block after it to live in. */}
        <InsertMark
          where={whereAt(layout, layout.sections.length)}
          deviceWidth={deviceWidth}
          dropping={carried !== null && carried.gap === layout.sections.length}
          onAdd={(module) => setLayout(added(layout, layout.sections.length, module))}
        />
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
          {intl.formatMessage(COPY.revert)}
        </Button>

        {canSave ? (
          <Button
            size="sm"
            disabled={!dirty}
            onClick={() =>
              void save(layout, (message, values) => intl.formatMessage(message, values)).then(
                setResult,
              )
            }
          >
            <Save aria-hidden="true" />
            {intl.formatMessage(COPY.save)}
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
            {intl.formatMessage(COPY.copy)}
          </Button>
        )}

        <span className={NOTE}>{intl.formatMessage(dirty ? COPY.changed : COPY.unchanged)}</span>
      </div>

      {/*
        The difference between the two Saves is said here rather than discovered by
        pressing one. `canSave` is `import.meta.env.DEV`, so this is the published site
        telling the truth about itself, which is the shape the Tokens tool already has.
      */}
      <p className={NOTE}>
        {intl.formatMessage(canSave ? COPY.saveNote : COPY.copyNote, { code })}
      </p>

      {copied && (
        <p className="flex items-center gap-xs text-s text-on-canvas">
          <Check aria-hidden="true" className="size-[0.875rem] shrink-0" />
          {intl.formatMessage(COPY.copied)}
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
              {intl.formatMessage(COPY.refused)}
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
  const intl = useWorkbenchIntl();
  const until =
    span.to === MINUTES_IN_DAY ? intl.formatMessage(COPY.midnight) : formatTimeOfDay(span.to);

  return (
    <div className={cn(CARD, 'flex flex-wrap items-center gap-xs p-xs')}>
      {point === null ? (
        <>
          <span className="text-m font-semibold text-on-canvas">
            {intl.formatMessage(COPY.pointStart)}
          </span>
          <span className={NOTE}>{intl.formatMessage(COPY.pointStartLead, { until })}</span>
        </>
      ) : (
        <>
          <label className="flex items-center gap-2xs">
            <span className="sr-only">{intl.formatMessage(COPY.pointTime)}</span>
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
          <span className={NOTE}>{intl.formatMessage(COPY.pointSpan, { until, changes })}</span>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-[2rem]"
            aria-label={intl.formatMessage(COPY.pointRemove, { time: formatTimeOfDay(point) })}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </>
      )}
      {point === null && layout.moments.length === 0 && (
        <span className={cn(NOTE, 'w-full')}>{intl.formatMessage(COPY.noMoments)}</span>
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
  follow,
  before,
  grip,
  carried,
  onMove,
  onHidden,
  onSetting,
  onRemove,
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
  /** Takes the block out of the day, and every change that named it with it. */
  onRemove: () => void;
  outline: (held: { id: string; follow: boolean } | null) => void;
  /** Whether hovering this row scrolls the frame to it. The panel's setting, not the row's. */
  follow: boolean;
  /** The gap above this block, as a control. It is drawn inside the row so the list stays a list. */
  before: ReactNode;
  /**
   * What the drag handle listens to. ADR 0047 §1: a pointer route and nothing else, so
   * these are the whole of it and there is no key to press.
   */
  grip: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  };
  /** Whether this is the block a pointer is carrying right now. */
  carried: boolean;
}) {
  const intl = useWorkbenchIntl();
  const { name, what } = moduleLabel(section.module);
  /*
   * What the row's four controls call this block when they are read out. `name` alone is
   * the module's, and two sections of one module share it — `document.ts` says what that
   * cost in the accessibility tree.
   */
  const spoken = blockName(section);
  /*
   * The point being edited, as a time, or `null` for the day's start. Read once here
   * because four sentences below choose between two messages on it, and a second
   * reading of `point` could disagree with the first.
   */
  const at = point === null ? null : formatTimeOfDay(point);

  /**
   * Where the keyboard goes when the arrow it just used switches itself off.
   *
   * ADR 0047 §2 makes the arrows **the** keyboard route, and §4 refuses the drag a
   * keyboard mode precisely because they already work. They half worked: measured in a
   * cold review, pressing "Move Header up" until the block reaches the top disables that
   * button, the browser blurs it, and focus lands on `<body>` — a person walking a block
   * up the list loses their place at the exact moment the move lands.
   *
   * So a press is remembered, and the render that follows puts focus on whichever of the
   * two is still pressable. Remembered rather than read back, because by then the browser
   * has already moved focus away and `document.activeElement` says `body` either way.
   * Only this row's own press sets it, so a row moved by somebody else's press does not
   * steal focus.
   */
  const pressed = useRef<-1 | 1 | null>(null);
  const up = useRef<HTMLButtonElement>(null);
  const down = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const was = pressed.current;
    pressed.current = null;
    if (was === null) return;
    const wanted = was === -1 ? (index === 0 ? down : up) : last ? up : down;
    wanted.current?.focus();
  }, [index, last]);
  const off = Boolean(section.hidden);
  const specs = settingsFor(section.module);
  const hiddenHere = point !== null && Boolean(inherited.hidden) !== off;

  return (
    <li className="flex flex-col">
      {before}
      {/*
        Nothing below makes the card operable; the handlers only relay whether the
        pointer or the focus is somewhere inside it, and every control a person can act on
        is one of its own buttons and labels.

        `outline` is called with `section.id` whether or not `off` is true, and this row
        does not check it first. A moment can hide a place at the point being previewed —
        `off` is exactly that fact — and the deliberate choice is to let the lookup in
        `frame/highlight.ts` discover the absence itself: it finds no matching element and
        clears whatever mark was there, which is the same quiet nothing a mistyped id or
        an unrendered module would produce. The `off` badge below already tells a person
        the row is not on screen; the outline does not need to say it twice, and a row
        cannot drift out of sync with a mechanism it does no filtering of its own.
      */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={cn(
          CARD,
          'group flex flex-col gap-2xs p-xs',
          isChanged && 'border-accent',
          carried && 'opacity-50',
        )}
        onPointerEnter={() => outline({ id: section.id, follow })}
        onPointerLeave={() => outline(null)}
        onFocus={() => outline({ id: section.id, follow })}
        onBlur={() => outline(null)}
      >
        <div className="flex min-w-0 items-start gap-xs">
          {/*
            ADR 0047 §1: the pointer's route, and nothing else. No `tabindex`, no role and
            `aria-hidden`, because a handle that looked focusable while doing nothing on a
            key would be the untested route wearing the tested one's clothes. The arrows
            two controls along are the keyboard's, by ADR 0047 §2.

            `touch-none`, or a touch on the handle scrolls the panel instead of carrying
            the block, and the pointer capture never sees a move.
          */}
          <span
            {...grip}
            aria-hidden="true"
            className={cn(
              // A hit area wider than the mark in it. Sixteen pixels of icon is a target
              // a pointer has to aim at, and `-m-3xs p-3xs` grows what can be grabbed
              // without moving anything on screen.
              '-m-3xs shrink-0 touch-none p-3xs text-stroke-strong transition-colors',
              // Brighter when the pointer is anywhere on the row, not only on the grip
              // itself. ADR 0047's "What it costs" hands the affordance to the
              // carrying-out, and a cold review said the grip read as decoration: a mark
              // that answers to the whole row is what says it is a control before
              // somebody has found its own few pixels.
              carried
                ? 'cursor-grabbing text-accent'
                : 'cursor-grab group-hover:text-on-canvas-muted hover:text-on-canvas',
            )}
          >
            <GripVertical aria-hidden="true" className="size-[1rem]" />
          </span>
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
              {off && <Badge variant="outline">{intl.formatMessage(COPY.rowOff)}</Badge>}
              {isChanged && <Badge>{intl.formatMessage(COPY.rowChanged)}</Badge>}
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
                at === null
                  ? intl.formatMessage(off ? COPY.switchOnAtStart : COPY.switchOffAtStart, {
                      block: spoken,
                    })
                  : intl.formatMessage(off ? COPY.switchOnAt : COPY.switchOffAt, {
                      block: spoken,
                      time: at,
                    })
              }
              onClick={() => onHidden(!off)}
            >
              {off ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
            <Button
              ref={up}
              variant="ghost"
              size="icon"
              className="size-[2rem]"
              disabled={index === 0}
              aria-label={intl.formatMessage(COPY.moveUp, { block: spoken })}
              onClick={() => {
                pressed.current = -1;
                onMove(-1);
              }}
            >
              <ArrowUp aria-hidden="true" />
            </Button>
            <Button
              ref={down}
              variant="ghost"
              size="icon"
              className="size-[2rem]"
              disabled={last}
              aria-label={intl.formatMessage(COPY.moveDown, { block: spoken })}
              onClick={() => {
                pressed.current = 1;
                onMove(1);
              }}
            >
              <ArrowDown aria-hidden="true" />
            </Button>
            {/*
            ADR 0045 §4: remove always deletes, and §5 is why that is not ambiguous —
            switching a block off is the eye two buttons to the left, and the row
            collapsing is what tells the two apart on screen.

            No confirmation, and that is a decision rather than an omission. The document
            is not the file until Save, "Back to the file" is one press away and undoes
            every edit in the session, and a dialog in front of an edit that is already
            reversible teaches people to dismiss dialogs. What the label carries instead
            is the word: `Remove`, not `Hide`.
          */}
            <Button
              variant="ghost"
              size="icon"
              className="size-[2rem] hover:text-red-500"
              aria-label={intl.formatMessage(COPY.rowRemove, { block: spoken })}
              onClick={onRemove}
            >
              <Trash2 aria-hidden="true" />
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
              {at === null
                ? intl.formatMessage(COPY.offAtStart)
                : intl.formatMessage(COPY.offAt, { time: at })}
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
      </div>
    </li>
  );
}

/** The mark that says a value is this moment's rather than something it was handed. */
function Here() {
  const intl = useWorkbenchIntl();

  return (
    <span className="rounded-s bg-accent px-3xs py-4xs text-[0.6875rem] font-semibold uppercase text-white">
      {intl.formatMessage(COPY.setHere)}
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
  const intl = useWorkbenchIntl();
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
            <option value="">{intl.formatMessage(COPY.noPin)}</option>
            {HOME_PINS.map((item) => (
              <option key={item.url} value={item.url}>
                {item.title}
              </option>
            ))}
          </select>
          {PIN_SOURCE?.status === 'sample' && (
            <span className={NOTE}>
              <Badge variant="outline">{intl.formatMessage(COPY.sampleBadge)}</Badge>{' '}
              {intl.formatMessage(COPY.sample, { standsIn: PIN_SOURCE.standsIn, code })}
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
