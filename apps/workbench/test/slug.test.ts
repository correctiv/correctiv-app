import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { collectDocs, ROOT } from '../plugin/collect.ts';
import { decisionNumber } from '../plugin/markdown.ts';
import { FEEDS } from '../content/sources.manifest.ts';
import { feedId, slug } from '../src/lib/slug.ts';
import { filesUnder } from './source.ts';

const WORKBENCH = join(ROOT, 'apps/workbench');

/**
 * The site mints ids in two unrelated places and both call this.
 *
 * They were two functions, and the one on the board dropped every letter outside
 * `a-z0-9`. That is invisible while both sides of an anchor are minted by the
 * same half of the site, which is the situation today: heading ids belong to
 * rendered documents, `row-`/`det-` ids belong to one page that writes both the
 * id and the `href`, and nothing crosses. `src/lib/slug.ts` says why they were
 * merged anyway.
 *
 * So the German case below is not a regression test. It is the assertion that was
 * missing when there were two, and the reason a third cannot quietly appear is
 * the last test here.
 */
describe('the fragment identifier', () => {
  it('keeps the letters of a German heading', () => {
    // The whole difference between the two implementations, in one line: the
    // stricter one returned `ber-uns`, an anchor pointing at nothing, and looked
    // entirely reasonable in the source.
    expect(slug('Über uns')).toBe('über-uns');
    expect(slug('Größe und Maß')).toBe('größe-und-maß');
  });

  it('drops punctuation and collapses the gap it leaves', () => {
    // An em dash separates most headings in `adr/`, and it is punctuation rather
    // than a hyphen, so it goes and the two spaces around it become one break.
    expect(slug('ADR 0022 — Three tiers of colour')).toBe('adr-0022-three-tiers-of-colour');
    // GitHub drops punctuation without a separator, so a full stop between two
    // words runs them together. Right for a heading, wrong for the board's row
    // ids, which is why `Sources.tsx` normalises before it slugs — see the test
    // below, which pins the published spelling.
    expect(slug('CORRECTIV.Schweiz')).toBe('correctivschweiz');
  });

  it('writes nothing a URL fragment has to escape, beyond the letters themselves', () => {
    expect(slug('What `npm run check` covers (and what it does not)')).toBe(
      'what-npm-run-check-covers-and-what-it-does-not',
    );
  });

  it('is what the rendered documents actually carry', () => {
    // Not a second implementation asserted against the first: these ids come out
    // of `renderDoc`, so a heading renderer that stopped calling this would fail
    // here rather than in a comment. The `-n` suffix is the de-duplicator's, and
    // a document with two headings of the same name is ordinary.
    //
    // One exception, and it is deliberate: a decision in `adr/` is addressed by
    // its number, so `### 6. German and English …` is `#6` and not a slug of its
    // words. That is the point of the numbers — a slug dies on the reword a number
    // survives — and `test/decision-numbers.test.ts` holds the other end of it. Every
    // other heading of a record still slugs, which is what the filter below keeps
    // asserting.
    const { module } = collectDocs();
    const wrong = module.docs.flatMap((doc) =>
      doc.headings
        .filter((h) => {
          const numbered = doc.route.startsWith('/decisions/') ? decisionNumber(h.text) : null;
          if (numbered !== null) return h.id !== String(numbered);
          return h.id !== slug(h.text) && !new RegExp(`^${slug(h.text)}-\\d+$`).test(h.id);
        })
        .map((h) => `${doc.route}: ${h.id} ≠ ${slug(h.text)}`),
    );
    expect(wrong).toEqual([]);
  });

  it('gives the source board a row id for every feed', () => {
    // The other caller. An empty slug would make every row `row-`, which is one
    // id for seven rows and a link that lands on whichever came first.
    const ids = FEEDS.map((feed) => `row-${feedId(feed.label)}`);

    // The three that punctuation would have collapsed. These are published
    // addresses — the page reads `#row-…` off the location bar and the workbench
    // deploys on every push to main — so this is here to fail if anybody makes
    // the board share the heading spelling.
    expect(ids).toContain('row-correctiv-schweiz');
    expect(ids).toContain('row-correctiv-lokal');
    expect(ids).toContain('row-correctiv-europe');
    expect(new Set(ids).size).toBe(FEEDS.length);
    expect(ids.filter((id) => id === 'row-')).toEqual([]);
  });

  it('is the only one, so a second cannot disagree with it in silence', () => {
    // The guard that replaces the duplication. A local `slug` anywhere under this
    // package is the state this test was written out of, and the failure it caused
    // is a dead anchor: correct-looking code on both sides of a link.
    const offenders: string[] = [];
    for (const dir of ['src', 'plugin', 'content', 'scripts']) {
      for (const file of filesUnder(join(WORKBENCH, dir), /\.(tsx?|mjs)$/)) {
        if (file.endsWith(join('src', 'lib', 'slug.ts'))) continue;
        const text = readFileSync(file, 'utf8');
        if (/\b(?:function|const|let)\s+slug\b/.test(text)) {
          offenders.push(file.slice(WORKBENCH.length + 1));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
