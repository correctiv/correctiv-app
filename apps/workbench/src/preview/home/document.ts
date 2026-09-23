import {
  addDays,
  berlinInstant,
  berlinWallClock,
  formatBerlinDateTime,
  parseBerlinDateTime,
  type BerlinDate,
  type Instant,
} from '@correctiv/app-core/lib/berlin-time';
import {
  applyAll,
  changesAt,
  DEFAULT_HOME_LAYOUT,
  editionPointAt,
  editionsAt,
  formatTimeOfDay,
  MINUTES_IN_DAY,
  stateAt,
  stateAtInstant,
  type HomeChange,
  type HomeEdition,
  type HomeLayout,
  type HomeMoment,
  type HomeSection,
  type MinuteOfDay,
  type ModuleSettings,
  type SettingValue,
} from '@correctiv/app-core/lib/home-layout';
import type { IntlShape } from 'react-intl';

import {
  audienceOf,
  AUDIENCES,
  defaultAudience,
  EVERYONE,
  READERS,
  readerOf,
  reaches,
  type Audience,
  type Reader,
} from '@correctiv/app-core/lib/home-audience';

import {
  settingsFor,
  type CountSetting,
  type SettingSpec,
} from '@correctiv/app-core/lib/home-settings';

import { say, wbMessage, type WorkbenchMessage } from '../../i18n/messages';

/**
 * The home document, as a thing that can be edited and printed.
 *
 * Every export here is a pure function of a layout, or a name both ends of the tool have
 * to spell the same way. The three ways a change leaves the page — into the running
 * app's document, into the running app's clock, and into the repository — are `write.ts`
 * and `clock.ts`, and they are separate for a reason that is not tidiness: **the dev
 * server loads this file in Node**. `plugin/home-layout.ts` prints what it writes with
 * `formatLayoutDocument` below, so a browser-only line here (`window`,
 * `import.meta.env`) is an exception the moment somebody presses Save.
 *
 * Not while Vite reads its config, which an earlier version of this paragraph said and
 * which was wrong when it was written. The plugin reaches this module through
 * `ssrLoadModule` at request time and imports only `names.ts` statically, and that file
 * exists to be the leaf the config can hold. What Vite's config genuinely cannot take is
 * the JSON import underneath the core's layout module, which is the measurement
 * `plugin/home-layout.ts` carries.
 *
 * The tool's component (`HomeDocument.tsx`) reads the layout from `./store.ts` and calls
 * these; nothing in this file holds state of its own, so a second caller — the endpoint,
 * a test, a scenario loader when ADR 0036 §11 is built — costs nothing.
 *
 * ## What the vocabulary is, since ADR 0039
 *
 * The document is a day: an ordered list of places in the state they are in when the day
 * starts, and a list of **moments**, each a time and the changes that happen at it. So
 * the editing functions below come in two groups. One moves a place in the order, which
 * is a fact about the screen and not about the hour. The other writes a value **at a
 * point in the day** — `null` for the day's start, a minute for a moment — and the
 * interesting half of this file is what that has to do: a value equal to what the point
 * before it already said is not written at all, it is taken out, because a change that
 * changes nothing is the thing the whole model exists to avoid writing.
 */

/**
 * The document the app compiles in, as the editor's starting point and its baseline.
 *
 * `DEFAULT_HOME_LAYOUT` is the core's own parse of `data/home.layout.json`, which is
 * the same value the app draws from when nothing has been written over it. So "reset"
 * and "unchanged" are both measured against the file a reviewer will see in the diff,
 * and not against a copy of it kept here.
 */
export const SHIPPED: HomeLayout = DEFAULT_HOME_LAYOUT;

/**
 * What each module is, in words an editor can act on.
 *
 * The module id is the app's vocabulary and it is not this tool's to show as the name
 * of a thing: `faktencheck-rail` tells a newsroom nothing about what it will see.
 * `test/preview/home-document.test.ts` reads `HOME_MODULES` out of
 * `apps/mobile/src/lib/home/modules.tsx` as source text — the shell may not import from
 * the app — and fails on a module with no entry here as well as on an entry no module
 * answers to, which is the direction a type cannot see.
 *
 * **Both halves are descriptors, and this is the table ADR 0050 §1 was written for.**
 * The one audience that decision names outside development is somebody from the
 * newsroom arranging the home screen, and this is what they arrange it with. ADR 0050
 * §5 named the gap and deferred it; [ADR 0052](../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §7
 * closes it. What made the deferral survive six passes of translating the site is that
 * no check could see it either: the fields were called `name` and `what`, and
 * `test/rendered-literals.test.ts` watched neither. `what` is watched now and the field
 * that was `name` is called `label`, which that check has always read.
 *
 * `wbMessage` rather than `defineMessages` is a preference with a reason and not a
 * constraint, and the difference is measured: on 2026-09-18 a `defineMessages` import
 * here left the save endpoint answering 200 exactly as before. The reason is `nav.ts`'s,
 * which is weaker and still good — this is a table. Two things load it outside a
 * browser, the dev server's endpoint through `ssrLoadModule` and the tests, and neither
 * has any use for React. One call per descriptor, which is what the extractor reads
 * (`i18n/messages.ts`).
 */
export interface ModuleWords {
  /**
   * The module's name. A string only where there is nothing to translate: the
   * fallback below hands back the raw module id, which is the app's vocabulary and
   * the same word in every language.
   */
  label: string | WorkbenchMessage;
  /** The sentence under it, which is always this tool's own words. */
  what: WorkbenchMessage;
}

export const MODULE_LABELS: Readonly<Record<string, ModuleWords>> = {
  'home-header': {
    label: wbMessage({
      id: 'home.module.header',
      defaultMessage: 'Header',
      description:
        'The name of the app’s topmost block, which is a word the app’s own header does not print. `frame.pages.home` is the tab this block sits on.',
    }),
    what: wbMessage({
      id: 'home.module.header.what',
      defaultMessage: 'The date, the greeting and the way into search.',
    }),
  },
  'feed-status': {
    label: wbMessage({
      id: 'home.module.feedStatus',
      defaultMessage: 'Loading and offline notice',
    }),
    what: wbMessage({
      id: 'home.module.feedStatus.what',
      defaultMessage: 'Only appears while the feeds load, or when they came out of the bundle.',
    }),
  },
  'article-hero': {
    label: wbMessage({ id: 'home.module.articleHero', defaultMessage: 'Lead article' }),
    what: wbMessage({
      id: 'home.module.articleHero.what',
      defaultMessage: 'The newest investigation, full width.',
    }),
  },
  'spotlight-briefing': {
    label: wbMessage({
      id: 'home.module.spotlight',
      defaultMessage: 'Spotlight briefing',
      description:
        'Spotlight is the name of a CORRECTIV newsletter and stays as it is in every language; “briefing” is what this block draws of it.',
    }),
    what: wbMessage({
      id: 'home.module.spotlight.what',
      defaultMessage: 'The current issue, with the way into the archive.',
    }),
  },
  'early-access-card': {
    label: wbMessage({ id: 'home.module.earlyAccess', defaultMessage: 'Early access' }),
    what: wbMessage({
      id: 'home.module.earlyAccess.what',
      defaultMessage: 'What members see before everybody else.',
    }),
  },
  'latest-research': {
    label: wbMessage({ id: 'home.module.latest', defaultMessage: 'Latest investigations' }),
    what: wbMessage({
      id: 'home.module.latest.what',
      defaultMessage: 'The investigations under the lead, as a list.',
    }),
  },
  'faktencheck-rail': {
    label: wbMessage({ id: 'home.module.faktencheck', defaultMessage: 'Fact checks' }),
    what: wbMessage({
      id: 'home.module.faktencheck.what',
      defaultMessage: 'The newest fact checks, as a row that scrolls sideways.',
    }),
  },
  'callout-teaser': {
    label: wbMessage({ id: 'home.module.callout', defaultMessage: 'Participation callout' }),
    what: wbMessage({
      id: 'home.module.callout.what',
      defaultMessage:
        'The open callout. Two places in the document, one lifted over the lead at midday.',
    }),
  },
  'mediathek-reihe': {
    label: wbMessage({
      id: 'home.module.mediathek',
      defaultMessage: 'Mediathek',
      description:
        'Mediathek is the app’s own name for that section, in the app’s own language, and is the same word in both catalogues.',
    }),
    what: wbMessage({
      id: 'home.module.mediathek.what',
      defaultMessage: 'Video and audio, as a row.',
    }),
  },
  'backstage-teaser': {
    label: wbMessage({
      id: 'home.module.backstage',
      defaultMessage: 'Backstage',
      description:
        'Backstage is the name of a CORRECTIV product and is the same word in every language. home.module.mediathek, home.module.impact and home.module.spotlight are the other three left as they are, each for the reason on its own descriptor.',
    }),
    what: wbMessage({
      id: 'home.module.backstage.what',
      defaultMessage: 'The newsroom diary and the way in.',
    }),
  },
  'impact-footer': {
    label: wbMessage({
      id: 'home.module.impact',
      defaultMessage: 'Impact',
      description:
        'Impact is what CORRECTIV calls the effect of its reporting, and is the word the app’s own section uses.',
    }),
    what: wbMessage({
      id: 'home.module.impact.what',
      defaultMessage: 'What the reporting changed, and a thank-you.',
    }),
  },
};

