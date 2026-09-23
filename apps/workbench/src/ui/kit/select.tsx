import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '../../lib/cn';

export interface SelectOption {
  /** What `onValueChange` is handed. An empty string is allowed and means "none". */
  value: string;
  /** What the list shows, in the reader's language. Shown whole, however long. */
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  /** For a `<label htmlFor>` beside it. Without one, pass `aria-label`. */
  id?: string;
  'aria-label'?: string;
  disabled?: boolean;
  /** On the closed control, which is the part that sits in a layout. */
  className?: string;
}

/**
 * Radix reserves the empty string for "nothing chosen" and throws on an item carrying it,
 * while every list here that has a "none" row spells it `''`, the way a native `<select>`
 * did. So the empty string is swapped for this on the way in and back on the way out, and
 * no caller has to know.
 */
const NONE = '∅none';
const inward = (value: string) => (value === '' ? NONE : value);
const outward = (value: string) => (value === NONE ? '' : value);

/**
 * One choice out of a list, drawn in the kit's own look.
 *
 * **Why not the native `<select>` it replaces.** The newsroom said the dropdowns did not
 * look like the rest of the tool, and a native one cannot be made to: its open list is
 * drawn by the browser and the platform, in a light grey on a dark page, and it cuts a
 * long option (an article's title) at whatever width the list happens to have. This one
 * draws the list as a panel of the kit, in both appearances, and wraps an option onto a
 * second line rather than cutting it.
 *
 * **Why Radix, and why this Radix.** `@radix-ui/react-select` is built out of the same
 * parts the popover, the dialog and the tooltip here already pull in — popper, portal,
 * dismissable layer, focus scope, collection — so the new dependency adds two small
 * packages of its own (`number`, `use-previous`) and nothing else. What it does that a
 * hand-rolled list would have to be taught is what the native control does: the trigger
 * is a `combobox` a `<label htmlFor>` names; Enter, Space and the arrows open it; typing
 * jumps to the first option starting with those letters, closed or open; Home and End;
 * Escape closes and hands focus back; a switched-off option is skipped. `cmdk`, already
 * here for the search, is a filterable command list and answers a different question.
 *
 * **Closed, it shows as much as fits** and ends in an ellipsis, with the whole label as the
 * control's `title`, so the pin that read „5.000 neue Moscheen für Spanien? Tikt“ now reads
 * as a sentence that goes on.
 */
export function Select({
  value,
  options,
  onValueChange,
  id,
  'aria-label': ariaLabel,
  disabled,
  className,
}: SelectProps) {
  const current = options.find((option) => option.value === value);

  return (
    <SelectPrimitive.Root
      value={inward(value)}
      onValueChange={(next) => onValueChange(outward(next))}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        id={id}
        aria-label={ariaLabel}
        title={current?.label}
        className={cn(
          'inline-flex h-[1.75rem] min-w-0 items-center justify-between gap-2xs rounded-md border border-stroke bg-canvas px-2xs',
          'text-left text-s font-normal text-on-canvas',
          'hover:border-stroke-strong data-[state=open]:border-stroke-strong',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'disabled:cursor-default disabled:opacity-60',
          className,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            aria-hidden="true"
            className="size-[0.875rem] shrink-0 text-on-canvas-muted"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          /*
           * `popper` rather than Radix's default, which lays the open list over the trigger
           * with the chosen row where the trigger was, the way macOS does. Inside the
           * block's popover that covered the label above and the note below; hung under
           * the control, the list covers only what is below it.
           */
          position="popper"
          sideOffset={4}
          collisionPadding={12}
          className={cn(
            'relative z-50 overflow-hidden rounded-md border border-stroke bg-canvas shadow-xl',
            'min-w-[var(--radix-select-trigger-width)] max-w-[min(28rem,92vw)]',
            'max-h-[min(var(--radix-select-content-available-height),24rem)]',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          <SelectPrimitive.ScrollUpButton className="flex h-[1.25rem] items-center justify-center text-on-canvas-muted">
            <ChevronUp aria-hidden="true" className="size-[0.875rem]" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-3xs">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={inward(option.value)}
                disabled={option.disabled}
                /*
                 * `textValue` is what the type-ahead matches. Radix reads it off the
                 * rendered text when it is absent, which is the same string; said here so
                 * that a label made of more than text later does not quietly lose it.
                 */
                textValue={option.label}
                className={cn(
                  'relative flex cursor-pointer select-none items-start rounded-s py-3xs pr-l pl-xs',
                  'text-s leading-snug text-on-canvas outline-none',
                  'data-[highlighted]:bg-surface data-[state=checked]:font-medium',
                  'data-[disabled]:cursor-default data-[disabled]:text-on-canvas-muted',
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute top-[0.35rem] right-2xs text-accent">
                  <Check aria-hidden="true" className="size-[0.875rem]" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-[1.25rem] items-center justify-center text-on-canvas-muted">
            <ChevronDown aria-hidden="true" className="size-[0.875rem]" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
