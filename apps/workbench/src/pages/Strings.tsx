import { useMemo, useState } from 'react';
import { defineMessages } from 'react-intl';

import model from 'virtual:strings';
import type { StringEntry } from 'virtual:strings';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { Slot } from '../shell/slots';
import { Badge } from '../ui/kit/badge';
import { Segmented } from '../ui/kit/segmented';
import { Filter, Source } from '../ui/Lookup';
import { Page } from '../ui/Page';
import { Toc } from '../ui/Toc';
import { useSections } from '../ui/useSections';
import { group, hasGap, haystackOf, twinsOf } from './strings-model.ts';

const { locales: LOCALES, strings: ENTRIES } = model;

/**
 * The board's own words, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/strings.ts`.
 *
 * Only the furniture is here. Every id, every wording and every path in the rows
 * below is the app's own data and is printed as it is written — the `de` column
 * is German on an English page on purpose, because it is the thing being shown.
 * What follows the language setting is the frame around it, which is
 * [ADR 0050](../../../../adr/0050-the-workbench-gets-a-second-audience.md) §2's
 * line drawn through a page whose body happens to be strings.
 *
 * **The column heads are the locale codes and not descriptors**, and that is not
 * an omission. `de` and `en` are the keys of `translations`, the names of the
 * catalogue directories and the values the setting takes: identifiers, which this
 * site leaves in their own spelling wherever it prints one. It also means a third
 * language costs nothing here, where a `Record` of language names would have to
 * grow a member and a German translation of it before the column could be drawn.
 */
const COPY = defineMessages({
  title: {
    id: 'strings.title',
    defaultMessage: 'Strings',
    description:
      'The heading of the board at /strings. shell.activity.strings is the rail’s entry for the same page and reads the same in English; the page’s full name in the tab is nav.strings.',
  },
  lede: {
    id: 'strings.lede',
    defaultMessage:
      'Every user-facing string the app ships, joined from the extraction and the catalogues.',
  },
  filterLabel: {
    id: 'strings.filter.label',
    defaultMessage: 'Filter strings by id, wording or description',
    description:
      'The accessible name of the board’s filter in the header’s context bar. Read aloud and never drawn; what a sighted reader sees is strings.filter.placeholder.',
  },
  filterPlaceholder: {
    id: 'strings.filter.placeholder',
    defaultMessage: 'e.g. gate. or Anmelden',
    description:
      'Inside the filter box, which is narrow on this page because a second control shares the bar, so this is kept short enough to fit at a laptop width in both languages. The two examples are an id prefix and a German wording, which are the two ways this board is searched; keep an example of each rather than translating these two.',
  },
  summary: {
    id: 'strings.filter.summary',
    defaultMessage:
      '{shown, plural, one {# string} other {# strings}} in {namespaces, plural, one {# namespace} other {# namespaces}}',
    description:
      'What the filter has left standing, beside the box. {shown} is how many strings match and {namespaces} how many namespaces they fall into.',
  },
  which: {
    id: 'strings.filter.which',
    defaultMessage: 'Which strings',
    description:
      'The legend of the three-way choice beside the filter: all of them, the ones sharing an English wording, or the ones a catalogue has no entry for. Read aloud and never drawn.',
  },
  all: {
    id: 'strings.filter.all',
    defaultMessage: 'All',
    description: 'The first of the three segments beside the filter: no restriction at all.',
  },
  sameEnglish: {
    id: 'strings.filter.sameEnglish',
    defaultMessage: 'Same English',
    description:
      'The second segment beside the filter: only the ids whose English is word for word another id’s, which are the ones a translator cannot tell apart.',
  },
  untranslated: {
    id: 'strings.untranslated',
    defaultMessage: 'Untranslated',
    description:
      'Two places, one word: the third segment beside the filter, and the mark drawn in a language’s cell where that catalogue has no entry for the id.',
  },
  twin: {
    id: 'strings.twin',
    defaultMessage: 'Same English as {ids}',
    description:
      'Under an id whose English wording another id carries word for word. {ids} is the comma-separated list of those other ids, which are never translated.',
  },
  empty: {
    id: 'strings.empty',
    defaultMessage: 'No string matches that.',
    description:
      'Stands in for the list when the filter and the segment together leave nothing. shell.search.empty is the palette’s version of the same answer.',
  },
});

/** The three answers the segment beside the filter gives. */
type Only = 'all' | 'same' | 'untranslated';

const TWINS = twinsOf(ENTRIES);
const HAYSTACK = haystackOf(ENTRIES);

/**
 * Every user-facing string the app ships, in both languages, beside its address.
 *
 * `/reference` and `/components` answer "what is there"; this answers "what does
 * it say", which is a question with two audiences. A developer arrives with an id
 * out of a stack trace and wants the line it is written on. Somebody from the
 * newsroom arrives with a wording they saw on a screen and wants the other
 * language of it. Both are lookups, so this is a lookup surface and is built out
 * of the same three parts as the other two: a filter in the context bar, one
 * section per group, a link into the repository at the commit the page was built
 * from.
 *
 * **Not a table**, and that is the one place it departs from `/sources` and
 * `/decisions`. Those print short cells — a date, a status, a count — and a
 * `min-w-[70rem]` box that scrolls sideways is the right answer for them. Nearly
 * everything here is a sentence instead, and a reader comparing two languages is
 * reading two paragraphs against each other, which a column sized by its longest
 * token does not help with. A row is therefore a block: the id on the left, the
 * wordings beside each other on the right, the description and the address under
 * them. It reflows at 390px instead of taking the page sideways, and it grows a
 * column rather than a horizontal scrollbar when a third language arrives.
 *
 * **What is NOT here is the edit.** This reads `virtual:strings`, which is joined
 * at build time out of the extraction and the catalogues, and writing a wording
 * back would mean a commit, a review and an argument about who owns the German —
 * ADR 0050 §1's second audience is named and that question is not answered yet.
 * A board that showed an input and then asked for a pull request would be the
 * worse half of both answers.
 */