/** What stands under a module this tool has never heard of, where the label is its id. */
const UNKNOWN_WHAT = wbMessage({
  id: 'home.module.unknown.what',
  defaultMessage: 'This tool has no description for it.',
  description:
    'Under a module the palette is offering that MODULE_LABELS has no entry for, where the label above it is the module’s raw id. home.setting.unknown.what is the same kind of stand-in one level down, for a setting, and says something shorter because the control beside it already names itself.',
});

/** A module with no entry above still has to draw a row, and its id is what is left. */
export function moduleLabel(module: string): ModuleWords {
  return MODULE_LABELS[module] ?? { label: module, what: UNKNOWN_WHAT };
}

/**
 * The words for one setting, addressed the way the document addresses it.
 *
 * The keys are `<module>.<key>` because a setting belongs to a module and two modules
 * spell `count` the same way while meaning different numbers. The core holds the
 * grammar — which keys exist, what each may hold, what it falls back to — and this holds
 * the question a person is being asked, for the same reason `MODULE_LABELS` does: a
 * label is how a tool asks, and the app has no use for one.
 *
 * The ids are the module in camel case rather than its id, `home.setting.articleHero.pin`
 * and not `home.setting.article-hero.pin`, because that is how every other id on this
 * site is spelled. The key of the record stays the document's spelling, since that is
 * what the core hands in.
 *
 * `test/preview/home-document.test.ts` holds the two lists together in both directions,
 * so a setting added to the core with no words here is a red test rather than a control
 * labelled `count`.
 */
export const SETTING_LABELS: Readonly<Record<string, ModuleWords>> = {
  'article-hero.pin': {
    label: wbMessage({
      id: 'home.setting.articleHero.pin',
      defaultMessage: 'Which article leads',
    }),
    what: wbMessage({
      id: 'home.setting.articleHero.pin.what',
      defaultMessage: 'Pinned, or the newest investigation when nothing is.',
    }),
  },
  'latest-research.count': {
    label: wbMessage({
      id: 'home.setting.latestResearch.count',
      defaultMessage: 'How many investigations',
    }),
    what: wbMessage({
      id: 'home.setting.latestResearch.count.what',
      defaultMessage: 'The list under the lead article.',
    }),
  },
  'faktencheck-rail.count': {
    label: wbMessage({
      id: 'home.setting.faktencheckRail.count',
      defaultMessage: 'How many fact checks',
    }),
    what: wbMessage({
      id: 'home.setting.faktencheckRail.count.what',
      defaultMessage: 'The row that scrolls sideways.',
    }),
  },
};

/** The same stand-in one level down, for a setting the core declares and this has no words for. */
const UNKNOWN_SETTING_WHAT = wbMessage({
  id: 'home.setting.unknown.what',
  defaultMessage: 'No description for it.',
  description:
    'Under a setting the core declares that SETTING_LABELS has no entry for, where the label above it is the setting’s raw key. home.module.unknown.what is the same kind of stand-in one level up, for a whole module, and says more because a module’s id says less about it than a setting’s key does.',
});

export function settingLabel(module: string, spec: SettingSpec): ModuleWords {
  return SETTING_LABELS[`${module}.${spec.key}`] ?? { label: spec.key, what: UNKNOWN_SETTING_WHAT };
}

export { formatTimeOfDay, settingsFor, type CountSetting, type SettingSpec };

// --- where in the day -----------------------------------------------------------

/**
 * A point in the day the editor can be editing: a moment's minute, or the day's start.
 *
 * `null` is the day's start and it is deliberately not a moment. The moments are what
 * CHANGES; the sections as written are what the day begins as, and there is no earlier
 * point for them to inherit from. Making the start a moment would have bought one type
 * and cost the two rules that make the rest coherent — that a moment can be moved and
 * removed, and that a change writes only a difference.
 */
export type Point = MinuteOfDay | null;

/** The point in effect at a minute: the last moment at or before it, or the day's start. */
export function pointAt(layout: HomeLayout, minute: MinuteOfDay): Point {
  let held: Point = null;
  for (const moment of layout.moments) {
    if (moment.minute > minute) break;
    held = moment.minute;
  }
  return held;
}

/** The moment at a point, or null at the day's start. */
export function momentAt(layout: HomeLayout, point: Point): HomeMoment | null {
  if (point === null) return null;
  return layout.moments.find((moment) => moment.minute === point) ?? null;
}

/**
 * How long a point lasts: from it, to the next moment or to midnight.
 *
 * What the panel prints as the heading of whatever is being edited, because "11:00" on
 * its own does not say what an edit here will affect and "11:00 until 14:00" does.
 */
export function spanOf(layout: HomeLayout, point: Point): { from: number; to: number } {
  const from = point ?? 0;
  const next = layout.moments.find((moment) => moment.minute > from);
  return { from, to: next?.minute ?? MINUTES_IN_DAY };
}

/**
 * The state a point INHERITS: everything that has happened strictly before it.
 *
 * `stateAt(layout, minute - 1)` and not a second fold, because minutes are whole numbers
 * and a moment sits on one — so the minute before a moment is the last minute it has not
 * happened in. At the day's start the answer is the sections as written, which
 * `stateAt(layout, -1)` gives for free: no moment is at or before minute −1.
 */
export function inheritedAt(
  layout: HomeLayout,
  point: Point,
  reader: Reader,
): readonly HomeSection[] {
  return stateAt(layout, point === null ? -1 : point - 1, reader);
}

/** The state a point PRODUCES: what the frame shows while it is in effect. */
export function effectiveAt(
  layout: HomeLayout,
  point: Point,
  reader: Reader,
): readonly HomeSection[] {
  return stateAt(layout, point ?? 0, reader);
}

// --- who a change is for ---------------------------------------------------------

/**
 * Every reader a change with this audience reaches, out of the ones the rules can tell apart.
 *
 * What "equal to what the point inherits" has to be asked of once a document names an
 * audience anywhere ([ADR 0060](../../../../../adr/0060-a-block-says-when-it-appears-and-an-editor-says-for-whom.md)
 * §5). A change for everybody restates its inheritance only if it does so for EVERY reader:
 * a paying member may have been handed something else at eleven by a change the others
 * never saw, and pruning against one reader's day would take out an instruction another
 * reader still needs. With no audience in the document every reader folds the same day, so
 * this costs a document written before ADR 0060 nothing but the loop.
 */
function readersFor(audience: Audience | undefined): readonly Reader[] {
  return READERS.filter((reader) => reaches(reader, audience));
}

/** Whether a change, whatever it names, changes nothing: no state and no settings. */
function says(change: HomeChange): boolean {
  return change.hidden !== undefined || change.settings !== undefined;
}

/**
 * The reader an edit is made for when the caller names none: a reader in no audience but
 * everyone's, which is every reader of a document that names no audience.
 */
const ANYONE: Reader = readerOf(null);

/**
 * The change about a place that the framed reader is in, out of the changes at one point.
 *
 * The LAST one that reaches them, because the fold applies them in order and the last is
 * the one whose word stands on their screen. ADR 0041's own example is two changes about
 * one place at one time, for two audiences; the review of #250 found the editor writing
 * into the first of them whoever was framed, so an edit made while looking at a free
 * member's screen landed on the paying members' change and the screen did not move.
 */
function pickFor(
  changes: readonly HomeChange[],
  id: string,
  reader: Reader,
): HomeChange | undefined {
  return changes.findLast((change) => change.id === id && reaches(reader, change.audience));
}

/**
 * Whether the changes at a point leave this reader nothing to edit: there are changes about
 * the place, and none of them is for this reader. Writing a new change for everybody there
 * would override the others' audience too, so the editor refuses and says so instead.
 */
function lockedFor(changes: readonly HomeChange[], id: string, reader: Reader): boolean {
  return changes.some((change) => change.id === id) && pickFor(changes, id, reader) === undefined;
}

/**
 * One change about a place edited in place, or a new one appended in section order.
 *
 * In place rather than taken out and appended, because among changes about the same place
 * the order is what the fold reads, and an edit must not reorder a pair.
 */
function editIn(
  changes: readonly HomeChange[],
  id: string,
  reader: Reader,
  rank: ReadonlyMap<string, number>,
  next: (change: HomeChange) => HomeChange,
): readonly HomeChange[] {
  if (lockedFor(changes, id, reader)) return changes;
  const found = pickFor(changes, id, reader);
  if (found) {
    const edited = next(found);
    return changes.flatMap((change) =>
      change === found ? (says(edited) ? [edited] : []) : [change],
    );
  }
  const edited = next({ id });
  if (!says(edited)) return changes;
  return [...changes, edited].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
}

/** The changes at a point of the day, or none at the day's start. */
function changesOf(layout: HomeLayout, point: Point): readonly HomeChange[] {
  return momentAt(layout, point)?.changes ?? [];
}

/** The change the editor edits for a place at a point of the day, if there is one. */
function heldAt(
  layout: HomeLayout,
  point: Point,
  id: string,
  reader: Reader,
): HomeChange | undefined {
  return pickFor(changesOf(layout, point), id, reader);
}

// --- editing the order ------------------------------------------------------------

