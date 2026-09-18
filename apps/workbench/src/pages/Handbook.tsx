import { defineMessages } from 'react-intl';

import docsModule from 'virtual:docs';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { CardGrid, type Card } from '../ui/CardGrid';
import { Page } from '../ui/Page';

const blurb = (route: string) => docsModule.docs.find((d) => d.route === route)?.blurb;

/**
 * Everything this page says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/handbook.ts`.
 *
 * **A card has two halves and they come from opposite sides of the line.** The
 * title and the kicker above it are this site's own shorthand for a document and
 * are here. The sentence under them is not: `blurb()` reads it out of
 * `virtual:docs`, where it is written beside the document's path in
 * `plugin/registry.ts` and is the repository describing its own files
 * ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * So a German reader gets German cards over English one-liners, with the English
 * documents themselves one click behind them, which is the mixed page that record
 * says is the answer.
 *
 * The one exception is the drawings' card, whose document does not exist: there is
 * no `/diagrams` Markdown file, so nothing wrote a blurb for it and the sentence
 * is this page's own. It is the only `blurb` in here.
 *
 * `Readme` and `Release` keep their spelling in every language. They are the names
 * of two files in the root of this repository, and a reader following the card is
 * going to `README.md`.
 */
const COPY = defineMessages({
  title: {
    id: 'handbook.title',
    defaultMessage: 'Handbook',
    description:
      'The page’s heading. shell.activity.handbook is the rail entry that opens it and the word a document’s breadcrumb uses for this section; nav.handbook is the same word again as the page’s name in the browser tab and the search palette.',
  },
  lede: {
    id: 'handbook.lede',
    defaultMessage:
      'The repository’s own documents, rendered where they live. Nothing here is a copy: the files are the source and this site is a second way to read them, so there is one place to edit and no version that quietly falls behind.',
  },
  records: {
    id: 'handbook.records',
    defaultMessage:
      'The decisions behind all of it are their own section, because a record is a different kind of document: it is never rewritten, and a claim a later decision made false is struck through where it stands rather than corrected.',
  },

  architecture: { id: 'handbook.card.architecture', defaultMessage: 'Architecture' },
  architectureKind: {
    id: 'handbook.card.architecture.kind',
    defaultMessage: 'Explanation',
    description: 'The kicker over the Architecture card: what kind of document it is.',
  },

  diagrams: {
    id: 'handbook.card.diagrams',
    defaultMessage: 'Diagrams',
    description:
      'The card that opens the drawings. diagrams.title is the heading of the page it opens and diagrams.crumb is the step in a single drawing’s breadcrumb that leads back to it; all three read the same in English.',
  },
  diagramsKind: {
    id: 'handbook.card.diagrams.kind',
    defaultMessage: 'Drawn',
    description:
      'The kicker over the Diagrams card. The other kickers on this page name a kind of prose; this one says the section is pictures.',
  },
  diagramsBlurb: {
    id: 'handbook.card.diagrams.blurb',
    defaultMessage:
      'The same architecture, drawn: the core and its host, which decisions still stand, what the app talks to, how the core is layered inside, how somebody signs in, and where an article comes from.',
    description:
      'The sentence under the Diagrams card, and the only card sentence on this page that is not read out of the repository: there is no Markdown document at that route to have written one.',
  },

  conventions: { id: 'handbook.card.conventions', defaultMessage: 'Conventions' },
  conventionsKind: {
    id: 'handbook.card.conventions.kind',
    defaultMessage: 'Rules',
    description: 'The kicker over the Conventions card: what kind of document it is.',
  },

  traps: { id: 'handbook.card.traps', defaultMessage: 'Traps' },
  trapsKind: {
    id: 'handbook.card.traps.kind',
    defaultMessage: 'Hard-won',
    description:
      'The kicker over the Traps card. It says how the document was come by rather than what it is: every line in it was paid for by a failure that passed every check.',
  },

  provenance: { id: 'handbook.card.provenance', defaultMessage: 'Provenance' },
  provenanceKind: {
    id: 'handbook.card.provenance.kind',
    defaultMessage: 'Generated',
    description:
      'The kicker over the Provenance card. It is the one document on this grid that is written by a program out of the repository rather than read out of it.',
  },

  readme: {
    id: 'handbook.card.readme',
    defaultMessage: 'Readme',
    description:
      'The card that opens README.md. It is the file’s own name and keeps its spelling in every language.',
  },
  readmeKind: {
    id: 'handbook.card.readme.kind',
    defaultMessage: 'Start',
    description: 'The kicker over the Readme card: this is the document to arrive at first.',
  },

  release: {
    id: 'handbook.card.release',
    defaultMessage: 'Release',
    description:
      'The card that opens RELEASE.md. It is the file’s own name and keeps its spelling in every language.',
  },
  releaseKind: {
    id: 'handbook.card.release.kind',
    defaultMessage: 'Process',
    description: 'The kicker over the Release card: the document is a sequence of steps.',
  },
});

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
  const intl = useWorkbenchIntl();

  const documents: Card[] = [
    {
      route: '/architecture',
      title: intl.formatMessage(COPY.architecture),
      kind: intl.formatMessage(COPY.architectureKind),
      blurb: blurb('/architecture'),
    },
    {
      route: '/diagrams',
      title: intl.formatMessage(COPY.diagrams),
      kind: intl.formatMessage(COPY.diagramsKind),
      blurb: intl.formatMessage(COPY.diagramsBlurb),
    },
    {
      route: '/conventions',
      title: intl.formatMessage(COPY.conventions),
      kind: intl.formatMessage(COPY.conventionsKind),
      blurb: blurb('/conventions'),
    },
    {
      route: '/traps',
      title: intl.formatMessage(COPY.traps),
      kind: intl.formatMessage(COPY.trapsKind),
      blurb: blurb('/traps'),
    },
    // The one card whose page is not a file. It sits here rather than apart
    // because what it describes is how everything else on this grid stays true.
    {
      route: '/provenance',
      title: intl.formatMessage(COPY.provenance),
      kind: intl.formatMessage(COPY.provenanceKind),
      blurb: blurb('/provenance'),
    },
    {
      route: '/readme',
      title: intl.formatMessage(COPY.readme),
      kind: intl.formatMessage(COPY.readmeKind),
      blurb: blurb('/readme'),
    },
    {
      route: '/release',
      title: intl.formatMessage(COPY.release),
      kind: intl.formatMessage(COPY.releaseKind),
      blurb: blurb('/release'),
    },
  ];

  return (
    <Page>
      <h1 className="text-headline-xl font-bold leading-tight tracking-tight">
        {intl.formatMessage(COPY.title)}
      </h1>
      <p className="mt-xs max-w-content text-l leading-normal text-on-canvas-muted">
        {/* `intl.formatMessage` and never `<FormattedMessage>`: that component reads
            react-intl's own context, which the app's provider shadows inside an
            `AppHost`. `test/i18n.test.ts` fails on one, and `i18n/Localisation.tsx`
            carries the measurement. */}
        {intl.formatMessage(COPY.lede)}
      </p>

      <CardGrid cards={documents} columns={3} />

      <p className="mt-l max-w-content text-m leading-relaxed text-on-canvas-muted">
        {intl.formatMessage(COPY.records)}
      </p>
    </Page>
  );
}
