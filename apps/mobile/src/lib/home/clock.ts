import { useEffect, useState, useSyncExternalStore } from 'react';

import {
  berlinInstant,
  berlinWallClock,
  nextBerlinMidnightAfter,
  parseBerlinDateTime,
  type Instant,
} from '@correctiv/app-core/lib/berlin-time';
import {
  nextChangeAfter,
  parseTimeOfDay,
  type HomeLayout,
} from '@correctiv/app-core/lib/home-layout';

/**
 * What time Home thinks it is, and the one place anything may tell it otherwise.
 *
 * The home document is a day ([ADR 0039](../../../../../adr/0039-the-home-screen-is-a-day-not-a-timetable.md)):
 * a set of places and a list of moments, and since
 * [ADR 0059](../../../../../adr/0059-the-day-gets-a-date-and-the-newsroom-plans-in-editions.md)
 * editions over it, each active for a span of Berlin dates. Rendering is a fold up to an
 * **instant**, which normally comes from the clock. The preview needs it to come from a
 * control, or it cannot show the evening at eleven in the morning, or the election night
 * on the Wednesday before it, and an editor arranging either would be arranging it blind.
 *
 * ## Where the seam is, and why it is this one
 *
 * `sectionsAtInstant(layout, instant, reader)` — the instant is a **parameter of the selector**, so
 * the core has no clock in it at all and nothing has to be injected, stubbed or reset. What
 * is left is one question in the host: where does this screen get its instant. This file
 * is the answer, and it has exactly one door in it.
 *
 * That door is `localStorage`, for the reason `./layout.ts` gives at length about the
 * document: the workbench and the app are one origin, so the shell's `localStorage` IS
 * this app's; a write fires a `storage` event in every other same-origin document; and
 * it is the only seam that works against the **published export**, where `expo export`
 * has left no dev handle to dispatch through. The layout override already travels this
 * way, and a second mechanism for the second half of the same tool would be the one
 * nobody keeps in step.
 *
 * ## Why this is not a hole in a shipped app
 *
 * On iOS and Android there is no `localStorage`, so there is no key, and the guarded read
 * below answers `null` before it touches anything. **`window` is not what makes that
 * true**, and the guard would be a hole if it were: React Native defines one —
 * `react-native/Libraries/Core/setUpGlobals.js` sets `global.window = global` — so the
 * `typeof window === 'undefined'` half passes on a phone and it is the
 * `!window.localStorage` half that answers. `./layout.ts` next door says it that way
 * round about the same door.
 *
 * On the web target the key can be set — by the workbench, which is the point — and what
 * it can do is move the home screen to another hour of the SAME document. It selects
 * between states the document already describes; it cannot introduce one. That is a
 * strictly smaller power than `workbench:home-layout` next door, which can replace the
 * document outright, and it is spelled `workbench:` for the same reason issue #112 asks
 * of every key this tool writes: a screen that quietly differs from the repository is
 * worse than one that says who changed it.
 *
 * It is also not durable state that somebody can leave behind by accident, and it takes
 * two mechanisms rather than one to say so. The workbench holds the simulated time in the
 * **address** (`tm=18:30`, or `tm=2026-09-27T18:00` for a day of its own) and writes this
 * key from there, so a link without the parameter clears it on arrival; and the page
 * holding that address going away clears it too, which is a tab closing rather than a route changing and was the half that was
 * missing. `apps/workbench/src/preview/home/clock.ts` is the other end and says which
 * event covers which.
 */
export const HOME_TIME_OVERRIDE_KEY = 'workbench:home-time';

/**
 * The simulated instant, or null when the app is on its own clock.
 *
 * Two spellings, both Berlin wall clock (ADR 0059 §6). `YYYY-MM-DDTHH:MM` is a day and a
 * minute, which is what the editor sends once somebody has stepped to Saturday. `HH:MM` is
 * that minute **today** in Berlin, which is what the key meant before it could carry a
 * date, so a link written then still shows the hour it names.
 *
 * Guarded rather than platform-split, like the document override beside it: React Native
 * has no `localStorage`, a browser with site data switched off throws on the accessor,
 * and both answer the same way here — nobody has said what time it is, so the clock
 * stands. A value that is neither spelling is not a time either, and is the same answer: a
 * junk key must not freeze the home screen at some instant nobody can see.
 *
 * `now` is only for the bare time's day, and it is handed in rather than read here so the
 * snapshot below stays a function of the key.
 */
