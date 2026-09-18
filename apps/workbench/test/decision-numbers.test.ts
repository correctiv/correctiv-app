import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  baselineLedger,
  LEDGER_PATH,
  normalise,
  readLedger,
  REVISION_GUIDANCE,
  revisions,
} from '../../../scripts/adr-ledger.mjs';
import { adrFiles, collectDocs, ROOT } from '../plugin/collect';
import { decisionNumber } from '../plugin/markdown';
import { adrNumber } from '../plugin/registry';

/**
 * The numbers inside the records, and the one property that makes them worth
 * writing: that `ADR 0026 §6` still points at the same decision in a year.
 *
 * `adr/decisions.lock.json` is the ledger — every text each number has ever
 * carried, oldest first — and the rule it enforces is append-only: a number is
 * never reused, never moved to another decision, and a decision that is removed
 * leaves its number behind as a gap.
 *
 * **The check worth having is the one that reads `origin/main`**, and it is worth
 * being exact about what it does, because the version of this file before it
 * claimed more than it could do. Two cold reviews broke that version. One swapped
 * two numbers and changed an em dash to a comma in each heading, and the tool
 * recorded two rewordings. One swapped two numbers and swapped their two histories
 * wholesale, and the tool had nothing to add. Both were green everywhere, because
 * every check read the working tree and a renumbering leaves a working tree that
 * is internally perfectly consistent.
 *
 * What the comparison does is refuse every edit that takes something OUT of the
 * published ledger: a record, a number, or any element of a history. The second
 * attack is that, and it is red now. The first is not — it only appends — and
 * saying otherwise would be the same overclaim again. What it gets instead is
 * permanence: after it, §1 and §3 each carry the other's text in their history,
 * in the diff, and no later edit can tidy that away, because tidying it away is
 * the revision this refuses. The ledger does not make a renumbering impossible.
 * It makes one impossible to do quietly.
 *
 * The within-tree checks are kept and are worth keeping: they catch the accident,
 * the half-finished edit and the copy-paste, they run in a checkout that has never
 * fetched, and they say what is wrong in one line. They compare on `normalise`,
 * which is what makes the em-dash-to-comma disguise fail, so the first attack is
 * red too — for the punctuation-sized version of it, and not for a swap whose
 * headings are genuinely rewritten. That one is left standing, and is left
 * standing here in writing rather than in a claim nobody tested.
 *
 * This is ADR 0031's mechanism 4, reading the source, and it is where this has to
 * sit. Mechanism 1 wants a closed set TypeScript can see and the set here is
 * Markdown headings; mechanism 2 wants a generator whose output can be rebuilt
 * from the world, and rebuilding this ledger wholesale is exactly the operation
 * that would accept a renumbering in silence. Being regenerable is the property it
 * must not have.
 */

interface Decision {
  record: string;
  file: string;
  depth: number;
  number: number;
  text: string;
}

const ledgerFile = readFileSync(join(ROOT, LEDGER_PATH), 'utf8');
const { ledger, problems: ledgerProblems } = readLedger(ledgerFile);

/**
 * Every numbered heading in every record, as written.
 *
 * Read from the Markdown rather than from the rendered documents, so a heading at
 * a level the site does not put in its contents list is still seen. `##` and `###`
 * are the two the numbering uses; anything deeper is asserted against below rather
 * than filtered out here, because a numbered `####` is the mistake worth naming.
 *
 * A fenced block is not read. A record that quotes the shape of a decision heading
 * used to mint a number from inside the fence, and the failure message then asked
 * for `npm run adr:lock`, which would have reserved that number for a heading no
 * reader can cite. `scripts/adr.mjs` skips fences too, and the two skipping in
 * step is what the ledger comparison below would otherwise catch as an extra entry.
 */
