import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '../../lib/cn';

/**
 * shadcn's button, with this project's colour names.
 *
 * The variants are shadcn's; the classes are not. `bg-primary` became
 * `bg-accent`, `text-muted-foreground` became `text-on-canvas-muted`, and so on
 * down the table in `styles/app.css`. Two of shadcn's names collide in meaning
 * with this palette, so aliasing them would have hidden the collision rather than
 * resolved it.
 *
 * `text-white` on the accent is deliberate and is the one place a primitive is
 * right: text on the brand red does not follow the scheme, because the red does
 * not either.
 */
const button = cva(
  'inline-flex items-center justify-center gap-xs whitespace-nowrap rounded-md text-m font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[1rem] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent/90',
        outline: 'border border-stroke bg-canvas hover:bg-surface hover:text-on-canvas',
        ghost: 'hover:bg-surface hover:text-on-canvas',
        link: 'text-on-canvas underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-[2.25rem] px-sm py-xs',
        sm: 'h-[2rem] rounded-md px-s text-s',
        lg: 'h-[2.5rem] rounded-md px-m',
        icon: 'h-[2.25rem] w-[2.25rem]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof button> {
  /** Render as the child element instead of a `button`, for links that look like buttons. */
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(button({ variant, size }), className)} {...props} />;
}

export { button as buttonVariants };
