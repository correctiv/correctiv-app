import type { HomeSection } from '@correctiv/app-core/lib/home-layout';

/**
 * Whether two readings of one place are the same place in the same state.
 *
 * A leaf module and not a private function in `HomeBlock.tsx`, for one reason: it is the
 * only part of that file a test can run. `HomeBlock.tsx` imports the app's module
 * registry and so the whole React Native tree under it, which this package's tests have
 * no environment for — and the check that was written instead asserted that
 * `memo(Block, same)` and `function same(` appear in the source. Measured, in a cold
 * review: with that check in place, `same` returning `true` unconditionally passed, and
 * so did deleting the line that compares how many settings there are. The second of
 * those is the case ADR 0046 §5 exists for, so the check was green over the failure it
 * was written to catch.
 *
 * Here it is three lines of arithmetic over two flat objects, with no import that needs
 * a browser, and `test/preview/section.test.ts` runs it.
 */

/**
 * Equal by VALUE, because identity says nothing useful about a folded section.
 *
 * `effectiveAt()` in `./document.ts` folds the day up to the playhead's point on every
 * render, and `stateAt` inside it keeps the original object for a section no moment has
 * touched and builds a NEW one, through `applyChange`, for every section a moment has.
 * So identity survives for most of the list and is lost for exactly the sections the
 * day's moments name, whether or not anything about them differs. React's default
 * comparator would therefore memoise most of the list and redraw the rest at every
 * minute of the day, for the few minutes where anything is actually different. ADR 0046
 * §5 has the figures, measured, and the table in its Context.
 *
 * Written out rather than a deep-equality import because a `HomeSection` is three fields
 * and a flat record of scalars, and `SettingValue` is compared with `===` by the document
 * itself. An absent `hidden` is `false` there too, so the two spellings of "shown" must
 * not read as a change.
 *
 * The count of keys is compared before the keys are, and it is not an optimisation: a
 * moment that ADDS a setting leaves the left side with no key to walk, so `every` over
 * an empty list answers true and the block never redraws for the one edit the whole
 * mechanism is about.
 */
export function sameSection(a: HomeSection, b: HomeSection): boolean {
  if (a.id !== b.id || a.module !== b.module) return false;
  if (Boolean(a.hidden) !== Boolean(b.hidden)) return false;

  const keys = Object.keys(a.settings ?? {});
  if (keys.length !== Object.keys(b.settings ?? {}).length) return false;
  return keys.every((key) => a.settings?.[key] === b.settings?.[key]);
}