function decisions(): Decision[] {
  const found: Decision[] = [];
  for (const file of adrFiles()) {
    const record = adrNumber(file) as string;
    let fence: string | null = null;
    for (const line of readFileSync(join(ROOT, file), 'utf8').split('\n')) {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
      if (marker) {
        if (fence === null) fence = marker[1][0];
        else if (marker[1][0] === fence) fence = null;
        continue;
      }
      if (fence !== null) continue;
      const hit = /^(#{1,6})\s+(.*)$/.exec(line);
      if (!hit) continue;
      const number = decisionNumber(hit[2]);
      if (number === null) continue;
      // The heading as written, backticks and all. `adr.mjs` stores the same
      // string, and the two parsers being separate is what makes a disagreement
      // between them a red test rather than a quiet difference.
      found.push({
        record,
        file,
        depth: hit[1].length,
        number,
        text: hit[2].replace(/^\d{1,3}\.\s+/, '').trim(),
      });
    }
  }
  return found;
}

const all = decisions();
const byRecord = new Map<string, Decision[]>();
for (const decision of all) {
  const list = byRecord.get(decision.record) ?? [];
  list.push(decision);
  byRecord.set(decision.record, list);
}

describe('the records', () => {
  it('gives no two records the same number', () => {
    // The check that was missing on 2026-09-16, when two records both claimed
    // 0034. The filenames differed by their slug, so there was no merge conflict
    // and nothing was red; the duplicate was found by somebody happening to look.
    const seen = new Map<string, string[]>();
    for (const file of readdirSync(join(ROOT, 'adr'))) {
      const number = adrNumber(file);
      if (number === null) continue;
      seen.set(number, [...(seen.get(number) ?? []), file]);
    }
    const shared = [...seen]
      .filter(([, files]) => files.length > 1)
      .map(([number, files]) => `${number}: ${files.join(' and ')}`);
    expect(shared).toEqual([]);
  });

  it('says how many there are, and is right about it', () => {
    // A count typed in a document goes wrong quietly: this sentence said
    // twenty-nine while the directory held thirty-three. `npm run adr:new` is
    // where the number comes from when a record is added.
    const claimed = /^([A-Z][a-z]+(?:-[a-z]+)?) records shaped this repo/m.exec(readme())?.[1];
    expect(claimed).toBe(inWords(adrFiles().length));
  });

  it('says how many notes follow it, and is right about that too', () => {
    // The second typed count in the same document, and it was already wrong: it
    // said nine over eight notes, and had said so long enough that nobody knows
    // which note left. Counted here rather than corrected once, because the
    // correction is the part that does not last.
    const text = readme();
    const claimed = /^([A-Z][a-z]+(?:-[a-z]+)?) notes for readers/m.exec(text)?.[1];
    // Bounded to the list, not to the rest of the file: `adr/README.md` has prose
    // after it and a bulleted list added down there would inflate this and redden
    // the test for a reason that has nothing to do with the notes. The list ends
    // at the first line that is neither a bullet, a bullet's continuation, nor
    // blank.
    const after = text.slice(text.indexOf('notes for readers')).split('\n').slice(1);
    let notes = 0;
    for (const line of after) {
      if (line.startsWith('- ')) notes++;
      else if (line.trim() !== '' && !/^\s/.test(line)) break;
    }
    expect(claimed).toBe(inWords(notes));
  });
});

/** The spellings `inWords` produces, lowercased, so the check below reads numbers only. */
const NUMBER_WORDS = Array.from({ length: 40 }, (_, i) => inWords(i + 1).toLowerCase());

describe("the index's own arithmetic", () => {
  it('lists every record exactly once, and lists nothing else', () => {
    // Deleting a row was invisible: nothing tied the table to the directory, and
    // it had already drifted once — commit 407bd59 is "List ADR 0033 in the
    // index", written after the record was.
    const listed = [...readme().matchAll(/^\| \[(0\d{3})\]\(([^)]+)\)/gm)];
    const rows = listed.map((hit) => hit[1]);
    const files = adrFiles().map((file) => adrNumber(file) as string);
    expect(rows).toEqual([...files].sort());
    // And each row's link has to reach the file it claims, or the table is right
    // about the set and wrong about every address in it.
    const wrong = listed
      .map((hit) => ({ number: hit[1], href: hit[2] }))
      .filter(
        ({ number, href }) =>
          !adrFiles().some((file) => file === `adr/${href}` && adrNumber(file) === number),
      );
    expect(wrong).toEqual([]);
  });

  it('is right when a row says how many decisions a record makes', () => {
    // `0026` reads "nine decisions". It was nine when it was typed and nothing
    // read it. The ledger knows the number now, so the phrase is checkable
    // wherever anybody writes it.
    const wrong: string[] = [];
    for (const line of readme().split('\n')) {
      const row = /^\| \[(0\d{3})\]/.exec(line);
      // Only a spelled number, or "its decision" and "the record's decision"
      // both read as counts and the check fails on English rather than on a
      // figure.
      const said = new RegExp(`\\b(${NUMBER_WORDS.join('|')})\\s+decisions?\\b`).exec(line);
      if (!row || !said) continue;
      const held = Object.keys(ledger[row[1]]?.decisions ?? {}).length;
      const inWordsLower = inWords(held).toLowerCase();
      if (said[1] !== inWordsLower) {
        wrong.push(`ADR ${row[1]}: the row says ${said[1]}, the ledger holds ${inWordsLower}`);
      }
    }
    expect(report('A row counts a record’s decisions and gets it wrong.', wrong)).toBe('');
  });
});

