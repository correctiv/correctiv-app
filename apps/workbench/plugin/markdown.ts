import { posix } from 'node:path';

import { Marked, type Token, type Tokens } from 'marked';

import { slug } from '../src/lib/slug.ts';

import { adrNumber, adrRoute, DOCUMENTS, type DocumentSource } from './registry.ts';

export interface Heading {
  depth: number;
  id: string;
  text: string;
}

/**
 * One claim a later decision made false, as it appears on the page.
 *
 * The repository never rewrites a decision record to look right in hindsight, so
 * an expired claim is struck through where it stands and one clause after it says
 * what voided it. That makes `~~...~~` content here rather than decoration, and
 * worth collecting: the workbench annotates each one with the record that retired
 * it, and a page can say how many of its claims no longer hold.
 */
export interface RetiredClaim {
  /** The struck-through text. */
  claim: string;
  /** The clause that follows it, which is where the reason lives. */
  clause: string;
  /** Record numbers named in that clause, e.g. `['0022']`. Often empty. */
  by: string[];
}

/**
 * The number a decision heading opens with, which is the whole of its address.
 *
 * A record numbers its decisions — `### 6. German and English from the first
 * string` — and the repository cites them as `ADR 0026 §6`. The site has to answer
 * `/decisions/0026#6`, so the id is the number and **not** a slug of the words.
 *
 * That is the point rather than a shortcut. A slug is derived from the heading
 * text, so rewording a heading silently retires every link into it, which is
 * exactly the failure the numbers were introduced to end. An id taken from the
 * number survives a reword, because a reword does not change which decision it is.
 *
 * Only in a decision record. `N.` at the front of a heading means a number here;
 * in a document that happens to open a heading with a figure it means nothing, and
 * an id of `3` on `ARCHITECTURE.md` would be an address nobody meant to mint.
 */
