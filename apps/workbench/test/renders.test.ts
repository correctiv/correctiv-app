import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../plugin/collect.ts';
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
 * The third assertion — "the browser logged no error" — and the one class of
 * error that is a request rather than a fault.
 *
 * Vite re-optimises its dependency graph when a module pulls in a package it has
 * not seen, and the request already in flight comes back `504 (Outdated Optimize
 * Dep)`. The browser reloads and gets a good bundle; nothing is broken. Collected
 * as a console error it failed a page that had rendered correctly, and the pull
 * request it failed was one whose only real change was a new stylesheet import —
 * which is exactly the kind of change that provokes the re-optimise. The re-run
 * passed on the same commit.
 *
 * So the notice is separated from the faults, and this holds both ends: it is
 * recognised, and it is recognised ONLY as the pair. A 504 on its own is a proxy
 * timeout or a dead upstream and must still fail, and so must any other wording
 * of "outdated optimize dep" without the status — the text alone would swallow a
 * real "that request never arrived" if the server ever phrased it the same way.
 */
describe('the dependency-reload notice, which is not a fault', () => {
  it('separates it from the faults rather than dropping it', () => {
    expect(RENDERS).toContain('isReloadNotice');
    // Both lists, and the notice one is never read as a fault.
    expect(RENDERS).toContain('const notices = []');
    expect(RENDERS).toContain('if (isReloadNotice(text)) notices.push(text)');
    expect(RENDERS).toContain('else faults.push(text)');
  });

  it('matches the wording AND the status, so a real 504 still fails', () => {
    expect(RENDERS).toMatch(/Outdated Optimize Dep/i);
    expect(RENDERS).toMatch(/\\b504\\b/);
    // Every fault is written inside the one predicate that decides. A
    // `faults.push` left anywhere else is the bug this assertion exists for, and
    // it is the only direct `faults.push` in the file — `code()` strips comments,
    // so the word inside this file's own prose cannot satisfy it either way.
    expect(code(RENDERS).match(/faults\.push\(/g) ?? []).toHaveLength(1);
    expect(code(RENDERS)).toMatch(/else faults\.push\(text\)/);
  });

  it('reports it when it happened instead of passing in silence', () => {
    expect(RENDERS).toContain('notices.length > 0');
  });
});
