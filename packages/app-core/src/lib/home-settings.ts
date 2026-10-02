/**
 * What a place on the home screen may be configured to show: the kinds a setting comes
 * in, the accessors a module reads one with, and what each kind admits.
 *
 * ADR 0036 §2 made the *arrangement* data and left what each place draws to the module
 * that draws it. [ADR 0039](../../../../adr/0039-the-home-screen-is-a-day-not-a-timetable.md)
 * §4 opens the second half: a section carries a `settings` object, its shape depends on
 * its module, and a moment can change one setting without restating the rest.
 *
 * ## Why the table is in this package, and why it is not written here
 *
 * The parser has to refuse a setting a module does not understand, the way it already
 * refuses a key a section does not understand — a fetched document is somebody else's
 * file, and a place configured by a rule this app cannot apply is a place the newsroom
 * believes it configured. Refusing means knowing, so **which keys exist is part of the
 * document's grammar**, and the grammar is this package's: `parseHomeLayout(document)`
 * answers the same way in a test, in a check, in the configurator and in the app, with
 * nothing booted first.
 *
 * What it is NOT is a thing to write here.
 * [ADR 0045](../../../../adr/0045-the-home-editor-arranges-the-blocks-it-draws.md) §9 puts
 * the declaration beside the module that reads it, in `apps/mobile/src/lib/home/settings.ts`,
 * and has `apps/mobile/scripts/generate-home-settings.mjs` carry it here into
 * `home-settings.generated.ts`. A generator rather than an import, because this package is
 * a dependency of that app and an import the other way is a cycle; a generator rather than
 * registration at startup, because a table handed over at boot is a parser that answers
 * differently depending on what ran first.
 *
 * So `MODULE_SETTINGS` below is re-exported rather than declared. Its members are not:
 * `HERO_PIN` and the two counts live in the app now, because a module that READS a
 * setting needs its exact kind and not the union.
 *
 * What is NOT here either way is which modules a host can draw: that is the host's, it
 * arrives as `renderable` in `parseHomeLayout`, and the two questions are asked
 * separately. Nor are the words an editor reads. A label is how the workbench asks a
 * person for a value, so it lives beside the module labels the workbench already keeps,
 * and `apps/workbench/test/preview/home-document.test.ts` holds the two lists together in
 * both directions.
 *
 * ## Why every setting carries its default
 *
 * `latest-research` drew five items because `slice(1, 6)` said so in the app. The moment
 * an editor can change that number, "five" is a fact in two places — the module that
 * slices and the editor that has to show what happens when nobody has chosen. It is one
 * place, in the declaration, and both read it.
 *
 * A module with no entry in the table understands no settings, which is most of them.
 * That is not an omission to fill in: a setting exists because somebody named an
 * editorial question it answers, and inventing one because a module looked bare is how a
 * configuration surface grows fields nobody uses and everybody has to keep working.
 *
 * ## The fifth kind, which is a word rather than a scalar
 *
 * [ADR 0075](../../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §1 gives a setting a kind `text`, whose value is not a string but an object keyed by
 * language, and §2 makes German the one language a document has to carry. It is the first
 * kind whose value is not a scalar, so what it admits is asked here rather than guessed at
 * from the shape: {@link faultOf} answers which rule a value broke, and the parser turns
 * that into its own codes.
 *
 * Three things belong here rather than in a declaration, and the reason is the same for
 * all three: the declaration file the generator imports may import **types only**, so a
 * default it cannot name is a default the core has to hold. Which languages a document may
 * carry (§1 — the ones this build knows, and no others, because a document that may carry
 * arbitrary keys becomes a place to put things), the bound a text is held to
 * (`TEXT_MAX_CHARS`, filled in by {@link textBoundOf}), and the resolution the app draws
 * with ({@link resolveText}).
 *
 * **A missing translation is not a fault.** §2: German is required and every other
 * language is optional, because a required field somebody has to get past gets filled with
 * the German, and then nothing distinguishes a translation from a placeholder. So `faultOf`
 * refuses English that is absent and not English that is missing.
 */

