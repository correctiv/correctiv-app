import { Plus, Search } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { say } from '../../i18n/messages';

import type { BlockCategory } from '@correctiv/app-core/lib/block-category';
import type { HomeSection } from '@correctiv/app-core/lib/home-layout';

// The app's own declaration, carried into the core and grouped there (ADR 0073 §2). The
// palette was `HOME_MODULES` itself (ADR 0046 §1), then the blocks that declared the
// screen being edited (ADR 0054 §2); it is now every block but the four bound to another
// screen's title, in the categories the core groups them into. What holds the declaration
// against the registry is `apps/mobile/__tests__/home-layout.test.tsx`, in both
// directions, which is what ADR 0046 §1's "no second list to forget" became.
import { useCategoryLabel } from '@/lib/home/category-labels';
import { MODULE_FEATURES } from '@/lib/features';
import type { ConfigurableScreen } from '@correctiv/app-core/lib/screen-layout';

import { AppHost } from '../../components/AppHost';
import { cn } from '../../lib/cn';
import { InfoTip } from '../../ui/kit/info-tip';
import { Segmented } from '../../ui/kit/segmented';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../ui/kit/dialog';
import { FeatureChip } from '../features/Mark';
import { moduleLabel } from './document';
import { fit } from './fit';
import { HomeBlock } from './HomeBlock';
import {
  familyTabs,
  FIRST_TAB,
  groupsShown,
  matchCount,
  matchesNothing,
  readTab,
  rememberTab,
  type PickerTab,
} from './offered';

/**
 * Where a block goes, chosen before what goes there.
 *
 * [ADR 0045](../../../../../adr/0045-the-home-editor-arranges-the-blocks-it-draws.md) §6:
 * a thin control between every pair of blocks and at each end, opening the modules
 * available. **The position first**, because a person inserting into a list points at a gap
 * and then says what goes in it; picking a module and then being asked where has the same
 * two steps in the order that makes the first one abstract.
 *
 * ADR 0046 §4 decides what the palette does not do: it offers every module and remarks on
 * none. Two headers at the top and an impact footer in the middle are both allowed and
 * neither is commented on, because "makes sense here" is a judgement the editor would be
 * inventing on a newsroom's behalf. What stands in for a rule is the frame: an
 * arrangement nobody wants is on screen at the size it ships at the moment it is placed.
 *
 * ## Thirty-two blocks, and the two answers that made it a shelf
 *
 * ADR 0073 §2 predicted this exactly: a palette of thirty-two specimens on every screen, and
 * a tabbed picker as the follow-up. **A tab per family, plus one for all of them, and a
 * search over the whole shelf**, because a palette of thirty-two things in one grid is not a
 * list anybody reads — and the family is not this file's word either. It is the block's, read
 * through `blocksByCategory` out of the core, so the newsroom looks for the video row in
 * "Audio und Video" because the app filed it there.
 *
 * **The previews are scaled drawings, not pictures of drawings, and they are the width of
 * the card rather than a thumbnail beside the words.** `HomeBlock` draws the app's real
 * component at the device's real width (ADR 0045 §3), and a `transform: scale` puts that at
 * a size a shelf can hold. Recognition is the whole job here — "that is the one with the red
 * live banner" — so the drawing has to be big enough to recognise, which a 132px column down
 * the left of a card was not: measured in a design review, a headline at that scale is two
 * grey pixels, and the card's own words were carrying the whole decision. `Specimen` below
 * says how the card is built and why every height in it is fixed.
 *
 * **Where the words come from, which is the one thing in this file that is not this site's.**
 * The six family names are the APP's, in `lib/home/category-labels.ts`, because the app's own
 * component gallery groups by the same families and cannot import this site
 * ([ADR 0040](../../../../../adr/0040-the-app-does-not-depend-on-the-workbench.md)). So
 * they are formatted under the app's provider — which `AppHost` below mounts, and which is
 * the app's language, set by the preview's `lg=` and German by default. Everything else here
 * is this site's and follows the site's language setting
 * ([ADR 0052](../../../../../adr/0052-the-sites-own-words-follow-the-setting.md) §1).
 */

