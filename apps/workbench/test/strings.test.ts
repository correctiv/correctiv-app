import { describe, expect, it } from 'vitest';

import {
  group,
  hasGap,
  haystackOf,
  keyOf,
  twinsOf,
  type StringEntry,
} from '../src/pages/strings-model.ts';

/**
 * Fixtures for `/strings`'s pure computations, not the real generated table.
 *
 * `strings-model.ts` takes its input as an argument rather than reading
 * `virtual:strings`, precisely so these can be handed a handful of made-up rows
 * instead of the several hundred the build joins out of the extraction and the
 * catalogues. A run of the real thing is `npm run strings`, which needs the app to
 * extract cleanly, and that is not a unit test.
 */
function entry(overrides: Partial<StringEntry> = {}): StringEntry {
  return {
    id: 'ns.id',
    surface: 'app',
    namespace: 'ns',
    english: 'Some wording',
    description: null,
    file: 'apps/mobile/src/example.tsx',
    line: 1,
    translations: { en: 'Some wording', de: 'Ein Wortlaut' },
    ...overrides,
  };
}

describe('keyOf, what identifies a row', () => {
  it('is the surface and the id together, spelled the way a heading prints it', () => {
    // Pinned rather than derived, because every other assertion in this file
    // writes the key out by hand. If this spelling moves, they all have to.
    expect(keyOf({ surface: 'app', id: 'settings.title' })).toBe('app \u00b7 settings.title');
  });

  it('tells the two surfaces apart for an id they both have', () => {
    // The real collision, not a made-up one: `settings.title` is an id in the app
    // and an id on this site, and both read "Settings" in English.
    expect(keyOf({ surface: 'app', id: 'settings.title' })).not.toBe(
      keyOf({ surface: 'workbench', id: 'settings.title' }),
    );
  });
});

describe('twinsOf, which ids share an English wording word for word', () => {
  it('lists the other id when two entries share the same English', () => {
    const twins = twinsOf([
      entry({ id: 'a.one', english: 'Same words' }),
      entry({ id: 'b.two', english: 'Same words' }),
    ]);

    expect(twins.get('app · a.one')).toEqual(['b.two']);
    expect(twins.get('app · b.two')).toEqual(['a.one']);
  });

  it('lists every other id, not just one, when three entries share the same English', () => {
    const twins = twinsOf([
      entry({ id: 'a.one', english: 'Same words' }),
      entry({ id: 'b.two', english: 'Same words' }),
      entry({ id: 'c.three', english: 'Same words' }),
    ]);

    expect(twins.get('app · a.one')).toEqual(['b.two', 'c.three']);
    expect(twins.get('app · b.two')).toEqual(['a.one', 'c.three']);
    expect(twins.get('app · c.three')).toEqual(['a.one', 'b.two']);
  });

  it('leaves an id out of the map when its English is unique', () => {
    const twins = twinsOf([
      entry({ id: 'a.one', english: 'Same words' }),
      entry({ id: 'b.two', english: 'Same words' }),
      entry({ id: 'c.solo', english: 'Nothing else reads this way' }),
    ]);

    expect(twins.has('app · c.solo')).toBe(false);
  });

  it('groups by the wording as written, so two spellings of one phrase stay apart', () => {
    // Deliberate, and the reason is in `twinsOf`'s docstring: two spellings of the
    // same phrase is itself the thing a translator wants to see, and folding them
    // together would file it under "same".
    const twins = twinsOf([
      entry({ id: 'a.one', english: 'Take part' }),
      entry({ id: 'b.two', english: 'Take Part' }),
      entry({ id: 'c.three', english: 'Take part ' }),
    ]);

    expect(twins.size).toBe(0);
  });

  it('does not pair an id with one in the other surface that happens to read the same', () => {
    // `settings.title` is "Settings" in both catalogues. That is not an ambiguity
    // anybody has to resolve: they are two catalogues with two audiences, and
    // whoever writes the German for one never opens the other.
    const twins = twinsOf([
      entry({ surface: 'app', id: 'settings.title', english: 'Settings' }),
      entry({ surface: 'workbench', id: 'settings.title', english: 'Settings' }),
    ]);

    expect(twins.size).toBe(0);
  });

  it('still pairs two ids inside the same surface', () => {
    // The other half of the rule above: narrowing to a surface must not narrow to
    // nothing. Two ids of the SAME surface sharing a wording is the case the whole
    // function exists for.
    const twins = twinsOf([
      entry({ surface: 'workbench', id: 'settings.mode.system', english: 'System' }),
      entry({ surface: 'workbench', id: 'settings.language.system', english: 'System' }),
      entry({ surface: 'app', id: 'settings.title', english: 'System' }),
    ]);

    expect(twins.get('workbench \u00b7 settings.mode.system')).toEqual([
      'settings.language.system',
    ]);
    expect(twins.has('app \u00b7 settings.title')).toBe(false);
  });

  it('does not call two blank entries twins of each other', () => {
    // An absent wording is not a shared wording. The seam test over the app already
    // refuses an id without a `defaultMessage`, so `strings.mjs`'s `?? ''` cannot
    // fire today; this pins the function rather than the pipeline in front of it.
    const twins = twinsOf([
      entry({ id: 'a.blank', english: '' }),
      entry({ id: 'b.blank', english: '' }),
    ]);

    expect(twins.has('app · a.blank')).toBe(false);
    expect(twins.has('app · b.blank')).toBe(false);
  });
});

