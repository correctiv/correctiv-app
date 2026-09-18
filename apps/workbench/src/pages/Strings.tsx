import { useMemo, useState } from 'react';

import model from 'virtual:strings';
import type { StringEntry } from 'virtual:strings';
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
 * **This page's own words are English, like every other board on this site.**
 *
 * A first version translated the heading, the lede and the filter, on the grounds
 * that a reader from the newsroom is who the board is for.
 * [ADR 0050](../../../../adr/0050-the-workbench-gets-a-second-audience.md) draws the
 * line elsewhere and a cold review caught it: §1 names the audience as somebody
 * arranging the home screen and excludes a translator by name, and §2 puts the body
 * of a publishing page on the English side, the sources board included. This is that
 * board's twin — a generated table with a heading, a lede and a filter — so it reads
 * the way `/sources`, `/reference` and `/components` read, and `nav.strings` and
 * `shell.activity.strings` stay German because the rail and the tab are the shell.
 *
 * Widening that audience may well be right, now that the strings have somewhere to be
 * looked at. It is a boundary, so it wants a record rather than a page that quietly
 * sits on the other side of one.
 *
 * Every id, every wording and every path below is data and is printed as it is
 * written, which is why the `de` column is German on an English page.
 *
 * **The column heads are the locale codes and not names**, and that is not an
 * omission. `de` and `en` are the keys of `translations`, the names of the catalogue
 * directories and the values the setting takes: identifiers, which this site leaves in
 * their own spelling wherever it prints one.
 */

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
            label="Filter strings by id, wording or description"
            placeholder="Filter, for example gate., Anmelden or workbench"
            value={query}
            onChange={setQuery}
            summary={`${shown} of ${ENTRIES.length} in ${groups.length} sections`}
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
            legend="Which strings"
            className="shrink-0"
            value={only}
            options={[
              { value: 'all', label: 'All' },
              { value: 'same', label: 'Same English' },
              { value: 'untranslated', label: 'Untranslated' },
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
          <h1 className="text-headline-xl font-bold leading-tight tracking-tight">Strings</h1>
          <p className="mt-xs max-w-content text-m leading-relaxed text-on-canvas-muted">
            Every string the app or this site has a descriptor for, joined from the extraction and
            the catalogues. The two are separate catalogues with separate audiences, so a heading
            names both the surface and the namespace, and{' '}
            <code className="font-mono">settings.title</code> below is two different strings. A
            wording with <code className="font-mono">{'{braces}'}</code> is an ICU pattern, printed
            as the pattern.
          </p>
          <p className="mt-2xs max-w-content text-m leading-relaxed text-on-canvas-muted">
            {/* Said plainly, because the first version of this page said "two strings
                are missing" while the sentence above it had grown to cover both
                surfaces. For the app that was true; for this site it was wrong by two
                orders of magnitude, and this page's own heading is one of them. */}
            The <code className="font-mono">app</code> half is complete but for two strings a user
            reads that are deliberately not descriptors;{' '}
            <code className="font-mono">apps/mobile/__tests__/localisation-seam.test.ts</code> names
            both and why. The <code className="font-mono">workbench</code> half is not: much of what
            this site says is still written into its own markup rather than extracted, and what is
            below is what has been. This page&apos;s heading is one of the ones that has not.
          </p>

          {groups.length === 0 && (
            <p className="py-2xl text-center text-m text-on-canvas-muted">
              No string matches that.
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
 */
function Row({ entry }: { entry: StringEntry }) {
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
            Same English as {twins.join(', ')}
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
                {entry.translations[locale] ?? <Badge variant="outline">Untranslated</Badge>}
              </dd>
            </div>
          ))}
        </dl>

        {/* What a translator is told. Printed for every id that carries one rather
            than only for the ones sharing a wording: it is the sentence that says
            where the string appears, and that is the question a board of this size
            raises about any of them. */}
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
