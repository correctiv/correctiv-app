import type { HomeChange, HomeLayout, ModuleSettings } from '@correctiv/app-core/lib/home-layout';
import { TEXT_LANGUAGES } from '@correctiv/app-core/lib/home-settings';
import type { Locale } from '@correctiv/app-core/stores/settings';

import { holdsWord } from './document';

/**
 * Where a document's own words lack a language, counted over the whole screen.
 *
 * ADR 0075 §2 marks a missing translation "on the screen that lacks it". The field already
 * marks its own gap, but only while its block is open, so a screen with a gap in a block
 * nobody has looked at today reads as complete. This is the count that makes the gap
 * visible from the screen itself.
 *
 * **Only a word the document carries is counted.** A setting the document says nothing
 * about draws the block's own words, which are the app's and not this screen's to
 * translate. And only a title the editor can write: the shipped screens' names are the
 * app's declared ones, German by ADR 0049, and a mark nobody can act on is noise.
 */
export interface Gap {
  language: Locale;
  /** How many of the screen's texts do not carry it. */
  texts: number;
}

/** The only setting value that is an object is a word (`SettingValue`). */
function wordOf(value: unknown): Readonly<Record<string, string | undefined>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Readonly<Record<string, string | undefined>>;
}

function* wordsIn(
  settings: ModuleSettings | undefined,
): Generator<Readonly<Record<string, string | undefined>>> {
  for (const value of Object.values(settings ?? {})) {
    const words = wordOf(value);
    if (words !== null) yield words;
  }
}

function* wordsOfChanges(changes: readonly HomeChange[]) {
  for (const change of changes) yield* wordsIn(change.settings);
}

function* wordsOnScreen(layout: HomeLayout, custom: boolean) {
  if (custom && layout.words !== null) {
    yield layout.words.title;
    if (layout.words.tabLabel !== undefined) yield layout.words.tabLabel;
  }
  for (const section of layout.sections) yield* wordsIn(section.settings);
  for (const moment of layout.moments) yield* wordsOfChanges(moment.changes);
  for (const edition of layout.editions) {
    yield* wordsOfChanges(edition.changes);
    for (const moment of edition.moments) yield* wordsOfChanges(moment.changes);
  }
}

/** The languages some text of the screen lacks, in `TEXT_LANGUAGES` order; none when whole. */
export function gapsOf(layout: HomeLayout, custom: boolean): Gap[] {
  const counts = new Map<Locale, number>();
  for (const words of wordsOnScreen(layout, custom)) {
    for (const language of TEXT_LANGUAGES) {
      if (!holdsWord(words, language)) counts.set(language, (counts.get(language) ?? 0) + 1);
    }
  }
  return TEXT_LANGUAGES.filter((language) => counts.has(language)).map((language) => ({
    language,
    texts: counts.get(language) ?? 0,
  }));
}