describe('the decisions inside them', () => {
  it('gives every record at least one numbered decision', () => {
    // A decision with no number cannot be cited, which is the whole point. This
    // fails for a record whose decision section nobody numbered.
    const silent = adrFiles()
      .map((file) => adrNumber(file) as string)
      .filter((record) => !byRecord.has(record));
    expect(silent).toEqual([]);
  });

  it('uses each number once within a record', () => {
    const doubled: string[] = [];
    for (const [record, list] of byRecord) {
      const counts = new Map<number, number>();
      for (const d of list) counts.set(d.number, (counts.get(d.number) ?? 0) + 1);
      for (const [number, count] of counts) {
        if (count > 1) doubled.push(`${record} §${number} appears ${count} times`);
      }
    }
    expect(doubled).toEqual([]);
  });

  it('numbers a section heading and never a detail inside one', () => {
    // `##` is a record's own decision block; `###` is one decision inside it. A
    // numbered `####` would be a number on a paragraph, and the number would stop
    // meaning "a decision this record makes".
    const wrong = all.filter((d) => d.depth !== 2 && d.depth !== 3);
    expect(wrong.map((d) => `${d.file}: ${'#'.repeat(d.depth)} ${d.number}. ${d.text}`)).toEqual(
      [],
    );
  });
});

describe('the ledger against the default branch', () => {
  /**
   * The published ledger, which is the only thing a hand-edit cannot arrange.
   *
   * Read once. `git show origin/main:adr/decisions.lock.json` needs no network,
   * only the ref, so this works offline in a checkout that has fetched at least
   * once — and refuses to guess in one that has not.
   */
  const baseline = baselineLedger(ROOT);

  if (baseline.state === 'absent') {
    // The one green answer that is not a comparison, and it is true exactly once
    // in the file's life: on the change that publishes it. Said out loud, because
    // a check that quietly does nothing is the failure this whole file is about.
    console.warn(`decision-numbers: ${baseline.reason}`);
  }

  it('is there to be compared against, or says what stopped it', () => {
    // Three answers and only two of them are acceptable. `read` is the check
    // running. `absent` is the pull request that introduces the ledger, and it
    // stops being possible the moment that merges. `unavailable` is a checkout
    // with no `origin/main` — which a shallow CI clone produces — and it must
    // never read as agreement, so it is red here and `.github/workflows/ci.yml`
    // fetches the ref before `npm run check` for that reason.
    const stopped = baseline.state === 'unavailable' ? [baseline.reason] : [];
    expect(report('The append-only check could not run.', stopped)).toBe('');
  });

  it('extends the published ledger and never revises it', () => {
    // The whole design, in one assertion. A record the default branch holds is
    // still held, a number it holds is still held, and every history it holds is
    // a PREFIX of the history now. Appending is the only permitted direction, so
    // this refuses every edit that takes something out and permits every edit
    // that adds. A swap that went through `adr:lock` is an addition and passes
    // here; what it cannot do afterwards is remove the addition, which is why the
    // record of it is permanent. See the file's docstring for the whole of it.
    if (baseline.state !== 'read') return;
    const { ledger: published, problems } = readLedger(baseline.text);
    expect(report(`${LEDGER_PATH} on origin/main cannot be read.`, problems)).toBe('');
    expect(report(REVISION_GUIDANCE, revisions(published, ledger))).toBe('');
  });
});

