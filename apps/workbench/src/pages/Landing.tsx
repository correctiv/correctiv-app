import { ArrowRight } from 'lucide-react';

import { COUNTS, FEEDS, MEASURED_ON } from '../../content/sources.manifest';
import { ageInWords } from '../lib/measured';
import docsModule from 'virtual:docs';
import { Badge } from '../ui/kit/badge';
import { cn } from '../lib/cn';
import { href } from '../router';
import { Page } from '../ui/Page';

interface Door {
  route: string;
  kind: string;
  title: string;
  blurb: string;
  primary?: boolean;
}

const DOORS: Door[] = [
  {
    route: '/preview',
    kind: 'The app, running',
    title: 'Preview',
    blurb:
      'The app itself at device size, with an inspector for its state, its console, its palette and its layout. No install and no emulator, and the address reproduces exactly what you see.',
    primary: true,
  },
  {
    route: '/sources',
    kind: 'Inventory',
    title: 'Sources',
    blurb:
      'For everything the app shows: whether it is a live source, a file standing in for an API that does not exist yet, or a wanted feature with nothing to read at all.',
  },
  {
    route: '/handbook',
    kind: 'Written down',
    title: 'Handbook',
    blurb:
      'What the system is and how to work in it: the architecture, the drawings of it, the conventions, and the traps that pass every check.',
  },
  {
    route: '/decisions',
    kind: 'Records',
    title: 'Decisions',
    blurb: 'Why the repository is the way it is, and which of its claims have since expired.',
  },
  {
    route: '/design',
    kind: 'Drawn by hand',
    title: 'Design',
    blurb: 'The Figma file the screens come from, and the three places it reaches the code.',
  },
];

const RECORDS = docsModule.docs.filter((d) => d.route.startsWith('/decisions/')).length;
const RETIRED = docsModule.docs.reduce((n, d) => n + d.retired.length, 0);

/** The status strip, read off the manifest so no figure on this page was typed. */
const FIGURES: { label: string; value: number }[] = [
  { label: 'Live sources', value: COUNTS.live },
  { label: 'Sample data sets', value: COUNTS.sample },
  { label: 'Wanted, with no source', value: COUNTS.noSource },
  { label: 'Open editorial questions', value: COUNTS.questions },
];

/**
 * The front page, which is an introduction and not a dashboard.
 *
 * Every figure on it comes from `content/sources.manifest.ts` or from the parsed
 * documents, never from a number typed here. Two of them were typed by hand in
 * the first draft and disagreed with the sources page by four, which is exactly
 * the failure a website makes easy: two pages, two counts, both confident.
 */
export function Landing() {
  return (
    <Page>
      <div className="min-w-0">
        <section>
          <h1
            id="title"
            className="max-w-content text-headline-xxl font-bold leading-tight tracking-tight"
          >
            The CORRECTIV app, and everything written down about it
          </h1>
          <p className="mt-sm max-w-content text-l leading-relaxed">
            A community app for CORRECTIV members, built as one platform-free core with the Expo app
            as its host. The core holds every piece of behaviour and imports no UI framework and no
            platform SDK, which is why replacing the whole view layer once cost no behaviour at all.
          </p>
          <p className="mt-s max-w-content text-m leading-relaxed text-on-canvas-muted">
            This workbench publishes the repository’s own documents, unchanged and in place, and
            puts the running app next to them.
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
              <h2
                id="status-heading"
                className="text-s font-semibold uppercase tracking-wider text-on-canvas-muted"
              >
                What the app reads
              </h2>
              <p className="mt-xs text-m leading-relaxed text-on-canvas-muted">
                One per manifest entry, which is why the board counts more: it draws the article
                family as its {FEEDS.length} feeds, because a feed is the thing that goes stale. The
                figures come from a run against the live sources on {MEASURED_ON},{' '}
                {ageInWords(MEASURED_ON)}, which a weekly job re-takes. Nothing refreshes while you
                read this, because the feeds send no CORS header for a browser to re-take them
                through.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-sm self-start sm:grid-cols-4 lg:gap-m">
              {FIGURES.map((figure) => (
                // The label above and the figure pushed to the bottom, so four
                // figures share a baseline however many lines their labels take.
                <div key={figure.label} className="flex h-full flex-col">
                  <dt className="text-s leading-snug text-on-canvas-muted">{figure.label}</dt>
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
            Where to go
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
                    {door.kind}
                  </Badge>
                  <h3 className="mt-s flex items-center gap-xs text-headline-m font-semibold leading-tight">
                    {door.title}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-[1rem] text-on-canvas-muted transition-transform group-hover:translate-x-3xs"
                    />
                  </h3>
                  <p className="mt-2xs text-m leading-relaxed text-on-canvas-muted">{door.blurb}</p>
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
            How the repository is laid out
          </h2>
          <dl className="mt-s divide-y divide-stroke border-y border-stroke">
            <div className="grid gap-2xs py-s md:grid-cols-[16rem_1fr] md:gap-m">
              <dt>
                <code className="rounded-s border border-stroke bg-surface px-3xs py-4xs font-mono text-s">
                  packages/app-core
                </code>
              </dt>
              <dd className="max-w-content text-m leading-relaxed text-on-canvas-muted">
                The model, the parsers, the services, the caches and all of the state. It imports no
                UI framework and no platform SDK, and a test fails the build if that ever changes.
              </dd>
            </div>
            <div className="grid gap-2xs py-s md:grid-cols-[16rem_1fr] md:gap-m">
              <dt>
                <code className="rounded-s border border-stroke bg-surface px-3xs py-4xs font-mono text-s">
                  apps/mobile
                </code>
              </dt>
              <dd className="max-w-content text-m leading-relaxed text-on-canvas-muted">
                The Expo app: iOS, Android and a web target. It holds the screens and one file
                implementing the ports.
              </dd>
            </div>
            <div className="grid gap-2xs py-s md:grid-cols-[16rem_1fr] md:gap-m">
              <dt>
                <code className="rounded-s border border-stroke bg-surface px-3xs py-4xs font-mono text-s">
                  packages/design-tokens
                </code>
              </dt>
              <dd className="max-w-content text-m leading-relaxed text-on-canvas-muted">
                The shared palette. CORRECTIV’s WordPress CMS consumes the same values, and so does
                this workbench, which is why no page here can fork the colours.
              </dd>
            </div>
            <div className="grid gap-2xs py-s md:grid-cols-[16rem_1fr] md:gap-m">
              <dt>
                <code className="rounded-s border border-stroke bg-surface px-3xs py-4xs font-mono text-s">
                  adr/
                </code>
              </dt>
              <dd className="max-w-content text-m leading-relaxed text-on-canvas-muted">
                {RECORDS} records. A record is never rewritten to look right in hindsight: a claim a
                later decision made false is struck through where it stands, and {RETIRED} of them
                are.
              </dd>
            </div>
          </dl>
        </section>

        <footer className="mt-2xl border-t border-stroke pt-sm text-s text-on-canvas-muted">
          <p>
            AGPL-3.0-or-later ·{' '}
            <a
              href={docsModule.repo}
              target="_blank"
              rel="noreferrer noopener"
              className="text-on-canvas underline decoration-accent underline-offset-2"
            >
              faktenforum/correctiv-app
            </a>{' '}
            · built from{' '}
            <a
              href={`${docsModule.repo}/commit/${docsModule.commit}`}
              target="_blank"
              rel="noreferrer noopener"
              className="font-mono text-on-canvas underline decoration-accent underline-offset-2"
            >
              {docsModule.commit.slice(0, 7)}
            </a>
          </p>
        </footer>
      </div>
    </Page>
  );
}
