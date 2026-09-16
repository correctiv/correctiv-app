import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { adrFiles, collectDocs, GENERATED_DOCUMENTS, REPO, ROOT } from '../plugin/collect';
import { DOCUMENTS } from '../plugin/registry';

const { module } = collectDocs();
const { docs } = module;
const routes = new Set(docs.map((d) => d.route));

describe('the published documents', () => {
  it('renders every registered document, every generated one and every record', () => {
    // Counted from the directory rather than typed. A record is added by writing
    // one, and a test that had to be edited alongside would just be edited
    // alongside, which is how an assertion stops being one.
    expect(docs.length).toBe(DOCUMENTS.length + GENERATED_DOCUMENTS.length + adrFiles().length);
    for (const doc of docs) expect(doc.html.length).toBeGreaterThan(200);
  });

  it('gives every document a title with no escapes left in it', () => {
    expect(docs.filter((doc) => doc.title === '').map((d) => d.route)).toEqual([]);
    // `Release & CI` reaches the renderer as `Release &amp; CI`, and a title is put
    // into the navigation and the browser tab as text, not as HTML.
    const escaped = docs.filter((doc) => /&(amp|lt|gt|quot|#\d+);/.test(doc.title));
    expect(escaped.map((d) => `${d.route}: ${d.title}`)).toEqual([]);
  });
});

describe('link rewriting', () => {
  const links = docs.flatMap((doc) =>
    [...doc.html.matchAll(/href="([^"]+)"/g)].map((m) => ({ from: doc.route, href: m[1] })),
  );

  it('finds links to rewrite at all', () => {
    // Guards against the renderer override silently not being installed, which
    // would leave every href as written and pass every assertion below.
    expect(links.length).toBeGreaterThan(150);
  });

  it('points every in-site link at a route this site publishes', () => {
    const internal = links.filter((l) => l.href.startsWith('/'));
    expect(internal.length).toBeGreaterThan(100);
    const dangling = internal.filter((l) => !routes.has(l.href.split('#')[0]));
    expect(dangling.map((l) => `${l.from} -> ${l.href}`)).toEqual([]);
  });

  it('points every repository link at a path that exists', () => {
    // The failure this catches is a document naming a file that has since moved.
    // The workbench would publish a 404 into GitHub with a green build.
    const blob = `${REPO}/blob/${module.commit}/`;
    const paths = new Set(
      links
        .filter((l) => l.href.startsWith(blob))
        .map((l) => l.href.slice(blob.length).split('#')[0]),
    );
    expect(paths.size).toBeGreaterThan(0);
    const missing = [...paths].filter((p) => !existsSync(join(ROOT, p)));
    expect(missing).toEqual([]);
  });

  it('leaves no unresolved relative Markdown link behind', () => {
    const unresolved = links.filter((l) => /^(\.|[^/:#]+\.md)/.test(l.href));
    expect(unresolved.map((l) => `${l.from} -> ${l.href}`)).toEqual([]);
  });

  it('carries the base path into every link a document makes to this site', () => {
    // This shipped. A document's HTML is handed to the page as a string, so it
    // never passes `router.tsx`'s `href()`, which is what puts the prefix on every
    // other link — and `useLinkInterception` ignores a path outside the base on
    // purpose, because such a path is not this site's to answer. So every internal
    // link in every document was a real navigation to the domain root, which on a
    // project site is somebody else's address: `/decisions/0021` instead of
    // `/correctiv-app/decisions/0021`, and a 404 for each one.
    //
    // Invisible in development, where the base is `/` and the two spellings are the
    // same string. Hence a base that is not `/`.
    const based = collectDocs('/correctiv-app/').module.docs;
    const internal = based.flatMap((doc) =>
      [...doc.html.matchAll(/<a href="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((href) => href.startsWith('/'))
        .map((href) => ({ from: doc.route, href })),
    );
    expect(internal.length).toBeGreaterThan(20);
    const unprefixed = internal.filter((l) => !l.href.startsWith('/correctiv-app/'));
    expect(unprefixed.map((l) => `${l.from} -> ${l.href}`)).toEqual([]);
  });

  it('adds nothing when the site is served from the root', () => {
    // The other half: `/` must contribute no prefix, or every link would start
    // `//decisions`, which a browser reads as a host.
    const rooted = collectDocs('/').module.docs;
    const doubled = rooted.flatMap((doc) =>
      [...doc.html.matchAll(/<a href="(\/\/[^"]*)"/g)].map((m) => `${doc.route} -> ${m[1]}`),
    );
    expect(doubled).toEqual([]);
  });
});

describe('retired claims', () => {
  /**
   * The count has to come from the sources, not from a number typed here.
   *
   * This is the assertion that caught the real bug: the first implementation
   * walked containers and their nested lists both, so a strike inside a list item
   * was collected twice and the total read 43 against 36 in the sources. A
   * hard-coded expectation would have been written as 43 and the duplication
   * would have shipped.
   */
  const marksInSources = docs.reduce((total, doc) => {
    const source = readFileSync(join(ROOT, doc.file), 'utf8');
    return total + (source.match(/~~/g)?.length ?? 0);
  }, 0);

  it('finds each struck-through claim exactly once', () => {
    const found = docs.flatMap((d) => d.retired);
    expect(marksInSources % 2).toBe(0);
    expect(found.length).toBe(marksInSources / 2);
  });

  it('keeps the clause that voids the claim, including through nested emphasis', () => {
    const found = docs.flatMap((d) => d.retired);
    // ADR 0004 writes `**~~The port was synchronous.~~** Voided by …`, where the
    // clause is a sibling of the emphasis rather than of the strike. Scanning the
    // strike's own siblings returns nothing here, and the reason is the part worth
    // having, so this names the case rather than only counting clauses.
    const nested = found.find((r) => r.claim.startsWith('The port was synchronous'));
    expect(nested).toBeDefined();
    expect(nested?.clause).not.toBe('');

    // Not all of them: a handful put the reason in the following paragraph, which
    // no amount of parsing recovers. The page renders those struck and unannotated.
    expect(found.filter((r) => r.clause !== '').length).toBeGreaterThan(found.length * 0.8);
  });

  it('names the record that retired the claim where the clause cites one', () => {
    const cited = docs.flatMap((d) => d.retired).filter((r) => r.by.length > 0);
    expect(cited.length).toBeGreaterThan(15);
    for (const claim of cited) {
      for (const number of claim.by) expect(routes.has(`/decisions/${number}`)).toBe(true);
    }
  });
});
