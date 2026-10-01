import { useEffect } from 'react';
import { Uniwind } from 'uniwind';

import { useTheme } from '@/lib/store/core';

/** What the app's appearance setting can be. */
export type ThemeSetting = 'system' | 'light' | 'dark';

/**
 * Hands the app's appearance setting to Uniwind, which owns the colour system.
 *
 * The setting is passed on VERBATIM, `'system'` included — and that is the part
 * worth reading, because under NativeWind doing so was a bug that shipped.
 *
 * There, `'system'` had to be resolved here first: handing it through left the
 * app's JavaScript following the device while `darkMode: 'class'` waited for a
 * class nothing added, so `useColors()` returned the dark palette while
 * `bg-canvas` stayed white — near-white text on a white page, on a build where
 * typecheck, lint, the tests, the Android build and the web export were all green.
 * It even survived a browser walk, which flipped the setting to `'dark'` and
 * pinned the emulated `prefers-color-scheme` to light: both paths that work,
 * neither that breaks.
 *
 * Uniwind closes that gap by construction rather than by discipline. It registers
 * two themes, `light` and `dark`, and `setTheme` accepts `'system'` as a third
 * value it handles itself: it turns adaptive themes back on and resolves
 * `currentTheme` to the device scheme. So the value `useUniwind()` reports and the
 * value the styles use are the same one, and `'system'` never survives as a
 * *state*. Its generated CSS covers BOTH paths — a `.light`/`.dark` class on the
 * element or any ancestor, and a `prefers-color-scheme` fallback for when no class
 * is set — so neither half can be left waiting on the other.
 *
 * An explicit `'light'` or `'dark'` still overrides the device, which is the whole
 * reason this is a setting: a user who picks light on a dark phone means it.
 */
export function useAppearance(): void {
  useGivenAppearance(useTheme());
}

/**
 * The same, for a host that already has an appearance setting of its own.
 *
 * `apps/workbench` is a website with a light/dark/system control in its own
 * header, and the components it draws have to follow THAT rather than the app's
 * stored preference — the app's store is not hydrated there, so every specimen
 * would sit at `'system'` while the page around it was explicitly dark.
 *
 * Split out rather than copied, because the one line it wraps is the line that
 * has broken twice (see above, and ADR 0008): `Uniwind.setTheme` is called from
 * exactly one place in this repository, and both hosts reach it through here.
 */
export function useGivenAppearance(setting: ThemeSetting): void {
  useEffect(() => {
    Uniwind.setTheme(setting);

    // ON THE WEB, `'system'` is resolved ONCE and has to be asked again when the
    // device answer changes. `setTheme('system')` reads the scheme and stamps the
    // result on the root element; nothing re-reads it, so a reader who switches
    // their machine to dark with the page open keeps the scheme it loaded with.
    // Measured on the built site on 2026-09-11: the site's own chrome followed,
    // because its CSS sits behind a media query, while everything drawn through
    // Uniwind stayed light. The other two settings are explicit and mean what they
    // say, so they do not listen.
    //
    // `matchMedia` is the guard rather than `Platform.OS`, because this has to be
    // false in two places that are not a platform: the pre-render pass of
    // `expo export`, which runs in Node, and any native runtime that grows a
    // partial `window`. What the native side does with an adaptive theme is
    // Uniwind's own business and is not measured here.
    if (setting !== 'system') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const device = window.matchMedia('(prefers-color-scheme: dark)');
    const resolveAgain = () => Uniwind.setTheme('system');
    device.addEventListener('change', resolveAgain);
    return () => device.removeEventListener('change', resolveAgain);
  }, [setting]);
}