/**
 * A block, that many places up or down, in the document's own order.
 *
 * Over the whole list rather than over what is on screen right now: the document is one
 * order and the time is a filter over it, so moving a section that is hidden at this
 * minute past one that is shown still means something and still has to be expressible.
 *
 * **Any distance, not one step**, because
 * [ADR 0047](0047-the-handle-is-the-pointers-and-the-arrows-are-the-keyboards.md) §3
 * gives one operation two controls: an arrow button passes `-1` or `1`, and a drop
 * computes how far the block travelled. What the document sees is one function and one
 * kind of edit, so a difference between the two inputs cannot exist below the interface,
 * which is where it would be expensive.
 *
 * **Clamped to the ends, and answering with the layout it was given when the clamp
 * leaves the block where it was**, so that a caller can tell nothing happened. It does
 * not decide whether Save lights up — `differs` compares the two documents as printed
 * text, so an equal copy would read as unchanged anyway, and an earlier version of this
 * paragraph claimed otherwise. The identity is for the caller, not for the button.
 *
 * **A delta that is not a whole number, or not a number at all, is refused before the
 * clamp.** `NaN` survives `Math.max`/`Math.min` unchanged and `splice(NaN, …)` inserts at
 * the front, so a bad delta moved a block to the top of the day rather than doing
 * nothing; a fraction slipped past the identity test and handed back an equal copy.
 * Neither is reachable from the two controls, which is why this is a guard rather than a
 * throw: an unreachable input should cost a caller nothing and surprise nobody.
 *
 * **Order is the document's and not a moment's**, which is ADR 0039 §3. A moment can
 * switch a place off and another one on, which is how the callout appears to move; what
 * it cannot do is rearrange the screen, because ADR 0036 §2 keeps the places fixed and
 * an arrangement that changed by the hour would be a layout engine in the app.
 */
export function moved(layout: HomeLayout, id: string, delta: number): HomeLayout {
  if (!Number.isInteger(delta)) return layout;
  const from = layout.sections.findIndex((section) => section.id === id);
  if (from === -1) return layout;
  const to = Math.max(0, Math.min(from + delta, layout.sections.length - 1));
  if (to === from) return layout;
  const sections = [...layout.sections];
  const [lifted] = sections.splice(from, 1);
  sections.splice(to, 0, lifted!);
  return { ...layout, sections };
}

// --- adding and removing a block ---------------------------------------------------

/**
 * The id a new block of this module gets.
 *
 * [ADR 0046](../../../../../adr/0046-what-the-editor-may-add-and-what-a-block-is-called.md)
 * §2: the module's name, and then the smallest suffix the document is not using. A
 * `callout-teaser` added to a document with none is `callout-teaser`; added to one that
 * has it, `callout-teaser-2`, then `-3`.
 *
 * **An id is an address and not a label**, which is why nothing offers to edit it: a
 * moment names it, a parse problem carries it, `LIFTED_CALLOUT` in `modules.tsx` hangs a
 * margin on one, and `sectionTestId` puts it in the rendered tree for the frame's outline
 * to find. The minted id is uglier than the hand-written ones the shipped document has,
 * and ADR 0046 §2 says that is correct: a machine that guessed a prettier name would
 * collide with its next guess.
 *
 * A removed id may be minted again, and ADR 0046 §3 is where that is argued: there is one
 * writer, the document is whole in one file, and "a document somebody has open elsewhere"
 * does not exist yet. The day it does is the day ADR 0036 §4 is built, and the decision to
 * revisit belongs there.
 */
export function mintId(layout: HomeLayout, module: string): string {
  /*
   * The one input that made an editor operation produce a file the core refuses: an empty
   * module name mints an empty id, and the parser answers `section-id-invalid`. Not
   * reachable from the palette, which offers `blocksFor('home')` and nothing else
   * — so this is a precondition rather than a bug, found by a cold review feeding this
   * function names no registry would hold. Refused at the door, where the message names
   * the caller, rather than at a parse of a file somebody has already saved.
   */
  if (!/^[a-z][\da-z-]*$/i.test(module)) {
    throw new Error(`Not a module name a document can carry: ${JSON.stringify(module)}`);
  }

  const taken = new Set(layout.sections.map((section) => section.id));
  if (!taken.has(module)) return module;
  // Bounded rather than a loop with no end: one more than the ids in hand is always
  // enough, because that many suffixes cannot all be taken by fewer ids.
  for (let n = 2; n <= taken.size + 2; n += 1) {
    const id = `${module}-${n}`;
    if (!taken.has(id)) return id;
  }
  /* c8 ignore next */
  throw new Error(`No free id for ${module}, which the bound above makes impossible.`);
}

/**
 * A new block of this module, at this place in the day's order.
 *
 * ADR 0045 §4: the arrangement is the document's and the editor writes it. The block
 * arrives carrying nothing but its id and its module — no settings, not hidden — which is
 * the honest state of a place somebody has just put down. Every setting it understands
 * falls back to what `home-settings.ts` declares, and that is the same answer the module
 * gives when the document says nothing, so the frame draws it exactly as the app would.
 *
 * `at` is an index in `sections` and is clamped rather than refused: the insertion mark
 * hands it one and the ends are the two places it is easiest to be off by one about.
 */
export function added(layout: HomeLayout, at: number, module: string): HomeLayout {
  const sections = [...layout.sections];
  sections.splice(Math.max(0, Math.min(at, sections.length)), 0, {
    id: mintId(layout, module),
    module,
  });
  return { ...layout, sections };
}

/**
 * The block gone, and with it every change that named it.
 *
 * ADR 0045 §4's last paragraph: removing a block takes with it every change that names
 * it. A change naming a place that is not there is `change-id-unknown` — the parser
 * reports it and drops it — and **the editor is the half that can know**, so it is the
 * half that does the taking. Left behind, those changes would print into the file, come
 * back as a warning on every parse, and describe an hour at which nothing happens.
 *
 * A moment left with no changes is kept. It is the same state `withMoment` makes when
 * somebody puts a point down before saying what changes at it, and a point vanishing
 * because the last block it mentioned was removed elsewhere in the day would be the
 * editor undoing a thing nobody asked it to undo.
 *
 * An id the document does not have answers with the layout it was given.
 */
export function removed(layout: HomeLayout, id: string): HomeLayout {
  const sections = layout.sections.filter((section) => section.id !== id);
  if (sections.length === layout.sections.length) return layout;

  const without = (moments: readonly HomeMoment[]) =>
    moments.map((moment) => ({
      ...moment,
      changes: moment.changes.filter((change) => change.id !== id),
    }));

  // An edition's changes name places exactly as the day's moments do, so they go too.
  return {
    ...layout,
    sections,
    moments: without(layout.moments),
    editions: layout.editions.map((edition) => ({
      ...edition,
      changes: edition.changes.filter((change) => change.id !== id),
      moments: without(edition.moments),
    })),
  };
}

/**
 * A block named so that no two controls in the list share a name.
 *
 * The module's words alone are not unique and the shipped document proves it: the callout
 * is two sections, so "Remove Participation callout from the day" was the name of two
 * different buttons, and "between Participation callout and Participation callout" was a
 * place. Measured in the accessibility tree by a cold review.
 *
 * The id is what is unique, and it is already on screen at the end of every row
 * (ADR 0046 §2: the editor shows an id and offers no way to edit one), so a label that
 * carries it matches what a person can see. Longer to hear, and correct, which is the
 * right way round for a control somebody is being asked to press.
 */
const BLOCK_NAME = wbMessage({
  id: 'home.block.name',
  defaultMessage: '{name} ({id})',
  description:
    'How a block is named to a screen reader, wherever a control has to say which one it means. {name} is the module’s label out of MODULE_LABELS and {id} the section’s own id, which is on screen at the end of every row. A translation keeps the brackets: the id is an identifier and the two halves must stay tellable apart.',
});

export function blockName(intl: IntlShape, section: HomeSection): string {
  return intl.formatMessage(BLOCK_NAME, {
    name: say(intl, moduleLabel(section.module).label),
    id: section.id,
  });
}

/**
 * Where an insertion mark puts a block, in words a person can read out.
 *
 * The mark's label and the dialog's first line are the only things that say WHERE, since
 * the mark itself is a hairline between two rows and a dialog covers the list it came
 * from. Named by the blocks either side rather than by a number, because "after the lead
 * article" is a place and "at index 3" is an implementation detail somebody would have to
 * count to check.
 */
const WHERE = {
  top: wbMessage({
    id: 'home.where.top',
    defaultMessage: 'at the top of the day',
    description:
      'Where an insertion mark puts a block, when it is above every block there is. Dropped into the middle of a sentence, so it is lower case and carries no full stop. home.where.end is the same for the other edge and home.where.between for everywhere else.',
  }),
  end: wbMessage({
    id: 'home.where.end',
    defaultMessage: 'at the end of the day',
    description:
      'The same as home.where.top for the other edge: below every block there is. Dropped in mid-sentence, so lower case and no full stop.',
  }),
  between: wbMessage({
    id: 'home.where.between',
    defaultMessage: 'between {before} and {after}',
    description:
      'Where an insertion mark puts a block, between two that are already there. {before} and {after} are each home.block.name, so each already reads “Lead article (hero)”, where the word in brackets is the section’s id and not the module’s. Dropped in mid-sentence, so lower case and no full stop.',
  }),
};

export function whereAt(intl: IntlShape, layout: HomeLayout, at: number): string {
  // Clamped the way `added` clamps, and not as tidiness: the two are one index read twice,
  // and if they disagreed the label would name a place the block does not land in.
  const index = Math.max(0, Math.min(at, layout.sections.length));
  const before = layout.sections[index - 1];
  const after = layout.sections[index];
  if (!before) return intl.formatMessage(WHERE.top);
  if (!after) return intl.formatMessage(WHERE.end);
  return intl.formatMessage(WHERE.between, {
    before: blockName(intl, before),
    after: blockName(intl, after),
  });
}

// --- editing a point --------------------------------------------------------------

