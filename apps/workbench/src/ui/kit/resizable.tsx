import { GripVertical } from 'lucide-react';
import { useEffect, useState, type ComponentProps, type RefObject } from 'react';
import {
  Group,
  Panel,
  Separator as ResizeSeparator,
  type PanelImperativeHandle,
} from 'react-resizable-panels';

import { cn } from '../../lib/cn';

/** What `panelRef` hands back: `collapse`, `expand`, `resize`, `isCollapsed`. */
export type PanelHandle = PanelImperativeHandle;

/**
 * Split panes, which is the one piece of furniture a hand-written stylesheet
 * cannot supply.
 *
 * The preview needs the frame and the dock to share the width on terms the
 * reader sets, and keyboard resizing comes with the primitive.
 *
 * shadcn's wrapper is written against version 2 of this package, and version 4
 * moved a good deal: the exports are `Group` and `Separator` rather than
 * `PanelGroup` and `PanelResizeHandle`, and a group takes its orientation from
 * its own flex direction rather than from a `direction` prop. The names are
 * mapped here so no caller carries the difference.
 *
 * One rule of version 4 is worth knowing before writing a size: a NUMBER is
 * pixels and a STRING is a percentage. `defaultSize={38}` is thirty-eight
 * pixels, not thirty-eight percent, and it renders as a sliver rather than as an
 * error. Write `"38%"`.
 */
export const ResizablePanel = Panel;

/**
 * Whether a resize handle is being held, anywhere in the document.
 *
 * A panel whose width animates has to stop animating while somebody is dragging
 * it, or every frame sets a new target and the panel trails the pointer by the
 * length of the transition. The library exposes the drag state on the separator
 * it belongs to and not to the panels, so this reads it from the document
 * instead: one listener for the whole page, which is what the answer is anyway.
 */
/**
 * Hold a collapsible panel open or shut, whether or not it is ready to hear it.
 *
 * `collapse()` and `expand()` throw "Panel constraints not found" when the group
 * has not registered that panel yet, and it has not when the effect runs in the
 * same commit that mounted it. Crossing the narrow/wide line does exactly that:
 * resize a window past 64rem and both panels mount and are told what to do in one
 * breath. The throw took the whole view down, boundary or no boundary.
 *
 * So it tries, and if the group is not ready it tries again on the next frame,
 * by which time it is.
 */
export function usePanelState(
  ref: RefObject<PanelHandle | null>,
  open: boolean,
  width: () => string,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    let frame = 0;

    const apply = () => {
      const panel = ref.current;
      if (!panel) return;
      try {
        if (open) {
          panel.expand();
          panel.resize(width());
        } else {
          panel.collapse();
        }
      } catch {
        frame = requestAnimationFrame(apply);
      }
    };

    apply();
    return () => cancelAnimationFrame(frame);
    // `width` is read at apply time, so a new closure each render must not
    // re-run this: what it returns is the same string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open, ref]);
}

export function useDragging(): boolean {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const down = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest?.('[data-separator]')) setDragging(true);
    };
    const up = () => setDragging(false);
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', up, true);
    };
  }, []);

  return dragging;
}

export function ResizablePanelGroup({ className, ...props }: ComponentProps<typeof Group>) {
  return (
    <Group
      className={cn('flex h-full w-full data-[direction=vertical]:flex-col', className)}
      {...props}
    />
  );
}

export function ResizableHandle({
  withHandle,
  className,
  ...props
}: ComponentProps<typeof ResizeSeparator> & { withHandle?: boolean }) {
  return (
    <ResizeSeparator
      className={cn(
        'relative flex w-px items-center justify-center bg-stroke',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        'data-[state=dragging]:bg-accent hover:bg-stroke-strong',
        'data-[direction=vertical]:h-px data-[direction=vertical]:w-full',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <span className="z-10 flex h-[1.5rem] w-[0.75rem] items-center justify-center rounded-s border border-stroke bg-surface">
          <GripVertical className="size-[0.625rem] text-on-canvas-muted" aria-hidden="true" />
        </span>
      )}
    </ResizeSeparator>
  );
}
