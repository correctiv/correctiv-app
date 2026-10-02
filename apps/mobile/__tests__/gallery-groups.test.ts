import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  BLOCK_CATEGORIES,
  allBlocks,
  categoryOf,
  screenBoundTo,
} from '@correctiv/app-core/lib/block-category';

import { floorFaults, withoutComments } from '@correctiv/prose-and-code';
import { BAUSTEINE, galleryGroups } from '../src/gallery/groups';
import { CATEGORY_LABELS, categoryName } from '../src/lib/home/category-labels';

/**
 * The gallery's grouping, and the two things a second grouping would cost.
 *
 * The page used to be sorted by the folder a component's file is in, which answers "where
 * does this live" — a question about the source tree — while everybody who opens it asks
 * "what kind of thing is this". A block's category ([ADR
 * 0073](../../../../../adr/0073-every-screen-takes-every-block-and-a-block-declares-its-category.md)
 * §2) answers that, and the newsroom's palette groups by it, so the gallery does too: one
 * section per family in the core's order, then one section for everything that is no
 * block's own drawing.
 *
 * **The catalogue is read as TEXT and not imported**, for the reason `gallery-catalogue.test.ts`
 * gives at length: importing it pulls in every component in the app and the JSX transform
 * for all of them to answer a question about a list of ids. `galleryGroups` itself is the
 * real one, imported and called — what it is called with is what the catalogue says, so this
 * is the page's own answer rather than a re-derivation of it.
 */
const APP = resolve(__dirname, '..');
const CATALOGUE = join(APP, 'src/gallery/catalogue.tsx');
const GROUPS = join(APP, 'src/gallery/groups.ts');

/** `folder/Name` → the block it draws, `undefined` where it is no block's own drawing. */
function blocksByComponent(source: string): Map<string, string | undefined> {
  const entries = new Map<string, string | undefined>();
  let folder = '';
  let current: string | undefined;
  for (const [, key, value] of withoutComments(source).matchAll(
    /\b(folder|name|block): '([^']+)'/g,
  )) {
    if (key === 'folder') {
      folder = value;
      current = undefined;
    } else if (key === 'name') {
      current = `${folder}/${value}`;
      entries.set(current, undefined);
    } else if (current !== undefined) {
      entries.set(current, value);
    }
  }
  return entries;
}

/** The same catalogue as the list `galleryGroups` is handed. */
function asFolders(entries: Map<string, string | undefined>) {
  const folders = new Map<string, { name: string; block?: string }[]>();
  for (const [id, block] of entries) {
    const [folder, name] = id.split('/') as [string, string];
    const list = folders.get(folder) ?? [];
    list.push(block === undefined ? { name } : { name, block });
    folders.set(folder, list);
  }
  return [...folders].map(([folder, entries]) => ({ folder, entries }));
}