/**
 * Switch a place on or off at a point in the day.
 *
 * At the day's start this writes the section's own `hidden`, and writes it by taking the
 * key away again rather than writing `false`: the document's optional fields are
 * negative on purpose — absent means shown — and a document full of `"hidden": false` is
 * a document that got longer without saying anything more.
 *
 * At a moment it writes a change, and `false` IS written there, because at a moment
 * `hidden: false` is the instruction that brings a place back. What is not written is a
 * value the point already inherits: setting a block to what it already was at this time
 * takes the change out, which is what keeps the document a list of differences rather
 * than a list of assertions.
 */
export function withHidden(
  layout: HomeLayout,
  point: Point,
  id: string,
  hidden: boolean,
  reader: Reader = ANYONE,
): HomeLayout {
  if (point === null) {
    const atStart = withSection(layout, id, (section) => {
      if (!hidden) {
        const { hidden: _hidden, ...rest } = section;
        return rest;
      }
      return { ...section, hidden: true };
    });
    return settled(atStart, point);
  }

  if (lockedFor(changesOf(layout, point), id, reader)) return layout;
  const inherits = readersFor(heldAt(layout, point, id, reader)?.audience).every(
    (one) =>
      Boolean(inheritedAt(layout, point, one).find((section) => section.id === id)?.hidden) ===
      hidden,
  );
  const edited = withChange(layout, point, id, reader, (change) => {
    if (inherits) {
      const { hidden: _hidden, ...rest } = change;
      return rest;
    }
    return { ...change, hidden };
  });
  return settled(edited, point);
}

/**
 * Set one setting of one place at a point in the day.
 *
 * The same rule as above and one more: settings MERGE key by key, so writing one key at
 * a moment leaves the others inherited. `undefined` in means "stop saying anything about
 * this key here", which at the day's start is the module's own default and at a moment
 * is whatever the point before it left.
 *
 * A value equal to the inherited one is taken out rather than written, and a settings
 * object with nothing left in it is taken out with it. That is what makes the diff of a
 * day readable: a moment lists what is different about it and nothing else.
 *
 * **An absent inherited value is a value**, and reading it as "nothing to compare
 * against" is how this wrote changes that say nothing. Choosing "The newest investigation
 * (no pin)" sends `null`, which is `HERO_PIN`'s own fallback and the state the place is
 * already in; typing a count back to five is `RESEARCH_COUNT`'s. Both were written into
 * the moment, and then badged SET HERE, because `settings?.[key]` was `undefined` and
 * `undefined` compares equal to nothing. `inheritedSetting` below is what the comparison
 * asks now, and the spec's `fallback` is the half it was missing.
 */
export function withSetting(
  layout: HomeLayout,
  point: Point,
  id: string,
  key: string,
  value: SettingValue | undefined,
  reader: Reader = ANYONE,
): HomeLayout {
  if (point !== null && lockedFor(changesOf(layout, point), id, reader)) return layout;
  const audience = point === null ? undefined : heldAt(layout, point, id, reader)?.audience;
  const same =
    value !== undefined &&
    readersFor(audience).every((one) => {
      const inherited = inheritedSetting(layout, point, id, key, one);
      return inherited !== undefined && sameValue(inherited, value);
    });
  const next = same || value === undefined ? undefined : value;

  const edited =
    point === null
      ? withSection(layout, id, (section) => withKey(section, key, next))
      : withChange(layout, point, id, reader, (change) => withKey(change, key, next));
  return settled(edited, point);
}

/**
 * What a point inherits for one setting: what the fold leaves it, or the module's default.
 *
 * Two questions in one, and the day's start is why they cannot be a single lookup. At a
 * moment the inherited value is what every earlier point left behind, which is
 * `inheritedAt`. At the day's start there is no earlier point at all, so the thing a
 * person is editing away from is the module's own rule — and `inheritedAt(layout, null)`
 * answers there with the sections as written, which is the value being edited rather than
 * the one it is inherited from. Asking it there would make typing the number that is
 * already in the field delete the field.
 *
 * `fallback` is the one the app draws with (`home-settings.ts`, ADR 0039 §4), so the
 * editor and the module agree on what "nobody has chosen" means without either of them
 * spelling out five.
 */
function inheritedSetting(
  layout: HomeLayout,
  point: Point,
  id: string,
  key: string,
  reader: Reader,
): SettingValue | undefined {
  const declared = layout.sections.find((section) => section.id === id);
  if (!declared) return undefined;
  if (point === null) return fallbackOf(declared.module, key);
  const before = inheritedAt(layout, point, reader).find((section) => section.id === id);
  return before ? valueOf(before, key) : fallbackOf(declared.module, key);
}

/** What a module falls back to for one key, or `undefined` where it declares no such key. */
function fallbackOf(module: string, key: string): SettingValue | undefined {
  return settingsFor(module).find((spec) => spec.key === key)?.fallback;
}

/**
 * What a section shows for one setting: the value it holds, or its module's fallback.
 *
 * `??` will not do here. `null` is a held value and not an absence — it is ADR 0036 §3's
 * "no override, so the rule runs" — and the two are the same answer only for a pin, which
 * is where it would never be noticed.
 */
function valueOf(section: HomeSection, key: string): SettingValue | undefined {
  const held = section.settings?.[key];
  return held !== undefined ? held : fallbackOf(section.module, key);
}

/** Two setting values, compared the way a document compares them. */
function sameValue(a: SettingValue, b: SettingValue): boolean {
  return a === b;
}

/**
 * Every moment after an edit, re-checked against what it now inherits.
 *
 * An edit at a point does not only write where it lands: it changes what every later
 * point is handed. Take `hidden` off a section at the day's start and the moment that
 * used to bring it back is a change restating what it now inherits — nobody sees a
 * difference, and the file has grown a line that says "look here, something happens"
 * where nothing does. Pin an article at eleven that six o'clock already pins, and the
 * same thing happens one rung along.
 *
 * Only after the edited point, because nothing before it inherits from it. And only after
 * an edit to a VALUE: moving a point along the track or taking one out changes what the
 * points after it inherit as well, but those are gestures a person repeats and reverses,
 * and a prune on each would make the reverse lossy — drag a moment past another and back,
 * and the changes it made redundant on the way out would not return.
 *
 * Inheritance is read from the layout this is handed rather than moment by moment as it
 * goes. Taking out a change that restates what it inherits cannot change what anything
 * inherits, which is the whole reason it is safe to take out.
 */
function settled(layout: HomeLayout, point: Point): HomeLayout {
  const after = point ?? -1;

  return {
    ...layout,
    moments: layout.moments.map((moment) => {
      if (moment.minute <= after) return moment;
      const inherited = new Map(
        READERS.map((reader) => [
          reader,
          new Map(
            inheritedAt(layout, moment.minute, reader).map((section) => [section.id, section]),
          ),
        ]),
      );
      const changes = moment.changes
        .map((change) =>
          settledChange(
            change,
            readersFor(change.audience).map((reader) => inherited.get(reader)?.get(change.id)),
          ),
        )
        .filter((change): change is HomeChange => change !== null);
      const same =
        changes.length === moment.changes.length &&
        changes.every((change, index) => change === moment.changes[index]);
      return same ? moment : { ...moment, changes };
    }),
  };
}

/**
 * One change with every field that restates its inheritance taken out, or null when
 * nothing is left of it.
 *
 * A change about a place the document has not got is left exactly as it is: that is a
 * fault the parser reports (`change-id-unknown`), and quietly tidying it away here would
 * take the evidence with it.
 */
function settledChange(
  change: HomeChange,
  inherited: readonly (HomeSection | undefined)[],
): HomeChange | null {
  const held = inherited.filter((section): section is HomeSection => section !== undefined);
  if (held.length === 0 || held.length !== inherited.length) return change;

  let next = change;
  if (
    next.hidden !== undefined &&
    held.every((section) => Boolean(section.hidden) === next.hidden)
  ) {
    const { hidden: _hidden, ...rest } = next;
    next = rest;
  }
  for (const key of Object.keys(next.settings ?? {})) {
    const value = next.settings?.[key];
    const restated = held.every((section) => {
      const was = valueOf(section, key);
      return value !== undefined && was !== undefined && sameValue(was, value);
    });
    if (restated) next = withKey(next, key, undefined);
  }

  // A change naming a section, and perhaps an audience, and changing nothing about it.
  return says(next) ? next : null;
}

/** One key onto a section or a change's `settings`, dropping the object when it empties. */
function withKey<T extends { settings?: ModuleSettings }>(
  holder: T,
  key: string,
  value: SettingValue | undefined,
): T {
  const next: Record<string, SettingValue> = { ...holder.settings };
  if (value === undefined) delete next[key];
  else next[key] = value;

  if (Object.keys(next).length === 0) {
    const { settings: _settings, ...rest } = holder;
    return rest as T;
  }
  return { ...holder, settings: next };
}

/** One section replaced, in place, in the document's order. */
function withSection(
  layout: HomeLayout,
  id: string,
  next: (section: HomeSection) => HomeSection,
): HomeLayout {
  return {
    ...layout,
    sections: layout.sections.map((section) => (section.id === id ? next(section) : section)),
  };
}

/**
 * One change replaced at one moment, and dropped when it says nothing.
 *
 * A change whose only fields were taken away is a change entry naming a section and
 * changing nothing about it. The parser accepts one and the fold ignores it, so nothing
 * breaks — but it would sit in the file as a line that means "look here, something
 * happens", and nothing does. The editor is the half that can know that, so it is the
 * half that takes it out.
 */
