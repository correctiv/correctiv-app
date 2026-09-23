import { ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { defineMessages } from 'react-intl';

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
import { split } from './document-parts';

interface Props {
  doc: RenderedDoc;
}

const REPO_BLOB = `${docsModule.repo}/blob/${docsModule.commit}`;

/**
 * Everything the FRAME says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/document.ts`.
 *
 * **This file is the clearest place on the site where the line in
 * [ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1
 * runs**, because both halves are in one component. The breadcrumb, the note
 * about struck claims, the chip drawn on each one, the sentence at the foot and
 * the two cards to the neighbouring records are this site's own words and are
 * here. Everything between them is not: `doc.html` is the repository's own
 * Markdown rendered at build time, `doc.title` and `doc.nav` are the document's
 * own name, `doc.file` is a path, and `ADR 0052` is a record's number. None of
 * those passes through a catalogue, and a German reader gets a German frame
 * around an English document, which that record calls the answer rather than an
 * unfinished translation.
 */
const COPY = defineMessages({
  breadcrumb: {
    id: 'document.breadcrumb',
    defaultMessage: 'Breadcrumb',
    description:
      'Read aloud as the name of the trail above a document, and never drawn. The trail itself is the section the rail lights and then the document’s own name, both of which come out of the repository. components.detail.breadcrumb is the same word over a single component’s page.',
  },

  retiredBadge: {
    id: 'document.retired.badge',
    defaultMessage: '{count, plural, one {# retired} other {# retired}}',
    description:
      'The badge at the head of a document that has struck claims in it. {count} is how many, and is never zero because the badge is not drawn then. English does not inflect the word; the plural is here so that a language which does has somewhere to say so.',
  },
  retiredNote: {
    id: 'document.retired.note',
    defaultMessage:
      '{count, plural, one {One claim on this page is struck through.} other {Some claims on this page are struck through.}} The reason stands beside each.',
    description:
      'The sentence beside that badge, saying what the strikes on the page mean. {count} is how many claims are struck, and decides only whether the sentence is singular.',
  },
  retiredTag: {
    id: 'document.retired.tag',
    defaultMessage: 'retired',
    description:
      'The chip drawn on each struck claim, against the clause that says what voided it. One word, in small type, inside the annotation rather than in the document: it is this site’s label and not the record’s text.',
  },

  source: {
    id: 'document.source',
    defaultMessage:
      'This page is <fileLink>{file}</fileLink> in the repository, shown here. It is not a copy, so there is only one place to edit it.',
    description:
      'The line at the foot of a document read out of the repository. {file} is its path and is not translated; <fileLink> is the link to it on GitHub at the commit this site was built from. document.source.generated is the same line for the one document that is written by a program.',
  },
  sourceGenerated: {
    id: 'document.source.generated',
    defaultMessage:
      'A program writes this page: <fileLink>{file}</fileLink> in the repository. It runs when the site is built, so there is nothing here to edit.',
    description:
      'The line at the foot of the one document that is generated rather than read. {file} is the path of the PROGRAM and is not translated; <fileLink> is the link to it. document.source offers every other document as a file to edit, and offering this one would be an invitation to type into an output.',
  },

  neighbours: {
    id: 'document.neighbours',
    defaultMessage: 'The records either side of this one',
    description:
      'Read aloud as the name of the two cards at the foot of a record, and never drawn. Records are a chain, and reading two in a row is the ordinary way to use them.',
  },
  previous: {
    id: 'document.previous',
    defaultMessage: 'Previous · {nav}',
    description:
      'The kicker on the left-hand card at the foot of a record. {nav} is the neighbouring record’s own short name out of the repository and is not translated. document.next is the card on the other side.',
  },
  next: {
    id: 'document.next',
    defaultMessage: 'Next · {nav}',
    description:
      'The kicker on the right-hand card at the foot of a record. {nav} is the neighbouring record’s own short name out of the repository and is not translated. document.previous is the card on the other side.',
  },
});

/**
 * The link to the document's own file, drawn inside `document.source`.
 *
 * A factory at module scope rather than an arrow in the render: the href is the
 * only part that varies, so the component itself is still declared once and
 * `react/no-unstable-nested-components` has nothing in a render body to find.
 */
const fileLink = (file: string) => (chunks: ReactNode[]) => (
  <a
    href={`${REPO_BLOB}/${file}`}
    target="_blank"
    rel="noreferrer noopener"
    /* `max-w-full break-all`, because the longest path on the site is
       36 characters and 368 of them fit at 400px: without it this one
       line put the whole page three pixels into a sideways scroll. */
    className="inline-flex max-w-full items-center gap-3xs break-all font-mono text-on-canvas underline decoration-accent underline-offset-2"
  >
    {chunks}
    <ExternalLink aria-hidden="true" className="size-[0.75rem]" />
  </a>
);

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
 * `dangerouslySetInnerHTML`, unsanitised. The input is this repository's own
 * Markdown at the commit being built, not anything a reader can supply, but that
 * alone is not what makes it safe: a change to a document is reviewed as prose,
 * and `marked` passes an `<img onerror=…>` in a paragraph straight through. Two
 * things hold the claim instead. `test/rendered-html.test.ts` fails on
 * script-bearing HTML in any rendered document, before it is merged, and the
 * Content-Security-Policy in `plugin/policy.ts` refuses inline script on the
 * published site whatever got past the test. `Reference.tsx` and
 * `ComponentDetail.tsx` put doc comments in the same way and rest on the same two.
 */
export function Document({ doc }: Props) {
  const intl = useWorkbenchIntl();
  const article = useRef<HTMLElement>(null);
  const parts = useMemo(() => split(doc.html), [doc.html]);
  const retiredTag = intl.formatMessage(COPY.retiredTag);

  /*
   * After EVERY render, and the missing dependency array is the fix rather than
   * the oversight. Measured on 2026-09-18 against the dev server, on
   * `/decisions/0026`, which has nine struck claims: any re-render of this
   * component leaves nine `<del>` with no `data-annotated` on them, so React is
   * writing the document's HTML back over the annotation. Opening the settings
   * dialog and closing it again is enough. With the list `[doc.route]` this ran
   * on neither, and the chips were gone until the reader navigated away and
   * back; nothing failed, because the check on this page is that the sentence
   * above it is right.
   *
   * `annotateRetired` is idempotent and reads only the `<del>`s of one
   * document, so paying for it per render is cheaper than watching for the
   * write with a `MutationObserver`. Why React rewrites an unchanged
   * `dangerouslySetInnerHTML` at all is a question for whoever owns that
   * branch; it is older than this file's move to messages.
   */
  useEffect(() => {
    annotateRetired(article.current, retiredTag);
  });

  const record = doc.route.startsWith('/decisions/') ? doc.route.slice(11) : null;

  return (
    <>
      <Slot id="contents">
        <Toc headings={doc.headings} />
      </Slot>

      <Page>
        <article ref={article} className="min-w-0">
          <nav
            aria-label={intl.formatMessage(COPY.breadcrumb)}
            className="mb-sm max-w-content text-s text-on-canvas-muted"
          >
            <ol className="flex flex-wrap items-center gap-2xs">
              {/* The section the rail lights, rather than the word "Handbook",
                which stopped being true the day a document of the design section
                was published at `/design/plugin`. A breadcrumb is navigation and
                follows the language setting, so this formats the rail's own
                descriptor; the document below it does not (ADR 0052 §1). */}
              <li>{intl.formatMessage(sectionOf(doc.route))}</li>
              <li aria-hidden="true">/</li>
              <li className="text-on-canvas">{record ? `ADR ${record}` : doc.nav}</li>
            </ol>
          </nav>

          {doc.retired.length > 0 && (
            <p className="mb-m flex max-w-content items-center gap-xs text-m text-on-canvas-muted">
              <Badge variant="alt">
                {intl.formatMessage(COPY.retiredBadge, { count: doc.retired.length })}
              </Badge>
              {/* One message and not two halves around a ternary: the number
                  decides the verb, and which words it reaches is the
                  translator's to say rather than this file's. */}
              {intl.formatMessage(COPY.retiredNote, { count: doc.retired.length })}
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
              {intl.formatMessage(doc.generated === true ? COPY.sourceGenerated : COPY.source, {
                file: doc.file,
                fileLink: fileLink(doc.file),
              })}
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
  const intl = useWorkbenchIntl();
  const records = docsModule.docs.filter((d) => d.route.startsWith('/decisions/'));
  const at = records.findIndex((d) => d.route === route);
  if (at === -1) return null;
  const previous = at > 0 ? records[at - 1] : null;
  const next = at < records.length - 1 ? records[at + 1] : null;

  return (
    <nav
      aria-label={intl.formatMessage(COPY.neighbours)}
      className="mt-xl grid max-w-content gap-xs border-t border-stroke pt-sm sm:grid-cols-2"
    >
      {previous ? <Neighbour doc={previous} where="before" /> : <span />}
      {next && <Neighbour doc={next} where="after" />}
    </nav>
  );
}

function Neighbour({ doc, where }: { doc: RenderedDoc; where: 'before' | 'after' }) {
  const intl = useWorkbenchIntl();
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
        {/* The separator is inside the message, because which side of it the
            record's name goes is a question about the language and not about
            this card. `doc.nav` is the repository's own short name for it. */}
        {intl.formatMessage(after ? COPY.next : COPY.previous, { nav: doc.nav })}
      </span>
      {/* The record's own h1, minus the prefix its number already carries. The
          number alone says which record; the title says whether you want it. */}
      <span className="mt-4xs text-m font-medium leading-snug text-on-canvas">
        {doc.title.replace(/^ADR\s*0\d{3}\s*[—–-]\s*/, '')}
      </span>
    </a>
  );
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
 *
 * **The word is handed in rather than typed here**, because it is this site's
 * label on the repository's sentence and so follows the language setting
 * (ADR 0052 §1).
 *
 * **The already-annotated branch below really does only skip**, and an earlier
 * version of this paragraph claimed otherwise: it said React re-renders none of
 * the document's HTML because it sits under `dangerouslySetInnerHTML`, so that
 * branch had to redraw a chip in the new language. A cold review measured the
 * opposite. Marking the `<ins>` nodes and three of the document's own paragraphs
 * and forcing one re-render left every marker gone and nine fresh `<del>` in
 * place: React rewrites that subtree on every render, which is the whole reason
 * the effect above runs after every render rather than on a dependency list. So
 * the language switch is served by the annotation running again from scratch,
 * and this branch is reached only by StrictMode's second effect call in
 * development.
 */
function annotateRetired(root: HTMLElement | null, word: string): void {
  if (!root) return;

  for (const del of root.querySelectorAll('del')) {
    if (del.dataset.annotated === 'true') {
      const drawn = del.nextElementSibling?.querySelector('.tag');
      if (drawn) drawn.textContent = word;
      continue;
    }
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
    tag.textContent = word;
    ins.append(tag);

    const length = clause.reduce((n, c) => n + (c.textContent?.length ?? 0), 0);
    del.after(ins);
    // Some records put the reason in the next paragraph, where no amount of
    // walking finds it. Those get the tag alone rather than a chip drawn around
    // whatever happened to follow.
    if (clause.length > 0 && length <= 260) ins.append(...clause);
  }
}
