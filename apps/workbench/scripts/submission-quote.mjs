/**
 * The quote a maintainer approves: an outsider's issue, as the automation read it, in a
 * comment the outsider cannot edit.
 *
 * [ADR 0062](../../../adr/0062-the-texts-submission-may-change-wordings-and-nothing-else.md)
 * §7. An outsider's issue does not run by itself (ADR 0061 §4). The first version bound a
 * maintainer's manual run to the SHA-256 of the issue body as it was when the issue was
 * OPENED, and the run applied whatever the body said at the moment it ran as long as the
 * hash matched. The cold review of #263 found the gap: open with one text, edit to a
 * harmless one, let the maintainer read that and start the run with the hash the bot had
 * printed, edit back before the run fetches the issue. The hash matched, and the run
 * applied a text the maintainer never saw.
 *
 * So the bot now QUOTES the title and the body in its comment, and prints the hash of
 * exactly that quote. The maintainer reads the comment, not the issue, and the manual run
 * takes its title and body out of the comment whose quote has the hash it was given.
 * An issue edited afterwards changes nothing about what runs; a new text needs a new issue.
 *
 * Plain JavaScript with no dependency, because the job that writes the comment has no
 * install: it checks out this one file and imports it. The pull-request job imports the
 * same file to read the quote back, and `test/submission-quote.test.ts` holds the two
 * directions to each other.
 */
import { createHash } from 'node:crypto';

/** What starts every comment the automation writes to be approved, and only those. */
export const MARK = '<!-- submission:outsider -->';

/** Who may have written a comment whose quote a run takes. */
export const BOT_LOGIN = 'github-actions[bot]';

/**
 * The most a quoting comment may be. GitHub refuses a comment over 65,536 characters;
 * a text that does not fit cannot be quoted, and so cannot be approved.
 */
export const COMMENT_MAX = 60_000;

/** Line ends as one character, the way the reader of the issue reads them too. */
function lines(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n');
}

/** The title and the body as the quote holds them. */
export function normalise({ title, body }) {
  return { title: lines(title), body: lines(body) };
}

/** The SHA-256 of a title and a body together, as hex. */
export function digest(issue) {
  const { title, body } = normalise(issue);
  return createHash('sha256')
    .update(JSON.stringify([title, body]), 'utf8')
    .digest('hex');
}

/** A fence longer than any run of backticks in the text, so the text cannot close it. */
function fenceFor(text) {
  const longest = Math.max(0, ...[...text.matchAll(/`+/g)].map((run) => run[0].length));
  return '`'.repeat(Math.max(3, longest + 1));
}

function block(label, text) {
  const fence = fenceFor(text);
  return [`${label}:`, '', `${fence}text`, text, fence];
}

/**
 * The comment for an outsider's issue: what happens next, the hash to start it with, and
 * the title and the body in code blocks, where GitHub renders every character as itself
 * and acts on none of them. `null` when the quote would not fit in a comment.
 */
export function quoteComment(issue) {
  const { title, body } = normalise(issue);
  const comment = [
    MARK,
    'Danke für die Einreichung.',
    '',
    'Aus Issues von außerhalb der Organisation wird nicht von selbst ein Pull Request. Ein Maintainer kann das starten, nachdem er Titel und Text **in diesem Kommentar** gelesen hat: unter „Actions“, Workflow „Submission“, „Run workflow“, mit der Nummer dieses Issues und diesem Wert für `text_sha256`:',
    '',
    '`' + digest({ title, body }) + '`',
    '',
    'Gestartet wird genau der Text unten, auch wenn das Issue danach bearbeitet wird. Für einen anderen Text öffnen Sie bitte ein neues Issue.',
    '',
    ...block('Titel', title),
    '',
    ...block('Text', body),
  ].join('\n');
  return comment.length > COMMENT_MAX ? null : comment;
}

/** The comment when the text is too long to quote. */
export function tooLongComment() {
  return [
    MARK,
    'Danke für die Einreichung.',
    '',
    'Aus Issues von außerhalb der Organisation wird nicht von selbst ein Pull Request, und dieses ist zu lang, um es hier für eine Freigabe zu zitieren. Bitte teilen Sie die Änderung auf mehrere Issues auf.',
  ].join('\n');
}

/** One labelled block out of a comment, from its label line on, or null. */
function readBlock(rows, from, label) {
  const at = rows.indexOf(`${label}:`, from);
  if (at < 0 || rows[at + 1] !== '') return null;
  const open = /^(`{3,})text$/.exec(rows[at + 2] ?? '');
  if (!open) return null;
  const fence = open[1];
  const end = rows.indexOf(fence, at + 3);
  if (end < 0) return null;
  return { text: rows.slice(at + 3, end).join('\n'), next: end + 1 };
}

/**
 * The title and the body a comment quotes, or null for any comment that is not one of
 * these, exactly as `quoteComment` wrote it.
 */
export function unquoteComment(comment) {
  const text = lines(comment);
  if (!text.startsWith(`${MARK}\n`)) return null;
  const rows = text.split('\n');
  const title = readBlock(rows, 0, 'Titel');
  if (!title) return null;
  const body = readBlock(rows, title.next, 'Text');
  if (!body || body.next !== rows.length) return null;
  const issue = { title: title.text, body: body.text };
  // Only a comment that is exactly what `quoteComment` would write for this text: a
  // maintainer who edited the bot's comment has not approved what it now says.
  return quoteComment(issue) === text ? issue : null;
}

/**
 * Among an issue's comments, the text whose quote has `sha`, from a comment the
 * automation wrote, or null.
 */
export function approved(comments, sha) {
  const wanted = String(sha ?? '')
    .trim()
    .toLowerCase();
  for (const comment of comments) {
    if (comment?.user?.login !== BOT_LOGIN || comment?.user?.type !== 'Bot') continue;
    const issue = unquoteComment(comment.body ?? '');
    if (issue && digest(issue) === wanted) return issue;
  }
  return null;
}