function withChange(
  layout: HomeLayout,
  minute: MinuteOfDay,
  id: string,
  reader: Reader,
  next: (change: HomeChange) => HomeChange,
): HomeLayout {
  /*
   * In the document's section order, which is the order the printer writes them in.
   * Keeping the two the same is what makes the editor's document and the file's own
   * parse of itself equal values — otherwise a change appended here and printed in
   * section order comes back in a different place, and every comparison of "what I have"
   * against "what I would save" has to know about it.
   */
  const rank = new Map(layout.sections.map((section, index) => [section.id, index]));

  return {
    ...layout,
    moments: layout.moments.map((moment) => {
      if (moment.minute !== minute) return moment;
      /*
       * The change about this place that the framed reader is in, and nothing else about
       * it. A document may carry two at one time for two audiences (ADR 0041's own
       * example, ADR 0060 §5); the editor edits the one on the screen being looked at and
       * leaves the other exactly as it is.
       */
      return { ...moment, changes: editIn(moment.changes, id, reader, rank, next) };
    }),
  };
}

// --- editing the timeline ----------------------------------------------------------

/**
 * A new point in the day, carrying nothing.
 *
 * It is empty, and that is the honest state of a point somebody has just put down: they
 * have said WHEN something changes and have not yet said what. An empty moment renders
 * exactly as its absence does, so the frame does not move when one appears — which is
 * the behaviour to want, because a point that changed the screen by existing would be a
 * point that did something nobody asked for.
 *
 * A minute that already has a moment answers with the layout unchanged. Two moments at
 * one time is the one thing the parser refuses, so it is the one thing this must not
 * make.
 */
export function withMoment(layout: HomeLayout, minute: MinuteOfDay): HomeLayout {
  if (layout.moments.some((moment) => moment.minute === minute)) return layout;
  const moment: HomeMoment = { at: formatTimeOfDay(minute), minute, changes: [] };
  return { ...layout, moments: sorted([...layout.moments, moment]) };
}

/** A point taken out, with everything it was carrying. */
export function withoutMoment(layout: HomeLayout, minute: MinuteOfDay): HomeLayout {
  return { ...layout, moments: layout.moments.filter((moment) => moment.minute !== minute) };
}

/**
 * A point moved to another time, carrying its changes with it.
 *
 * Landing on another point is refused rather than merged. Merging would be a rule about
 * which of two conflicting instructions wins, which is the rule the parser refuses to
 * invent for a duplicate time, and inventing it here would mean the editor could produce
 * a document it could not read back.
 */
export function movedMoment(layout: HomeLayout, from: MinuteOfDay, to: MinuteOfDay): HomeLayout {
  if (from === to) return layout;
  if (to < 0 || to >= MINUTES_IN_DAY) return layout;
  if (layout.moments.some((moment) => moment.minute === to)) return layout;
  return {
    ...layout,
    moments: sorted(
      layout.moments.map((moment) =>
        moment.minute === from ? { ...moment, at: formatTimeOfDay(to), minute: to } : moment,
      ),
    ),
  };
}

/** In time order, which is the only order the list has. */
function sorted(moments: readonly HomeMoment[]): readonly HomeMoment[] {
  return [...moments].sort((a, b) => a.minute - b.minute);
}

// --- editions ------------------------------------------------------------------

/**
 * What an edit at an instant lands on: an edition and a point in it, or the day and a point
 * in that.
 *
 * ADR 0059 §2: "An edit lands on the narrowest edition active at the playhead, or on the day
 * when none is", which is ADR 0039 §10 one level up. The narrowest is the one the fold
 * applies last (`editionsAt` is in precedence order), so it is also the one whose word
 * stands; writing anywhere else would be writing a value the frame then does not show.
 * Inside the edition the point is its start or the moment of it in effect, exactly as the
 * day's point is the day's start or its moment in effect.
 */
export interface Target {
  /** Null for the day. */
  readonly edition: HomeEdition | null;
  /** The moment's minute, or null for the start of the layer, day or edition. */
  readonly point: Point;
}

export function targetAt(layout: HomeLayout, instant: Instant): Target {
  const active = editionsAt(layout, instant);
  const edition = active[active.length - 1];
  if (edition) return { edition, point: editionPointAt(edition, instant) };
  return { edition: null, point: pointAt(layout, berlinWallClock(instant).minute) };
}

/**
 * The state a target INHERITS at an instant: the fold with the target's own point taken out.
 *
 * For the day this is `inheritedAt`, which is the day's history before the point. For an
 * edition the same question has a subtler answer, because what is under an edition is not
 * fixed across its span: the day beneath it goes on changing at its own moments. So the
 * answer is at THIS instant, which is the one the frame shows and the one the person
 * editing is looking at. The target is always applied last (it is the narrowest edition,
 * and its point is the last of its moments to have happened), so taking it out of the list
 * is the same as stopping the fold just before it.
 */
export function inheritedFor(
  layout: HomeLayout,
  instant: Instant,
  target: Target,
  reader: Reader,
): readonly HomeSection[] {
  if (target.edition === null) return inheritedAt(layout, target.point, reader);
  const id = target.edition.id;
  return applyAll(
    layout.sections,
    changesAt(layout, instant, reader).filter(
      (applied) => !(applied.edition === id && applied.point === target.point),
    ),
  );
}

/**
 * Switch a place on or off at an instant, on whatever the instant's target is.
 *
 * The day keeps its own rules, `withHidden` above, unchanged. An edition gets the same rule
 * one level up: a value equal to what the edition would otherwise show at this instant is
 * not written, it is taken out — so switching a block back to what the day says is the
 * edition falling silent about it, and the day showing through again.
 *
 * What an edition does not get yet is `settled`'s second pass over the moments after the
 * edit. An edition's moments are few and its span is short, and the pass needs a notion of
 * "what a later moment inherits" that changes over the span; it is left out of this slice
 * rather than approximated.
 */
export function writeHidden(
  layout: HomeLayout,
  instant: Instant,
  id: string,
  hidden: boolean,
  reader: Reader = ANYONE,
): HomeLayout {
  const target = targetAt(layout, instant);
  if (target.edition === null) return withHidden(layout, target.point, id, hidden, reader);
  if (lockedFor(changesIn(target), id, reader)) return layout;

  const inherits = readersFor(heldIn(target, id, reader)?.audience).every(
    (one) =>
      Boolean(
        inheritedFor(layout, instant, target, one).find((section) => section.id === id)?.hidden,
      ) === hidden,
  );
  return withEditionChange(layout, target.edition.id, target.point, id, reader, (change) => {
    if (inherits) {
      const { hidden: _hidden, ...rest } = change;
      return rest;
    }
    return { ...change, hidden };
  });
}

/** Set one setting at an instant, on whatever the instant's target is. The same rule. */
export function writeSetting(
  layout: HomeLayout,
  instant: Instant,
  id: string,
  key: string,
  value: SettingValue | undefined,
  reader: Reader = ANYONE,
): HomeLayout {
  const target = targetAt(layout, instant);
  if (target.edition === null) return withSetting(layout, target.point, id, key, value, reader);
  if (lockedFor(changesIn(target), id, reader)) return layout;

  const same =
    value !== undefined &&
    readersFor(heldIn(target, id, reader)?.audience).every((one) => {
      const before = inheritedFor(layout, instant, target, one).find(
        (section) => section.id === id,
      );
      const inherited = before ? valueOf(before, key) : undefined;
      return inherited !== undefined && sameValue(inherited, value);
    });
  const next = same || value === undefined ? undefined : value;
  return withEditionChange(layout, target.edition.id, target.point, id, reader, (change) =>
    withKey(change, key, next),
  );
}

/** The changes at an edition's target point: its start, or one of its moments. */
function changesIn(target: Target): readonly HomeChange[] {
  const edition = target.edition;
  if (edition === null) return [];
  return target.point === null
    ? edition.changes
    : (edition.moments.find((moment) => moment.minute === target.point)?.changes ?? []);
}

/** The change the editor edits for a place on an edition's target point, if there is one. */
function heldIn(target: Target, id: string, reader: Reader): HomeChange | undefined {
  return pickFor(changesIn(target), id, reader);
}

/** The changes an edit at this instant lands among: an edition's point, or the day's. */
function changesAtTarget(layout: HomeLayout, target: Target): readonly HomeChange[] {
  return target.edition === null ? changesOf(layout, target.point) : changesIn(target);
}

/**
 * Whether a place can be edited at this instant for the reader in the frame: false where
 * the point holds changes about it and none of them is for this reader (ADR 0060 §5). The
 * popover says so and switches its controls off rather than writing somewhere unseen.
 */
export function editableAt(
  layout: HomeLayout,
  instant: Instant,
  id: string,
  reader: Reader = ANYONE,
): boolean {
  return !lockedFor(changesAtTarget(layout, targetAt(layout, instant)), id, reader);
}

/**
 * The change an edit at this instant lands on for a place, if there is one: what the
 * audience control beside it retargets.
 */
export function changeHeldAt(
  layout: HomeLayout,
  instant: Instant,
  id: string,
  reader: Reader = ANYONE,
): HomeChange | undefined {
  const target = targetAt(layout, instant);
  if (target.edition !== null) return heldIn(target, id, reader);
  return target.point === null ? undefined : heldAt(layout, target.point, id, reader);
}

/**
 * The audiences a retarget may not choose for a place at this instant, because another
 * change about the place at the same point already carries it. Two changes for one audience
 * at one point would be a rule about which of them wins, and there is none.
 */
