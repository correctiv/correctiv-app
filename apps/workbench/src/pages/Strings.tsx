import { useMemo, useState, type ReactNode } from 'react';
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
import { group, hasGap, haystackOf, keyOf, lookup, twinsOf } from './strings-model.ts';

const { locales: LOCALES, strings: ENTRIES } = model;

/**
 * Everything this page says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/strings.ts`.
 *
 * **The board is a table of strings, so the line between the two kinds of text on
 * it is unusually easy to see.** What is here is the frame: the heading, the two
 * ledes, the filter, the segment beside it, the empty state and the two small
 * lines a row prints about itself. What is NOT here is every cell: an id, a
 * wording in either language, a description written for a translator and a path
 * into the repository. Those are the rows of the table this page exists to show,
 * and printing a translation of one would be printing something other than the
 * string ([ADR 0052](../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 * That is why the `de` column reads German whatever the setting says.
 *
 * **The column heads are the locale codes and not names**, and that is not an
 * omission either. `de` and `en` are the keys of `translations`, the names of the
 * catalogue directories and the values the setting takes: identifiers, which this
 * site leaves in their own spelling wherever it prints one.
 *
 * This page was English throughout until ADR 0052, on ADR 0050 §2's line, and the
 * argument then was that it is `/sources`'s twin. What moved is the line rather
 * than this page: §2 divided a page by position and 0052 divides it by author, so
 * the board's own frame follows the setting and the rows it prints do not.
 */
const COPY = defineMessages({
  title: {
    id: 'strings.title',
    defaultMessage: 'Strings',
    description:
      'The page’s heading. shell.activity.strings is the rail entry that opens this page and reads the same in English; nav.strings is the longer name the browser tab and the search palette carry.',
  },
  lede: {
    id: 'strings.lede',
    defaultMessage:
      "Every string the app or this site has a descriptor for, joined from the extraction and the catalogues. The two are separate catalogues with separate audiences, so a heading names both the surface and the namespace, and <code>settings.title</code> below is two different strings. A wording with <code>'{braces}'</code> is an ICU pattern, printed as the pattern.",
    description:
      'The first paragraph under the heading. The runs in <code> are an id and a piece of ICU syntax, both left in their own spelling; the braces are escaped so that they print rather than being read as a placeholder.',
  },
  ledeProgress: {
    id: 'strings.lede.progress',
    defaultMessage:
      'The <code>app</code> half is complete but for two strings a user reads that are deliberately not descriptors; <code>apps/mobile/__tests__/localisation-seam.test.ts</code> names both and why. The <code>workbench</code> half is nearly so: every page of this site is here, and what is not is the six architecture drawings, which are labels in an SVG and want a pass of their own. <code>apps/workbench/test/rendered-literals.test.ts</code> counts what is left.',
    description:
      'The second paragraph under the heading, which says how much of each half of the board is really on it. It names no number: an earlier version undercounted and the one after it overclaimed, and the count moves with every string anybody writes. The runs in <code> are the two surface names as the headings below spell them, and two paths in this repository.',
  },

  filter: {
    id: 'strings.filter',
    defaultMessage: 'Filter strings by id, wording or description',
    description:
      'The accessible name of the filter box in the bar above the page. The bar carries no labels above its fields.',
  },
  filterPlaceholder: {
    id: 'strings.filter.placeholder',
    defaultMessage: 'Filter, for example gate., Anmelden or workbench',
    description:
      'The placeholder in that box. The three examples are a namespace, a German wording out of the app’s catalogue and a surface name, one of each; a translation keeps all three as they are, because each is a thing that appears in the table rather than a word.',
  },
  filterSummary: {
    id: 'strings.filter.summary',
    defaultMessage: '{shown} of {total} in {sections, plural, one {# section} other {# sections}}',
    description:
      'The count beside the filter box, which follows what is typed into it and what the segment beside it is set to. {shown} is how many rows are left, {total} how many the board holds altogether, and {sections} how many headings those rows are under.',
  },

  only: {
    id: 'strings.only.legend',
    defaultMessage: 'Which strings',
    description:
      'Read aloud as the group name of the three-way switch beside the filter, and never drawn.',
  },
  onlyAll: {
    id: 'strings.only.all',
    defaultMessage: 'All',
    description:
      'The first of the three choices: no restriction beyond what is typed in the box. components.drawn.all is the same word on /components, where it means every component rather than only the ones this site draws itself.',
  },
  onlySame: {
    id: 'strings.only.same',
    defaultMessage: 'Same English',
    description:
      'The second choice: only the strings whose English is word for word another string’s. strings.row.twins is the line a row prints to say which other ids those are.',
  },
  onlyUntranslated: {
    id: 'strings.only.untranslated',
    defaultMessage: 'Untranslated',
    description:
      'The third choice: only the strings one of the languages has no wording for. strings.row.untranslated is the badge that stands in that language’s cell, and reads the same in English.',
  },

  empty: {
    id: 'strings.empty',
    defaultMessage: 'No string matches that.',
    description:
      'Where the table would be, when nothing is left after the filter and the segment together. It names the thing rather than saying “nothing matches”, which reference.empty and shell.search.empty both do, because two controls narrowed this set and the sentence should say what was being looked for.',
  },
  twins: {
    id: 'strings.row.twins',
    defaultMessage: 'Same English as {ids}',
    description:
      'Under an id whose English is word for word another id’s. {ids} is the other ids, comma-separated, each an identifier and none of them translated.',
  },
  untranslated: {
    id: 'strings.row.untranslated',
    defaultMessage: 'Untranslated',
    description:
      'A badge in the cell of a language that has no wording for this id. strings.only.untranslated is the choice in the switch above that leaves only such rows standing, and reads the same in English.',
  },
});

