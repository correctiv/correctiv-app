import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDecisions, strikeEdges, type DecisionRecord, type Strike } from './decisions.ts';
import { renderDoc, routeMap, type RenderedDoc } from './markdown.ts';
import { buildProvenance, PROVENANCE_SOURCE, provenanceMarkdown } from './provenance.ts';
import { adrNumber, adrRoute, DOCUMENTS, type DocumentSource } from './registry.ts';

export const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
export const REPO = 'https://github.com/correctiv/correctiv-app';

/**
 * The commit the workbench was built from, so a link into the source is stable.
 *
 * Linking at `main` would be easier and wrong: a page describing a particular
 * line should keep pointing at the line it described, not at whatever moved onto
 * that number afterwards. CI hands the sha over in the environment, a local build
 * asks git, and a checkout with no git falls back to the branch, which is the only
 * case where such a link can rot and also the case where nobody is reading a
 * published page.
 */
export function commit(): string {
  const fromCi = process.env.GITHUB_SHA?.trim();
  if (fromCi) return fromCi;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return 'main';
  }
}

/**
 * The documents this site produces rather than reads.
 *
 * One so far. It is in the same list as the rest because everything downstream —
 * the route, the contents list, the search index, the link rewriting, the
 * breadcrumb — should not have to know which kind of document it is holding; the
 * difference is that `file` names the program instead of the page, and the page
 * says so in its footer.
 */
export const GENERATED_DOCUMENTS: DocumentSource[] = [{ ...PROVENANCE_SOURCE, generated: true }];

/** What a generated document's Markdown is, at the moment it is asked for. */
function write(source: DocumentSource): string {
  if (source.id !== PROVENANCE_SOURCE.id) throw new Error(`${source.id} generates nothing.`);
  return provenanceMarkdown(buildProvenance(ROOT));
}

/** Every record, in number order, which is also reading order. */
export function adrFiles(): string[] {
  return readdirSync(join(ROOT, 'adr'))
    .filter((name) => adrNumber(name) !== null)
    .sort()
    .map((name) => `adr/${name}`);
}

export interface DocsModule {
  docs: RenderedDoc[];
  /**
   * The records, with what the board needs that a rendered document does not
   * carry: a standing, a date, and both ends of the retirement graph.
   */
  decisions: DecisionRecord[];
  /**
   * The retirement graph as edges, which is what the second drawing draws.
   *
   * Derived from `decisions` and shipped beside it rather than rebuilt in the
   * browser, so that `plugin/decisions.ts` stays a build-time module and the
   * drawing reads data rather than importing one.
   */
  strikes: Strike[];
  commit: string;
  repo: string;
}

/**
 * Reads and renders every published document.
 *
 * Exported so the tests can assert against the same thing the site is built
 * from. A test that re-implemented the collection would pass while the site was
 * broken, which is the failure this repository's troubleshooting notes are
 * mostly about.
 */
export function collectDocs(base = '/'): { module: DocsModule; files: string[] } {
  const adrs = adrFiles();
  const routes = routeMap(adrs);
  const sha = commit();
  const blobBase = `${REPO}/blob/${sha}`;

  const sources: DocumentSource[] = [
    ...DOCUMENTS,
    ...GENERATED_DOCUMENTS,
    ...adrs.map((file) => {
      const n = adrNumber(file) as string;
      return { id: `adr-${n}`, file, route: adrRoute(n), nav: `ADR ${n}`, blurb: '' };
    }),
  ];

  // The Markdown is kept beside the rendered document, because the board reads two
  // things the renderer throws away: the status line's own spelling, and which part
  // of an index row was put in bold.
  const markdown = new Map<string, string>();
  const docs = sources.map((source) => {
    const raw =
      source.generated === true ? write(source) : readFileSync(join(ROOT, source.file), 'utf8');
    markdown.set(source.file, raw);
    return renderDoc(source, raw, routes, blobBase, base);
  });

  const decisions = buildDecisions(docs, markdown);

  return {
    module: { docs, decisions, strikes: strikeEdges(decisions), commit: sha, repo: REPO },
    files: sources.map((s) => join(ROOT, s.file)),
  };
}
