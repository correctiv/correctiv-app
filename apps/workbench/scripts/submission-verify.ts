/**
 * The workflow's second call: prove that the working tree holds what the issue asked for
 * and nothing else, and name the files that may be committed.
 *
 *     npx tsx apps/workbench/scripts/submission-verify.ts <title-file> <body-file> <list-file>
 *
 * Run by `.github/workflows/submission.yml` after `./submission-from-issue.ts` and the
 * formatter, and before the commit. It replaces the shell step that asserted exactly one
 * changed file, which the strings kind outgrew (ADR 0062 §2): it reads the issue again,
 * asks git what changed, and holds that to the kind's own proof in
 * `./submission-kinds.ts`. On success it writes the files to commit into `<list-file>`,
 * separated by NUL, for `git add --pathspec-from-file --pathspec-file-nul`; on any
 * problem it prints them and exits 1 without writing it, so nothing can be committed.
 *
 * It writes no reason file. The person's submission passed the first call; a tree that
 * fails here is the automation disagreeing with itself, and the issue is told that the
 * fault is not theirs.
 *
 * git runs without a shell and with fixed arguments. The one argument built from a path,
 * `HEAD:<path>`, is only built for a catalogue file out of a directory listing, never out
 * of the issue.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { parsePorcelain, verifyIssue } from './submission-kinds.ts';

const [titleFile, bodyFile, listFile] = process.argv.slice(2);
if (!titleFile || !bodyFile || !listFile) {
  console.error('usage: submission-verify.ts <title-file> <body-file> <list-file>');
  process.exit(2);
}

const root = process.cwd();
const git = (args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });

const changes = parsePorcelain(git(['status', '--porcelain=v1', '-z', '--untracked-files=all']));
const { kind, files, problems } = verifyIssue(
  readFileSync(titleFile, 'utf8'),
  readFileSync(bodyFile, 'utf8'),
  changes,
  {
    before: (path) => git(['show', `HEAD:${path}`]),
    after: (path) => readFileSync(join(root, path), 'utf8'),
    list: (dir) => readdirSync(join(root, dir)),
  },
);

// Quoted: a path is printed as JSON, so no line of it can start a workflow command.
for (const change of changes)
  console.log(`${JSON.stringify(change.status)} ${JSON.stringify(change.path)}`);
if (problems.length > 0) {
  for (const problem of problems) console.log(`::error::${problem}`);
  process.exit(1);
}
writeFileSync(listFile, files.map((file) => `${file}\0`).join(''), 'utf8');
console.log(`${kind}: ${files.length} file(s) proven`);
