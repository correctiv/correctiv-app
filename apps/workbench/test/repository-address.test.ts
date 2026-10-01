import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ROOT } from '../plugin/collect.ts';

/**
 * The repository's address, after the move from the GitHub organisation
 * `faktenforum` to `correctiv` on 2026-09-17. `adr/README.md`'s tenth note has
 * the full story and is why `adr/` is excluded below: a decision record is never
 * rewritten to look right in hindsight, so the old addresses stay exactly as
 * they were measured, and the note is what tells a reader why.
 *
 * Two patterns, deliberately not the bare word `faktenforum`. That word is also
 * this app's own product — the fact-checking platform: a claims screen at
 * `app/behauptung/[id].tsx`, a route and a message catalogue at
 * `app/faktenforum.tsx`, entries in `projects.ts` and `claims.ts`, an `Overline`,
 * a `SplitRow`, screenshots. A check that matched the word would fail on all of
 * that, so it would need the same kind of exemption list the localisation-seam
 * check carries — and every one of those entries would really be "this is not
 * the thing we are looking for" rather than "this is allowed anyway". Matching
 * only the address avoids needing one at all.
 *
 * `SELF` is this file's own path, quoted rather than read off `import.meta.url`:
 * it names both patterns below in order to look for them, so it is the one file
 * in the walk that would always fail against itself.
 */
const SELF = 'apps/workbench/test/repository-address.test.ts';

describe('the repository is not still found at the old address', () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter(
      (file) =>
        /\.(md|ts|tsx|mts|cts|mjs|cjs|js|jsx|json|css|ya?ml|sh)$/.test(file) &&
        !file.startsWith('adr/') &&
        file !== SELF,
    );

  it('reads enough of the repository to be worth running', () => {
    // A filter that stopped matching, or a `git` that answered nothing, would
    // make both assertions below vacuously true.
    expect(tracked.length).toBeGreaterThan(200);
  });

  it('carries no address built on the dead Pages host', () => {
    // faktenforum.github.io answers 404 today. Every address built on it is
    // dead, and nothing tells a reader why unless this fails first.
    const offenders = tracked.filter((file) =>
      readFileSync(join(ROOT, file), 'utf8').includes('faktenforum.github.io'),
    );
    expect(offenders).toEqual([]);
  });

  it('carries no link into the old GitHub organisation', () => {
    // github.com/faktenforum/correctiv-app still redirects, so this half is not
    // a dead link — but a redirect is somebody else's promise and not this
    // repository's, and the repository should say where it actually lives.
    const OLD_ORG = /(?:github\.com|raw\.githubusercontent\.com)\/faktenforum\/correctiv-app/;
    const offenders = tracked.filter((file) =>
      OLD_ORG.test(readFileSync(join(ROOT, file), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
