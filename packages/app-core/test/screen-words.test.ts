import { describe, expect, it } from 'vitest';

import { parseHomeLayout, type HomeLayoutParse } from '../src/lib/home-layout';
import {
  CONFIGURABLE_SCREENS,
  parseScreenDocument,
  SCREEN_ICONS,
  SCREEN_ICON_FALLBACK,
  SCREEN_DOCUMENTS,
  screenIconOf,
  screenTabLabelOf,
  screenTitleOf,
} from '../src/lib/screen-layout';

/**
 * The three words a screen document carries
 * ([ADR 0075](../../../adr/0075-a-document-carries-its-own-words-and-a-screen-says-what-it-is-called.md)
 * §2 and §3): the title it cannot leave out, the tab label that falls back to it, and the
 * icon that is a key out of a set the app declares.
 *
 * **The asymmetry is the whole record.** A missing or unreadable title costs the screen its
 * name and with it the whole `words`, because a screen with no name is a bar with no word
 * on it. Everything else — a `tabLabel` that is not a word, an icon this build does not
 * know — costs itself alone and is reported beside a screen that still draws (§4, and
 * ADR 0039 §6's smallest possible loss). So a document here is judged twice over: once
 * through `parseScreenDocument`, which is what a publish asks, and once through
 * `parseHomeLayout`, which is what a phone asks and which keeps the arrangement either way.
 *
 * The ratchet at the end is the other half: the icon set is declared in the app and carried
 * here by the generator, so the core can only report a key it does not have if every key it
 * has is a real icon on all three platforms.
 */

const HOME_SECTION = [{ id: 'hero', module: 'article-hero' }];

/** A document as the five bundled ones are written, with the words a test varies. */
const document = (words: Record<string, unknown>, rest: Record<string, unknown> = {}) => ({
  version: 4,
  ...words,
  sections: HOME_SECTION,
  ...rest,
});

const codes = (parse: { problems: readonly { code: string }[] }): string[] =>
  parse.problems.map((problem) => problem.code);

const NAMED = { title: { de: 'Mitmachen' } };

describe('the title, which a screen document may not leave out', () => {
  it('reads the words of a document that names all three', () => {
    const { words, problems } = parseScreenDocument(
      document({ ...NAMED, tabLabel: { de: 'Mach mit' }, icon: 'people' }),
    );
    expect(problems).toEqual([]);
    expect(words).toEqual({
      title: { de: 'Mitmachen' },
      tabLabel: { de: 'Mach mit' },
      icon: 'people',
    });
  });

  /** ADR 0075 §2: German is required, and it may not be blank. */
  it.each([
    ['it is missing', {}, 'title-invalid'],
    ['it is a string where a word belongs', { title: 'Mitmachen' }, 'title-invalid'],
    ['its German is missing', { title: { en: 'Take part' } }, 'title-german-missing'],
    ['its German is blank', { title: { de: '   ' } }, 'title-german-missing'],
    [
      'it names a language this build does not know',
      { title: { de: 'X', fr: 'Y' } },
      'title-language-unknown',
    ],
    ['it is longer than a heading line', { title: { de: 'a'.repeat(81) } }, 'title-too-long'],
    ['it carries a control character', { title: { de: 'a\u0007b' } }, 'title-control-character'],
    ['it is two lines', { title: { de: 'a\nb' } }, 'title-line-break'],
  ])('refuses a document whose title %s', (_what, words, code) => {
    const parse = parseScreenDocument(document(words));
    expect(codes(parse)).toEqual([code]);
    // The one fault that costs the screen its name, so there is nothing left to draw it by.
    expect(parse.words).toBeNull();
  });

  /**
   * The bound is the core's, per ADR 0075 §1's "declared with the setting" — a title is a
   * line and a tab label is a word, which is why the two differ and why neither is the
   * document's own size. Both edges are held here so a change to either number is a
   * decision somebody sees rather than a number that drifts.
   */
  it('bounds a title at a line and a tab label at a word', () => {
    expect(codes(parseScreenDocument(document({ title: { de: 'a'.repeat(80) } })))).toEqual([]);
    expect(
      codes(parseScreenDocument(document({ ...NAMED, tabLabel: { de: 'a'.repeat(24) } }))),
    ).toEqual([]);
    expect(
      codes(parseScreenDocument(document({ ...NAMED, tabLabel: { de: 'a'.repeat(25) } }))),
    ).toEqual(['tab-label-too-long']);
  });

  /**
   * `parseScreenDocument` is the strict half. `parseHomeLayout` is what a phone asks, and
   * ADR 0036 §7 wants a document it can make sense of drawn — so it keeps the places and
   * reports the missing title beside them. The two readings cannot disagree, because the
   * lenient one reads the same function (pitfall 8, and the reason the checks parse twice).
   */
  it('costs a phone the words and nothing else', () => {
    const parse = parseHomeLayout(document({}));
    expect(parse.layout).not.toBeNull();
    expect(parse.layout?.sections).toHaveLength(1);
    expect(parse.layout?.words).toBeNull();
    expect(codes(parse)).toEqual(['title-invalid']);
  });

  it('keeps a document whose title it could read whatever else it could not', () => {
    const parse = parseHomeLayout(document({ ...NAMED, icon: 'kompass' }));
    expect(parse.layout?.words).toEqual({ title: { de: 'Mitmachen' } });
    expect(codes(parse)).toEqual(['icon-unknown']);
  });
});

