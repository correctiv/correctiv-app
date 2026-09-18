import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import docsModule from 'virtual:docs';
import type { RenderedDoc } from '../../plugin/markdown.ts';
import type { ReactNode } from 'react';
import { ArticlePath } from '../diagrams/ArticlePath';
import { CoreAndHost } from '../diagrams/CoreAndHost';
import { cn } from '../lib/cn';
import { Slot } from '../shell/slots';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { sectionOf } from '../ui/ActivityBar';
import { Badge } from '../ui/kit/badge';
import { href } from '../router';
import { Page } from '../ui/Page';
import { Toc } from '../ui/Toc';

interface Props {
  doc: RenderedDoc;
}

const REPO_BLOB = `${docsModule.repo}/blob/${docsModule.commit}`;

/**
 * The drawings a document may ask for by name, keyed by the id in its fence.
 *
 * `ARCHITECTURE.md` opens with the core and its host as ASCII, which is the only
 * picture an editor or GitHub can show. `/diagrams` has the same thing drawn. The
 * document keeps its ASCII and the site swaps in the drawing, so there is still
 * one source and two renderings of it rather than two sources.
 */
const DIAGRAMS: Record<string, ReactNode> = {
  // Without its list: the document around it names the same ports in a
  // paragraph and again in a table, and three tellings of one fact is two too
  // many. `/diagrams` still shows the list, where the drawing is the page.
  'core-host': <CoreAndHost alt={false} />,
  // With its list, and the asymmetry is not an oversight. The paragraphs around
  // the cascade name rungs 3 and 4, the document builder and the CSS the host
  // supplies; they name neither the bundle nor the three bounds on the cache. On
  // the site the ASCII is gone, replaced by this, so anyone who cannot use the
  // picture would be left with less than the Markdown has. That is the case the
  // list exists for.
  'article-path': <ArticlePath />,
};

/**
 * One document from the repository, rendered into the shell's main area.
 *
 * The contents list is not here. The shell puts it in the right sidebar, beside
 * the inspector it puts there for the app, because both answer the same question
 * about whatever is open.
 *
 * The HTML is a string produced at build time, so it goes in through
 * `dangerouslySetInnerHTML`. That is safe in the way the name asks about: the
 * input is this repository's own Markdown at the commit being built, not
 * anything a reader can supply.
 */