function simulatedInstant(text: string | null, now: Instant): Instant | null {
  const dated = parseBerlinDateTime(text);
  if (dated) return berlinInstant(dated.date, dated.minute);
  const minute = parseTimeOfDay(text);
  if (minute === null) return null;
  return berlinInstant(berlinWallClock(now).date, minute);
}

/** The key's text, or null. Text because it is what `useSyncExternalStore` compares. */
function simulatedText(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage.getItem(HOME_TIME_OVERRIDE_KEY);
  } catch {
    return null;
  }
}

/**
 * When the simulated time changes, which on the web target is a `storage` event.
 *
 * The browser fires that event in every same-origin document **except** the one that
 * made the change, so a write from the workbench arrives here and a write from this app
 * would not. That asymmetry is exactly right: nothing in the app writes this key.
 *
 * A no-op everywhere else. React calls a subscriber's unsubscribe on unmount and is
 * given one either way.
 */
function subscribeToTime(listener: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {};
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === HOME_TIME_OVERRIDE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}

/**
 * How long until the document's answer next changes, or the header's date does, from a
 * real instant, in milliseconds.
 *
 * `nextChangeAfter` answers with an instant, since editions begin and end on a date, so
 * this is a subtraction. It used to be here that the next moment's minute was turned into
 * a local instant, and Berlin's clock changes are the core's arithmetic now
 * (`berlin-time.ts`), so there is one of it rather than one per host.
 *
 * **Never null, since #254.** `nextChangeAfter` answers `null` for a layout with no
 * moments and no editions, correctly — nothing in the FOLD ever changes, so a wake-up
 * armed for it alone would fire for nothing. The header names a Berlin calendar day
 * from the same instant, though, and that changes at midnight whichever layout is
 * loaded, so `nextBerlinMidnightAfter` is included unconditionally: a moment-less,
 * edition-less document used to mean no timer at all, which meant the header stayed on
 * whatever day it first rendered until something UNRELATED re-rendered the screen.
 *
 * **Never more than a day.** `setTimeout` holds a delay of at most 2^31 − 1 ms, about 24.8
 * days, and fires at once past that; a cold review of #247 measured an edition three months
 * out doing exactly that, and the web export re-rendering in a loop. The core now answers
 * within a day and a bit (it counts Berlin midnight), and this cap is the second net under
 * it rather than the mechanism: a wake-up that turns out to change nothing just arms the
 * next one. With the midnight candidate always present the cap is now provably never
 * reached, but it costs nothing to keep as the second net it always was.
 */
export const LONGEST_WAIT_MS = 24 * 60 * 60 * 1000;

export function msUntilNextChange(layout: HomeLayout, now: Instant): number {
  const fold = nextChangeAfter(layout, now);
  const midnight = nextBerlinMidnightAfter(now);
  const next = fold === null ? midnight : Math.min(fold, midnight);
  return Math.min(next - now, LONGEST_WAIT_MS);
}

/**
 * The instant Home draws, kept in step with whatever is deciding it.
 *
 * Reading `Date.now()` on render was the first version of this, on the theory that Home
 * re-renders often enough. It does not: a tab screen stays mounted, and it re-renders
 * when a feed lands, on a pull to refresh or on a theme change, none of which happens on
 * the hour. So the lifted block moved on the next cold start rather than at the moment
 * the document names, and the screen disagreed with the document for as long as nobody
 * touched it.
 *
 * One timer to the next change, which React cancels with the screen. Not a slice and not
 * an interval: the document knows exactly when its answer changes (or, since #254, when
 * the header's calendar day does even if nothing in the document does — `msUntilNextChange`
 * is never null), so there is one wake-up per change and nothing to poll. A device that
 * sleeps through one fires the timer on resume, which is the moment the screen is next
 * seen.
 *
 * While a simulated time is set there is no timer at all, because the clock is not what
 * is deciding: an editor dragging along the day would otherwise have the screen jump
 * back to the real hour the first time a moment passed.
 */
export function useHomeInstant(layout: HomeLayout): Instant {
  const text = useSyncExternalStore(subscribeToTime, simulatedText, () => null);
  const [now, setNow] = useState(() => Date.now());
  const simulated = simulatedInstant(text, now);

  useEffect(() => {
    if (simulated !== null) return;
    const wait = msUntilNextChange(layout, now);
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, wait));
    return () => clearTimeout(timer);
  }, [layout, simulated, now]);

  return simulated ?? now;
}
