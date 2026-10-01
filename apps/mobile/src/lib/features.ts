/**
 * Which feature each gated thing in the app belongs to, declared where the thing is.
 *
 * [ADR 0072](../../../../adr/0072-features-are-released-by-a-commit-and-never-by-a-fetch.md)
 * §5: a block, a tab, a route and an entry in search or Entdecken each name a feature in
 * `packages/app-core/src/features/features.json`, and a thing that names none is reachable.
 * `__tests__/feature-gating.test.ts` holds the ids against that file in both directions.
 *
 * Imports nothing, for the reason `home/settings.ts` gives: a declaration a generator may
 * one day read must hold no React.
 */

/** Blocks of every configurable screen, by the name the layout document uses. Core blocks name `reader`. */
export const MODULE_FEATURES: Readonly<Record<string, { readonly feature: string }>> = {
  'home-header': { feature: 'reader' },
  'feed-status': { feature: 'reader' },
  'article-hero': { feature: 'reader' },
  'spotlight-briefing': { feature: 'spotlight' },
  'early-access-card': { feature: 'early-access' },
  'latest-research': { feature: 'reader' },
  'faktencheck-rail': { feature: 'reader' },
  'callout-teaser': { feature: 'callouts' },
  'mediathek-reihe': { feature: 'video' },
  'backstage-teaser': { feature: 'diary' },
  'impact-footer': { feature: 'reader' },
  'discover-header': { feature: 'discover' },
  'search-entry': { feature: 'search' },
  'topic-rail': { feature: 'discover' },
  'project-directory': { feature: 'discover' },
  'mediathek-header': { feature: 'reader' },
  'live-radio-banner': { feature: 'live-radio' },
  'podcast-rail': { feature: 'podcasts' },
  'gespraech-rail': { feature: 'video' },
  'funfacts-rail': { feature: 'video' },
  'bonus-audio-list': { feature: 'bonus-audio' },
  'participate-header': { feature: 'reader' },
  'callout-list': { feature: 'callouts' },
  'faktenforum-card': { feature: 'faktenforum' },
  'atlas-card': { feature: 'abriss-atlas' },
  // The WhatsApp tip line was never gated; the always-on core feature keeps it so.
  'tip-card': { feature: 'reader' },
  'community-note': { feature: 'reader' },
  'profile-club-card': { feature: 'reader' },
  'profile-membership': { feature: 'reader' },
  'profile-impact': { feature: 'reader' },
  'profile-area': { feature: 'reader' },
  'profile-newsletter': { feature: 'reader' },
};

/**
 * Stack routes, by file name under `src/app`. An unreachable one is not registered, so a
 * deep link to it lands on `+not-found`. Routes absent from this table are not gated:
 * `player` and `onboarding` are declared beside the navigator, and the tabs below.
 */
export const ROUTE_FEATURES: readonly { readonly route: string; readonly feature: string }[] = [
  { route: 'artikel', feature: 'reader' },
  { route: 'suche', feature: 'search' },
  { route: 'einstellungen', feature: 'settings' },
  { route: 'gespeichert', feature: 'saved' },
  { route: 'projekt/[id]', feature: 'discover' },
  { route: 'serie/[id]', feature: 'podcasts' },
  { route: 'video', feature: 'video' },
  { route: 'spotlight', feature: 'spotlight' },
  { route: 'aufruf/[slug]', feature: 'callouts' },
  { route: 'formular', feature: 'callouts' },
  { route: 'faktenforum', feature: 'faktenforum' },
  { route: 'behauptung/[id]', feature: 'faktenforum' },
  { route: 'atlas', feature: 'abriss-atlas' },
  { route: 'backstage', feature: 'early-access' },
  { route: 'tagebuch/[id]', feature: 'diary' },
  { route: 'bericht', feature: 'quarterly-report' },
];

/**
 * Tabs, by route name. A tab is reachable when ANY of its features is, so one with no
 * reachable content drops out. Home and Profil name none: Home cannot be switched off, and
 * Profil keeps its account and settings frame whatever its blocks do.
 */
export const TAB_FEATURES: Readonly<Record<string, readonly string[]>> = {
  entdecken: ['discover'],
  mediathek: ['podcasts', 'live-radio', 'video'],
  mitmachen: ['callouts', 'faktenforum', 'abriss-atlas'],
};

/** Whether a tab is reachable, given the answer for a single feature. Names none: always. */
export function tabReachable(route: string, reachable: (feature: string) => boolean): boolean {
  const features = TAB_FEATURES[route];
  return features === undefined || features.some(reachable);
}