export function Document({ doc }: Props) {
  const intl = useWorkbenchIntl();
  const article = useRef<HTMLElement>(null);
  const parts = useMemo(() => split(doc.html), [doc.html]);

  useEffect(() => {
    annotateRetired(article.current);
  }, [doc.route]);

  const record = doc.route.startsWith('/decisions/') ? doc.route.slice(11) : null;

  return (
    <>
      <Slot id="contents">
        <Toc headings={doc.headings} />
      </Slot>

      <Page>
        <article ref={article} className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-sm max-w-content text-s text-on-canvas-muted">
            <ol className="flex flex-wrap items-center gap-2xs">
              {/* The section the rail lights, rather than the word "Handbook",
                which stopped being true the day a document of the design section
                was published at `/design/plugin`. A breadcrumb is navigation and
                follows the language setting, so this formats the rail's own
                descriptor; the document below it does not (ADR 0050 §2). */}
              <li>{intl.formatMessage(sectionOf(doc.route))}</li>
              <li aria-hidden="true">/</li>
              <li className="text-on-canvas">{record ? `ADR ${record}` : doc.nav}</li>
            </ol>
          </nav>

          {doc.retired.length > 0 && (
            <p className="mb-m flex max-w-content items-center gap-xs text-m text-on-canvas-muted">
              <Badge variant="alt">{doc.retired.length} retired</Badge>
              {doc.retired.length === 1
                ? 'One claim on this page is'
                : 'Claims on this page are'}{' '}
              struck through where they stand, with what voided them beside them.
            </p>
          )}

          {/*
          The document, in as many pieces as it has drawings and tables in it,
          with the drawings and tables between the prose.

          Not a portal into the rendered HTML. That was the first attempt and it
          rendered nothing: the node a portal is given has to be the one React is
          still holding, and the node this component captures lives inside a
          `dangerouslySetInnerHTML` that React owns and may replace under it.
          Splitting the string is the version where React owns every piece.
        */}
          {parts.map((part, i) =>
            part.diagram ? (
              // The figure carries its own top margin; the prose that follows a
              // drawing starts at zero, because it is the first child of a fresh
              // `.prose` container. Without this the caption and the next
              // paragraph butt together.
              <div key={`d${i}`} className="mb-l">
                <Diagram id={part.diagram} />
              </div>
            ) : (
              <div
                key={`h${i}`}
                className={cn(
                  'prose prose-sm prose-headings:scroll-mt-8 prose-pre:border prose-pre:border-stroke',
                  // A table is data, not sentences, so it is cut out of the
                  // surrounding prose (`split` below) and given `max-w-wide`
                  // instead of `max-w-content` — the one width a page body
                  // reaches for whenever a block is tabular, so it does not
                  // widen the sentences on either side of it. Its own margin,
                  // for the reason the figure above carries one: it is both the
                  // first and the last child of a fresh `.prose` container, so
                  // the typography plugin's sibling spacing gives it none.
                  part.wide ? 'my-m max-w-wide' : 'max-w-content',
                )}
                dangerouslySetInnerHTML={{ __html: part.html }}
              />
            ),
          )}

          {record && <Neighbours route={doc.route} />}

          <footer className="mt-xl max-w-content border-t border-stroke pt-sm text-m text-on-canvas-muted">
            {/* Two sentences, because there are two kinds of document and the
                difference is the whole point of the one that is generated: every
                other page here offers its file as the place to edit, and this one
                would be offering an edit to an output. */}
            <p>
              This page is{' '}
              <a
                href={`${REPO_BLOB}/${doc.file}`}
                target="_blank"
                rel="noreferrer noopener"
                /* `max-w-full break-all`, because the longest path on the site is
                   36 characters and 368 of them fit at 400px: without it this one
                   line put the whole page three pixels into a sideways scroll. */
                className="inline-flex max-w-full items-center gap-3xs break-all font-mono text-on-canvas underline decoration-accent underline-offset-2"
              >
                {doc.file}
                <ExternalLink aria-hidden="true" className="size-[0.75rem]" />
              </a>{' '}
              {doc.generated === true
                ? 'in the repository, which is the program that writes this page rather than the page. It is produced from the tree at build time, so nothing on it is a copy of anything and there is nothing here to edit.'
                : 'in the repository, rendered here. It is not a copy, so there is one place to edit it.'}
            </p>
          </footer>
        </article>
      </Page>
    </>
  );
}

/**
 * The record before and the one after, which is what the tree used to be for.
 *
 * The records are a chain: one amends another, and reading two in a row is the
 * ordinary way to use them. Everything else the explorer listed is on an index
 * page, but "the next record" was only ever a list, and a list is a poor way to
 * say "next". The search palette reaches any record by name; this is for the one
 * whose name you do not know yet.
 */
function Neighbours({ route }: { route: string }) {
  const records = docsModule.docs.filter((d) => d.route.startsWith('/decisions/'));
  const at = records.findIndex((d) => d.route === route);
  if (at === -1) return null;
  const previous = at > 0 ? records[at - 1] : null;
  const next = at < records.length - 1 ? records[at + 1] : null;

  return (
    <nav
      aria-label="The records either side of this one"
      className="mt-xl grid max-w-content gap-xs border-t border-stroke pt-sm sm:grid-cols-2"
    >
      {previous ? <Neighbour doc={previous} where="before" /> : <span />}
      {next && <Neighbour doc={next} where="after" />}
    </nav>
  );
}

function Neighbour({ doc, where }: { doc: RenderedDoc; where: 'before' | 'after' }) {
  const after = where === 'after';
  return (
    <a
      href={href(doc.route)}
      className={cn(
        'group flex min-w-0 flex-col rounded-md border border-stroke bg-surface p-xs',
        'transition-colors hover:border-stroke-strong hover:bg-canvas',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        after && 'sm:col-start-2 sm:text-right',
      )}
    >
      <span className="text-s text-on-canvas-muted">
        {after ? 'Next' : 'Previous'} · {doc.nav}
      </span>
      {/* The record's own h1, minus the prefix its number already carries. The
          number alone says which record; the title says whether you want it. */}
      <span className="mt-4xs text-m font-medium leading-snug text-on-canvas">
        {doc.title.replace(/^ADR\s*0\d{3}\s*[—–-]\s*/, '')}
      </span>
    </a>
  );
}

