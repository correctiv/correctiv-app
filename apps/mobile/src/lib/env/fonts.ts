/**
 * The app's five cuts, loaded.
 *
 * A module of its own so that `AppEnvironment.tsx` and `app/_layout.tsx` ask for
 * the fonts through one call and `lib/theme/font-assets.ts` keeps exactly one
 * importer. The list of files stays there; this is only the loading.
 *
 * Both hosts call it, and the second one is why it exists. The workbench applies
 * the family NAMES — `Typo` writes `fontFamily: 'SourceSans3_400Regular'` into a
 * TextStyle — and for a while loaded no file behind them, so a browser fell back
 * to its standard face, which is a serif. Every drawn component read as Times,
 * `variant="text-article"` was the wrong serif rather than Merriweather, and
 * every bold string lost its weight, because this app names one loaded family per
 * cut (`lib/theme/fonts.ts` says why) and a family that is not there takes the
 * weight with it.
 *
 * `expo-font` caches by family name, so the two call sites are one load.
 */
import { useFonts } from 'expo-font';

// By path, and the reason is in that file: `@expo-google-fonts/*` resolves to a
// React Native asset registration, so the barrel leaves it out and every
// component importing `useColors` from `@/lib/theme` stays clear of Expo's font
// loader (ADR 0027).
import { fontAssets } from '@/lib/theme/font-assets';

/** `[loaded, error]`, as `expo-font` returns them. */
export function useAppFonts(): [boolean, Error | null] {
  return useFonts(fontAssets);
}
