import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { withoutComments } from '@correctiv/prose-and-code';

import { adrFiles, collectDocs, ROOT } from '../plugin/collect.ts';
import { CAVEAT_MARKERS } from '../plugin/decisions.ts';

const { module } = collectDocs();
const RECORDS = module.decisions;
const BY_NUMBER = new Map(RECORDS.map((record) => [record.number, record]));
const source = (number: string) =>
  readFileSync(
    join(ROOT, adrFiles().find((file) => file.includes(`/${number}-`)) as string),
    'utf8',
  );

/**
 * What the decisions board is allowed to say about the records.
 *
 * Every assertion here has a way of failing that leaves the page rendering: a
 * board with thirty-three rows, no dates and every record standing looks exactly
 * like a working one, which is why `buildDecisions` throws as well. These are the
 * things a throw cannot see — a figure that is present and wrong.
 */
describe('the decision records the board is built from', () => {
  it('reads one record per file in `adr/`, in number order', () => {
    // Counted from the directory rather than typed. A record is added by writing
    // one, and a test that had to be edited alongside would just be edited
    // alongside, which is how an assertion stops being one.
    expect(RECORDS.length).toBe(adrFiles().length);
    const numbers = RECORDS.map((record) => record.number);
    expect(numbers).toEqual(numbers.toSorted());
  });

  it('gives every record a date, a status, a title and a sentence from the index', () => {
    const empty = RECORDS.filter(
      (record) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(record.date) ||
        record.status === '' ||
        record.title === '' ||
        record.note === '',
    );
    expect(empty.map((r) => `${r.number}: ${r.date} / ${r.status} / ${r.note}`)).toEqual([]);
  });

  it('strips the record number out of the title, which has its own column', () => {
    expect(RECORDS.filter((record) => record.title.startsWith('ADR')).map((r) => r.number)).toEqual(
      [],
    );
    expect(BY_NUMBER.get('0022')?.title).toBe(
      'Three tiers of colour, and a dark scheme that names roles',
    );
  });

  /**
   * The count has to come from the files, not from a number typed here.
   *
   * This is the assertion that would catch the board over- or under-counting: a
   * collector that walks a list and its items both reports a strike twice, and a
   * hard-coded expectation would simply have been written as the wrong number.
   */
  it('counts exactly the strikes that are in the records', () => {
    const marks = adrFiles().reduce(
      (total, file) => total + (readFileSync(join(ROOT, file), 'utf8').match(/~~/g)?.length ?? 0),
      0,
    );
    const struck = RECORDS.reduce((total, record) => total + record.struck.length, 0);
    expect(marks % 2).toBe(0);
    expect(struck).toBe(marks / 2);
    expect(struck).toBeGreaterThan(20);
  });

  it('derives the standing from the strikes rather than from a status word', () => {
    const wrong = RECORDS.filter(
      (record) =>
        (record.standing === 'stands') !== (record.struck.length === 0) &&
        record.standing !== 'withdrawn',
    );
    expect(wrong.map((r) => `${r.number}: ${r.standing} with ${r.struck.length} struck`)).toEqual(
      [],
    );
    // All three states are reachable, so a bug that collapsed two of them shows.
    expect(new Set(RECORDS.map((r) => r.standing))).toEqual(
      new Set(['stands', 'partly-struck', 'withdrawn']),
    );
  });

  it('withdraws only a record whose own status line is struck through', () => {
    const withdrawn = RECORDS.filter((record) => record.standing === 'withdrawn');
    expect(withdrawn.map((r) => r.number)).toEqual(['0002']);
    for (const record of withdrawn) {
      const status = source(record.number)
        .split(/\n{2,}/)
        .find((block) => /^\*{0,2}Status:/.test(block.trim())) as string;
      expect(status).toContain('~~');
    }
  });
});

/**
 * Every link to a record, from anywhere in the repository, and not only from the
 * documents this site publishes.
 *
 * `test/docs.test.ts` already holds the published ones: it renders each document and
 * checks that the repository path behind every link exists. What it cannot see is a
 * link in a file the site does not publish — a package `README.md`, a doc comment in
 * `packages/app-core`, a JSDoc block in `src/preview/` — and those carry a dozen of
 * them.
 *
 * The failure is a rename pass. A record's file name is prose, so a search-and-replace
 * over the repository rewrites it as happily as it rewrites anything else, and the
 * link dies with nothing red: the record is still there, only nothing points at it any
 * more. This is not hypothetical. The pass that made `apps/handbook` into
 * `apps/workbench` ([ADR 0037](../../../adr/0037-the-whole-site-is-the-workbench.md))
 * rewrote four such links to `0024-the-workbench-owns-the-root.md` and
 * `0027-the-workbench-draws-the-apps-components.md`, neither of which is a file,
 * and every check in the repository stayed green.
 *
 * Link targets only. A record's file name quoted as an *example* in prose or in a
 * comment is not a link and is not asked to resolve; `plugin/registry.ts` has one.
 */
describe('links to the records, from everywhere', () => {
  const LINK = /]\(([^)]*\/)?(\d{4}-[a-z0-9-]+\.md)[^)]*\)/g;

  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter((file) => /\.(md|ts|tsx|mjs|js|json|css|yml)$/.test(file));

  it('reads enough of the repository to be worth running', () => {
    // A filter that stopped matching, or a `git` that answered nothing, would make
    // every assertion below vacuously true.
    expect(tracked.length).toBeGreaterThan(200);
  });

  it('points every one of them at a record that exists', () => {
    const names = new Set(adrFiles().map((file) => file.split('/').pop()));
    const dangling: string[] = [];

    for (const file of tracked) {
      const text = readFileSync(join(ROOT, file), 'utf8');
      for (const hit of text.matchAll(LINK)) {
        // Only links that mean a record: `adr/` in the path, or the file itself in
        // `adr/`. A `0022-…md` elsewhere would be some other directory's document.
        const inAdr = (hit[1] ?? '').includes('adr/') || file.startsWith('adr/');
        if (inAdr && !names.has(hit[2])) dangling.push(`${file} -> ${hit[2]}`);
      }
    }

    expect(dangling).toEqual([]);
  });
});

