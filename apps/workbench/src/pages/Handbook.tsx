import { defineMessages } from 'react-intl';

import docsModule from 'virtual:docs';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { CardGrid, type Card } from '../ui/CardGrid';
import { InfoTip } from '../ui/kit/info-tip';
import { Page } from '../ui/Page';

const entry = (route: string) => docsModule.docs.find((d) => d.route === route);

/** The document's own name, out of the registry, which is the one copy of it. */
const named = (route: string) => entry(route)?.nav ?? '';

const blurb = (route: string) => entry(route)?.blurb;

/**
 * Everything this page says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/handbook.ts`.
 *
 * **A card has three parts and only one of them is here.** The kicker above the
 * title is this site's shorthand for what kind of document it is, and it is a
 * message. The title is the document's OWN name, `nav` out of
 * `plugin/registry.ts`, and the sentence under it is that entry's `blurb`. Both
 * of those stay in the one language they are written in, so a German reader gets
 * German kickers over English names and English one-liners, with the English
 * documents themselves one click behind them. That is the mixed page ADR 0052 §1
 * says is the answer, and `/handbook` is the example the record gives for it.
 *
 * **The title was a message for one commit and that was the mistake.** It gave
 * every document two names, and on the German page the card said „Architektur“
 * while the breadcrumb of the page it opened said "Architecture", two centimetres
 * and one click apart. `ui/ActivityBar.tsx`'s `sectionOf()` argues exactly that
 * failure for the rail against the breadcrumb and calls it a thing that reads as
 * a bug; a check holding the two English strings equal was holding a duplication
 * that should not exist instead of removing it. Reading `nav` is the removal.
 *
 * **What that leaves open is named rather than hidden.** `nav` and `blurb` are
 * hand-written in `plugin/registry.ts`, which is this site's own package, so by
 * ADR 0052 §1's own test they are this site's words and would follow the setting.
 * They do not, for one mechanical reason: `i18n:extract` walks `src/` and
 * `plugin/` is not in it, so a descriptor written there extracts to nothing. That
 * is a gap in the record's reach and not a decision it took, and ADR 0052 §5 now
 * says so.
 *
 * The one exception below is the drawings' card, whose document does not exist:
 * there is no `/diagrams` Markdown file, so nothing wrote it a name or a blurb
 * and both are this page's own.
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
    defaultMessage: 'The repository’s own documents, rendered where they live.',
    description:
      'The sentence under the heading, which says what the page is. The rest of what used to be this paragraph is handbook.lede.more, behind the ⓘ at its end.',
  },
  ledeMore: {
    id: 'handbook.lede.more',
    defaultMessage:
      'Nothing here is a copy: the files are the source and this site is a second way to read them, so there is one place to edit and no version that quietly falls behind.',
    description:
      'Behind the ⓘ at the end of the sentence under the heading, followed there by handbook.records.',
  },
  records: {
    id: 'handbook.records',
    defaultMessage:
      'The decisions behind all of it are their own section, because a record is a different kind of document: it is never rewritten, and a claim a later decision made false is struck through where it stands rather than corrected.',
  },

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

  conventionsKind: {
    id: 'handbook.card.conventions.kind',
    defaultMessage: 'Rules',
    description: 'The kicker over the Conventions card: what kind of document it is.',
  },

  trapsKind: {
    id: 'handbook.card.traps.kind',
    defaultMessage: 'Hard-won',
    description:
      'The kicker over the Traps card. It says how the document was come by rather than what it is: every line in it was paid for by a failure that passed every check.',
  },

  provenanceKind: {
    id: 'handbook.card.provenance.kind',
    defaultMessage: 'Generated',
    description:
      'The kicker over the Provenance card. It is the one document on this grid that is written by a program out of the repository rather than read out of it.',
  },

  readmeKind: {
    id: 'handbook.card.readme.kind',
    defaultMessage: 'Start',
    description: 'The kicker over the Readme card: this is the document to arrive at first.',
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
      title: named('/architecture'),
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
      title: named('/conventions'),
      kind: intl.formatMessage(COPY.conventionsKind),
      blurb: blurb('/conventions'),
    },
    {
      route: '/traps',
      title: named('/traps'),
      kind: intl.formatMessage(COPY.trapsKind),
      blurb: blurb('/traps'),
    },
    // The one card whose page is not a file. It sits here rather than apart
    // because what it describes is how everything else on this grid stays true.
    {
      route: '/provenance',
      title: named('/provenance'),
      kind: intl.formatMessage(COPY.provenanceKind),
      blurb: blurb('/provenance'),
    },
    {
      route: '/readme',
      title: named('/readme'),
      kind: intl.formatMessage(COPY.readmeKind),
      blurb: blurb('/readme'),
    },
    {
      route: '/release',
      title: named('/release'),
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
        {intl.formatMessage(COPY.lede)}{' '}
        {/* Why a copy would be wrong, and why the records are elsewhere: both are
            background to a page whose cards already say what each document is. */}
        <InfoTip about={intl.formatMessage(COPY.title)}>
          <p>{intl.formatMessage(COPY.ledeMore)}</p>
          <p>{intl.formatMessage(COPY.records)}</p>
        </InfoTip>
      </p>

      <CardGrid cards={documents} columns={3} />
    </Page>
  );
}
