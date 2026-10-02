import { Platform } from 'react-native';

import {
  parseFeatureOverride,
  type Channel,
  type FeatureOverride,
} from '@correctiv/app-core/features/features';

/**
 * The build-time opt-in to `preview`, and the one value that counts as it.
 *
 * `process.env.EXPO_PUBLIC_…` is inlined into the bundle at build time, so this is a
 * build flag rather than a runtime setting: a tester APK carries it, a store APK does
 * not, and neither can change it afterwards. It is written with dot notation because
 * Expo inlines that form and no other (`process.env['…']` is left as a lookup, which
 * would fail silently rather than loudly).
 *
 * `preview` and nothing else. A boolean flag would read as `false` for a typo, and an
 * unset variable is indistinguishable from one somebody meant to set to `0`; a value
 * that only means one thing has no wrong spelling that grants a reader a feature the
 * product has not released.
 */
export const PREVIEW_OPT_IN = 'EXPO_PUBLIC_CORRECTIV_CHANNEL';

function previewOptIn(): boolean {
  return process.env.EXPO_PUBLIC_CORRECTIV_CHANNEL === 'preview';
}

/**
 * Which build this is, said once
 * ([ADR 0072](../../../../adr/0072-features-are-released-by-a-commit-and-never-by-a-fetch.md) §1, §2).
 *
 * **Fail closed.** A native build without `__DEV__` is a store build, so it is `release`
 * and reaches only what `features.json` calls `an`. Nothing has to be configured for that
 * to hold, which is what makes iOS safe by default: a forgotten setting makes a feature
 * disappear instead of shipping it. Only the places that really are previews say so, each
 * in its own condition: the dev server (`__DEV__`), the web export, which Pages
 * publishes and which is the demo, and the tester APK the Android release workflow
 * builds when a person asks it for one (§2's manual input). `expo export` sets `__DEV__`
 * false, so the web export is named by its platform and not by the dev flag.
 *
 * A function of its inputs rather than a constant someone edits, so the one place a
 * build could be mislabelled `preview` is this expression and a test reads it. The third
 * argument is the opt-in, defaulted from the build's environment so `CHANNEL` below has
 * one call site and the tests can say which environment they mean.
 */
export function channelFor(dev: boolean, platform: string, optIn = previewOptIn()): Channel {
  return dev || platform === 'web' || optIn ? 'preview' : 'release';
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

/**
 * Where the workbench says "show me what the release build shows". Same seam, same one
 * origin on the web, same single read while the store is built.
 */
export const PREVIEW_CHANNEL_KEY = 'workbench:channel';

/**
 * The channel the store is built for: the build's own, lowered to `release` when the frame
 * asks for it and never raised.
 *
 * **Only the value `release` counts**, and only as a way down: whatever is stored, a
 * `release` build stays `release` (it returns `base` untouched), so a native build, which has
 * no `localStorage` to hold the key, and a store build that somehow had one, cannot reach a
 * feature through it. Fail-closed stays the whole rule (ADR 0072 §2).
 */
export function lowerChannel(base: Channel, stored: string | null): Channel {
  return base === 'preview' && stored === 'release' ? 'release' : base;
}

export function storeChannel(base: Channel = CHANNEL): Channel {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return base;
    return lowerChannel(base, window.localStorage.getItem(PREVIEW_CHANNEL_KEY));
  } catch {
    return base;
  }
}

export function previewFeatureOverride(): FeatureOverride | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const text = window.localStorage.getItem(PREVIEW_FEATURES_KEY);
    return text === null ? null : parseFeatureOverride(JSON.parse(text));
  } catch {
    return null;
  }
}