describe('the retirement graph', () => {
  it('names only records that exist', () => {
    const unknown = RECORDS.flatMap((record) => [...record.voidedBy, ...record.voids]).filter(
      (number) => !BY_NUMBER.has(number),
    );
    expect(unknown).toEqual([]);
  });

  it('finds edges at all', () => {
    // Guards against the citation regex quietly matching nothing, which would
    // leave every record reading "struck by no later record" and look deliberate.
    const edges = RECORDS.reduce((total, record) => total + record.voidedBy.length, 0);
    expect(edges).toBeGreaterThan(10);
  });

  /**
   * A record can only be made false by a later one.
   *
   * ADR 0026 strikes its own "Nothing in another ADR." with the clause "Two cells
   * in ADR 0006's ports table, struck there when section 4 was carried out". The
   * clause names 0006 because that is where 0026 did the striking, and reading the
   * citation as an edge puts the arrow the wrong way round — the board would tell
   * a reader that a 2026-08-06 record retired a claim in a 2026-09-10 one.
   */
  it('reads a citation of an earlier record as a reference, not as an edge', () => {
    const backwards = RECORDS.flatMap((record) =>
      record.voidedBy.filter((by) => by <= record.number).map((by) => `${by} -> ${record.number}`),
    );
    expect(backwards).toEqual([]);

    expect(BY_NUMBER.get('0026')?.voidedBy).not.toContain('0006');
    // And the real edge between those two, which runs the other way.
    expect(BY_NUMBER.get('0026')?.voids).toContain('0006');
    expect(BY_NUMBER.get('0006')?.voidedBy).toContain('0026');
  });

  it('reads the same edge from both ends', () => {
    const wrong: string[] = [];
    for (const record of RECORDS) {
      for (const by of record.voidedBy) {
        if (!BY_NUMBER.get(by)?.voids.includes(record.number)) {
          wrong.push(`${by} voided a claim in ${record.number} and does not say so`);
        }
      }
      for (const number of record.voids) {
        if (!BY_NUMBER.get(number)?.voidedBy.includes(record.number)) {
          wrong.push(`${record.number} claims a strike in ${number}, which does not carry it`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('what the index says is not built', () => {
  it('takes the caveat from the index row it stands in', () => {
    const outside = RECORDS.flatMap((record) =>
      record.caveats
        .filter((caveat) => !record.note.includes(caveat))
        .map((caveat) => `${record.number}: ${caveat}`),
    );
    expect(outside).toEqual([]);
  });

  it('finds one wherever the index note says something is unbuilt or unchecked', () => {
    const missed = RECORDS.filter(
      (record) => CAVEAT_MARKERS.test(record.note) !== record.caveats.length > 0,
    );
    expect(missed.map((r) => `${r.number}: ${r.note}`)).toEqual([]);
    expect(RECORDS.filter((r) => r.caveats.length > 0).length).toBeGreaterThan(2);
  });

  /**
   * Every record that says it, not only the one that shouts it.
   *
   * The first version of this took the index's **bold** spans, on the argument
   * that bolding is a deliberate act. It reads the set wrongly: ADR 0030 bolds
   * "iOS unrun" and ADR 0013 writes the same words plain, and a board that flagged
   * one and not the other would be inventing a distinction the index never made.
   */
  it('flags the records whose iOS half is unrun', () => {
    const unrun = RECORDS.filter((record) => record.caveats.some((c) => c.includes('unrun')));
    expect(unrun.map((r) => r.number)).toEqual(['0013', '0030', '0033']);
  });
});

describe('the board page', () => {
  const page = readFileSync(join(ROOT, 'apps/workbench/src/pages/Decisions.tsx'), 'utf8');

  /**
   * Nothing about a particular record is typed into the page.
   *
   * The failure this prevents is the one the sources board's own comments are
   * about: a figure typed on a page, a figure derived from the sources, and the
   * page being the confident one. A record number in this file would be the first
   * step of it.
   *
   * **The comments go first, so prose may cite a record and code may not.** Both
   * forms, because a page written in JSX has both: a block around markup and a `//`
   * beside a line. An early version read line by line and looked for a leading `*`,
   * which passes a JSDoc block and fails the second line of a JSX comment, so it
   * reported a record cited inside an explanation of why a key is what it is.
   *
   * The stripper is `@correctiv/prose-and-code`'s. It was a fourth hand-written
   * copy in this file and the weakest of the four: it opened a block on a
   * slash-star anywhere, which is the failure #202 measured, and it took a `//`
   * after a colon, so it ate every URL in the page from the scheme onwards.
   * A record number typed into a link was therefore invisible to the assertion
   * below — measured, with a `https://correctiv.org/adr/0034` added to
   * `Decisions.tsx`, which left this suite green. The package's rule leaves
   * `https://` alone and the same line fails.
   */
  it('names no record of its own', () => {
    const cited = [...withoutComments(page).matchAll(/(?<![\w-])0\d{3}(?![\w-])/g)].map(
      (hit) => hit[0],
    );
    expect(cited).toEqual([]);
  });

  it('reads its records from the virtual module and nowhere else', () => {
    expect(page).toContain("import docsModule from 'virtual:docs'");
    expect(page).toContain('docsModule.decisions');
  });
});
