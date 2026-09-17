import { Plus } from 'lucide-react';
import { useState } from 'react';

import type { HomeSection } from '@correctiv/app-core/lib/home-layout';

// The app's own registry, and the whole of ADR 0046 §1: the palette IS this table, so a
// module added to the app appears here without anybody listing it a second time. The
// check that used to refuse a module the shipped document does not place went with that
// decision, because the condition it flagged stopped being a fault.
import { HOME_MODULES } from '@/lib/home/modules';

import { AppHost } from '../../components/AppHost';
import { cn } from '../../lib/cn';
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

export function InsertMark({
  where,
  deviceWidth,
  dropping = false,
  onAdd,
}: {
  /** Said in words, for the dialog and for the mark's own label: "at the top", "after X". */
  where: string;
  /** The width a specimen draws at, handed down so the list and the palette cannot part. */
  deviceWidth: number;
  /**
   * Whether a block being dragged would land here.
   *
   * The drop indicator is a state of this control rather than a line drawn over the list,
   * because the marks are already one per gap, at exactly the places a block can land in.
   * A second thing drawn at the same positions would be a second answer to "where are the
   * gaps", and the two would part the first time one of them moved.
   */
  dropping?: boolean;
  onAdd: (module: string) => void;
}) {
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
          aria-label={`Add a block ${where}`}
          className="group relative flex h-s w-full shrink-0 items-center focus-visible:outline-none"
        >
          {/*
            One unbroken hairline, with the `+` laid over its middle rather than set
            between two halves of it. Laid between, the mark reads as two dashes while
            nothing is pointing at it, because a hidden element still takes its width.
          */}
          <span
            aria-hidden="true"
            className={cn(
              'h-px w-full transition-colors',
              'bg-stroke group-hover:bg-accent group-focus-visible:bg-accent',
              open && 'bg-accent',
              // Thicker only for a drop: the open state is a dialog asking what to add,
              // and a line that got heavier for it would be saying something about a
              // landing that is not happening.
              dropping && 'h-[2px] bg-accent',
            )}
          />
          <Plus
            aria-hidden="true"
            className={cn(
              'absolute left-1/2 size-[0.875rem] -translate-x-1/2 rounded-full bg-surface',
              'text-accent opacity-0 transition-opacity',
              'group-hover:opacity-100 group-focus-visible:opacity-100',
              open && 'opacity-100',
              // Not while a block is being dropped here: the thickened line says where it
              // lands, and a plus sign beside it would say "add" about a move.
              dropping && 'opacity-0',
            )}
          />
        </button>
      </DialogTrigger>

      <DialogContent className="w-[min(60rem,92vw)]">
        <DialogTitle className="text-l font-semibold text-on-canvas">Add a block</DialogTitle>
        <DialogDescription className="mt-3xs text-s leading-relaxed text-on-canvas-muted">
          It goes {where}. Every module the app holds is offered; the frame beside this is where an
          arrangement is judged, not this list.
        </DialogDescription>

        {/*
          One environment for the whole palette rather than one per specimen, the same
          arrangement the list uses and for the same reason. It is mounted only while the
          dialog is open, which is why a second one beside the list's is affordable.
        */}
        <AppHost>
          <ul className="mt-s grid grid-cols-1 gap-xs sm:grid-cols-2">
            {Object.keys(HOME_MODULES).map((module) => (
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
  const { name, what } = moduleLabel(module);
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
          Add {name}. {what}
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
          <span className="text-m font-semibold text-on-canvas">{name}</span>
          <span className="text-s leading-relaxed text-on-canvas-muted">{what}</span>
        </div>
        <div className={cn('w-full overflow-hidden bg-canvas', SPECIMEN)}>
          <HomeBlock section={section} deviceWidth={deviceWidth} />
        </div>
      </div>
    </li>
  );
}
