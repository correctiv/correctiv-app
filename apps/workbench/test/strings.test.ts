import { describe, expect, it } from 'vitest';

import {
  group,
  hasGap,
  haystackOf,
  twinsOf,
  type StringEntry,
} from '../src/pages/strings-model.ts';

/**
 * Fixtures for `/strings`'s four pure computations, not the real generated table.
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
    namespace: 'ns',
    english: 'Some wording',
    description: null,
    file: 'apps/mobile/src/example.tsx',
    line: 1,
    translations: { en: 'Some wording', de: 'Ein Wortlaut' },
    ...overrides,
  };
}

describe('twinsOf, which ids share an English wording word for word', () => {
  it('lists the other id when two entries share the same English', () => {
    const twins = twinsOf([
      entry({ id: 'a.one', english: 'Same words' }),
      entry({ id: 'b.two', english: 'Same words' }),
    ]);

    expect(twins.get('a.one')).toEqual(['b.two']);
    expect(twins.get('b.two')).toEqual(['a.one']);
  });

  it('lists every other id, not just one, when three entries share the same English', () => {
    const twins = twinsOf([
      entry({ id: 'a.one', english: 'Same words' }),
      entry({ id: 'b.two', english: 'Same words' }),
      entry({ id: 'c.three', english: 'Same words' }),
    ]);

    expect(twins.get('a.one')).toEqual(['b.two', 'c.three']);
    expect(twins.get('b.two')).toEqual(['a.one', 'c.three']);
    expect(twins.get('c.three')).toEqual(['a.one', 'b.two']);
  });

  it('leaves an id out of the map when its English is unique', () => {
    const twins = twinsOf([
      entry({ id: 'a.one', english: 'Same words' }),
      entry({ id: 'b.two', english: 'Same words' }),
      entry({ id: 'c.solo', english: 'Nothing else reads this way' }),
    ]);

    expect(twins.has('c.solo')).toBe(false);
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

  it('does not call two blank entries twins of each other', () => {
    // An absent wording is not a shared wording. The seam test over the app already
    // refuses an id without a `defaultMessage`, so `strings.mjs`'s `?? ''` cannot
    // fire today; this pins the function rather than the pipeline in front of it.
    const twins = twinsOf([
      entry({ id: 'a.blank', english: '' }),
      entry({ id: 'b.blank', english: '' }),
    ]);

    expect(twins.has('a.blank')).toBe(false);
    expect(twins.has('b.blank')).toBe(false);
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

    expect(haystack.get('gate.signIn')).toContain('gate.signin');
  });

  it('matches on a German wording', () => {
    const haystack = haystackOf([
      entry({ id: 'gate.signIn', translations: { en: 'Sign in', de: 'Anmelden' } }),
    ]);

    expect(haystack.get('gate.signIn')).toContain('anmelden');
  });

  it('matches on the English', () => {
    const haystack = haystackOf([entry({ id: 'gate.signIn', english: 'Sign in' })]);

    expect(haystack.get('gate.signIn')).toContain('sign in');
  });

  it('matches on the description', () => {
    const haystack = haystackOf([
      entry({ id: 'gate.signIn', description: 'Read aloud and never drawn.' }),
    ]);

    expect(haystack.get('gate.signIn')).toContain('read aloud and never drawn');
  });

  it('lower-cases everything, so a lower-case query still finds a mixed-case wording', () => {
    const haystack = haystackOf([entry({ id: 'gate.signIn', english: 'Sign In' })]);

    expect(haystack.get('gate.signIn')).not.toContain('Sign In');
    expect(haystack.get('gate.signIn')).toContain('sign in');
  });
});

describe('group, the entries cut into namespace sections', () => {
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
});