describe('hasGap, a catalogue with nothing for this id in some language that ships', () => {
  const locales = ['en', 'de'];

  it('is true when a locale holds null', () => {
    const gapped = entry({ translations: { en: 'Present', de: null } });

    expect(hasGap(gapped, locales)).toBe(true);
  });

  it('is true when a locale holds the empty string', () => {
    const gapped = entry({ translations: { en: 'Present', de: '' } });

    expect(hasGap(gapped, locales)).toBe(true);
  });

  it('is false when every locale has a wording', () => {
    const whole = entry({ translations: { en: 'Present', de: 'Vorhanden' } });

    expect(hasGap(whole, locales)).toBe(false);
  });
});

describe('haystackOf, what the free-text filter is matched against', () => {
  it('matches on the id', () => {
    const haystack = haystackOf([entry({ id: 'gate.signIn' })]);

    expect(haystack.get('app · gate.signIn')).toContain('gate.signin');
  });

  it('matches on a German wording', () => {
    const haystack = haystackOf([
      entry({ id: 'gate.signIn', translations: { en: 'Sign in', de: 'Anmelden' } }),
    ]);

    expect(haystack.get('app · gate.signIn')).toContain('anmelden');
  });

  it('matches on the English', () => {
    const haystack = haystackOf([entry({ id: 'gate.signIn', english: 'Sign in' })]);

    expect(haystack.get('app · gate.signIn')).toContain('sign in');
  });

  it('matches on the description', () => {
    const haystack = haystackOf([
      entry({ id: 'gate.signIn', description: 'Read aloud and never drawn.' }),
    ]);

    expect(haystack.get('app · gate.signIn')).toContain('read aloud and never drawn');
  });

  it('matches on the surface, so typing a surface name narrows to it', () => {
    // What a third control in the context bar would otherwise have been. The bar
    // holds a filter and one segment already, and at 390px there is no room for
    // another.
    const haystack = haystackOf([entry({ surface: 'workbench', id: 'nav.strings' })]);

    expect(haystack.get('workbench \u00b7 nav.strings')).toContain('workbench');
  });

  it('keeps both rows when one id exists in both surfaces', () => {
    // Keyed by the id alone, this Map held one of the two and dropped the other
    // without a word, and the page would have shown one row's description against
    // the other row's wording.
    const haystack = haystackOf([
      entry({ surface: 'app', id: 'settings.title', description: 'The app’s screen.' }),
      entry({ surface: 'workbench', id: 'settings.title', description: 'This site’s dialog.' }),
    ]);

    expect(haystack.size).toBe(2);
    expect(haystack.get('app \u00b7 settings.title')).toContain('the app’s screen');
    expect(haystack.get('workbench \u00b7 settings.title')).toContain('this site’s dialog');
  });

  it('lower-cases everything, so a lower-case query still finds a mixed-case wording', () => {
    const haystack = haystackOf([entry({ id: 'gate.signIn', english: 'Sign In' })]);

    expect(haystack.get('app · gate.signIn')).not.toContain('Sign In');
    expect(haystack.get('app · gate.signIn')).toContain('sign in');
  });
});

describe('group, the entries cut into sections', () => {
  it('keeps consecutive entries of the same namespace in one section, in order', () => {
    const groups = group([
      entry({ id: 'a.one', namespace: 'a' }),
      entry({ id: 'a.two', namespace: 'a' }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['a.one', 'a.two']);
  });

  it('cuts a new section at each change of namespace, so a namespace that reappears later gets a section of its own', () => {
    const groups = group([
      entry({ id: 'a.one', namespace: 'a' }),
      entry({ id: 'b.one', namespace: 'b' }),
      entry({ id: 'a.two', namespace: 'a' }),
    ]);

    expect(groups.map((g) => g.name)).toEqual(['a', 'b', 'a']);
    expect(groups[0].entries.map((e) => e.id)).toEqual(['a.one']);
    expect(groups[2].entries.map((e) => e.id)).toEqual(['a.two']);
  });

  it('cuts at a change of surface even when the namespace has not changed', () => {
    // `settings` is a namespace in both. Cutting on the namespace alone ran them
    // into one heading, with the file path under each row as the only thing
    // saying which set of strings it belonged to.
    const groups = group([
      entry({ surface: 'app', id: 'settings.title', namespace: 'settings' }),
      entry({ surface: 'workbench', id: 'settings.title', namespace: 'settings' }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => [g.surface, g.name])).toEqual([
      ['app', 'settings'],
      ['workbench', 'settings'],
    ]);
  });

  it('carries the surface on the section, so the heading has it without reading a row', () => {
    const groups = group([entry({ surface: 'workbench', namespace: 'frame' })]);

    expect(groups[0]).toMatchObject({ surface: 'workbench', name: 'frame' });
  });
});