/**
 * What this dialog says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/home.ts`.
 *
 * Four of the values these take are not this file's to translate and are German all the
 * same. `where` comes from `whereAt` in `./document.ts` and `name`, `what` and the family
 * names come from the app's table and `MODULE_LABELS` in the same module, and both of those
 * are descriptors formatted before they arrive here.
 *
 * **Everything below calls `useWorkbenchIntl()` rather than `useIntl()`, and that is what
 * keeps this dialog half-German-proof rather than half-German.** `HomeDocument` mounts one
 * `AppHost` around the whole block list, both `InsertMark` call sites are inside it, and
 * `AppHost` mounts `AppEnvironment`, which mounts the app's own `IntlProvider`. react-intl's
 * context here is therefore the app's, which holds no `home.*` id, and each of these would
 * have rendered its English `defaultMessage` and reported nothing — `vite.app.mjs` defines
 * `__DEV__` false for this site, so the app's `onError` throws only with it. Measured that way
 * on the dev server before the fix: the bar above the frame read „Rahmen“ while the mark below
 * it read "Add a block at the top of the day".
 *
 * `useWorkbenchIntl()` reads a context of this site's own, which the app's provider cannot
 * shadow because it is a different object, and `test/i18n.test.ts` fails on a `useIntl`
 * anywhere outside `src/i18n/`. **The six family names are the exception, and they are the
 * exception for the same reason in reverse**: they are the app's ids in the app's catalogue,
 * so they are formatted against the app's provider by `useCategoryLabel`, which is the only
 * formatter here that may touch react-intl's own context.
 */
const COPY = defineMessages({
  addHere: {
    id: 'home.palette.addHere',
    defaultMessage: 'Add a block {where}',
    description:
      'The accessible name of the hairline between two blocks of the day, which opens the palette. {where} is the place a block would land, in words, as "at the very top" or "after the lead article".',
  },
  title: {
    id: 'home.palette.title',
    defaultMessage: 'Add a block',
    description:
      'The heading of the dialog that hairline opens. home.palette.addHere is the hairline’s own name and says where as well; this one is read under it and does not.',
  },
  lead: {
    id: 'home.palette.lead',
    defaultMessage: 'The new block goes {where}.',
    description:
      'The one line of the palette dialog, under its heading. {where} is the place the chosen block would land, in words, as "at the very top".',
  },
  leadMore: {
    id: 'home.palette.leadMore',
    defaultMessage:
      'The shelf holds every block the app has, sorted into families and drawn as it will appear. Any block may stand on any screen; only the four screen titles stay on their own. How it looks, you see in the frame beside it.',
    description: 'Behind the ⓘ beside the palette dialog’s heading, home.palette.title.',
  },
  addModule: {
    id: 'home.palette.addModule',
    defaultMessage: 'Add {name}. {what}',
    description:
      'The accessible name of one card in the palette, which is a drawing of a module with the drawing itself hidden from the accessibility tree. {name} is the module’s name and {what} the sentence about it, both shown on the card. The sentence is read in full here because the card shows two lines of it.',
  },
  all: {
    id: 'home.palette.tab.all',
    defaultMessage: 'All',
    description:
      'The first tab of the palette: every block this screen may take, whichever family it is in. The families themselves are the app’s words and come from the app.',
  },
  familyLegend: {
    id: 'home.palette.tab.legend',
    defaultMessage: 'Which family of block you are looking in',
    description:
      'The name the row of family tabs carries for the browser, above the tabs. It is read where the tabs are and is not drawn, because the tab in it is already drawn.',
  },
  searchLegend: {
    id: 'home.palette.search.legend',
    defaultMessage: 'Search by name and description',
    description:
      'The name of the field that narrows the shelf, above it. Every word typed has to appear in a block’s name or its sentence, so a search is an answer rather than a guess.',
  },
  search: {
    id: 'home.palette.search',
    defaultMessage: 'Name or description',
    description:
      'The text in the palette’s search field while it is empty. It is a hint rather than a name, so the browser reads the field as the search legend beside it.',
  },
  found: {
    id: 'home.palette.found',
    defaultMessage: '{found} of {total} blocks match.',
    description:
      'Said above the shelf while a search is typed, so a shelf that has narrowed to one card is not mistaken for the whole of what is there. {found} is how many blocks match and {total} how many this screen offers.',
  },
  none: {
    id: 'home.palette.none',
    defaultMessage: 'No block matches “{query}”.',
    description:
      'Stands in for an empty shelf, where a search matched nothing. {query} is the text that was typed, in its own spelling.',
  },
});

