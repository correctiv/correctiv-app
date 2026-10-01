import { Platform } from 'react-native';

import {
  parseFeatureOverride,
  type Channel,
  type FeatureOverride,
} from '@correctiv/app-core/features/features';

/**
 * Which build this is, said once
 * ([ADR 0072](../../../../adr/0072-features-are-released-by-a-commit-and-never-by-a-fetch.md) §1, §2).
 *
 * **Fail closed.** A native build without `__DEV__` is a store build, so it is `release`
 * and reaches only what `features.json` calls `an`. Nothing has to be configured for that
 * to hold, which is what makes iOS safe by default: a forgotten setting makes a feature
 * disappear instead of shipping it. Only the places that really are previews say so, each
 * in its own condition: the dev server (`__DEV__`) and the web export, which Pages
 * publishes and which is the demo. `expo export` sets `__DEV__` false, so the web export
 * is named by its platform and not by the dev flag.
 *
 * A function of two inputs rather than a constant someone edits, so the one place a
 * build could be mislabelled `preview` is this expression and a test reads it.
 */
export function channelFor(dev: boolean, platform: string): Channel {
  return dev || platform === 'web' ? 'preview' : 'release';
}

export const CHANNEL: Channel = channelFor(__DEV__, Platform.OS);

/**
 * Where the workbench says which feature states to try in a frame.
 *
 * The seam is `lib/home/layout.ts`'s `workbench:home-layout` and the argument for it is
 * there: one origin on the web, so the workbench's `localStorage` is this app's, and a
 * phone has no `localStorage` and so no override. It is read once, while the store is
 * built, like the locale. `createAppStore` ignores it outside `preview`, so it can never
 * widen what a release reaches.
 */
export const PREVIEW_FEATURES_KEY = 'workbench:features';

export function previewFeatureOverride(): FeatureOverride | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const text = window.localStorage.getItem(PREVIEW_FEATURES_KEY);
    return text === null ? null : parseFeatureOverride(JSON.parse(text));
  } catch {
    return null;
  }
}
