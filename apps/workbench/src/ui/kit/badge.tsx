import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '../../lib/cn';

const badge = cva(
  'inline-flex shrink-0 items-center gap-3xs whitespace-nowrap rounded-full border px-xs py-4xs text-s font-medium',
  {
    variants: {
      variant: {
        default: 'border-stroke bg-surface text-on-canvas',
        outline: 'border-stroke text-on-canvas-muted',
        accent: 'border-transparent bg-accent text-white',
        /** Club yellow, and the ink on it is fixed for the same reason as on the red. */
        alt: 'border-transparent bg-accent-alternative text-neutral-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

/**
 * `asChild` because a badge is sometimes a link.
 *
 * The sources board wanted a chip that navigates and, without this, copied the
 * class string above verbatim onto an `<a>`, twice. Two copies of a design
 * decision are two places to change it and one place to forget.
 */
export function Badge({
  className,
  variant,
  asChild,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badge> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'span';
  return <Component className={cn(badge({ variant }), className)} {...props} />;
}
