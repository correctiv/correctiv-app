/**
 * What a place on the home screen may be configured to show: the kinds a setting comes
 * in, and the two accessors a module reads one with.
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
 */

import { MODULE_SETTINGS } from './home-settings.generated';

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

export type SettingSpec = ArticleSetting | CountSetting;

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

export function itemCount(settings: Held, spec: CountSetting): number {
  const held = settings?.[spec.key];
  return typeof held === 'number' ? held : spec.fallback;
}
