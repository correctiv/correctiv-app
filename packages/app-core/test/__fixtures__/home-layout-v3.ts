/**
 * The home document's parser as it shipped at version 3, frozen. Not code the app runs.
 *
 * ADR 0060 §6 rests on what an app written before audiences does with a document that has
 * them: it never sees the top-level `audiences`, and it drops a change carrying
 * `audience`. The version 2 fixture beside this one cannot answer that for a document with
 * editions, so this is `packages/app-core/src/lib/home-layout.ts` at commit 91e357e, the
 * `main` of the day before audiences, with the bundled document, the reporter and the
 * import of the ports taken out, the two imports pointed at the source, and nothing else
 * changed.
 *
 * **Do not update this file**, for the reason `home-layout-v2.ts` gives. The live imports
 * are the settings table and the Berlin clock, which a version 3 app carries its own copy
 * of; the tests using this fixture use only settings that existed at 91e357e.
 */

/**
 * The home screen as a day, and what it takes to read one somebody else wrote.
 *
 * [ADR 0036](../../../../adr/0036-the-home-screen-becomes-data.md) turned the screen's
 * source order into `data/home.layout.json`: an ordered list of sections, each naming a
 * module the host can draw. [ADR 0039](../../../../adr/0039-the-home-screen-is-a-day-not-a-timetable.md)
 * turns the rest of it — when a section appears, and what it is configured to show —
 * into a **sequence of moments**.
 *
 * ## The model, in one paragraph
 *
 * The document holds the places (`sections`) in their order, each with the state it is
 * in when the day starts. `moments` is a list of times, each carrying only what
 * **differs** from the state that precedes it. Rendering at a time is
 * `sectionsAt(layout, minutes)`: take the sections as written, apply every moment at or
 * before that minute, drop what is hidden. Inheritance is therefore not a feature with
 * code behind it — it is what the data already is, and a moment that changes nothing is
 * indistinguishable from a moment that is not there.
 *
 * `dayparts` is gone with ADR 0039 §5. Four named hours per section could say
 * "appear between 11 and 14" and nothing else; the shipped document used all four of
 * them to express exactly two moments, and every other question the product side asked
 * for — a fifth point, a point at 06:30, a different article in the evening — was
 * outside the vocabulary rather than merely unbuilt.
 *
 * ## Why this parses by hand and takes `unknown`
 *
 * ADR 0036 §4 fetches this document from somewhere, which makes it **somebody else's
 * file** even when it is ours: a deploy can be half-written, a proxy can answer with an
 * error page, and an editor can save a document this app has never seen. So nothing here
 * throws. `parseHomeLayout` answers with the layout it could make sense of and a list of
 * what it could not, and the caller decides what to do with either.
 *
 * No schema library, and that is a decision rather than an omission. The whole grammar
 * is a few lists and a few keys; a validator for it is the functions below, and a dependency
 * would buy error objects this file has to translate into `ErrorReport` context anyway.
 * What it would buy is worth less than the third-party code in a bundle that a phone
 * downloads.
 *
 * ## Drawing past what it does not know, and where that stops
 *
 * ADR 0036 §7 is the rule: the configuration moves faster than the app, so an app that
 * refuses a document it does not fully understand breaks every time the configuration is
 * ahead of it. Every fault below therefore costs one part of the document and never the
 * whole of it — and a document that is not a document at all costs the fetched copy, not
 * the screen, because `DEFAULT_HOME_LAYOUT` is bundled and always usable (§10).
 *
 * What is dropped is **the smallest thing that carries a rule this app cannot apply**.
 * In a section that is the section: a section's state is the section, so there is
 * nothing smaller to lose, and a place drawn with its rule ignored is a place the
 * newsroom believes it configured. In a moment it is the one change: the other changes
 * at that time are unrelated instructions about other places, and taking the whole
 * moment out would move sections nobody wrote anything wrong about.
 *
 * ## Editions, and the day that is always whole without them
 *
 * [ADR 0059](../../../../adr/0059-the-day-gets-a-date-and-the-newsroom-plans-in-editions.md)
 * adds `editions` beside the day: a named layer, active from a Berlin date and time until
 * another, carrying a starting state of its own (`changes`) and moments of its own, in the
 * grammar the day already has. Rendering at an **instant** is the fold one level up
 * (`stateAtInstant`): the day at that instant's minute, then every edition active at it in
 * precedence order, the narrower window last and therefore winning.
 *
 * The key sits beside `sections` and `moments` rather than inside either, and that is §5's
 * whole argument: a version 2 app reads those two and nothing else, so on election night it
 * draws the ordinary day. `test/home-layout.test.ts` holds that against a frozen copy of the
 * version 2 parser, because it is a property of the shape and not of this file.
 *
 * Every time the document writes is Berlin wall-clock time (§6), `at` included, and
 * `berlin-time.ts` is the one place an instant becomes one.
 */

import {
  addDays,
  berlinDayMinute,
  berlinInstant,
  berlinWallClock,
  parseBerlinDateTime,
  type Instant,
} from '../../src/lib/berlin-time';
import { MODULE_SETTINGS, type SettingSpec } from '../../src/lib/home-settings';

