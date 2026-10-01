/**
 * The ledger's shape, and the one check that a hand-edit cannot satisfy.
 *
 * `adr/decisions.lock.json` records every text each decision number has ever
 * carried. Everything else that guards it reads the working tree and therefore
 * asks only "is this file self-consistent?", which a careful editor can always
 * answer yes to. This module asks the other question: **is this file an extension
 * of the one on the default branch?** A swap, a deletion, a rewritten history are
 * all revisions of what is already published, and no amount of internal tidiness
 * makes a revision look like an append.
 *
 * A cold review on 2026-09-16 broke the within-tree guards two ways in minutes.
 * It swapped two numbers and swapped their two histories wholesale, so the tool
 * had nothing to add and every test passed: that one is a revision of the
 * published file and `revisions` refuses it. It also swapped two numbers and
 * changed an em dash to a comma in each heading, so the tool recorded two
 * rewordings: that one is an APPEND, and this module does not refuse it. What it
 * guarantees about it is narrower and still worth having — the append is
 * permanent, because taking it back out is a revision, so the ledger carries both
 * texts under both numbers for good and the diff of the commit that did it says
 * so. `normalise` below closes the punctuation-sized version of that trick;
 * nothing closes the version that rewrites the headings properly, and nothing in
 * a repository could.
 *
 * One implementation, imported by `scripts/adr.mjs` and by
 * `apps/workbench/test/decision-numbers.test.ts`. The heading parser is duplicated
 * across those two on purpose — a disagreement between two parsers shows up as a
 * missing or an extra ledger entry, which is a red test. Nothing plays that role
 * for this comparison, so a second implementation of it would be a second thing to
 * get wrong rather than a cross-check.
 */
import { execFileSync } from 'node:child_process';

/** Where the ledger lives, relative to the repository root. */
export const LEDGER_PATH = 'adr/decisions.lock.json';

/** What to do when the file underneath the ledger has gone wrong. */
export const RESTORE_HINT = `Restore it and start again: \`git checkout origin/main -- ${LEDGER_PATH}\`.`;

/** `0022`, and nothing else. A record number is four digits opening with a zero. */
const RECORD_NUMBER = /^0\d{3}$/;

/**
 * A decision number as the ledger may spell it: `1`, `12`, never `0` and never `01`.
 *
 * Deliberately stricter than "a string of digits". `apps/workbench/plugin/markdown.ts`
 * mints no id below 1, so a `## 0. Context` that reached the ledger would be a
 * section the ledger names as a decision and the site does not — which is exactly
 * what happened while the two parsers disagreed and nothing walked the ledger back
 * to the records.
 */
const DECISION_NUMBER = /^[1-9]\d{0,2}$/;

/**
 * A heading with its punctuation, spacing and case taken off.
 *
 * `Mechanism 1 — make it a type error` and `Mechanism 1, make it a type error`
 * are the same decision, and the difference between them is the cheapest way to
 * disguise a swap as two rewords: swap two numbers, change one character in each
 * heading, and the tool records two rewordings because neither new text is equal
 * to any old one. Comparing on this instead closes the punctuation-sized version
 * of that trick, exactly and with no fuzzy matching.
 *
 * It closes that version and no other. A swap whose headings are genuinely
 * rewritten has nothing left in it for an equality test to find, and is caught by
 * nothing here — see `revisions` for what is left standing in that case, which is
 * that the swap cannot be performed without leaving both texts in the ledger for
 * good.
 */