describe('the ledger', () => {
  /** The texts a number has carried, oldest first. */
  const historyOf = (record: string, number: number): string[] | undefined =>
    ledger[record]?.decisions?.[String(number)];

  it('has the shape the rest of this reads it as', () => {
    // The direction nothing walked: from the ledger back to the records. The two
    // parsers drifted here and it was invisible — `## 0. Context` was a decision
    // to `scripts/adr.mjs` and never a decision to `decisionNumber`, so a `0`
    // written into the ledger stayed, naming a section that is not a decision and
    // that the site mints no anchor for. `readLedger` rejects a key the site
    // would not mint, and rejects every other shape the file has crashed on.
    expect(report(`${LEDGER_PATH} is not the shape it has to be.`, ledgerProblems)).toBe('');
  });

  it('holds no record that is not in adr/', () => {
    // Deleting a record used to be entirely unguarded, and the citation check
    // then certified the dangling citations it left behind: it resolved a
    // citation against the ledger, and the ledger never forgets. The ledger is
    // the history of the numbers, so an entry is never dropped — which means the
    // file has to be there, and this is the check that says so.
    const files = new Set(adrFiles().map((file) => adrNumber(file) as string));
    const orphaned = Object.keys(ledger)
      .filter((record) => !files.has(record))
      .map((record) => `ADR ${record} (${ledger[record].slugs.at(-1)}) has no file in adr/`);
    expect(
      report(
        'The ledger names a record that is not in the directory. A record is not deleted: it is ' +
          'the document every `ADR NNNN` in the repository points at, and the ledger entry is ' +
          'what keeps the number from being handed to something else.',
        orphaned,
      ),
    ).toBe('');
  });

  it('holds every number that has ever been used', () => {
    const missing = all
      .filter((d) => historyOf(d.record, d.number) === undefined)
      .map((d) => `${d.record} §${d.number} (${d.text})`);
    expect(report(`Not in ${LEDGER_PATH}. Run \`npm run adr:lock\`.`, missing)).toBe('');
  });

  it('points every record number at the document it points at now', () => {
    // The hole a cold review walked through on 2026-09-16: it deleted ADR 0029
    // and wrote an unrelated record under the same number. Every other check
    // here passed, because they all read the decisions inside a record and
    // nothing read which record it was.
    //
    // The slug is a history too, for the reason the decision texts are: renaming
    // a record's file is ordinary, and appending puts it in the diff where a
    // reviewer sees it instead of overwriting the only evidence it happened.
    const moved = adrFiles()
      .map((file) => ({ record: adrNumber(file) as string, slug: slugOf(file) }))
      .filter(
        ({ record, slug }) => ledger[record] !== undefined && ledger[record].slugs.at(-1) !== slug,
      )
      .map(
        ({ record, slug }) =>
          `ADR ${record}\n    ledger: ${ledger[record].slugs.join(' → ')}\n    now:    ${slug}`,
      );
    expect(
      report(
        'A record number names a different document than the ledger does. Renaming the file is ' +
          'fine and `npm run adr:lock` appends the new slug; reusing the number for another ' +
          'record is not, because every citation of it now points at the wrong record.',
        moved,
      ),
    ).toBe('');
  });

  it('still finds each number naming the decision it names today', () => {
    // A reordering, a renumbering after an insertion, or a number quietly reused
    // for something else all land here — as long as the ledger was not edited in
    // the same pass. That last clause is the whole reason the comparison against
    // the default branch exists above; this one catches the honest mistake.
    const moved: string[] = [];
    for (const decision of all) {
      const history = historyOf(decision.record, decision.number);
      if (history !== undefined && history.at(-1) !== decision.text) {
        moved.push(
          `ADR ${decision.record} §${decision.number}\n    was: ${history.at(-1)}\n    now: ${decision.text}`,
        );
      }
    }
    expect(
      report(
        'A number in use names something else now. If the heading was only reworded, ' +
          '`npm run adr:lock` appends it. If the number moved to another decision, move it ' +
          'back: the numbers are append-only, and they are cited across the repository, in ' +
          'code comments, in tests and in other records.',
        moved,
      ),
    ).toBe('');
  });

  it('never has one heading standing in two numbers of the same record', () => {
    // Two decisions of one record carrying the same heading, which is either a
    // swap hand-edited to look like two rewords or, far more often, two sections
    // nobody titled. Either way neither can be cited, so it is refused.
    //
    // Compared on `normalise`, which takes off punctuation, spacing and case.
    // That is what makes the cheapest disguise fail: swap two numbers and change
    // an em dash to a comma in each heading, and both new texts differ from every
    // old one by exact comparison while normalising to the texts already there.
    const collisions: string[] = [];
    for (const [record, entry] of Object.entries(ledger)) {
      const where = new Map<string, string>();
      for (const [number, history] of Object.entries(entry.decisions)) {
        for (const text of history) {
          const already = where.get(normalise(text));
          if (already !== undefined && already !== number) {
            collisions.push(`ADR ${record} §${already} and §${number} have both held\n    ${text}`);
          }
          where.set(normalise(text), number);
        }
      }
    }
    expect(
      report(
        'Two numbers of one record have carried the same heading, punctuation aside. Two ' +
          'decisions need two titles.',
        collisions,
      ),
    ).toBe('');
  });

  it('never lets a distinctive decision reappear under another record', () => {
    // A decision lifted out of one record and pasted into another: the first
    // leaves a gap, which is allowed, and the second is simply a number the
    // ledger has not seen, which is also allowed. Only the text ties them.
    const lifted: string[] = [];
    for (const decision of all) {
      if (historyOf(decision.record, decision.number) !== undefined) continue;
      const home = placesOfText.get(normalise(decision.text));
      if (home?.length === 1 && !home[0].startsWith(decision.record)) {
        lifted.push(
          `ADR ${decision.record} §${decision.number} takes the text of ${home[0]}\n    ${decision.text}`,
        );
      }
    }
    expect(report('A decision appears under a number it did not have.', lifted)).toBe('');
  });

  it('cannot be strict across records, and here is the text that says why', () => {
    // The check above guards a text standing in exactly one place and lets go of
    // one standing in several, and both this file and `scripts/adr.mjs` used to
    // explain that with a count of records typed into a comment. The count was
    // already disagreeing with itself when it was found: it was offered as both
    // "records with exactly one decision" and "records whose §1 reads `Decision`",
    // which happened to be the same figure and were not the same records — ADR
    // 0003's one decision is titled `Consequence for the stack decision` and ADR
    // 0030 reads `Decision` at §1 while also having a §2. AGENTS.md forbids a
    // repository-measured figure with no check under it, so the figure is gone
    // and the property it was standing in for is measured here instead.
    expect(placesOfText.get(normalise('Decision'))?.length ?? 0).toBeGreaterThan(1);
  });

  it('never lets a retired number be handed to a new decision', () => {
    // A decision that is removed leaves a gap. The gap is what stops §3 of a
    // record meaning one thing in the citations written last year and another in
    // the ones written this year, so a new decision has to take a number above
    // every number the ledger has ever recorded for that record.
    const reused: string[] = [];
    for (const [record, list] of byRecord) {
      const held = Object.keys(ledger[record]?.decisions ?? {}).map(Number);
      const highest = held.length > 0 ? Math.max(...held) : 0;
      for (const decision of list) {
        const known = historyOf(record, decision.number) !== undefined;
        if (!known && decision.number <= highest) {
          reused.push(
            `ADR ${record} §${decision.number} (${decision.text}) — free numbers start at ${highest + 1}`,
          );
        }
      }
    }
    expect(reused).toEqual([]);
  });
});

