import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';
import { Button } from './button';
import { cn } from '../../lib/cn';

/**
 * The one word this primitive says, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/shell.ts`.
 *
 * Everything else a dialog draws comes from whoever mounted it. This is the corner
 * button Radix does not name, and it is read aloud rather than drawn — the mark on
 * it is an icon.
 */
const COPY = defineMessages({
  close: {
    id: 'shell.dialog.close',
    defaultMessage: 'Close',
    description:
      'The accessible name of the × in the corner of every dialog on this site. Read aloud and never seen.',
  },
});

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

/**
 * The dimmed ground behind a dialog or a drawer, and the tap target that shuts it.
 *
 * Radix portals this and the content as siblings on `body`, so both need their
 * own `fixed` and their own z-index. `Search.tsx` learnt that the hard way.
 */
export function DialogOverlay({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/50',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className,
      )}
      {...props}
    />
  );
}

/** A centred panel. For one docked to an edge, see `sheet.tsx`. */
export function DialogContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content>) {
  const intl = useWorkbenchIntl();

  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(32rem,92vw)] -translate-x-1/2 -translate-y-1/2',
          'max-h-[85vh] overflow-y-auto rounded-lg border border-stroke bg-canvas p-m shadow-2xl',
          'duration-150',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={intl.formatMessage(COPY.close)}
            className="absolute right-xs top-xs size-[1.75rem]"
          >
            <X aria-hidden="true" />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
