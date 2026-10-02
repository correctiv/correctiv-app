import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import api from 'virtual:api';
import type { ApiComponent, ApiComponentGroup } from 'virtual:api';
import { useWorkbenchIntl } from '../i18n/Localisation';
import { directEntry, DRAWN_IDS } from '../components/direct';
import { NOT_DRAWN } from '../components/direct-ids';
import { DirectPreview } from '../components/DirectPreview';
import { href, navigate } from '../router';
import { Slot } from '../shell/slots';
import { Badge } from '../ui/kit/badge';
import { PreviewCard, type PreviewCardCrop } from '../ui/kit/PreviewCard';
import { InfoTip } from '../ui/kit/info-tip';
import { Segmented } from '../ui/kit/segmented';
import { Filter, Source } from '../ui/Lookup';
import { Page } from '../ui/Page';
import { Toc } from '../ui/Toc';
import { useSections } from '../ui/useSections';

const { alias, groups, root } = api.components;

/**
 * Everything this page says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/components.ts`.
 *
 * **What is here and what is not is the whole of ADR 0052 on one page.** The
 * heading, the lede, the filter, the segment and every line a card prints about
 * itself are this site's own words and are here. The sentence under each
 * component's name is not: it is the JSDoc comment out of
 * `apps/mobile/src/components`, read through `virtual:api`, and AGENTS.md keeps
 * a comment English because a developer reads it. The two sit a centimetre apart
 * on this page, which is why the line ADR 0050 §2 drew by position could not be
 * finished here.
 */
