import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { ComponentProps } from 'react';

import { cn } from '../../lib/cn';

/**
 * A panel anchored to the control that opened it.
 *
 * The third of this kit's layered primitives, and the one the other two could not stand
 * in for. A `Dialog` is modal and centred: it dims the page and covers the thing it is
 * about, which is right for the palette — a person choosing a module is not looking at the
 * list behind it — and wrong for a block's own settings, where
 * [ADR 0053](../../../../../adr/0053-the-editor-is-the-screen-and-the-drag-is-the-answer.md)
 * §3 keeps ADR 0045 §8's reason while changing its form: a setting is judged by what it
 * does to the block, so the block has to stay on screen while it is moved. A `Tooltip` is
 * not an answer either, because these hold controls and a tooltip may hold none.
 *
 * Radix composes this out of the same parts the dialog and the tooltip here already pull
 * in — `react-popper`, `react-dismissable-layer`, `react-portal`, `react-focus-scope` —
 * so the dependency is a name in `package.json` and almost nothing on the wire.
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  align = 'start',
  side = 'left',
  sideOffset = 8,
  collisionPadding = 12,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        side={side}
        sideOffset={sideOffset}
        /*
         * Left, and out of the panel, by default. The panel this opens in is a narrow dock
         * (ADR 0038 gives the home tool 31% of the window) and the stage beside it is the
         * widest empty thing on screen, so a panel opening inward would cover the one
         * block it is about. `collisionPadding` is what turns that into a preference
         * rather than a promise: on a window too narrow for it, Radix flips it back.
         *
         * **Which side of what** is the caller's to say, and the home editor says it with
         * a `PopoverAnchor` rather than letting this hang off the button: anchored to the
         * button, "left" is only left of a control that already sits at the panel's right
         * edge, so the panel is what the popover covers. Measured — it opened at x=1287 in
         * a panel starting at x=1230. Anchored to the block, the same word means what it
         * says.
         */
        collisionPadding={collisionPadding}
        className={cn(
          'z-50 w-[min(22rem,92vw)] rounded-md border border-stroke bg-canvas p-s shadow-2xl',
          'max-h-[min(30rem,80vh)] overflow-y-auto',
          'duration-150',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'focus-visible:outline-none',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
