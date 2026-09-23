/**
 * The home document's parser as it shipped at version 2, frozen. Not code the app runs.
 *
 * ADR 0059 §5 rests on one property of the shape rather than of the current parser: an
 * app that was written against version 2 reads `version`, `sections` and `moments` and
 * never sees an edition, so during a campaign its readers get the ordinary day and not a
 * broken screen. The only honest way to hold that is to parse a version 3 document with
 * the version 2 code, and the version 2 code is what is below: `parseHomeLayout`,
 * `stateAt` and `sectionsAt` out of `packages/app-core/src/lib/home-layout.ts` at commit
 * fbb2756, the last one before editions, with the bundled document, the reporter and the
 * clock taken out, and nothing else changed.
 *
 * **Do not update this file.** It is a copy on purpose, and a copy that followed the
 * source would be the current parser under another name. The one live import is the
 * settings table, which is generated from the app's modules and which a version 2 app
 * carries its own copy of; a key added there later is one the version 2 app would refuse,
 * and the tests using this fixture only use settings that existed at fbb2756.
 */

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
 * It is 2 since ADR 0039. A version 1 document is still read — it is reported and then
 * parsed — and what it loses is every section that carried a `dayparts` key, because
 * that key is a rule this app can no longer apply. There is no migration here and
 * nothing to migrate: the document is compiled in, nothing fetches one yet, and a
 * migration written against a document that has never been served is a guess with
 * upkeep.
 */
export const HOME_LAYOUT_VERSION = 2;

/** Minutes since local midnight. The whole of what the document means by a time. */
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
  /** `HH:MM`, local, as the document writes it. */
  readonly at: string;
  /** The same time as a number, which is what the fold compares. */
  readonly minute: MinuteOfDay;
  readonly changes: readonly HomeChange[];
}

export interface HomeLayout {
  readonly version: number;
  /** Ordered: the host draws them in this order and adds no order of its own. */
  readonly sections: readonly HomeSection[];
  /** In time order, whatever order the document wrote them in. */
  readonly moments: readonly HomeMoment[];
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
  | 'change-setting-invalid';

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

  const { version, sections, moments } = input;

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
    layout: { version, sections: parsed, moments: parseMoments(moments, modules, problems) },
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
): ModuleSettings | undefined | typeof REFUSED {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) {
    problems.push({
      code: where === 'section' ? 'section-settings-invalid' : 'change-settings-invalid',
      context: { id, type: typeOf(raw) },
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
        context: { id, module, key },
      });
      refused = true;
      continue;
    }
    if (!holds(spec, value)) {
      problems.push({
        code: where === 'section' ? 'section-setting-invalid' : 'change-setting-invalid',
        context: { id, key, type: typeOf(value) },
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
  problems: LayoutProblem[],
): readonly HomeMoment[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    problems.push({ code: 'moments-not-an-array', context: { type: typeOf(raw) } });
    return [];
  }

  const parsed: HomeMoment[] = [];
  const taken = new Set<number>();

  raw.forEach((entry, index) => {
    if (!isRecord(entry)) {
      problems.push({ code: 'moment-not-an-object', context: { index, type: typeOf(entry) } });
      return;
    }

    const unknownKeys = Object.keys(entry).filter((key) => !Object.hasOwn(MOMENT_KEYS, key));
    if (unknownKeys.length > 0) {
      for (const key of unknownKeys) {
        problems.push({ code: 'moment-unknown-key', context: { index, key } });
      }
      return;
    }

    const minute = parseTimeOfDay(entry.at);
    if (minute === null) {
      problems.push({
        code: 'moment-time-invalid',
        context: { index, at: typeof entry.at === 'string' ? entry.at : typeOf(entry.at) },
      });
      return;
    }
    if (taken.has(minute)) {
      // The first one wins, for the reason a duplicate section id does: the alternative
      // is a rule about which of them the editor meant, and there is none.
      problems.push({ code: 'moment-time-duplicate', context: { index, at: entry.at as string } });
      return;
    }
    if (entry.changes !== undefined && !Array.isArray(entry.changes)) {
      problems.push({
        code: 'moment-changes-invalid',
        context: { at: entry.at as string, type: typeOf(entry.changes) },
      });
      return;
    }

    const at = entry.at as string;
    const changes = ((entry.changes ?? []) as unknown[])
      .map((change, position) => parseChange(change, at, position, modules, problems))
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
  at: string,
  index: number,
  modules: ReadonlyMap<string, string>,
  problems: LayoutProblem[],
): HomeChange | null {
  if (!isRecord(raw)) {
    problems.push({ code: 'change-not-an-object', context: { at, index, type: typeOf(raw) } });
    return null;
  }

  const { id, hidden, settings } = raw;

  if (typeof id !== 'string' || id.length === 0) {
    problems.push({ code: 'change-id-invalid', context: { at, index, type: typeOf(id) } });
    return null;
  }

  const module = modules.get(id);
  if (module === undefined) {
    // A change about a place the document does not have. It may be a section that was
    // dropped above, or one nobody ever declared; either way there is nothing to change
    // and a silent no-op is how a newsroom loses an edit without being told.
    problems.push({ code: 'change-id-unknown', context: { at, id } });
    return null;
  }

  const unknownKeys = Object.keys(raw).filter((key) => !Object.hasOwn(CHANGE_KEYS, key));
  if (unknownKeys.length > 0) {
    for (const key of unknownKeys) {
      problems.push({ code: 'change-unknown-key', context: { at, id, key } });
    }
    return null;
  }

  if (hidden !== undefined && typeof hidden !== 'boolean') {
    problems.push({ code: 'change-hidden-invalid', context: { at, id, type: typeOf(hidden) } });
    return null;
  }

  const parsedSettings = parseSettings(settings, module, id, 'change', problems);
  if (parsedSettings === REFUSED) return null;

  return {
    id,
    ...(hidden === undefined ? {} : { hidden }),
    ...(parsedSettings ? { settings: parsedSettings } : {}),
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
 * The sections to draw at a minute of the day, in the document's order.
 *
 * A selector over the document rather than a method on anything, per the core's own
 * rule, and the minute is a parameter rather than a clock: a host owns the timer that
 * says when the answer changes (`nextMomentAfter`), a test names a time, and the
 * workbench hands it a time the machine's clock disagrees with, which is the whole of
 * how the preview shows the evening at eleven in the morning.
 */
export function sectionsAt(layout: HomeLayout, minute: MinuteOfDay): readonly HomeSection[] {
  return stateAt(layout, minute).filter((section) => !section.hidden);
}

