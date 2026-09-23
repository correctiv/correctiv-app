import * as PopoverPrimitive from '@radix-ui/react-popover';
import { clsx } from 'clsx';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { defineMessages } from 'react-intl';

import { useWorkbenchIntl } from '../../i18n/Localisation';

/**
 * What this primitive says of itself, in ENGLISH; the German that ships is
 * `src/i18n/catalogue/de/shell.ts`.
 */
const COPY = defineMessages({
  about: {
    id: 'shell.info.about',
    defaultMessage: 'More about “{topic}”',
    description:
      'The accessible name of a small ⓘ button that opens an explanation, and of the panel it opens. Read aloud, and shown as a native tooltip on hover. {topic} is the heading or label the explanation sits beside, already in the reader’s language.',
  },
});

export interface InfoTipProps {
  /**
   * The heading, label or control this explains, in the reader's language. The
   * button is named after it ("More about “The board”") so that a screen reader
   * listing buttons hears which of a page's tips is which, rather than one
   * "More" per section.
   */
  about: string;
  /** The explanation, with its rich text already formatted by the caller. */
  children: ReactNode;
  /**
   * Draws `about` beside the icon as well as reading it out, for a place where there
   * is no heading or label for the icon to sit beside: a page's footer.
   */
  showLabel?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * A small ⓘ beside a heading, label or control, and the background it explains.
 *
 * **Background, not instructions.** Why a thing is the way it is, which record decided
 * it, how the published site differs from a dev server: a reader wants that once and
 * then never again, so it waits behind this. What a person needs to act, a warning, an
 * error, an empty state or a result stays on the page, because nobody opens a tip to
 * find out that something failed.
 *
 * **A popover on click, not a tooltip on hover**, for two reasons. Touch has no hover,
 * so a hover tip is a text a phone never shows. And these hold rich text, `<code>` runs
 * and links, which a Radix tooltip may not: its content is a description and takes no
 * focus, so a link inside one is a link nobody with a keyboard can reach.
 *
 * Radix gives the rest: the trigger is a real button, so Tab reaches it and Enter or
 * Space opens it; Escape or a click outside closes it, and focus goes back to the
 * button. The panel is non-modal, so the page behind stays readable while it is open.
 */
export function InfoTip({
  about,
  children,
  showLabel = false,
  side = 'bottom',
  align = 'start',
  className,
}: InfoTipProps) {
  const intl = useWorkbenchIntl();
  const name = intl.formatMessage(COPY.about, { topic: about });

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        type="button"
        aria-label={showLabel ? undefined : name}
        title={name}
        /*
         * Joined, not merged. This was written when `twMerge` read this project's `text-s`
         * as a colour and dropped it (#249, fixed in `lib/cn.ts`); it stays a join because
         * nothing here is meant to override anything else here, so a merge has nothing
         * to do.
         */
        className={clsx(
          'inline-flex shrink-0 items-center gap-3xs rounded-full align-middle text-on-canvas-muted',
          'hover:text-on-canvas data-[state=open]:text-on-canvas',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
          // Sized to the text around it: the icon is one em, and the button is padded out
          // to something a finger can hit without widening the line it sits in.
          '-m-3xs p-3xs',
          showLabel && 'text-s',
          className,
        )}
      >
        <Info aria-hidden="true" className="size-[1em] min-h-[0.875rem] min-w-[0.875rem]" />
        {showLabel && <span>{about}</span>}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={12}
          aria-label={name}
          className={clsx(
            'z-50 w-[min(24rem,92vw)] max-h-[min(28rem,70vh)] overflow-y-auto',
            'rounded-md border border-stroke bg-canvas p-s shadow-xl',
            'space-y-xs text-s font-normal normal-case leading-relaxed tracking-normal text-on-canvas',
            '[&_a]:underline [&_a]:underline-offset-2',
            'duration-150 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'focus-visible:outline-none',
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
