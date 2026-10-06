import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { say } from '../../i18n/messages';

import type { BlockCategory } from '@correctiv/app-core/lib/block-category';
import type { HomeSection } from '@correctiv/app-core/lib/home-layout';

// The app's own declaration, carried into the core and grouped there (ADR 0073 §2). The
// palette was `HOME_MODULES` itself (ADR 0046 §1), then the blocks that declared the
// screen being edited (ADR 0054 §2), then every block but the four bound to another
// screen's title; since ADR 0075 §6 replaced those four with one header that prints the
// title of wherever it stands, it is every block, in the categories the core groups them
// into — and it no longer depends on which screen is being edited. What holds the
// declaration against the registry is `apps/mobile/__tests__/home-layout.test.tsx`, in
// both directions, which is what ADR 0046 §1's "no second list to forget" became.
import { useCategoryLabel } from '@/lib/home/category-labels';
import { MODULE_FEATURES } from '@/lib/features';
import type { ScreenId } from '@correctiv/app-core/lib/screen-layout';

import { AppHost } from '../../components/AppHost';
import { cn } from '../../lib/cn';
import { InfoTip } from '../../ui/kit/info-tip';
import { Segmented } from '../../ui/kit/segmented';
import { Badge } from '../../ui/kit/badge';
import { PreviewCard } from '../../ui/kit/PreviewCard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../ui/kit/dialog';
import { FeatureChip } from '../features/Mark';
import { moduleLabel } from './document';
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
 * grey pixels, and the card's own words were carrying the whole decision. The card itself is
 * `ui/kit/PreviewCard.tsx`, which the component page already drew and which this shelf's copy
 * of had drifted away from; `Specimen` below says what a block's card adds and why every
 * height in it is fixed.
 *
 * **One grid for the whole shelf, and the family on the card.** It was one `<ul>` per family,
 * which is a second list of the families a grid keeps for itself: a family of four is a row of
 * three and an orphan, and the next family starts a row lower at its own height. So the family
 * is a badge in each card's foot where the tab row above does not already say it — on „Alle"
 * and while a search spans all of them — which is the only place in the dialog where the two
 * halves of the answer could otherwise disagree.
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
      'The shelf holds every block the app has, sorted into families and drawn as it will appear. Any block may stand on any screen, the header included: it prints the title of the screen it is on. How it looks, you see in the frame beside it.',
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
  /** The screen being edited, which the specimens draw on; the list itself is the same everywhere. */
  screen: ScreenId;
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

        **A column, and the body scrolls under a head that does not.** `overflow-hidden` here
        displaces the primitive's own `overflow-y-auto`, and the shelf below is given the scroll:
        a shelf of thirty-two cards is taller than any window, and scrolling the whole panel took
        the search field and the tabs with it, so a person who had scrolled to „Club und Profil"
        could not narrow what they were looking at without starting again. `max-h-[85vh]` is the
        primitive's own and is left in place; `flex flex-col` and `min-h-0` are what let the one
        region below take the rest of the panel and scroll inside it.
      */}
      <DialogContent className="flex max-h-[85vh] w-[min(80rem,94vw)] flex-col overflow-hidden">
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

          **The wrapper is the reason the shelf scrolls**, and it is not decoration. The box
          `AppEnvironment` ends in carries the app's own `flex: 1` and nothing else, and a flex
          item will not shrink below its content without a `min-h-0` somewhere above it — so
          with `AppHost` as a direct child of the panel, the shelf took the height of all
          thirty-two cards, the panel clipped it, and the dialog's scroll was the one that never
          got used. The wrapper is that `min-h-0`.
        */}
        <div className="flex min-h-0 flex-1 flex-col">
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
        </div>{' '}
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
  screen: ScreenId;
  deviceWidth: number;
  onPick: (module: string) => void;
}) {
  const intl = useWorkbenchIntl();
  // Read once per open, so the tab somebody chose last time is where the dialog starts.
  const [tab, setTab] = useState<PickerTab>(() => readTab());
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
  const groups = groupsShown(tab, query, words);
  const { found, of } = matchCount(groups);

  return (
    <div className="@container mt-s flex min-h-0 flex-1 flex-col gap-s">
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
          ...familyTabs().map((category) => ({
            value: category,
            label: <FamilyName category={category} />,
          })),
        ]}
      />

      {/*
        ONE GRID, and the head that scrolls it.

        **It was one `<ul>` per family, and that is what broke the grid.** A family holds
        whatever the app's blocks happen to be — four in `struktur`, nine in `medien` — so a
        family of four at three columns is a row of three and an orphan, then the next family
        starts on a line of its own. That is not a fault of the cards; it is the second list of
        families a grid draws for itself. Measured on the shelf this replaces, the second row
        held `Impact` alone and the row below it began again with the next family, at a
        different height.

        **One grid, one family per card, and the heading goes where it can be honest.** The
        family is on the card itself, in the foot, on every card where the tab row above does
        not already say it: on „Alle" and while a search is running, which is exactly the two
        cases where the tab is not naming a card's family. On a family's own tab the badge is
        gone, because the tab says it thirty times already.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {searching ? (
          <p className="text-s text-on-canvas-muted">
            {found === 0
              ? intl.formatMessage(COPY.none, { query: query.trim() })
              : intl.formatMessage(COPY.found, { found, total: of })}
          </p>
        ) : null}

        {/*
          **Three columns at the dialog's width, two below it, and the grid asks the dialog
          rather than the window.** The dialog is `min(80rem, 94vw)`, so a viewport query
          would answer for a width this shelf does not have: it is 80rem on a 1600px screen
          and on a 1000px one, and the second of those wants two columns. `@container` on the
          wrapper above is the width the cards are actually laid out in.
        */}
        <ul
          className={cn(
            '@container mt-s grid grid-cols-1 gap-xs',
            '@min-[34rem]:grid-cols-2 @min-[52rem]:grid-cols-3',
          )}
        >
          {groups.flatMap(({ category, blocks }) =>
            blocks.map((module) => (
              <Specimen
                key={module}
                module={module}
                category={category}
                /* The badge is the tab's to say, or this card's. `all` names no family and a
                   search spans all of them, so both answer no and both carry the badge. */
                nameFamily={searching || tab === FIRST_TAB}
                deviceWidth={deviceWidth}
                screen={screen}
                onPick={() => onPick(module)}
              />
            )),
          )}
        </ul>
      </div>
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
 * How tall a card's well is, in CSS pixels.
 *
 * **A fixed height rather than the phone's own 393×852, and rather than a ratio.** A phone is
 * 1:2.2, so a card drawn at that ratio is a column: three columns of an 80rem dialog are about
 * 390px, and a 1:2.2 well would be 860px tall, taller than the dialog and one card per screen.
 * The shelf wants the top of the block — the hero image, the rail's first tile, the headline —
 * and 15rem is roughly where that ends.
 *
 * **Fixed rather than 16:10, which is what it was.** A ratio is a function of the column, so
 * the same block was drawn in a 300px well at two columns and a 244px one at three, and a card
 * could be 56px taller than the one beside it. The crop and the note above it are what make the
 * cut a decision rather than a truncation; a height that moves with the column is a second
 * thing varying for no second answer. It is one number and not one per caller, because
 * `ui/kit/PreviewCard.tsx` reserves a square for the component page for a reason of its own and
 * a height for everything else.
 */