import { MODULE_SETTINGS } from './home-settings.generated';
import type { Locale } from '../stores/settings';

/** A choice of one item, by the address the app already addresses it with. */
export interface ArticleSetting {
  readonly key: string;
  readonly kind: 'article';
  /**
   * `null` is the value, not the absence of one.
   *
   * ADR 0036 §3: every place has a rule, and the configuration may override it with a
   * specific item. `null` is that override being taken off again, which an editor has to
   * be able to say at a later moment — "the morning pins this, the afternoon goes back to
   * whatever is newest" is one change and not the deletion of one.
   */
  readonly fallback: null;
}

/** A whole number of items, within bounds the module can actually draw. */
export interface CountSetting {
  readonly key: string;
  readonly kind: 'count';
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
}

/**
 * A WordPress category, by its numeric id, which makes a block's rule configurable
 * ([ADR 0057](../../../../adr/0057-the-structure-comes-from-the-workbench-the-selection-from-wordpress.md)
 * §2, ADR 0071 §7).
 *
 * The fallback is the category the block draws today (`null` for "every post"), so a
 * document that sets nothing reproduces the screen as it was. A held `null` is a value,
 * as it is for a pin: "no category", whatever the fallback says.
 */
export interface CategorySetting {
  readonly key: string;
  readonly kind: 'category';
  readonly fallback: number | null;
}

/** A WordPress tag, by its numeric id. Same meaning as {@link CategorySetting}. */
export interface TagSetting {
  readonly key: string;
  readonly kind: 'tag';
  readonly fallback: number | null;
}

/**
 * What a place says in words, one string per language.
 *
 * German is required and typed required, so a caller cannot build one without it; every
 * other language may be absent, which is what ADR 0075 §2 means by "optional", and the
 * value is `string | undefined` for exactly those keys. Nothing here knows which languages
 * exist — {@link isTextLanguage} is what answers that, and the parser is the one that asks.
 */
export type LocalisedText = Readonly<Record<string, string | undefined>> & {
  readonly de: string;
};

/**
 * A word: the fifth kind, and the only one whose value is an object.
 *
 * ADR 0075 §1. A screen's title and the sentence under a heading are the newsroom's, they
 * live in the document rather than in the catalogue (ADR 0054 §3's third owner), and the
 * bound travels with the declaration for the reason every default here does: a title is a
 * line and an introduction is a sentence or two, and the newsroom is the one who says
 * which of the two a given field is.
 *
 * The two fields are optional so that the common case is short to write, and their defaults
 * are **here** rather than in the declaration because the file the generator imports may
 * import types only (`apps/mobile/src/lib/home/settings.ts` says so in its own head). What
 * a declaration cannot do is leave the language set out: that is this file's, since it is
 * a fact about the build rather than about a block.
 */
export interface TextSetting {
  readonly key: string;
  readonly kind: 'text';
  /** Characters one language's string may hold; the core's own bound when left out. */
  readonly maxChars?: number;
  /** Whether a newline may be in it. Absent means one line, which is most words. */
  readonly multiline?: boolean;
  /**
   * The words a document that sets this one draws, which is `null` for "none" — the same
   * answer a pin gives, and for the same reason: a module that has no words of its own to
   * fall back to has to be able to say so.
   */
  readonly fallback: LocalisedText | null;
}

/**
 * The characters a text may not carry: every C0 and C1 control except the newline a
 * `multiline` text is granted, plus the three kinds ADR 0075 §1 names — the byte order
 * mark a copy out of a word processor leaves at the start, the zero-width characters a
 * keyboard can type without showing anything, and the marks that reorder what a reader
 * sees.
 *
 * The newline is absent from the class and judged on its own, because whether it is a fault
 * is a property of the declaration rather than of the character (ADR 0075 §1 grants it to
 * a text that says it is more than one line). Everything else here is refused everywhere,
 * a lone carriage return included: it is what a document written on another platform
 * carries, and it is a line break this parser did not grant.
 */
