import { ArrowRight } from 'lucide-react';
import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { ReactNode } from 'react';

import { COUNTS, FEEDS, MEASURED_ON } from '../../content/sources.manifest';
import { ageInWords } from '../lib/measured';
import docsModule from 'virtual:docs';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { Badge } from '../ui/kit/badge';
import { InfoTip } from '../ui/kit/info-tip';
import { cn } from '../lib/cn';
import { href } from '../router';
import { Page } from '../ui/Page';

/**
 * Everything this page says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/landing.ts`.
 *
 * **The front page is entirely this site's own words**, which makes it the
 * simplest case of [ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md)
 * §1 and not an uninteresting one: the page reads three things out of the
 * repository and translates none of them. The four figures and the measuring day
 * come from `content/sources.manifest.ts`, which §4 keeps as a ledger; the record
 * and struck-claim counts are counted off the parsed documents; the commit is the
 * build's. Every one of those is a NUMBER or an identifier arriving as a value,
 * so nothing crosses the line in either direction, and the sentences around them
 * are ours.
 *
 * `docsModule.docs[].blurb` — the one-liner the repository writes about each of
 * its own documents — is the thing on the other side of that line, and this page
 * does not use it. `pages/Handbook.tsx` does, and its docblock argues the seam.
 * The five door blurbs below are written here, about sections of this site rather
 * than about files, so they are messages.
 */