const COPY = defineMessages({
  title: {
    id: 'components.title',
    defaultMessage: 'Components',
    description:
      'The page’s heading. components.detail.crumb is the same word as the first step of the breadcrumb on a single component’s page, which links back here; nav.components is the longer name the rail and the browser tab carry.',
  },
  lede: {
    id: 'components.lede',
    defaultMessage:
      'Every component the app builds its screens from, taken out of <code>{root}</code> with its props, their types and whatever prose the source carries.',
    description:
      'The sentence under the heading, which says what the page is. {root} is the directory the components are read out of, drawn in monospace, and is a path rather than a word. The rest of what used to be this paragraph is components.lede.more, behind the ⓘ at its end.',
  },
  ledeMore: {
    id: 'components.lede.more',
    defaultMessage:
      'Each card draws its component from the app’s source, inside this site. If a card is too small for the whole component, it says so at its lower edge. The component’s own page shows every specimen in full, the app’s own rendering beside it, and a device size. The core’s exports have their own section: <reference>Reference</reference>.',
    description:
      'Behind the ⓘ at the end of the sentence under the heading. <reference> is the link to /reference and the word inside it is that page’s own name.',
  },

  prose: {
    id: 'components.prose',
    defaultMessage:
      'The sentence under each name is the component’s doc comment from the app’s source. It stays in English, because comments are written for the people who read the code.',
    description:
      'Behind the ⓘ at the end of the sentence under the heading, after components.lede.more. It exists because a German reader meets English prose on every card and is otherwise not told why. Nothing on this page can translate it — it is a JSDoc comment in apps/mobile, and this site prints it as it is written.',
  },

  /**
   * ADR 0048 §3's whole carrying-out: a sentence and a link rather than a second
   * surface. It is this site's own words about what this page does not hold, so
   * it follows the setting like the lede above it, and the German is data.
   */
  modules: {
    id: 'components.modules',
    defaultMessage:
      'The home screen’s blocks are not here. They belong to one screen and are not components of the app. You find each of them, with its settings, in <editor>the home editor</editor> beside the running app.',
    description:
      'A third paragraph under the lede, saying where the home screen’s blocks are, because they are deliberately not in the grid below. <editor> is the link to the home editor in /preview and the words inside it name that tool.',
  },

  filter: {
    id: 'components.filter',
    defaultMessage: 'Filter folders, components and props',
    description:
      'The accessible name of the filter box in the bar above the page. The bar carries no labels above its fields.',
  },
  filterPlaceholder: {
    id: 'components.filter.placeholder',
    defaultMessage: 'Filter, for example Typo, onPress or reader',
    description:
      'The placeholder in that box. The three examples are a component, a prop and a folder, one of each; a translation keeps them as they are, because they are identifiers in this repository and not words.',
  },
  filterSummary: {
    id: 'components.filter.summary',
    defaultMessage: '{folders} folders, {components} components, {drawn} drawn here',
    description:
      'The count beside the filter box, which follows what is typed into it. {folders} is how many folders still match, {components} how many components, and {drawn} how many of those this site draws in its own React tree rather than in the app’s bundle.',
  },

  drawn: {
    id: 'components.drawn.legend',
    defaultMessage: 'Which components',
    description:
      'Read aloud as the group name of the two-way switch beside the filter, and never drawn.',
  },
  drawnAll: {
    id: 'components.drawn.all',
    defaultMessage: 'All',
    description:
      'The first of the two choices beside the filter: every component, drawn here or not. strings.only.all is the same word on /strings, where it means every string rather than only the ones sharing an English or missing a wording.',
  },
  drawnHere: {
    id: 'components.drawn.here',
    defaultMessage: 'Drawn here',
    description:
      'The second of the two choices: only the components this site can draw in its own React tree. “Here” is this page, as against the app’s bundle in a device frame.',
  },

  empty: {
    id: 'components.empty',
    defaultMessage: 'Nothing matches that.',
    description:
      'Where the grid would be, when the filter above the page matches no folder, component or prop. shell.search.empty is the same sentence in the search palette and reads the same in English.',
  },
  barrel: {
    id: 'components.barrel',
    defaultMessage: 'This folder has a barrel, so a caller names the folder and not the file.',
    description:
      'Behind the ⓘ beside the import line of a folder that has an index file re-exporting its components. A “barrel” is the index file; the line above it shows the import a caller writes.',
  },
  alsoExported: {
    id: 'components.alsoExported',
    defaultMessage: 'Also exported here',
    description:
      'The heading over what a folder’s files export beside their components: helpers, constants, sample data.',
  },

  cardBundle: {
    id: 'components.card.bundle',
    defaultMessage: 'Drawn in the app’s bundle',
    description:
      'A badge on a card whose component this site cannot draw itself. It states where the drawing happens rather than reporting a failure: the component’s own page frames the app and draws it there.',
  },
  cardBundleNote: {
    id: 'components.card.bundleNote',
    defaultMessage: 'Its page draws it in the shipped app.',
    description:
      'The line under that badge when no more specific reason is recorded for this component in components/direct-ids.ts.',
  },
  cardSpecimens: {
    id: 'components.card.specimens',
    defaultMessage: 'Every specimen of {name}',
    description:
      'The accessible name of the link covering a card’s drawing, which opens that component’s own page. {name} is the component’s name in the source, such as SectionCard, and is not translated. components.card.specimens.clipped is the same link when the card is cutting the component off.',
  },
  cardSpecimensClipped: {
    id: 'components.card.specimens.clipped',
    defaultMessage: 'Every specimen of {name}, which this card clips at {height} px',
    description:
      'The same link as components.card.specimens, on a card that cannot show the whole component. {name} is the component’s name in the source and is not translated; {height} is the component’s real height in CSS pixels, which is the number kit.previewCard.clipped prints over the drawing and hides from the browser. This link is where that fact becomes actionable, which is why it carries it.',
  },
  cardNoDoc: {
    id: 'components.card.noDoc',
    defaultMessage: 'No doc comment.',
    description:
      'Stands in where a component’s source carries no prose to print. reference.symbol.noDoc says the same thing about a symbol on /reference.',
  },
  cardProps: {
    id: 'components.card.props',
    defaultMessage: '{count, plural, one {# prop} other {# props}}',
    description:
      'The count in a card’s bottom-right corner. {count} is how many props the component takes, and may be zero.',
  },
});

/**
 * The two runs drawn inside `components.lede`, at module scope.
 *
 * Beside the descriptor rather than inside the render, which is the shape
 * `ui/Settings.tsx` already uses for its three: a component built during a render
 * is remounted on every one of them, and `react/no-unstable-nested-components`
 * says so.
 */
const code = (chunks: ReactNode[]) => <code className="font-mono">{chunks}</code>;

