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
import {
  settingsFor,
  type CountSetting,
  type SettingSpec,
} from '@correctiv/app-core/lib/home-settings';

/**
 * The home document, as a thing that can be edited and printed.
 *
 * Every export here is a pure function of a layout, or a name both ends of the tool have
 * to spell the same way. The three ways a change leaves the page — into the running
 * app's document, into the running app's clock, and into the repository — are `write.ts`
 * and `clock.ts`, and they are separate for a reason that is not tidiness: **this file is
 * imported by the dev server**. `plugin/home-layout.ts` prints what it writes with
 * `formatLayoutDocument` below, so a browser-only line here (`window`,
 * `import.meta.env`) would be an exception thrown while Vite loads its own config, and
 * the whole site would fail to start.
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
 */
export const MODULE_LABELS: Readonly<Record<string, { name: string; what: string }>> = {
  'home-header': { name: 'Header', what: 'The date, the greeting and the way into search.' },
  'feed-status': {
    name: 'Loading and offline notice',
    what: 'Only appears while the feeds load, or when they came out of the bundle.',
  },
  'article-hero': { name: 'Lead article', what: 'The newest investigation, full width.' },
  'spotlight-briefing': {
    name: 'Spotlight briefing',
    what: 'The current issue, with the way into the archive.',
  },
  'early-access-card': {
    name: 'Early access',
    what: 'What members see before everybody else.',
  },
  'latest-research': {
    name: 'Latest investigations',
    what: 'The investigations under the lead, as a list.',
  },
  'faktencheck-rail': {
    name: 'Fact checks',
    what: 'The newest fact checks, as a row that scrolls sideways.',
  },
  'callout-teaser': {
    name: 'Participation callout',
    what: 'The open callout. Two places in the document, one lifted over the lead at midday.',
  },
  'mediathek-reihe': { name: 'Mediathek', what: 'Video and audio, as a row.' },
  'backstage-teaser': { name: 'Backstage', what: 'The newsroom diary and the way in.' },
  'impact-footer': { name: 'Impact', what: 'What the reporting changed, and a thank-you.' },
};

/** A module with no entry above still has to draw a row, and its id is what is left. */
export function moduleLabel(module: string): { name: string; what: string } {
  return MODULE_LABELS[module] ?? { name: module, what: 'This tool has no description for it.' };
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
 * `test/preview/home-document.test.ts` holds the two lists together in both directions,
 * so a setting added to the core with no words here is a red test rather than a control
 * labelled `count`.
 */
export const SETTING_LABELS: Readonly<Record<string, { name: string; what: string }>> = {
  'article-hero.pin': {
    name: 'Which article leads',
    what: 'Pinned, or the newest investigation when nothing is.',
  },
  'latest-research.count': {
    name: 'How many investigations',
    what: 'The list under the lead article.',
  },
  'faktencheck-rail.count': {
    name: 'How many fact checks',
    what: 'The row that scrolls sideways.',
  },
};

export function settingLabel(module: string, spec: SettingSpec): { name: string; what: string } {
  return (
    SETTING_LABELS[`${module}.${spec.key}`] ?? { name: spec.key, what: 'No description for it.' }
  );
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
 * One step up or down, in the document's own order.
 *
 * Over the whole list rather than over what is on screen right now: the document is one
 * order and the time is a filter over it, so moving a section that is hidden at this
 * minute past one that is shown still means something and still has to be expressible.
 * At either end this answers with the layout it was given, so a button that cannot move
 * anything changes nothing rather than wrapping around.
 *
 * **Order is the document's and not a moment's**, which is ADR 0039 §3. A moment can
 * switch a place off and another one on, which is how the callout appears to move; what
 * it cannot do is rearrange the screen, because ADR 0036 §2 keeps the places fixed and
 * an arrangement that changed by the hour would be a layout engine in the app.
 */
export function moved(layout: HomeLayout, id: string, delta: -1 | 1): HomeLayout {
  const from = layout.sections.findIndex((section) => section.id === id);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= layout.sections.length) return layout;
  const sections = [...layout.sections];
  const [lifted] = sections.splice(from, 1);
  sections.splice(to, 0, lifted!);
  return { ...layout, sections };
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
