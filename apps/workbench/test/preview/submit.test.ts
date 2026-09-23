import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { REPO, ROOT } from '../../plugin/collect.ts';
import { HOME_LAYOUT_FILE, SHIPPED } from '../../src/preview/home/document';
import { copyForSubmit, SUBMIT_URL } from '../../src/preview/home/write';

/**
 * Submit changes (ADR 0058 §2) ends on github.com, so the address is the whole of what the
 * workbench contributes and the one thing here that can quietly point at nothing.
 */
describe('where Submit changes sends a person', () => {
  it('is GitHub’s editor for the document, on the branch the site is published from', () => {
    expect(SUBMIT_URL).toBe(`${REPO}/edit/main/${HOME_LAYOUT_FILE}`);
  });

  /*
   * The failure this exists for is a move of the file done in one place: the dev server's
   * Save would then write a new file beside the old one's absence, and Submit would open an
   * editor on a path that has gone. Both read HOME_LAYOUT_FILE, so asking the disk once
   * covers both.
   */
  it('names a file the repository actually has', () => {
    expect(existsSync(join(ROOT, HOME_LAYOUT_FILE))).toBe(true);
  });

  it('answers false rather than throwing where there is no clipboard', async () => {
    // Node has a `navigator` and no `navigator.clipboard`, which is the refused case.
    await expect(copyForSubmit(SHIPPED)).resolves.toBe(false);
  });
});