describe('the catalogue, as written', () => {
  const source = readFileSync(CATALOGUE, 'utf8');
  const entries = blocksByComponent(source);

  it('reads the catalogue it is checking (guards against a silently empty parse)', () => {
    // A rename of `folder:`, `name:` or `block:` empties one of these lists rather than
    // breaking the test, and an empty list satisfies every assertion below it.
    expect(
      floorFaults({
        'entries read out of the catalogue': { found: entries.size, atLeast: 40 },
        'of them a block’s own drawing': {
          found: [...entries.values()].filter(Boolean).length,
          atLeast: 15,
        },
      }),
    ).toEqual([]);
  });

  /**
   * **Every block an entry names is a block this app can draw**, which is the roll-call in
   * the direction a type cannot see. `Entry['block']` is a `string`, because the core's
   * `MODULE_CATEGORIES` is a `Record<string, BlockCategory>` and `keyof` that is `string`;
   * an entry naming a block that does not exist compiles, and then has no family at all —
   * which on the page is invisible, because such an entry quietly falls into the bottom
   * section with the components that are no block's own drawing.
   */
  it('names a block for every entry that declares one, and only blocks that exist', () => {
    const unknown = [...entries]
      .filter(([, block]) => block !== undefined && categoryOf(block) === undefined)
      .map(([id, block]) => `${id}: ${block}`);

    expect(unknown.sort()).toEqual([]);
  });

  it('files each entry under the family its block declares, and under no other', () => {
    // A gallery that put the video row under "Mitmachen" would be a second answer to the
    // category, and the person comparing it with the palette's tabs would be the only one
    // who could tell.
    const filed = [...entries]
      .map(([, block]) => (block === undefined ? undefined : categoryOf(block)))
      .filter((category) => category !== undefined);

    expect(filed.length).toBeGreaterThan(15);
    expect([...new Set(filed)].sort()).toEqual(
      BLOCK_CATEGORIES.filter((c) => filed.includes(c)).sort(),
    );
    // And the audio family is a family with several blocks in it, rather than one row that
    // happens to be there.
    expect(filed.filter((category) => category === 'medien').length).toBeGreaterThan(3);
  });

  it('draws no block twice', () => {
    // Two entries may draw the same block — `media/MediaCard` and `media/EpisodeRow` are
    // rows inside blocks rather than the block's own drawing — but a block with two entries
    // of its own is drawn twice, which the component walk refuses for addresses and cannot
    // see for blocks.
    const drawn = [...entries.values()].filter(Boolean);
    expect(drawn.filter((block, i) => drawn.indexOf(block) !== i).sort()).toEqual([]);
  });

  it('leaves most of the page out of the families, which is what the last section is for', () => {
    // The bottom section exists because most of `src/components` is what a block is made OF
    // rather than what a block IS: a button, a card, the rail's tile, the reader's document,
    // the door. Filing those under a family would mean a category no block declares.
    const bausteine = [...entries.values()].filter((block) => block === undefined).length;
    expect(bausteine).toBeGreaterThan([...entries.values()].filter(Boolean).length);
  });
});

describe('the sections the page draws', () => {
  const sections = galleryGroups(asFolders(blocksByComponent(readFileSync(CATALOGUE, 'utf8'))));
  const entries = [...blocksByComponent(readFileSync(CATALOGUE, 'utf8')).values()];

  it('are the core’s families in the core’s order, then one for what is no block’s drawing', () => {
    expect(sections.map((section) => section.key)).toEqual([
      ...BLOCK_CATEGORIES.filter((category) =>
        entries.some((block) => block !== undefined && categoryOf(block) === category),
      ),
      BAUSTEINE,
    ]);
  });

  it('hold every entry exactly once, and nothing empty', () => {
    const drawn = sections.flatMap((section) => section.entries.map((entry) => entry.name));
    expect(drawn.length).toBe(entries.length);
    expect(drawn.length).toBe(new Set(drawn).size);
    // A section with nothing in it is a heading with nothing under it, which is the case
    // `blocksByCategory` refuses for a screen and this page refuses for the same reason.
    expect(sections.every((section) => section.entries.length > 0)).toBe(true);
  });

  it('put the entries that name no block in the bottom section, and only those', () => {
    const last = sections[sections.length - 1]!;
    expect(last.key).toBe(BAUSTEINE);
    expect(last.category).toBeUndefined();
    expect(last.entries.every((entry) => entry.block === undefined)).toBe(true);
    // And a family section holds nothing else: an entry with no block that found its way
    // into one would be a component filed under a category no block declares.
    for (const section of sections.slice(0, -1)) {
      expect(section.entries.every((entry) => entry.block !== undefined)).toBe(true);
      expect(section.entries.every((entry) => categoryOf(entry.block!) === section.category)).toBe(
        true,
      );
    }
  });

  /**
   * **The count beside each heading is the number of entries under it**, which is the one
   * number a design review asked for: a heading with nothing beside it says nothing about how
   * far down the page it goes, which is what made the sections hard to navigate.
   *
   * Counted here from the catalogue rather than read back off the sections, because reading
   * `section.entries.length` back off the sections asserts that the array is as long as the
   * array says it is. The comparison is per key, so a section that counted a neighbour's
   * entries fails rather than passing on the total.
   */
  it('count what is under each heading, and no heading counts nothing', () => {
    const counted = new Map<string, number>();
    for (const [, block] of blocksByComponent(readFileSync(CATALOGUE, 'utf8'))) {
      const key = block === undefined ? BAUSTEINE : categoryOf(block)!;
      counted.set(key, (counted.get(key) ?? 0) + 1);
    }
    // By key rather than in order: the sections are the core's order, which the test above
    // already holds, and the order they are counted in here is the catalogue's. What this is
    // about is the number under each heading.
    const drawn = new Map(sections.map((section) => [section.key, section.entries.length]));
    expect([...drawn.entries()].sort()).toEqual([...counted.entries()].sort());
    // And a section that counts nothing is one `galleryGroups` refuses to draw at all, so a
    // heading reading „0 components" would be a state the page cannot be in.
    expect(sections.every((section) => section.entries.length > 0)).toBe(true);
  });

  it('survives being asked about one component alone', () => {
    // The `?c=` address draws a single entry, and a filter that returned an empty section
    // for it would leave the page with a heading and nothing under it.
    const one = asFolders(blocksByComponent(readFileSync(CATALOGUE, 'utf8'))).map((folder) => ({
      ...folder,
      entries: folder.entries.slice(0, 1),
    }));
    for (const folder of one) {
      for (const entry of folder.entries) {
        const sections = galleryGroups([{ folder: folder.folder, entries: [entry] }]);
        expect(sections.flatMap((section) => section.entries)).toEqual([entry]);
        expect(sections).toHaveLength(1);
      }
    }
  });
});

