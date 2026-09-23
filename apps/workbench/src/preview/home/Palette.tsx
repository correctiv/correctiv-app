import { Plus } from 'lucide-react';
import { useState } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { say } from '../../i18n/messages';

import type { HomeSection } from '@correctiv/app-core/lib/home-layout';

// The app's own declaration, and ADR 0046 §1 one step along: the palette was
// `HOME_MODULES` itself, and is now the blocks that say they belong on the screen being
// edited (ADR 0054 §2 and §5). The check that used to refuse a module the shipped
// document does not place went with ADR 0046 §1 and has not come back; what holds the
// declaration against the registry is `apps/mobile/__tests__/home-layout.test.tsx`, in
// both directions, which is what ADR 0046 §1's "no second list to forget" became.
import { blocksFor } from '@/lib/home/screens';

import { AppHost } from '../../components/AppHost';
import { cn } from '../../lib/cn';
import { InfoTip } from '../../ui/kit/info-tip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../ui/kit/dialog';
import { moduleLabel } from './document';
import { HomeBlock } from './HomeBlock';

/**
 * Where a block goes, chosen before what goes there.
 *
 * [ADR 0045](../../../../../adr/0045-the-home-editor-arranges-the-blocks-it-draws.md) §6:
 * a thin control between every pair of blocks and at each end, opening the modules
 * available, each drawn the way §3 draws a block. **The position first**, because a
 * person inserting into a list points at a gap and then says what goes in it; picking a
 * module and then being asked where has the same two steps in the order that makes the
 * first one abstract.
 *
 * ADR 0046 §4 decides what the palette does not do: it offers every module and remarks on
 * none. Two headers at the top and an impact footer in the middle are both allowed and
 * neither is commented on, because "makes sense here" is a judgement the editor would be
 * inventing on a newsroom's behalf. What stands in for a rule is the frame: an
 * arrangement nobody wants is on screen at the size it ships at the moment it is placed.
 */

/** How tall a specimen may be before it is cut off, and why it may be cut off at all. */
const SPECIMEN = 'max-h-[13rem]';

/**
 * Everything the palette says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/home.ts`.
 *
 * Three of the values these take are not this file's to translate and are German all
 * the same. `where` comes from `whereAt` in `./document.ts` and `name` and `what` from
 * `MODULE_LABELS` in the same module, and both of those are descriptors formatted
 * against this site's own catalogue before they arrive here. Until 2026-09-18 they were
 * English prose handed in as a value, and a German mark read German around an English
 * fragment; what hid it for five passes is that the table's fields were called `name`
 * and `what`, and `test/rendered-literals.test.ts` watched neither.
 *
 * **All four would have been formatted under the APP's provider, which is why this
 * file calls `useWorkbenchIntl()` rather than `useIntl()`.** `HomeDocument` mounts one
 * `AppHost` around the whole block list, both `InsertMark` call sites are inside it,
 * and `AppHost` mounts `AppEnvironment`, which mounts the app's own `IntlProvider`.
 * react-intl's context here is therefore the app's, which holds no `home.*` id, and
 * each of these would have rendered its English `defaultMessage` and reported nothing
 * — `vite.app.mjs` defines `__DEV__` false for this site, so the app's `onError`
 * throws only with it. Measured that way on the dev server before the fix: the bar
 * above the frame read „Rahmen“ while the mark below it read "Add a block at the top
 * of the day".
 *
 * `useWorkbenchIntl()` reads a context of this site's own, which the app's provider
 * cannot shadow because it is a different object, and `test/i18n.test.ts` fails on a
 * `useIntl` anywhere outside `src/i18n/`. `document.ts` holds no hook at all, because
 * it is a table the dev server and the tests load in Node, so it takes the formatter as
 * an argument, and the one this file hands it is that same context.
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
      'The list offers every block that fits this screen. How it looks, you see in the frame beside it.',
    description: 'Behind the ⓘ beside the palette dialog’s heading, home.palette.title.',
  },
  addModule: {
    id: 'home.palette.addModule',
    defaultMessage: 'Add {name}. {what}',
    description:
      'The accessible name of one tile in the palette, which is a drawing of a module with the drawing itself hidden from the accessibility tree. {name} is the module’s name and {what} the sentence about it, both shown on the tile.',
  },
});

export function InsertMark({
  where,
  deviceWidth,
  onAdd,
}: {
  /** Said in words, for the dialog and for the mark's own label: "at the top", "after X". */
  where: string;
  /** The width a specimen draws at, handed down so the list and the palette cannot part. */
  deviceWidth: number;
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

      <DialogContent className="w-[min(60rem,92vw)]">
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
          dialog is open, which is why a second one beside the list's is affordable.
        */}
        <AppHost>
          <ul className="mt-s grid grid-cols-1 gap-xs sm:grid-cols-2">
            {/* The screen this tool edits. One value today, and the reason it is written
                rather than left implicit is ADR 0054 §2: the second screen should be a
                change to this line and not a discovery about what the palette meant. */}
            {blocksFor('home').map((module) => (
              <Specimen
                key={module}
                module={module}
                deviceWidth={deviceWidth}
                onPick={() => {
                  onAdd(module);
                  setOpen(false);
                }}
              />
            ))}
          </ul>
        </AppHost>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One module, drawn, as a thing to press.
 *
 * The drawing is cut off at a height rather than shown whole, and that is the one place
 * this departs from "drawn as §3 draws a block". §3 is about WIDTH — a block is the size
 * it is on the phone, so it is recognisable as that thing — and it says nothing about
 * height. A palette is read by recognising, and every module at its real height is more
 * scrolling than the question "which one is the video row" is worth.
 *
 * A `section` invented here rather than taken from the document, because the specimen is
 * not in the document: it has no settings, no `hidden`, and an id that exists only to
 * label the boundary around it. That is also exactly what `added` puts in the document
 * when this one is chosen, so what the palette shows is what arrives.
 */
