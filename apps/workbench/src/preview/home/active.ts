import { SHIPPED_LAYOUT } from '@correctiv/app-core/lib/screen-layout';

/**
 * The layout the workbench is editing, which every document it holds belongs to (ADR 0080).
 *
 * Its own leaf, with no import of the stores, because the data module (`screens.ts`) has to
 * ask what the files of "the open layout" are and the stores have to ask it for the
 * documents: a variable in either would be a cycle. `home/store.ts` is the only writer, and
 * `selectLayout` is where the other state follows it.
 */
let active: string = SHIPPED_LAYOUT;

export function activeLayout(): string {
  return active;
}

export function setActiveLayout(layout: string): void {
  active = layout;
}
