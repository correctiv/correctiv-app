/**
 * What the app bundles: the `ship` layout, and only that one (ADR 0078 §3).
 *
 * Metro has no directory import, so each file under `screens/` is named here by hand, and
 * `test/layouts.test.ts` fails when this list and the directory part. Another layout under
 * `data/layouts/` is for the workbench and is never imported from the app's bundle.
 */
import navigation from './navigation.json';

/** Each screen document of the layout by id. Empty on purpose: nothing is agreed to ship yet. */
export const SHIP_SCREENS: Readonly<Record<string, unknown>> = {};

export const SHIP_NAVIGATION: unknown = navigation;