export function InsertMark({
  where,
  deviceWidth,
  screen,
  onAdd,
}: {
  /** Said in words, for the dialog and for the mark's own label: "at the top", "after X". */
  where: string;
  /** The width a specimen draws at, handed down so the list and the palette cannot part. */
  deviceWidth: number;
  /** The screen being edited: every block but another screen's title (ADR 0073 §1, §3). */
  screen: ConfigurableScreen;
  onAdd: (module: string) => void;
}) {
  const intl = useWorkbenchIntl();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {/*
          A hairline that grows a `+` when it is pointed at or focused, and keeps the
          `+` while its dialog is open. Between two blocks there is otherwise nothing to
          suggest a gap can be filled, and a permanent plus sign in every gap down the
          list would compete with the blocks for a reader's eye, which is what ADR 0045
          §6's word "thin" is about.
        */}
        <button
          type="button"
          aria-label={intl.formatMessage(COPY.addHere, { where })}
          /*
           * The caller lays this over the join rather than setting it between two blocks.
           * ADR 0053 §1 leaves no gap to sit in: the blocks meet the way they meet on the
           * phone, so a control that took height of its own would put the list back to a
           * stack of cards one hairline at a time.
           *
           * **A target several times the mark it carries.** It was narrower, and it was
           * reported as hard to hit — a hairline gives no edge to aim at, and until the
           * base stylesheet put the pointer cursor back there was nothing to say when the
           * aim had landed either. The box straddles the seam, so it takes half its height
           * off the bottom of one drawing and half off the top of the next, which is a
           * price only a block with something in its very first row would notice.
           */
          className="group relative flex h-[1.25rem] w-full shrink-0 items-center focus-visible:outline-none"
        >
          {/*
            One unbroken hairline, with the `+` laid over its middle rather than set
            between two halves of it. Laid between, the mark reads as two dashes while
            nothing is pointing at it, because a hidden element still takes its width.
          */}
          <span
            aria-hidden="true"
            className={cn(
              'w-full transition-all',
              // Nothing at all until it is pointed at. ADR 0053 §1 makes the list a screen,
              // and a hairline drawn across every seam of it would be a rule the phone has
              // not got, once per block.
              'h-px bg-transparent',
              // Two pixels once it is, rather than one: the line is what confirms the aim,
              // and a one-pixel confirmation under a twenty-pixel target is a mark a person
              // has to look for to believe.
              'group-hover:h-[2px] group-hover:bg-accent',
              'group-focus-visible:h-[2px] group-focus-visible:bg-accent',
              open && 'h-[2px] bg-accent',
            )}
          />
          <Plus
            aria-hidden="true"
            className={cn(
              // `bg-canvas` and not the dock's `surface`: since ADR 0053 §1 this disc sits
              // over a drawing of the app rather than over the panel's own ground. Ringed,
              // because a bare glyph over a photograph is a glyph nobody can read.
              'absolute left-1/2 size-[1.125rem] -translate-x-1/2 rounded-full p-[1px]',
              'bg-canvas ring-1 ring-accent',
              'text-accent opacity-0 transition-opacity',
              'group-hover:opacity-100 group-focus-visible:opacity-100',
              open && 'opacity-100',
            )}
          />
        </button>
      </DialogTrigger>

      {/*
        **80rem rather than 64rem, and the tab row is what asked for it.** Seven German family
        names measure about 1,150px at `text-s`, which is more than a 64rem dialog has to
        give once its own padding is off it — and `scroll` alone then cut „Club und Profil"
        off at the edge, which reads as an unfinished row rather than as one that scrolls. At
        80rem all seven are on the line at this window; the control keeps `scroll` for the
        widths where it has to. The other half of the width is three columns of about 390px,
        which puts a card's drawing within 1% of the phone's own 393px — legible as the block
        rather than as a hint of one.
      */}
      <DialogContent className="w-[min(80rem,94vw)]">
        <div className="flex items-center gap-2xs">
          <DialogTitle className="text-l font-semibold text-on-canvas">
            {intl.formatMessage(COPY.title)}
          </DialogTitle>
          <InfoTip about={intl.formatMessage(COPY.title)}>
            <p>{intl.formatMessage(COPY.leadMore)}</p>
          </InfoTip>
        </div>
        <DialogDescription className="mt-3xs text-s leading-relaxed text-on-canvas-muted">
          {intl.formatMessage(COPY.lead, { where })}
        </DialogDescription>

        {/*
          One environment for the whole palette rather than one per specimen, the same
          arrangement the list uses and for the same reason. It is mounted only while the
          dialog is open, which is why a second one beside the list's is affordable —
          and it is also what puts the APP's provider over everything below, which is
          where the six family names are formatted against and the only place in this
          file that they can be.
        */}
        <AppHost>
          <BlockPicker
            screen={screen}
            deviceWidth={deviceWidth}
            onPick={(module) => {
              onAdd(module);
              setOpen(false);
            }}
          />
        </AppHost>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The shelf: the family tabs, the search, and the blocks the two of them add up to.
 *
 * A file of its own rather than more of this one because it is the whole of the dialog's
 * body and this file is already about where the dialog opens from. It reads `./offered.ts`
 * for what to show, which is where the questions live that have no drawing in them.
 */
function BlockPicker({
  screen,
  deviceWidth,
  onPick,
}: {
  screen: ConfigurableScreen;
  deviceWidth: number;
  onPick: (module: string) => void;
}) {
  const intl = useWorkbenchIntl();
  // Read once per open, so the tab somebody chose last time is where the dialog starts.
  const [tab, setTab] = useState<PickerTab>(() => readTab(screen));
  const [query, setQuery] = useState('');

  /**
   * The words a search runs on, joined per block. Built here rather than handed to
   * `groupsShown` as a formatter because it is the only place that knows what a block is
   * called in the reader's language — `moduleLabel` is this site's table of words and its
   * ids are this site's, which is why a search for „Faktencheck“ finds the block whose id
   * says `faktencheck-rail`.
   */
  const words = useMemo(() => {
    const say1 = (module: string): string => {
      const { label, what } = moduleLabel(module);
      return `${say(intl, label)} ${intl.formatMessage(what)}`;
    };
    return say1;
  }, [intl]);

  const searching = !matchesNothing(query);
  const groups = groupsShown(screen, tab, query, words);
  const { found, of } = matchCount(groups, screen);

  return (
    <div className="@container mt-s flex flex-col gap-s">
      {/*
        The search field and the tab row are on two lines rather than one.

        **It was one line, and it is the reason the tabs wrapped.** A row that holds a field
        growing to the left and seven options growing to the right has to give one of them
        less, and what it gave the tabs was the width that made „Club und Profil" an orphan
        on a line of its own. Two rows give the tab strip the dialog's whole width, and
        `scroll` on the control covers the window widths where even that is not enough.
      */}
      <label className="flex w-full min-w-0 flex-col gap-3xs">
        <span className="text-s font-medium text-on-canvas-muted">
          {intl.formatMessage(COPY.searchLegend)}
        </span>
        <span className="relative flex items-center">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-xs size-[1rem] text-on-canvas-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={intl.formatMessage(COPY.search)}
            className="w-full rounded-md border border-stroke bg-canvas py-xs pl-l text-m text-on-canvas placeholder:text-on-canvas-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </span>
      </label>

      {/*
        **The tabs, as a radio group and not as buttons.** `ui/kit/segmented.tsx` argues it
        at length: `aria-pressed` says "this is on" where the question is "which one", and a
        row of buttons is a row of tab stops where a radio group is one, with the arrow keys
        moving inside it. Escape is the dialog's own, and Enter picks the card a focus is on —
        both of which are the browser's or Radix's rather than this file's.
      */}
      <Segmented
        name="home.palette.tab"
        legend={intl.formatMessage(COPY.familyLegend)}
        value={tab}
        // Switched off while a search is typed, because a search looks at every family
        // (`offered.ts`). A tab that still took a click would promise a narrower search
        // than the one that is running.
        disabled={searching}
        // One row that scrolls, for the seven German family names beside „Alle".
        scroll
        className="w-full"
        onChange={(value) => {
          setTab(value as PickerTab);
          rememberTab(value as PickerTab);
        }}
        options={[
          { value: FIRST_TAB, label: intl.formatMessage(COPY.all) },
          ...familyTabs(screen).map((category) => ({
            value: category,
            label: <FamilyName category={category} />,
          })),
        ]}
      />

      {searching ? (
        <p className="text-s text-on-canvas-muted">
          {found === 0
            ? intl.formatMessage(COPY.none, { query: query.trim() })
            : intl.formatMessage(COPY.found, { found, total: of })}
        </p>
      ) : null}

      {groups.map(({ category, blocks }) => (
        <section key={category}>
          {/*
            The heading is drawn while a search is running and hidden while a tab is
            chosen, because then the tab already says it. A shelf that repeated its own tab
            over every group would be saying it twice for no second answer.
          */}
          {searching ? (
            <h3 className="mb-2xs text-s font-semibold text-on-canvas-muted">
              <FamilyName category={category} />
            </h3>
          ) : null}
          {/*
            **Three columns at the dialog's width, two below it, and the grid asks the dialog
            rather than the window.** The dialog is `min(80rem, 94vw)`, so a viewport query
            would answer for a width this shelf does not have: it is 80rem on a 1600px screen
            and on a 1000px one, and the second of those wants two columns. `@container` on the
            wrapper above is the width the cards are actually laid out in.
          */}
          <ul className="@container grid grid-cols-1 gap-xs @min-[34rem]:grid-cols-2 @min-[52rem]:grid-cols-3">
            {blocks.map((module) => (
              <Specimen
                key={module}
                module={module}
                deviceWidth={deviceWidth}
                screen={screen}
                onPick={() => onPick(module)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * One family's name, and nothing else.
 *
 * **A component of its own because it is a hook.** `useCategoryLabel` reads the app's
 * provider, and a hook called once per option out of a map is a hook whose number of calls
 * changes with the number of families. Rendering a component element instead costs nothing
 * and keeps the rule where React keeps it.
 */
function FamilyName({ category }: { category: BlockCategory }) {
  return <>{useCategoryLabel(category)}</>;
}

/**
 * The proportions of the drawing at the top of a card, as one number.
 *
 * **16:10 rather than the phone's own 393×852.** A phone is 1:2.2, so a card drawn at that
 * ratio is a column: three columns of an 80rem dialog are about 390px, and a 1:2.2 well would
 * be 860px tall, taller than the dialog and one card per screen. The shelf wants the top of
 * the block — the hero image, the rail's first tile, the headline — and 16:10 is roughly where
 * that ends. The crop with the fade below is what makes the cut a decision rather than a
 * truncation.
 */
const PREVIEW_RATIO = 16 / 10;

/**
 * The scale a card's drawing is drawn at, which is the one measurement a card takes.
 *
 * **The well is measured and not the drawing inside it.** The first version of this put the
 * observer on the transformed child, whose `clientWidth` is the device's own 393 whatever the
 * scale, so the scale came out as one on every card and the drawing was clipped rather than
 * shrunk — visible in the first screenshot of the redesign, where three cards in a row showed
 * the top-left corner of a phone-width block and its text cut off at the card's edge.
 * `HomeBlock` measures its own shell for the same reason and in the same words.
 *
 * **A ref callback rather than a mount-only effect**, as in `HomeBlock.tsx`: an effect keyed
 * on `[]` captures the node of the first render and goes on watching it after React has
 * replaced it, so a card's scale freezes at whatever it measured while another tab was open.
 * A ref callback cannot go stale, because React calls it with the node and calls the returned
 * cleanup when that node goes.
 *
 * **Capped at one**, by `fit()` and ADR 0045 §3: a card wider than the phone would otherwise
 * draw the block larger than the app ever has it, which is a lie about the thing being
 * placed. Three columns of an 80rem dialog come to about 390px against a 393px phone, so the
 * cap never bites here — which is exactly why it belongs in the helper rather than in the
 * arithmetic above.
 */
function useWellScale(deviceWidth: number): [number, (node: HTMLDivElement | null) => void] {
  const [room, setRoom] = useState<number | null>(null);
  const measured = useCallback((node: HTMLDivElement | null) => {
    if (node === null) return;
    const observer = new ResizeObserver(() => setRoom(node.clientWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [fit(room, deviceWidth).scale, measured];
}

/**
 * One module: a drawing of it across the top, its name, what it does, and whether this build
 * draws it at all.
 *
 * **Drawing on top, at the card's own width, and the words under it.** It was a 132px
 * thumbnail down the left with the name beside it, which failed a design review on what is
 * really one fault: the picture was too small to recognise, so it was decoration and the
 * card's words were carrying the whole decision. At three columns a card is about 390px of
 * drawing instead of 132 — legible as a shape and as a headline — and `HomeBlock` lays the
 * block out at the device's real width and scales the result, so the proportions, the type
 * sizes and the rails are the ones the phone has (ADR 0045 §3).
 *
 * **One height per row, and every height in it is a decision rather than a measurement.**
 * Three of the four things that used to vary are fixed: the well is a ratio, the name is one
 * line (`truncate`), and the sentence is two (`line-clamp-2`). The fourth was the feature
 * mark, which printed two or three lines under one card and made that card taller than its
 * neighbours; `FeatureChip` is one line for that reason. What is left is `mt-auto` on the
 * chip, which pins every card's foot to the same line whatever is above it — so a marked card
 * and an unmarked one are the same height, and so are two cards whose sentences are one line
 * and two.
 *
 * **One ground for the card and the drawing in it**, `bg-canvas`, separated by its border
 * rather than by a colour. It was `bg-surface` over a `bg-canvas` well, which put a step
 * across the card where the fade ended: the drawing faded into the well's ground, the text
 * below sat on another one, and the band between read as a rule the card had not asked for.
 * `Segmented`'s own row is the same arrangement one dialog further out — canvas on canvas, a
 * border between — so this is the shape the site already draws a panel in.
 *
 * **The button is a sheet over the whole card**, which is what makes the whole card the
 * target, and **it is over the drawing rather than around it**. Wrapped, the app's own
 * pressables end up inside this one. Measured: nine of the modules carry pressables of their
 * own, so clicking the picture of the lead article added nothing at all, and clicking
 * "Teilnehmen" inside the callout closed the dialog and added nothing, silently. React
 * reported `<button> cannot be a descendant of <button>` on every open, and nothing in this
 * repository could see it — `workbench:renders` fails on a console error but never opens a
 * dialog. So the drawing is `inert`: out of the tab order, out of the accessibility tree and
 * deaf to the pointer, which also takes the picker from thirty-nine tabbable things down to
 * one per card. The button comes first in the markup so `peer-*` can style the card behind it.
 */
function Specimen({
  module,
  deviceWidth,
  screen,
  onPick,
}: {
  module: string;
  deviceWidth: number;
  screen: ConfigurableScreen;
  onPick: () => void;
}) {
  const intl = useWorkbenchIntl();
  const { label, what } = moduleLabel(module);
  const section: HomeSection = { id: `palette-${module}`, module };
  const sentence = intl.formatMessage(what);
  const [scale, measured] = useWellScale(deviceWidth);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onPick}
        className="peer absolute inset-0 z-10 rounded-md focus-visible:outline-none"
      >
        <span className="sr-only">
          {intl.formatMessage(COPY.addModule, {
            name: say(intl, label),
            what: sentence,
          })}
        </span>
      </button>
      <div
        // eslint-disable-next-line react/no-unknown-property
        inert
        className={cn(
          'flex h-full w-full flex-col overflow-hidden rounded-md border border-stroke bg-canvas',
          'peer-hover:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
        )}
      >
        {/*
          **The well.** A block that draws almost nothing here — „CORRECTIV im Gespräch" is
          the plain case — left a card whose only content was a line of small text at the top
          of an empty box, which reads as a card that failed to load. A fixed ratio over a
          ground means such a card is a quiet card: the same shape, the same size, nothing
          drawn, and the name under it says what it is.
        */}
        <div
          ref={measured}
          className="relative w-full shrink-0 overflow-hidden bg-canvas"
          style={{ aspectRatio: PREVIEW_RATIO }}
        >
          <div
            style={{
              width: deviceWidth,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <HomeBlock section={section} deviceWidth={deviceWidth} screen={screen} />
          </div>
          {/*
            **A fade rather than a cut.** The well is shorter than most blocks, so the last
            row of pixels is a hard horizontal line through whatever was there — a headline
            chopped in half, a rail's second tile sliced. Fading the last third into the card
            says "there is more below" and costs one gradient.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-canvas to-transparent"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3xs p-xs">
          <span className="truncate text-m font-semibold text-on-canvas" title={say(intl, label)}>
            {say(intl, label)}
          </span>
          {/*
            Two lines, not one and not all of it. One line cut „Das Datum, die Begr…“ short
            of saying what the block is for; unclamped it is three lines on the long ones and
            one on the short, which is the height fault again. The whole sentence is the
            `title` under the pointer and the button's accessible name above, so nothing is
            lost to a reader who cannot see it — the arrangement `Components.tsx` already
            uses for a card of this shape.
          */}
          {/*
            **Two lines reserved, not two lines allowed.** `line-clamp-2` alone holds the long
            sentences to two and lets the short ones stand at one, which measured as rows of
            318px beside rows of 337px in the same grid: the grid equalises a row's height, so
            the row is as tall as its tallest card and the card that needed one line drew a
            gap above its chip. `min-h-[2lh]` reserves both lines whatever the sentence is,
            which is what makes every card in the row the same height by construction rather
            than by the grid's mercy.
          */}
          <span
            className="line-clamp-2 min-h-[2lh] text-s leading-snug text-on-canvas-muted"
            title={sentence}
          >
            {sentence}
          </span>
          {/*
            ADR 0072 §5: the mark stays on the card whatever this build would do with the
            block. A shelf that hid the video row would hide the fact that there is one. One
            line, and the whole sentence behind it in the chip's own tooltip.
          */}
          <FeatureChip feature={MODULE_FEATURES[module]?.feature} className="mt-auto" />
        </div>
      </div>
    </li>
  );
}
