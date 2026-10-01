/**
 * How much of a device fits in the box it is standing in.
 *
 * One rule, two callers: the preview's stage and the component route's frame.
 * It was inline in `Preview.tsx` and the second caller would have copied it,
 * which is how two views of the same app end up disagreeing about what "fit"
 * means by a handle's width.
 *
 * Never above 1. A device frame scaled up is a lie about how many pixels the app
 * thinks it has, which is the whole reason the frame exists.
 */
export function fitScale(
  box: { w: number; h: number },
  size: { w: number; h: number },
  /** Padding plus anything that hangs outside the frame, per axis, in CSS px. */
  room: { x: number; y: number },
): number {
  if (box.w === 0 || size.w === 0 || size.h === 0) return 1;
  return Math.min(1, (box.w - room.x) / size.w, (box.h - room.y) / size.h);
}

/** The preview stage: `p-m` on both sides, and the drag handles outside the frame. */
export const STAGE_ROOM = { x: 40 + 24, y: 40 + 24 };

/** The component route's stage: the same padding, and no handles to leave room for. */
export const FRAME_ROOM = { x: 40, y: 40 };