const COPY = defineMessages({
  title: {
    id: 'landing.title',
    defaultMessage: 'The CORRECTIV app, and everything written down about it',
  },
  lede: {
    id: 'landing.lede',
    defaultMessage:
      'A community app for CORRECTIV members. All of its behaviour lives in one core that depends on no platform. The Expo app is the host that brings it to iOS, Android and the web. That is why the whole view layer could once be replaced without losing any behaviour.',
  },
  note: {
    id: 'landing.note',
    defaultMessage:
      'This workbench shows the repository’s own documents, unchanged, and puts the running app beside them.',
  },

  statusHeading: {
    id: 'landing.status.heading',
    defaultMessage: 'What the app reads',
    description:
      'The heading over the four figures, read aloud as the name of that section. What follows it is a count per manifest entry rather than per feed, which the ⓘ beside it explains.',
  },
  statusWhen: {
    id: 'landing.status.when',
    defaultMessage: 'Measured against the live sources on {measured}, {age}.',
    description:
      'The line under the heading over the four figures, always drawn: how fresh they are. {measured} is the ISO day of the last run and is printed as written; {age} is how long ago that was, formatted from measured.age, so the sentence says the same thing twice over.',
  },
  statusWhy: {
    id: 'landing.status.why',
    defaultMessage:
      'One figure per manifest entry. The sources page counts more rows, because it lists the articles as their {feeds} feeds: a feed is what goes stale. A weekly job measures the figures again. They do not refresh while you read, because the feeds do not let a browser fetch them.',
    description:
      'Behind the ⓘ beside the heading over the four figures. {feeds} is how many article feeds the manifest lists, which is more than the one entry they are counted as here. “The board” is /sources.',
  },

  figureLive: {
    id: 'landing.figure.live',
    defaultMessage: 'Live sources',
    description:
      'The first of the four figures: entries the app reads from an endpoint that answers today.',
  },
  figureSample: {
    id: 'landing.figure.sample',
    defaultMessage: 'Sample data sets',
    description:
      'The second of the four figures: a checked-in file standing in for an API that does not exist yet.',
  },
  figureNoSource: {
    id: 'landing.figure.noSource',
    defaultMessage: 'Wanted, with no source',
    description:
      'The third of the four figures: something the app is meant to show and has nothing at all to read for.',
  },
  figureQuestions: {
    id: 'landing.figure.questions',
    defaultMessage: 'Open editorial questions',
    description:
      'The fourth of the four figures: questions the sources board raises that only the newsroom can answer.',
  },

  doorsHeading: {
    id: 'landing.doors.heading',
    defaultMessage: 'Where to go',
    description: 'The heading over the five cards that open the sections of this site.',
  },

  previewKind: {
    id: 'landing.door.preview.kind',
    defaultMessage: 'The app, running',
    description:
      'The badge over the Preview card, saying what kind of thing is behind it. shell.activity.app is the rail’s shorter word for the same section.',
  },
  previewTitle: {
    id: 'landing.door.preview.title',
    defaultMessage: 'Preview',
    description:
      'The Preview card’s own name, on the front page. nav.preview is the same word as the page’s name in the browser tab and in the search palette.',
  },
  previewBlurb: {
    id: 'landing.door.preview.blurb',
    defaultMessage:
      'The app itself, at device size, with tools for its state, its console, its colours and its layout. Nothing to install. The address in the browser brings back exactly what you see.',
  },

  sourcesKind: {
    id: 'landing.door.sources.kind',
    defaultMessage: 'Inventory',
    description: 'The badge over the Sources card: the section is a list of what exists.',
  },
  sourcesTitle: {
    id: 'landing.door.sources.title',
    defaultMessage: 'Sources',
    description:
      'The Sources card’s own name, on the front page. shell.activity.sources is the same word on the rail; nav.sources is the longer name the browser tab carries.',
  },
  sourcesBlurb: {
    id: 'landing.door.sources.blurb',
    defaultMessage:
      'For everything the app shows: is it live, a stand-in file for an API that does not exist yet, or a wanted feature with no source?',
  },

  handbookKind: {
    id: 'landing.door.handbook.kind',
    defaultMessage: 'Written down',
    description: 'The badge over the Handbook card: the section is prose somebody wrote.',
  },
  handbookTitle: {
    id: 'landing.door.handbook.title',
    defaultMessage: 'Handbook',
    description:
      'The Handbook card’s own name, on the front page. shell.activity.handbook is the same word on the rail and in a document’s breadcrumb; nav.handbook is the page’s name in the browser tab.',
  },
  handbookBlurb: {
    id: 'landing.door.handbook.blurb',
    defaultMessage:
      'What the system is and how to work in it: the architecture, drawings of it, the conventions, and the traps that pass every check.',
  },

  decisionsKind: {
    id: 'landing.door.decisions.kind',
    defaultMessage: 'Records',
    description:
      'The badge over the Decisions card. A record is a kind of document that is never rewritten, which the row about adr/ further down the page states.',
  },
  decisionsTitle: {
    id: 'landing.door.decisions.title',
    defaultMessage: 'Decisions',
    description:
      'The Decisions card’s own name, on the front page. shell.activity.decisions is the same word on the rail; nav.decisions is the longer name the browser tab carries.',
  },
  decisionsBlurb: {
    id: 'landing.door.decisions.blurb',
    defaultMessage: 'Why the repository is the way it is, and which of its claims no longer hold.',
  },

  designKind: {
    id: 'landing.door.design.kind',
    defaultMessage: 'Drawn by hand',
    description:
      'The badge over the Design card. It says the section is a drawing rather than prose or a list, and that a person drew it.',
  },
  designTitle: {
    id: 'landing.door.design.title',
    defaultMessage: 'Design',
    description:
      'The Design card’s own name, on the front page. shell.activity.design is the same word on the rail, design.title is the heading of the page it opens, and nav.design is the longer name the browser tab carries.',
  },
  designBlurb: {
    id: 'landing.door.design.blurb',
    defaultMessage: 'The Figma file behind the screens, and where it connects to the code.',
  },

  layoutHeading: {
    id: 'landing.layout.heading',
    defaultMessage: 'How the repository is laid out',
    description:
      'The heading over the four rows naming a directory of this repository and saying what is in it. The directory names themselves are paths and stay as they are.',
  },
  layoutCore: {
    id: 'landing.layout.core',
    defaultMessage:
      'The model, the parsers, the services, the caches and all of the state. It uses no UI framework and no platform SDK. A test stops the build if that changes.',
  },
  layoutMobile: {
    id: 'landing.layout.mobile',
    defaultMessage:
      'The Expo app for iOS, Android and the web. It holds the screens and one file that implements the ports.',
  },
  layoutTokens: {
    id: 'landing.layout.tokens',
    defaultMessage:
      'The shared colour palette. CORRECTIV’s WordPress CMS uses the same values, and so does this workbench. So no page here can use colours of its own.',
  },
  layoutRecords: {
    id: 'landing.layout.records',
    defaultMessage:
      '{records, plural, one {# record} other {# records}}. A record is never rewritten later. When a later decision makes a claim false, the claim is struck through where it stands. So far {retired, plural, one {# claim is} other {# claims are}} struck.',
    description:
      'The row about adr/. {records} is how many records the site publishes; {retired} is how many claims are struck through, counted over every document this site renders rather than over the records alone.',
  },

  footer: {
    id: 'landing.footer',
    defaultMessage:
      '{licence} · <repoLink>{repo}</repoLink> · built from <commitLink>{commit}</commitLink>',
    description:
      'The line at the foot of the front page. {licence} is the SPDX identifier of this repository’s licence, {repo} its name on GitHub and {commit} the seven-character hash this site was built from; all three are identifiers and arrive as values so that none of them is translated. <repoLink> and <commitLink> are the two links.',
  },
});

/**
 * The two links drawn inside `landing.footer`, at module scope.
 *
 * Beside the descriptor rather than inside the render, which is the shape
 * `ui/Settings.tsx` and `pages/Components.tsx` already use: a component built
 * during a render is remounted on every one of them, and
 * `react/no-unstable-nested-components` says so.
 */