/** The slot `plugin/markdown.ts` leaves where a document names a drawing. */
const SLOT = /<div data-diagram="([\w-]+)"><\/div>/;

/**
 * The box `plugin/markdown.ts` wraps every table in.
 *
 * That box already exists for the phone-width scroll (`.prose .table-scroll` in
 * `styles/app.css`); this is the same string read a second time, as the mark that
 * says "this block is tabular" rather than sentences. Matched, not reconstructed,
 * so the two places cannot describe two different wrappers.
 */
const TABLE = /<div class="table-scroll"><table>[\s\S]*?<\/table><\/div>/;

interface Part {
  html: string;
  diagram?: string;
  /** A table, cut out of the reading measure into its own `max-w-wide` box. */
  wide?: boolean;
}

/**
 * The rendered document, cut at each slot and each table, so React owns every
 * piece and sizes it on its own terms: a drawing, a table and a sentence are
 * three different widths, and only the third is the reading measure.
 */
function split(html: string): Part[] {
  const parts: Part[] = [];
  let rest = html;
  for (;;) {
    const diagramHit = SLOT.exec(rest);
    const tableHit = TABLE.exec(rest);
    const hit =
      diagramHit && (!tableHit || diagramHit.index <= tableHit.index) ? diagramHit : tableHit;
    if (!hit) break;
    if (hit.index > 0) parts.push({ html: rest.slice(0, hit.index) });
    parts.push(hit === diagramHit ? { html: '', diagram: hit[1] } : { html: hit[0], wide: true });
    rest = rest.slice(hit.index + hit[0].length);
  }
  if (rest) parts.push({ html: rest });
  return parts;
}

/**
 * One drawing, or the nothing that says the id names no drawing here.
 *
 * A slot nobody answers renders nothing rather than an error: the document is
 * still readable, and the ASCII it kept is still in the file for anybody reading
 * it in an editor.
 */
function Diagram({ id }: { id: string }) {
  return DIAGRAMS[id] ?? null;
}

/**
 * Wraps the clause after each struck claim in the annotation the site draws.
 *
 * The convention in `adr/` is "~~the old claim~~ Voided by ADR 0020.", so the
 * reason is the sentence that follows the strike. A reader landing on a struck
 * sentence with no annotation has to guess whether it is a correction, a joke or
 * a rendering fault, and this project strikes claims often enough that guessing
 * is the wrong default.
 *
 * `<ins>` is the honest element: the annotation really is a later insertion and
 * is not in the source document.
 */
function annotateRetired(root: HTMLElement | null): void {
  if (!root) return;

  for (const del of root.querySelectorAll('del')) {
    if (del.dataset.annotated === 'true') continue;
    del.dataset.annotated = 'true';

    const clause: Node[] = [];
    let node = del.nextSibling;
    while (node) {
      // A second strike starts its own claim, so this one's reason ends here.
      if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === 'DEL') break;
      if (node.nodeType === Node.TEXT_NODE) {
        const end = /[.!?](\s|$)/.exec((node as Text).data);
        if (end) {
          // One sentence. A chip drawn around three paragraphs is a highlight.
          (node as Text).splitText(end.index + 1);
          clause.push(node);
          node = null;
          break;
        }
      }
      const next = node.nextSibling;
      clause.push(node);
      node = next;
    }

    const ins = document.createElement('ins');
    ins.className = 'retired';
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = 'retired';
    ins.append(tag);

    const length = clause.reduce((n, c) => n + (c.textContent?.length ?? 0), 0);
    del.after(ins);
    // Some records put the reason in the next paragraph, where no amount of
    // walking finds it. Those get the tag alone rather than a chip drawn around
    // whatever happened to follow.
    if (clause.length > 0 && length <= 260) ins.append(...clause);
  }
}