const FORBIDDEN_IN_TEXT =
  // oxlint-disable-next-line no-control-regex -- matching control characters is the point
  /[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u2066-\u2069\ufeff]/;

/**
 * The bound a text is held to when its declaration names none.
 *
 * A number rather than a character count in prose because it is the one that decides
 * whether a heading can be drawn at all, and 120 is a sentence or two: long enough for an
 * introduction and short enough that a screen's name is still a name.
 */
const TEXT_MAX_CHARS = 120;

/** The bound and the line rule a declaration asks for, with the defaults filled in. */
export interface TextBound {
  readonly maxChars: number;
  readonly multiline: boolean;
}

/**
 * What a text is held to, which the editor asks the same way the parser does.
 *
 * One function rather than two readers of the two optional fields, because the defaults
 * belong together: a declaration that sets neither is the common case, and an editor that
 * read one field itself and the other through here would be half a bound.
 */
export function textBoundOf(spec: TextSetting): TextBound {
  return { maxChars: spec.maxChars ?? TEXT_MAX_CHARS, multiline: spec.multiline ?? false };
}

/**
 * The languages a document may carry a word in: the ones this build knows.
 *
 * ADR 0075 §1 ties the set to the catalogue's languages, which are the core's own
 * `Locale`, and §1's open question 1 leaves it at that — whether a document may carry a
 * language the app does not ship is not decided, so the set is not open here either. The
 * core cannot import the catalogue (ADR 0006), and it does not have to: the fact it needs
 * is which language a string is written in, and `Locale` is already that.
 */
export const TEXT_LANGUAGES: readonly Locale[] = ['de', 'en'];

const KNOWN_TEXT_LANGUAGES: ReadonlySet<string> = new Set(TEXT_LANGUAGES);

/**
 * The language a word must carry and the one the app falls back to.
 *
 * ADR 0075 §2: a screen with no name has nothing to fall back to, so German missing or
 * blank is the one translation fault that costs the place.
 */
export const TEXT_FALLBACK_LANGUAGE: Locale = 'de';

/** Whether a key a document wrote names a language this build knows. */
export function isTextLanguage(language: string): boolean {
  return KNOWN_TEXT_LANGUAGES.has(language);
}

/**
 * What the app draws for a word in the language the host names: the locale, then German.
 *
 * ADR 0075 §2, and both refusals in it are the point: **never** the empty string and
 * **never** the setting's key, because each of those reaches a reader as a bug nobody can
 * report precisely. A blank translation is therefore read as a missing one and falls back
 * with it, which is what the parser's refusal of a blank German is for — German is the one
 * language that may not be blank, because it is the one this falls back to.
 */
export function resolveText(text: LocalisedText, locale: Locale): string {
  const own = text[locale];
  return own === undefined || own.length === 0 ? text.de : own;
}

export type SettingSpec =
  | ArticleSetting
  | CountSetting
  | CategorySetting
  | TagSetting
  | TextSetting;

/**
 * What a value that its spec does not admit is wrong with, or null when it is one.
 *
 * One vocabulary for every kind, so `parseHomeLayout` has a single thing to turn into its
 * own codes and this package never has to know where a setting was found. `invalid` is the
 * answer the first four kinds have always given, and the five text faults are named
 * separately because a newsroom holding a refused document has to be told which of ADR 0075
 * §1's rules it broke, and "invalid" answers none of them.
 *
 * **The order of the text checks is the order of what a person got wrong.** A foreign
 * language before a missing German, because the foreign key is the visible mistake; a
 * missing German before a bound, because without it nothing can be measured.
 */
export type SettingFault =
  | 'invalid'
  | 'text-language-unknown'
  | 'text-german-missing'
  | 'text-too-long'
  | 'text-control-character'
  | 'text-line-break';