export function decisionNumber(headingText: string): number | null {
  const hit = /^(\d{1,3})\.\s/.exec(headingText.trim());
  if (!hit) return null;
  const n = Number(hit[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export interface RenderedDoc extends DocumentSource {
  /** The h1, or the navigation label where a document has none. */
  title: string;
  html: string;
  headings: Heading[];
  retired: RetiredClaim[];
}

/**
 * Where a repository path answers on the site.
 *
 * Built from the registry plus the records, and consulted by the link rewriter,
 * which is the reason it has to exist as a map rather than as a series of
 * conditionals: a link in a document is written for a reader of the repository,
 * and every one of them has to be re-pointed or it leaves the site.
 */
export function routeMap(adrFiles: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const doc of DOCUMENTS) map.set(doc.file, doc.route);
  for (const file of adrFiles) {
    const n = adrNumber(file);
    if (n) map.set(file, adrRoute(n));
  }
  return map;
}

export interface LinkTarget {
  href: string;
  /** True where the link leaves the workbench, which the page marks. */
  external: boolean;
}

/**
 * Re-points one link from a document into the site, or out to the repository.
 *
 * `from` is the document's own repository-relative path, and it matters: a link
 * in `adr/0022-….md` that reads `0010-….md` means `adr/0010-….md`, while the same
 * text in `ARCHITECTURE.md` would mean something at the root. Resolving against
 * the wrong base is the failure that produces a site full of links which are
 * individually plausible and collectively wrong, so the base is always the
 * containing directory of the file the link was written in.
 *
 * A path this site does not publish becomes a link to the repository at the built
 * commit, not at `main`. A source file moves, and a workbench page built in
 * September should keep pointing at the line it was describing.
 */
export function resolveHref(
  href: string,
  from: string,
  routes: Map<string, string>,
  blobBase: string,
  base: string,
): LinkTarget {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return { href, external: true };
  if (href.startsWith('#')) return { href, external: false };

  const [rawPath, hash] = splitHash(href);
  if (!rawPath) return { href, external: false };

  const resolved = posix.normalize(posix.join(posix.dirname(from), rawPath)).replace(/^\.\//, '');
  const route = routes.get(resolved);
  // The prefix, not the bare route. This HTML is handed to the document as a
  // string, so it never passes `router.tsx`'s `href()`, which is what adds the
  // prefix everywhere else. Without it a link in a document reads `/decisions/0021`
  // and lands at the domain root — on a project site that is somebody else's
  // address, and `useLinkInterception` deliberately ignores it, because a path
  // outside the base is not this site's to answer. Both halves of that are correct
  // and the result was a 404 on every internal link in every document, but only
  // once published: locally the base is `/` and the bug cannot appear.
  if (route) return { href: prefix(base) + route + hash, external: false };

  return { href: `${blobBase}/${resolved}${hash}`, external: true };
}

/** Vite's base without its trailing slash, so `/` contributes nothing. */
function prefix(base: string): string {
  return base.replace(/\/$/, '');
}

function splitHash(href: string): [string, string] {
  const i = href.indexOf('#');
  return i === -1 ? [href, ''] : [href.slice(0, i), href.slice(i)];
}

/**
 * Collects every struck-through claim together with the clause that voids it.
 *
 * The clause is what follows the strike inside the same block: "~~the old
 * claim~~ Voided by ADR 0022." The obvious implementation, scanning the strike's
 * own siblings, is wrong, and the repository holds the counter-example. ADR 0004
 * writes `**~~The port was synchronous.~~** Voided by …`, where the strike is the
 * last child of a `strong` and the clause is a sibling of that `strong`, not of
 * the strike. Sibling-scanning finds an empty clause and silently drops the
 * reason, which is the one part worth having.
 *
 * So each block's inline tokens are flattened depth-first into a leaf sequence
 * first, with a strike kept atomic. Nesting then cannot separate a claim from its
 * reason, because after flattening the two are adjacent whatever the emphasis
 * around them was. The clause still stops at the next strike, so two claims in
 * one sentence do not swallow each other's reason.
 */
export function retiredClaims(tokens: Token[]): RetiredClaim[] {
  const found: RetiredClaim[] = [];

  for (const block of inlineBlocks(tokens)) {
    const leaves = flattenInline(block);
    leaves.forEach((leaf, i) => {
      if (leaf.type !== 'del') return;
      const rest: Token[] = [];
      for (const next of leaves.slice(i + 1)) {
        if (next.type === 'del') break;
        rest.push(next);
      }
      const clause = rest
        .map((t) => t.raw)
        .join('')
        .trim();
      found.push({
        claim: plain(leaf.raw),
        clause: plain(clause),
        by: [...new Set([...clause.matchAll(/\b(0\d{3})\b/g)].map((m) => m[1]))],
      });
    });
  }

  return found;
}

/**
 * Every inline token array in the document, one per block that can hold prose.
 *
 * Blocks are kept apart rather than concatenated: a clause must not run past the
 * end of its paragraph into the next one, and a table cell's reason belongs to
 * that cell.
 */
function inlineBlocks(tokens: Token[]): Token[][] {
  const blocks: Token[][] = [];

  const visit = (list: Token[]): void => {
    for (const token of list) {
      const t = token as Record<string, unknown>;
      if (token.type === 'paragraph' || token.type === 'heading' || token.type === 'text') {
        if (Array.isArray(t.tokens)) blocks.push(t.tokens as Token[]);
        continue;
      }
      if (Array.isArray(t.items)) {
        visit(t.items as Token[]);
        continue;
      }
      if (token.type === 'table') {
        const table = token as Tokens.Table;
        for (const cell of table.header) blocks.push(cell.tokens);
        for (const row of table.rows) for (const cell of row) blocks.push(cell.tokens);
        continue;
      }
      if (Array.isArray(t.tokens)) visit(t.tokens as Token[]);
    }
  };

  visit(tokens);
  return blocks;
}

/** Depth-first leaves of one inline array, with a strike kept whole. */
function flattenInline(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const token of tokens) {
    const nested = (token as Record<string, unknown>).tokens;
    if (token.type !== 'del' && Array.isArray(nested) && nested.length > 0) {
      out.push(...flattenInline(nested as Token[]));
    } else {
      out.push(token);
    }
  }
  return out;
}

/**
 * Markdown emphasis, code ticks and link syntax removed; the words kept.
 *
 * Exported because `decisions.ts` had a byte-identical copy of it, and a record's
 * title reaching the board with its asterisks intact in one place and stripped in
 * the other is the kind of difference nobody sees until a heading is bold.
 */
export function plain(raw: string): string {
  return raw
    .replace(/~~/g, '')
    .replace(/\*\*?/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** What `blobBase` puts between the repository and the path, and what a raw file needs instead. */
const REPO_BLOB_SEGMENT = '/blob';

/**
 * One document, rendered.
 *
 * A fresh `Marked` per document on purpose: the renderer closes over the
 * document's own path for link resolution and over its own heading-slug counters
 * for de-duplication. Sharing one instance across documents leaked both, and the
 * second symptom is subtle, a second document's repeated heading getting a `-1`
 * suffix because the first document had already used the bare slug.
 */
export function renderDoc(
  source: DocumentSource,
  markdown: string,
  routes: Map<string, string>,
  blobBase: string,
  base: string,
): RenderedDoc {
  const headings: Heading[] = [];
  const seen = new Map<string, number>();
  const md = new Marked({ gfm: true });
  const isRecord = source.route.startsWith('/decisions/');

  md.use({
    renderer: {
      heading(token: Tokens.Heading) {
        const text = this.parser.parseInline(token.tokens);
        const label = stripTags(text);
        // The number, where the record wrote one, so `#6` is the address of §6.
        const numbered = isRecord ? decisionNumber(label) : null;
        const base = numbered === null ? slug(label) || 'section' : String(numbered);
        const n = seen.get(base) ?? 0;
        seen.set(base, n + 1);
        const id = n === 0 ? base : `${base}-${n}`;
        headings.push({ depth: token.depth, id, text: label });
        return `<h${token.depth} id="${id}">${text}</h${token.depth}>\n`;
      },
      /**
       * A fenced block that names a drawing, which the site draws instead.
       *
       * The convention is an info string of `text diagram=<id>`. The ASCII stays
       * in the Markdown, because in an editor and on GitHub it is the only
       * picture there is, and this repository's rule is that no document has a
       * second copy anywhere. The site has the same drawing as SVG on
       * `/diagrams`, so here it leaves a slot and `pages/Document.tsx` renders
       * the real figure into it.
       *
       * An id nothing answers renders as the code block it always was, which is
       * the failure worth having: a diagram that is merely not drawn yet still
       * says what it says.
       */
      code(token: Tokens.Code) {
        const named = /(?:^|\s)diagram=([\w-]+)/.exec(token.lang ?? '');
        if (!named) return false;
        return `<div data-diagram="${escapeAttr(named[1])}"></div>`;
      },
      /**
       * An image in a document, which lives in the repository and not here.
       *
       * The same rule as a link, one step further: a link to a file the site does
       * not publish becomes a link into the repository at the built commit, and an
       * image has to become the raw bytes rather than GitHub's page about them.
       * Without this the `<img>` kept its repository-relative path, which the
       * browser resolved against the route it was on, and `README.md`'s header
       * image asked this site for `/docs/readme-header.png`, which it does not
       * serve.
       */
      image(token: Tokens.Image) {
        const target = resolveHref(token.href, source.file, routes, blobBase, base);
        const src = target.external
          ? target.href.replace(`${REPO_BLOB_SEGMENT}/`, '/raw/')
          : target.href;
        const title = token.title ? ` title="${escapeAttr(token.title)}"` : '';
        return `<img src="${escapeAttr(src)}" alt="${escapeAttr(token.text)}"${title} loading="lazy" />`;
      },
      link(token: Tokens.Link) {
        const target = resolveHref(token.href, source.file, routes, blobBase, base);
        const text = this.parser.parseInline(token.tokens);
        const title = token.title ? ` title="${escapeAttr(token.title)}"` : '';
        const rel = target.external ? ' target="_blank" rel="noreferrer noopener"' : '';
        const mark = target.external ? ' data-external="true"' : '';
        return `<a href="${escapeAttr(target.href)}"${title}${rel}${mark}>${text}</a>`;
      },
    },
  });

  const tokens = md.lexer(markdown);
  /*
   * A table in its own scroll box, rather than a table made to scroll.
   *
   * A record's table is wider than a phone and has to scroll somewhere. The
   * stylesheet used to do that with `display: block` on the table itself, and a
   * table that is a block is no longer a table: a browser that takes the role
   * from the display type stops announcing rows and columns. Wrapping the
   * rendered string rather than overriding marked's table renderer, because the
   * override would have to reimplement the whole thing to add one element around
   * it, and this input is our own Markdown.
   */
  const html = (md.parse(markdown) as string).replace(
    /<table>([\s\S]*?)<\/table>/g,
    '<div class="table-scroll"><table>$1</table></div>',
  );
  const title = headings.find((h) => h.depth === 1)?.text ?? source.nav;

  return { ...source, title, html, headings, retired: retiredClaims(tokens) };
}

/**
 * The plain-text form of rendered inline HTML, for a heading id, the table of
 * contents and the document title.
 *
 * Entities have to be decoded, not only tags stripped. The renderer has already
 * escaped the source, so a title reading "Release & CI" arrives here as
 * "Release &amp; CI", and without this step the navigation and the browser tab
 * show the escape instead of the character.
 */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