const reference = (chunks: ReactNode[]) => (
  <a
    href={href('/reference')}
    className="text-on-canvas underline decoration-accent underline-offset-2"
  >
    {chunks}
  </a>
);

/**
 * The run drawn inside `components.modules`, at module scope for the reason above.
 *
 * The tool is in the HASH and not the query, because `shell/address.ts` owns the
 * grammar after the `#` on every route. Written as a query it is dropped on
 * arrival, which is what the first version of this link did and what the browser
 * rather than a check is how anyone found out.
 */
const editor = (chunks: ReactNode[]) => (
  <a
    href={`${href('/preview')}#/?tool=home`}
    className="text-on-canvas underline decoration-accent underline-offset-2"
  >
    {chunks}
  </a>
);

/**
 * `?c=ui/SectionCard` is the gallery's way back, and it lands on the component.
 *
 * The app's gallery addresses a component the same way — `folder/name`, which is
 * `gallery/catalogue.tsx`'s `componentId` — so one agreement carries a link in
 * both directions and neither side has to know the other's URLs. What changed is
 * where it lands: there is a page per component now, so the query is translated
 * into that address rather than into an anchor on this one.
 *
 * Replaced rather than pushed, so the back button leaves instead of bouncing off
 * the redirect. A name that matches nothing stays here, which is a fair answer to
 * a hand-typed address.
 */
function useAskedFor(): void {
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get('c');
    if (!asked) return;
    const [group, name] = asked.split('/');
    const known = groups.find((g) => g.name === group)?.components.some((c) => c.name === name);
    if (known) navigate(`/components/${group}/${name}`, { replace: true });
  }, []);
}

/**
 * The app's components, as a grid of cards that draw themselves when asked.
 *
 * `/reference` is a library: `packages/app-core` behind subpath imports, the same
 * for every host it ever gets. This is the app's own vocabulary, and the question
 * a reader arrives with is a different one: not "which subpath" but "what does
 * this look like".
 *
 * **No frames on this page at all.** Every row used to open onto an iframe
 * booting the whole app at phone width, three at a time, and a frame always
 * carries a viewport: what that gave for `Hairline`, a one-pixel line, was a
 * 393px phone with a line somewhere on it. A card draws the component itself, in
 * this site's own React tree, at the size the component is (ADR 0027), and the
 * frame moved to `/components/<group>/<name>` where it has room to be a device
 * again (ADR 0028). The three-frame cap and the "load all" control went with it.
 *
 * **And nothing is asked for.** Every card draws on arrival. There was a Draw
 * button on each of them for one commit, inherited from the era when a preview
 * meant booting the app in a frame; `direct.tsx` imports the components
 * statically, so the bytes are paid whether or not anybody presses anything.
 * Measured on 2026-09-11: mounting all 47 adds about 100 ms to the first render,
 * 460 ms on a CPU throttled four times, and the page still scrolls end to end at
 * 60 frames a second with nothing over 17 ms. ADR 0028 carries the table.
 *
 * **And a card that cannot show all of a component says so.** The square each
 * one reserves is the column the grid gives it, which at a desktop width is
 * between 19rem and 24rem, and against the 47 specimens that leaves a handful
 * taller than the box they are drawn in. Those get a fade and a line saying how
 * tall the component really is, measured in the browser rather than listed here,
 * because the set changes with the grid, the window and the app.
 */