/**
 * The version this app was written against.
 *
 * ADR 0036 §6 argued for no version field at all, on the grounds that skipping what the
 * app does not recognise already answers the same question. The field is in the document
 * anyway, because the editor and the app agreed on the shape before that clause was
 * read, and because it costs one number to be able to say in a report WHICH document a
 * reader was looking at. It is deliberately not a gate: a document numbered for a later
 * app is reported and then read, part by part, exactly like every other one.
 *
 * It is 3 since ADR 0059, which added `editions`. A version 2 document is a version 3
 * document with no editions and is read exactly as it was, reported for its number like
 * any other. What a version 2 APP does with a version 3 document is the property that
 * record rests on: it reads the day and never sees an edition.
 *
 * It was 2 from ADR 0039. A version 1 document is still read — it is reported and then
 * parsed — and what it loses is every section that carried a `dayparts` key, because
 * that key is a rule this app can no longer apply. There is no migration here and
 * nothing to migrate: the fetch (`stores/homeLayout.ts`) arrived after version 2, so no
 * version 1 document was ever served, and a migration written against a document that
 * has never been served is a guess with upkeep.
 */
export const HOME_LAYOUT_VERSION = 3;

/**
 * Minutes since midnight in Berlin. The whole of what the document means by a time of day.
 *
 * Berlin and not the device's own zone since ADR 0059 §6: a reader in New York sees the
 * election-night switch at Berlin 18:00, and a screenshot taken on a runner in UTC shows
 * the hour it names.
 */
export type MinuteOfDay = number;

export const MINUTES_IN_DAY = 24 * 60;

/**
 * A module's configuration, as the document writes it.
 *
 * Deliberately flat and deliberately small: a value is a string, a number, a boolean or
 * `null`, and `null` is a value rather than an absence — for the settings that choose an
 * item it is ADR 0036 §3's "no override, so the rule runs", which is the thing an editor
 * needs to be able to say back. `home-settings.ts` is where a module declares which keys
 * it understands and what each one may hold.
 */
export type SettingValue = string | number | boolean | null;
export type ModuleSettings = Readonly<Record<string, SettingValue>>;

/**
 * One place on the home screen, as the day starts.
 *
 * `id` is the stable address — it is what an editor writes against, what a moment names
 * and what a report carries, so renaming one is a change to the document's meaning and
 * not a tidy-up. `module` names a renderer the host holds; two sections may name the
 * same one, which is how the callout gets two positions (ADR 0036 §2).
 *
 * Both optional fields are negative on purpose. `hidden` absent means shown and
 * `settings` absent means the module's own rule runs, so a document a person reads is
 * mostly ids and modules.
 */
export interface HomeSection {
  readonly id: string;
  readonly module: string;
  /** Off at the start of the day. Absent means shown. */
  readonly hidden?: boolean;
  /** What this place is configured to show. Absent means the module's rule runs. */
  readonly settings?: ModuleSettings;
}

/**
 * What one moment does to one section.
 *
 * Only the fields that differ. `hidden: false` is written here and never in a section,
 * and the asymmetry is the model in one line: in a section `hidden: false` says nothing
 * that leaving it out does not already say, while in a change it is the instruction that
 * brings a place back.
 *
 * `settings` merges key by key onto what the section already carries, so a moment that
 * changes which article leads does not have to restate the rest.
 */
export interface HomeChange {
  readonly id: string;
  readonly hidden?: boolean;
  readonly settings?: ModuleSettings;
}

/** A time of day, and everything that changes at it. */
export interface HomeMoment {
  /** `HH:MM`, Berlin, as the document writes it. */
  readonly at: string;
  /** The same time as a number, which is what the fold compares. */
  readonly minute: MinuteOfDay;
  readonly changes: readonly HomeChange[];
}

/**
 * A named layer over the day, active for a span: a campaign, an election night.
 *
 * ADR 0059 §3. The same shape the day has, one level up: `changes` is its starting state,
 * as `sections` is the day's, and `moments` are differences by time of day. `changes` is
 * the type that exists — hidden and settings, never order — because ADR 0039 §3 holds.
 *
 * `from` and `until` are Berlin wall clock, `until` exclusive, and both are required: an
 * exception has to end. `start` and `end` are the same two as instants, derived rather
 * than written, as `minute` is on a moment.
 */
export interface HomeEdition {
  readonly id: string;
  /** The newsroom's word for it. Data, not source, so it is never translated. */
  readonly title?: string;
  /** `YYYY-MM-DDTHH:MM`, Berlin, as the document writes it. */
  readonly from: string;
  /** The same, and exclusive: at `until` the edition is no longer in the fold. */
  readonly until: string;
  readonly start: Instant;
  readonly end: Instant;
  readonly changes: readonly HomeChange[];
  /** In time order, whatever order the document wrote them in. */
  readonly moments: readonly HomeMoment[];
}

export interface HomeLayout {
  readonly version: number;
  /** Ordered: the host draws them in this order and adds no order of its own. */
  readonly sections: readonly HomeSection[];
  /** In time order, whatever order the document wrote them in. */
  readonly moments: readonly HomeMoment[];
  /** In the document's order. Which of them wins is the fold's question, not this list's. */
  readonly editions: readonly HomeEdition[];
}

/**
 * Every key each kind of entry may carry, as a `Record` over its interface rather than
 * as a list.
 *
 * Adding a field to one of the types above and forgetting it here is a compile error.
 * Forgetting it the other way round would be worse than a compile error: the field would
 * be an unrecognised key, so everything using it would be dropped and the screen would
 * lose the places the new field was added for.
 */
const SECTION_KEYS: Record<keyof HomeSection, true> = {
  id: true,
  module: true,
  hidden: true,
  settings: true,
};

/** `minute` is derived rather than written, so it is not a key a document may carry. */
const MOMENT_KEYS: Record<Exclude<keyof HomeMoment, 'minute'>, true> = {
  at: true,
  changes: true,
};

