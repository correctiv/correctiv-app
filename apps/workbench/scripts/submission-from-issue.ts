/**
 * The workflow's first call: an issue in, the kind's files written, or a reason out.
 *
 *     npx tsx apps/workbench/scripts/submission-from-issue.ts <title-file> <body-file>
 *
 * Run by `.github/workflows/submission.yml` from the repository root. The title and the
 * body arrive as FILES the workflow wrote with the GitHub API, never as arguments or
 * environment values a shell would expand, which is the injection line the workflow's
 * header draws.
 *
 * On success it writes the kind's files in the working tree, runs the repository's own
 * oxfmt over them where the kind asks for it (the strings kind, as the dev server's save
 * does), appends `kind` to `$GITHUB_OUTPUT`, and writes the German summary to
 * `$SUBMISSION_SUMMARY_FILE`. It commits nothing and names nothing to commit: the
 * workflow's second call, `./submission-verify.ts`, decides that from the tree itself.
 * On a refusal it writes the German reason to `$SUBMISSION_ERROR_FILE` and exits 1; the
 * workflow posts that file on the issue. Any other failure is the automation's and
 * writes no reason file, so the issue is told that the fault is not the person's.
 * Both files belong in `$RUNNER_TEMP`, outside the working tree, so nothing in them can
 * be committed by accident.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { applyIssue } from './submission-kinds.ts';
import { Refusal, refusalText } from './submission.ts';

const [titleFile, bodyFile] = process.argv.slice(2);
if (!titleFile || !bodyFile) {
  console.error('usage: submission-from-issue.ts <title-file> <body-file>');
  process.exit(2);
}

const root = process.cwd();

try {
  const applied = applyIssue(readFileSync(titleFile, 'utf8'), readFileSync(bodyFile, 'utf8'), {
    read: (file) => readFileSync(join(root, file), 'utf8'),
    list: (dir) => readdirSync(join(root, dir)),
  });
  for (const { path, content } of applied.files) writeFileSync(join(root, path), content, 'utf8');
  // No shell: the paths are arguments, and every one of them passed `mayWrite`.
  if (applied.format)
    execFileSync(
      join(root, 'node_modules/.bin/oxfmt'),
      applied.files.map((file) => file.path),
      { cwd: root, stdio: 'inherit' },
    );
  if (process.env.SUBMISSION_SUMMARY_FILE)
    writeFileSync(process.env.SUBMISSION_SUMMARY_FILE, `${applied.summary}\n`, 'utf8');
  else console.log(applied.summary);

  console.log(`kind=${applied.kind}`);
  for (const { path } of applied.files) console.log(`wrote ${path}`);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `kind=${applied.kind}\n`);
} catch (error) {
  if (!(error instanceof Refusal)) throw error;
  const reason = refusalText(error);
  if (process.env.SUBMISSION_ERROR_FILE)
    writeFileSync(process.env.SUBMISSION_ERROR_FILE, reason, 'utf8');
  console.error(`refused: ${error.message}`);
  process.exit(1);
}
