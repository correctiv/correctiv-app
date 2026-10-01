#!/usr/bin/env node
/**
 * The two things about `adr/` that a person cannot check by looking.
 *
 * `new` allocates the next record number. `lock` adds newly written decisions to
 * `adr/decisions.lock.json`, the ledger `apps/workbench/test/decision-numbers.test.ts`
 * holds the records against.
 *
 * Neither writes prose. A script that invented the skeleton of a record would be
 * writing the one part of it that has to be argued.
 *
 * What `lock` can and cannot do is worth being exact about, because the first
 * version of this file claimed more. It refuses a ledger that revises the one on
 * `origin/main` — that check is in `adr-ledger.mjs` and it is the one that means
 * something, because no rearrangement of a working tree turns a deletion into an
 * append. It does not refuse a renumbering, which only appends; what it refuses is
 * ever taking that append back out, so the swap stays in the ledger and in the
 * diff. Everything else in here reads the working tree, catches the accident and
 * the half-finished edit, and stops there: an editor who means it can make any
 * single tree self-consistent, and this tool is not what stands between them and
 * that.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  baselineLedger,
  LEDGER_PATH,
  normalise,
  readLedger,
  RESTORE_HINT,
  REVISION_GUIDANCE,
  revisions,
} from './adr-ledger.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ADR = join(ROOT, 'adr');
const LOCK = join(ROOT, LEDGER_PATH);

/** `0022-three-tiers-of-colour.md` gives `0022`. */
const RECORD = /^(0\d{3})-.*\.md$/;

/** The same, keeping the slug: `0022-three-tiers-of-colour.md` gives `three-tiers-of-colour`. */
const SLUG = /^(0\d{3})-(.*)\.md$/;

/**
 * A decision heading, and the number it opens with.
 *
 * The same shape `apps/workbench/plugin/markdown.ts` reads to mint the anchor, and
 * deliberately a second implementation of it rather than a shared import: this is
 * plain Node and that is TypeScript inside a workspace. The two cannot drift
 * quietly, because the test reads the records with the TypeScript one and compares
 * against the ledger this file wrote — a disagreement is a missing or an extra
 * entry, which is a red test and not a silent difference.
 *
 * `[1-9]` rather than `\d` because they drifted in the one direction nothing
 * compared: a `## 0. Context` used to be a decision here and never a decision
 * there, and a `0` written into the ledger stayed. The test walks the ledger back
 * to the records now, so a number only one of the two parsers accepts is red on
 * the next run instead of permanent.
 */
