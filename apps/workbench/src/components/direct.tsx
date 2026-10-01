import { CATALOGUE, componentId, type Entry, type Specimen } from '@/gallery/catalogue';

import { NOT_DRAWN } from './direct-ids';

/**
 * The app's components, drawn by this site rather than framed.
 *
 * **The specimens are the app's own list, imported, not copied.** `CATALOGUE` in
 * `apps/mobile/src/gallery/catalogue.tsx` already says what every component is
 * shown with, in the props' own words, with the awkward cases deliberately in it.
 * Writing a second list here would be the two copies AGENTS.md exists to prevent,
 * and the app's own `__tests__/gallery-catalogue.test.ts` already fails when a
 * component is missing from it — a guarantee a list in this package could not
 * have.
 *
 * ADR 0027 shipped two entries typed out by hand, imported by file, to keep the
 * barrel's dependencies out of this bundle. That finding is unchanged and is
 * still about `apps/mobile`: the catalogue imports `@/components/ui`, so this
 * bundle now carries `@expo/vector-icons` and `expo-image`. It is paid
 * knowingly — every one of them is drawn here, so each is needed
 * anyway, and the alternative was a second catalogue. ADR 0028 records the
 * trade.
 *
 * What this file adds to the app's list is the one thing the app cannot know:
 * which components this site's React tree can actually mount. That is
 * `NOT_DRAWN` beside it, measured by looking, and it is a list of exceptions
 * rather than a list of members precisely because the catalogue is the roster.
 */
export type DirectSpecimen = Specimen;
export type DirectEntry = Entry;

/** `group/name` for every component the app's catalogue knows, in the app's order. */
export const CATALOGUE_ENTRIES: { id: string; entry: DirectEntry }[] = CATALOGUE.flatMap((folder) =>
  folder.entries.map((entry) => ({ id: componentId(folder.folder, entry.name), entry })),
);

const BY_ID = new Map(CATALOGUE_ENTRIES.map(({ id, entry }) => [id, entry]));

/** The specimens for `group/name`, or nothing where this site cannot draw it. */
export function directEntry(id: string): DirectEntry | undefined {
  if (id in NOT_DRAWN) return undefined;
  return BY_ID.get(id);
}

/** Every id this site draws itself, which is the catalogue minus the exceptions. */
export const DRAWN_IDS: ReadonlySet<string> = new Set(
  CATALOGUE_ENTRIES.map(({ id }) => id).filter((id) => !(id in NOT_DRAWN)),
);
