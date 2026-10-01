import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  EyeOff,
  GitPullRequest,
  GripVertical,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { defineMessages } from 'react-intl';

import {
  audienceOf,
  readerOf,
  reaches,
  type Audience,
} from '@correctiv/app-core/lib/home-audience';
import {
  MINUTES_IN_DAY,
  stateAtInstant,
  type HomeChange,
  type HomeEdition,
  type HomeLayout,
  type HomeSection,
  type MinuteOfDay,
} from '@correctiv/app-core/lib/home-layout';
import { HOME_PINS } from '@correctiv/app-core/data/home-pins';

import { SOURCES } from '../../../content/sources.manifest';
import { useWorkbenchIntl } from '../../i18n/Localisation';
import { say } from '../../i18n/messages';
import { AppHost } from '../../components/AppHost';
import { scroller } from '../scroller';
import { cn } from '../../lib/cn';
import { Badge } from '../../ui/kit/badge';
import { Button } from '../../ui/kit/button';
import { InfoTip } from '../../ui/kit/info-tip';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '../../ui/kit/popover';
import { Select } from '../../ui/kit/select';
import { DEFAULT_DEVICE, preset } from '../devices';
import { entitlementIn, sessionSnapshot, subscribeSession } from '../frame/seed';
import { Conditions } from './Conditions';
import type { PreviewState } from '../state';
import { liftFor, scrollStep, shiftFor, slotFrom, type Drawn } from './carry';
import { HomeBlock } from './HomeBlock';
import { InsertMark } from './Palette';
import { EDITION_COPY, EditionHead, inkOf, nameOf, Warning } from './Edition';
import { openedAt, parseMinute, playheadFrom, STEP, timeAt } from './minutes';
import {
  changedAt,
  changeHeldAt,
  decidedAt,
  editableAt,
  differs,
  formatTimeOfDay,
  HOME_LAYOUT_FILE,
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
  strandingAudiences,
  takenAudiences,
  inheritedFor,
  targetAt,
  withoutMoment,
  blockName,
  whereAt,
  withAudience,
  writeChangeAudience,
  writeHidden,
  writeSetting,
  type CountSetting,
  type Point,
  type SettingSpec,
} from './document';
import { guarded as isGuarded } from './scenario';
import { ScenarioBar, type ScenarioControl } from './Scenario';
import { getLayout, setLayout, subscribeLayout } from './store';
import { copyNow } from '../clipboard';
import { canSave, publish, save, submission, type SaveResult } from './write';

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
 * A block switched off at the playhead is drawn greyed rather than collapsed away — ADR
 * 0045 §2 kept its row and took the drawing, and ADR 0053 §1 keeps the drawing, because in
 * a list that is a screen a collapsed block is a hole. What §2 was defending is untouched
 * and is the decision the interview turned on: a list that hid what is off would make
 * "remove" mean *not on the home screen at all* and *not at this hour* with nothing on
 * screen telling the two apart, and it would make a second callout unpickable and so
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
 * `settingLabel`, `blockName` and `whereAt`. They are descriptors too, declared there
 * with `wbMessage` because that module is a table the dev server and the tests load in
 * Node, and they take a formatter as an argument rather than reaching for a hook. So
 * the values arriving inside the sentences below are German as well, and `say` is what
 * formats the one of them that may still be a bare string: a module id this tool has no
 * name for.
 */
