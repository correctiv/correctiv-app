import { useMemo, useState, type ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import api from 'virtual:api';
import type { ApiModule, ApiSymbol } from 'virtual:api';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { symbolId } from '../nav';
import { href } from '../router';
import { Slot } from '../shell/slots';
import { InfoTip } from '../ui/kit/info-tip';
import { Disclosure, Filter, Source } from '../ui/Lookup';
import { Page } from '../ui/Page';
import { Toc } from '../ui/Toc';
import { useSections } from '../ui/useSections';

const { modules: MODULES, package: PACKAGE } = api.core;

/**
 * Everything this page says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/reference.ts`.
 *
 * **Most of what is on this page is deliberately not in here.** The heading, the
 * lede, the filter and the two lines that stand in for something missing are this
 * site's own words. Everything else a reader sees is TypeDoc out of
 * `packages/app-core`, read through `virtual:api`: a module's subpath and its
 * prose, and a symbol's kind, name, summary, signature and doc comment. Those are
 * comments a developer wrote for a developer, and AGENTS.md keeps them English
 * ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * So a German reader gets a German frame around an English reference, which is
 * the same seam `/components` has one route along.
 *
 * `packages/app-core` and `apps/mobile` stay in their own spelling inside the
 * lede. They are paths, not words.
 */
const COPY = defineMessages({
  title: {
    id: 'reference.title',
    defaultMessage: 'Reference',
    description:
      'The page’s heading. shell.activity.reference is the rail entry that opens this page and shell.search.group.reference is the palette’s group of the symbols on it; the three read the same in English and are three entries because one is a heading, one is a rail entry and one names a group of results.',
  },
  lede: {
    id: 'reference.lede',
    defaultMessage:
      'Every exported symbol in <code>packages/app-core</code>, extracted from the source and its doc comments.',
    description:
      'The sentence under the heading, which says what the page is. The run in <code> is a path in this repository and is left in its own spelling. The rest of what used to be this paragraph is reference.lede.more, behind the ⓘ at its end.',
  },
  ledeMore: {
    id: 'reference.lede.more',
    defaultMessage:
      'The core has no barrel, so a module here is the subpath you import. This is a lookup surface; the architecture pages are the way in. The app’s own components are their own section: <components>Components</components>, which nothing outside <code>apps/mobile</code> can import.',
    description:
      'Behind the ⓘ at the end of the sentence under the heading. The run in <code> is a path in this repository and is left in its own spelling. <components> is the link to /components and the word inside it is that page’s own name.',
  },

  filter: {
    id: 'reference.filter',
    defaultMessage: 'Filter modules and symbols',
    description:
      'The accessible name of the filter box in the bar above the page. The bar carries no labels above its fields.',
  },
  filterPlaceholder: {
    id: 'reference.filter.placeholder',
    defaultMessage: 'Filter, for example loadArticle or stores/',
    description:
      'The placeholder in that box. The two examples are an exported function and a module’s subpath, one of each; a translation keeps them as they are, because they are identifiers in this repository and not words.',
  },
  filterSummary: {
    id: 'reference.filter.summary',
    defaultMessage:
      '{modules, plural, one {# module} other {# modules}}, {symbols, plural, one {# symbol} other {# symbols}}',
    description:
      'The count beside the filter box, which follows what is typed into it. {modules} is how many of the core’s modules still match and {symbols} how many symbols inside them.',
  },

  empty: {
    id: 'reference.empty',
    defaultMessage: 'Nothing matches that.',
    description:
      'Where the list of modules would be, when the filter above the page matches no module and no symbol. shell.search.empty is the same sentence in the search palette and reads the same in English.',
  },
  noDoc: {
    id: 'reference.symbol.noDoc',
    defaultMessage: 'No doc comment.',
    description: 'Stands in, on a symbol’s row, where the core’s source carries no prose to print.',
  },
});

/**
 * The two runs drawn inside `reference.lede`, at module scope.
 *
 * Beside the descriptor rather than inside the render, which is the shape
 * `ui/Settings.tsx` already uses for its three: a component built during a render
 * is remounted on every one of them, and `react/no-unstable-nested-components`
 * says so.
 */
const code = (chunks: ReactNode[]) => <code className="font-mono">{chunks}</code>;

const components = (chunks: ReactNode[]) => (
  <a
    href={href('/components')}
    className="text-on-canvas underline decoration-accent underline-offset-2"
  >
    {chunks}
  </a>
);

/**
 * The core's API, as a place to look something up rather than a site to read.
 *
 * TypeDoc produced this model with `--json` and nothing else. No HTML, no theme.
 * That was the whole reason for choosing it. A generated documentation site would
 * have arrived with its own navigation and its own design, and its pages would
 * have become the front door by accident, ahead of the hand-written architecture
 * pages that are the better way in. Here this site renders the model in its own
 * vocabulary, and the search palette reaches it.
 *
 * `packages/app-core` has no barrel on purpose, so a module IS the import path a
 * caller writes. Each heading prints that line verbatim, because "which subpath
 * do I import" is the question this page most often answers.
 *
 * The core only. The app's own components come out of the same script and are
 * rendered by `pages/Components.tsx`, one route along, because they are not a
 * library: they are reached by the `@/components` alias inside `apps/mobile` and
 * from nowhere else, and a reader who took the two pages for one would look for
 * `ui/Button` under a package that has never held a component. The furniture the
 * two share is in `ui/Lookup.tsx`.
 *
 * A symbol with no prose is shown and marked rather than hidden. The gap is worth
 * seeing: a large share of the core's exported symbols carry no doc comment at
 * all, and the ones that do carry real arguments rather than restatements of
 * their signature. This used to say "167 of the core's 327", which `npm run api`
 * reported as 207 of 365 on 2026-09-18 with nothing anywhere going red. A count
 * of what the build just counted has no business being typed here, so it is not
 * a number with a check under it now; it is no number.
 *
 * The prose is HTML because the comments are Markdown and lean on backticks for
 * every identifier. The build renders it, from this repository's own source at the
 * commit being built, which is the same trust boundary as the documents.
 */
export function Reference() {
  const intl = useWorkbenchIntl();
  const [query, setQuery] = useState('');
  const sections = useSections('/reference', true);

  const modules = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MODULES;
    return MODULES.map((module) => {
      if (module.subpath.toLowerCase().includes(q)) return module;
      const symbols = module.symbols.filter((s) =>
        `${s.name} ${s.summary}`.toLowerCase().includes(q),
      );
      return symbols.length > 0 ? { ...module, symbols } : null;
    }).filter((m): m is ApiModule => m !== null);
  }, [query]);

  const symbolCount = modules.reduce((n, m) => n + m.symbols.length, 0);

  return (
    <>
      <Slot id="context-bar">
        <Filter
          id="ref-q"
          label={intl.formatMessage(COPY.filter)}
          placeholder={intl.formatMessage(COPY.filterPlaceholder)}
          value={query}
          onChange={setQuery}
          summary={intl.formatMessage(COPY.filterSummary, {
            modules: modules.length,
            symbols: symbolCount,
          })}
        />
      </Slot>

      <Slot id="contents">
        <Toc headings={sections} />
      </Slot>

      <Page>
        <article className="min-w-0">
          <h1 className="text-headline-xl font-bold leading-tight tracking-tight">
            {intl.formatMessage(COPY.title)}
          </h1>
          <p className="mt-xs max-w-content text-m leading-relaxed text-on-canvas-muted">
            {/* `intl.formatMessage` and never `<FormattedMessage>`: that component
                reads react-intl's own context, which the app's provider shadows
                inside an `AppHost`. `test/i18n.test.ts` fails on one, and
                `i18n/Localisation.tsx` carries the measurement. */}
            {intl.formatMessage(COPY.lede, { code })}{' '}
            <InfoTip about={intl.formatMessage(COPY.title)}>
              <p>{intl.formatMessage(COPY.ledeMore, { code, components })}</p>
            </InfoTip>
          </p>

          {modules.length === 0 && (
            <p className="py-2xl text-center text-m text-on-canvas-muted">
              {intl.formatMessage(COPY.empty)}
            </p>
          )}

          {modules.map((module) => (
            /* `mt`, not `mb`: the filter used to sit between the lede and the
             first module and carried the space with it. It is in the header now,
             so the first section has to bring its own. */
            <section className="mt-xl" key={module.subpath}>
              <h2
                id={`m-${module.subpath.replace(/\//g, '-')}`}
                className="scroll-mt-[4.75rem] font-mono text-headline-m font-semibold leading-tight wrap-anywhere"
              >
                {module.subpath}
              </h2>
              <p className="mt-3xs break-words font-mono text-s text-on-canvas-muted">
                {`import … from '${PACKAGE}/${module.subpath}'`}
              </p>
              {/* A doc comment rendered by `marked` at build time, unsanitised.
                  `scripts/api.mjs` refuses one that carries script-bearing HTML
                  and the site's Content-Security-Policy refuses inline script;
                  `Document.tsx` has the argument. */}
              {module.doc && (
                <div
                  className="prose prose-sm mt-s max-w-content"
                  dangerouslySetInnerHTML={{ __html: module.doc }}
                />
              )}

              <ul className="mt-s divide-y divide-stroke overflow-hidden rounded-md border border-stroke">
                {module.symbols.map((symbol) => (
                  <li key={symbol.name}>
                    <Symbol module={module} symbol={symbol} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </article>
      </Page>
    </>
  );
}

/** One symbol: what kind of thing it is, its signature and its prose. */
function Symbol({ module, symbol }: { module: ApiModule; symbol: ApiSymbol }) {
  const intl = useWorkbenchIntl();

  return (
    <Disclosure
      id={symbolId(module.subpath, symbol.name)}
      summary={
        <>
          <span className="hidden w-[4.5rem] shrink-0 font-mono text-s text-on-canvas-muted sm:block">
            {symbol.kind}
          </span>
          <span className="shrink-0 font-mono text-m font-semibold">{symbol.name}</span>
          <span className="min-w-0 flex-1 truncate text-s text-on-canvas-muted">
            {/* The symbol's OWN prose, out of the core's source through TypeDoc. It
                is a comment a developer wrote and stays English (ADR 0052 §1); what
                stands in for a missing one is this site's sentence and does not. */}
            {symbol.summary || <span className="italic">{intl.formatMessage(COPY.noDoc)}</span>}
          </span>
        </>
      }
    >
      {symbol.signature && (
        <p className="whitespace-pre-wrap break-words font-mono text-s">{symbol.signature}</p>
      )}
      {symbol.doc && (
        <div
          className="prose prose-sm mt-s max-w-content"
          dangerouslySetInnerHTML={{ __html: symbol.doc }}
        />
      )}
      <Source file={module.file} line={symbol.line} />
    </Disclosure>
  );
}
