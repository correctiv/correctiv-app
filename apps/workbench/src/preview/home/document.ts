import {
  DEFAULT_HOME_LAYOUT,
  formatTimeOfDay,
  MINUTES_IN_DAY,
  stateAt,
  type HomeChange,
  type HomeLayout,
  type HomeMoment,
  type HomeSection,
  type MinuteOfDay,
  type ModuleSettings,
  type SettingValue,
} from '@correctiv/app-core/lib/home-layout';
import type { IntlShape } from 'react-intl';

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
export function inheritedAt(layout: HomeLayout, point: Point): readonly HomeSection[] {
  return stateAt(layout, point === null ? -1 : point - 1);
}

/** The state a point PRODUCES: what the frame shows while it is in effect. */
export function effectiveAt(layout: HomeLayout, point: Point): readonly HomeSection[] {
  return stateAt(layout, point ?? 0);
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
   * reachable from the palette, which offers `Object.keys(HOME_MODULES)` and nothing else
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

  return {
    ...layout,
    sections,
    moments: layout.moments.map((moment) => ({
      ...moment,
      changes: moment.changes.filter((change) => change.id !== id),
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

  const before = inheritedAt(layout, point).find((section) => section.id === id);
  const inherits = Boolean(before?.hidden) === hidden;
  const edited = withChange(layout, point, id, (change) => {
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
): HomeLayout {
  const inherited = inheritedSetting(layout, point, id, key);
  const same = value !== undefined && inherited !== undefined && sameValue(inherited, value);
  const next = same || value === undefined ? undefined : value;

  const edited =
    point === null
      ? withSection(layout, id, (section) => withKey(section, key, next))
      : withChange(layout, point, id, (change) => withKey(change, key, next));
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
): SettingValue | undefined {
  const declared = layout.sections.find((section) => section.id === id);
  if (!declared) return undefined;
  if (point === null) return fallbackOf(declared.module, key);
  const before = inheritedAt(layout, point).find((section) => section.id === id);
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
        inheritedAt(layout, moment.minute).map((section) => [section.id, section]),
      );
      const changes = moment.changes
        .map((change) => settledChange(change, inherited.get(change.id)))
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
function settledChange(change: HomeChange, inherited: HomeSection | undefined): HomeChange | null {
  if (!inherited) return change;

  let next = change;
  if (next.hidden !== undefined && Boolean(inherited.hidden) === next.hidden) {
    const { hidden: _hidden, ...rest } = next;
    next = rest;
  }
  for (const key of Object.keys(next.settings ?? {})) {
    const held = next.settings?.[key];
    const was = valueOf(inherited, key);
    if (held !== undefined && was !== undefined && sameValue(was, held)) {
      next = withKey(next, key, undefined);
    }
  }

  // One key left is the id alone: a change naming a section and changing nothing about it.
  return Object.keys(next).length <= 1 ? null : next;
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
      const held = moment.changes.find((change) => change.id === id) ?? { id };
      const edited = next(held);
      const rest = moment.changes.filter((change) => change.id !== id);
      // One key left is the id alone: a change entry naming a section and changing
      // nothing about it.
      const changes = Object.keys(edited).length <= 1 ? rest : [...rest, edited];
      return {
        ...moment,
        changes: [...changes].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)),
      };
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
 * The ids whose place on the screen, or whose state AT THIS MINUTE, differs from the
 * shipped document at the same minute.
 *
 * At a minute, because that is the only honest comparison once the document is a day: a
 * section is not simply "changed", it is changed at eleven and not at nine, and a badge
 * that said otherwise would be a badge that means nothing at the time being looked at.
 *
 * Position is compared against the shipped index of the same id, which is why this
 * cannot be a per-section comparison: a section that moved makes its neighbour move too,
 * and an editor who lifted one block should not be told they changed four.
 */
export function changedAt(layout: HomeLayout, minute: MinuteOfDay): readonly string[] {
  const before = new Map(
    stateAt(SHIPPED, minute).map((section, index) => [section.id, { section, index }]),
  );
  return stateAt(layout, minute)
    .filter((section, index) => {
      const was = before.get(section.id);
      if (!was) return true;
      return (
        was.index !== index ||
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

export function formatLayoutDocument(layout: HomeLayout): string {
  const order = new Map(layout.sections.map((section, index) => [section.id, index]));
  const modules = new Map(layout.sections.map((section) => [section.id, section.module]));

  const entries: (readonly [string, unknown])[] = [
    ['version', layout.version],
    ['sections', layout.sections.map(sectionEntries)],
  ];
  /*
   * Written only when there is a day to describe. A document whose home screen is the
   * same at every hour says so by having no moments at all, and an empty list in the
   * file would read as a thing somebody had deleted the contents of.
   */
  if (layout.moments.length > 0) {
    const printed = layout.moments.map((moment) => momentEntries(moment, order, modules));
    entries.push(['moments', printed]);
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
export { HOME_LAYOUT_ENDPOINT, HOME_LAYOUT_KEY, HOME_TIME_KEY, sectionTestId } from './names';

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
