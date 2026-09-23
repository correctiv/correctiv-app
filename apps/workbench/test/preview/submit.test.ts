import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { createIntl } from 'react-intl';
import { describe, expect, it } from 'vitest';

import { REPO, ROOT } from '../../plugin/collect.ts';
import { de } from '../../src/i18n/catalogue/de';
import { HOME_LAYOUT_FILE, SHIPPED, withHidden } from '../../src/preview/home/document';
import { copyNow, submission } from '../../src/preview/home/write';
import {
  issueAddress,
  issueFor,
  kindOfTitle,
  SUBMISSION_ADDRESS_LIMIT,
  SUBMISSION_KINDS,
} from '../../src/preview/submission';

/**
 * Submit changes (ADR 0061 §1) ends on github.com, so the address is the whole of what the
 * workbench contributes and the one thing here that can quietly point at nothing, or at
 * a page GitHub refuses.
 */
const intl = createIntl({ locale: 'de', defaultLocale: 'en', messages: de });
const format = (
  message: Parameters<typeof intl.formatMessage>[0],
  values?: Record<string, string>,
) => intl.formatMessage(message, values);

const EDITED = withHidden(SHIPPED, null, 'hero', true);

describe('where Submit changes sends a person', () => {
  it('is a new issue on this repository, titled with the home kind’s prefix', () => {
    const { href, fits } = submission(EDITED, format);
    expect(fits).toBe(true);
    const url = new URL(href);
    expect(`${url.origin}${url.pathname}`).toBe(`${REPO}/issues/new`);
    const title = url.searchParams.get('title') ?? '';
    expect(kindOfTitle(title)).toBe('home');
    expect(title).toBe('[startseite] Änderungen an der Startseite');
  });

  it('carries the document exactly as Save would write it, in the one fenced block', () => {
    const { href, body } = submission(EDITED, format);
    expect(new URL(href).searchParams.get('body')).toBe(body);
    const fenced = /```json\n([\s\S]*?)```/.exec(body);
    expect(fenced?.[1]).toBeDefined();
    expect(JSON.parse(fenced?.[1] ?? '')).toMatchObject({ version: SHIPPED.version });
  });

  /*
   * The kind's file is where the workflow writes. A move of the file done in one place would
   * leave the workflow writing a path that has gone, and the dev server's Save writing a
   * new file beside it. Both read HOME_LAYOUT_FILE, so asking the disk once covers both.
   */
  it('names a file the repository actually has', () => {
    expect(SUBMISSION_KINDS.home.file).toBe(HOME_LAYOUT_FILE);
    expect(existsSync(join(ROOT, HOME_LAYOUT_FILE))).toBe(true);
  });
});

describe('an address too long for GitHub', () => {
  const issue = issueFor('home', `{"filler":"${'x'.repeat(SUBMISSION_ADDRESS_LIMIT)}"}`, {
    heading: 'Heading',
    lead: 'Lead.',
  });

  it('keeps the title and carries the help sentence in place of the body', () => {
    const { href, fits } = issueAddress(REPO, issue, 'Paste it here.');
    expect(fits).toBe(false);
    expect(href.length).toBeLessThanOrEqual(SUBMISSION_ADDRESS_LIMIT);
    const url = new URL(href);
    expect(url.searchParams.get('title')).toBe(issue.title);
    expect(url.searchParams.get('body')).toBe('Paste it here.');
  });

  it('fits right up to the limit, and not one character past it', () => {
    const base = `${REPO}/issues/new?title=${encodeURIComponent('t')}&body=`;
    const room = SUBMISSION_ADDRESS_LIMIT - base.length;
    expect(issueAddress(REPO, { title: 't', body: 'a'.repeat(room) }, 'h').fits).toBe(true);
    expect(issueAddress(REPO, { title: 't', body: 'a'.repeat(room + 1) }, 'h').fits).toBe(false);
  });

  it('answers false rather than throwing where there is no clipboard', () => {
    // Node has no `document` in this suite, which is the refused case.
    expect(copyNow('text')).toBe(false);
  });
});