const CHANGE_KEYS: Record<keyof HomeChange, true> = {
  id: true,
  hidden: true,
  settings: true,
};

/**
 * `start` and `end` are derived, like a moment's `minute`. `days` is not here, and that is
 * a decision: this app cannot apply a weekday condition, so an edition carrying one is an
 * edition with a key nobody here knows, and it goes the way a section with one goes.
 */
const EDITION_KEYS: Record<Exclude<keyof HomeEdition, 'start' | 'end'>, true> = {
  id: true,
  title: true,
  from: true,
  until: true,
  changes: true,
  moments: true,
};

/**
 * What a parse could not make sense of, one entry per fault.
 *
 * A code and values, never a sentence, because this goes out through `ErrorReporter` and
 * that port's contract is the same one `AudioError` follows: the caller knows what failed
 * and not what to say about it. `context` is what was already in hand — an index, an id,
 * a time, the offending name — and matches `ErrorReport['context']` so it can be handed
 * over unchanged.
 */
export type LayoutProblemCode =
  | 'document-not-an-object'
  | 'version-invalid'
  | 'version-unknown'
  | 'sections-not-an-array'
  | 'section-not-an-object'
  | 'section-id-invalid'
  | 'section-module-invalid'
  | 'section-id-duplicate'
  | 'section-unknown-key'
  | 'section-hidden-invalid'
  | 'section-settings-invalid'
  | 'section-setting-unknown'
  | 'section-setting-invalid'
  | 'module-unrecognised'
  | 'moments-not-an-array'
  | 'moment-not-an-object'
  | 'moment-unknown-key'
  | 'moment-time-invalid'
  | 'moment-time-duplicate'
  | 'moment-changes-invalid'
  | 'change-not-an-object'
  | 'change-id-invalid'
  | 'change-id-unknown'
  | 'change-unknown-key'
  | 'change-hidden-invalid'
  | 'change-settings-invalid'
  | 'change-setting-unknown'
  | 'change-setting-invalid'
  | 'editions-not-an-array'
  | 'edition-not-an-object'
  | 'edition-id-invalid'
  | 'edition-id-duplicate'
  | 'edition-unknown-key'
  | 'edition-title-invalid'
  | 'edition-condition-missing'
  | 'edition-from-missing'
  | 'edition-until-missing'
  | 'edition-from-invalid'
  | 'edition-until-invalid'
  | 'edition-span-in-gap'
  | 'edition-span-empty'
  | 'edition-changes-invalid';

export interface LayoutProblem {
  readonly code: LayoutProblemCode;
  readonly context: Record<string, string | number | boolean | null>;
}