/** What is wrong with a value for its spec, or null when the spec admits it. */
export function faultOf(spec: SettingSpec, value: unknown): SettingFault | null {
  switch (spec.kind) {
    case 'article':
      // `null` is the value that means ADR 0036 §3's rule runs, not an absent setting.
      return value === null || (typeof value === 'string' && value.length > 0) ? null : 'invalid';
    case 'count':
      return typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= spec.min &&
        value <= spec.max
        ? null
        : 'invalid';
    case 'category':
    case 'tag':
      // A WordPress term id, or `null` for "no term"; never `0` and never a slug, which
      // is editable where an id is not (`data/feeds.config.ts`).
      return value === null || (typeof value === 'number' && Number.isInteger(value) && value > 0)
        ? null
        : 'invalid';
    case 'text':
      return textFaultOf(spec, value);
  }
}

/**
 * The text faults, and why each one is its own answer.
 *
 * A value that is not an object at all is `invalid` rather than a text fault, which is
 * what it is: a string where a word belongs is a value of the wrong shape, the same as a
 * string where a count belongs, and the parser reports it in the words it has always used
 * for that.
 */
function textFaultOf(spec: TextSetting, value: unknown): SettingFault | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return 'invalid';
  const words = value as Readonly<Record<string, unknown>>;
  const held = Object.values(words);

  // A value that is not a string is the wrong shape, whichever language it is under: a
  // number where German belongs is not a word without its German, it is not a word at all.
  if (!held.every((one): one is string => typeof one === 'string')) return 'invalid';

  for (const language of Object.keys(words)) {
    if (!isTextLanguage(language)) return 'text-language-unknown';
  }

  const german = words[TEXT_FALLBACK_LANGUAGE] as string | undefined;
  if (german === undefined || german.trim().length === 0) return 'text-german-missing';

  const bound = textBoundOf(spec);
  for (const one of held) {
    if (FORBIDDEN_IN_TEXT.test(one)) return 'text-control-character';
    if (one.includes('\n') && !bound.multiline) return 'text-line-break';
    if (one.length > bound.maxChars) return 'text-too-long';
  }
  return null;
}

/**
 * Module name, as the document writes it, to the settings it understands.
 *
 * Generated from the declarations beside the modules, and re-exported here because this
 * is the module the parser, the app and the workbench all already import. The file it
 * comes from is the artefact; this is its address.
 */
export { MODULE_SETTINGS };

/** What a module understands, which for most of them is nothing. */
export function settingsFor(module: string): readonly SettingSpec[] {
  return MODULE_SETTINGS[module] ?? [];
}

/**
 * A place's settings as the two kinds read them, or the module's own default.
 *
 * Two accessors rather than one generic, because the two kinds answer different
 * questions and a caller always knows which it is asking. The cast in each is the seam
 * between a document that has been validated and a caller that knows what it asked for:
 * `parseHomeLayout` checked this value against the same spec, so a `count` here is an
 * integer within its bounds and a `pin` is a non-empty string or `null`.
 *
 * A module drawing a setting it does not declare reads `undefined` and gets the
 * fallback, which is the same thing it drew before the setting existed.
 */
type Held = Readonly<Record<string, unknown>> | undefined;

export function pinnedItem(settings: Held, spec: ArticleSetting): string | null {
  const held = settings?.[spec.key];
  return typeof held === 'string' ? held : spec.fallback;
}

/** The term a rule asks for: the held id, a held `null` ("none"), or the module's own. */
export function termOf(settings: Held, spec: CategorySetting | TagSetting): number | null {
  const held = settings?.[spec.key];
  return typeof held === 'number' || held === null ? held : spec.fallback;
}

export function itemCount(settings: Held, spec: CountSetting): number {
  const held = settings?.[spec.key];
  return typeof held === 'number' ? held : spec.fallback;
}