describe('the tab label, which falls back to the title', () => {
  /** ADR 0075 §3: "defaults so that nobody types the word twice". */
  it('answers the title when the document names no label of its own', () => {
    const { words } = parseScreenDocument(document(NAMED));
    expect(words?.tabLabel).toBeUndefined();
    expect(screenTabLabelOf(words)).toEqual({ de: 'Mitmachen' });
    expect(screenTitleOf(words)).toEqual({ de: 'Mitmachen' });
  });

  it('answers the label the document does name', () => {
    const { words } = parseScreenDocument(
      document({ title: { de: 'Mitmachen' }, tabLabel: { de: 'Mach mit' } }),
    );
    expect(screenTabLabelOf(words)).toEqual({ de: 'Mach mit' });
    expect(screenTitleOf(words)).toEqual({ de: 'Mitmachen' });
  });

  /** §1's rules are the setting's, so a label is refused the way a title is. */
  it('refuses a label it cannot read, and keeps the title it could', () => {
    const parse = parseScreenDocument(document({ ...NAMED, tabLabel: { en: 'Join in' } }));
    expect(codes(parse)).toEqual(['tab-label-german-missing']);
    expect(parse.words).toEqual({ title: { de: 'Mitmachen' } });
    expect(screenTabLabelOf(parse.words)).toEqual({ de: 'Mitmachen' });
  });

  it('answers nothing for a document whose title was refused', () => {
    const { words } = parseScreenDocument(document({}));
    expect(words).toBeNull();
    expect(screenTitleOf(words)).toBeNull();
    expect(screenTabLabelOf(words)).toBeNull();
    expect(screenIconOf(words)).toEqual(SCREEN_ICONS[SCREEN_ICON_FALLBACK]);
  });
});

describe('the icon, which is a key out of the set the app declares', () => {
  /** ADR 0075 §4: the smallest possible loss, not a refusal of the document. */
  it('takes an unknown key for what it costs: the key, and a report', () => {
    const parse = parseScreenDocument(document({ ...NAMED, icon: 'compazz' }));
    expect(codes(parse)).toEqual(['icon-unknown']);
    expect(parse.problems[0]?.context).toEqual({ icon: 'compazz' });
    // The screen still draws, with the fallback.
    expect(parse.words).toEqual({ title: { de: 'Mitmachen' } });
    expect(screenIconOf(parse.words)).toEqual(SCREEN_ICONS[SCREEN_ICON_FALLBACK]);
  });

  /**
   * `constructor` and `__proto__` are the two keys a lookup finds without the table holding
   * them. A document naming one must be told it does not exist rather than handed an icon
   * out of `Object.prototype`, which is what `Object.hasOwn` is here for.
   */
  it('does not take a key out of the prototype for one of its own', () => {
    for (const icon of ['constructor', '__proto__', 'toString']) {
      const parse = parseScreenDocument(document({ ...NAMED, icon }));
      expect(codes(parse)).toEqual(['icon-unknown']);
      expect(screenIconOf(parse.words)).toEqual(SCREEN_ICONS[SCREEN_ICON_FALLBACK]);
    }
  });

  /** The report names the key — that is what a newsroom needs — unless the key is the payload. */
  it('names an unknown key, and does not print one that carries a control character', () => {
    expect(
      parseScreenDocument(document({ ...NAMED, icon: 'haus\n' })).problems[0]?.context,
    ).toEqual({ icon: null });
    expect(parseScreenDocument(document({ ...NAMED, icon: 'haus' })).problems[0]?.context).toEqual({
      icon: 'haus',
    });
  });

  it.each([
    ['it is a number', 7, 'icon-invalid'],
    ['it is an array', ['home'], 'icon-invalid'],
    ['it is an object', { name: 'home' }, 'icon-invalid'],
  ])('refuses a document whose icon %s', (_what, icon, code) => {
    const parse = parseScreenDocument(document({ ...NAMED, icon }));
    expect(codes(parse)).toEqual([code]);
    expect(parse.words).toEqual({ title: { de: 'Mitmachen' } });
  });

  it('answers the icon the document names, and the fallback when it names none', () => {
    expect(screenIconOf({ title: { de: 'X' }, icon: 'compass' })).toEqual(SCREEN_ICONS.compass);
    expect(screenIconOf({ title: { de: 'X' } })).toEqual(SCREEN_ICONS[SCREEN_ICON_FALLBACK]);
  });
});