export interface HomeLayoutParse {
  /** Null when the document was not a layout at all — the caller falls back. */
  readonly layout: HomeLayout | null;
  readonly problems: readonly LayoutProblem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** What a value IS, for a report, without pasting the value itself into one. */
function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * `HH:MM` to minutes since midnight, or null.
 *
 * Strict about the shape on purpose: `9:5` and `09:5` and `0900` are all somebody
 * meaning something, and a parser that guessed which would be the place the guess went
 * wrong. Both digits, both fields, and the ranges a clock has. 24:00 is not a time of
 * day — it is the same instant as 00:00 the next day, and a moment there would fold onto
 * a day this document does not describe.
 */
export function parseTimeOfDay(value: unknown): MinuteOfDay | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes back to `HH:MM`, which is how a moment is written and printed. */
export function formatTimeOfDay(minute: MinuteOfDay): string {
  const wrapped = ((minute % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(wrapped / 60);
  return `${String(hours).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
}

/**
 * What minute of the Berlin day an instant falls in. The day's only reading of a clock.
 *
 * It read the device's local day until ADR 0059 §6, and no record said so; the code did.
 * Berlin now, for the day's moments and an edition's alike, so that one document has one
 * clock and `at` means the same thing in both places it is written.
 *
 * It never runs backwards within a day, which only matters in the autumn's repeated hour
 * and is `berlinDayMinute`'s to explain.
 */
export function minuteOfDay(now: number | Date): MinuteOfDay {
  return berlinDayMinute(new Date(now).getTime());
}

/**
 * Read a document into a layout, and say what could not be read.
 *
 * `renderable` is the host's half of ADR 0036 §14: the set of module names it actually
 * holds a renderer for. Given one, a section naming anything else is dropped here with
 * `module-unrecognised`, so the host renders what it is handed and never has to decide
 * what to do with a section it cannot draw. Left out — the bundled document's own parse
 * below, and every test about the grammar — module names are taken as written.
 *
 * **Settings are judged either way**, because which keys a module understands is the
 * document's grammar and the grammar is this package's (`home-settings.ts`), while which
 * modules a host can DRAW is the host's. The two are separate questions and the parser
 * asks them separately.
 */
export function parseHomeLayout(input: unknown, renderable?: ReadonlySet<string>): HomeLayoutParse {
  const problems: LayoutProblem[] = [];

  if (!isRecord(input)) {
    problems.push({ code: 'document-not-an-object', context: { type: typeOf(input) } });
    return { layout: null, problems };
  }

  const { version, sections, moments, editions } = input;

  if (typeof version !== 'number' || !Number.isFinite(version)) {
    problems.push({ code: 'version-invalid', context: { type: typeOf(version) } });
    return { layout: null, problems };
  }
  if (!Array.isArray(sections)) {
    problems.push({ code: 'sections-not-an-array', context: { type: typeOf(sections) } });
    return { layout: null, problems };
  }
  if (version !== HOME_LAYOUT_VERSION) {
    // Reported and then read anyway — see HOME_LAYOUT_VERSION.
    problems.push({ code: 'version-unknown', context: { version, expected: HOME_LAYOUT_VERSION } });
  }

  const parsed: HomeSection[] = [];
  const taken = new Set<string>();
  sections.forEach((raw, index) => {
    const section = parseSection(raw, index, taken, renderable, problems);
    if (!section) return;
    taken.add(section.id);
    parsed.push(section);
  });

  const modules = new Map(parsed.map((section) => [section.id, section.module]));
  return {
    layout: {
      version,
      sections: parsed,
      moments: parseMoments(moments, modules, {}, problems),
      editions: parseEditions(editions, modules, problems),
    },
    problems,
  };
}

/** One section, or null with its fault appended to `problems`. */
function parseSection(
  raw: unknown,
  index: number,
  taken: ReadonlySet<string>,
  renderable: ReadonlySet<string> | undefined,
  problems: LayoutProblem[],
): HomeSection | null {
  if (!isRecord(raw)) {
    problems.push({ code: 'section-not-an-object', context: { index, type: typeOf(raw) } });
    return null;
  }

  const { id, module, hidden, settings } = raw;

  // The id first, because every problem after this one names it: a section whose id
  // cannot be read is one nobody can address, and `index` is all a report can offer.
  if (typeof id !== 'string' || id.length === 0) {
    problems.push({ code: 'section-id-invalid', context: { index, type: typeOf(id) } });
    return null;
  }
  if (typeof module !== 'string' || module.length === 0) {
    problems.push({ code: 'section-module-invalid', context: { id, type: typeOf(module) } });
    return null;
  }
  if (taken.has(id)) {
    // The first one wins. Not because it is more likely right, but because the
    // alternative is a rule about which duplicate the editor meant, and there is none.
    problems.push({ code: 'section-id-duplicate', context: { id, index } });
    return null;
  }

  const unknownKeys = Object.keys(raw).filter((key) => !Object.hasOwn(SECTION_KEYS, key));
  if (unknownKeys.length > 0) {
    for (const key of unknownKeys) {
      problems.push({ code: 'section-unknown-key', context: { id, key } });
    }
    return null;
  }

  if (hidden !== undefined && typeof hidden !== 'boolean') {
    problems.push({ code: 'section-hidden-invalid', context: { id, type: typeOf(hidden) } });
    return null;
  }

  const parsedSettings = parseSettings(settings, module, id, 'section', problems);
  if (parsedSettings === REFUSED) return null;

  if (renderable && !renderable.has(module)) {
    problems.push({ code: 'module-unrecognised', context: { id, module } });
    return null;
  }

  return {
    id,
    module,
    ...(hidden === undefined ? {} : { hidden }),
    ...(parsedSettings ? { settings: parsedSettings } : {}),
  };
}

/** The sentinel a settings parse answers with when its owner has to go. */
const REFUSED = Symbol('settings refused');

/**
 * A settings object against what its module understands, or `REFUSED`.
 *
 * `undefined` in and `undefined` out is the common case and the short line in the
 * document. `where` picks which half of the vocabulary the problem is reported in, so a
 * report says whether the fault was in the place or in something that happened to it.
 */
function parseSettings(
  raw: unknown,
  module: string,
  id: string,
  where: 'section' | 'change',
  problems: LayoutProblem[],
  /** Which edition the change is in, when it is in one; nothing for the day. */
  scope: Readonly<Record<string, string>> = {},
): ModuleSettings | undefined | typeof REFUSED {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    problems.push({
      code: where === 'section' ? 'section-settings-invalid' : 'change-settings-invalid',
      context: { ...scope, id, type: typeOf(raw) },
    });
    return REFUSED;
  }

  const understood = MODULE_SETTINGS[module] ?? [];
  const out: Record<string, SettingValue> = {};
  let refused = false;

  for (const [key, value] of Object.entries(raw)) {
    const spec = understood.find((candidate) => candidate.key === key);
    if (!spec) {
      problems.push({
        code: where === 'section' ? 'section-setting-unknown' : 'change-setting-unknown',
        context: { ...scope, id, module, key },
      });
      refused = true;
      continue;
    }
    if (!holds(spec, value)) {
      problems.push({
        code: where === 'section' ? 'section-setting-invalid' : 'change-setting-invalid',
        context: { ...scope, id, key, type: typeOf(value) },
      });
      refused = true;
      continue;
    }
    out[key] = value as SettingValue;
  }

  if (refused) return REFUSED;
  return Object.keys(out).length === 0 ? undefined : out;
}

/** Whether a value is one the spec's kind admits. */
function holds(spec: SettingSpec, value: unknown): boolean {
  switch (spec.kind) {
    case 'article':
      // `null` is the value that means ADR 0036 §3's rule runs, not an absent setting.
      return value === null || (typeof value === 'string' && value.length > 0);
    case 'count':
      return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= spec.min &&
        value <= spec.max
      );
  }
}

/**
 * The moments, in time order, whatever order they were written in.
 *
 * Sorted here rather than required of the document, because "at or before T" is a set
 * and not a sequence: the order two moments are written in carries no meaning and a
 * parser that insisted on one would be refusing a document that says exactly what it
 * means. Two moments at the SAME time is the one case where writing order would decide
 * something, so that is the one case that is refused.
 *
 * Absent is an empty list and not a fault. A home screen that does not change through
 * the day is a document somebody meant, and it is what every document looked like before
 * ADR 0039.
 */
function parseMoments(
  raw: unknown,
  modules: ReadonlyMap<string, string>,
  scope: Readonly<Record<string, string>>,
  problems: LayoutProblem[],
): readonly HomeMoment[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    problems.push({ code: 'moments-not-an-array', context: { ...scope, type: typeOf(raw) } });
    return [];
  }

  const parsed: HomeMoment[] = [];
  const taken = new Set<number>();

  raw.forEach((entry, index) => {
    if (!isRecord(entry)) {
      problems.push({
        code: 'moment-not-an-object',
        context: { ...scope, index, type: typeOf(entry) },
      });
      return;
    }

    const unknownKeys = Object.keys(entry).filter((key) => !Object.hasOwn(MOMENT_KEYS, key));
    if (unknownKeys.length > 0) {
      for (const key of unknownKeys) {
        problems.push({ code: 'moment-unknown-key', context: { ...scope, index, key } });
      }
      return;
    }

    const minute = parseTimeOfDay(entry.at);
    if (minute === null) {
      problems.push({
        code: 'moment-time-invalid',
        context: {
          ...scope,
          index,
          at: typeof entry.at === 'string' ? entry.at : typeOf(entry.at),
        },
      });
      return;
    }
    if (taken.has(minute)) {
      // The first one wins, for the reason a duplicate section id does: the alternative
      // is a rule about which of them the editor meant, and there is none.
      problems.push({
        code: 'moment-time-duplicate',
        context: { ...scope, index, at: entry.at as string },
      });
      return;
    }
    if (entry.changes !== undefined && !Array.isArray(entry.changes)) {
      problems.push({
        code: 'moment-changes-invalid',
        context: { ...scope, at: entry.at as string, type: typeOf(entry.changes) },
      });
      return;
    }

    const at = entry.at as string;
    const changes = ((entry.changes ?? []) as unknown[])
      .map((change, position) => parseChange(change, { ...scope, at }, position, modules, problems))
      .filter((change): change is HomeChange => change !== null);

    taken.add(minute);
    parsed.push({ at, minute, changes });
  });

  return parsed.sort((a, b) => a.minute - b.minute);
}

/**
 * One change, or null with its fault appended to `problems`.
 *
 * **Dropping a change is not dropping a place**, and that is ADR 0039 §6 read at the level
 * it is written for. The unit the rule drops is one place's instruction: a section is a
 * place's instruction for the day's start, a change is the same place's instruction at a
 * moment, and a fault in either costs that one and nothing around it. What differs is only
 * what stands behind the instruction. At the day's start nothing does, so the place goes.
 * At a moment the state the place is already in does, and inheritance is what the data IS
 * (§1) rather than a fallback chosen here — so "drop the change" cannot mean "show nothing
 * there", because there is no such state for the fold to produce.
 *
 * The cost is real and it is the one the record weighed for the other level: at 18:00 an
 * older app leads with the article the newsroom pinned in the morning, which looks
 * unconfigured. It is reported with the time, the place and the key rather than shown, and
 * it is a state the document could itself have meant, since a day that changes nothing at
 * six is an ordinary document.
 *
 * Both alternatives were read on 2026-09-17 and are worse. Dropping the SECTION makes a
 * fault at one minute cost the place for the whole day, the hours before the fault
 * included — a larger thing than the rule says to drop, and it would let a moment delete a
 * section the moments before it have already been parsed against. Dropping the one SETTING
 * and applying the rest of the change gives settings a granularity at a moment that they
 * do not have in a section, which is the second rule §6 refuses; nothing here weakens the
 * case for refusing it, because a place configured by a rule this app cannot apply is the
 * same fault whether the rule arrived at midnight or at six.
 */
function parseChange(
  raw: unknown,
  where: Readonly<Record<string, string>>,
  index: number,
  modules: ReadonlyMap<string, string>,
  problems: LayoutProblem[],
): HomeChange | null {
  if (!isRecord(raw)) {
    problems.push({
      code: 'change-not-an-object',
      context: { ...where, index, type: typeOf(raw) },
    });
    return null;
  }

  const { id, hidden, settings } = raw;

  if (typeof id !== 'string' || id.length === 0) {
    problems.push({ code: 'change-id-invalid', context: { ...where, index, type: typeOf(id) } });
    return null;
  }

  const module = modules.get(id);
  if (module === undefined) {
    // A change about a place the document does not have. It may be a section that was
    // dropped above, or one nobody ever declared; either way there is nothing to change
    // and a silent no-op is how a newsroom loses an edit without being told.
    problems.push({ code: 'change-id-unknown', context: { ...where, id } });
    return null;
  }

  const unknownKeys = Object.keys(raw).filter((key) => !Object.hasOwn(CHANGE_KEYS, key));
  if (unknownKeys.length > 0) {
    for (const key of unknownKeys) {
      problems.push({ code: 'change-unknown-key', context: { ...where, id, key } });
    }
    return null;
  }

  if (hidden !== undefined && typeof hidden !== 'boolean') {
    problems.push({
      code: 'change-hidden-invalid',
      context: { ...where, id, type: typeOf(hidden) },
    });
    return null;
  }

  const edition: Record<string, string> =
    where.edition === undefined ? {} : { edition: where.edition };
  const parsedSettings = parseSettings(settings, module, id, 'change', problems, edition);
  if (parsedSettings === REFUSED) return null;

  return {
    id,
    ...(hidden === undefined ? {} : { hidden }),
    ...(parsedSettings ? { settings: parsedSettings } : {}),
  };
}

/**
 * The editions, in the document's order, each read the way the day is read.
 *
 * ADR 0059 §3, and ADR 0039 §6's rule one level up: **drop the smallest thing that carries
 * the rule.** An edition's id, its span and its keys are the edition, so a fault in any of
 * them costs the edition; a fault in one of its moments costs the moment, and one in a
 * change costs the change, with exactly the codes the day reports, carrying `edition` in
 * their context so a report says whose moment it was.
 *
 * A key this app does not know drops the edition, which is what an edition carrying `days`
 * is to this app: §8 builds dated editions only, and a weekday edition read as though its
 * condition were not there would run on days the newsroom never chose.
 *
 * A title that is not a string costs the title and not the edition. It is the one field
 * here that carries no rule at all, only the newsroom's name for the thing, and nothing
 * about what readers see depends on it.
 */
function parseEditions(
  raw: unknown,
  modules: ReadonlyMap<string, string>,
  problems: LayoutProblem[],
): readonly HomeEdition[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    problems.push({ code: 'editions-not-an-array', context: { type: typeOf(raw) } });
    return [];
  }

  const parsed: HomeEdition[] = [];
  const taken = new Set<string>();
  raw.forEach((entry, index) => {
    const edition = parseEdition(entry, index, taken, modules, problems);
    if (!edition) return;
    taken.add(edition.id);
    parsed.push(edition);
  });
  return parsed;
}

/** One edition, or null with its fault appended to `problems`. */
function parseEdition(
  raw: unknown,
  index: number,
  taken: ReadonlySet<string>,
  modules: ReadonlyMap<string, string>,
  problems: LayoutProblem[],
): HomeEdition | null {
  if (!isRecord(raw)) {
    problems.push({ code: 'edition-not-an-object', context: { index, type: typeOf(raw) } });
    return null;
  }

  const { id, title, from, until, changes, moments } = raw;

  if (typeof id !== 'string' || id.length === 0) {
    problems.push({ code: 'edition-id-invalid', context: { index, type: typeOf(id) } });
    return null;
  }
  if (taken.has(id)) {
    // The first one wins, for the reason a duplicate section id does.
    problems.push({ code: 'edition-id-duplicate', context: { id, index } });
    return null;
  }

  const unknownKeys = Object.keys(raw).filter((key) => !Object.hasOwn(EDITION_KEYS, key));
  if (unknownKeys.length > 0) {
    for (const key of unknownKeys) {
      problems.push({ code: 'edition-unknown-key', context: { id, key } });
    }
    return null;
  }

  /*
   * The condition. One with neither half is the day, which already exists and is not an
   * edition; one with a start and no end is an exception that never ends, which §3
   * refuses; and one with an end and no start is the same fault from the other side.
   */
  if (from === undefined && until === undefined) {
    problems.push({ code: 'edition-condition-missing', context: { id } });
    return null;
  }
  if (until === undefined) {
    problems.push({ code: 'edition-until-missing', context: { id } });
    return null;
  }
  if (from === undefined) {
    problems.push({ code: 'edition-from-missing', context: { id } });
    return null;
  }

  const opens = parseBerlinDateTime(from);
  if (opens === null) {
    problems.push({
      code: 'edition-from-invalid',
      context: { id, from: typeof from === 'string' ? from : typeOf(from) },
    });
    return null;
  }
  const closes = parseBerlinDateTime(until);
  if (closes === null) {
    problems.push({
      code: 'edition-until-invalid',
      context: { id, until: typeof until === 'string' ? until : typeOf(until) },
    });
    return null;
  }
  const start = berlinInstant(opens.date, opens.minute)!;
  const end = berlinInstant(closes.date, closes.minute)!;
  /*
   * A wall time the spring change skips. `berlinInstant` reads it as the minute the clock
   * jumps to, which is right for a moment (it is passed and applied at the next minute) and
   * wrong for a span somebody typed: both ends in the gap read as one instant and the span
   * was reported empty, which said nothing about why. So it is refused with its own code.
   */
  for (const [key, value, clock, instant] of [
    ['from', from, opens, start],
    ['until', until, closes, end],
  ] as const) {
    const read = berlinWallClock(instant);
    if (read.date !== clock.date || read.minute !== clock.minute) {
      problems.push({ code: 'edition-span-in-gap', context: { id, [key]: value as string } });
      return null;
    }
  }
  if (end <= start) {
    // `until` is exclusive, so an edition ending where it starts is never in the fold, and
    // one ending before it is a typo nobody would find by looking at the phone.
    problems.push({
      code: 'edition-span-empty',
      context: { id, from: from as string, until: until as string },
    });
    return null;
  }

  if (changes !== undefined && !Array.isArray(changes)) {
    problems.push({ code: 'edition-changes-invalid', context: { id, type: typeOf(changes) } });
    return null;
  }

  let named: string | undefined;
  if (title !== undefined) {
    if (typeof title === 'string' && title.length > 0) named = title;
    else problems.push({ code: 'edition-title-invalid', context: { id, type: typeOf(title) } });
  }

  const scope = { edition: id };
  return {
    id,
    ...(named === undefined ? {} : { title: named }),
    from: from as string,
    until: until as string,
    start,
    end,
    changes: ((changes ?? []) as unknown[])
      .map((change, position) => parseChange(change, scope, position, modules, problems))
      .filter((change): change is HomeChange => change !== null),
    moments: parseMoments(moments, modules, scope, problems),
  };
}


/**
 * The document folded up to a minute of the day: every place, in order, in the state it
 * is in at that time — hidden ones included.
 *
 * This is the whole of the model. `sectionsAt` below is this with the hidden ones
 * dropped, and the editor draws this so that it can show a place that is switched off
 * rather than silently omitting it.
 *
 * A moment whose `changes` are empty contributes nothing, which is what makes it
 * indistinguishable from a moment that is not in the document at all — not by a rule
 * written somewhere, but because folding an empty list is the identity.
 */
export function stateAt(layout: HomeLayout, minute: MinuteOfDay): readonly HomeSection[] {
  const byId = new Map(layout.sections.map((section) => [section.id, section]));

  for (const moment of layout.moments) {
    if (moment.minute > minute) break;
    for (const change of moment.changes) {
      const section = byId.get(change.id);
      if (!section) continue;
      byId.set(change.id, applyChange(section, change));
    }
  }

  return layout.sections.map((section) => byId.get(section.id) ?? section);
}

/**
 * One change onto one section.
 *
 * `settings` merges key by key rather than replacing the object, which is the difference
 * between "the evening pins a different article" and "the evening restates everything
 * the morning said". A key that is written back to the value it already had is a change
 * that changes nothing, and the fold cannot tell that apart from not writing it — which
 * is correct, and is why the editor rather than the parser is what stops one being
 * written.
 */
function applyChange(section: HomeSection, change: HomeChange): HomeSection {
  const settings = change.settings ? { ...section.settings, ...change.settings } : section.settings;

  return {
    ...section,
    ...(change.hidden === undefined ? {} : { hidden: change.hidden }),
    ...(settings ? { settings } : {}),
  };
}

/**
 * The sections the DAY draws at a minute, in the document's order, with no edition.
 *
 * A selector over the document rather than a method on anything, per the core's own
 * rule, and the minute is a parameter rather than a clock: a host owns the timer that
 * says when the answer changes (`nextChangeAfter`), a test names a time, and the
 * workbench hands it a time the machine's clock disagrees with, which is the whole of
 * how the preview shows the evening at eleven in the morning.
 *
 * Since ADR 0059 this is the half of the answer a version 2 app gives, and it is kept
 * because ADR 0059 §5 needs it: the day is always a whole screen on its own.
 * `sectionsAtInstant` is what a host draws.
 */
export function sectionsAt(layout: HomeLayout, minute: MinuteOfDay): readonly HomeSection[] {
  return stateAt(layout, minute).filter((section) => !section.hidden);
}

/**
 * One change as the fold applies it, and where in the document it came from.
 *
 * `edition` is null for the day's own moments; `point` is the moment's minute, or null for
 * an edition's own `changes`. The day's sections are not in the list, because they are
 * not changes: they are what the list is applied to.
 *
 * The app needs only the result (`stateAtInstant`). The provenance is for the editor, which
 * has to say which edition decides a block and what a block would be without the point
 * being edited, and a second fold written there to answer that would be the one that
 * disagreed with this one.
 */
export interface AppliedChange {
  readonly edition: string | null;
  readonly point: MinuteOfDay | null;
  readonly change: HomeChange;
}

/**
 * Whether an edition is in the fold at an instant. `until` is exclusive.
 */
export function isActive(edition: HomeEdition, instant: Instant): boolean {
  return edition.start <= instant && instant < edition.end;
}

/**
 * The order editions are applied in, the widest first, so the narrowest wins.
 *
 * ADR 0059 §4: "the narrower window wins". For the dated editions this slice builds, that
 * is the longest span first and the shortest last; between two of the same length the one
 * that starts later is applied later, and between two that also start together the id
 * decides, in plain string order, so that the answer never depends on which of them the
 * document happens to list first. Weekday editions come before all of these when they are
 * built.
 */
export function byPrecedence(a: HomeEdition, b: HomeEdition): number {
  const span = b.end - b.start - (a.end - a.start);
  if (span !== 0) return span;
  if (a.start !== b.start) return a.start - b.start;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** The editions in the fold at an instant, in the order they are applied. */
export function editionsAt(layout: HomeLayout, instant: Instant): readonly HomeEdition[] {
  return layout.editions.filter((edition) => isActive(edition, instant)).sort(byPrecedence);
}

/**
 * When a moment of an edition last happened, at or before an instant and not before the
 * edition began, or null if it has not happened yet.
 *
 * An edition is one span and not a day that repeats, so its moments carry over midnight: a
 * pin changed at 23:00 on election night is still changed at 00:30. That is what "its own
 * moments that lie inside its span and at or before the instant" (§4) says, read as every
 * time the clock has shown `at` since the edition opened, applied in the order they
 * happened. Only the latest of each moment matters, because a change is a set of keys and
 * the last writer of each key is what stands.
 *
 * Two calendar days are enough: if today's occurrence is still ahead, yesterday's is
 * behind, because it fell before today's midnight.
 */
function lastOccurrence(minute: MinuteOfDay, instant: Instant, start: Instant): Instant | null {
  const { date } = berlinWallClock(instant);
  for (const day of [date, addDays(date, -1)]) {
    const at = berlinInstant(day, minute)!;
    if (at <= instant) return at >= start ? at : null;
  }
  /* c8 ignore next */
  return null;
}

/**
 * The moment of an edition in effect at an instant, or null while it is at its start.
 *
 * The edition's own version of the day's "which point is the playhead in": the moment that
 * happened most recently, since the edition opened. For an editor, which writes into the
 * point in effect (ADR 0039 §10, one level up by ADR 0059 §2).
 */
export function editionPointAt(edition: HomeEdition, instant: Instant): MinuteOfDay | null {
  let latest: { minute: MinuteOfDay; at: Instant } | null = null;
  for (const moment of edition.moments) {
    const at = lastOccurrence(moment.minute, instant, edition.start);
    if (at === null) continue;
    if (latest === null || at > latest.at || (at === latest.at && moment.minute > latest.minute)) {
      latest = { minute: moment.minute, at };
    }
  }
  return latest?.minute ?? null;
}

/**
 * Every change the fold applies at an instant, in the order it applies them.
 *
 * The day's moments at or before the instant's Berlin minute, as `stateAt` has always
 * applied them; then every active edition in precedence order, each contributing its own
 * `changes` and then its moments in the order they last happened. Later wins.
 */
export function changesAt(layout: HomeLayout, instant: Instant): readonly AppliedChange[] {
  const minute = minuteOfDay(instant);
  const applied: AppliedChange[] = [];

  for (const moment of layout.moments) {
    if (moment.minute > minute) break;
    for (const change of moment.changes) {
      applied.push({ edition: null, point: moment.minute, change });
    }
  }

  for (const edition of editionsAt(layout, instant)) {
    for (const change of edition.changes) {
      applied.push({ edition: edition.id, point: null, change });
    }
    const happened = edition.moments
      .map((moment) => ({ moment, at: lastOccurrence(moment.minute, instant, edition.start) }))
      .filter((held): held is { moment: HomeMoment; at: Instant } => held.at !== null)
      // By when it happened, and by the minute where two share an instant — which only the
      // spring gap can make, since every minute in it is the one instant the clock jumps.
      .sort((a, b) => a.at - b.at || a.moment.minute - b.moment.minute);
    for (const { moment } of happened) {
      for (const change of moment.changes) {
        applied.push({ edition: edition.id, point: moment.minute, change });
      }
    }
  }

  return applied;
}

/**
 * The document folded up to an instant: every place, in order, in the state it is in then.
 *
 * `stateAt` is this without editions, and it is what a version 2 app computes. This is the
 * whole model since ADR 0059, and `sectionsAtInstant` is this with the hidden places
 * dropped. The instant is a parameter for the reason the minute is one (ADR 0039 §8): the
 * core holds no clock.
 */
export function stateAtInstant(layout: HomeLayout, instant: Instant): readonly HomeSection[] {
  return applyAll(layout.sections, changesAt(layout, instant));
}

/** The places to draw at an instant, in the document's order. */
export function sectionsAtInstant(layout: HomeLayout, instant: Instant): readonly HomeSection[] {
  return stateAtInstant(layout, instant).filter((section) => !section.hidden);
}

/**
 * A list of changes onto the sections, in order.
 *
 * Exported for the editor, which folds the same list with one point taken out of it to say
 * what a block would be without that point.
 */
export function applyAll(
  sections: readonly HomeSection[],
  changes: readonly AppliedChange[],
): readonly HomeSection[] {
  const byId = new Map(sections.map((section) => [section.id, section]));
  for (const { change } of changes) {
    const section = byId.get(change.id);
    if (!section) continue;
    byId.set(change.id, applyChange(section, change));
  }
  return sections.map((section) => byId.get(section.id) ?? section);
}

/**
 * The next instant after this one at which the answer may change, or null if it never does.
 *
 * For a host that reads the clock on render. Home picks its sections when it renders, and
 * nothing re-renders a mounted tab on the hour, so without this a lifted block moves on the
 * next feed load or cold start rather than at the moment the document names. One timer to
 * this instant, cancelled with the screen, is what makes the screen agree with the
 * document.
 *
 * It answers with an instant, which it could not while the document was only a day:
 * `nextMomentAfter` answered with a minute and left the host to find the next one on its
 * own clock. An edition begins and ends on a date, so the question is about instants now,
 * and Berlin's clock changes are answered once, in `berlin-time.ts`, rather than in the
 * host as well.
 *
 * What counts: the day's next moment today; every edition's start and end; the next time
 * each active edition's moments happen before it ends; and the next Berlin midnight,
 * whenever the document has anything that changes at all. Midnight is where the day starts
 * again from its sections, and it is also what keeps the answer within a day of the
 * question: an edition three months out would otherwise be a wait longer than a host's
 * timer can hold. A wake-up that turns out to change nothing costs one render. A missed one
 * costs a screen that disagrees with the document until somebody touches it, so this errs
 * towards the first.
 *
 * The day's moments are compared against `minuteOfDay`, the reading the fold uses, so in
 * the autumn's repeated hour a moment that has already happened is not waited for again.
 */
export function nextChangeAfter(layout: HomeLayout, instant: Instant): Instant | null {
  const { date } = berlinWallClock(instant);
  const minute = minuteOfDay(instant);
  const candidates: Instant[] = [];

  for (const moment of layout.moments) {
    if (moment.minute <= minute) continue;
    candidates.push(berlinInstant(date, moment.minute)!);
  }
  if (layout.moments.length > 0 || layout.editions.length > 0) {
    candidates.push(berlinInstant(addDays(date, 1), 0)!);
  }

  for (const edition of layout.editions) {
    if (edition.start > instant) candidates.push(edition.start);
    if (edition.end > instant) candidates.push(edition.end);
    if (!isActive(edition, instant)) continue;
    for (const moment of edition.moments) {
      const today = berlinInstant(date, moment.minute)!;
      const next = today > instant ? today : berlinInstant(addDays(date, 1), moment.minute)!;
      if (next < edition.end) candidates.push(next);
    }
  }

  const later = candidates.filter((candidate) => candidate > instant);
  return later.length === 0 ? null : Math.min(...later);
}