/**
 * Every `record §number` a heading has stood at, keyed by its normalised text.
 *
 * Normalised, because "distinctive" is about the decision and not about its
 * punctuation: a heading that reappears elsewhere with a comma where an em dash
 * was is the same heading, and the difference is the cheapest way to dress a move
 * up as a reword.
 */
const placesOfText = new Map<string, string[]>();
for (const [record, entry] of Object.entries(ledger)) {
  for (const [number, history] of Object.entries(entry.decisions)) {
    for (const text of history) {
      const key = normalise(text);
      placesOfText.set(key, [...(placesOfText.get(key) ?? []), `${record} §${number}`]);
    }
  }
}

describe('the citations', () => {
  /**
   * `§` had no fixed meaning in this repository until the numbers existed, and
   * the day it got one, two sentences written before it became ambiguous: the
   * audio spike said "the gate set in `APP-STRATEGIE.md` §8" while acquiring a §1
   * of its own, and the redesign record said "decision 12 of the redesign" two
   * lines after a correct §6 of its own.
   *
   * So: a `§` belongs to the document named nearest before it, and a `§` in a
   * record with no document named before it is that record's own.
   */
  it('points every `ADR NNNN §M` at a decision that exists today', () => {
    // Resolved against the records, not against the ledger. The ledger never
    // forgets a number, so resolving against it certified every citation of a
    // decision that had been removed and of a record that had been deleted —
    // which is the one thing a citation check is for.
    //
    // Over the whole repository. Some fifty of these live in `packages/app-core`,
    // `apps/mobile`, `AGENTS.md` and `ARCHITECTURE.md`, and the check used to
    // read `adr/` alone, so a renumbering would have been caught in the records
    // that cite it and nowhere in the code that does.
    const dangling: string[] = [];
    for (const { file, text } of everyTextFile()) {
      for (const citation of citationsIn(file, text)) {
        if (citation.record === null) continue;
        if (!live(citation.record, citation.section)) {
          dangling.push(`${file}:${citation.line}: ADR ${citation.record} §${citation.section}`);
        }
      }
    }
    expect(
      report(
        'A citation names a decision no record makes. A number is never reused, so a decision ' +
          'that was removed leaves a gap and a citation of it has to be rewritten, not renumbered.' +
          '\n\nIf the line below does not look like a citation you wrote: a `§` takes the record ' +
          'named most recently within ' +
          String(REACH) +
          ' characters, and a record naming another one and then writing a bare `§` of its own ' +
          'reads as that other record\u2019s section. Two records did exactly that on 2026-09-18, ' +
          'one in a status line and one in an index row. Name the record, or say which decision ' +
          'in words.',
        dangling,
      ),
    ).toBe('');
  });

  it('reads the code and the top-level documents too, which is where most of them are', () => {
    // A check that resolves nothing passes. This one reaches the repository
    // through an extension allow-list and one regular expression, and either
    // could stop matching without anything going red — so the non-vacuity is
    // asserted rather than assumed. No figure: a count of citations is a
    // repository-measured fact that expires, and what has to be true is only
    // that the records are not the only place a decision is cited from.
    const outside = everyTextFile()
      .filter(({ file }) => !file.startsWith('adr/'))
      .filter(({ file, text }) => citationsIn(file, text).some((c) => c.record !== null));
    expect(outside.length).toBeGreaterThan(1);
  });

  it('points every bare `§M` inside a record at that record’s own decision', () => {
    const dangling: string[] = [];
    for (const file of adrFiles()) {
      const record = adrNumber(file) as string;
      const text = readFileSync(join(ROOT, file), 'utf8');
      for (const citation of citationsIn(file, text)) {
        // A `§` that already names its document, or names a record, is the
        // other check's business.
        if (citation.record !== null || citation.named) continue;
        if (!live(record, citation.section)) {
          dangling.push(
            `${file}:${citation.line}: a bare §${citation.section}, and ADR ${record} has no such decision`,
          );
        }
      }
    }
    expect(
      report(
        'A bare section mark reads as this record’s own decision. If it means a section ' +
          'of another document, name the document beside it.',
        dangling,
      ),
    ).toBe('');
  });
});