const COPY = defineMessages({
  rule: {
    id: 'home.document.rule',
    defaultMessage:
      'A moment holds only what changes at that time. Everything else carries on as before.',
    description:
      'Behind the ⓘ in the head of the point being edited, and the one rule that makes the rest legible: a moment holds the difference from the point before it rather than the whole state.',
  },
  follow: {
    id: 'home.document.follow',
    defaultMessage: 'Scroll the frame to the block you point at',
  },
  revert: {
    id: 'home.document.revert',
    defaultMessage: 'Discard changes',
    description:
      'Throws away every edit of this session and goes back to the document as the repository has it.',
  },
  submit: {
    id: 'home.document.submit',
    defaultMessage: 'Submit changes',
    description:
      'The editor’s primary action, on the published site and on a dev server alike. It opens a prefilled GitHub issue in a new tab, which a workflow turns into a pull request (ADR 0061). Disabled while nothing has changed.',
  },
  submitHint: {
    id: 'home.document.submitHint',
    defaultMessage:
      'GitHub opens with your change filled in. One click on “Create” submits it. You need a GitHub account.',
    description:
      'The one line under Submit changes. “Create” is GitHub’s own button on the page that opens, which GitHub labels in English, so it stays in English.',
  },
  submitHintLong: {
    id: 'home.document.submitHintLong',
    defaultMessage:
      'This change is too long for a link. The click copies it to your clipboard, and you paste it in on GitHub. You need a GitHub account.',
    description:
      'Stands in for home.document.submitHint when the change is too long to travel in the address, so it has to go by the clipboard.',
  },
  submitCopied: {
    id: 'home.document.submitCopied',
    defaultMessage: 'The change is on your clipboard. Paste it into the issue on GitHub.',
  },
  submitNoClipboard: {
    id: 'home.document.submitNoClipboard',
    defaultMessage:
      'The browser did not let this page use the clipboard. Copy the change from this field and paste it into the issue on GitHub.',
  },
  documentField: {
    id: 'home.document.field',
    defaultMessage: 'The change',
    description:
      'The name read out for the field that holds the issue’s text when the clipboard was refused.',
  },
  save: { id: 'home.document.save', defaultMessage: 'Save to the repository' },
  changed: {
    id: 'home.document.changed',
    defaultMessage: 'changed',
    description:
      'The word beside Submit changes while the document differs from the file. home.row.changed is the badge on a single block’s row and tools.tokens.changed the badge on an overridden colour; all three read the same in English.',
  },
  unchanged: { id: 'home.document.unchanged', defaultMessage: 'unchanged' },
  submitNote: {
    id: 'home.document.submitNote',
    defaultMessage:
      'Submit changes opens a new issue on GitHub with your change in it. A pull request is then made from the issue automatically. Your change reaches the app once someone has checked and merged it. This page stores no password and no token.',
    description: 'Behind the ⓘ beside Submit changes: what happens after the click.',
  },
  saveNote: {
    id: 'home.document.saveNote',
    defaultMessage:
      'On a dev server, Save writes <code>{file}</code> in your own checkout. It refuses anything the core cannot read. This is a shortcut for developers. The way to a pull request is Submit changes.',
    description:
      'Says what Save does before anybody presses it, on a dev server only. The tag wraps {file}, the repository path of the document, drawn in a monospace face.',
  },
  scenarioGuard: {
    id: 'home.document.scenarioGuard',
    defaultMessage: 'Scenarios are examples. They are not submitted.',
    description:
      'Under the switched-off Submit changes, and under the switched-off Save on a dev server, while a scenario is open or the document still holds one. Submitting or saving it would publish the example on every phone.',
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
    defaultMessage: 'from midnight until {until}',
    description:
      'Beside the day’s start, the way home.point.span stands beside a moment: how long it lasts. {until} is the time the first moment takes over, as 18:30, or the word for midnight where there is none. That every moment builds on it is behind the ⓘ beside it, home.document.rule.',
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
    defaultMessage: 'This day has no moments. The home screen looks the same all day.',
  },

  rowOff: {
    id: 'home.row.off',
    defaultMessage: 'off',
    description:
      'Read out for a block that is switched off at the point being edited. Since ADR 0053 §1 the block is still drawn, greyed and faded, so on screen this is a small mark in the gutter and the sentence exists for a reader who cannot see that it is grey.',
  },
  rowChanged: {
    id: 'home.row.changed',
    defaultMessage: 'changed',
    description:
      'Read out for a block this moment changes something about. home.document.changed is the word beside the Save button and tools.tokens.changed the badge on an overridden colour; all three read the same in English. On screen this is a dot in the gutter, so the sentence is what carries it to somebody who cannot see the colour.',
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
  details: {
    id: 'home.row.details',
    defaultMessage: 'Settings and details for {block}',
    description:
      'The accessible name of the button that opens a block’s popover: its name, what it draws, its id, and whatever settings its module declares. {block} is the block’s own name, in English out of document.ts.',
  },
  offAtStart: {
    id: 'home.row.offAtStart',
    defaultMessage: 'Not on screen at the start of the day.',
    description:
      'Says when a switched-off block is off, in its details popover. The block itself is drawn greyed since ADR 0053 §1, which says THAT it is off but not from when.',
  },
  offAt: {
    id: 'home.row.offAt',
    defaultMessage: 'Not on screen at {time}.',
    description:
      'The same, while a moment is being edited rather than the day’s start. {time} is the moment’s time of day, as 18:30.',
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
      'A fixed selection of real articles, standing in for what WordPress will send later.',
    description:
      'Behind the ⓘ beside the sample-data badge, for the newsroom, so it names no file. The list of articles to pin is a checked-in stand-in until WordPress can answer which articles may lead the app.',
  },
  sampleQuote: {
    id: 'home.setting.sampleQuote',
    defaultMessage: 'In the source inventory:',
    description:
      'Behind the same ⓘ, above a quotation printed as the source inventory writes it, in English: what the checked-in list stands in for. The page that shows the inventory is called “Statusübersicht der Quellen” in German.',
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
  /** Where the block was in `layout.sections` when it was picked up. */
  from: number;
  /**
   * Where it would land, counted among the OTHER blocks, which is what `./carry.ts`
   * answers and what `moved()` takes as a destination. It is also where the block is
   * currently drawn, because ADR 0053 §2 draws the list in the order a release would
   * produce.
   */
  slot: number;
  /**
   * How far down inside the block the pointer took hold of it.
   *
   * Without it the slot would be decided by the pointer rather than by the block, and
   * `./carry.ts` records what that costs on a list of blocks this uneven: grabbing the
   * hero halfway down put it two places below where it started before anything had moved.
   */
  grab: number;
  /**
   * The list as it rests, measured when the slot was last asked for.
   *
   * Held rather than re-measured during a render, because a render that measures is a
   * render that can disagree with the one before it. Every row's offset comes out of this
   * (`shiftFor`, `liftFor`), so the whole preview is one reading of the list.
   */
  rows: Drawn[];
  /**
   * Where the pointer was, so that a scroll can re-ask the question without a move.
   *
   * The slot was recomputed on `pointermove` alone, so a wheel during a carry left the
   * block drawn at a place that had scrolled out of sight, and a release there dropped at it.
   */
  y: number;
}

/** The dock's ground is `surface`, so a card inside it steps back to `canvas`. */
const CARD = 'rounded-md border border-stroke bg-canvas';

/**
 * The strip down the left of every block, which is the one thing the list keeps that the
 * app has not got.
 *
 * ADR 0053 §1 makes the list the screen, and the hazard that comes with it is a list that
 * is mistaken for the app — the frame is a foot to the right and it is the one that
 * answers a tap. So the column is not flush with the panel: it stands beside a gutter
 * carrying the handle and the two marks a person may not have to hover to see, and that
 * gutter is what says, without a word, that this is an editor rather than a screen.
 *
 * A number because the block column is sized against it: `wide` below is the phone plus
 * this, so a drawing at a scale of 1 leaves the marks their own room instead of standing
 * under them.
 */
const GUTTER = 26;
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
  scenario,
}: {
  state: PreviewState;
  onChange: (patch: Partial<PreviewState>) => void;
  /** The scenario list and what it has open, from `useScenario` on the page. */
  scenario: ScenarioControl;
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
  /**
   * Whose screen this is (ADR 0041's cost, ADR 0060 §4): the session the framed app holds,
   * read out of the storage the two share and followed as it changes, whether a fixture
   * wrote it, the held-open door did, or somebody signed in inside the frame
   * (`frame/seed.ts` says why it is not read off the address). Not a second mechanism for
   * previewing an audience: `s=onboarded` is a paying member, `s=free-member` a free one.
   */
  const session = useSyncExternalStore(subscribeSession, sessionSnapshot, () => null);
  const reader = useMemo(() => readerOf(entitlementIn(session)), [session]);
  const [result, setResult] = useState<SaveResult | null>(null);
  /**
   * Only for a change too long for the address: whether the click put it on the clipboard,
   * or the clipboard was refused and the field below holds it instead.
   */
  const [copied, setCopied] = useState<'copied' | 'no-clipboard' | null>(null);
  const copyField = useRef<HTMLTextAreaElement>(null);
  const dirtyStatusId = useId();
  const submitHintId = useId();
  const saveGuardId = useId();
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
   * **A scroll re-asks where the pointer is.** The slot was recomputed on `pointermove`
   * alone, so a wheel during a carry left the block drawn at a place that had scrolled
   * away. Capture, because the panel is what scrolls and a scroll does not bubble.
   *
   * **And a block held at an edge scrolls the panel**, which ADR 0053 §2 decides. The
   * pointer is captured for the length of a carry, so without this the only
   * way to reach the far end of the day was a wheel, and on a touch screen there was no
   * way at all. The speed is `scrollStep`, which is arithmetic and has a test; this is
   * the frame loop around it.
   *
   * It re-asks nothing itself. Moving the panel fires the `scroll` above, which is
   * already the line that recomputes the slot from the remembered pointer — so the list
   * reorders under a hand that is holding still, which is the whole point of it.
   */
  useEffect(() => {
    if (carried === null) return;
    const abandon = (event: KeyboardEvent) => {
      if (event.key === 'Escape') carry(null);
    };
    const followed = () => {
      const held = carrying.current;
      if (held !== null) carry(aimed(held, held.y));
    };
    /*
     * The box found once per carry rather than once per frame: it cannot change while a
     * pointer is down, and `scroller` walks and calls `getComputedStyle` on every ancestor.
     */
    /*
     * The panel, or nothing. `scroller` falls back to the document's own scrolling element
     * when no ancestor scrolls, which is right for `frame/reveal.ts` and wrong here twice
     * over: its rect is the whole page rather than the part of it on screen, so the margins
     * would land off screen, and scrolling it would move the workbench instead of the list.
     * It is also the case where there is nothing to do — a list that does not overflow its
     * panel has no far end to reach.
     */
    const found = scroller(list.current);
    const panel = found === list.current?.ownerDocument.scrollingElement ? null : found;
    let frame = requestAnimationFrame(function tick() {
      const held = carrying.current;
      if (held === null) return;
      if (panel !== null) {
        const box = panel.getBoundingClientRect();
        const step = scrollStep(held.y, { top: box.top, bottom: box.bottom });
        if (step !== 0) panel.scrollTop += step;
      }
      frame = requestAnimationFrame(tick);
    });

    window.addEventListener('keydown', abandon);
    window.addEventListener('scroll', followed, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', abandon);
      window.removeEventListener('scroll', followed, true);
    };
    // `carry` and `aimed` are rebuilt every render and close over nothing that changes
    // while a pointer is down; what decides whether this listens at all is the carry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carried !== null]);

  /*
   * The same instant the track under the frame is drawing, out of the same two places:
   * the address while a time is simulated, and `openedAt()` while it is not.
   * `playheadFrom` is what keeps the two readings one rule.
   */
  const playhead = playheadFrom(state.time, openedAt());
  const minute = playhead.minute;
  const point = pointAt(layout, minute);
  const moment = momentAt(layout, point);
  const span = spanOf(layout, point);
  /*
   * What an edit lands on: the narrowest edition running at the playhead, or the day
   * (ADR 0059 §2). `point` above stays the day's, which is what the day's head names.
   */
  const target = targetAt(layout, playhead.instant);
  /* A minute of the playhead's day, in the spelling the address arrived in. */
  const timeOf = (next: MinuteOfDay) => timeAt(playhead, next);

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
    setCopied(null);
  }, [layout]);

  /*
   * Refused, the field holding the change is the next thing to do, so a keyboard goes
   * there. GitHub is already open in its own tab, waiting for the paste.
   */
  useEffect(() => {
    if (copied === 'no-clipboard') copyField.current?.focus();
  }, [copied]);

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

  /**
   * The list as it rests, and where its top edge is, at this instant.
   *
   * Measured on every move rather than once at the grab: a drawing inside a row can still
   * finish measuring itself while a block is carried, and boxes read once would be stale
   * by exactly the amount that makes a drop land one place out.
   *
   * **Heights from the boxes, tops summed from the heights.** Every row carries a
   * `translateY` while a block is being carried (ADR 0053 §2), and a rect would have that
   * folded in — asking the list where it is would then be asking it where this function
   * last put it. The document's order does not change during a carry, so a running sum of
   * the heights IS the resting layout, and a transform cannot disturb a height.
   *
   * List-RELATIVE, which is what makes a scroll during a carry free: the list moves with
   * its own rows, so the same pointer over the same block gives the same numbers whatever
   * the panel has scrolled to.
   */
  const measure = (): { rows: Drawn[]; listTop: number } | null => {
    const node = list.current;
    if (node === null) return null;

    let top = 0;
    const rows: Drawn[] = [...node.children].map((row) => {
      const height = row.getBoundingClientRect().height;
      const box = { top, height };
      top += height;
      return box;
    });

    return { rows, listTop: node.getBoundingClientRect().top };
  };

  /**
   * The carry as it would be with the pointer at `y`: where the block lands, and the
   * reading of the list that says so.
   *
   * The arithmetic on top of the measurement is `./carry.ts`, out there because a test in
   * this package can run that module and cannot run this one. What is handed to it is the
   * BLOCK's top edge and not the pointer's — `carry.ts` records what that difference cost
   * on a list of blocks this uneven.
   */
  const aimed = (held: Carry, y: number): Carry => {
    const seen = measure();
    if (seen === null) return { ...held, y };
    return {
      ...held,
      rows: seen.rows,
      slot: slotFrom(seen.rows, held.from, y - seen.listTop - held.grab),
      y,
    };
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
       * than allowed to take over: taking over is the two-finger failure `Carry` records.
       */
      if (event.button !== 0 || !event.isPrimary || carrying.current !== null) return;
      // Or the browser starts a text selection across the whole panel instead.
      event.preventDefault();
      /*
       * **The capture stays on the handle, and ADR 0053 §2 is what allows that.** A first
       * version of §2 really reordered the list while a block was carried, and the handle
       * lost the pointer on the first move that changed anything: React reorders keyed
       * children with `insertBefore`, the DOM performs that as a remove and an insert, and
       * Chrome releases an implicit capture the moment the capturing element is removed.
       * Measured on the dev server — `lostpointercapture` fired, and the block followed the
       * hand exactly once and then stopped. Nothing moves in the DOM now, so nothing here
       * has to be defended against it.
       */
      event.currentTarget.setPointerCapture(event.pointerId);
      /*
       * Where inside the block the hand took hold of it. Read off the row rather than off
       * the handle, because the handle is 16 pixels at the top of a block that can be four
       * hundred tall and the block is the thing being positioned.
       */
      const row = event.currentTarget.closest('li');
      const grab = row === null ? 0 : event.clientY - row.getBoundingClientRect().top;
      const seen = measure();
      carry({
        pointer: event.pointerId,
        id,
        from,
        slot: from,
        grab,
        rows: seen?.rows ?? [],
        y: event.clientY,
      });
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const held = mine(event);
      if (held !== null) carry(aimed(held, event.clientY));
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      /*
       * **An event from another pointer leaves this carry alone**, and the two cases were
       * one line until a cold review separated them. `mine` answers `null` both when
       * nothing is carrying and when the release belongs to a DIFFERENT pointer, and
       * clearing the carry on the second of those is the two-finger failure `Carry`'s
       * `pointer` field exists for, arriving from the other end: one finger drags the
       * header, a second finger rests on another row's handle and lifts, and the first
       * finger's block is put down mid-gesture. The `pointer` field stops the hijack; this
       * stops the abandon. `onPointerCancel` below already had the right shape.
       */
      const held = mine(event);
      if (held === null) return;

      /*
       * A release away from the list puts the block back. Without that test, letting go
       * anywhere at all reordered the day, including out over the phone frame nine hundred
       * pixels away — which is the only way out of a drag somebody has started and thought
       * better of, since ADR 0047 §1 gives the handle no key to press.
       */
      if (!overList(event.clientX)) {
        carry(null);
        return;
      }

      /*
       * **The slot on screen, and not a fresh reading of it.** This used to re-ask with the
       * release's own `clientY`, against a stale slot left by the last `pointermove` — a
       * wheel moves every row without producing a move event. That hole is closed at the
       * other end now: the `scroll` listener re-aims on any scroll, the panel's own
       * autoscroll included, so `held.slot` is what the last painted frame showed.
       *
       * Re-asking here is then not merely redundant but wrong by a frame. While the
       * autoscroll is running at up to eighteen pixels a frame, and a block half as tall as
       * that stands beside the seam, one unpainted frame of scroll can cross a midpoint —
       * so the block would land one place from where the hand let go of it. What somebody
       * saw is what they meant.
       */
      carry(null);
      setLayout(moved(layout, held.id, held.slot - held.from));
    },
    // A touch the browser takes over — a scroll gesture, a call coming in — ends the drag
    // without an up, and the block has to go back rather than stay picked up for ever.
    onPointerCancel: (event: PointerEvent<HTMLElement>) => {
      if (mine(event) !== null) carry(null);
    },
  });

  /*
   * What the frame shows at the playhead, and what the target would show without its own
   * point. For the day these are `effectiveAt` and `inheritedAt` as they always were; with
   * an edition running they are the fold at the instant, which is the only honest reading
   * once what lies under an edition goes on changing through its span.
   */
  const effective = stateAtInstant(layout, playhead.instant, reader);
  const inherited =
    target.edition === null
      ? inheritedAt(layout, target.point, reader)
      : inheritedFor(layout, playhead.instant, target, reader);
  const edited = changedAt(layout, playhead.instant, reader);
  const decided = decidedAt(layout, playhead.instant, reader);
  const dirty = differs(layout);
  /**
   * Whether this document is a scenario, open or kept after leaving it (`./scenario.ts`).
   *
   * **Submit changes is switched off for one, with the reason under it**, rather than
   * asking for a confirmation. A submission is the real home document for every phone
   * (ADR 0061), and a scenario is an example with a date made up for it; a confirmation is
   * a button people learn to press. What is lost is little: promoting a scenario to the
   * real thing is copying its file (ADR 0036 §12), which is a pull request somebody writes
   * on purpose, and deleting the scenario's edition in the editor makes the document an
   * ordinary one that can be submitted.
   */
  const guarded = isGuarded(state.scenario, layout);
  /** Where Submit changes goes, or nothing while there is nothing to submit. */
  const offer =
    dirty && !guarded
      ? submission(layout, (message, values) => intl.formatMessage(message, values))
      : null;

  /**
   * How far each row is drawn from where the document lays it out, while a block is carried.
   *
   * ADR 0053 §2. The list keeps the document's order for the length of a carry and every
   * row is put where a release would put it with a `transform`, which costs no layout and
   * can therefore be transitioned. Nothing is written until the drop, so an abandoned
   * carry — Escape, a release off the list, a touch the browser takes over — needs no undo,
   * because nothing was done.
   *
   * The arithmetic is `./carry.ts` and its test holds the property the whole thing rests
   * on: a row's resting top plus its offset is exactly where the committed document would
   * lay it out. So clearing the transforms and writing the new order is, on screen, a
   * no-op, and the drop cannot jump.
   */
  const offsetOf = (id: string, index: number): number => {
    if (carried === null) return 0;
    if (id === carried.id) return liftFor(carried.rows, carried.from, carried.slot);
    const height = carried.rows[carried.from]?.height ?? 0;
    return shiftFor(index, carried.from, carried.slot, height);
  };

  return (
    <>
      {/*
        The document's own bar: first in the panel, and held at the top of it while the list
        scrolls. It says whether the document differs from the file, offers the way back to
        the file, and offers the way out (ADR 0061 §1). It used to sit under the whole list,
        which put the one action that matters a scroll away from every block it was about.

        `sticky` against the panel's own scroller, and the only sticky thing in it, so the
        warning in `ui/Lookup.tsx` about a second sticky row inside something already fixed
        does not apply. The negative margins take back the panel's padding, so the bar spans
        the panel and its border meets both edges.

        Two rows at the panel's width, and that is what keeps Back to the file apart from
        Submit changes: one throws work away, the other sends it, and an outline button
        beside a filled one at the same size reads as "pick either". So the status and the
        way back share the first row, and Submit changes has the second to itself, at the
        panel's full width, with the one line that says what it does under it.
      */}
      <div className="sticky top-0 z-10 -mx-s -mt-s flex flex-col gap-xs border-b border-stroke bg-canvas px-s py-xs">
        <ScenarioBar control={scenario} />
        <div className="flex flex-wrap items-center gap-xs">
          <span id={dirtyStatusId} className={cn(NOTE, 'mr-auto')}>
            {intl.formatMessage(dirty ? COPY.changed : COPY.unchanged)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!dirty}
            onClick={() => {
              // The file, and out of the scenario with it: "Discard changes" is the way
              // back to what readers see, and a scenario left open would be loaded again.
              setLayout(SHIPPED);
              if (scenario.open) scenario.close();
            }}
          >
            <RotateCcw aria-hidden="true" />
            {intl.formatMessage(COPY.revert)}
          </Button>
        </div>
        {/*
          A link and not a button, although it looks like one: the click leaves for GitHub in a
          new tab, and a link is what a browser lets open a tab without a popup blocker in the
          way. There is no step between the click and GitHub any more (ADR 0061 §1), so what the
          person needs to know is the one line under it, said before they press.

          Unchanged, it is a disabled button instead, because a link cannot be disabled and a
          link to an issue that would change nothing is the one thing this must not offer.
        */}
        <div className="flex items-center gap-xs">
          {offer ? (
            <Button asChild size="sm" className="min-w-0 flex-1">
              <a
                href={offer.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-describedby={submitHintId}
                onClick={() => {
                  // Too long for the address: the link carries a request to paste, and this
                  // puts the change where the paste will find it, inside the same click.
                  if (!offer.fits) setCopied(copyNow(offer.body) ? 'copied' : 'no-clipboard');
                }}
              >
                <GitPullRequest aria-hidden="true" />
                {intl.formatMessage(COPY.submit)}
              </a>
            </Button>
          ) : (
            <Button
              size="sm"
              className="min-w-0 flex-1"
              disabled
              data-testid="submit-disabled"
              // "unchanged" above it is why it is off, or the line under it for a scenario; a
              // disabled button says nothing of itself.
              aria-describedby={guarded ? submitHintId : dirtyStatusId}
            >
              <GitPullRequest aria-hidden="true" />
              {intl.formatMessage(COPY.submit)}
            </Button>
          )}
          {/* What happens after the click, for whoever wants to know, behind the ⓘ. */}
          <InfoTip about={intl.formatMessage(COPY.submit)} side="bottom" align="end">
            <p>{intl.formatMessage(COPY.submitNote)}</p>
          </InfoTip>
        </div>
        <p id={submitHintId} className={NOTE}>
          {intl.formatMessage(
            guarded
              ? COPY.scenarioGuard
              : offer && !offer.fits
                ? COPY.submitHintLong
                : COPY.submitHint,
          )}
        </p>

        {offer && copied !== null && (
          <div className="flex flex-col gap-xs">
            <output className="flex items-start gap-xs text-s text-on-canvas">
              {copied === 'copied' && (
                <Check aria-hidden="true" className="mt-4xs size-[0.875rem] shrink-0" />
              )}
              <span className="min-w-0">
                {intl.formatMessage(
                  copied === 'copied' ? COPY.submitCopied : COPY.submitNoClipboard,
                )}
              </span>
            </output>
            {copied === 'no-clipboard' && (
              <textarea
                ref={copyField}
                readOnly
                aria-label={intl.formatMessage(COPY.documentField)}
                value={offer.body}
                rows={8}
                onFocus={(event) => event.currentTarget.select()}
                className={cn(FIELD, 'font-mono text-[0.75rem] leading-snug')}
              />
            )}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2xs text-s text-on-canvas">
        <input
          type="checkbox"
          checked={follow}
          onChange={(event) => setFollow(event.target.checked)}
          className="size-[0.875rem] shrink-0 accent-accent"
        />
        {intl.formatMessage(COPY.follow)}
      </label>

      {target.edition === null ? (
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
      ) : (
        <EditionHead
          layout={layout}
          edition={target.edition}
          point={target.point}
          onLayout={setLayout}
          onGoTo={goTo}
        />
      )}

      {/*
        One environment around the whole list, not one per row. `AppEnvironment` mounts a
        store provider, an intl provider, a safe-area provider and a gesture root, and one
        per row would be one of each per row; `components/AppHost.tsx` says the rest.
      */}
      {/*
        The day, and on every seam a place to put a block. ADR 0045 §6 wants the mark at
        each end too, so there is one more of them than there are blocks.

        **Each mark lives inside a row**, the one it comes before, and the very last inside
        the last row — a `list` may own only `listitem`s, and since ADR 0053 §1 they take no
        height of their own anyway, so there is nothing left to be gained by putting one
        outside. The marks were their own `role="presentation"` items for a while and Chrome
        did report the twelve blocks as twelve items, but thirteen buttons as non-`listitem`
        children of a list is a thing other assistive technology may resolve differently,
        and a structure that is simply valid needs no prediction about who resolves what.

        **The order here is the document's, always**, which is ADR 0053 §2: while a block is
        carried every row is offset by a `transform` instead, so the list a person sees is
        the answer a release would write without the DOM having moved at all. `sameSection`
        is what keeps a carry from redrawing the whole list per pointer event.
      */}
      <AppHost>
        <ol
          ref={list}
          className="mx-auto flex w-full flex-col"
          /*
           * The phone's own width plus the gutter, centred in whatever the panel has.
           * ADR 0045 §3 refuses to scale a block UP, so on a wide window the drawing would
           * otherwise stand in a row half again its size with the controls floating out in
           * the empty half. `Stage.tsx` centres the device frame with `m-auto` for the same
           * reason, and this is the list's version of it.
           */
          style={{ maxWidth: deviceWidth + GUTTER }}
        >
          {layout.sections.map((section, index) => (
            <Row
              key={section.id}
              section={effective.find((held) => held.id === section.id) ?? section}
              inherited={inherited.find((held) => held.id === section.id) ?? section}
              point={target.point}
              layer={target.edition === null ? null : nameOf(target.edition)}
              decidedBy={
                layout.editions.find((edition) => edition.id === decided.get(section.id)) ?? null
              }
              index={index}
              last={index === layout.sections.length - 1}
              changed={edited.includes(section.id)}
              deviceWidth={drawing ? deviceWidth : null}
              follow={follow}
              before={
                carried === null ? (
                  <InsertMark
                    where={whereAt(intl, layout, index)}
                    deviceWidth={deviceWidth}
                    onAdd={(module) => setLayout(added(layout, index, module))}
                  />
                ) : null
              }
              after={
                carried === null && index === layout.sections.length - 1 ? (
                  <InsertMark
                    where={whereAt(intl, layout, layout.sections.length)}
                    deviceWidth={deviceWidth}
                    onAdd={(module) => setLayout(added(layout, layout.sections.length, module))}
                  />
                ) : null
              }
              grip={gripFor(section.id, index)}
              carried={carried?.id === section.id}
              shift={offsetOf(section.id, index)}
              /*
               * Only while something is being carried. The transition has to be gone in the
               * same commit that writes the new order, or the transforms would animate back
               * to nought while the layout jumps to meet them, and one move would be drawn
               * twice. React batches `carry(null)` and `setLayout` into one update, so this
               * goes at the same moment the offsets do.
               */
              dragging={carried !== null}
              onMove={(delta) => setLayout(moved(layout, section.id, delta))}
              onHidden={(hidden) =>
                setLayout(writeHidden(layout, playhead.instant, section.id, hidden, reader))
              }
              onSetting={(key, value) =>
                setLayout(writeSetting(layout, playhead.instant, section.id, key, value, reader))
              }
              reaches={reaches(reader, audienceOf(section))}
              locked={!editableAt(layout, playhead.instant, section.id, reader)}
              change={changeHeldAt(layout, playhead.instant, section.id, reader)}
              taken={takenAudiences(layout, playhead.instant, section.id, reader)}
              stranding={strandingAudiences(layout, playhead.instant, section.id, reader)}
              onAudience={(audience) => setLayout(withAudience(layout, section.id, audience))}
              onChangeAudience={(audience) =>
                setLayout(
                  writeChangeAudience(layout, playhead.instant, section.id, audience, reader),
                )
              }
              onRemove={() => setLayout(removed(layout, section.id))}
              outline={outline}
            />
          ))}
        </ol>
      </AppHost>

      {/*
        On a dev server, Save, and what it does behind the ⓘ beside it. `canSave` is
        `import.meta.env.DEV`, so the published site offers no Save and says nothing about
        one, which is the shape the Tokens tool already has for a thing it cannot write.
      */}
      {canSave && (
        <div className="flex flex-col gap-2xs">
          <div className="flex items-center gap-xs">
            <Button
              variant="outline"
              size="sm"
              // Guarded as Submit changes is: Save writes the file every phone gets once it is
              // committed, so a scenario saved by accident is the election night shipped by
              // accident. Promoting one on purpose is copying its file (ADR 0036 §12).
              disabled={!dirty || guarded}
              aria-describedby={guarded ? saveGuardId : undefined}
              onClick={() =>
                void save(layout, (message, values) => intl.formatMessage(message, values)).then(
                  setResult,
                )
              }
            >
              <Save aria-hidden="true" />
              {intl.formatMessage(COPY.save)}
            </Button>
            <InfoTip about={intl.formatMessage(COPY.save)}>
              <p>{intl.formatMessage(COPY.saveNote, { code, file: HOME_LAYOUT_FILE })}</p>
            </InfoTip>
          </div>
          {guarded && (
            <p id={saveGuardId} className={NOTE}>
              {intl.formatMessage(COPY.scenarioGuard)}
            </p>
          )}
        </div>
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
          <span className={NOTE}>
            {intl.formatMessage(COPY.pointStartLead, { until })}{' '}
            <RuleTip about={intl.formatMessage(COPY.pointStart)} />
          </span>
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
          <span className={NOTE}>
            {intl.formatMessage(COPY.pointSpan, { until, changes })}{' '}
            <RuleTip about={intl.formatMessage(COPY.pointTime)} />
          </span>
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
      {/*
        Which layer an edit lands on, said every time and not only when it is an edition:
        a line that appears only sometimes is a line nobody learns to look for (ADR 0059
        §2). `Edition.tsx` says the other half of it.
      */}
      <span className="w-full text-s font-medium text-on-canvas">
        {intl.formatMessage(EDITION_COPY.landsOnDay)}
      </span>
    </div>
  );
}

/**
 * The rule that makes the rest legible and that nothing on screen states: a moment holds
 * the difference and not the state.
 *
 * It was the one sentence left above the editor, out of four. The other three described
 * the track, the list and the frame, which a reader is looking at while they read that
 * they are looking at them. This one is background, which is wanted once, so it waits in
 * the head of the point it is about.
 */
function RuleTip({ about }: { about: string }) {
  const intl = useWorkbenchIntl();
  return (
    <InfoTip about={about} align="end">
      <p>{intl.formatMessage(COPY.rule)}</p>
    </InfoTip>
  );
}

/**
 * One place, drawn where it stands in the day.
 *
 * ADR 0053 §1 takes the card off it: no border, no gap between it and its neighbours, no
 * name and no sentence. What is left is the block as the app draws it, a gutter beside it,
 * and a bar of controls that appears when a pointer or the keyboard is in the row.
 *
 * ## The controls are revealed, not conditional
 *
 * They are in the tree at all times, and only their opacity and their pointer events
 * follow the hover. That is the whole of what lets ADR 0045 §7 survive this change: the
 * arrow buttons are the keyboard's route through the order, §7 says in as many words that
 * an arrangement reachable only by a mouse would be this repository shipping the thing it
 * spent [#199](https://github.com/correctiv/correctiv-app/pull/199) taking out of the app,
 * and a control that is `hidden` until hovered is exactly that. `group-focus-within` is
 * what shows the bar to somebody tabbing into it.
 *
 * The focus restoration below matters more here than it did in the card, and is the same
 * code: pressing "Move up" until the block reaches the top disables that button, the
 * browser blurs it, and focus lands on `<body>` — which in a revealed bar also closes the
 * bar over the block somebody was moving.
 *
 * ## Where the state is said, now that there is no room to say it
 *
 * Every control still answers the one question the model asks — **inherited** or **set
 * here**. What changed is where. The gutter carries the two marks that must not need a
 * hover to be seen, and the popover carries the per-value ones beside the values they are
 * about (§3). Both marks carry their own sentence for a reader who cannot see a grey
 * drawing or an accent dot, because the badges that used to say the words are gone.
 */
function Row({
  section,
  inherited,
  point,
  layer,
  decidedBy,
  index,
  last,
  changed: isChanged,
  deviceWidth,
  follow,
  before,
  after,
  grip,
  carried,
  shift,
  dragging,
  onMove,
  onHidden,
  onSetting,
  reaches: forReader,
  locked,
  change,
  taken,
  stranding,
  onAudience,
  onChangeAudience,
  onRemove,
  outline,
}: {
  section: HomeSection;
  inherited: HomeSection;
  /** The point of the layer being edited: a moment's minute, or null for the layer's start. */
  point: Point;
  /**
   * The name of the edition an edit lands on, or null for the day.
   *
   * With `point` it says where a write goes: the day's start, a moment of the day, an
   * edition's start, or a moment of an edition. The sentences below choose on both.
   */
  layer: string | null;
  /** The edition that decides this block's state at the playhead, or null. The hairline. */
  decidedBy: HomeEdition | null;
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
  /** Whether the reader in the frame is in this block's audience (ADR 0060 §4). */
  reaches: boolean;
  /**
   * Whether this point holds changes about the block and none for the reader in the frame,
   * so an edit here would land on nobody's screen being looked at (ADR 0060 §5).
   */
  locked: boolean;
  /** The change an edit at the playhead lands on for this block, if there is one. */
  change: HomeChange | undefined;
  /** The audiences other changes about the block at this point already carry. */
  taken: ReadonlySet<Audience>;
  /** The audiences a retarget here would strand one half of a swap with. */
  stranding: ReadonlySet<Audience>;
  /** Who the block is for, all day. */
  onAudience: (audience: Audience) => void;
  /** Who the change at the playhead is for. */
  onChangeAudience: (audience: Audience) => void;
  /** Takes the block out of the day, and every change that named it with it. */
  onRemove: () => void;
  outline: (held: { id: string; follow: boolean } | null) => void;
  /** Whether hovering this row scrolls the frame to it. The panel's setting, not the row's. */
  follow: boolean;
  /**
   * The seam above this block, as a control, and below it on the last row only.
   *
   * Both are laid over the seam rather than set in it: ADR 0053 §1 leaves no gap between
   * two blocks to put a control in, so the mark takes no height of its own and straddles
   * the join. `null` while a block is being carried, because the carried block is already
   * showing where it would land and a row of hairlines offering to add would be a second
   * answer to a question nobody asked.
   */
  before: ReactNode;
  after: ReactNode;
  /**
   * What the drag handle listens to. ADR 0047 §1: a pointer route and nothing else, so
   * these are the whole of it and there is no key to press.
   *
   * The capture is taken here, on the handle, which ADR 0053 §2 is what allows: nothing
   * moves in the DOM during a carry, so there is no removal for the browser to release it
   * on. `gripFor` carries the measurement of what happened when something did.
   */
  grip: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  };
  /** Whether this is the block a pointer is carrying right now. */
  carried: boolean;
  /**
   * How far from its resting place this row is drawn, in pixels, while a block is carried.
   *
   * A `transform` and never a change of order: ADR 0053 §2 keeps the document's order in
   * the DOM for the length of a carry, so that the preview costs no layout, can be
   * transitioned, and cannot lose the pointer it is being dragged by.
   */
  shift: number;
  /**
   * Whether a block — this one or another — is being carried right now.
   *
   * Two things follow from it and they are one fact, so they are one prop: the offset above
   * is animated, and the seams stop offering to add into a list that is mid-answer.
   */
  dragging: boolean;
}) {
  const intl = useWorkbenchIntl();
  /*
   * What the row's controls call this block when they are read out. The module's own name
   * alone is not enough, because two sections of one module share it — `document.ts` says
   * what that cost in the accessibility tree.
   */
  const spoken = blockName(intl, section);
  /*
   * The point being edited, as a time, or `null` for the day's start. Read once here
   * because several sentences below choose between two messages on it, and a second
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

  /**
   * Whether the block's popover is open, held here rather than left to Radix.
   *
   * The bar this opens from is revealed by a hover, and a popover whose trigger fades out
   * from under the pointer the moment somebody moves across to read it is a control that
   * cannot be used. So the open state feeds back into the bar below.
   */
  const [open, setOpen] = useState(false);

  const off = Boolean(section.hidden);
  const specs = settingsFor(section.module);
  /* Anywhere but the day's start, a value can be this point's own rather than handed down. */
  const layered = point !== null || layer !== null;
  const hiddenHere = layered && Boolean(inherited.hidden) !== off;

  return (
    /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */
    <li
      className={cn(
        'group relative flex',
        /*
         * The carried block: faded and in COLOUR, against a switched-off block, which is
         * faded and grey (`HomeBlock.tsx`). Two marks that have to be told apart at a
         * glance, and opacity alone would have made them one mark at two strengths.
         *
         * And above its neighbours while it travels, or a block gliding past a taller one
         * would pass behind it. `z-10` and not more: the control bar sits at `z-30` inside
         * whichever row a pointer is over, and this must not cover one.
         *
         * The shadow is what the fade costs. A translucent block crossing a neighbour
         * mid-slide shows the neighbour through itself, which in a still reads as a smear
         * — caught in `screens/evidence/236-konfigurator-drag.webp`, which is that frame.
         * An edge under it is what keeps the two blocks apart for the tenth of a second
         * they overlap, without making the block opaque and so taking the fade away.
         */
        carried && 'z-10 opacity-60 shadow-xl',
        /*
         * `transform` and nothing else is transitioned. A transition on `all` would catch
         * the opacity above, so a block would fade in as it was picked up rather than
         * saying so at once, and it would catch the bar's own fade a second time.
         */
        /*
         * Short. Long enough to be a slide rather than a jump, short enough that the
         * overlap the shadow above is for is over before it is read as one.
         */
        dragging && 'transition-transform duration-100 ease-out',
      )}
      style={{ transform: shift === 0 ? undefined : `translateY(${shift}px)` }}
      /*
        Nothing here makes the row operable; the handlers only relay whether the pointer or
        the focus is somewhere inside it, and every control a person can act on is one of
        its own buttons and labels.

        `outline` is called with `section.id` whether or not `off` is true, and this row
        does not check it first. A moment can hide a place at the point being previewed —
        `off` is exactly that fact — and the deliberate choice is to let the lookup in
        `frame/highlight.ts` discover the absence itself: it finds no matching element and
        clears whatever mark was there, which is the same quiet nothing a mistyped id or an
        unrendered module would produce. The greyed drawing already tells a person the
        block is not on screen; the outline does not need to say it twice, and a row cannot
        drift out of sync with a mechanism it does no filtering of its own.
      */
      onPointerEnter={() => outline({ id: section.id, follow })}
      onPointerLeave={() => outline(null)}
      onFocus={() => outline({ id: section.id, follow })}
      onBlur={() => outline(null)}
    >
      {/*
        The gutter, which is the one thing this list has that the app has not. It is what
        stops the column being mistaken for the app — the frame a foot to the right is the
        one that answers a tap — and it is where the two marks live that a person must not
        have to hover to see.
      */}
      <div className="flex shrink-0 flex-col items-center gap-4xs pt-3xs" style={{ width: GUTTER }}>
        {/*
          ADR 0047 §1: the pointer's route, and nothing else. No `tabindex`, no role and
          `aria-hidden`, because a handle that looked focusable while doing nothing on a
          key would be the untested route wearing the tested one's clothes. The arrows in
          the bar are the keyboard's, by ADR 0047 §2.

          `touch-none`, or a touch on the handle scrolls the panel instead of carrying the
          block, and the pointer capture never sees a move.
        */}
        <span
          {...grip}
          aria-hidden="true"
          className={cn(
            // A hit area wider than the mark in it. Sixteen pixels of icon is a target a
            // pointer has to aim at, and the padding grows what can be grabbed without
            // moving anything on screen.
            'shrink-0 touch-none p-4xs text-stroke-strong transition-colors',
            // Brighter when the pointer is anywhere on the row, not only on the grip
            // itself. ADR 0047's "What it costs" hands the affordance to the carrying-out,
            // and a cold review said the grip read as decoration: a mark that answers to
            // the whole row is what says it is a control before somebody has found its own
            // few pixels.
            carried
              ? 'cursor-grabbing text-accent'
              : 'cursor-grab group-hover:text-on-canvas-muted hover:text-on-canvas',
          )}
        >
          <GripVertical aria-hidden="true" className="size-[1rem]" />
        </span>

        {/*
          The two marks, each with the word it stands for. On screen they are an icon and a
          dot; read out they are the badges this row used to carry, which is the half of
          them that had to survive ADR 0053 §1 taking the badges away. Colour and grey are
          not information a person can be assumed to have.
        */}
        {off && (
          <span className="text-on-canvas-muted">
            <EyeOff aria-hidden="true" className="size-[0.75rem]" />
            <span className="sr-only">{intl.formatMessage(COPY.rowOff)}</span>
          </span>
        )}
        {isChanged && (
          <span>
            <span aria-hidden="true" className="block size-[0.375rem] rounded-full bg-accent" />
            <span className="sr-only">{intl.formatMessage(COPY.rowChanged)}</span>
          </span>
        )}
      </div>

      {/*
        The popover is opened around the WHOLE block area rather than around its button,
        and `PopoverAnchor` is why: Radix places the panel against the anchor when there is
        one and against the trigger when there is not, and the trigger already sits at the
        panel's right edge. Anchored to it, "left" means left of a control that is nearly
        at the window's right, so the panel opens over the list. Measured at 1800px: it
        landed at x=1287 in a panel starting at x=1230, covering the blocks above the one
        it was about. Anchored to the block, the same word puts it out over the stage.
      */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative min-w-0 flex-1">
            {/*
              ADR 0059 §2: a block whose state an edition decides at the playhead carries a
              hairline at its edge in that edition's colour, so a glance down the list says
              what the campaign changed and where the ordinary day shows through. Over the
              drawing, at its left edge, where the gutter meets it.
            */}
            {decidedBy !== null && (
              <span
                className="edition-ink pointer-events-none absolute inset-y-0 left-0 z-10 w-[3px] bg-(--edition)"
                style={inkOf(decidedBy.id)}
              >
                <span className="sr-only">
                  {intl.formatMessage(EDITION_COPY.decides, { edition: nameOf(decidedBy) })}
                </span>
              </span>
            )}
            {/*
          Laid over the seam above this block, taking no height, so that two blocks meet
          the way they meet on the phone. ADR 0045 §6 is unchanged in what it asks for — a
          thin control between every pair and at each end — and only in what it may spend
          on it.
        */}
            {/*
          Hidden while anything is being carried, and **not** unmounted: a hairline that
          currently holds the keyboard's focus would take it to `<body>` on the way out, and
          a person who had tabbed to a seam would lose their place because somebody else's
          pointer picked up a block. `opacity-0` leaves focus where it is.
        */}
            <span
              className={cn(
                'absolute inset-x-0 top-0 z-20 -translate-y-1/2',
                dragging && 'pointer-events-none opacity-0',
              )}
            >
              {before}
            </span>

            {/*
          ADR 0053 §1. A block switched off at the playhead is drawn greyed rather than
          collapsed away: the whole day stays a screen, and a person can point at the block
          they mean whether or not it is showing. `HomeBlock` is what greys it, because it
          is what draws it.

          `deviceWidth` being null is the case a reader never sees: the panel is mounted
          behind the rail whether or not it is open, and nothing is drawn while it is shut.
        */}
            {deviceWidth !== null && (
              <HomeBlock section={section} deviceWidth={deviceWidth} absent={!forReader} />
            )}

            {/*
          The bar. `pointer-events-none` while it is invisible, or an unseen row of buttons
          sits over the top corner of every block and swallows what is aimed at the drawing
          underneath; focus is unaffected by that property, which is what keeps the
          keyboard's route through it open.
        */}
            <div
              className={cn(
                'absolute right-3xs top-3xs z-30 flex items-center gap-4xs',
                'rounded-md border border-stroke bg-canvas/95 p-4xs shadow-lg',
                'pointer-events-none opacity-0 transition-opacity',
                'group-hover:pointer-events-auto group-hover:opacity-100',
                'group-focus-within:pointer-events-auto group-focus-within:opacity-100',
                open && 'pointer-events-auto opacity-100',
                // Not over a block that is being carried: the block is answering a different
                // question just then, and a row of controls riding along with it invites a
                // press on something that is moving.
                /*
                  The hover reveal is what is switched off, not the element. `display: none`
                  here would blur a button that had the keyboard's focus at the moment
                  somebody grabbed this same row with the pointer, and nothing would put it
                  back. What is focused stays visible; what is merely under a pointer does
                  not.
                */
                carried && 'pointer-events-none opacity-0 group-hover:opacity-0',
              )}
            >
              {/*
            ADR 0045 §5: this was a checkbox labelled "Shown", under the name, with a badge
            beside it saying the value was set here. What the checkbox had to do was tell a
            person the block was off, and the greyed drawing does that now without a word —
            so what is left is the switching, which is an act rather than a field, and an
            act is a button.

            The two verbs live at two levels and §5 is where the pair is argued. On and off
            are a MOMENT'S: they change what a block is doing at an hour, and they are
            here. Add and remove are the DAY'S: they change which blocks exist at all.
          */}
              <Button
                variant="ghost"
                size="icon"
                aria-pressed={!off}
                className={cn('size-[1.75rem]', hiddenHere && 'text-accent')}
                aria-label={
                  at !== null
                    ? intl.formatMessage(off ? COPY.switchOnAt : COPY.switchOffAt, {
                        block: spoken,
                        time: at,
                      })
                    : layer !== null
                      ? intl.formatMessage(
                          off ? EDITION_COPY.switchOnIn : EDITION_COPY.switchOffIn,
                          {
                            block: spoken,
                            edition: layer,
                          },
                        )
                      : intl.formatMessage(off ? COPY.switchOnAtStart : COPY.switchOffAtStart, {
                          block: spoken,
                        })
                }
                disabled={locked}
                onClick={() => onHidden(!off)}
              >
                {off ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
              <Button
                ref={up}
                variant="ghost"
                size="icon"
                className="size-[1.75rem]"
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
                className="size-[1.75rem]"
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
            ADR 0053 §3. The name, the sentence about the module, the id and the module's
            own settings, in a panel beside the block rather than under it. What ADR 0045
            §8 decided is kept and only its form has moved: a setting is judged by what it
            does to the block, so the popover opens to the side and leaves the block it is
            about on screen. `ui/kit/popover.tsx` is where that side is chosen.
          */}
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn('size-[1.75rem]', open && 'text-accent')}
                  aria-label={intl.formatMessage(COPY.details, { block: spoken })}
                >
                  <SlidersHorizontal aria-hidden="true" />
                </Button>
              </PopoverTrigger>

              {/*
            ADR 0045 §4: remove always deletes, and §5 is why that is not ambiguous —
            switching a block off is the eye three buttons to the left, and the drawing
            going grey is what tells the two apart on screen.

            No confirmation, and that is a decision rather than an omission. The document is
            not the file until Save, "Back to the file" is one press away and undoes every
            edit in the session, and a dialog in front of an edit that is already reversible
            teaches people to dismiss dialogs. What the label carries instead is the word:
            `Remove`, not `Hide`.
          */}
              <Button
                variant="ghost"
                size="icon"
                className="size-[1.75rem] hover:text-red-500"
                aria-label={intl.formatMessage(COPY.rowRemove, { block: spoken })}
                onClick={onRemove}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>

            {/* The last seam of the day, which has no block after it to live above. */}
            {after !== null && (
              <span
                className={cn(
                  'absolute inset-x-0 bottom-0 z-20 translate-y-1/2',
                  dragging && 'pointer-events-none opacity-0',
                )}
              >
                {after}
              </span>
            )}
          </div>
        </PopoverAnchor>

        {/*
          Named, because Radix gives the panel `role="dialog"` and no name of its own — it
          has no `Title` helper the way its dialog does. Without this a reader who tabs back
          into an open popover is told only "dialog", and the block's name reached them
          once, on the trigger, at the moment they opened it.
        */}
        <PopoverContent aria-label={intl.formatMessage(COPY.details, { block: spoken })}>
          <Details
            section={section}
            inherited={inherited}
            layered={layered}
            layer={layer}
            at={at}
            off={off}
            hiddenHere={hiddenHere}
            specs={specs}
            locked={locked}
            onSetting={onSetting}
          />
          <Conditions
            section={section}
            change={change}
            taken={taken}
            stranding={stranding}
            locked={locked}
            reaches={forReader}
            onPlace={onAudience}
            onChange={onChangeAudience}
          />
        </PopoverContent>
      </Popover>
    </li>
  );
}

/**
 * What a block is, and what this moment does to it, beside the block rather than under it.
 *
 * ADR 0053 §3 moves ADR 0045 §8's content here and keeps its reason. What is in it is
 * everything the card used to print around the drawing and could not go on printing once
 * the drawing became the row: the module's name, the sentence about what it draws, the id
 * an address is written with, when the block is off, and the settings the module declares.
 *
 * A module with no settings gets no empty section promising one, which is most of them,
 * and `home-settings.ts` already says why that is a fact about the modules rather than a
 * gap to fill. The popover still opens, because the name and the id are in it.
 */
function Details({
  section,
  inherited,
  layered,
  layer,
  at,
  off,
  hiddenHere,
  specs,
  locked,
  onSetting,
}: {
  section: HomeSection;
  inherited: HomeSection;
  /** Whether a value here can be this point's own, which is anywhere but the day's start. */
  layered: boolean;
  /** The edition an edit lands on, by name, or null for the day. */
  layer: string | null;
  /** The point as a time, or `null` at the day's start. Read once by the row above. */
  at: string | null;
  off: boolean;
  hiddenHere: boolean;
  specs: readonly SettingSpec[];
  /** No change here is for the framed reader, so the settings are switched off. */
  locked: boolean;
  onSetting: (key: string, value: string | number | null | undefined) => void;
}) {
  const intl = useWorkbenchIntl();
  const { label, what } = moduleLabel(section.module);

  return (
    <div className="flex flex-col gap-2xs">
      {/*
        The name, and what the block draws behind the ⓘ beside it. The popover reads as name,
        controls, badges; a sentence about the block is background, and the drawing it is
        about is on screen beside the popover anyway.
      */}
      <div className="flex flex-wrap items-center gap-2xs">
        <span className="text-m font-semibold text-on-canvas">{say(intl, label)}</span>
        <InfoTip about={say(intl, label)}>
          <p>{intl.formatMessage(what)}</p>
        </InfoTip>
        <code className={cn(CODE, 'ml-auto text-on-canvas-muted')}>{section.id}</code>
      </div>

      {off && (
        <p className={cn(NOTE, 'flex flex-wrap items-center gap-2xs')}>
          {at !== null
            ? intl.formatMessage(COPY.offAt, { time: at })
            : layer !== null
              ? intl.formatMessage(EDITION_COPY.offIn, { edition: layer })
              : intl.formatMessage(COPY.offAtStart)}
          {hiddenHere && <Here />}
        </p>
      )}

      {specs.map((spec) => (
        <Setting
          key={spec.key}
          module={section.module}
          spec={spec}
          value={section.settings?.[spec.key]}
          inherited={inherited.settings?.[spec.key]}
          layered={layered}
          inEdition={layer !== null}
          disabled={off || locked}
          onSet={(value) => onSetting(spec.key, value)}
        />
      ))}
    </div>
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
  layered,
  inEdition,
  disabled,
  onSet,
}: {
  module: string;
  spec: SettingSpec;
  value: unknown;
  inherited: unknown;
  layered: boolean;
  /**
   * Whether an edit here lands on an edition, which is when a pin needs its warning: until
   * ADR 0059 §7's private plan exists, a pin in an edition is public the day it is merged.
   */
  inEdition: boolean;
  disabled: boolean;
  onSet: (value: string | number | null | undefined) => void;
}) {
  const intl = useWorkbenchIntl();
  const { label, what } = settingLabel(module, spec);
  const setHere = layered && value !== inherited;

  return (
    <div
      className={cn(
        'flex flex-col gap-4xs border-t border-stroke pt-2xs',
        disabled && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-2xs">
        <span className="text-s font-medium text-on-canvas">{say(intl, label)}</span>
        <InfoTip about={say(intl, label)}>
          <p>{intl.formatMessage(what)}</p>
        </InfoTip>
        {setHere && <Here />}
      </div>

      {spec.kind === 'count' ? (
        <Count
          spec={spec}
          value={value}
          disabled={disabled}
          label={say(intl, label)}
          onSet={onSet}
        />
      ) : (
        <>
          <Select
            disabled={disabled}
            aria-label={say(intl, label)}
            value={typeof value === 'string' ? value : ''}
            onValueChange={(next) => onSet(next === '' ? null : next)}
            className="w-full"
            options={[
              { value: '', label: intl.formatMessage(COPY.noPin) },
              ...HOME_PINS.map((item) => ({ value: item.url, label: item.title })),
            ]}
          />
          {inEdition && typeof value === 'string' && (
            <Warning>{intl.formatMessage(EDITION_COPY.pinEarly)}</Warning>
          )}
          {/*
            The badge, and what it means behind the ⓘ: one sentence of this site's own, then
            the inventory's own words, quoted as they are written (ADR 0052 §4 keeps the
            manifest in its language; it does not ask for it to be spliced into a German
            sentence, which is what this was).
          */}
          {PIN_SOURCE?.status === 'sample' && (
            <div className="flex items-center gap-3xs">
              <Badge variant="outline">{intl.formatMessage(COPY.sampleBadge)}</Badge>
              <InfoTip about={intl.formatMessage(COPY.sampleBadge)}>
                <p>{intl.formatMessage(COPY.sample)}</p>
                {PIN_SOURCE.standsIn && (
                  <figure className="space-y-3xs">
                    <figcaption className="text-on-canvas-muted">
                      {intl.formatMessage(COPY.sampleQuote)}
                    </figcaption>
                    <blockquote
                      lang="en"
                      className="border-l-2 border-stroke-strong pl-xs text-on-canvas-muted"
                    >
                      {PIN_SOURCE.standsIn}
                    </blockquote>
                  </figure>
                )}
              </InfoTip>
            </div>
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