describe('a word as the core hands it on', () => {
  /**
   * §2 lets every language after German go missing, and §1 refuses a language this build
   * does not know — so the order the core holds them in is its own, and a document written
   * with the keys the other way round must come out the same. Otherwise the workbench's
   * printer would write back what it was given and a diff would be a shuffle.
   */
  it('hands German first and every other language this build knows after it', () => {
    const { words } = parseScreenDocument(
      document({ title: { en: 'Take part', de: 'Mitmachen' } }),
    );
    expect(Object.keys(words!.title)).toEqual(['de', 'en']);
  });

  it('drops a language that was never written rather than holding an empty one', () => {
    const { words } = parseScreenDocument(document(NAMED));
    expect(Object.keys(words!.title)).toEqual(['de']);
  });
});

describe('the five documents that ship with the app', () => {
  /**
   * ADR 0075 §5: the bar's floor is the bundled document, so a test holds every one of them
   * to parse. Before this step it proved that a committed document draws; now it also
   * proves that the app can name its own tabs, which is what ADR 0075 calls out as the
   * price of a name living in a document.
   */
  it.each(CONFIGURABLE_SCREENS)('%s names itself, and parses with nothing left over', (screen) => {
    const source = SCREEN_DOCUMENTS[screen];
    expect(codes(parseScreenDocument(source))).toEqual([]);

    const parse: HomeLayoutParse = parseHomeLayout(source, undefined, screen);
    expect(parse.problems).toEqual([]);
    expect(parse.layout?.words).not.toBeNull();
  });

  /** ADR 0075 §5's other half: the words come from the same copy as the entries. */
  it.each(CONFIGURABLE_SCREENS)('%s has an icon this build can draw', (screen) => {
    const words = parseScreenDocument(SCREEN_DOCUMENTS[screen]).words;
    expect(words?.icon).toBeDefined();
    expect(SCREEN_ICONS[words!.icon!]).toBeDefined();
    expect(screenIconOf(words)).not.toEqual(SCREEN_ICONS[SCREEN_ICON_FALLBACK]);
  });

  /**
   * Today every tab is named by its screen's title, so every bundled document leaves the
   * label out on purpose (ADR 0075 §3: nobody types the word twice). ADR 0075's open
   * question 4 is whether the field is ever used; this holds the five at "not yet", so the
   * day one of them does differ, the assertion says which one.
   */
  it.each(CONFIGURABLE_SCREENS)("%s's tab is named by its title", (screen) => {
    const words = parseScreenDocument(SCREEN_DOCUMENTS[screen]).words;
    expect(words?.tabLabel).toBeUndefined();
    expect(screenTabLabelOf(words)).toBe(words?.title);
  });

  it('names five screens with five different words, each in its own language value', () => {
    const titles = CONFIGURABLE_SCREENS.map(
      (screen) => parseScreenDocument(SCREEN_DOCUMENTS[screen]).words?.title.de,
    );
    expect(titles.every((title) => typeof title === 'string' && title.length > 0)).toBe(true);
    expect(new Set(titles).size).toBe(CONFIGURABLE_SCREENS.length);
  });
});

describe('the icon set, held to the declaration it was generated from', () => {
  /**
   * ADR 0075 §4's argument in one assertion: a choice has to exist natively on BOTH
   * platforms, and a free string renders on Android, is blank on iOS, and the newsroom
   * finds out from a reader. Every key therefore carries all six names, and none of them is
   * blank — a blank icon renders nowhere at all.
   */
  it('gives every key an icon in all three vocabularies, with both states named', () => {
    for (const [key, icon] of Object.entries(SCREEN_ICONS)) {
      expect({ key, sf: icon.sf, md: icon.md, ionicon: icon.ionicon }).toMatchObject({
        sf: { default: expect.any(String), selected: expect.any(String) },
        md: { default: expect.any(String), selected: expect.any(String) },
        ionicon: { active: expect.any(String), inactive: expect.any(String) },
      });
      for (const name of [
        icon.sf.default,
        icon.sf.selected,
        icon.md.default,
        icon.md.selected,
        icon.ionicon.active,
        icon.ionicon.inactive,
      ]) {
        expect(name.length).toBeGreaterThan(0);
      }
    }
  });

  /** A fallback that is not in the set is an icon nothing can draw, which is worse than none. */
  it('has a fallback that is one of its own keys', () => {
    expect(SCREEN_ICONS[SCREEN_ICON_FALLBACK]).toBeDefined();
  });

  it('is not empty, because a screen with no icon to choose from is a picker with nothing', () => {
    expect(Object.keys(SCREEN_ICONS).length).toBeGreaterThan(CONFIGURABLE_SCREENS.length);
  });
});