const HEADING = /^(#{2,3})\s+([1-9]\d{0,2})\.\s+(.+)$/;

/** ```` ``` ```` or `~~~`, opening or closing a fenced block. */
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

function records() {
  return readdirSync(ADR)
    .filter((file) => RECORD.test(file))
    .sort()
    .map((file) => ({ number: RECORD.exec(file)[1], file, slug: SLUG.exec(file)[2] }));
}

/**
 * Record numbers on the default branch, which a stale local tree cannot see.
 *
 * The same failure as the open pull requests, from the other side: a checkout
 * that has not fetched since a record merged hands out a number that is already
 * on `main`. Returns `null` when git cannot answer, for the same reason as
 * `claimedByOpenPullRequests`.
 *
 * The fetch is the point, and it was missing. `origin/main` is a local ref that
 * is exactly as old as the last fetch, so reading it in a checkout nobody had
 * fetched answered with the same stale tree the caller already had — the one case
 * the docstring says this exists to catch, reported as verified.
 */
function onDefaultBranch() {
  try {
    // `+` because this is a remote-tracking ref and the question is what is on
    // `main` now, not whether it grew from what was here. Without it a rebased or
    // force-pushed main is rejected as a non-fast-forward and the tool reports the
    // number as unverified, which is safe and useless.
    execFileSync('git', ['fetch', '--quiet', 'origin', '+main:refs/remotes/origin/main'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch {
    // A fetch that fails leaves whatever ref is already there, and a ref of
    // unknown age is what produced the duplicate. Say nothing was read.
    return null;
  }
  try {
    const raw = execFileSync('git', ['ls-tree', '--name-only', 'origin/main', 'adr/'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 15_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return new Set(
      raw
        .split('\n')
        .map((path) => /^adr\/(0\d{3})-.*\.md$/.exec(path)?.[1])
        .filter(Boolean),
    );
  } catch {
    return null;
  }
}

/**
 * `{ '1': 'Decision', '2': 'The label is the part with a rule behind it' }`
 *
 * A number written twice in one record is returned as a duplicate rather than
 * silently overwritten. The test catches it too, but this runs first and would
 * otherwise print "1 decision added" about a record it had just mangled.
 *
 * A fenced block is skipped. A record that quotes the shape of a decision heading
 * — this repository has one, and writing it is how the hole was found — used to
 * mint a number for a heading that exists only inside the fence, and the failure
 * message then asked for `adr:lock`, which reserved that number for good.
 */
function decisionsIn(file) {
  const found = {};
  const doubled = [];
  let fence = null;
  for (const line of readFileSync(join(ADR, file), 'utf8').split('\n')) {
    const marker = FENCE.exec(line);
    if (marker) {
      if (fence === null) fence = marker[1][0];
      else if (marker[1][0] === fence) fence = null;
      continue;
    }
    if (fence !== null) continue;
    const hit = HEADING.exec(line);
    if (!hit) continue;
    if (found[hit[2]] !== undefined) doubled.push(hit[2]);
    found[hit[2]] = hit[3].trim();
  }
  return { found, doubled };
}

/**
 * Record numbers claimed by an open pull request, which the directory cannot see.
 *
 * This is the half that matters. On 2026-09-16 two records both claimed 0034: two
 * agents read "the highest here is 0033" off the same tree, and because the
 * filenames differed by their slug git merged them without a conflict. The tree is
 * the thing that agreed with both of them.
 *
 * One `gh` call for every open pull request and its changed files. If `gh` is not
 * installed, not authenticated or slow enough to time out, this returns `null`
 * rather than an empty set, so the caller can say the number is from the tree alone
 * instead of implying it checked.
 *
 * Two silent truncations used to be reported as verified. `gh pr list` stops at its
 * `--limit`, and the file list inside each pull request stops at 100 whatever the
 * limit says. A list that hit either cap is `null` here, for the same reason: an
 * answer that might be missing the one record that matters is not an answer.
 */
const PULL_REQUEST_LIMIT = 200;
const FILES_PER_PULL_REQUEST = 100;

function claimedByOpenPullRequests() {
  let pulls;
  try {
    pulls = JSON.parse(
      execFileSync(
        'gh',
        [
          'pr',
          'list',
          '--state',
          'open',
          '--limit',
          String(PULL_REQUEST_LIMIT),
          '--json',
          'number,files',
        ],
        { cwd: ROOT, encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] },
      ),
    );
  } catch {
    return null;
  }
  if (pulls.length >= PULL_REQUEST_LIMIT) return null;

  const claims = new Map();
  for (const pr of pulls) {
    let paths = (pr.files ?? []).map(({ path }) => path);
    if (paths.length >= FILES_PER_PULL_REQUEST) {
      // The one pull request big enough to be cut off, asked again through the
      // REST endpoint, which pages. Cheap because it is rare, and the whole
      // point is that the cut-off list is the one hiding a record.
      try {
        paths = execFileSync(
          'gh',
          [
            'api',
            '--paginate',
            `repos/{owner}/{repo}/pulls/${pr.number}/files`,
            '--jq',
            '.[].filename',
          ],
          { cwd: ROOT, encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] },
        )
          .split('\n')
          .filter(Boolean);
      } catch {
        return null;
      }
    }
    for (const path of paths) {
      const hit = /^adr\/(0\d{3})-.*\.md$/.exec(path);
      if (hit) claims.set(hit[1], pr.number);
    }
  }
  return claims;
}

function next() {
  const inTree = records().map((r) => r.number);
  const claimed = claimedByOpenPullRequests();
  const merged = onDefaultBranch();
  const taken = new Set(inTree);
  if (claimed) for (const number of claimed.keys()) taken.add(number);
  if (merged) for (const number of merged) taken.add(number);

  // An empty `adr/` used to reach `Math.max()` of nothing and print
  // `Next free number: -Infinity`, which is the first number this tool would
  // ever hand out in a fresh repository.
  const highest = taken.size === 0 ? 0 : Math.max(...[...taken].map(Number));
  const free = String(highest + 1).padStart(4, '0');

  console.log(`In adr/:            ${inTree.length} records, highest ${inTree.at(-1) ?? 'none'}`);

  // Only what the tree does NOT already have. The first version listed every
  // record any open pull request touched, which on the day it was written was
  // 34 rows of which one mattered — and the one that mattered was last.
  if (claimed === null) {
    console.log('Open pull requests: NOT READ — `gh` failed, or its answer was cut off.');
  } else {
    const news = [...claimed].filter(([number]) => !inTree.includes(number));
    console.log(
      news.length === 0
        ? 'Open pull requests: no record number the tree does not have'
        : `Open pull requests: ${news.map(([n, pr]) => `${n} (#${pr})`).join(', ')}`,
    );
  }

  if (merged === null) {
    console.log('On origin/main:     NOT READ — the fetch failed, or git could not answer.');
  } else {
    const news = [...merged].filter((number) => !inTree.includes(number));
    console.log(
      news.length === 0
        ? 'On origin/main:     nothing the tree does not have'
        : `On origin/main:     ${news.join(', ')} — this checkout is behind`,
    );
  }

  console.log('');

  // The number is printed either way, because a person asking for it is about to
  // write a record and a blank answer helps nobody. What changes is the exit
  // code: a caller that scripts this gets a failure, and a number from the tree
  // alone is exactly what produced the duplicate 0034 on 2026-09-16.
  if (claimed === null || merged === null) {
    console.log(`Next free number:   ${free}  — UNVERIFIED, see above`);
    console.log('');
    console.log('The sources that were not read are the ones that catch a number');
    console.log('already taken somewhere this working tree cannot see.');
    process.exitCode = 1;
    return;
  }

  console.log(`Next free number:   ${free}`);
  console.log(`Write it as         adr/${free}-a-slug-of-the-title.md`);
  console.log('and list it in      adr/README.md');
}

/** Reads and validates the ledger, or explains what is wrong with the file and stops. */
function loadLedger() {
  if (!existsSync(LOCK)) {
    console.error(`${LEDGER_PATH} is not there.`);
    console.error('');
    console.error('It is not a file this tool rebuilds. Rebuilding it wholesale is the operation');
    console.error('that would accept a renumbering in silence, which is what it exists to refuse.');
    console.error(RESTORE_HINT);
    return null;
  }
  const { ledger, problems } = readLedger(readFileSync(LOCK, 'utf8'));
  if (problems.length > 0) {
    console.error(`${LEDGER_PATH} cannot be read:`);
    console.error(problems.map((problem) => `  ${problem}`).join('\n'));
    console.error('');
    console.error(RESTORE_HINT);
    return null;
  }
  return ledger;
}

/**
 * Adds decisions the ledger has not seen, and says what it refused and why.
 *
 * Three gates, weakest last.
 *
 * The file has to parse into the shape the rest of this assumes, and a file that
 * does not is named rather than thrown at the reader as a stack trace.
 *
 * The ledger has to extend the one on `origin/main`. This is the gate that means
 * something. A deleted entry, a reordered history and two histories exchanged are
 * all revisions of a published file, and no rearrangement of the working tree
 * turns a revision into an append. What it does NOT do is stop a renumbering: a
 * swap put through this tool appends the new text under each number, which is an
 * extension and passes. What the reader gets is a ledger in which §1 and §3 each
 * carry the other's text, in the diff, permanently, because taking it back out
 * would be a revision. The gate makes a renumbering legible, not impossible.
 *
 * Then the within-tree checks, which are cheap and catch the ordinary mistake: a
 * heading standing under two numbers of one record, and a distinctive text that
 * already stood somewhere else before this edit. Both compare on `normalise`, so
 * the em-dash-to-comma version of a swap is caught as well. Neither stops a
 * determined editor, because within one tree everything is consistent by
 * construction, and neither is claimed to.
 */
function lock() {
  const ledger = loadLedger();
  if (ledger === null) {
    process.exitCode = 1;
    return;
  }

  const baseline = baselineLedger(ROOT);
  if (baseline.state === 'read') {
    const { ledger: published, problems } = readLedger(baseline.text);
    if (problems.length > 0) {
      console.error(`${LEDGER_PATH} on origin/main cannot be read, so nothing was compared:`);
      console.error(problems.map((problem) => `  ${problem}`).join('\n'));
      process.exitCode = 1;
      return;
    }
    const revised = revisions(published, ledger);
    if (revised.length > 0) {
      console.error('Nothing written:');
      console.error(revised.map((row) => `  ${row}`).join('\n'));
      console.error('');
      console.error(REVISION_GUIDANCE);
      process.exitCode = 1;
      return;
    }
  }

  // Every text the ledger already held, and where. Built once, from the file as
  // it stood before this run, and never added to: a text this run writes is not
  // evidence that anything moved. Building it as the run went along is what made
  // `adr:lock` refuse an empty ledger 25 times over, blaming moves that had not
  // happened — every record after the first was "taking" the text `Decision`
  // from the one before it.
  //
  // ACROSS records it can only be as strict as the text is distinctive, and most
  // are not: a record that states one unsectioned decision has a §1 reading
  // `Decision`, and many do. A text held in more than one place says nothing
  // about a move, so only a text held in exactly one place is guarded here. That
  // limit is checked in `decision-numbers.test.ts` rather than described with a
  // count nobody re-measures.
  const placesOf = new Map();
  for (const [number, entry] of Object.entries(ledger)) {
    for (const [n, history] of Object.entries(entry.decisions)) {
      for (const text of history) {
        const key = normalise(text);
        placesOf.set(key, [...(placesOf.get(key) ?? []), `${number} §${n}`]);
      }
    }
  }
  /** Where a text stands, when it stands in exactly one place. */
  const soleHome = (text) => {
    const places = placesOf.get(normalise(text));
    return places?.length === 1 ? places[0] : undefined;
  };

  const refusals = [];
  let added = 0;
  let appended = 0;
  let renamed = 0;

  for (const { number, file, slug } of records()) {
    const entry = (ledger[number] ??= { slugs: [slug], decisions: {} });

    // The record's identity, which nothing checked until a cold review deleted
    // 0029 and wrote a different record under the same number with every test
    // green. A number is a citation; the document it points at cannot change —
    // and a rename is an append here, so the diff shows it.
    if (entry.slugs.at(-1) !== slug) {
      entry.slugs.push(slug);
      renamed++;
    }

    const { found, doubled } = decisionsIn(file);
    for (const n of doubled) refusals.push(`  ${number} §${n} is written twice in ${file}`);
    if (doubled.length > 0) continue;

    // WITHIN a record, a heading standing under two numbers is either a swap that
    // was hand-edited to look like two rewords, or two decisions nobody bothered
    // to title. This map is seeded from the ledger and kept current as the loop
    // writes, because the version that built it beforehand could not see what it
    // had just written: adding a second plain `## 2. Decision` to a record made
    // the tool report success and the test then accuse the author of a swap, and
    // the only way out was deleting an entry from a file that must never lose one.
    const withinRecord = new Map();
    for (const [n, history] of Object.entries(entry.decisions)) {
      for (const text of history) withinRecord.set(normalise(text), n);
    }

    for (const [n, text] of Object.entries(found)) {
      const history = entry.decisions[n];
      const here = `${number} §${n}`;

      const alreadyHere = withinRecord.get(normalise(text));
      if (alreadyHere !== undefined && alreadyHere !== n) {
        refusals.push(
          `  ${number} §${n} and §${alreadyHere} would both carry\n    ${text}\n` +
            `    Two decisions of one record need two titles, or neither can be cited.\n` +
            `    If the two numbers were swapped and the headings edited to hide it, that is\n` +
            `    what this is, and the numbers are cited across the repository.`,
        );
        continue;
      }

      const elsewhere = soleHome(text);
      if (history === undefined || history.at(-1) !== text) {
        if (elsewhere !== undefined && elsewhere !== here) {
          refusals.push(
            `  ${here} would take text that already stands at ${elsewhere}\n    ${text}`,
          );
          continue;
        }
      }

      if (history === undefined) {
        entry.decisions[n] = [text];
        withinRecord.set(normalise(text), n);
        added++;
      } else if (history.at(-1) !== text) {
        history.push(text);
        withinRecord.set(normalise(text), n);
        appended++;
      }
    }

    entry.decisions = Object.fromEntries(
      Object.entries(entry.decisions).sort(([a], [b]) => Number(a) - Number(b)),
    );
  }

  if (refusals.length > 0) {
    console.error('Nothing written:');
    console.error(refusals.join('\n'));
    console.error('');
    console.error('A number is cited across the repository. It never moves to another');
    console.error('decision, and a record number never points at another document. If a');
    console.error('heading was only reworded, this would have appended it on its own.');
    process.exitCode = 1;
    return;
  }

  const sorted = Object.fromEntries(Object.entries(ledger).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LOCK, `${JSON.stringify(sorted, null, 2)}\n`);

  // Handed to the repository's formatter rather than imitating it. `JSON.stringify`
  // puts every array on four lines and oxfmt puts a short one on one, so a tool
  // that wrote its own spelling would leave `npm run check` red after every run
  // and the fix would be a second serializer to keep in step with the first.
  try {
    execFileSync('npx', ['oxfmt', LOCK], {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'pipe'],
      timeout: 60_000,
    });
  } catch {
    console.error(`Written, but oxfmt could not format ${LEDGER_PATH}. Run \`npx oxfmt\` on it.`);
    process.exitCode = 1;
  }
  const parts = [];
  if (added > 0) parts.push(`${added} decision${added === 1 ? '' : 's'} added`);
  if (appended > 0) parts.push(`${appended} rewording${appended === 1 ? '' : 's'} recorded`);
  if (renamed > 0) parts.push(`${renamed} record${renamed === 1 ? '' : 's'} renamed`);
  console.log(parts.length > 0 ? `${parts.join(', ')} in ${LEDGER_PATH}` : 'Nothing to add.');

  // The comparison is the strong check, so a run that could not make it says so.
  // Silence here would read as "checked and fine", which is the failure mode the
  // whole ledger is about.
  if (baseline.state !== 'read') {
    console.log('');
    console.log(`NOT COMPARED with the default branch: ${baseline.reason}`);
    if (baseline.state === 'unavailable') process.exitCode = 1;
  }
}

const command = process.argv[2];
if (command === 'new') next();
else if (command === 'lock') lock();
else {
  console.error('usage: node scripts/adr.mjs new|lock');
  process.exitCode = 2;
}