export function normalise(text) {
  return text.toLowerCase().replaceAll(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Reads the ledger, or says what is wrong with it in words.
 *
 * Every earlier version of this threw whatever `JSON.parse` or a property access
 * threw, so a truncated file, an empty one, a `null` and an entry missing its
 * `decisions` all arrived as a raw stack trace naming a line number in a tool the
 * reader did not write. The ledger is also the one file in the repository that
 * must never be rebuilt from scratch to make an error go away, so the message has
 * to name the problem and point at the copy on the default branch.
 *
 * @param {string} text The file's contents.
 * @returns {{ ledger: Record<string, { slugs: string[], decisions: Record<string, string[]> }>, problems: string[] }}
 *   `problems` empty means the ledger is usable; otherwise it is not, and `ledger`
 *   is whatever could be salvaged and should not be written back.
 */
export function readLedger(text) {
  const problems = [];
  if (text.trim() === '') {
    return { ledger: {}, problems: [`${LEDGER_PATH} is empty.`] };
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ledger: {}, problems: [`${LEDGER_PATH} is not valid JSON: ${error.message}`] };
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    const held = raw === null ? 'null' : Array.isArray(raw) ? 'a list' : `a ${typeof raw}`;
    return { ledger: {}, problems: [`${LEDGER_PATH} holds ${held}, not an object of records.`] };
  }

  /** @type {Record<string, { slugs: string[], decisions: Record<string, string[]> }>} */
  const ledger = {};
  for (const [number, entry] of Object.entries(raw)) {
    if (!RECORD_NUMBER.test(number)) {
      problems.push(
        `"${number}" is not a record number; a record number is four digits, e.g. 0022.`,
      );
      continue;
    }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`${number} is not an object.`);
      continue;
    }
    if ('slug' in entry && !('slugs' in entry)) {
      // The single-slug spelling this file used until a rename stopped being
      // visible in a diff. Named rather than silently migrated: a tool that
      // rewrites the ledger's shape on the way past is a tool that can rewrite
      // anything else on the way past.
      problems.push(
        `${number} carries \`slug\`, which the ledger no longer uses. A record's slug is a history now, ` +
          `\`"slugs": ["${String(entry.slug)}"]\`, so renaming the file appends rather than overwrites.`,
      );
      continue;
    }
    if (!Array.isArray(entry.slugs) || entry.slugs.length === 0) {
      problems.push(
        `${number} has no \`slugs\` list. It names which document the number points at.`,
      );
      continue;
    }
    if (entry.slugs.some((slug) => typeof slug !== 'string' || slug === '')) {
      problems.push(`${number}'s \`slugs\` holds something that is not a slug.`);
      continue;
    }
    if (
      entry.decisions === null ||
      typeof entry.decisions !== 'object' ||
      Array.isArray(entry.decisions)
    ) {
      problems.push(`${number} has no \`decisions\` object.`);
      continue;
    }

    /** @type {Record<string, string[]>} */
    const decisions = {};
    let sound = true;
    for (const [n, history] of Object.entries(entry.decisions)) {
      if (!DECISION_NUMBER.test(n)) {
        problems.push(
          `${number} §${n} is not a decision number. They start at 1 and carry no leading zero, ` +
            `which is what \`decisionNumber\` in apps/workbench/plugin/markdown.ts mints.`,
        );
        sound = false;
        continue;
      }
      if (!Array.isArray(history) || history.length === 0) {
        problems.push(
          `${number} §${n} has no history. An entry is the list of texts it has carried.`,
        );
        sound = false;
        continue;
      }
      if (history.some((entryText) => typeof entryText !== 'string')) {
        problems.push(`${number} §${n}'s history holds something that is not a heading.`);
        sound = false;
        continue;
      }
      decisions[n] = [...history];
    }
    if (!sound) continue;
    ledger[number] = { slugs: [...entry.slugs], decisions };
  }

  return { ledger, problems };
}

/**
 * The ledger as the default branch holds it, or why it could not be read.
 *
 * `read` is the case worth having: there is a published ledger and the working
 * tree has to extend it. `absent` is the pull request that introduces the file,
 * which is a real state and not a pass — it says the strongest check in here had
 * nothing to compare against. `unavailable` is a checkout without `origin/main`,
 * which a shallow CI clone produces and which must never read as agreement.
 *
 * @param {string} root The repository root.
 * @returns {{ state: 'read', text: string } | { state: 'absent' | 'unavailable', reason: string }}
 */
