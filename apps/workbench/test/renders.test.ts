import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../plugin/collect.ts';
import { isReloadNotice } from '../scripts/reload-notice.mjs';
import { code } from './source.ts';

const WORKBENCH = join(ROOT, 'apps/workbench');
const BOUNDARY = readFileSync(join(WORKBENCH, 'src/ui/Boundary.tsx'), 'utf8');
const APP = readFileSync(join(WORKBENCH, 'src/App.tsx'), 'utf8');
const RENDERS = readFileSync(join(WORKBENCH, 'scripts/renders.mjs'), 'utf8');

/**
 * One attribute, written in two files, and the check that fails when they part.
 *
 * `Boundary` wraps the main area only, so a route that throws leaves the header,
 * the rail and the status line in `#root`: elements, words, a title, and every
 * word of it an apology. `scripts/renders.mjs` asking only whether something
 * mounted calls that a rendered workbench and goes green, which is the failure the
 * whole script exists to prevent — so it asks for `data-view-failed` as well, and
 * that name is the seam between a React component and a Node script that nothing
 * but this file holds together. Rename it in one place and the browser check goes
 * quietly back to being green on a broken page.
 *
 * The attribute and not the heading, for the same reason and now for a second one:
 * "This view did not render" is prose, prose gets rewritten, and since the shell
 * follows the language setting it is also TRANSLATED — on a German page the words
 * are not in the markup at all. A check matching on them would go quietly green on
 * a broken page in either case. This asserts the heading is NOT what is matched on,
 * and it reads the heading out of the descriptor's `defaultMessage`, which is where
 * the English lives now.
 *
 * Read as text, which is what `direct.test.ts`, `shell.test.ts` and
 * `environment.test.ts` do and for the same reason: rendering the boundary to ask
 * what it emits would need a DOM and the site's whole toolchain to answer a
 * question about one string.
 */
describe('the seam between the error boundary and the browser check', () => {
  const MARKER = 'data-view-failed';

  it('marks the failed state where a machine can see it', () => {
    // Two halves since the apology became a function component of its own — the
    // class cannot call a hook and the words are formatted now. The marker is on
    // the element that draws the failure, and the class is what hands it the route
    // it names; asking only the first would pass on a `route` that came from
    // nowhere.
    expect(BOUNDARY).toContain(`${MARKER}={route}`);
    expect(code(BOUNDARY)).toMatch(/<Failed\s+route=\{this\.props\.route\}/);
  });

  it('is what the browser check looks for', () => {
    expect(RENDERS).toContain(`[${MARKER}]`);
    expect(RENDERS).toContain(`getAttribute('${MARKER}')`);
  });

  it('does not match on the words the reader sees, which are prose', () => {
    expect(BOUNDARY).toContain('This view did not render');
    expect(code(RENDERS)).not.toContain('This view did not render');
  });

  it('still wraps the main area only, which is why the marker is needed', () => {
    // The moment the boundary wraps the whole shell, a failed route empties
    // `#root` and the first assertion catches it on its own. Until then it does
    // not, and this test is the record of why the second one exists.
    expect(APP).toMatch(/<main[^>]*>\s*<Boundary/);
  });
});

/**
 * A console error that is Vite re-optimising rather than a fault: recognised only
 * as the pair of wording and status, kept apart from the faults, and reported.
 */
describe('the dependency-reload notice, which is not a fault', () => {
  it('is the wording and the status together, and neither alone', () => {
    const vite =
      'Failed to load resource: the server responded with a status of 504 (Outdated Optimize Dep)';
    expect(isReloadNotice(vite)).toBe(true);
    expect(
      isReloadNotice(
        'Failed to load resource: the server responded with a status of 504 (Gateway Timeout)',
      ),
    ).toBe(false);
    expect(isReloadNotice('Outdated Optimize Dep')).toBe(false);
    expect(isReloadNotice('status of 5040 (Outdated Optimize Dep)')).toBe(false);
  });

  it('is the only way out of the faults, and is reported when it happened', () => {
    // The one direct `faults.push` sits in the `else` of that predicate; `code()`
    // strips comments, so prose cannot satisfy it.
    expect(code(RENDERS).match(/faults\.push\(/g) ?? []).toHaveLength(1);
    expect(code(RENDERS)).toMatch(
      /if \(isReloadNotice\(text\)\) notices\.push\(text\);\s*else faults\.push\(text\)/,
    );
    expect(code(RENDERS)).toContain('notices.length > 0');
  });
});