const OUTSIDE = 'text-on-canvas underline decoration-accent underline-offset-2';

const repoLink = (chunks: ReactNode[]) => (
  <a href={docsModule.repo} target="_blank" rel="noreferrer noopener" className={OUTSIDE}>
    {chunks}
  </a>
);

const commitLink = (chunks: ReactNode[]) => (
  <a
    href={`${docsModule.repo}/commit/${docsModule.commit}`}
    target="_blank"
    rel="noreferrer noopener"
    className={cn('font-mono', OUTSIDE)}
  >
    {chunks}
  </a>
);

/** This repository's licence and its name on GitHub. Identifiers, not words. */
const LICENCE = 'AGPL-3.0-or-later';
const REPOSITORY = 'correctiv/correctiv-app';

interface Door {
  route: string;
  kind: MessageDescriptor;
  title: MessageDescriptor;
  blurb: MessageDescriptor;
  primary?: boolean;
}

const DOORS: Door[] = [
  {
    route: '/preview',
    kind: COPY.previewKind,
    title: COPY.previewTitle,
    blurb: COPY.previewBlurb,
    primary: true,
  },
  { route: '/sources', kind: COPY.sourcesKind, title: COPY.sourcesTitle, blurb: COPY.sourcesBlurb },
  {
    route: '/handbook',
    kind: COPY.handbookKind,
    title: COPY.handbookTitle,
    blurb: COPY.handbookBlurb,
  },
  {
    route: '/decisions',
    kind: COPY.decisionsKind,
    title: COPY.decisionsTitle,
    blurb: COPY.decisionsBlurb,
  },
  { route: '/design', kind: COPY.designKind, title: COPY.designTitle, blurb: COPY.designBlurb },
];

const RECORDS = docsModule.docs.filter((d) => d.route.startsWith('/decisions/')).length;
const RETIRED = docsModule.docs.reduce((n, d) => n + d.retired.length, 0);

/** The status strip, read off the manifest so no figure on this page was typed. */
const FIGURES: { id: string; label: MessageDescriptor; value: number }[] = [
  { id: 'live', label: COPY.figureLive, value: COUNTS.live },
  { id: 'sample', label: COPY.figureSample, value: COUNTS.sample },
  { id: 'noSource', label: COPY.figureNoSource, value: COUNTS.noSource },
  { id: 'questions', label: COPY.figureQuestions, value: COUNTS.questions },
];

/** The row a directory of this repository gets, and the box its name sits in. */
const ROW = 'grid gap-2xs py-s md:grid-cols-[16rem_1fr] md:gap-m';
const PATH = 'rounded-s border border-stroke bg-surface px-3xs py-4xs font-mono text-s';
const WHAT = 'max-w-content text-m leading-relaxed text-on-canvas-muted';

/**
 * The front page, which is an introduction and not a dashboard.
 *
 * Every figure on it comes from `content/sources.manifest.ts` or from the parsed
 * documents, never from a number typed here. Two of them were typed by hand in
 * the first draft and disagreed with the sources page by four, which is exactly
 * the failure a website makes easy: two pages, two counts, both confident.
 */
