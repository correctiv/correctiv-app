/**
 * The workflow's one call: an issue in, one file written, or a reason out.
 *
 *     npx tsx apps/workbench/scripts/submission-from-issue.ts <title-file> <body-file>
 *
 * Run by `.github/workflows/submission.yml` from the repository root. The title and the
 * body arrive as FILES the workflow wrote with the GitHub API, never as arguments or
 * environment values a shell would expand, which is the injection line the workflow's
 * header draws.
 *
 * On success it writes the kind's file in the working tree, appends `kind` and `file` to
 * `$GITHUB_OUTPUT`, and writes the German summary to `$SUBMISSION_SUMMARY_FILE`. On a
 * refusal it writes the German reason to `$SUBMISSION_ERROR_FILE` and exits 1; the
 * workflow posts that file on the issue. Any other failure is the automation's and
 * writes no reason file, so the issue is told that the fault is not the person's.
 * Both files belong in `$RUNNER_TEMP`, outside the working tree, so nothing in them can
 * be committed by accident.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { applyIssue, Refusal, refusalText } from './submission.ts';

const [titleFile, bodyFile] = process.argv.slice(2);
if (!titleFile || !bodyFile) {
  console.error('usage: submission-from-issue.ts <title-file> <body-file>');
  process.exit(2);
}

const root = process.cwd();

try {
  const applied = applyIssue(
    readFileSync(titleFile, 'utf8'),
    readFileSync(bodyFile, 'utf8'),
    (file) => readFileSync(join(root, file), 'utf8'),
  );
  writeFileSync(join(root, applied.file), applied.content, 'utf8');
  if (process.env.SUBMISSION_SUMMARY_FILE)
    writeFileSync(process.env.SUBMISSION_SUMMARY_FILE, `${applied.summary}\n`, 'utf8');
  else console.log(applied.summary);

  for (const [key, value] of Object.entries({ kind: applied.kind, file: applied.file })) {
    console.log(`${key}=${value}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
} catch (error) {
  if (!(error instanceof Refusal)) throw error;
  const reason = refusalText(error);
  if (process.env.SUBMISSION_ERROR_FILE)
    writeFileSync(process.env.SUBMISSION_ERROR_FILE, reason, 'utf8');
  console.error(`refused: ${error.message}`);
  process.exit(1);
}
