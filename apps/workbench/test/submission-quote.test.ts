import { describe, expect, it } from 'vitest';

import {
  approved,
  BOT_LOGIN,
  COMMENT_MAX,
  digest,
  MARK,
  quoteComment,
  unquoteComment,
} from '../scripts/submission-quote.mjs';
import { readSubmission } from '../scripts/submission.ts';
import { stringsPayload } from '../src/preview/strings/submit.ts';
import { issueFor } from '../src/preview/submission.ts';

/**
 * ADR 0062 §7: what a maintainer approves is the text the automation quoted, and the run
 * takes that text out of the quote. The cold review of #263 found the version before it
 * bound the approval to the text at "opened" and applied the text at "now".
 */

const BOT = { login: BOT_LOGIN, type: 'Bot' };

function issueOf(wordings: Record<string, string>) {
  return issueFor('strings', stringsPayload(wordings), {
    heading: 'Änderungen an den Texten der App',
    lead: 'Aus der Workbench.',
  });
}

describe('the quote', () => {
  it('reads back exactly the title and the body it quoted', () => {
    const issue = issueOf({ 'home.viewAll': 'Alle zeigen' });
    const comment = quoteComment(issue)!;
    expect(comment.startsWith(MARK)).toBe(true);
    expect(comment).toContain(`\`${digest(issue)}\``);
    expect(unquoteComment(comment)).toEqual(issue);
  });

  it('cannot be closed by the text it quotes', () => {
    const issue = {
      title: '[texte] ```` hier',
      body: 'Vorher\n````text\nTitel:\n\n```text\nnicht der Titel\n```\n`````\nNachher\n',
    };
    const back = unquoteComment(quoteComment(issue)!);
    expect(back).toEqual(issue);
  });

  it('binds the title as well as the body', () => {
    const issue = issueOf({ 'home.viewAll': 'Alle zeigen' });
    expect(digest({ ...issue, title: '[startseite] Anders' })).not.toBe(digest(issue));
    expect(digest({ ...issue, body: `${issue.body} ` })).not.toBe(digest(issue));
  });

  it('reads line ends as the reader of the issue does', () => {
    const issue = issueOf({ 'home.viewAll': 'Alle zeigen' });
    const pasted = { ...issue, body: issue.body.replace(/\n/g, '\r\n') };
    expect(digest(pasted)).toBe(digest(issue));
    expect(unquoteComment(quoteComment(pasted)!)).toEqual(issue);
  });

  it('refuses to quote what would not fit in a comment', () => {
    expect(quoteComment({ title: '[texte] x', body: 'x'.repeat(COMMENT_MAX) })).toBeNull();
  });

  it('is not read back from a comment that differs from what it would write', () => {
    const issue = issueOf({ 'home.viewAll': 'Alle zeigen' });
    const comment = quoteComment(issue)!;
    expect(unquoteComment(comment.replace('Alle zeigen', 'Alles weg'))).toBeNull();
    expect(unquoteComment(`${comment}\nNoch etwas.`)).toBeNull();
    expect(unquoteComment(comment.slice(MARK.length))).toBeNull();
  });
});

describe('what a manual run takes', () => {
  const malicious = issueOf({ 'home.viewAll': 'Böse' });
  const harmless = issueOf({ 'home.viewAll': 'Alle zeigen' });

  it('runs the text the automation quoted, whatever the issue says by then', () => {
    // Opened with the harmless text, which the automation quotes. The maintainer reads the
    // quote and starts the run with its value. The author edits the issue to the other
    // text before the run starts: the run still gets the quoted text.
    const comments = [{ user: BOT, body: quoteComment(harmless) }];
    expect(approved(comments, digest(harmless))).toEqual(harmless);
    expect(approved(comments, digest(malicious))).toBeNull();
  });

  it('never runs a text it did not quote, the review’s sequence included', () => {
    // Opened with the malicious text, which is what the automation quotes; edited to the
    // harmless one; the maintainer reads the issue rather than the quote and passes the
    // harmless text's value. Nothing the automation wrote has that value.
    const comments = [{ user: BOT, body: quoteComment(malicious) }];
    expect(approved(comments, digest(harmless))).toBeNull();
    // And with the quote's own value, what runs is what the quote shows.
    expect(approved(comments, digest(malicious))).toEqual(malicious);
  });

  it('reads only the automation’s own comments', () => {
    const body = quoteComment(harmless);
    for (const user of [
      { login: 'someone', type: 'User' },
      { login: BOT_LOGIN, type: 'User' },
      { login: 'other[bot]', type: 'Bot' },
    ])
      expect(approved([{ user, body }], digest(harmless))).toBeNull();
    expect(approved([{ user: BOT, body }], ` ${digest(harmless).toUpperCase()}\n`)).toEqual(
      harmless,
    );
  });

  it('quotes a body the reader then takes the payload from', () => {
    const back = approved([{ user: BOT, body: quoteComment(harmless) }], digest(harmless))!;
    expect(readSubmission(back.title, back.body).payload).toBe(
      `${stringsPayload({ 'home.viewAll': 'Alle zeigen' })}\n`,
    );
  });
});