export function Components() {
  const intl = useWorkbenchIntl();
  const [query, setQuery] = useState('');
  const [only, setOnly] = useState<'all' | 'drawn'>('all');
  useAskedFor();

  const sections = useSections('/components', true);

  /*
   * A prop's name is part of what a component matches on. "onPress" is a real
   * question somebody arrives with, 14 of the 45 components take one, and
   * against the names and the summaries alone it matches nothing at all.
   */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches: ApiComponentGroup[] = [];
    for (const group of groups) {
      const wholeFolder = q !== '' && group.name.toLowerCase().includes(q);
      const components = group.components.filter((component) => {
        if (only === 'drawn' && !DRAWN_IDS.has(`${group.name}/${component.name}`)) return false;
        if (q === '' || wholeFolder) return true;
        return `${component.name} ${component.summary} ${component.props
          .map((p) => p.name)
          .join(' ')}`
          .toLowerCase()
          .includes(q);
      });
      const helpers =
        only === 'drawn'
          ? []
          : group.helpers.filter(
              (helper) =>
                q === '' ||
                wholeFolder ||
                `${helper.name} ${helper.summary}`.toLowerCase().includes(q),
            );
      if (components.length > 0 || helpers.length > 0) {
        matches.push({ ...group, components, helpers });
      }
    }
    return matches;
  }, [only, query]);

  const count = filtered.reduce((n, group) => n + group.components.length, 0);
  const drawnCount = filtered.reduce(
    (n, group) =>
      n + group.components.filter((c) => DRAWN_IDS.has(`${group.name}/${c.name}`)).length,
    0,
  );

  return (
    <>
      <Slot id="context-bar">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-xs">
          <Filter
            id="comp-q"
            label={intl.formatMessage(COPY.filter)}
            placeholder={intl.formatMessage(COPY.filterPlaceholder)}
            value={query}
            onChange={setQuery}
            summary={intl.formatMessage(COPY.filterSummary, {
              folders: filtered.length,
              components: count,
              drawn: drawnCount,
            })}
          />
          <Segmented
            name="drawn"
            legend={intl.formatMessage(COPY.drawn)}
            className="shrink-0"
            value={only}
            options={[
              { value: 'all', label: intl.formatMessage(COPY.drawnAll) },
              { value: 'drawn', label: intl.formatMessage(COPY.drawnHere) },
            ]}
            onChange={(value) => setOnly(value === 'drawn' ? 'drawn' : 'all')}
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
                reads react-intl's own context, and this page mounts the app's
                provider inside every card through `AppHost`. `test/i18n.test.ts`
                fails on one, and `i18n/Localisation.tsx` carries the measurement. */}
            {intl.formatMessage(COPY.lede, { root, code })}{' '}
            {/* The rest of the lede, and the note on the page's language, which was its
                own paragraph because a reader who is not wondering should be able to
                skip it. Now they skip it by not opening this. */}
            <InfoTip about={intl.formatMessage(COPY.title)}>
              <p>{intl.formatMessage(COPY.ledeMore, { reference })}</p>
              <p>{intl.formatMessage(COPY.prose)}</p>
            </InfoTip>
          </p>

          {/* Where the home screen's blocks are, and why they are not below.
              [ADR 0048](../../../../adr/0048-the-gallery-points-at-the-editor-rather-than-copying-it.md)
              §3: a sentence and a link rather than a second surface. They are not
              components — `apps/mobile/src/lib/home/modules.tsx` argues that a specimen
              of "the fact-check rail plus its heading" is the screen — and the editor
              already draws every one of them with its settings, beside the running app.
              Somebody reading this page had no reason to know that, which is the one
              thing ADR 0045 §10 was really missing. */}
          <p className="mt-m max-w-content text-m leading-relaxed text-on-canvas-muted">
            {intl.formatMessage(COPY.modules, { editor })}
          </p>

          {filtered.length === 0 && (
            <p className="py-2xl text-center text-m text-on-canvas-muted">
              {intl.formatMessage(COPY.empty)}
            </p>
          )}

          {filtered.map((group) => (
            <section className="mt-xl" key={group.name}>
              <h2
                id={`g-${group.name}`}
                className="scroll-mt-[4.75rem] font-mono text-headline-m font-semibold leading-tight wrap-anywhere"
              >
                {group.name}
              </h2>
              <p className="mt-3xs flex items-center gap-xs break-words font-mono text-s text-on-canvas-muted">
                <span className="min-w-0">
                  {group.barrel
                    ? `import … from '${group.barrel}'`
                    : `import … from '${alias}/${group.name}/…'`}
                </span>
                {group.barrel && (
                  <InfoTip about={group.name}>
                    <p>{intl.formatMessage(COPY.barrel)}</p>
                  </InfoTip>
                )}
              </p>

              {/*
                A BAND, NOT A BREAKPOINT, because the column is what sizes the
                square a card reserves (`ComponentCard` below).

                Breakpoints cannot say what this has to say, because the column
                here is not a function of the window: the right-hand panel takes a
                quarter of it whenever a reader opens it. `sm:grid-cols-2
                xl:grid-cols-3` therefore gave 260px columns at 640, 379px at
                1280, 432px at 1440 and 301px at 1280 with the panel open — four
                answers to one question, the widest nearly twice the narrowest.
                Measured on 2026-09-11 against the 47 specimens: a 340px column
                clips three of them, a 260px column clips nine.

                So the grid states the band instead, 19rem up, and the card states
                24rem down. The two halves are written where they are because they
                are different questions: how many columns fit is the grid's, and
                how wide a card may usefully be is the card's. Both in the track
                would also change the answer — `repeat()` counts an `auto-fill`
                with a definite maximum at that maximum, so `minmax(19rem,24rem)`
                fits two 24rem columns at 1280 where three 19rem ones fit, and
                loses a whole column to say the same thing.

                `auto-fill` and not the other one: a folder with a single
                component in it keeps the column width of the folder above rather
                than stretching its one card across the row.
              */}
              <ul className="mt-s grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-xs">
                {group.components.map((component) => {
                  const id = `${group.name}/${component.name}`;
                  return (
                    <li
                      key={`${component.name}-${component.platform ?? ''}`}
                      className="mx-auto w-full min-w-0 max-w-[24rem]"
                    >
                      <ComponentCard id={id} group={group.name} component={component} />
                    </li>
                  );
                })}
              </ul>

              {group.helpers.length > 0 && (
                <div className="mt-s">
                  {/* Not components, and not hidden either: these are exports of
                      the same files that a screen imports beside the component. */}
                  <h3 className="text-s font-semibold uppercase tracking-wider text-on-canvas-muted">
                    {intl.formatMessage(COPY.alsoExported)}
                  </h3>
                  <ul className="mt-2xs divide-y divide-stroke overflow-hidden rounded-md border border-stroke">
                    {group.helpers.map((helper) => (
                      <li key={helper.name} className="px-s py-2xs">
                        <p className="flex flex-wrap items-baseline gap-xs">
                          <span className="font-mono text-s text-on-canvas-muted">
                            {helper.kind}
                          </span>
                          <span className="font-mono text-m font-semibold">{helper.name}</span>
                          <span className="min-w-0 flex-1 text-s text-on-canvas-muted">
                            {helper.summary}
                          </span>
                        </p>
                        {helper.signature && (
                          <p className="mt-3xs whitespace-pre-wrap break-words font-mono text-s text-on-canvas-muted">
                            {helper.signature}
                          </p>
                        )}
                        <Source file={helper.file} line={helper.line} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </article>
      </Page>
    </>
  );
}

/**
 * One card, in either of its two states, both of them the same shape.
 *
 * The preview area is the same square whether it holds a drawing or a badge, and
 * the head, the summary and the foot are identical in both. That is what keeps
 * the minority state from reading as broken: with two components undrawable the
 * exceptions are a statement about where the drawing is, and with forty of them
 * undrawable it is the same statement forty times. Nothing is dashed, greyed out,
 * or shaped like a loading state.
 *
 * **The shape is `ui/kit/PreviewCard.tsx`, and what this page adds is three
 * things and nothing else**: the square rather than a height, the drawing at the
 * component's own width with no scale, and a foot that says where the file is and
 * how many props it takes. The block picker draws the same card with a fixed well
 * and a scaled block in it, and the two had drifted into cards that disagreed
 * about height, crop and type — which is a fault a review finds twice, once per
 * page.
 *
 * **The square is reserved and not measured**, and that is the part of the shape
 * that has to stay: 47 specimens settle at their own speeds, and a preview area
 * sized by its content would reflow the grid under a reader who was already
 * reading it. It is `aspect-ratio: 1` rather than a height in rem, so the
 * reserved box follows the column the grid gives it and there is no number here
 * to keep in step with the one in the grid above — which is also why this page
 * passes no `previewHeight` and the picker does.
 *
 * **The bundle state is the card's own and stays here.** A component with no
 * drawing of its own is a fact about this site's map of the app, and the card's
 * `preview` region takes a node, so the square holds a badge instead of a specimen
 * without the shared card knowing that either state exists.
 */
function ComponentCard({
  id,
  group,
  component,
}: {
  id: string;
  group: string;
  component: ApiComponent;
}) {
  const intl = useWorkbenchIntl();
  const entry = directEntry(id);
  const route = `/components/${group}/${component.name}`;
  // The card owns the crop and prints the note over the drawing; this page's own half is the
  // link's name, which is where the height becomes something a reader can act on. It is handed
  // the same measurement rather than measured again here, which is why the two cannot disagree
  // about which cards are cutting something.
  const link = (crop: PreviewCardCrop): ReactNode =>
    entry === undefined ? null : (
      /*
        The way to the component's own page, over the drawing rather than on it.

        This was a pill reading "All specimens", parked in the bottom-right corner on its own
        opaque ground, and what it did there was cover the component: `ClubCard` lost the line
        under the member's name, `CalloutCard` its progress bar, `SpotlightBriefing` an entry. A
        control that hides the thing it is a control for is worse than no control, and the card
        already says where it goes twice over — the component's name beside this is a link, and
        the page's own prose says the component's page has every specimen.

        An anchor and not a wrapper: a specimen contains `<button>`s of its own and an `<a>` around
        one of those is invalid, so this sits over the drawing as a sibling instead. That also
        stops a press landing on a specimen's own control, which on a card does nothing anybody
        wants.

        **It carries the crop**, because the note the card paints over the drawing is the one thing
        on the card a reader cannot act on and this link is the act: the note is `aria-hidden`, and
        what it says is in the name here, attached to the thing that resolves it.
      */
      <a
        href={href(route)}
        aria-label={
          crop.clipped
            ? intl.formatMessage(COPY.cardSpecimensClipped, {
                name: component.name,
                height: crop.height,
              })
            : intl.formatMessage(COPY.cardSpecimens, { name: component.name })
        }
        className="absolute inset-0 rounded-t-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      />
    );

  return (
    <PreviewCard
      title={
        <a
          href={href(route)}
          className="min-w-0 truncate font-mono text-headline-xs font-semibold text-on-canvas underline decoration-accent underline-offset-2"
        >
          {component.name}
        </a>
      }
      titleExtra={
        component.platform ? (
          /* The one thing about a component that changes what it is: this file is the half
             Metro keeps for that platform, and the twin beside it is the other. Written, not
             coloured. */
          <Badge variant="outline" className="font-mono">
            {component.platform}
          </Badge>
        ) : null
      }
      description={
        /* The component's OWN prose, out of the app's source through TypeDoc. It is a comment
           a developer wrote and stays English (ADR 0052 §1); what stands in for a missing one
           is this site's sentence and does not. */
        component.summary || <span className="italic">{intl.formatMessage(COPY.cardNoDoc)}</span>
      }
      descriptionTitle={component.summary}
      footer={
        <>
          <span className="min-w-0 flex-1 truncate font-mono" title={component.file}>
            {component.file}
          </span>
          <span className="shrink-0 tabular-nums">
            {intl.formatMessage(COPY.cardProps, { count: component.props.length })}
          </span>
        </>
      }
      overlay={link}
      preview={
        entry === undefined ? (
          <BundleState id={id} route={route} />
        ) : (
          <DirectPreview specimens={entry.specimens.slice(0, 1)} ground="canvas" labels={false} />
        )
      }
    />
  );
}

/**
 * A component this site does not draw, said in the square a drawing would have been in.
 *
 * A recorded reason wins, and `direct-ids.ts` says in its own header that one written there has
 * to be a descriptor: the walk that holds literals cannot see a string in a `Record`, so that
 * file is where the rule has to be stated rather than enforced.
 */
function BundleState({ id, route }: { id: string; route: string }) {
  const intl = useWorkbenchIntl();
  return (
    <a
      href={href(route)}
      className="flex h-full flex-col items-center justify-center gap-2xs px-s text-center"
    >
      <Badge variant="outline">{intl.formatMessage(COPY.cardBundle)}</Badge>
      <span className="text-s text-on-canvas-muted">
        {NOT_DRAWN[id] ?? intl.formatMessage(COPY.cardBundleNote)}
      </span>
    </a>
  );
}
