import docsModule from 'virtual:docs';
import { CardGrid, type Card } from '../ui/CardGrid';
import { Page } from '../ui/Page';

const blurb = (route: string) => docsModule.docs.find((d) => d.route === route)?.blurb;

/**
 * What is written down, and the drawings of the same thing.
 *
 * The section existed before this page did: every document's breadcrumb has said
 * "Handbook / …" since the site was built, and there was nothing at the other end
 * of it. This is the other end.
 *
 * The drawings sit here rather than in a section of their own. Diagram 1 is
 * inside `ARCHITECTURE.md` itself now, which settles the question: they are not a
 * separate collection, they are this explanation in pictures.
 */
export function Handbook() {
  const documents: Card[] = [
    {
      route: '/architecture',
      title: 'Architecture',
      kind: 'Explanation',
      blurb: blurb('/architecture'),
    },
    {
      route: '/diagrams',
      title: 'Diagrams',
      kind: 'Drawn',
      blurb:
        'The same architecture as four drawings: the core and its host, which decisions still stand, what the app talks to, and how the core is layered inside.',
    },
    { route: '/conventions', title: 'Conventions', kind: 'Rules', blurb: blurb('/conventions') },
    { route: '/traps', title: 'Traps', kind: 'Hard-won', blurb: blurb('/traps') },
    // The one card whose page is not a file. It sits here rather than apart
    // because what it describes is how everything else on this grid stays true.
    { route: '/provenance', title: 'Provenance', kind: 'Generated', blurb: blurb('/provenance') },
    { route: '/readme', title: 'Readme', kind: 'Start', blurb: blurb('/readme') },
    { route: '/release', title: 'Release', kind: 'Process', blurb: blurb('/release') },
  ];

  return (
    <Page>
      <h1 className="text-headline-xl font-bold leading-tight tracking-tight">Handbook</h1>
      <p className="mt-xs max-w-content text-l leading-normal text-on-canvas-muted">
        The repository&apos;s own documents, rendered where they live. Nothing here is a copy: the
        files are the source and this site is a second way to read them, so there is one place to
        edit and no version that quietly falls behind.
      </p>

      <CardGrid cards={documents} columns={3} />

      <p className="mt-l max-w-content text-m leading-relaxed text-on-canvas-muted">
        The decisions behind all of it are their own section, because a record is a different kind
        of document: it is never rewritten, and a claim a later decision made false is struck
        through where it stands rather than corrected.
      </p>
    </Page>
  );
}