const PREVIEW_HEIGHT = 15 * 16;

/**
 * One module: a drawing of it across the top, its name, what it does, and which family and
 * which build it is in.
 *
 * **The card is `ui/kit/PreviewCard.tsx`, and what this adds is a block in it.** The component
 * page's card already had the shape — a drawing over a reserved box, a name, a clamped sentence
 * and a foot — and the picker had a second copy that had drifted: a ratio where the other page
 * reserves a square, a name at a different size, a chip in the foot and nothing at all saying
 * which family a block is in. Two cards that answer the same question and disagree about height
 * and type is a fault a design review finds once per page, so the shape is one and this file
 * says what a block's card says on top of it.
 *
 * **Drawing on top, at the card's own width, and the words under it.** It was a 132px thumbnail
 * down the left with the name beside it, which failed a design review on what is really one
 * fault: the picture was too small to recognise, so it was decoration and the card's words were
 * carrying the whole decision. At three columns a card is about 390px of drawing instead of 132 —
 * legible as a shape and as a headline — and `HomeBlock` lays the block out at the device's real
 * width and scales the result, so the proportions, the type sizes and the rails are the ones the
 * phone has (ADR 0045 §3). The scale belongs to the card, measured on the well rather than on
 * the drawing inside it — whose `clientWidth` is the device's own 393 whatever the scale, so
 * watching it gave every card a scale of one and a drawing cropped rather than shrunk — and
 * capped at one by `fit()` for ADR 0045 §3: a card wider than the phone would otherwise draw the
 * block larger than the app ever has it, which is a lie about the thing being placed.
 *
 * **One ground for the card and the drawing in it**, `bg-canvas`, over the shared card's own
 * `bg-surface`. It was `bg-surface` over a `bg-canvas` well, which put a step across the card
 * where the fade ended: the drawing faded into the well's ground, the text below sat on another
 * one, and the band between read as a rule the card had not asked for. `Segmented`'s own row is
 * the same arrangement one dialog further out — canvas on canvas, a border between — so this is
 * the shape the site already draws a panel in.
 *
 * **The button is a sheet over the whole card**, which is what makes the whole card the target,
 * and **it is over the card rather than around it**. Wrapped, the app's own pressables end up
 * inside this one. Measured: nine of the modules carry pressables of their own, so clicking the
 * picture of the lead article added nothing at all, and clicking "Teilnehmen" inside the callout
 * closed the dialog and added nothing, silently. React reported `<button> cannot be a descendant
 * of <button>` on every open, and nothing in this repository could see it — `workbench:renders`
 * fails on a console error but never opens a dialog. So the card is `inert`: out of the tab
 * order, out of the accessibility tree and deaf to the pointer, which also takes the picker from
 * thirty-nine tabbable things down to one per card. The button comes first in the markup so
 * `peer-*` can style the card behind it.
 */