/**
 * The one run drawn inside both ledes, at module scope.
 *
 * Beside the descriptors rather than inside the render, which is the shape
 * `ui/Settings.tsx` already uses for its three: a component built during a render
 * is remounted on every one of them, and `react/no-unstable-nested-components`
 * says so.
 */
const code = (chunks: ReactNode[]) => <code className="font-mono">{chunks}</code>;

/** The three answers the segment beside the filter gives. */
type Only = 'all' | 'same' | 'untranslated';

const TWINS = twinsOf(ENTRIES);
const HAYSTACK = haystackOf(ENTRIES);

/**
 * Every user-facing string this repository has, in both languages, beside its
 * address.
 *
 * **Two surfaces, one board.** The app's strings and this site's own are separate
 * catalogues on purpose — two audiences, and the app may never depend on the
 * workbench (ADR 0050 §3, ADR 0040). That is a fact about where they live, and the
 * question somebody arrives with does not respect it: they saw a wording on a
 * screen and they do not know, or care, which half of the repository drew it. So
 * the board joins them and states which is which, rather than being two boards a
 * reader has to guess between.
 *
 * `settings.title` is an id in BOTH, and `home` and `settings` are namespaces in
 * both. A heading is therefore a surface and a namespace together, and everything
 * here that maps by a row maps by `keyOf` rather than by the id.
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
        if (only === 'same' && lookup(TWINS, entry) === undefined) return false;
        if (only === 'untranslated' && !hasGap(entry, LOCALES)) return false;
        return q === '' || (lookup(HAYSTACK, entry) ?? '').includes(q);
      }),
    );
  }, [only, query]);

  const shown = groups.reduce((n, section) => n + section.entries.length, 0);

  return (
    <>
      <Slot id="context-bar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-xs">
          <Filter
            id="strings-q"
            label={intl.formatMessage(COPY.filter)}
            placeholder={intl.formatMessage(COPY.filterPlaceholder)}
            value={query}
            onChange={setQuery}
            summary={intl.formatMessage(COPY.filterSummary, {
              shown,
              total: ENTRIES.length,
              sections: groups.length,
            })}
          />
          {/*
            Two facts the free text cannot ask for, as one control rather than two
            checkboxes. "Which ids read the same in English" is not a substring of
            anything, and "which language is missing a wording" is the absence of
            one. Both are properties of the set, so the box answers "contains" and
            the segment answers "is one of these".

            "Untranslated" is empty on any tree that passes its checks, and that is
            structural rather than lucky. Both surfaces are held, by a test each:
            `apps/mobile/__tests__/localisation-seam.test.ts` for the app's ids and
            `apps/workbench/test/i18n.test.ts` for this site's, and each asserts a
            German wording for every extracted id. What the segment is for is the
            half hour before those run — a descriptor added, the catalogue not yet
            written. The board is not what guarantees the zero; those two are.
          */}
          <Segmented
            name="strings-only"
            legend={intl.formatMessage(COPY.only)}
            className="shrink-0"
            value={only}
            options={[
              { value: 'all', label: intl.formatMessage(COPY.onlyAll) },
              { value: 'same', label: intl.formatMessage(COPY.onlySame) },
              { value: 'untranslated', label: intl.formatMessage(COPY.onlyUntranslated) },
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
            {/* `intl.formatMessage` and never `<FormattedMessage>`: that component
                reads react-intl's own context, which the app's provider shadows
                inside an `AppHost`. `test/i18n.test.ts` fails on one, and
                `i18n/Localisation.tsx` carries the measurement. */}
            {intl.formatMessage(COPY.lede, { code })}
          </p>
          <p className="mt-2xs max-w-content text-m leading-relaxed text-on-canvas-muted">
            {/* Said plainly, because the first version of this paragraph said "two
                strings are missing" while the sentence above it had grown to cover
                both surfaces. For the app that was true; for this site it was wrong
                by two orders of magnitude. It has been wrong in the other direction
                since too: it named this page's own heading as one of the strings
                not extracted, which stopped being true the moment the heading
                became `strings.title` above. Both mistakes are the same one, a
                sentence that counts, so this one names no number. */}
            {intl.formatMessage(COPY.ledeProgress, { code })}
          </p>

          {groups.length === 0 && (
            <p className="py-2xl text-center text-m text-on-canvas-muted">
              {intl.formatMessage(COPY.empty)}
            </p>
          )}

          {groups.map((section) => (
            /* `mt` and not `mb`, the same way `/reference` carries it: the filter
               is in the header, so the first section brings its own space. */
            <section className="mt-xl" key={`${section.surface}-${section.name}`}>
              <h2
                id={`ns-${section.surface}-${section.name}`}
                className="scroll-mt-[4.75rem] font-mono text-headline-m font-semibold leading-tight wrap-anywhere"
              >
                {/* The surface is set back from the namespace, because the namespace
                    is what a reader is looking for and the surface is which of the
                    two it is in. Both in the same monospace, because both are
                    identifiers: `app` and `workbench` are the directories these
                    strings come out of and the word the filter box matches on. */}
                <span className="text-on-canvas-muted">{section.surface} · </span>
                {section.name}
              </h2>
              <ul className="mt-s divide-y divide-stroke overflow-hidden rounded-md border border-stroke">
                {section.entries.map((entry) => (
                  /* `keyOf` and not the id, which is unique inside a section today
                     only because `group` cuts on the surface. The list key is the
                     last place that would go wrong silently if it ever stopped. */
                  <li key={keyOf(entry)}>
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
 *
 * **Every cell is printed as it is written.** The id, both wordings, the
 * description and the path are the rows of the board, and the two lines this
 * component says in its own voice are the only things here that follow the
 * language setting.
 */
function Row({ entry }: { entry: StringEntry }) {
  const intl = useWorkbenchIntl();
  const twins = lookup(TWINS, entry);

  return (
    <div className="grid gap-2xs px-s py-s md:grid-cols-[minmax(0,15rem)_1fr] md:gap-m">
      <div className="min-w-0">
        <p className="font-mono text-s font-semibold wrap-anywhere">{entry.id}</p>
        {twins && (
          /* The ids and not a count, because the question a shared wording raises
             is "the same as WHICH one" — and the answer is often in another
             namespace, several screens down the page. */
          <p className="mt-3xs text-s leading-snug text-on-canvas-muted wrap-anywhere">
            {intl.formatMessage(COPY.twins, { ids: twins.join(', ') })}
          </p>
        )}
      </div>

      <div className="min-w-0">
        <dl className="grid gap-2xs lg:grid-cols-2 lg:gap-m">
          {LOCALES.map((locale) => (
            <div key={locale} className="flex min-w-0 items-baseline gap-xs">
              {/* The locale code, which is the key of `translations` and the name of
                  the catalogue directory. An identifier, so it is printed. `min-w` and
                  not `w`: two characters is what `de` and `en` need and not what a tag
                  with a script or a region needs. */}
              <dt className="min-w-[1.5rem] shrink-0 font-mono text-s text-on-canvas-muted">
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
            where the string appears, and that is the question a board of this size
            raises about any of them. Written for a translator, so it is written in
            English and printed in English. */}
        {entry.description && (
          <p className="mt-2xs text-s leading-relaxed text-on-canvas-muted">{entry.description}</p>
        )}

        {/*
          The address of the descriptor BLOCK, which is what FormatJS reports:
          every id in one `COPY` lands on the same line. That is the place to be
          taken to, and it is not a claim about which line the id is on.

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