export function takenAudiences(
  layout: HomeLayout,
  instant: Instant,
  id: string,
  reader: Reader = ANYONE,
): ReadonlySet<Audience> {
  const changes = changesAtTarget(layout, targetAt(layout, instant));
  const held = pickFor(changes, id, reader);
  return new Set(
    changes
      .filter((change) => change.id === id && change !== held)
      .map((change) => change.audience ?? EVERYONE),
  );
}

/**
 * Who a place is for, all day (ADR 0060 §2).
 *
 * Written only when it differs from the module's own default, which is the rule every
 * optional field of a section already follows: absent means the module decides, so a
 * document keeps saying only what somebody chose. Choosing the default back takes the key
 * out rather than writing it.
 */
export function withAudience(layout: HomeLayout, id: string, audience: Audience): HomeLayout {
  return withSection(layout, id, (section) => {
    const { audience: _audience, ...rest } = section;
    return audience === defaultAudience(section.module) ? rest : { ...rest, audience };
  });
}

/**
 * Who the change at this instant's target is for, which retargets the change rather than
 * choosing a second one (ADR 0060 §5). `everyone` is the absence of the key, as it is in the
 * document. A place with no change here has nothing to retarget and is answered unchanged.
 */
export function writeChangeAudience(
  layout: HomeLayout,
  instant: Instant,
  id: string,
  audience: Audience,
  reader: Reader = ANYONE,
): HomeLayout {
  if (changeHeldAt(layout, instant, id, reader) === undefined) return layout;
  if (takenAudiences(layout, instant, id, reader).has(audience)) return layout;
  const edited = retargeted(layout, instant, id, audience, reader);
  return strands(layout, edited, instant, id) ? layout : edited;
}

/** The retarget itself, with no judgement of what it leaves. */
function retargeted(
  layout: HomeLayout,
  instant: Instant,
  id: string,
  audience: Audience,
  reader: Reader,
): HomeLayout {
  const retarget = (change: HomeChange): HomeChange => {
    const { audience: _audience, ...rest } = change;
    return audience === EVERYONE ? rest : { ...rest, audience };
  };
  const target = targetAt(layout, instant);
  if (target.edition !== null) {
    return withEditionChange(layout, target.edition.id, target.point, id, reader, retarget);
  }
  return withChange(layout, target.point!, id, reader, retarget);
}

/**
 * Whether a retarget leaves some reader with none of a module the day drew for them here,
 * where another change at the same point hides a place of that module.
 *
 * That is one half of a swap made for somebody in particular: the shipped callout is two
 * changes at 11:00, one showing the lifted place and one hiding the other, and retargeting
 * the first to paying members left everybody else with no callout at all (review of #250).
 * Readers of an older app are the reader in no audience, because they drop a change that
 * names one, so they are among the readers asked; ADR 0059 §5 needs their day to stay a
 * whole screen. A retarget that takes a module away from a reader with no counterpart hiding
 * it is an editorial choice and is left alone.
 */
function strands(before: HomeLayout, after: HomeLayout, instant: Instant, id: string): boolean {
  const modules = new Map(after.sections.map((section) => [section.id, section.module]));
  const target = targetAt(after, instant);
  const here = changesAtTarget(after, target);
  return READERS.some((reader) => {
    const drawn = (layout: HomeLayout) =>
      new Set(
        stateAtInstant(layout, instant, reader)
          .filter((section) => !section.hidden && reaches(reader, audienceOf(section)))
          .map((section) => section.module),
      );
    const had = drawn(before);
    const has = drawn(after);
    return [...had].some(
      (module) =>
        !has.has(module) &&
        here.some(
          (change) =>
            change.id !== id &&
            change.hidden === true &&
            reaches(reader, change.audience) &&
            modules.get(change.id) === module,
        ),
    );
  });
}

/**
 * The audiences a retarget of the change at this instant may not choose because it would
 * strand one half of a swap. The popover switches those options off and says why.
 */
export function strandingAudiences(
  layout: HomeLayout,
  instant: Instant,
  id: string,
  reader: Reader = ANYONE,
): ReadonlySet<Audience> {
  if (changeHeldAt(layout, instant, id, reader) === undefined) return new Set();
  return new Set(
    AUDIENCES.filter((audience) =>
      strands(layout, retargeted(layout, instant, id, audience, reader), instant, id),
    ),
  );
}

/** One edition replaced, in place, in the document's order. */
function withEditionAs(
  layout: HomeLayout,
  id: string,
  next: (edition: HomeEdition) => HomeEdition,
): HomeLayout {
  return {
    ...layout,
    editions: layout.editions.map((edition) => (edition.id === id ? next(edition) : edition)),
  };
}

/** One change of an edition, at its start or at one of its moments, and dropped when empty. */
function withEditionChange(
  layout: HomeLayout,
  editionId: string,
  point: Point,
  id: string,
  reader: Reader,
  next: (change: HomeChange) => HomeChange,
): HomeLayout {
  const rank = new Map(layout.sections.map((section, index) => [section.id, index]));
  // The framed reader's change about the place, and the others left alone, as `withChange`.
  const edit = (changes: readonly HomeChange[]): readonly HomeChange[] =>
    editIn(changes, id, reader, rank, next);

  return withEditionAs(layout, editionId, (edition) =>
    point === null
      ? { ...edition, changes: edit(edition.changes) }
      : {
          ...edition,
          moments: edition.moments.map((moment) =>
            moment.minute === point ? { ...moment, changes: edit(moment.changes) } : moment,
          ),
        },
  );
}

/**
 * The id a new edition gets: `edition-` and the Berlin date it starts on, and then the
 * smallest free suffix.
 *
 * ADR 0046 §2's rule for a block, for the same reason: an id is an address, and a machine
 * that guessed a prettier one would collide with its next guess. The newsroom's own name for
 * the edition is its `title`, which is data and can be anything.
 */
export function mintEditionId(layout: HomeLayout, date: BerlinDate): string {
  const taken = new Set(layout.editions.map((edition) => edition.id));
  const base = `edition-${date}`;
  if (!taken.has(base)) return base;
  for (let n = 2; n <= taken.size + 2; n += 1) {
    const id = `${base}-${n}`;
    if (!taken.has(id)) return id;
  }
  /* c8 ignore next */
  throw new Error(`No free id for ${base}, which the bound above makes impossible.`);
}

/**
 * A new edition of one day, starting at this instant and carrying nothing.
 *
 * ADR 0059 §8's "Edition here". One day because that is the unit a person thinks of first —
 * tonight, Saturday — and the popover's two fields are where it becomes a fortnight. It
 * carries nothing, for the reason a new moment carries nothing: somebody has said WHEN and
 * not yet what, and an edition that changed the screen by existing would be doing a thing
 * nobody asked for.
 *
 * The minute is the playhead's, snapped by the caller. Answers with the new id as well,
 * because the caller wants to open what it just made.
 *
 * **Never wider than the edition already running there.** Made inside a four-hour election
 * night, a day-long edition would lose to it on precedence (the narrower window wins, ADR
 * 0059 §4), so the panel would stay on the old one and every edit would land there: found
 * by a cold review of #247. So the new one ends where the running narrowest one ends, when
 * that is sooner, which makes it the narrower of the two. The one case that cannot be
 * made narrower is an edition running from exactly this minute to exactly that end; the id
 * is then null and nothing is added, because a second edition identical in span would be
 * a copy the fold has to break a tie between.
 */
export function withEdition(
  layout: HomeLayout,
  date: BerlinDate,
  minute: MinuteOfDay,
): { layout: HomeLayout; id: string | null } {
  const start = berlinInstant(date, minute)!;
  const running = targetAt(layout, start).edition;
  const dayLong = formatBerlinDateTime({ date: addDays(date, 1), minute });
  const until =
    running && running.end < berlinInstant(addDays(date, 1), minute)! ? running.until : dayLong;
  const id = mintEditionId(layout, date);
  const from = formatBerlinDateTime({ date, minute });
  const edition = spanned({ id, from, until, start: 0, end: 0, changes: [], moments: [] });
  if (!edition) return { layout, id: null };
  const next = { ...layout, editions: [...layout.editions, edition] };
  return targetAt(next, start).edition?.id === id ? { layout: next, id } : { layout, id: null };
}

/**
 * An edition with its instants worked out from what it says, or null when it says something
 * the core would refuse: not a date and time, a minute the spring change skips
 * (`edition-span-in-gap`), or an end at or before the start.
 */
function spanned(edition: HomeEdition): HomeEdition | null {
  const opens = parseBerlinDateTime(edition.from);
  const closes = parseBerlinDateTime(edition.until);
  if (!opens || !closes) return null;
  const start = berlinInstant(opens.date, opens.minute)!;
  const end = berlinInstant(closes.date, closes.minute)!;
  if (!shows(start, opens) || !shows(end, closes)) return null;
  if (end <= start) return null;
  return { ...edition, start, end };
}

/** Whether Berlin's clock shows this wall time at this instant, which the spring gap fails. */
function shows(instant: Instant, clock: { date: BerlinDate; minute: MinuteOfDay }): boolean {
  const read = berlinWallClock(instant);
  return read.date === clock.date && read.minute === clock.minute;
}

/**
 * An edition moved to start elsewhere, keeping its length.
 *
 * The popover's first field. Moving the start past the end used to spring the field back,
 * because the span would have been empty; a person moving a campaign by a day means the
 * whole campaign, so the end moves by the same amount. A start the core would refuse still
 * answers with the layout unchanged.
 */