function Specimen({
  module,
  category,
  nameFamily,
  deviceWidth,
  screen,
  onPick,
}: {
  module: string;
  /** The family the core filed this block under, for the badge in the foot. */
  category: BlockCategory;
  /** Whether the tab row above already names the family, in which case the badge says it twice. */
  nameFamily: boolean;
  deviceWidth: number;
  screen: ScreenId;
  onPick: () => void;
}) {
  const intl = useWorkbenchIntl();
  const { label, what } = moduleLabel(module);
  const section: HomeSection = { id: `palette-${module}`, module };
  const sentence = intl.formatMessage(what);

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onPick}
        className="peer absolute inset-0 z-10 rounded-md focus-visible:outline-none"
      >
        {/*
          The card's whole sentence in one name. The drawing under it is `inert`, so this is the
          only thing a screen reader reaches on the card, and it carries what the two clamped
          lines above it drop.
        */}
        <span className="sr-only">
          {intl.formatMessage(COPY.addModule, {
            name: say(intl, label),
            what: sentence,
          })}
        </span>
      </button>
      <PreviewCard
        // eslint-disable-next-line react/no-unknown-property
        inert
        className="bg-canvas peer-hover:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
        previewHeight={PREVIEW_HEIGHT}
        appWidth={deviceWidth}
        title={
          <span className="min-w-0 truncate text-m font-semibold text-on-canvas">
            {say(intl, label)}
          </span>
        }
        description={sentence}
        footer={
          <>
            {/*
              Which family the block is in, and only where the tab row does not say it: on „Alle"
              and while a search spans every family. It was a heading over each family's own grid,
              which is what broke the grid — a family of four is a row of three and an orphan. The
              badge carries the app's word, the same one the tab beside it is drawn from, so a
              card and its tab cannot disagree about what family a block is in.
            */}
            {nameFamily ? (
              <Badge variant="outline" className="shrink-0 font-normal">
                <FamilyName category={category} />
              </Badge>
            ) : null}
            {/*
              ADR 0072 §5: the mark stays on the card whatever this build would do with the block.
              A shelf that hid the video row would hide the fact that there is one. One word, and
              the whole sentence behind it in the chip's own tooltip. `ml-auto` pins it to the
              right of the foot, so a card with a family badge and a card with only this one are
              the same shape rather than one badge wider than the other.
            */}
            <FeatureChip feature={MODULE_FEATURES[module]?.feature} className="ml-auto" />
          </>
        }
        preview={<HomeBlock section={section} deviceWidth={deviceWidth} screen={screen} />}
      />
    </li>
  );
}