export function Strings() {
  const intl = useWorkbenchIntl();
  const [query, setQuery] = useState('');
  const [only, setOnly] = useState<Only>('all');
  const sections = useSections('/strings', true);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return group(
      ENTRIES.filter((entry) => {
        if (only === 'same' && !TWINS.has(entry.id)) return false;
        if (only === 'untranslated' && !hasGap(entry, LOCALES)) return false;
        return q === '' || (HAYSTACK.get(entry.id) ?? '').includes(q);
      }),
    );
  }, [only, query]);

  const shown = groups.reduce((n, namespace) => n + namespace.entries.length, 0);

  return (
    <>
      <Slot id="context-bar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-xs">
          <Filter
            id="strings-q"
            label={intl.formatMessage(COPY.filterLabel)}
            placeholder={intl.formatMessage(COPY.filterPlaceholder)}
            value={query}
            onChange={setQuery}
            summary={intl.formatMessage(COPY.summary, { shown, namespaces: groups.length })}
          />
          {/*
            Two facts the free text cannot ask for, as one control rather than two
            checkboxes. "Which ids read the same in English" is not a substring of
            anything, and "which language is missing a wording" is the absence of
            one. Both are properties of the set, so the box answers "contains" and
            the segment answers "is one of these".
          */}
          <Segmented
            name="strings-only"
            legend={intl.formatMessage(COPY.which)}
            className="shrink-0"
            value={only}
            options={[
              { value: 'all', label: intl.formatMessage(COPY.all) },
              { value: 'same', label: intl.formatMessage(COPY.sameEnglish) },
              { value: 'untranslated', label: intl.formatMessage(COPY.untranslated) },
            ]}
            onChange={(value) => setOnly(value as Only)}
          />
        </div>
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
            {intl.formatMessage(COPY.lede)}
          </p>

          {groups.length === 0 && (
            <p className="py-2xl text-center text-m text-on-canvas-muted">
              {intl.formatMessage(COPY.empty)}
            </p>
          )}

          {groups.map((namespace) => (
            /* `mt` and not `mb`, the same way `/reference` carries it: the filter
               is in the header, so the first section brings its own space. */
            <section className="mt-xl" key={namespace.name}>
              <h2
                id={`ns-${namespace.name}`}
                className="scroll-mt-[4.75rem] font-mono text-headline-m font-semibold leading-tight wrap-anywhere"
              >
                {namespace.name}
              </h2>
              <ul className="mt-s divide-y divide-stroke overflow-hidden rounded-md border border-stroke">
                {namespace.entries.map((entry) => (
                  <li key={entry.id}>
                    <Row entry={entry} />
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

/**
 * One string: what it is called, what it says in each language, where it is
 * written.
 *
 * Two columns from `md` up and one below it, which is the width at which two
 * paragraphs of prose stop fitting beside a column of identifiers. The languages
 * split again at `lg`, so a reader at a desktop width reads them against each
 * other and a reader at tablet width reads them down the page. Nothing here
 * scrolls sideways.
 *
 * The narrow column holds only what is short: the id, and the ids that share its
 * English. Everything made of words — both wordings, the description and the
 * address — is in the wide one.
 */
function Row({ entry }: { entry: StringEntry }) {
  const intl = useWorkbenchIntl();
  const twins = TWINS.get(entry.id);

  return (
    <div className="grid gap-2xs px-s py-s md:grid-cols-[minmax(0,15rem)_1fr] md:gap-m">
      <div className="min-w-0">
        <p className="font-mono text-s font-semibold wrap-anywhere">{entry.id}</p>
        {twins && (
          /* The ids and not a count, because the question a shared wording raises
             is "the same as WHICH one" — and the answer is often in another
             namespace, several screens down the page. */
          <p className="mt-3xs text-s leading-snug text-on-canvas-muted wrap-anywhere">
            {intl.formatMessage(COPY.twin, { ids: twins.join(', ') })}
          </p>
        )}
      </div>

      <div className="min-w-0">
        <dl className="grid gap-2xs lg:grid-cols-2 lg:gap-m">
          {LOCALES.map((locale) => (
            <div key={locale} className="flex min-w-0 items-baseline gap-xs">
              {/* The locale code, which is the key of `translations` and the name
                  of the catalogue directory. An identifier, so it is printed. */}
              <dt className="w-[1.5rem] shrink-0 font-mono text-s text-on-canvas-muted">
                {locale}
              </dt>
              <dd className="min-w-0 flex-1 text-m leading-relaxed">
                {entry.translations[locale] ?? (
                  <Badge variant="outline">{intl.formatMessage(COPY.untranslated)}</Badge>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {/* What a translator is told. Printed for every id that carries one rather
            than only for the ones sharing a wording: it is the sentence that says
            where the string appears, and that is the question a board of 317 rows
            raises about any of them. */}
        {entry.description && (
          <p className="mt-2xs text-s leading-relaxed text-on-canvas-muted">{entry.description}</p>
        )}

        {/*
          In the WIDE column, under the words, and not beside the id where it
          looks like it belongs. A path is one long token and `Source` breaks it
          anywhere rather than take the page sideways: in a 15rem column that put
          `apps/mobile/src/components/r` on one line and `eader/ReaderView.web.tsx`
          on the next, once per row. Here the longest of them has a line to itself
          at every width from `md` up, and below `md` the row is one column and
          nothing in it has more room to offer.
        */}
        <Source file={entry.file} line={entry.line} />
      </div>
    </div>
  );
}