export function withEditionFrom(layout: HomeLayout, id: string, from: string): HomeLayout {
  const held = layout.editions.find((edition) => edition.id === id);
  const opens = parseBerlinDateTime(from);
  if (!held || !opens) return layout;
  const start = berlinInstant(opens.date, opens.minute)!;
  const until = formatBerlinDateTime(berlinWallClock(held.end + (start - held.start)));
  return withEditionSpan(layout, id, from, until);
}

/**
 * An edition's span, from the popover's two fields.
 *
 * A span the parser would refuse — not a date and time, or an end at or before the start —
 * answers with the layout unchanged, which is what the field beside it then shows: the
 * editor never makes a document it could not read back, which is the rule `movedMoment`
 * follows for a moment landing on another one.
 */
export function withEditionSpan(
  layout: HomeLayout,
  id: string,
  from: string,
  until: string,
): HomeLayout {
  const held = layout.editions.find((edition) => edition.id === id);
  if (!held) return layout;
  const next = spanned({ ...held, from, until });
  return next ? withEditionAs(layout, id, () => next) : layout;
}

/** The newsroom's name for an edition. Empty is no title, rather than an empty one. */
export function withEditionTitle(layout: HomeLayout, id: string, title: string): HomeLayout {
  const named = title.trim();
  return withEditionAs(layout, id, (edition) => {
    const { title: _title, ...rest } = edition;
    return named.length === 0 ? rest : { ...rest, title };
  });
}

/** An edition gone, with everything it carried. The day is untouched by it, by ADR 0059 §5. */
export function withoutEdition(layout: HomeLayout, id: string): HomeLayout {
  return { ...layout, editions: layout.editions.filter((edition) => edition.id !== id) };
}

/** A new moment inside an edition, carrying nothing. The day's rule for `withMoment`. */
export function withEditionMoment(layout: HomeLayout, id: string, minute: MinuteOfDay): HomeLayout {
  return withEditionAs(layout, id, (edition) => {
    if (edition.moments.some((moment) => moment.minute === minute)) return edition;
    const moment: HomeMoment = { at: formatTimeOfDay(minute), minute, changes: [] };
    return { ...edition, moments: sorted([...edition.moments, moment]) };
  });
}

/** A moment of an edition taken out, with what it carried. */
export function withoutEditionMoment(
  layout: HomeLayout,
  id: string,
  minute: MinuteOfDay,
): HomeLayout {
  return withEditionAs(layout, id, (edition) => ({
    ...edition,
    moments: edition.moments.filter((moment) => moment.minute !== minute),
  }));
}

/** A moment of an edition moved to another time; landing on another moment is refused. */
export function movedEditionMoment(
  layout: HomeLayout,
  id: string,
  from: MinuteOfDay,
  to: MinuteOfDay,
): HomeLayout {
  if (from === to || to < 0 || to >= MINUTES_IN_DAY) return layout;
  return withEditionAs(layout, id, (edition) => {
    if (edition.moments.some((moment) => moment.minute === to)) return edition;
    return {
      ...edition,
      moments: sorted(
        edition.moments.map((moment) =>
          moment.minute === from ? { ...moment, at: formatTimeOfDay(to), minute: to } : moment,
        ),
      ),
    };
  });
}

/**
 * Which edition decides each place's state at an instant: the last one to have changed it.
 *
 * What the hairline at a block's edge draws (ADR 0059 §2): a glance down the panel says what
 * the campaign changed and where the ordinary day shows through. A place no edition touches
 * is not in the map, and neither is one only the day's own moments changed.
 */
export function decidedAt(
  layout: HomeLayout,
  instant: Instant,
  reader: Reader,
): ReadonlyMap<string, string> {
  const decided = new Map<string, string>();
  for (const applied of changesAt(layout, instant, reader)) {
    if (applied.edition === null) decided.delete(applied.change.id);
    else decided.set(applied.change.id, applied.edition);
  }
  return decided;
}

/**
 * The editions that are on at some point of a Berlin day, and where on that day's track.
 *
 * `from` and `to` are minutes of the day, clamped to it: an edition that began yesterday
 * starts at 0, one that runs past midnight ends at 1440. Read through the wall clock rather
 * than by subtracting instants, because the track is twenty-four hours of wall clock even
 * on the two days a year that are not twenty-four hours long.
 */
export function editionsOn(
  layout: HomeLayout,
  date: BerlinDate,
): readonly { edition: HomeEdition; from: MinuteOfDay; to: MinuteOfDay }[] {
  const opens = berlinInstant(date, 0)!;
  const closes = berlinInstant(addDays(date, 1), 0)!;
  return layout.editions
    .filter((edition) => edition.start < closes && edition.end > opens)
    .map((edition) => ({
      edition,
      from: edition.start <= opens ? 0 : berlinWallClock(edition.start).minute,
      to: edition.end >= closes ? MINUTES_IN_DAY : berlinWallClock(edition.end).minute,
    }));
}

/**
 * Where on the colour wheel an edition sits, from its id and nothing else.
 *
 * ADR 0059 §2: the same campaign is the same colour on every machine and in every screenshot
 * in a pull request, which a colour chosen by hand or handed out in order could not promise
 * (§9 refuses the first). FNV-1a over the id, which is short, has no dependency and spreads
 * neighbouring ids like `edition-2026-09-27` and `edition-2026-09-28` apart.
 *
 * A hue only. The lightness comes from the palette in `styles/app.css`, so the colour follows
 * the appearance setting the way every other colour on this site does.
 */
export function editionHue(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 360;
}

// --- what changed -------------------------------------------------------------

/**
 * Whether this document differs from the file at all.
 *
 * Compared as the printed file, which is exactly the question Save and "Back to the
 * file" are asking: not whether some structure is deeply equal, but whether saving would
 * leave a diff. It also cannot be wrong about a field somebody adds later, the way a
 * hand-written comparison of four keys was wrong the day a fifth arrived.
 */
export function differs(layout: HomeLayout): boolean {
  return formatLayoutDocument(layout) !== formatLayoutDocument(SHIPPED);
}

/**
 * The ids whose place on the screen, or whose state AT THIS INSTANT, differs from the
 * shipped document at the same instant.
 *
 * At a minute, because that is the only honest comparison once the document is a day: a
 * section is not simply "changed", it is changed at eleven and not at nine, and a badge
 * that said otherwise would be a badge that means nothing at the time being looked at.
 *
 * Position is compared against the shipped index of the same id, which is why this
 * cannot be a per-section comparison: a section that moved makes its neighbour move too,
 * and an editor who lifted one block should not be told they changed four.
 */
export function changedAt(layout: HomeLayout, instant: Instant, reader: Reader): readonly string[] {
  const before = new Map(
    stateAtInstant(SHIPPED, instant, reader).map((section, index) => [
      section.id,
      { section, index },
    ]),
  );
  return stateAtInstant(layout, instant, reader)
    .filter((section, index) => {
      const was = before.get(section.id);
      if (!was) return true;
      return (
        was.index !== index ||
        was.section.audience !== section.audience ||
        Boolean(was.section.hidden) !== Boolean(section.hidden) ||
        printSettings(was.section.settings) !== printSettings(section.settings)
      );
    })
    .map((section) => section.id);
}

/** Settings as one comparable string, in the order the printer would write them. */
function printSettings(settings: ModuleSettings | undefined): string {
  if (!settings) return '';
  return Object.keys(settings)
    .sort()
    .map((key) => `${key}=${JSON.stringify(settings[key])}`)
    .join(',');
}

// --- the file ------------------------------------------------------------------

/**
 * The document as `packages/app-core/src/data/home.layout.json` should read.
 *
 * `JSON.stringify(…, 2)` is not this, and the difference is the whole point: it puts
 * every key of every section on a line of its own, so saving an unchanged document
 * would produce a 60-line diff that says nothing. What oxfmt does to JSON is width and
 * one shape rule, both measured rather than assumed:
 *
 *   WIDTH. A group goes on one line when the rendered line, its indent and its trailing
 *   comma included, is at most `printWidth`, and the source's own line breaks are not
 *   preserved.
 *
 *   SHAPE. An array breaks one element per line, whatever its width, when it holds more
 *   than one element and EVERY element is an object with more than one member or an
 *   array with more than one item. That is Prettier's rule and oxfmt keeps it. It is why
 *   `sections` is one section per line and why `["morning", "evening"]` was not — and it
 *   had to be measured, because until `changes` arrived every array in this document was
 *   over the width anyway and the rule never showed itself.
 *
 * `test/preview/home-document.test.ts` runs the repository's own oxfmt over the output
 * and fails if the two disagree. That check is why this can be a short printer rather
 * than a formatter: it is allowed to be wrong in a way somebody notices.
 */
const PRINT_WIDTH = 100;
const INDENT = '  ';

/**
 * An object as an ordered list of entries, tagged.
 *
 * Tagged because the untagged form is ambiguous exactly where this file uses it: a
 * section with two fields is `[['id', …], ['module', …]]`, and a list of two sections is
 * an array of two arrays. Nothing can tell those apart by shape, and the first document
 * to have exactly two two-field sections would have come out as an object.
 */
interface Obj {
  readonly obj: readonly (readonly [string, unknown])[];
}

const obj = (entries: readonly (readonly [string, unknown])[]): Obj => ({ obj: entries });

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && 'obj' in value;
}