describe('the anchors', () => {
  const docs = collectDocs().module.docs;

  it('answers /decisions/<record>#<number> for every decision', () => {
    // `#6`, not `#6-german-and-english-from-the-first-string`. A slug is derived
    // from the words, so it dies on the reword the number was introduced to
    // survive. This is the assertion that the workbench mints the number instead.
    const unreachable: string[] = [];
    for (const [record, list] of byRecord) {
      const doc = docs.find((d) => d.route === `/decisions/${record}`);
      expect(doc).toBeDefined();
      for (const decision of list) {
        const id = String(decision.number);
        if (!doc?.headings.some((h) => h.id === id)) {
          unreachable.push(`/decisions/${record}#${id} (${decision.text})`);
        }
        if (!doc?.html.includes(`id="${id}"`)) {
          unreachable.push(`/decisions/${record}#${id} is not in the HTML`);
        }
      }
    }
    expect(unreachable).toEqual([]);
  });

  it('mints a bare number only in a record', () => {
    // `N.` at the front of a heading means a decision number in `adr/` and nothing
    // anywhere else, so no other document may hand out an id somebody would read
    // as one.
    const elsewhere = docs
      .filter((doc) => !doc.route.startsWith('/decisions/'))
      .flatMap((doc) =>
        doc.headings.filter((h) => /^\d+$/.test(h.id)).map((h) => `${doc.route}#${h.id}`),
      );
    expect(elsewhere).toEqual([]);
  });
});

