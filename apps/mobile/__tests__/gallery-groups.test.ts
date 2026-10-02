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
    // The heading is the app's word, asked through the hook that reads the app's table —
    // the same six words the newsroom's palette reads, which is the whole of the move.
    expect(groups + readFileSync(join(APP, 'src/gallery/Gallery.tsx'), 'utf8')).toMatch(
      /useCategoryLabel\(/,
    );
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
