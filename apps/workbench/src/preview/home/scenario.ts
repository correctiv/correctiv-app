import type { HomeLayout } from '@correctiv/app-core/lib/home-layout';

import { layoutOf, SCENARIOS, scenarioNamed, type Scenario } from '../scenarios';
import type { PreviewState } from '../state';
import { differs, formatLayoutDocument, SHIPPED } from './document';

/**
 * What opening and leaving a scenario does to the editor's document, as rules a test can
 * hold without a browser.
 *
 * The editor holds one document, and the framed app draws it out of the
 * `workbench:home-layout` key (`write.ts`). A scenario is loaded into that one document,
 * because a second one would be a second thing the frame could be drawing and a person
 * could not tell which. So opening a scenario is the one place this tool could replace
 * somebody's work without being asked, and the cold review of #247 named losing a
 * person's work silently as the defect to avoid. Hence the three answers below.
 */

/** Whether two documents are the same file, as the printer would write them. */
export function same(a: HomeLayout, b: HomeLayout): boolean {
  return formatLayoutDocument(a) === formatLayoutDocument(b);
}

/**
 * What arriving at a scenario does with the document the editor already holds.
 *
 * - `there`: it is the scenario's document already, typically a reload. Nothing to do.
 * - `load`: it is the shipped file, so nothing of anybody's is in it. Load the scenario.
 * - `ask`: it is somebody's own work. **Nothing is written**: the frame goes on drawing
 *   that work, and the panel asks whether to replace it or keep it.
 *
 * Asking, rather than keeping the work somewhere else and loading the scenario anyway,
 * because a second stored document is durable state nobody can see, and on a return it
 * would have to be offered back by a rule nobody would guess. The one key already
 * behaves the way ADR 0039 §9 wants state to behave: what the frame shows is what is
 * stored.
 */
export type Arrival = 'there' | 'load' | 'ask';

export function arriving(current: HomeLayout, scenario: HomeLayout): Arrival {
  if (same(current, scenario)) return 'there';
  if (!differs(current)) return 'load';
  return 'ask';
}

/**
 * What leaving a scenario puts in the editor: the shipped file, or nothing to change.
 *
 * The shipped file when the document is still the scenario's untouched one, so the frame
 * goes back to what readers see. **Not when somebody has edited it**: that is work too,
 * and leaving by the address bar or a step back in history has no moment in which to ask.
 * So it stays, marked as changed, "Discard changes" throws it away when that is what was
 * meant, and `scenarioIn` below still keeps it from being submitted.
 */
export function leaving(current: HomeLayout, scenario: HomeLayout): HomeLayout | null {
  return same(current, scenario) ? SHIPPED : null;
}

/**
 * The scenario a document came from, by the editions it carries, or null.
 *
 * What guards Submit changes after the address has let go of the scenario: an edited
 * election night kept by `leaving` is still the election night, and submitting it would
 * publish it. An edition id is the mark because it is what a scenario has that the
 * shipped day does not, and because deleting that edition is exactly the edit after which
 * the document is no longer the scenario. `test/preview/scenarios.test.ts` holds every
 * scenario to carrying at least one edition whose id is found in no other document.
 */
export function scenarioIn(layout: HomeLayout): Scenario | null {
  const ids = new Set(layout.editions.map((edition) => edition.id));
  return (
    SCENARIOS.find((scenario) =>
      (layoutOf(scenario)?.editions ?? []).some((edition) => ids.has(edition.id)),
    ) ?? null
  );
}

/**
 * Whether Submit changes and the dev server's Save are switched off for this document:
 * while the address has a scenario open, and while the document is still one after
 * leaving it.
 *
 * `HomeDocument.tsx` says why that is a switched-off button with a reason and not a
 * confirmation.
 *
 * **A known limit, accepted:** a scenario is recognised by its edition id, nothing more. A
 * copy rebuilt by hand under another id, or the scenario's changes typed into the day,
 * is an ordinary document to this and can be submitted. Matching on content would have to
 * say how similar is too similar, and the review is still the lock (ADR 0058 §2): what this
 * stops is the accident of submitting an example that is still open, not somebody who
 * means to publish it.
 */
export function guarded(open: string | null, layout: HomeLayout): boolean {
  return scenarioNamed(open) !== null || scenarioIn(layout) !== null;
}

/** The person's own time and session, as they were before a scenario was opened. */
export interface Held {
  time: string | null;
  seed: string | null;
}

export function heldOf(state: PreviewState): Held {
  return { time: state.time, seed: state.seed };
}

/**
 * The patch that opens a scenario from the list.
 *
 * Its time and its session come with it only once the scenario is actually loaded. While
 * it is `ask`ing, the frame still draws the person's own document, and moving their
 * playhead or reseeding their session (which clears the app's storage) before they have
 * answered would be taking something of theirs without asking after all. So the address
 * names the scenario and keeps their `tm=` and `s=`, and `loading` applies the scenario's
 * two when they choose to load it.
 */
export function entering(
  scenario: Scenario,
  before: PreviewState,
  arrival: Arrival,
): Partial<PreviewState> {
  if (arrival === 'ask') return { scenario: scenario.name, time: before.time, seed: before.seed };
  return { scenario: scenario.name, ...loading(scenario) };
}

/** A scenario's own time and session, for the moment it is loaded. */
export function loading(scenario: Scenario): Partial<PreviewState> {
  return { time: scenario.opensAt, seed: scenario.session };
}

/**
 * The patch that leaves one: the person's own time and session back, as they were before
 * they opened it.
 *
 * `held` is what `heldOf` took when the scenario was opened from the list. However far the
 * playhead moved inside the scenario, that was the scenario's made-up date, and what comes
 * back is the hour the person had been looking at.
 *
 * Without anything held, which is a scenario that arrived in a link, there is nothing of
 * theirs to give back: the playhead returns to the real clock, the scenario's own session
 * goes, and a fixture they chose themselves stays. `seed: null` means "leave the storage
 * alone" (`Preview.tsx`), not "sign out".
 */
export function exiting(state: PreviewState, held: Held | null): Partial<PreviewState> {
  const scenario = scenarioNamed(state.scenario);
  if (!scenario) return { scenario: null };
  if (held) return { scenario: null, ...held };
  return {
    scenario: null,
    time: null,
    seed: state.seed === scenario.session ? null : state.seed,
  };
}