function Specimen({
  module,
  deviceWidth,
  onPick,
}: {
  module: string;
  deviceWidth: number;
  onPick: () => void;
}) {
  const intl = useWorkbenchIntl();
  const { label, what } = moduleLabel(module);
  const section: HomeSection = { id: `palette-${module}`, module };

  return (
    <li className="relative">
      {/*
        **The tile is a button laid OVER the drawing, not a button wrapped around it**,
        and that is a fault a cold review found rather than a preference.

        Wrapped, the app's own pressables end up inside this one. Measured: nine of the
        modules carry pressables of their own, so clicking the picture of the lead article
        added nothing at all, and clicking "Teilnehmen" inside the callout closed the
        dialog and added nothing, silently. React reported `<button> cannot be a
        descendant of <button>` on every open, and nothing in this repository could see it
        — `workbench:renders` fails on a console error but never opens a dialog.

        So the drawing is `inert`: out of the tab order, out of the accessibility tree and
        deaf to the pointer, which also takes the palette from thirty-nine tabbable things
        down to one per tile. The button is a transparent sheet over the whole tile and
        carries the only accessible name. It comes first in the markup so that `peer-*`
        can style the tile behind it.
      */}
      <button
        type="button"
        onClick={onPick}
        className="peer absolute inset-0 z-10 rounded-md focus-visible:outline-none"
      >
        <span className="sr-only">
          {intl.formatMessage(COPY.addModule, {
            name: say(intl, label),
            what: intl.formatMessage(what),
          })}
        </span>
      </button>
      <div
        // eslint-disable-next-line react/no-unknown-property
        inert
        className={cn(
          'flex w-full flex-col overflow-hidden rounded-md border border-stroke',
          'peer-hover:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent',
        )}
      >
        <div className="flex w-full flex-col gap-4xs border-b border-stroke p-xs">
          <span className="text-m font-semibold text-on-canvas">{say(intl, label)}</span>
          <span className="text-s leading-relaxed text-on-canvas-muted">
            {intl.formatMessage(what)}
          </span>
        </div>
        <div className={cn('w-full overflow-hidden bg-canvas', SPECIMEN)}>
          <HomeBlock section={section} deviceWidth={deviceWidth} />
        </div>
      </div>
    </li>
  );
}
