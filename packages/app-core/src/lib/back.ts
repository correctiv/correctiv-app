/**
 * Where the system's back goes, for the screens that answer it themselves
 * (issue #120).
 *
 * Almost none do. The navigator answers back for every pushed route and both
 * modals, and it has a screen to pop because the root layout anchors the tabs
 * underneath whatever was entered: a deep link opened from a cold start comes back
 * to Home and only then leaves the app, measured on an Android 16 emulator with
 * the button and with the gesture. This file is for the one flow whose pages are
 * not routes, so the navigator cannot see them, and for the case where there is no
 * screen underneath at all.
 *
 * Dependency-free like the rest of `lib/`: the host listens for back in whatever
 * way its platform offers, asks this what to do, and does it.
 */

/**
 * What back does on the onboarding.
 *
 * - `step`: go to the page before this one. The three pages are one screen with a
 *   counter, so without this back skipped the whole flow from its second page.
 * - `leave`: do nothing here and let the navigator pop the screen, because there is
 *   one underneath it, as there is when the onboarding is opened over the app.
 * - `skip`: leave the flow the way its own skip does, which records it as done and
 *   goes to Home.
 */
export type OnboardingBack = { kind: 'step'; to: number } | { kind: 'leave' } | { kind: 'skip' };

/**
 * `canLeave` is whether the navigator has a screen under the onboarding.
 *
 * **On a first launch it has none, and that is the case this exists for.** The
 * root layout reaches the onboarding with `replace` from `/`, so the stack is the
 * onboarding alone and a back the navigator answered left the app: measured on the
 * emulator, from the mission page, with the button and with the gesture. A reader
 * who had just signed in was put out on the launcher, and the next start opened the
 * same page again, because nothing had been recorded.
 *
 * Back out of the first page is therefore the skip. Not "stay", which would make the
 * one page a reader cannot back out of the first page they ever see; not "leave the
 * app", which is what the issue rules out; and not "go Home without recording it",
 * which would ask again on every start and put the reader back where the skip was
 * meant to take them. The mission page has no skip of its own, and back is how
 * Android spells one.
 */
export function onboardingBack(step: number, canLeave: boolean): OnboardingBack {
  if (step > 0) return { kind: 'step', to: step - 1 };
  return canLeave ? { kind: 'leave' } : { kind: 'skip' };
}