export function Landing() {
  const intl = useWorkbenchIntl();

  return (
    <Page>
      <div className="min-w-0">
        <section>
          <h1
            id="title"
            className="max-w-content text-headline-xxl font-bold leading-tight tracking-tight"
          >
            {intl.formatMessage(COPY.title)}
          </h1>
          <p className="mt-sm max-w-content text-l leading-relaxed">
            {/* `intl.formatMessage` and never `<FormattedMessage>`: that component
                reads react-intl's own context, which the app's provider shadows
                inside an `AppHost`. `test/i18n.test.ts` fails on one, and
                `i18n/Localisation.tsx` carries the measurement. */}
            {intl.formatMessage(COPY.lede)}
          </p>
          <p className="mt-s max-w-content text-m leading-relaxed text-on-canvas-muted">
            {intl.formatMessage(COPY.note)}
          </p>
        </section>

        <section
          aria-labelledby="status-heading"
          className="mt-xl rounded-md border border-stroke bg-surface p-m"
        >
          {/* A grid rather than a flex row: the caption needs a measure of its
              own, and beside four figures a flex child collapses to a column of
              two words a line. */}
          <div className="grid gap-m lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-xl">
            <div>
              <div className="flex items-center gap-xs">
                <h2
                  id="status-heading"
                  className="text-s font-semibold uppercase tracking-wider text-on-canvas-muted"
                >
                  {intl.formatMessage(COPY.statusHeading)}
                </h2>
                <InfoTip about={intl.formatMessage(COPY.statusHeading)}>
                  <p>{intl.formatMessage(COPY.statusWhy, { feeds: FEEDS.length })}</p>
                </InfoTip>
              </div>
              {/* The day stays on the page: it is how fresh the four figures are.
                  The age goes in as a value out of `lib/measured.ts`, which is the
                  one place this site says it, rather than as a second copy of the
                  same plural. It is still a hole in this sentence, so German can
                  put it where German wants it. */}
              <p className="mt-xs text-m leading-relaxed text-on-canvas-muted">
                {intl.formatMessage(COPY.statusWhen, {
                  measured: MEASURED_ON,
                  age: ageInWords(intl, MEASURED_ON),
                })}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-sm self-start sm:grid-cols-4 lg:gap-m">
              {FIGURES.map((figure) => (
                // The label above and the figure pushed to the bottom, so four
                // figures share a baseline however many lines their labels take.
                <div key={figure.id} className="flex h-full flex-col">
                  <dt className="text-s leading-snug text-on-canvas-muted">
                    {intl.formatMessage(figure.label)}
                  </dt>
                  <dd className="mt-auto pt-3xs text-headline-xl font-bold leading-tight tabular-nums">
                    {figure.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <nav aria-labelledby="doors-heading" className="mt-2xl">
          <h2
            id="doors-heading"
            className="text-s font-semibold uppercase tracking-wider text-on-canvas-muted"
          >
            {intl.formatMessage(COPY.doorsHeading)}
          </h2>
          <ul className="mt-s grid gap-s sm:grid-cols-2 lg:grid-cols-6">
            {DOORS.map((door) => (
              /* The app takes a row to itself and the other four share two, which
                 is 6 and 3 + 3 in a six-column grid. Three and four twos came to
                 eleven and left a hole in the first row. */
              <li key={door.route} className={door.primary ? 'lg:col-span-6' : 'lg:col-span-3'}>
                <a
                  href={href(door.route)}
                  className={cn(
                    'group flex h-full flex-col rounded-md border border-stroke p-m transition-colors',
                    'hover:border-stroke-strong hover:bg-surface',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
                    door.primary ? 'bg-surface' : 'bg-canvas',
                  )}
                >
                  {/* `self-start`, because a badge stretched across the card is a
                      banner and reads as one. */}
                  <Badge variant={door.primary ? 'accent' : 'outline'} className="self-start">
                    {intl.formatMessage(door.kind)}
                  </Badge>
                  <h3 className="mt-s flex items-center gap-xs text-headline-m font-semibold leading-tight">
                    {intl.formatMessage(door.title)}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-[1rem] text-on-canvas-muted transition-transform group-hover:translate-x-3xs"
                    />
                  </h3>
                  <p className="mt-2xs text-m leading-relaxed text-on-canvas-muted">
                    {intl.formatMessage(door.blurb)}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="layout-heading" className="mt-2xl">
          <h2
            id="layout-heading"
            className="text-s font-semibold uppercase tracking-wider text-on-canvas-muted"
          >
            {intl.formatMessage(COPY.layoutHeading)}
          </h2>
          <dl className="mt-s divide-y divide-stroke border-y border-stroke">
            {/* The four directory names stay where they are, in the markup and
                in their own spelling: nothing about `packages/app-core` is a
                word, and `adr/` is a folder. The line beside each is a
                sentence and is a message. */}
            <div className={ROW}>
              <dt>
                <code className={PATH}>packages/app-core</code>
              </dt>
              <dd className={WHAT}>{intl.formatMessage(COPY.layoutCore)}</dd>
            </div>
            <div className={ROW}>
              <dt>
                <code className={PATH}>apps/mobile</code>
              </dt>
              <dd className={WHAT}>{intl.formatMessage(COPY.layoutMobile)}</dd>
            </div>
            <div className={ROW}>
              <dt>
                <code className={PATH}>packages/design-tokens</code>
              </dt>
              <dd className={WHAT}>{intl.formatMessage(COPY.layoutTokens)}</dd>
            </div>
            <div className={ROW}>
              <dt>
                <code className={PATH}>adr/</code>
              </dt>
              <dd className={WHAT}>
                {intl.formatMessage(COPY.layoutRecords, { records: RECORDS, retired: RETIRED })}
              </dd>
            </div>
          </dl>
        </section>

        <footer className="mt-2xl border-t border-stroke pt-sm text-s text-on-canvas-muted">
          <p>
            {intl.formatMessage(COPY.footer, {
              licence: LICENCE,
              repo: REPOSITORY,
              commit: docsModule.commit.slice(0, 7),
              repoLink,
              commitLink,
            })}
          </p>
        </footer>
      </div>
    </Page>
  );
}
