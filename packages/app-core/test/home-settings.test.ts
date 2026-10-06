import { describe, expect, it } from 'vitest';

import {
  faultOf,
  isTextLanguage,
  resolveText,
  settingsFor,
  textBoundOf,
  type LocalisedText,
  type TextSetting,
} from '../src/lib/home-settings';

/**
 * What a setting of each kind admits, which is the document's grammar rather than the
 * parser's code: `faultOf` answers which rule a value broke and `home-layout.ts` turns
 * that into a code. Testing it here rather than through `parseHomeLayout` is deliberate
 * for the text, because no module declares one yet — the app declares what it has a
 * renderer for, and the first text arrives with the block that reads it.
 *
 * The one thing that IS a parser question — a word where a count belongs costs its place
 * and is reported — is in `home-layout.test.ts`, where the codes are.
 */

/** A word as the app declares one: the bound and the line rule left out. */
const INTRO: TextSetting = { key: 'intro', kind: 'text', fallback: null };

/** The same, declared as more than one line, which is the only thing that grants a newline. */
const PARAGRAPH: TextSetting = { key: 'intro', kind: 'text', fallback: null, multiline: true };

/** German of a length in characters, which is how the bound is measured. */
const germanOf = (length: number): string => 'a'.repeat(length);

describe('a word, and the languages it may be written in', () => {
  it('refuses a language this build does not know, and knows the two it has', () => {
    // The rule is the language set rather than the key: a document that may carry
    // arbitrary keys becomes a document that has a place to put things (ADR 0075 §1).
    expect(faultOf(INTRO, { de: 'Mitmachen', fr: 'Participer' })).toBe('text-language-unknown');
    expect(isTextLanguage('fr')).toBe(false);
    expect(isTextLanguage('de')).toBe(true);
    expect(isTextLanguage('en')).toBe(true);
  });

  it('refuses English without German, which is never a valid word', () => {
    // A screen with no name has nothing to fall back to, so this one is a fault and not a
    // missing translation somebody can act on later (ADR 0075 §2).
    expect(faultOf(INTRO, { en: 'Take part' })).toBe('text-german-missing');
  });

  it('refuses a German that is blank, whitespace included', () => {
    expect(faultOf(INTRO, { de: '' })).toBe('text-german-missing');
    expect(faultOf(INTRO, { de: '   ' })).toBe('text-german-missing');
  });

  it('refuses 131 characters in a 120-character field, and takes 120', () => {
    expect(faultOf(INTRO, { de: germanOf(131) })).toBe('text-too-long');
    expect(faultOf(INTRO, { de: germanOf(120) })).toBeNull();
    // The bound is per language, so an English that is too long is refused on its own.
    expect(faultOf(INTRO, { de: 'Mitmachen', en: germanOf(121) })).toBe('text-too-long');
  });

  it('refuses a line break in a text that is one line and takes it in one that is not', () => {
    expect(faultOf(INTRO, { de: 'Mitmachen\nunterstützen' })).toBe('text-line-break');
    expect(faultOf(PARAGRAPH, { de: 'Mitmachen\nunterstützen' })).toBeNull();
  });

  it('refuses a carriage return, a byte order mark, a zero-width space and a mark that reorders', () => {
    // Everywhere, including in a text that granted a newline: these are the characters
    // ADR 0075 §1 refuses whatever the declaration says, because no wording in the
    // catalogue holds one and a public issue can carry a document too.
    for (const held of ['Mit\rmachen', 'Mit\u200bmachen', 'Mit\u200emachen', '\ufeffMitmachen']) {
      expect(faultOf(INTRO, { de: held })).toBe('text-control-character');
      expect(faultOf(PARAGRAPH, { de: held })).toBe('text-control-character');
    }
  });

  it('answers a value that is not a word as the wrong shape, whichever kind asked', () => {
    // `{ de: 42 }` is a value of the wrong shape rather than one of the five text faults:
    // it is not a word in any language, and the parser already has words for that.
    expect(faultOf(INTRO, 'Mitmachen')).toBe('invalid');
    expect(faultOf(INTRO, ['Mitmachen'])).toBe('invalid');
    expect(faultOf(INTRO, { de: 42 })).toBe('invalid');
  });

  it('holds a word to 120 characters and one line unless the declaration says otherwise', () => {
    expect(textBoundOf(INTRO)).toEqual({ maxChars: 120, multiline: false });
    expect(textBoundOf(PARAGRAPH)).toEqual({ maxChars: 120, multiline: true });
    expect(textBoundOf({ ...INTRO, maxChars: 40 })).toEqual({ maxChars: 40, multiline: false });
  });
});

describe('resolveText', () => {
  it('answers German in English when the document carries no English', () => {
    expect(resolveText({ de: 'Mitmachen' }, 'en')).toBe('Mitmachen');
  });

  it('answers the language asked for when the document carries it', () => {
    const text: LocalisedText = { de: 'Mitmachen', en: 'Take part' };
    expect(resolveText(text, 'en')).toBe('Take part');
    expect(resolveText(text, 'de')).toBe('Mitmachen');
  });

  /**
   * The two refusals in ADR 0075 §2: never the empty string, never the setting's key.
   * Both reach a reader as a bug nobody can report precisely, so a blank translation is
   * read as a missing one and falls back with it.
   */
  it('never answers the empty string, a blank translation included', () => {
    expect(resolveText({ de: 'Mitmachen', en: '' }, 'en')).toBe('Mitmachen');
  });
});

describe('the kinds that were there before the word', () => {
  it('answer a value of the wrong shape the way they always did', () => {
    // `holds` moved into this file as `faultOf`, and the four kinds' own rules are part of
    // what it is: a count inside its bounds and a term id are still taken, and a value
    // that is none of those is still one `invalid`.
    const rail = settingsFor('faktencheck-rail');
    const count = rail.find((spec) => spec.key === 'count');
    expect(count).toBeDefined();
    expect(faultOf(count!, 4)).toBeNull();
    expect(faultOf(count!, 0)).toBe('invalid');
    expect(faultOf(count!, 2.5)).toBe('invalid');
    const category = rail.find((spec) => spec.key === 'category');
    expect(faultOf(category!, null)).toBeNull();
    expect(faultOf(category!, 'klima')).toBe('invalid');
  });
});

describe('a screen the newsroom made, the kind a link block holds (ADR 0075 §7)', () => {
  const link = settingsFor('screen-link').find((spec) => spec.key === 'screen');

  it('is declared by the link block, with no screen as its fallback', () => {
    expect(link).toEqual({ key: 'screen', kind: 'screen', fallback: null });
  });

  it('admits an id a custom screen may have, and `null` for none', () => {
    expect(faultOf(link!, 'klima-krise')).toBeNull();
    expect(faultOf(link!, null)).toBeNull();
  });

  it('refuses what could not name a screen, by the rule the route reads', () => {
    for (const value of [
      '',
      'Klima',
      'a--b',
      'a'.repeat(41),
      'navigation',
      7,
      undefined,
      { de: 'x' },
    ]) {
      expect(faultOf(link!, value)).toBe('invalid');
    }
  });

  it('admits a well-formed id whatever document carries it: existing is the host’s question', () => {
    expect(faultOf(link!, 'never-published')).toBeNull();
    expect(faultOf(link!, 'home')).toBeNull();
  });
});