/** Whether a record still makes that decision, which is what a citation has to reach. */
function live(record: string, section: number): boolean {
  return (byRecord.get(record) ?? []).some((decision) => decision.number === section);
}

/**
 * One `§` and the document it belongs to.
 *
 * `record` is a record number when the nearest document named before it is a
 * record, `null` otherwise; `named` says whether any document was named at all,
 * which is what separates "some other document's §3" from "this record's own".
 */
interface Citation {
  line: number;
  section: number;
  record: string | null;
  named: boolean;
}

/**
 * Every `§` in a file, each attributed to the document written nearest before it.
 *
 * Four things were wrong with reading this off a regular expression per line, all
 * four reproduced before this was written.
 *
 * A second `§` on one line was mis-attributed: in ``Two of the four blockers
 * documented in `APP-STRATEGIE.md` §3 and §8``, the §8 could not see back past the
 * §3 to the document, so it was reported as a dangling reference to the record's
 * own §8 — with guidance telling the author to name the document, which the
 * sentence already does.
 *
 * The FIRST `ADR NNNN` on a line won, so `Both ADR 0003 and ADR 0026 §6 argue
 * this` resolved against the first of the two, which makes no such decision, and
 * never checked the real one.
 *
 * A citation the line wrap split matched nothing at all, and Markdown wraps.
 *
 * And a `§` inside a code fence or a code span was asserted, so a record
 * documenting these checks could not be written. That one is not hypothetical:
 * this paragraph is inside a file the check reads.
 *
 * So: scan once, left to right, keeping the last document named. A record number,
 * a record's filename and `ADR NNNN` all name a record; any other `*.md` names a
 * document that is not a record. The claim lapses at a blank line or after
 * `REACH` characters, because a document named at the top of a long comment is
 * not what a `§` at the bottom of it refers to.
 *
 * Code is skipped in Markdown only, where a fence and a backtick span are how a
 * document quotes something without asserting it. The two are not skipped the
 * same way: a fence is quoted material, so a document named inside one names
 * nothing outside it, while a span is ordinary prose notation and the `.md` in
 * ``…`APP-STRATEGIE.md` §3…`` is exactly what tells the §3 which document it
 * belongs to. So a fence hides both ends of a citation and a span hides only the
 * `§`.
 *
 * In a source file neither is skipped: a backtick there is a template literal,
 * and blanking those out would hide real citations in the prose around them. A
 * citation typed into code is a citation, and the fifty-odd in `packages/app-core`
 * and `apps/mobile` are the reason this reads the whole repository at all.
 */
const REACH = 140;