/** `{ "a": 1 }` and `[1, 2]` with the spacing `.oxfmtrc.json` asks for, however long. */
function flat(value: unknown): string {
  if (isObj(value)) {
    if (value.obj.length === 0) return '{}';
    const pairs = value.obj.map(([key, item]) => `${JSON.stringify(key)}: ${flat(item)}`);
    return `{ ${pairs.join(', ')} }`;
  }
  if (Array.isArray(value)) return `[${value.map(flat).join(', ')}]`;
  return JSON.stringify(value);
}

/**
 * The shape rule above: an array oxfmt will break whatever its width.
 *
 * More than one element, and every one of them a group with more than one member. A
 * single-element array is left alone however long it is, and one holding a bare value is
 * left alone however many it holds — which is what keeps a list of strings on one line.
 */
function breaksByShape(value: unknown[]): boolean {
  if (value.length <= 1) return false;
  return value.every((item) => {
    if (isObj(item)) return item.obj.length > 1;
    if (Array.isArray(item)) return item.length > 1;
    return false;
  });
}

/**
 * One value, broken across lines only where it has to be.
 *
 * `column` is how much of the line is already spent before the value starts — the indent
 * plus, for an object's member, its key and colon. It and `trailing` are both part of
 * the measurement rather than afterthoughts, because they are both part of the line: the
 * shipped document's longest section is exactly 100 characters without its comma and
 * breaks with it, which is how the boundary was measured against oxfmt itself.
 *
 * The first line carries no indent of its own; the caller has already written it.
 */
function print(value: unknown, column: number, depth: number, trailing: string): string {
  const shaped = Array.isArray(value) && breaksByShape(value);
  const one = `${flat(value)}${trailing}`;
  if (!shaped && column + one.length <= PRINT_WIDTH) return one;

  const pad = INDENT.repeat(depth);
  const inner = INDENT.repeat(depth + 1);

  if (isObj(value)) {
    const lines = value.obj.map(([key, item], i) => {
      const head = `${inner}${JSON.stringify(key)}: `;
      const comma = i === value.obj.length - 1 ? '' : ',';
      return head + print(item, head.length, depth + 1, comma);
    });
    return `{\n${lines.join('\n')}\n${pad}}${trailing}`;
  }
  if (Array.isArray(value)) {
    const items = value.map((item, i) => {
      const comma = i === value.length - 1 ? '' : ',';
      return inner + print(item, inner.length, depth + 1, comma);
    });
    return `[\n${items.join('\n')}\n${pad}]${trailing}`;
  }
  return one;
}

/** A settings object, in the order the module declares its keys rather than in edit order. */
function settingsEntries(module: string, settings: ModuleSettings): Obj {
  const specs = settingsFor(module);
  const known = specs
    .filter((spec) => settings[spec.key] !== undefined)
    .map((spec) => [spec.key, settings[spec.key]] as const);
  // A key no module declares cannot be written by this editor and would not parse, so it
  // is here only to keep the printer total: printing is not where a document is judged.
  const rest = Object.keys(settings)
    .filter((key) => !specs.some((spec) => spec.key === key))
    .map((key) => [key, settings[key]] as const);
  return obj([...known, ...rest]);
}

/**
 * The order `HomeSection` declares, so a section that gains a field gains it in the same
 * place in every line of the file, and the two optional ones are written only when they
 * say something.
 */
function sectionEntries(section: HomeSection): Obj {
  const entries: (readonly [string, unknown])[] = [
    ['id', section.id],
    ['module', section.module],
  ];
  if (section.hidden !== undefined) entries.push(['hidden', section.hidden]);
  if (section.settings)
    entries.push(['settings', settingsEntries(section.module, section.settings)]);
  return obj(entries);
}

/** The same for a change, whose module is the section it names. */
function changeEntries(change: HomeChange, module: string): Obj {
  const entries: (readonly [string, unknown])[] = [['id', change.id]];
  if (change.audience !== undefined) entries.push(['audience', change.audience]);
  if (change.hidden !== undefined) entries.push(['hidden', change.hidden]);
  if (change.settings) entries.push(['settings', settingsEntries(module, change.settings)]);
  return obj(entries);
}

/**
 * A moment, with its changes in the document's own section order.
 *
 * Not in the order they were edited, which is the same argument the daypart list used to
 * make for itself: the same day, arranged the same way, has to print the same file, or
 * every diff is a shuffle with an edit hidden in it.
 *
 * `minute` is not written. It is the parse of `at`, so writing it would be the second
 * copy of one fact — and the one the parser would then have to decide which of the two
 * to believe.
 */
function momentEntries(
  moment: HomeMoment,
  order: ReadonlyMap<string, number>,
  modules: ReadonlyMap<string, string>,
): Obj {
  const changes = [...moment.changes].sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
  return obj([
    ['at', moment.at],
    ['changes', changes.map((change) => changeEntries(change, modules.get(change.id) ?? ''))],
  ]);
}

/**
 * An edition, in the order ADR 0059 §3 writes one: who, what it is called, when, what it
 * starts as, and what changes inside it.
 *
 * `changes` is written even when it is empty, as a moment's is: an edition somebody has
 * just put down with nothing in it yet is a state of the document, and the empty list is
 * where the next edit goes. `moments` is left out when there are none, as the top level
 * leaves its own out. `start` and `end` are not written, for the reason `minute` is not.
 */
function editionEntries(
  edition: HomeEdition,
  order: ReadonlyMap<string, number>,
  modules: ReadonlyMap<string, string>,
): Obj {
  const entries: (readonly [string, unknown])[] = [['id', edition.id]];
  if (edition.title !== undefined) entries.push(['title', edition.title]);
  entries.push(['from', edition.from], ['until', edition.until]);
  const changes = [...edition.changes].sort(
    (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
  );
  entries.push([
    'changes',
    changes.map((change) => changeEntries(change, modules.get(change.id) ?? '')),
  ]);
  if (edition.moments.length > 0) {
    entries.push([
      'moments',
      edition.moments.map((moment) => momentEntries(moment, order, modules)),
    ]);
  }
  return obj(entries);
}

export function formatLayoutDocument(layout: HomeLayout): string {
  const order = new Map(layout.sections.map((section, index) => [section.id, index]));
  const modules = new Map(layout.sections.map((section) => [section.id, section.module]));

  const entries: (readonly [string, unknown])[] = [
    ['version', layout.version],
    ['sections', layout.sections.map(sectionEntries)],
  ];
  /*
   * Who each place is for, beside the sections rather than inside them (ADR 0060 §6): an
   * older app never reads this key and draws the place for everybody, where a key inside a
   * section would have made it drop the place for everybody. In section order, and only
   * the places that say something.
   */
  const audiences = layout.sections
    .filter((section) => section.audience !== undefined)
    .map((section) => [section.id, section.audience] as const);
  if (audiences.length > 0) entries.push(['audiences', obj(audiences)]);
  /*
   * Written only when there is a day to describe. A document whose home screen is the
   * same at every hour says so by having no moments at all, and an empty list in the
   * file would read as a thing somebody had deleted the contents of.
   */
  if (layout.moments.length > 0) {
    const printed = layout.moments.map((moment) => momentEntries(moment, order, modules));
    entries.push(['moments', printed]);
  }
  // The same rule one level up: a document with no edition says nothing about editions.
  if (layout.editions.length > 0) {
    const printed = layout.editions.map((edition) => editionEntries(edition, order, modules));
    entries.push(['editions', printed]);
  }
  return `${print(obj(entries), 0, 0, '')}\n`;
}

// --- the names both ends spell ---------------------------------------------------

/**
 * Re-exported rather than declared here, and `names.ts` says why in full: the dev
 * server needs the key and the address before it can match a request, and it cannot
 * import this file at all, because Node will not follow the core's JSON import without
 * an attribute.
 */
export {
  HOME_LAYOUT_ENDPOINT,
  HOME_LAYOUT_FILE,
  HOME_LAYOUT_KEY,
  HOME_TIME_KEY,
  sectionTestId,
} from './names';

/**
 * Whether the home document governs what the frame is showing.
 *
 * ADR 0042 §2: the track is drawn on the route the document describes and nowhere else.
 * On `/artikel` the hour changes nothing, because the document says nothing about that
 * screen, and a playhead there would move while the app did not — which is the kind of
 * quiet lie this repository spends its checks on.
 *
 * **The route the frame reports, not the route the field holds.** They part company while
 * somebody is typing, and for the second or two the app spends navigating; a track that
 * appeared on the first keystroke of `/artikel` would be answering about a screen nobody
 * is looking at yet. `preview/store.ts` reads the frame's own location back live and
 * `usePreview` hands it on, so the answer follows the app rather than the intention.
 *
 * `undefined` is "the frame has not said yet", which is every moment before the first
 * load settles, and it answers false: an absent control that appears is a smaller
 * surprise than a control that appears and then goes.
 *
 * One route today, and a list here rather than in the shell for the reason ADR 0042's
 * "What is still open" gives: when a second screen becomes a document, the answer has to
 * come from the document, not from a third copy of the fact ADR 0036 §14 spent a decision
 * making singular. This is the document's file, which is the nearest thing to that
 * available while there is one.
 */
export function governs(route: string | undefined): boolean {
  if (route === undefined) return false;
  // Query and hash are the app's business, and `/` and `/index` are one screen: Expo
  // Router serves the home route under both spellings and the frame reports whichever
  // it navigated with.
  const path = route.split(/[?#]/)[0].replace(/\/+$/, '');
  return path === '' || path === '/index';
}
