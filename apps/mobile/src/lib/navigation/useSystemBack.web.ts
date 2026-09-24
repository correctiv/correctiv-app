/**
 * The web target's half of `useSystemBack`, which does nothing (issue #120).
 *
 * A browser has no system back, only its own, and that one walks the browser's
 * history rather than the app's. Measured against the static export in headless
 * Chrome on 2026-09-24: a pushed route, a tab and the player modal each come back
 * with browser back, and a route opened in a new tab has no history to go back to,
 * so browser back leaves it standing and the drawn control (`goBack`) goes Home.
 * The onboarding's three pages are one address, so browser back does not step
 * through them; on a first visit it has no entry before the onboarding and does
 * nothing, which strands nobody, because the pages carry their own controls.
 *
 * Writing history entries for those pages to make browser back step through them
 * was not done: it would put three entries for one address into a reader's history,
 * and a reload on the second would open the first.
 *
 * React Native Web's `BackHandler` exists, but it logs an error for every listener,
 * and the workbench's render checks count a logged error as a fault.
 */
export function useSystemBack(_handler: () => boolean): void {}