function citationsIn(file: string, text: string): Citation[] {
  const markdown = file.endsWith('.md') || file.endsWith('.markdown');
  const { fenced, quoted } = markdown ? code(text) : { fenced: EMPTY, quoted: EMPTY };
  const TOKEN =
    /(?<adr>ADR\s+(?<adrNumber>0\d{3}))|(?<record>(?<recordNumber>0\d{3})-[a-z0-9-]+\.md)|(?<bare>(?<bareNumber>0\d{3}))|(?<other>[A-Za-z0-9_.-]+\.(?:md|markdown))|§\s?(?<section>\d{1,3})/g;

  const found: Citation[] = [];
  let named: { record: string | null; end: number } | null = null;
  for (const hit of text.matchAll(TOKEN)) {
    const groups = hit.groups as Record<string, string | undefined>;
    const start = hit.index;

    if (groups.section === undefined) {
      if (fenced.has(start)) continue;
      const record = groups.adrNumber ?? groups.recordNumber ?? groups.bareNumber ?? null;
      named = { record, end: start + hit[0].length };
      continue;
    }

    if (quoted.has(start)) continue;
    const reach =
      named !== null && start - named.end <= REACH && !text.slice(named.end, start).includes('\n\n')
        ? named
        : null;
    found.push({
      line: text.slice(0, start).split('\n').length,
      section: Number(groups.section),
      record: reach?.record ?? null,
      named: reach !== null,
    });
  }
  return found;
}

const EMPTY: ReadonlySet<number> = new Set<number>();

/**
 * Character offsets inside a fenced block, and inside a fence or a backtick span.
 *
 * Two sets rather than one because a marker and a `§` are hidden by different
 * things; see `citationsIn` for which and why.
 */
function code(markdown: string): { fenced: ReadonlySet<number>; quoted: ReadonlySet<number> } {
  const fenced = new Set<number>();
  const quoted = new Set<number>();
  let offset = 0;
  let fence: string | null = null;
  for (const line of markdown.split('\n')) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    const opening = marker !== null && fence === null;
    const closing = marker !== null && fence !== null && marker[1][0] === fence;
    if (fence !== null || marker !== null) {
      for (let i = 0; i < line.length; i++) {
        fenced.add(offset + i);
        quoted.add(offset + i);
      }
    } else {
      for (const span of line.matchAll(/`+[^`]*`+/g)) {
        for (let i = 0; i < span[0].length; i++) quoted.add(offset + span.index + i);
      }
    }
    if (opening) fence = marker[1][0];
    else if (closing) fence = null;
    offset += line.length + 1;
  }
  return { fenced, quoted };
}

/**
 * Every text file git tracks, which is where a citation can be.
 *
 * An allow-list of extensions rather than everything, because the repository
 * holds fonts, screenshots and an APK and none of those hold a `§`. A file type
 * that starts carrying citations has to be added here, and that is the known
 * limit of this check.
 *
 * `git ls-files` names what is tracked, which in a tree with a deleted file is
 * not the same as what is there. Reading one threw an ENOENT with a line number
 * in this file instead of saying anything about the repository, which is the same
 * shape of failure this whole change is about; a file that is gone carries no
 * citation, so it is skipped.
 */
const TEXT = /\.(md|markdown|ts|tsx|mts|cts|js|jsx|mjs|cjs|json|ya?ml|css|html|sh|txt)$/;

function everyTextFile(): { file: string; text: string }[] {
  const listed = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return listed
    .split('\0')
    .filter((file) => file !== '' && TEXT.test(file) && existsSync(join(ROOT, file)))
    .map((file) => ({ file, text: readFileSync(join(ROOT, file), 'utf8') }));
}

/** `adr/README.md`, which carries two counts of its own and is read for both. */
function readme(): string {
  return readFileSync(join(ROOT, 'adr/README.md'), 'utf8');
}

/** `adr/0029-the-handbook-keeps-its-own-primitives.md` gives the part after the number. */
function slugOf(file: string): string {
  return /(0\d{3})-(.*)\.md$/.exec(file)?.[2] ?? '';
}

/**
 * One assertion's worth of failure, as a string rather than as a second argument.
 *
 * `expect(value, message)` is vitest's and oxlint's jest plugin rejects it, so the
 * guidance goes into the compared value instead — where it is also more use,
 * because it then appears in the diff rather than beside it.
 */
function report(guidance: string, rows: string[]): string {
  return rows.length === 0 ? '' : [guidance, '', ...rows].join('\n');
}

/** A number in the spelling `adr/README.md` writes its counts in. */
function inWords(n: number): string {
  const ones = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety',
  ];
  if (n < 20) return ones[n];
  const rest = n % 10;
  return rest === 0
    ? tens[Math.floor(n / 10)]
    : `${tens[Math.floor(n / 10)]}-${ones[rest].toLowerCase()}`;
}