export function baselineLedger(root) {
  const git = (args) =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      timeout: 15_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  try {
    git(['rev-parse', '--verify', '--quiet', 'origin/main^{commit}']);
  } catch {
    return {
      state: 'unavailable',
      reason:
        'origin/main is not in this checkout, so the ledger could not be compared with the one on ' +
        'the default branch. `git fetch --depth=1 origin +main:refs/remotes/origin/main` gives it one.',
    };
  }

  let listed;
  try {
    listed = git(['ls-tree', '--name-only', 'origin/main', LEDGER_PATH]).trim();
  } catch (error) {
    return { state: 'unavailable', reason: `git could not read origin/main: ${error.message}` };
  }
  if (listed === '') {
    return {
      state: 'absent',
      reason: `${LEDGER_PATH} is not on origin/main yet, so there is no published ledger to extend.`,
    };
  }

  try {
    return { state: 'read', text: git(['show', `origin/main:${LEDGER_PATH}`]) };
  } catch (error) {
    return {
      state: 'unavailable',
      reason: `git could not read origin/main:${LEDGER_PATH}: ${error.message}`,
    };
  }
}

/** A list is a prefix of another when the longer one only grew at the end. */
function isPrefix(before, after) {
  return before.length <= after.length && before.every((item, i) => item === after[i]);
}

/**
 * Everything the working tree's ledger revised rather than extended.
 *
 * Append-only, spelled out: a record the published ledger holds is still there, a
 * number it holds is still there, and every history it holds is a *prefix* of the
 * history now. Growth at the end is the whole of what this permits. A reword
 * appends a line and passes; a swap has to put an old text somewhere it was not,
 * which breaks a prefix wherever it lands.
 *
 * Nothing here looks at what is new. A record added, a number added, a text
 * appended are the ordinary direction and are the within-tree checks' business.
 *
 * @returns {string[]} One line per revision, empty when the ledger only grew.
 */
export function revisions(before, after) {
  const published = Object.keys(before);
  const gone = published.filter((number) => after[number] === undefined);
  // A ledger emptied or replaced wholesale is one mistake, not thirty-six. The
  // version that listed every record separately printed the same sentence down
  // the screen and buried what had actually happened.
  if (gone.length === published.length && published.length > 1) {
    return [
      `Every record is gone from the ledger, all ${published.length} of them, which is not an edit ` +
        `to it but a replacement of it. The published ledger is the history of every decision ` +
        `number in the repository and there is no rebuilding it from the records: the records are ` +
        `what it exists to be independent of.`,
    ];
  }

  const found = [];
  for (const [number, was] of Object.entries(before)) {
    const now = after[number];
    if (now === undefined) {
      found.push(
        `ADR ${number} is gone from the ledger. A record that is deleted keeps its entry, because ` +
          `the number is cited elsewhere and this is what stops it being handed to something else.`,
      );
      continue;
    }
    if (!isPrefix(was.slugs, now.slugs)) {
      found.push(
        `ADR ${number}'s slugs were rewritten.\n    on origin/main: ${was.slugs.join(' → ')}\n    here:           ${now.slugs.join(' → ')}`,
      );
    }
    for (const [n, history] of Object.entries(was.decisions)) {
      const current = now.decisions[n];
      if (current === undefined) {
        found.push(
          `ADR ${number} §${n} is gone from the ledger. A decision that is removed leaves its number ` +
            `behind as a gap, and the gap is the entry.`,
        );
        continue;
      }
      if (!isPrefix(history, current)) {
        found.push(
          `ADR ${number} §${n}'s history was rewritten, not extended.` +
            `\n    on origin/main: ${history.map((text) => JSON.stringify(text)).join(', ')}` +
            `\n    here:           ${current.map((text) => JSON.stringify(text)).join(', ')}`,
        );
      }
    }
  }
  return found;
}

/**
 * What to say when a ledger revises the published one.
 *
 * Kept here so the tool and the test say the same thing, and because the sentence
 * matters: the reader has almost certainly just moved a number and is about to
 * look for the edit that makes the complaint go away.
 */
export const REVISION_GUIDANCE =
  'The ledger on origin/main is the published history of every decision number, and this working ' +
  'tree revises it. Adding a record, a number or a reworded heading is the ordinary direction and ' +
  'is not this. Editing, reordering or deleting what is already there is how a renumbering is made ' +
  'to look consistent, which is the one thing the ledger exists to refuse. One innocent reading: a ' +
  'branch that has not merged origin/main is missing whatever landed there since, and every ' +
  'missing entry below would be a record it has simply not seen. Merge main and look again.';