describe('there is one list of families and one table of words', () => {
  /**
   * The ratchet for a move that touched three hosts.
   *
   * A category list and its German can each be written twice without anything failing: the
   * second copy draws, translates and reads well, and the two part the day a family is added.
   * **The half that can be checked from here is the app's**, since the app may not read the
   * workbench at all ([ADR 0040](../../../../../adr/0040-the-app-does-not-depend-on-the-workbench.md))
   * and a check that reached into it would be the dependency it forbids. The other half —
   * that this site reads the app's table rather than keeping its own — is
   * `apps/workbench/test/preview/palette.test.ts`, which may read both trees.
   */
  const APP_SRC = resolve(APP, 'src');

  const filesUnder = (root: string, ...suffixes: string[]): string[] => {
    const out: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (suffixes.some((suffix) => full.endsWith(suffix))) out.push(full);
      }
    };
    walk(root);
    return out;
  };

  it('declares the six ids once, in the app', () => {
    // Both spellings a declaration can take: `id: 'home.category.…'` as `defineMessages`
    // writes it here, and `'home.category.…': { id: … }` as the workbench wrote its own
    // table until this page needed the words too.
    const DECLARING = /(id: 'home\.category\.[a-z]+'|'home\.category\.[a-z]+': \{\s*\n\s*id:)/;
    const declaring = filesUnder(APP_SRC, '.ts').filter((file) =>
      DECLARING.test(readFileSync(file, 'utf8')),
    );
    expect(declaring).toEqual([resolve(APP, 'src/lib/home/category-labels.ts')]);
  });

  it('writes no family out by hand', () => {
    // Six names inside ONE array literal: the shape a second list takes. The core's own
    // declaration (`lib/home/blocks.ts`) is keyed by block and spread over a screen's worth
    // of lines, so the bracket is what tells the two apart.
    const sixNames = /\[[^\]]{0,900}'struktur'[^\]]{0,900}'recherche'[^\]]{0,900}'faktencheck'/;
    const handwritten = filesUnder(APP_SRC, '.ts', '.tsx').filter((file) =>
      sixNames.test(readFileSync(file, 'utf8')),
    );
    expect(handwritten).toEqual([]);
    expect(readFileSync(GROUPS, 'utf8')).not.toMatch(/'struktur'/);
  });

  it('reads each entry’s family out of the core, and its name out of the app’s table', () => {
    const groups = readFileSync(GROUPS, 'utf8');
    expect(groups).toMatch(/categoryOf\(entry\.block\)/);
    expect(groups).toMatch(/BLOCK_CATEGORIES\.map/);
    // The heading is the app's word, asked out of the app's table — the same six words the
    // newsroom's palette reads, which is the whole of the move.
    const gallery = readFileSync(join(APP, 'src/gallery/Gallery.tsx'), 'utf8');
    expect(groups + gallery).toMatch(
      /categoryName\(category\)|from '@\/lib\/home\/category-labels'/,
    );
  });

  /**
   * **One language on this page, and it is English.**
   *
   * A design review found the gallery's headings German while every word around them was
   * English — the heading of a section, then English again for the component under it — and
   * read the page as one that had never been given a language. [ADR
   * 0052](../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1 draws the
   * seam between what a page writes and what it quotes, and this page writes English: it is
   * excluded from `localisation-seam.test.ts` and `rendered-literals.test.ts` as
   * `DEVELOPER_ONLY`, and its furniture has always been English.
   *
   * **Asserted on the words themselves rather than on the call**, because the call is easy:
   * any of `useCategoryLabel`, `categoryName` or a hand-written `faktencheck` satisfies a
   * test that only looks for a call, and the last two of those are what this exists to keep
   * out. So this takes the six names the page would draw, in English, and asks that none of
   * them is the id and none of them carries a German character — and that the section with
   * no family is called in English too.
   *
   * The specimens' German is not in scope and cannot be: they are the app's real components
   * carrying the copy they really carry, which is content here the way `/handbook`'s English
   * documents are content on a German page.
   */
  it('names every section in the language the page is written in', () => {
    const words = BLOCK_CATEGORIES.map((category) => [category, categoryName(category)] as const);
    // Read out of the table rather than off the core's list, so a family the core knows and
    // this page cannot name fails here as „no name" rather than being skipped by the map.
    expect(Object.keys(CATEGORY_LABELS).sort()).toEqual([...BLOCK_CATEGORIES].sort());
    // Jest's `expect` takes no message argument, so the failures carry the family in the
    // values they compare: an empty word and the id are different strings, and an umlaut is
    // visible in the diff.
    for (const [category, word] of words) {
      expect([category, word]).not.toEqual([category, '']);
      // Printed as its id, which is what a lazy label would be: `faktencheck` over a family
      // of fact checks reads as a key to whoever has to place one.
      expect([category, word]).not.toEqual([category, category]);
      // And not the German the catalogue ships. The page is English, and a heading that
      // drifted back to German would be indistinguishable from a bug to whoever reads it —
      // which is exactly what it would be, and what this holds against.
      expect([category, word.replace(/[äöüß]/gi, '')]).toEqual([category, word]);
    }
    // The section with no family, which is called in words rather than by an id. It was
    // `Bausteine`, a German heading on an English page and the sharpest case of the mixture.
    expect(BAUSTEINE).toBe('Building blocks');
    expect(BAUSTEINE.replace(/[äöüß]/gi, '')).toBe(BAUSTEINE);
  });

  /** The two halves of the one table, imported rather than read as text. */
  it('reads the words from the one table and holds neither half of it here', () => {
    const labels = readFileSync(join(APP, 'src/lib/home/category-labels.ts'), 'utf8');
    // `categoryName` is the page's half: it asks the descriptors for their own English
    // rather than formatting the catalogue, which is what makes this a second reader of one
    // table and not a second table. A `createIntl` or a `useIntl` in `Gallery.tsx` would be
    // the German creeping back in through the front door.
    expect(labels).toMatch(/export function categoryName\(category: BlockCategory\): string/);
    // Over the file with its comments stripped, because the reasoning in this one names both
    // of the functions it does not call — a check that read the prose would be checking the
    // comment, and a `/* *\/` added to the file would be enough to switch it off.
    const gallery = withoutComments(readFileSync(join(APP, 'src/gallery/Gallery.tsx'), 'utf8'));
    expect(gallery).not.toMatch(/useIntl\(|createIntl\(/);
    expect(gallery).not.toMatch(/useCategoryLabel/);
  });
});

describe('the grouping asks nothing about screens', () => {
  it('holds no screen table and no list of screen-bound blocks of its own', () => {
    // The core answers for those, and it answers per screen where a screen is asked about:
    // the gallery has no screen, so it has nothing to exclude and nothing to say.
    const groups = readFileSync(GROUPS, 'utf8');
    expect(groups).not.toMatch(/screenBoundTo|SCREEN_BOUND_BLOCKS|ConfigurableScreen/);
    expect(groups).not.toMatch(/'home-header'|'mediathek-header'/);
    expect(allBlocks().filter((block) => screenBoundTo(block) !== undefined).length).toBe(4);
  });
});
