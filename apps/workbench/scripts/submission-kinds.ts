/**
 * The table of submission kinds, and the two calls the workflow makes over it.
 *
 * [ADR 0061](../../../adr/0061-a-submission-is-an-issue-and-ci-makes-the-pull-request.md)
 * §3: each kind maps to what applies it, in a table typed over the kinds, so a kind
 * without an entry is a compile error. [ADR 0062](../../../adr/0062-the-texts-submission-may-change-wordings-and-nothing-else.md)
 * §2 adds the second column: what a kind may change, and the proof that it changed only
 * that. `./submission.ts` is the home kind and the reading of the issue, and
 * `./submission-strings.ts` is the strings kind; this file joins them, so that neither
 * has to import the other.
 */
import { CATALOGUE_FILE } from '../plugin/catalogue.ts';
import { SUBMISSION_KINDS, type SubmissionKind } from '../src/preview/submission.ts';
import {
  applyStrings,
  verifyStrings,
  type Change,
  type Repo,
  type Tree,
} from './submission-strings.ts';
import { applyHome, readSubmission, Refusal } from './submission.ts';

export type { Change, Repo, Tree } from './submission-strings.ts';

export interface Applied {
  /** Every file written, by repository path, which is the kind's own and never the issue's. */
  files: { path: string; content: string }[];
  /** What changed, as Markdown in German, for the pull request's body. */
  summary: string;
  /**
   * Whether the workflow runs the formatter over the files. The home kind prints its file
   * as oxfmt would, and the workflow then only checks it; the strings kind replaces a
   * literal in a file oxfmt owns the line breaks of, as the dev server's save does.
   */
  format: boolean;
}

/** Turns a payload into the files it becomes, given the repository as it is. */
export type Apply = (payload: string, repo: Repo) => Applied;

/** What is wrong with the working tree the run left, given the issue's payload. */
export type Verify = (payload: string, changes: readonly Change[], tree: Tree) => string[];

interface KindEntry {
  apply: Apply;
  verify: Verify;
}

/**
 * Kind to what applies it and what proves it. `null` is a kind that is named and not
 * built, and the type makes a kind without an entry here a compile error rather than a
 * silent skip.
 */
export const KINDS: Readonly<Record<SubmissionKind, KindEntry | null>> = {
  home: {
    apply: (payload, repo) => {
      const { file, content, summary } = applyHome(payload, repo.read(SUBMISSION_KINDS.home.file));
      return { files: [{ path: file, content }], summary, format: false };
    },
    // One file, the kind's own, modified: the assertion the workflow made in shell before
    // the strings kind needed more than one file.
    verify: (_payload, changes) =>
      changes.length === 1 &&
      changes[0]!.status === ' M' &&
      changes[0]!.path === SUBMISSION_KINDS.home.file
        ? []
        : [`expected exactly ${SUBMISSION_KINDS.home.file} to change, not ${describe(changes)}`],
  },
  strings: {
    apply: (payload, repo) => ({ ...applyStrings(payload, repo), format: true }),
    verify: verifyStrings,
  },
};

function describe(changes: readonly Change[]): string {
  return changes.length === 0
    ? 'nothing'
    : changes
        .map((change) => `${JSON.stringify(change.status)} ${JSON.stringify(change.path)}`)
        .join(', ');
}

/**
 * Whether a kind may write `path` at all. The write checks it before it touches the disk,
 * so a bug in a kind's apply cannot put a file anywhere else; the verify holds the tree
 * to the same test afterwards.
 */
export function mayWrite(kind: SubmissionKind, path: string): boolean {
  return kind === 'home' ? path === SUBMISSION_KINDS.home.file : CATALOGUE_FILE.test(path);
}

function entryFor(kind: SubmissionKind): KindEntry {
  const entry = KINDS[kind];
  if (!entry) throw new Refusal('kind-not-built');
  return entry;
}

/** The whole path from issue to files, for the workflow's first call. */
export function applyIssue(title: string, body: string, repo: Repo) {
  const { kind, payload } = readSubmission(title, body);
  const applied = entryFor(kind).apply(payload, repo);
  for (const { path } of applied.files)
    if (!mayWrite(kind, path)) throw new Error(`the ${kind} kind may not write ${path}`);
  return { kind, ...applied };
}

/**
 * The proof, for the workflow's second call: which files may be committed, or what is
 * wrong. Reads the issue again, and never trusts what the first call reported.
 */
export function verifyIssue(
  title: string,
  body: string,
  changes: readonly Change[],
  tree: Tree,
): { kind: SubmissionKind; files: string[]; problems: string[] } {
  const { kind, payload } = readSubmission(title, body);
  const problems = entryFor(kind).verify(payload, changes, tree);
  for (const { path } of changes)
    if (!mayWrite(kind, path)) problems.push(`the ${kind} kind may not change ${path}`);
  return { kind, files: changes.map((change) => change.path).sort(), problems };
}

/**
 * `git status --porcelain=v1 -z --untracked-files=all`, read. `-z` so that no path is
 * quoted or escaped; a rename or copy carries its old path as a second field, which is
 * read and dropped, since either one is refused by every kind.
 */
export function parsePorcelain(output: string): Change[] {
  const fields = output.split('\0');
  const changes: Change[] = [];
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]!;
    if (field === '') continue;
    const status = field.slice(0, 2);
    changes.push({ status, path: field.slice(3) });
    if (status[0] === 'R' || status[0] === 'C') i++;
  }
  return changes;
}
